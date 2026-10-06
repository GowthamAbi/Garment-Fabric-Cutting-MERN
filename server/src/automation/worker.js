import crypto from "node:crypto";
import mongoose from "mongoose";
import { EmailOutbox, PaymentInbox, SubscriptionAction } from "./models.js";
import { retryDate } from "./queue.js";
import { runWithTenant } from "../utils/tenantContext.js";
import { settleSubscription } from "../services/subscriptionSettlementService.js";
import BillingRequest from "../models/BillingRequest.js";
import TenantRegistry from "../models/TenantRegistry.js";
import Company from "../models/Company.js";
import User from "../models/User.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import SubscriptionInvoice from "../models/SubscriptionInvoice.js";
import { createTenantModel } from "../config/tenantDatabase.js";
const creditSchema = new mongoose.Schema({ actionId: { type: String, unique: true, required: true }, invoiceId: String,
  number: String, amount: Number, taxAmount: Number, reason: String, providerReference: String, issuedAt: Date });
const CreditNote = createTenantModel("SubscriptionCreditNote", creditSchema);
const platform = { companyKey: "platform", databaseName: process.env.CONTROL_DB_NAME || "ugs_control", role: "saas_super_admin" };

async function claim(model, pending, processing) {
  const now = new Date(), leaseToken = crypto.randomUUID();
  return model.findOneAndUpdate({ $or: [{ status: pending, nextAttemptAt: { $lte: now } }, { status: processing, leaseUntil: { $lt: now } }] },
    { $set: { status: processing, leaseUntil: new Date(Date.now() + 120000), leaseToken }, $inc: { attempts: 1 } }, { new: true });
}
async function failed(model, job, pending, dead, error) {
  await model.updateOne({ _id: job._id, leaseToken: job.leaseToken }, { $set: {
    status: job.attempts >= 8 ? dead : pending, nextAttemptAt: retryDate(job.attempts),
    lastError: error.statusCode ? `BusinessRule${error.statusCode}` : /^[A-Za-z][A-Za-z0-9_ ]{0,90}$/.test(error.message || "") ? error.message : "RetryableJobFailure", leaseUntil: null,
  } });
}
export async function processPaymentInbox(limit = 20) {
  for (let i = 0; i < limit; i++) {
    const job = await claim(PaymentInbox, "PENDING", "PROCESSING"); if (!job) break;
    try {
      const billing = await BillingRequest.findById(job.billingId).lean();
      if (!billing) throw new Error("BillingMissing");
      await settleSubscription(billing, { actor: "Verified capture webhook", capturedPayment: job.entity });
      await PaymentInbox.updateOne({ _id: job._id, leaseToken: job.leaseToken }, { $set: { status: "DONE", leaseUntil: null } });
    } catch (error) { await failed(PaymentInbox, job, "PENDING", "DEAD", error); }
  }
}
export async function processEmailOutbox(limit = 20, send = null) {
  if (!send && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)) return;
  for (let i = 0; i < limit; i++) {
    const job = await claim(EmailOutbox, "PENDING", "PROCESSING"); if (!job) break;
    let acknowledged = false;
    try {
      // Resend idempotency expires after 24h: hold old ambiguous jobs for review.
      if (job.firstAttemptAt && Date.now() - job.firstAttemptAt.getTime() > 23 * 3600000) throw new Error("IdempotencyWindowExpired");
      const payload = { ...job.payload, from: job.payload.from || process.env.EMAIL_FROM };
      if (!job.firstAttemptAt) {
        job.firstAttemptAt = new Date();
        await EmailOutbox.updateOne({ _id: job._id, leaseToken: job.leaseToken }, { $set: { firstAttemptAt: job.firstAttemptAt, payload } });
      }
      const result = send ? await send(payload, job.dedupeKey) : await fetch("https://api.resend.com/emails", {
        method: "POST", signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json", "Idempotency-Key": job.dedupeKey }, body: JSON.stringify(payload),
      });
      if (!result.ok) throw new Error(`EmailProvider${result.status}`);
      const body = await result.json(); if (!body.id) throw new Error("MissingEmailReceipt");
      await EmailOutbox.updateOne({ _id: job._id, leaseToken: job.leaseToken }, { $set: { status: "SENT", sentAt: new Date(), providerId: body.id, leaseUntil: null } });
      acknowledged = true;
      if (job.invoiceId) await runWithTenant({ companyKey: job.companyKey, databaseName: job.databaseName }, () =>
        SubscriptionInvoice.updateOne({ _id: job.invoiceId }, { $set: { emailedAt: new Date() } }));
    } catch (error) {
      if (acknowledged) { await EmailOutbox.updateOne({ _id: job._id }, { $set: { lastError: "Invoice delivery timestamp needs reconciliation" } }); continue; }
      if (error.message === "IdempotencyWindowExpired") job.attempts = 8;
      await failed(EmailOutbox, job, "PENDING", "DEAD", error);
    }
  }
}
export async function scheduleRenewals() {
  // Excludes archived/provisioning workspaces; does not charge saved cards.
  const tenants = await TenantRegistry.find({ status: { $in: ["ACTIVE", "SUSPENDED"] } }).lean();
  for (const tenant of tenants) await runWithTenant({ companyKey: tenant.companyKey, databaseName: tenant.databaseName }, async () => {
    const company = await Company.findOne(); if (!company?.subscriptionEndsAt) return;
    const days = Math.ceil((company.subscriptionEndsAt.getTime() - Date.now()) / 86400000);
    const admin = await User.findOne({ role: "company_admin", active: true }).lean();
    if (!tenant.renewalCancelledAt && admin?.email && [7, 3, 1, 0, -1].includes(days)) {
      const dedupeKey = `renewal-${tenant.companyKey}-${company.subscriptionEndsAt.getTime()}-${days}`;
      await EmailOutbox.updateOne({ dedupeKey }, { $setOnInsert: { dedupeKey, companyKey: tenant.companyKey,
        databaseName: tenant.databaseName, companyId: company._id, factoryId: admin.factoryId,
        payload: { to: [admin.email], subject: days > 0 ? `UG SaaS renewal in ${days} day(s)` : "UG SaaS subscription expired",
          html: `<p>Your subscription ${days > 0 ? "expires" : "expired"} on ${company.subscriptionEndsAt.toISOString().slice(0, 10)}.</p><p>Login to your company workspace to review renewal options. Your company data is retained.</p>` },
        status: "PENDING", nextAttemptAt: new Date() } }, { upsert: true });
    }
    if (days <= 0 && company.subscriptionEndsAt < new Date() && company.subscriptionStatus === "Active") {
      await Company.updateOne({ _id: company._id, subscriptionEndsAt: company.subscriptionEndsAt }, { $set: { subscriptionStatus: "Expired" } });
      await TenantRegistry.updateOne({ _id: tenant._id, subscriptionEndsAt: tenant.subscriptionEndsAt }, { $set: { status: "SUSPENDED" } });
    }
  });
}
async function settleRefund(job, billing, providerId) {
  await runWithTenant({ companyKey: job.companyKey, databaseName: job.databaseName }, async () => {
    await CreditNote.init(); const session = await mongoose.startSession();
    try { await session.withTransaction(async () => {
      const payment = await SubscriptionPayment.findById(billing.tenantPaymentId).session(session);
      const invoice = await SubscriptionInvoice.findOne({ paymentId: payment?._id }).session(session);
      if (!payment || !invoice || !["PAID", "REFUNDED"].includes(payment.status)) throw new Error("RefundSettlementMismatch");
      payment.status = "REFUNDED"; await payment.save({ session });
      invoice.status = "REFUNDED"; invoice.cancellationReason = job.reason; await invoice.save({ session });
      await CreditNote.updateOne({ actionId: String(job._id) }, { $setOnInsert: { actionId: String(job._id),
        companyId: payment.companyId, factoryId: payment.factoryId, invoiceId: String(invoice._id), number: `CN-${job._id}`,
        amount: payment.amount, taxAmount: payment.taxAmount, reason: job.reason, providerReference: providerId, issuedAt: new Date() } }, { upsert: true, session });
      await BillingRequest.updateOne({ _id: billing._id }, { $set: { status: "REFUNDED" } }, { session });
      // Refund of the latest term suspends service; older-term refunds do not erase newer renewals.
      const company = await Company.findById(payment.companyId).session(session);
      if (company && company.subscriptionEndsAt?.getTime() === payment.periodEnd?.getTime()) {
        company.subscriptionStatus = "Suspended"; await company.save({ session });
        await TenantRegistry.updateOne({ companyKey: job.companyKey }, { $set: { status: "SUSPENDED" } }, { session });
      }
      await SubscriptionAction.updateOne({ _id: job._id, leaseToken: job.leaseToken }, { $set: { status: "COMPLETED", providerId, processedAt: new Date(), leaseUntil: null } }, { session });
    }); } finally { await session.endSession(); }
  });
}
export async function processSubscriptionActions(limit = 10) {
  for (let i = 0; i < limit; i++) {
    const job = await claim(SubscriptionAction, "APPROVED", "PROCESSING"); if (!job) break;
    try {
      if (job.kind === "CANCEL") {
        if (job.termEndsAt) {
          const registry = await TenantRegistry.findOne({ companyKey: job.companyKey }).lean();
          if (!registry || registry.subscriptionEndsAt?.getTime() !== job.termEndsAt.getTime()) throw new Error("CancellationTermChanged");
        }
        // Fixed-term plans do not auto-charge. Cancellation means no further reminder emails.
        await TenantRegistry.updateOne({ companyKey: job.companyKey }, { $set: { renewalCancelledAt: new Date() } });
        await SubscriptionAction.updateOne({ _id: job._id, leaseToken: job.leaseToken }, { $set: { status: "COMPLETED", processedAt: new Date(), leaseUntil: null } });
        continue;
      }
      const billing = await BillingRequest.findById(job.billingId).lean();
      if (!billing || !["PAID", "REFUNDED"].includes(billing.status) || billing.amount !== job.amount || billing.companyKey !== job.companyKey) throw new Error("RefundBillingMismatch");
      if (billing.paymentMethod === "MANUAL") {
        if (!job.manualReference) throw new Error("ManualPayoutProofRequired");
        await settleRefund(job, billing, job.manualReference); continue;
      }
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) throw new Error("RefundProviderNotConfigured");
      const payment = await runWithTenant({ companyKey: job.companyKey, databaseName: job.databaseName }, () => SubscriptionPayment.findById(billing.tenantPaymentId).lean());
      if (!/^pay_[A-Za-z0-9]+$/.test(payment?.providerPaymentId || "")) throw new Error("PaymentReceiptMissing");
      const result = await fetch(job.providerId ? `https://api.razorpay.com/v1/refunds/${job.providerId}` : `https://api.razorpay.com/v1/payments/${payment.providerPaymentId}/refund`, {
        method: job.providerId ? "GET" : "POST", signal: AbortSignal.timeout(30000), headers: { "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
          "X-Refund-Idempotency": `ugs-refund-${job._id}` }, ...(job.providerId ? {} : { body: JSON.stringify({ amount: Math.round(job.amount * 100), speed: "normal" }) }),
      });
      const refund = await result.json();
      if (!result.ok || !/^rfnd_[A-Za-z0-9]+$/.test(refund.id || "") || refund.currency !== "INR" || refund.payment_id !== payment.providerPaymentId || refund.amount !== Math.round(job.amount * 100)) throw new Error("RefundProviderMismatch");
      await SubscriptionAction.updateOne({ _id: job._id, leaseToken: job.leaseToken }, { $set: { providerId: refund.id } });
      if (refund.status !== "processed") throw new Error("RefundStillPending");
      await settleRefund(job, billing, refund.id);
    } catch (error) { await failed(SubscriptionAction, job, "APPROVED", "FAILED", error); }
  }
}
export async function runJobsOnce() {
  if (process.env.AUTOMATION_ENABLED !== "true") return { enabled: false };
  return runWithTenant(platform, async () => {
    await Promise.all([EmailOutbox.init(), PaymentInbox.init(), SubscriptionAction.init()]);
    await processPaymentInbox(); await scheduleRenewals(); await processEmailOutbox(); await processSubscriptionActions();
    return { enabled: true };
  });
}
