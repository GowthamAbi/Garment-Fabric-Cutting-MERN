import mongoose from "mongoose";
import { controlDatabase } from "../config/tenantDatabase.js";

const schema = new mongoose.Schema({
  companyKey: { type: String, required: true, index: true },
  databaseName: { type: String, required: true },
  tenantPaymentId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  referenceNo: { type: String, required: true },
  plan: { type: String, required: true },
  amount: { type: Number, required: true },
<<<<<<< HEAD
  validityDays: { type: Number, min: 1 },
  entitlements: { maxUsers:Number,maxDepartments:Number,modules:[String] },
=======
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810
  paymentMethod: { type: String, enum: ["MANUAL", "RAZORPAY"], required: true },
  providerOrderId: { type: String, index: true },
  status: { type: String, enum: ["CREATED", "PENDING_APPROVAL", "PAID", "FAILED", "REFUNDED"], default: "CREATED" },
  notes: String,
  approvedBy: String,
  approvedAt: Date,
}, { timestamps: true });

const connection = controlDatabase();
export default connection.models.BillingRequest || connection.model("BillingRequest", schema);
