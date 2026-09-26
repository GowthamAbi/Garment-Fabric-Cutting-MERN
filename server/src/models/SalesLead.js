import mongoose from "mongoose";

const activitySchema = new mongoose.Schema({
  type: { type: String, enum: ["CALL", "WHATSAPP", "EMAIL", "VISIT", "DEMO", "NOTE"], default: "NOTE" },
  at: { type: Date, default: Date.now },
  note: { type: String, default: "" },
}, { _id: false });

const schema = new mongoose.Schema({
  companyName: { type: String, required: true, trim: true },
  contactName: { type: String, default: "" },
  city: { type: String, default: "" },
  phone: { type: String, default: "" },
  email: { type: String, default: "", lowercase: true, trim: true },
  source: { type: String, default: "DIRECT" },
  planCode: { type: String, default: "" },
  departments: [{ type: String }],
  userCount: { type: Number, default: 1 },
  requirements: { type: String, default: "" },
  customisation: { type: String, default: "" },
  remarks: { type: String, default: "" },
  status: { type: String, enum: ["NEW", "CONTACTED", "DEMO_SCHEDULED", "DEMO_COMPLETED", "TRIAL_ACTIVE", "NEGOTIATION", "WON", "LOST"], default: "NEW" },
  expectedValue: { type: Number, default: 0 },
  nextFollowUpAt: Date,
  visitPlannedAt: Date,
  visitedAt: Date,
  demoExpiresAt: Date,
  convertedCompanyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
  activities: { type: [activitySchema], default: [] },
}, { timestamps: true });

schema.index({ status: 1, nextFollowUpAt: 1 });
export default mongoose.model("SalesLead", schema);
