import SubscriptionInvoice from "../models/SubscriptionInvoice.js";
import Company from "../models/Company.js";
import User from "../models/User.js";
import InvoiceSequence from "../models/InvoiceSequence.js";

function financialYear(date = new Date()) {
  const year = date.getFullYear();
  const start = date.getMonth() >= 3 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

async function nextInvoiceNumber() {
  const fy = financialYear();
  const sequence = await InvoiceSequence.findOneAndUpdate(
    { financialYear: fy },
    { $inc: { value: 1 } },
    { new: true, upsert: true },
  );
  return `UGS/${fy}/${String(sequence.value).padStart(4, "0")}`;
}

export async function createInvoiceForPayment(payment, issuedBy = "System") {
  const existing = await SubscriptionInvoice.findOne({ paymentId: payment._id });
  if (existing) return existing;
  const company = await Company.findById(payment.companyId).lean();
  const admin = await User.findOne({ companyId: payment.companyId, role: "company_admin" }).lean();
  const taxTotal = Number(payment.taxAmount || 0);
  const subtotal = Number((Number(payment.amount || 0) - taxTotal).toFixed(2));
  const sameState = Boolean(process.env.UG_SAAS_STATE_CODE && company?.stateCode === process.env.UG_SAAS_STATE_CODE);
  return SubscriptionInvoice.create({
    invoiceNumber: await nextInvoiceNumber(),
    financialYear: financialYear(),
    paymentId: payment._id,
    supplier: {
      legalName: process.env.UG_SAAS_LEGAL_NAME || "UG SaaS",
      address: process.env.UG_SAAS_BILLING_ADDRESS || "",
      gstin: process.env.UG_SAAS_GSTIN || "",
      stateCode: process.env.UG_SAAS_STATE_CODE || "",
      email: process.env.EMAIL_FROM || "",
      phone: process.env.UG_SAAS_PHONE || "",
    },
    customer: {
      companyName: company?.companyName || "Customer",
      address: company?.billingAddress || company?.address || "",
      gstin: company?.gstin || "",
      stateCode: company?.stateCode || "",
      placeOfSupply: company?.placeOfSupply || "",
      email: admin?.email || "",
    },
    lineItems: [{
      description: `${payment.plan} SaaS Subscription`,
      sac: process.env.UG_SAAS_SAC || "",
      periodStart: payment.periodStart,
      periodEnd: payment.periodEnd,
      quantity: 1,
      rate: subtotal,
      discount: 0,
      taxableValue: subtotal,
    }],
    taxType: taxTotal === 0 ? "NO_TAX" : sameState ? "CGST_SGST" : "IGST",
    cgstRate: taxTotal && sameState ? 9 : 0,
    cgstAmount: taxTotal && sameState ? taxTotal / 2 : 0,
    sgstRate: taxTotal && sameState ? 9 : 0,
    sgstAmount: taxTotal && sameState ? taxTotal / 2 : 0,
    igstRate: taxTotal && !sameState ? 18 : 0,
    igstAmount: taxTotal && !sameState ? taxTotal : 0,
    subtotal,
    taxTotal,
    grandTotal: Number(payment.amount || 0),
    paymentReference: payment.providerPaymentId || payment.referenceNo,
    issuedBy,
  });
}
