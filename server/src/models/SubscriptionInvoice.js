import mongoose from "mongoose";
import { createTenantModel } from "../config/tenantDatabase.js";

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true, immutable: true },
  financialYear: { type: String, required: true, immutable: true },
  invoiceDate: { type: Date, required: true, default: Date.now, immutable: true },
  paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionPayment", required: true, unique: true, immutable: true },
  status: { type: String, enum: ["ISSUED", "PAID", "CANCELLED", "REFUNDED"], default: "PAID" },
  supplier: {
    legalName: String, address: String, gstin: String, stateCode: String,
    email: String, phone: String,
  },
  customer: {
    companyName: { type: String, required: true }, address: String,
    gstin: String, stateCode: String, placeOfSupply: String, email: String,
  },
  lineItems: [{
    description: String, sac: String, periodStart: Date, periodEnd: Date,
    quantity: Number, rate: Number, discount: Number, taxableValue: Number,
  }],
  taxType: { type: String, enum: ["CGST_SGST", "IGST", "NO_TAX"], default: "NO_TAX" },
  cgstRate: { type: Number, default: 0 },
  cgstAmount: { type: Number, default: 0 },
  sgstRate: { type: Number, default: 0 },
  sgstAmount: { type: Number, default: 0 },
  igstRate: { type: Number, default: 0 },
  igstAmount: { type: Number, default: 0 },
  subtotal: { type: Number, required: true },
  taxTotal: { type: Number, default: 0 },
  grandTotal: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  paymentReference: String,
  issuedBy: String,
  emailedAt: Date,
  cancellationReason: String,
}, { timestamps: true });

invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.pre(["deleteOne", "deleteMany", "findOneAndDelete"], function blockDeletion(next) {
  const error = new Error("Issued invoices cannot be deleted; issue a cancellation or credit note");
  error.statusCode = 409;
  next(error);
});

export default createTenantModel("SubscriptionInvoice", invoiceSchema);

