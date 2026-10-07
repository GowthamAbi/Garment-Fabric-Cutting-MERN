import mongoose from "mongoose";
import { controlDatabase } from "../config/tenantDatabase.js";

const tenantRegistrySchema = new mongoose.Schema({
  companyKey: { type: String, required: true, unique: true, lowercase: true, trim: true },
  companyName: { type: String, required: true, trim: true },
  databaseName: { type: String, required: true, unique: true, immutable: true },
  loginPath: { type: String, required: true, unique: true },
  status: { type: String, enum: ["PROVISIONING", "ACTIVE", "SUSPENDED", "ARCHIVED"], default: "PROVISIONING" },
  subscriptionPlan: { type: String, enum: ["Trial", "Basic", "Professional", "Enterprise"], default: "Trial" },
  subscriptionEndsAt: Date,
  dataOwner: { type: String, default: "CUSTOMER" },
  ownerDataAccess: { type: Boolean, default: false },
  retentionLock: { type: Boolean, default: true },
  createdBy: { type: String, default: "Platform" },
}, { timestamps: true });

tenantRegistrySchema.index({ status: 1, subscriptionEndsAt: 1 });

const connection = controlDatabase();
export default connection.models.TenantRegistry || connection.model("TenantRegistry", tenantRegistrySchema);

