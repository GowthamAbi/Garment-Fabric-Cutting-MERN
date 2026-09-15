import crypto from "node:crypto";
import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import Company from "../models/Company.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import ApiError from "../utils/ApiError.js";
import { generateReferenceNo } from "../utils/generateReferenceNo.js";

const planAmount = { Trial: 0, Basic: 199900, Professional: 499900, Enterprise: 999900 };
const addDays = (days) => new Date(Date.now() + days * 86400000);

export async function getSubscription(request, response) {
  const company = await Company.findById(request.user.companyId).lean();
  const payments = await SubscriptionPayment.find().sort({ createdAt: -1 }).limit(50).lean();
  response.json({ company, payments, razorpayEnabled: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) });
}

export async function createSubscription(request, response) {
  const plan = request.body.plan;
  const method = request.body.paymentMethod || "MANUAL";
  if (!(plan in planAmount) || !["MANUAL", "RAZORPAY"].includes(method)) throw new ApiError(400, "Valid plan and payment method are required");
  const payment = await SubscriptionPayment.create({ referenceNo: generateReferenceNo("SUB"), plan, amount: planAmount[plan] / 100, paymentMethod: method, status: method === "MANUAL" ? "PENDING_APPROVAL" : "CREATED", notes: request.body.notes || "" });
  if (method === "RAZORPAY") {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) throw new ApiError(503, "Razorpay is not configured; use Manual approval");
    const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const providerResponse = await fetch("https://api.razorpay.com/v1/orders", { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" }, body: JSON.stringify({ amount: planAmount[plan], currency: "INR", receipt: payment.referenceNo }) });
    const order = await providerResponse.json();
    if (!providerResponse.ok) throw new ApiError(502, order.error?.description || "Payment order creation failed");
    payment.providerOrderId = order.id; await payment.save();
  }
  response.status(201).json(payment);
}

export async function approveSubscription(request, response) {
  const payment = await SubscriptionPayment.findById(request.params.id);
  if (!payment) throw new ApiError(404, "Subscription payment not found");
  payment.status = "PAID"; payment.approvedBy = request.user.name; payment.periodStart = new Date(); payment.periodEnd = addDays(payment.plan === "Trial" ? 14 : 30); await payment.save();
  await Company.findByIdAndUpdate(payment.companyId, { subscriptionPlan: payment.plan, subscriptionStatus: "Active", subscriptionStartsAt: payment.periodStart, subscriptionEndsAt: payment.periodEnd, active: true });
  response.json(payment);
}

export async function razorpayWebhook(request, response) {
  const signature = request.get("x-razorpay-signature") || "";
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || "missing").update(request.rawBody || JSON.stringify(request.body)).digest("hex");
  if (!signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new ApiError(401, "Invalid payment signature");
  const entity = request.body.payload?.payment?.entity;
  if (request.body.event === "payment.captured" && entity?.order_id) {
    const payment = await SubscriptionPayment.findOne({ providerOrderId: entity.order_id });
    if (payment && payment.status !== "PAID") { payment.status = "PAID"; payment.providerPaymentId = entity.id; payment.periodStart = new Date(); payment.periodEnd = addDays(30); await payment.save(); await Company.findByIdAndUpdate(payment.companyId, { subscriptionPlan: payment.plan, subscriptionStatus: "Active", subscriptionStartsAt: payment.periodStart, subscriptionEndsAt: payment.periodEnd }); }
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
  response.setHeader("Content-Disposition", `attachment; filename=accessories-flow-backup-${new Date().toISOString().slice(0,10)}.json`);
  response.json({ formatVersion: 1, exportedAt: new Date(), company, data });
}
