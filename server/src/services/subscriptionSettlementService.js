import mongoose from "mongoose";
import BillingRequest from "../models/BillingRequest.js";
import SubscriptionPayment from "../models/SubscriptionPayment.js";
import SubscriptionInvoice from "../models/SubscriptionInvoice.js";
import Company from "../models/Company.js";
import SaasPlan from "../models/SaasPlan.js";
import TenantRegistry from "../models/TenantRegistry.js";
import InvoiceSequence from "../models/InvoiceSequence.js";
import ApiError from "../utils/ApiError.js";
import { runWithTenant } from "../utils/tenantContext.js";
import { capturedPaymentMatches } from "../utils/paymentPolicy.js";
import { subscriptionPeriod } from "../utils/subscriptionPeriod.js";
import { createInvoiceForPayment } from "./invoiceService.js";
import { EmailOutbox } from "../automation/models.js";

// All activation entry points serialize through the same central billing row.
export async function settleSubscription(billing, { actor, capturedPayment = null, manual = false }) {
  const session = await mongoose.startSession();
  let result;
  try {
    await runWithTenant({ companyKey: billing.companyKey, databaseName: billing.databaseName }, async () => {
      await Promise.all([SubscriptionPayment.init(), SubscriptionInvoice.init(), Company.init(), InvoiceSequence.init(), EmailOutbox.init()]);
      await session.withTransaction(async () => {
        const fresh = await BillingRequest.findById(billing._id).session(session);
        if (!fresh) throw new ApiError(404, "Billing request missing");
        if (manual ? fresh.paymentMethod !== "MANUAL" : !capturedPaymentMatches(capturedPayment, fresh))
          throw new ApiError(409, "Settlement evidence does not match the billing request");
        const payment = await SubscriptionPayment.findById(fresh.tenantPaymentId).session(session);
        if (!payment) throw new ApiError(409, "Tenant payment record missing");
        if (fresh.status === "PAID") {
          if (capturedPayment && payment.providerPaymentId !== capturedPayment.id)
            throw new ApiError(409, "Order was settled using another payment");
          const invoice = await SubscriptionInvoice.findOne({ paymentId: payment._id }).session(session);
          if (!invoice || payment.status !== "PAID") throw new ApiError(409, "Legacy settlement needs reconciliation");
          result = { payment, invoice, alreadySettled: true };
          return;
        }
        if (!["CREATED", "PENDING_APPROVAL"].includes(fresh.status) || payment.status === "PAID")
          throw new ApiError(409, "Settlement state needs reconciliation");
        if (payment.amount !== fresh.amount || payment.plan !== fresh.plan || payment.paymentMethod !== fresh.paymentMethod)
          throw new ApiError(409, "Tenant payment does not match billing");
        const plan = await SaasPlan.findOne({ name: fresh.plan }).session(session).lean();
        const company = await Company.findById(payment.companyId).session(session);
        if (!plan || !company) throw new ApiError(409, "Company or plan missing");
        Object.assign(payment, subscriptionPeriod(company.subscriptionEndsAt, fresh.validityDays || plan.validityDays), {
          status: "PAID", approvedBy: actor,
          ...(capturedPayment && { providerPaymentId: capturedPayment.id }),
        });
        await payment.save({ session });
        Object.assign(company, { subscriptionPlan: payment.plan, subscriptionStatus: "Active",
          subscriptionStartsAt: payment.periodStart, subscriptionEndsAt: payment.periodEnd, active: true,
          entitlements: fresh.entitlements?.maxUsers ? fresh.entitlements : {maxUsers:plan.maxUsers,maxDepartments:plan.maxDepartments,modules:plan.modules} });
        await company.save({ session });
        const registry = await TenantRegistry.updateOne({ companyKey: fresh.companyKey }, { $set: {
          status: "ACTIVE", subscriptionPlan: payment.plan, subscriptionEndsAt: payment.periodEnd,
          renewalCancelledAt: null,
        } }, { session });
        if (registry.matchedCount !== 1) throw new ApiError(409, "Tenant registry missing");
        const invoice = await createInvoiceForPayment(payment, actor, session);
        Object.assign(fresh, { status: "PAID", approvedBy: actor, approvedAt: new Date() });
        await fresh.save({ session });
        result = { payment, invoice, alreadySettled: false };
      });
    });
    return result;
  } finally { await session.endSession(); }
}
