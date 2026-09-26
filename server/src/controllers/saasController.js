import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import Company from "../models/Company.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import SaasPlan from "../models/SaasPlan.js";
import SalesLead from "../models/SalesLead.js";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { generateReferenceNo } from "../utils/generateReferenceNo.js";

const addDays = (days) => new Date(Date.now() + days * 86400000);
const defaultPlans = [
  ["TRIAL", "Trial", 0, 14, 3, 2], ["STARTER", "Starter", 0, 30, 5, 3],
  ["PROFESSIONAL", "Professional", 0, 30, 20, 6], ["BUSINESS", "Business", 0, 30, 50, 10],
  ["ENTERPRISE", "Enterprise", 0, 365, 500, 20], ["SETUP", "Setup & Training", 0, 30, 5, 3],
].map(([code,name,price,validityDays,maxUsers,maxDepartments],sortOrder)=>({ code,name,price,validityDays,maxUsers,maxDepartments,sortOrder,description:`${name} garment production package`,modules:["Fabric","Cutting","Elastic","Accessories","Delivery"] }));

async function ensurePlans() {
  if (await SaasPlan.countDocuments()) return;
  await SaasPlan.insertMany(defaultPlans);
}

export async function getSubscription(request, response) {
  await ensurePlans();
  const company = await Company.findById(request.user.companyId).lean();
  const payments = await SubscriptionPayment.find().populate("companyId", "companyName").sort({ createdAt: -1 }).limit(50).lean();
  const plans = await SaasPlan.find({ active: true }).sort({ sortOrder: 1 }).lean();
  response.json({ company, payments, plans, razorpayKeyId: process.env.RAZORPAY_KEY_ID || "", razorpayEnabled: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) });
}

export async function createSubscription(request, response) {
  await ensurePlans();
  const planRecord = await SaasPlan.findOne({ $or: [{ code: String(request.body.plan || "").toUpperCase() }, { name: request.body.plan }], active: true });
  const method = request.body.paymentMethod || "MANUAL";
  if (!planRecord || !["MANUAL", "RAZORPAY"].includes(method)) throw new ApiError(400, "Valid plan and payment method are required");
  const taxAmount = Number(((planRecord.price + planRecord.setupFee) * planRecord.taxPercent / 100).toFixed(2));
  const total = planRecord.price + planRecord.setupFee + taxAmount;
  const payment = await SubscriptionPayment.create({ companyId: request.user.companyId, referenceNo: generateReferenceNo("SUB"), plan: planRecord.name, amount: total, setupFee: planRecord.setupFee, taxAmount, paymentMethod: method, status: method === "MANUAL" ? "PENDING_APPROVAL" : "CREATED", notes: request.body.notes || "" });
  if (method === "RAZORPAY") {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) throw new ApiError(503, "Razorpay is not configured; use Manual approval");
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const providerResponse = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify({ amount: Math.round(total * 100), currency: "INR", receipt: payment.referenceNo }) });
    const order = await providerResponse.json();
    if (!providerResponse.ok) throw new ApiError(502, order.error?.description || "Payment order creation failed");
    payment.providerOrderId = order.id; await payment.save();
  }
  response.status(201).json({ ...payment.toObject(), razorpayKeyId: process.env.RAZORPAY_KEY_ID || "" });
}

export async function approveSubscription(request, response) {
  const payment = await SubscriptionPayment.findById(request.params.id);
  if (!payment) throw new ApiError(404, "Subscription payment not found");
  const plan = await SaasPlan.findOne({ name: payment.plan }).lean();
  payment.status = "PAID"; payment.approvedBy = request.user.name; payment.periodStart = new Date(); payment.periodEnd = addDays(plan?.validityDays || 30); await payment.save();
  await Company.findByIdAndUpdate(payment.companyId, { subscriptionPlan: payment.plan, subscriptionStatus: "Active", subscriptionStartsAt: payment.periodStart, subscriptionEndsAt: payment.periodEnd, active: true });
  response.json(payment);
}

export async function verifyRazorpayPayment(request, response) {
  const payment = await SubscriptionPayment.findOne({ providerOrderId: request.body.razorpay_order_id });
  if (!payment) throw new ApiError(404, "Payment order not found");
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "").update(`${request.body.razorpay_order_id}|${request.body.razorpay_payment_id}`).digest("hex");
  if (!request.body.razorpay_signature || expected !== request.body.razorpay_signature) throw new ApiError(401, "Invalid Razorpay signature");
  const plan = await SaasPlan.findOne({ name: payment.plan }).lean();
  payment.status = "PAID"; payment.providerPaymentId = request.body.razorpay_payment_id; payment.periodStart = new Date(); payment.periodEnd = addDays(plan?.validityDays || 30); await payment.save();
  await Company.findByIdAndUpdate(payment.companyId, { subscriptionPlan: payment.plan, subscriptionStatus: "Active", subscriptionStartsAt: payment.periodStart, subscriptionEndsAt: payment.periodEnd, active: true });
  response.json(payment);
}

export async function listPlans(_request, response) { await ensurePlans(); response.json(await SaasPlan.find().sort({ sortOrder: 1, createdAt: 1 })); }
export async function savePlan(request, response) {
  const payload = (({ code,name,description,price,cost,setupFee,taxPercent,validityDays,maxUsers,maxDepartments,modules,active,featured,sortOrder })=>({code,name,description,price,cost,setupFee,taxPercent,validityDays,maxUsers,maxDepartments,modules,active,featured,sortOrder}))(request.body);
  const plan = request.params.id ? await SaasPlan.findByIdAndUpdate(request.params.id,payload,{new:true,runValidators:true}) : await SaasPlan.create(payload);
  response.status(request.params.id ? 200 : 201).json(plan);
}

export async function getOwnerOverview(_request, response) {
  await ensurePlans();
  const [companies,users,payments,leads,plans] = await Promise.all([Company.find().lean(),User.find().lean(),SubscriptionPayment.find().lean(),SalesLead.find().sort({createdAt:-1}).lean(),SaasPlan.find().sort({sortOrder:1}).lean()]);
  const paid=payments.filter(x=>x.status==="PAID"), revenue=paid.reduce((s,x)=>s+Number(x.amount||0),0);
  const planCosts=Object.fromEntries(plans.map(p=>[p.name,Number(p.cost||0)]));
  const profit=paid.reduce((s,x)=>s+Number(x.amount||0)-Number(planCosts[x.plan]||0),0);
  const planSales=plans.map(p=>({name:p.name,customers:companies.filter(c=>c.subscriptionPlan===p.name).length,revenue:paid.filter(x=>x.plan===p.name).reduce((s,x)=>s+Number(x.amount||0),0)}));
  response.json({ metrics:{companies:companies.length,activeCompanies:companies.filter(c=>c.active&&c.subscriptionStatus==="Active").length,users:users.length,activeUsers:users.filter(u=>u.active).length,trials:companies.filter(c=>c.subscriptionPlan==="Trial").length,newRequests:leads.filter(l=>l.status==="NEW").length,revenue,profit,pendingAmount:payments.filter(x=>x.status==="PENDING_APPROVAL").reduce((s,x)=>s+Number(x.amount||0),0)},planSales,recentLeads:leads.slice(0,8),expiring:companies.filter(c=>c.subscriptionEndsAt&&new Date(c.subscriptionEndsAt)<addDays(15)).slice(0,10) });
}

export async function listLeads(request,response){const filter=request.query.status?{status:request.query.status}:{};response.json(await SalesLead.find(filter).sort({nextFollowUpAt:1,createdAt:-1}));}
export async function saveLead(request,response){const lead=request.params.id?await SalesLead.findByIdAndUpdate(request.params.id,request.body,{new:true,runValidators:true}):await SalesLead.create(request.body);response.status(request.params.id?200:201).json(lead);}
export async function addLeadActivity(request,response){const lead=await SalesLead.findByIdAndUpdate(request.params.id,{$push:{activities:{type:request.body.type,note:request.body.note,at:request.body.at||new Date()}},...(request.body.status&&{$set:{status:request.body.status,nextFollowUpAt:request.body.nextFollowUpAt}})},{new:true});if(!lead)throw new ApiError(404,"Lead not found");response.json(lead);}

export async function publicPlans(_request,response){await ensurePlans();response.json(await SaasPlan.find({active:true}).sort({sortOrder:1}).select("-createdAt -updatedAt -__v"));}
export async function publicRequest(request,response){const lead=await SalesLead.create({...request.body,source:request.body.source||"WEBSITE",status:"NEW",activities:[{type:"NOTE",note:"Website purchase/demo request"}]});response.status(201).json({success:true,requestId:lead._id,message:"Request received. Our team will contact you."});}
export async function startPublicTrial(request,response){
  const {companyName,name,email,password,phone,city,departments=[]}=request.body;
  if(!companyName||!name||!email||!password)throw new ApiError(400,"Company, name, email and password are required");
  if(String(password).length<8)throw new ApiError(400,"Password must contain at least 8 characters");
  if(await User.exists({email:String(email).toLowerCase()}))throw new ApiError(409,"Email already registered");
  await ensurePlans(); const trial=await SaasPlan.findOne({code:"TRIAL",active:true}).lean();
  const company=await Company.create({companyName,address:city||"",subscriptionPlan:"Trial",subscriptionStatus:"Active",subscriptionStartsAt:new Date(),subscriptionEndsAt:addDays(trial?.validityDays||14),factories:[{name:`${companyName} Main`,code:"MAIN",address:city||""}]});
  await User.create({name,email,password:await bcrypt.hash(password,12),role:"company_admin",companyId:company._id,factoryId:company.factories[0]._id});
  await SalesLead.create({companyName,contactName:name,email,phone,city,departments,status:"TRIAL_ACTIVE",demoExpiresAt:company.subscriptionEndsAt,convertedCompanyId:company._id,source:"WEBSITE_TRIAL"});
  response.status(201).json({success:true,expiresAt:company.subscriptionEndsAt,message:"Trial created. You can login now."});
}

export async function updateSubscriptionStatus(request, response) {
  const action = String(request.body.action || "").toUpperCase();
  const states = { ACTIVATE: "Active", PAUSE: "Suspended", REMOVE: "Expired" };
  if (!states[action]) throw new ApiError(400, "Action must be ACTIVATE, PAUSE or REMOVE");
  const company = await Company.findByIdAndUpdate(
    request.user.companyId,
    { subscriptionStatus: states[action], active: action !== "REMOVE" },
    { new: true },
  );
  if (!company) throw new ApiError(404, "Company not found");
  response.json(company);
}

export async function razorpayWebhook(request, response) {
  const signature = request.get("x-razorpay-signature") || "";
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || "missing").update(request.rawBody || JSON.stringify(request.body)).digest("hex");
  if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new ApiError(401, "Invalid payment signature");
  const entity = request.body.payload?.payment?.entity;
  if (request.body.event === "payment.captured" && entity?.order_id) {
    const payment = await SubscriptionPayment.findOne({ providerOrderId: entity.order_id });
    if (payment && payment.status !== "PAID") { const plan=await SaasPlan.findOne({name:payment.plan}).lean(); payment.status = "PAID"; payment.providerPaymentId = entity.id; payment.periodStart = new Date(); payment.periodEnd = addDays(plan?.validityDays||30); await payment.save(); await Company.findByIdAndUpdate(payment.companyId, { subscriptionPlan: payment.plan, subscriptionStatus: "Active", subscriptionStartsAt: payment.periodStart, subscriptionEndsAt: payment.periodEnd, active:true }); }
  }
  response.json({ received: true });
}

export async function getAuditHistory(request, response) {
  const from = request.query.from ? new Date(request.query.from) : new Date(Date.now() - 30 * 86400000);
  const to = request.query.to ? new Date(`${request.query.to}T23:59:59.999Z`) : new Date();
  response.json(await AuditLog.find({ createdAt: { $gte: from, $lte: to } }).sort({ createdAt: -1 }).limit(5000).lean());
}

export async function downloadBackup(request, response) {
  const companyId = new mongoose.Types.ObjectId(request.user.companyId);
  const collections = await mongoose.connection.db.listCollections().toArray();
  const data = {};
  for (const collection of collections) {
    if (["companies", "system.version"].includes(collection.name)) continue;
    data[collection.name] = await mongoose.connection.db.collection(collection.name).find({ companyId }).toArray();
  }
  const company = await Company.findById(companyId).lean();
  response.setHeader("Content-Disposition", `attachment; filename=ug-saas-backup-${new Date().toISOString().slice(0,10)}.json`);
  response.json({ formatVersion: 1, exportedAt: new Date(), company, data });
}
