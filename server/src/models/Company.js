import mongoose from "mongoose";

const factorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  address: { type: String, default: "" },
}, { timestamps: true });

const companySchema = new mongoose.Schema({
  companyName: { type: String, required: true, trim: true },
  logo: { type: String, default: "" },
  address: { type: String, default: "" },
  subscriptionPlan: { type: String, enum: ["Trial", "Basic", "Professional", "Enterprise"], default: "Trial" },
  subscriptionStatus: { type: String, enum: ["Active", "Suspended", "Expired"], default: "Active" },
  subscriptionStartsAt: Date,
  subscriptionEndsAt: Date,
  preferredLanguage: { type: String, enum: ["en", "ta"], default: "en" },
  onboardingCompleted: { type: Boolean, default: false },
  privacyAcceptedAt: Date,
  factories: [factorySchema],
  active: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model("Company", companySchema);
