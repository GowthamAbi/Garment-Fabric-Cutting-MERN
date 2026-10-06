import mongoose from "mongoose";
import { createTenantModel } from "../config/tenantDatabase.js";

const factorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    address: { type: String, default: "" },
    billingAddress: { type: String, default: "" },
    gstin: { type: String, default: "", uppercase: true, trim: true },
    stateCode: { type: String, default: "", trim: true },
    placeOfSupply: { type: String, default: "", trim: true },
    billingEmail: { type: String, default: "", lowercase: true, trim: true },
  },
  { timestamps: true },
);

const companySchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    logo: { type: String, default: "" },
    address: { type: String, default: "" },
    subscriptionPlan: {
      type: String,
      default: "Trial",
    },
    subscriptionStatus: {
      type: String,
      enum: ["Active", "Suspended", "Expired"],
      default: "Active",
    },
    subscriptionStartsAt: Date,
    subscriptionEndsAt: Date,
    preferredLanguage: { type: String, enum: ["en", "ta"], default: "en" },
    onboardingCompleted: { type: Boolean, default: false },
    privacyAcceptedAt: Date,
    factories: [factorySchema],
    active: { type: Boolean, default: true },
    retentionLock: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default createTenantModel("Company", companySchema);
