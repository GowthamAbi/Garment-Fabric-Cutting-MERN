import { Router } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getTenant } from "../utils/tenantContext.js";
import ApiError from "../utils/ApiError.js";
import BillingRequest from "../models/BillingRequest.js";
import { EmailOutbox, PaymentInbox, SubscriptionAction } from "./models.js";
import TenantRegistry from "../models/TenantRegistry.js";
const router = Router();
const customer = (req, _res, next) => ["company_admin", "admin"].includes(req.user.role) ? next() : next(new ApiError(403, "Customer administrator required"));
const owner = (req, _res, next) => req.user.role === "saas_super_admin" ? next() : next(new ApiError(403, "Platform billing owner required"));
router.get("/status", asyncHandler(async (req, res) => {
  if (!["company_admin", "admin", "saas_super_admin"].includes(req.user.role)) throw new ApiError(403, "Administrator required");
  const filter = req.user.role === "saas_super_admin" ? {} : { companyKey: getTenant().companyKey };
  res.json({ enabled: process.env.AUTOMATION_ENABLED === "true",
    billing: await BillingRequest.find(filter).select("referenceNo plan amount status paymentMethod").sort({ createdAt: -1 }).limit(100).lean(),
    email: await EmailOutbox.find(filter).select("companyKey status attempts nextAttemptAt lastError sentAt invoiceId").sort({ createdAt: -1 }).limit(100).lean(),
    actions: await SubscriptionAction.find(filter).sort({ createdAt: -1 }).limit(100).lean(),
    ...(req.user.role === "saas_super_admin" ? { payments: await PaymentInbox.find().select("key status attempts nextAttemptAt lastError").sort({ createdAt: -1 }).limit(100).lean() } : {}),
  });
}));
router.post("/requests", customer, asyncHandler(async (req, res) => {
  const tenant = getTenant(), kind = req.body.kind;
  if (!["CANCEL", "REFUND"].includes(kind) || !String(req.body.reason || "").trim()) throw new ApiError(400, "Action and reason required");
  let billing = null, key, termEndsAt;
  if (kind === "REFUND") {
    if (!mongoose.isValidObjectId(req.body.billingId)) throw new ApiError(400, "Select a billing request ID");
    billing = await BillingRequest.findOne({ _id: req.body.billingId, companyKey: tenant.companyKey, status: "PAID" }).lean();
    if (!billing || billing.amount <= 0) throw new ApiError(409, "Paid subscription billing request required");
    key = `refund-${billing._id}`;
  } else {
    const registry = await TenantRegistry.findOne({ companyKey: tenant.companyKey }).lean();
    if (!registry) throw new ApiError(404, "Company registry missing");
    key = `cancel-${tenant.companyKey}-${registry.subscriptionEndsAt?.getTime() || 0}`;
    termEndsAt = registry.subscriptionEndsAt;
  }
  const row = await SubscriptionAction.findOneAndUpdate({ key }, { $setOnInsert: { key, kind,
    companyKey: tenant.companyKey, databaseName: tenant.databaseName, companyId: req.user.companyId, factoryId: req.user.factoryId,
    billingId: billing ? String(billing._id) : undefined, amount: billing?.amount || 0, termEndsAt,
    reason: String(req.body.reason).slice(0, 2000), requestedBy: req.user.userId, status: "REQUESTED" } }, { upsert: true, new: true });
  res.status(201).json(row);
}));
router.post("/requests/:id/decide", owner, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || !["APPROVE", "REJECT"].includes(req.body.decision)) throw new ApiError(400, "Valid request/decision required");
  const row = await SubscriptionAction.findById(req.params.id);
  if (!row || row.status !== "REQUESTED") throw new ApiError(409, "Request already decided");
  if (row.kind === "REFUND" && req.body.decision === "APPROVE") {
    if (req.body.confirm !== "APPROVE FULL REFUND") throw new ApiError(400, "Confirm APPROVE FULL REFUND; worker may send money when enabled");
    const billing = await BillingRequest.findById(row.billingId).lean();
    if (!billing || billing.status !== "PAID") throw new ApiError(409, "Paid billing request required");
    if (billing.paymentMethod === "MANUAL" && !String(req.body.manualReference || "").trim()) throw new ApiError(400, "Record already-paid manual refund transaction reference");
    row.manualReference = String(req.body.manualReference || "").slice(0, 100);
  }
  const updated = await SubscriptionAction.findOneAndUpdate({ _id: row._id, status: "REQUESTED" }, { $set: {
    status: req.body.decision === "APPROVE" ? "APPROVED" : "REJECTED", approvedBy: req.user.userId,
    manualReference: row.manualReference, nextAttemptAt: new Date() } }, { new: true });
  if (!updated) throw new ApiError(409, "Request already decided"); res.json(updated);
}));
router.post("/retry/:kind/:id", owner, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || req.body.confirm !== "RETRY REVIEWED JOB") throw new ApiError(400, "Confirm RETRY REVIEWED JOB after reviewing provider receipts");
  const map = { payment: [PaymentInbox, "DEAD", "PENDING"], email: [EmailOutbox, "DEAD", "PENDING"], action: [SubscriptionAction, "FAILED", "APPROVED"] };
  const choice = map[req.params.kind]; if (!choice) throw new ApiError(400, "Unknown queue kind");
  const [model, current, next] = choice, row = await model.findOne({ _id: req.params.id, status: current });
  if (!row) throw new ApiError(409, "Job is not in a failed state");
  if (req.params.kind === "email" && row.firstAttemptAt && Date.now() - row.firstAttemptAt.getTime() > 23 * 3600000) throw new ApiError(409, "Email idempotency window expired; verify delivery with provider rather than sending again");
  await model.updateOne({ _id: row._id, status: current }, { $set: { status: next, attempts: 0, leaseUntil: null, nextAttemptAt: new Date() } });
  res.json({ queued: true });
}));
export default router;
