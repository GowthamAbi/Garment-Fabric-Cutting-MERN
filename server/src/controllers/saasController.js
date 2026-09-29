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
  ["TRIAL", "Trial", 0, 14, 3, 2],
  ["STARTER", "Starter", 0, 30, 5, 3],
  ["PROFESSIONAL", "Professional", 0, 30, 20, 6],
  ["BUSINESS", "Business", 0, 30, 50, 10],
  ["ENTERPRISE", "Enterprise", 0, 365, 500, 20],
  ["SETUP", "Setup & Training", 0, 30, 5, 3],
].map(
  ([code, name, price, validityDays, maxUsers, maxDepartments], sortOrder) => ({
    code,
    name,
    price,
    validityDays,
    maxUsers,
    maxDepartments,
    sortOrder,
    description: `${name} garment production package`,
    modules: ["Fabric", "Cutting", "Elastic", "Accessories", "Delivery"],
  }),
);

async function ensurePlans() {
  if (await SaasPlan.countDocuments()) return;
  await SaasPlan.insertMany(defaultPlans);
}

export async function getSubscription(request, response) {
  await ensurePlans();
  const company = await Company.findById(request.user.companyId).lean();
  const payments = await SubscriptionPayment.find()
    .populate("companyId", "companyName")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  const plans = await SaasPlan.find({ active: true })
    .sort({ sortOrder: 1 })
    .lean();
  response.json({
    company,
    payments,
    plans,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
    razorpayEnabled: Boolean(
      process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET,
    ),
  });
}

export async function createSubscription(request, response) {
  await ensurePlans();
  const planRecord = await SaasPlan.findOne({
    $or: [
      { code: String(request.body.plan || "").toUpperCase() },
      { name: request.body.plan },
    ],
    active: true,
  });
  const method = request.body.paymentMethod || "MANUAL";
  if (!planRecord || !["MANUAL", "RAZORPAY"].includes(method))
    throw new ApiError(400, "Valid plan and payment method are required");
  const taxAmount = Number(
    (
      ((planRecord.price + planRecord.setupFee) * planRecord.taxPercent) /
      100
    ).toFixed(2),
  );
  const total = planRecord.price + planRecord.setupFee + taxAmount;
  const payment = await SubscriptionPayment.create({
    companyId: request.user.companyId,
    referenceNo: generateReferenceNo("SUB"),
    plan: planRecord.name,
    amount: total,
    setupFee: planRecord.setupFee,
    taxAmount,
    paymentMethod: method,
    status: method === "MANUAL" ? "PENDING_APPROVAL" : "CREATED",
    notes: request.body.notes || "",
  });
  if (method === "RAZORPAY") {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
      throw new ApiError(
        503,
        "Razorpay is not configured; use Manual approval",
      );
    const auth = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
    ).toString("base64");
    const providerResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(total * 100),
        currency: "INR",
        receipt: payment.referenceNo,
      }),
    });
    const order = await providerResponse.json();
    if (!providerResponse.ok)
      throw new ApiError(
        502,
        order.error?.description || "Payment order creation failed",
      );
    payment.providerOrderId = order.id;
    await payment.save();
  }
  response.status(201).json({
    ...payment.toObject(),
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
  });
}

export async function approveSubscription(request, response) {
  const payment = await SubscriptionPayment.findById(request.params.id);
  if (!payment) throw new ApiError(404, "Subscription payment not found");
  const plan = await SaasPlan.findOne({ name: payment.plan }).lean();
  payment.status = "PAID";
  payment.approvedBy = request.user.name;
  payment.periodStart = new Date();
  payment.periodEnd = addDays(plan?.validityDays || 30);
  await payment.save();
  await Company.findByIdAndUpdate(payment.companyId, {
    subscriptionPlan: payment.plan,
    subscriptionStatus: "Active",
    subscriptionStartsAt: payment.periodStart,
    subscriptionEndsAt: payment.periodEnd,
    active: true,
  });
  response.json(payment);
}

export async function verifyRazorpayPayment(request, response) {
  const payment = await SubscriptionPayment.findOne({
    providerOrderId: request.body.razorpay_order_id,
  });
  if (!payment) throw new ApiError(404, "Payment order not found");
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
    .update(
      `${request.body.razorpay_order_id}|${request.body.razorpay_payment_id}`,
    )
    .digest("hex");
  if (
    !request.body.razorpay_signature ||
    expected !== request.body.razorpay_signature
  )
    throw new ApiError(401, "Invalid Razorpay signature");
  const plan = await SaasPlan.findOne({ name: payment.plan }).lean();
  payment.status = "PAID";
  payment.providerPaymentId = request.body.razorpay_payment_id;
  payment.periodStart = new Date();
  payment.periodEnd = addDays(plan?.validityDays || 30);
  await payment.save();
  await Company.findByIdAndUpdate(payment.companyId, {
    subscriptionPlan: payment.plan,
    subscriptionStatus: "Active",
    subscriptionStartsAt: payment.periodStart,
    subscriptionEndsAt: payment.periodEnd,
    active: true,
  });
  response.json(payment);
}

export async function listPlans(_request, response) {
  await ensurePlans();
  response.json(await SaasPlan.find().sort({ sortOrder: 1, createdAt: 1 }));
}
export async function savePlan(request, response) {
  const payload = (({
    code,
    name,
    description,
    price,
    cost,
    setupFee,
    taxPercent,
    validityDays,
    maxUsers,
    maxDepartments,
    modules,
    active,
    featured,
    sortOrder,
  }) => ({
    code,
    name,
    description,
    price,
    cost,
    setupFee,
    taxPercent,
    validityDays,
    maxUsers,
    maxDepartments,
    modules,
    active,
    featured,
    sortOrder,
  }))(request.body);
  const plan = request.params.id
    ? await SaasPlan.findByIdAndUpdate(request.params.id, payload, {
        new: true,
        runValidators: true,
      })
    : await SaasPlan.create(payload);
  response.status(request.params.id ? 200 : 201).json(plan);
}

export async function getOwnerOverview(_request, response) {
  await ensurePlans();
  const [companies, users, payments, leads, plans] = await Promise.all([
    Company.find().lean(),
    User.find().lean(),
    SubscriptionPayment.find().lean(),
    SalesLead.find().sort({ createdAt: -1 }).lean(),
    SaasPlan.find().sort({ sortOrder: 1 }).lean(),
  ]);
  const paid = payments.filter((x) => x.status === "PAID"),
    revenue = paid.reduce((s, x) => s + Number(x.amount || 0), 0);
  const planCosts = Object.fromEntries(
    plans.map((p) => [p.name, Number(p.cost || 0)]),
  );
  const profit = paid.reduce(
    (s, x) => s + Number(x.amount || 0) - Number(planCosts[x.plan] || 0),
    0,
  );
  const planSales = plans.map((p) => ({
    name: p.name,
    customers: companies.filter((c) => c.subscriptionPlan === p.name).length,
    revenue: paid
      .filter((x) => x.plan === p.name)
      .reduce((s, x) => s + Number(x.amount || 0), 0),
  }));
  response.json({
    metrics: {
      companies: companies.length,
      activeCompanies: companies.filter(
        (c) => c.active && c.subscriptionStatus === "Active",
      ).length,
      users: users.length,
      activeUsers: users.filter((u) => u.active).length,
      trials: companies.filter((c) => c.subscriptionPlan === "Trial").length,
      newRequests: leads.filter((lead) =>
        ["NEW", "TRIAL_PENDING"].includes(lead.status),
      ).length,
      revenue,
      profit,
      pendingAmount: payments
        .filter((x) => x.status === "PENDING_APPROVAL")
        .reduce((s, x) => s + Number(x.amount || 0), 0),
    },
    planSales,
    recentLeads: leads.slice(0, 8),
    expiring: companies
      .filter(
        (c) =>
          c.subscriptionEndsAt && new Date(c.subscriptionEndsAt) < addDays(15),
      )
      .slice(0, 10),
  });
}

export async function listLeads(request, response) {
  const filter = request.query.status ? { status: request.query.status } : {};
  response.json(
    await SalesLead.find(filter).sort({ nextFollowUpAt: 1, createdAt: -1 }),
  );
}
export async function saveLead(request, response) {
  const lead = request.params.id
    ? await SalesLead.findByIdAndUpdate(request.params.id, request.body, {
        new: true,
        runValidators: true,
      })
    : await SalesLead.create(request.body);
  response.status(request.params.id ? 200 : 201).json(lead);
}
export async function addLeadActivity(request, response) {
  const lead = await SalesLead.findByIdAndUpdate(
    request.params.id,
    {
      $push: {
        activities: {
          type: request.body.type,
          note: request.body.note,
          at: request.body.at || new Date(),
        },
      },
      ...(request.body.status && {
        $set: {
          status: request.body.status,
          nextFollowUpAt: request.body.nextFollowUpAt,
        },
      }),
    },
    { new: true },
  );
  if (!lead) throw new ApiError(404, "Lead not found");
  response.json(lead);
}

export async function publicPlans(_request, response) {
  await ensurePlans();
  response.json(
    await SaasPlan.find({ active: true })
      .sort({ sortOrder: 1 })
      .select("-createdAt -updatedAt -__v"),
  );
}

const cleanText = (value, maximum = 250) =>
  String(value || "")
    .trim()
    .replace(/[<>]/g, "")
    .slice(0, maximum);

function validatePublicContact(body) {
  const email = cleanText(body.email, 160).toLowerCase();
  const phone = cleanText(body.phone, 24).replace(/[^0-9+() -]/g, "");

  if (!body.companyName || !body.contactName || !email || !phone) {
    throw new ApiError(
      400,
      "Company, contact name, email and phone are required",
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, "Enter a valid email address");
  }

  return { email, phone };
}

export async function publicRequest(request, response) {
  if (request.body.companyWebsite) {
    return response.status(201).json({
      success: true,
      message: "Request received. Our team will contact you.",
    });
  }

  const { email, phone } = validatePublicContact(request.body);
  const source = [
    "DEMO_BOOKING",
    "DEMO_CONTACT_SALES",
    "DEMO_PLAN_REQUEST",
    "WEBSITE",
  ].includes(request.body.source)
    ? request.body.source
    : "WEBSITE";
  const requestType =
    source === "DEMO_BOOKING"
      ? "BOOK_DEMO"
      : source === "DEMO_CONTACT_SALES"
        ? "CONTACT_SALES"
        : source === "DEMO_PLAN_REQUEST"
          ? "PLAN_REQUEST"
          : "LEAD";
  const lead = await SalesLead.create({
    companyName: cleanText(request.body.companyName, 120),
    contactName: cleanText(request.body.contactName, 100),
    city: cleanText(request.body.city, 100),
    phone,
    email,
    source,
    requestType,
    planCode: cleanText(request.body.planCode, 40).toUpperCase(),
    userCount: Math.min(
      10000,
      Math.max(1, Number(request.body.userCount) || 1),
    ),
    requirements: cleanText(request.body.requirements, 1500),
    status: "NEW",
    activities: [
      {
        type: "NOTE",
        note: `${requestType} request received from public demo`,
      },
    ],
  });
  response.status(201).json({
    success: true,
    requestId: lead._id,
    message: "Request received. Our team will contact you.",
  });
}
export async function startPublicTrial(request, response) {
  const {
    companyName,
    name,
    email,
    password,
    phone,
    city,
    departments = [],
  } = request.body;
  if (request.body.companyWebsite) {
    return response.status(201).json({
      success: true,
      message: "Trial request submitted for owner approval.",
    });
  }
  if (!companyName || !name || !email || !password)
    throw new ApiError(400, "Company, name, email and password are required");
  if (String(password).length < 8)
    throw new ApiError(400, "Password must contain at least 8 characters");
  if (await User.exists({ email: String(email).toLowerCase() }))
    throw new ApiError(409, "Email already registered");
  const normalizedEmail = cleanText(email, 160).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail))
    throw new ApiError(400, "Enter a valid email address");
  if (
    await SalesLead.exists({
      email: normalizedEmail,
      status: "TRIAL_PENDING",
    })
  )
    throw new ApiError(409, "A trial request is already awaiting approval");

  const lead = await SalesLead.create({
    companyName: cleanText(companyName, 120),
    contactName: cleanText(name, 100),
    email: normalizedEmail,
    phone: cleanText(phone, 24),
    city: cleanText(city, 100),
    departments: Array.isArray(departments)
      ? departments.map((value) => cleanText(value, 30)).slice(0, 10)
      : [],
    requestType: "TRIAL",
    planCode: "TRIAL",
    status: "TRIAL_PENDING",
    pendingPasswordHash: await bcrypt.hash(password, 12),
    source: "WEBSITE_TRIAL",
    activities: [
      { type: "NOTE", note: "Trial registration awaiting SaaS Owner approval" },
    ],
  });
  response.status(201).json({
    success: true,
    requestId: lead._id,
    message: "Trial request submitted. Login opens only after owner approval.",
  });
}

export async function decideLeadRequest(request, response) {
  const action = String(request.body.action || "").toUpperCase();
  if (!["ACCEPT", "REJECT"].includes(action))
    throw new ApiError(400, "Action must be ACCEPT or REJECT");

  const lead = await SalesLead.findById(request.params.id).select(
    "+pendingPasswordHash",
  );
  if (!lead) throw new ApiError(404, "Request not found");
  if (!["NEW", "TRIAL_PENDING"].includes(lead.status))
    throw new ApiError(409, "This request is already decided");

  if (lead.requestType === "TRIAL" && lead.status !== "TRIAL_PENDING")
    throw new ApiError(409, "Trial request is not awaiting approval");

  if (action === "REJECT") {
    lead.status = "REJECTED";
    lead.pendingPasswordHash = "";
    lead.decisionBy = request.user.name;
    lead.decisionAt = new Date();
    lead.activities.push({
      type: "NOTE",
      note: "Request rejected by SaaS Owner",
    });
    await lead.save();
    return response.json({ message: "Request rejected", lead });
  }

  if (lead.requestType !== "TRIAL") {
    lead.status = "APPROVED";
    lead.decisionBy = request.user.name;
    lead.decisionAt = new Date();
    lead.activities.push({
      type: "NOTE",
      note: "Request accepted for follow-up",
    });
    await lead.save();
    return response.json({ message: "Request accepted", lead });
  }

  if (!lead.pendingPasswordHash)
    throw new ApiError(409, "Trial credential is unavailable");
  if (await User.exists({ email: lead.email }))
    throw new ApiError(409, "Email is already registered");

  await ensurePlans();
  const trial = await SaasPlan.findOne({ code: "TRIAL", active: true }).lean();
  const expiry = addDays(trial?.validityDays || 14);
  const company = await Company.create({
    companyName: lead.companyName,
    address: lead.city || "",
    subscriptionPlan: "Trial",
    subscriptionStatus: "Active",
    subscriptionStartsAt: new Date(),
    subscriptionEndsAt: expiry,
    factories: [
      {
        name: `${lead.companyName} Main`,
        code: "MAIN",
        address: lead.city || "",
      },
    ],
  });
  await User.create({
    name: lead.contactName,
    email: lead.email,
    password: lead.pendingPasswordHash,
    role: "company_admin",
    companyId: company._id,
    factoryId: company.factories[0]._id,
  });

  lead.status = "TRIAL_ACTIVE";
  lead.pendingPasswordHash = "";
  lead.demoExpiresAt = expiry;
  lead.convertedCompanyId = company._id;
  lead.decisionBy = request.user.name;
  lead.decisionAt = new Date();
  lead.activities.push({
    type: "NOTE",
    note: "Trial approved and workspace activated",
  });
  await lead.save();

  response.json({
    message: "Trial approved. Customer can login now.",
    expiresAt: expiry,
    lead,
  });
}

export async function updateSubscriptionStatus(request, response) {
  const action = String(request.body.action || "").toUpperCase();
  const states = { ACTIVATE: "Active", PAUSE: "Suspended", REMOVE: "Expired" };
  if (!states[action])
    throw new ApiError(400, "Action must be ACTIVATE, PAUSE or REMOVE");
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
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || "missing")
    .update(request.rawBody || JSON.stringify(request.body))
    .digest("hex");
  if (
    !signature ||
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    throw new ApiError(401, "Invalid payment signature");
  const entity = request.body.payload?.payment?.entity;
  if (request.body.event === "payment.captured" && entity?.order_id) {
    const payment = await SubscriptionPayment.findOne({
      providerOrderId: entity.order_id,
    });
    if (payment && payment.status !== "PAID") {
      const plan = await SaasPlan.findOne({ name: payment.plan }).lean();
      payment.status = "PAID";
      payment.providerPaymentId = entity.id;
      payment.periodStart = new Date();
      payment.periodEnd = addDays(plan?.validityDays || 30);
      await payment.save();
      await Company.findByIdAndUpdate(payment.companyId, {
        subscriptionPlan: payment.plan,
        subscriptionStatus: "Active",
        subscriptionStartsAt: payment.periodStart,
        subscriptionEndsAt: payment.periodEnd,
        active: true,
      });
    }
  }
  response.json({ received: true });
}

export async function getAuditHistory(request, response) {
  const from = request.query.from
    ? new Date(request.query.from)
    : new Date(Date.now() - 30 * 86400000);
  const to = request.query.to
    ? new Date(`${request.query.to}T23:59:59.999Z`)
    : new Date();
  response.json(
    await AuditLog.find({ createdAt: { $gte: from, $lte: to } })
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean(),
  );
}

export async function downloadBackup(request, response) {
  const companyId = new mongoose.Types.ObjectId(request.user.companyId);
  const collections = await mongoose.connection.db.listCollections().toArray();
  const data = {};
  for (const collection of collections) {
    if (["companies", "system.version"].includes(collection.name)) continue;
    data[collection.name] = await mongoose.connection.db
      .collection(collection.name)
      .find({ companyId })
      .toArray();
  }
  const company = await Company.findById(companyId).lean();
  response.setHeader(
    "Content-Disposition",
    `attachment; filename=ug-saas-backup-${new Date().toISOString().slice(0, 10)}.json`,
  );
  response.json({ formatVersion: 1, exportedAt: new Date(), company, data });
}
