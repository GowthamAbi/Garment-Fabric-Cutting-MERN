import mongoose from "mongoose";

const subscriptionPaymentSchema = new mongoose.Schema({
  referenceNo: { type: String, required: true, unique: true },
  plan: { type: String, enum: ["Trial", "Basic", "Professional", "Enterprise"], required: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: "INR" },
  paymentMethod: { type: String, enum: ["RAZORPAY", "MANUAL"], required: true },
  providerOrderId: String,
  providerPaymentId: String,
  status: { type: String, enum: ["CREATED", "PENDING_APPROVAL", "PAID", "FAILED", "REFUNDED"], default: "CREATED" },
  periodStart: Date,
  periodEnd: Date,
  notes: String,
  approvedBy: String,
}, { timestamps: true });

subscriptionPaymentSchema.index({ companyId: 1, createdAt: -1 });
export default mongoose.model("SubscriptionPayment", subscriptionPaymentSchema);
