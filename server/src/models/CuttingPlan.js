import mongoose from "mongoose";
import { tenantFields } from "./plugins/tenantFields.js";

const cuttingPlanSchema = new mongoose.Schema(
  {
    planNo: { type: String, required: true, uppercase: true, trim: true },
    outwardNo: { type: Number, required: true, min: 1000 },
    queuePosition: { type: Number, required: true, min: 1 },
    priority: { type: Number, default: 1, min: 1 },
    requiredDate: { type: Date, required: true },
    itemCode: { type: String, required: true, uppercase: true, trim: true },
    itemName: { type: String, required: true, trim: true },
    style: { type: String, required: true, uppercase: true, trim: true },
    colour: { type: String, required: true, uppercase: true, trim: true },
    plannedPieces: { type: Number, required: true, min: 1 },
    spreaderMachineCode: { type: String, default: "", uppercase: true },
    cutterMachineCode: { type: String, default: "", uppercase: true },
    spreaderStatus: {
      type: String,
      enum: ["WAITING", "READY", "RUNNING", "STOPPED", "COMPLETED"],
      default: "READY",
    },
    cutterStatus: {
      type: String,
      enum: ["WAITING", "READY", "RUNNING", "STOPPED", "COMPLETED"],
      default: "WAITING",
    },
    overallStatus: {
      type: String,
      enum: ["QUEUED", "SPREADING", "CUTTING", "PARTIAL", "COMPLETED", "HOLD"],
      default: "QUEUED",
    },
  },
  { timestamps: true },
);

tenantFields(cuttingPlanSchema);
cuttingPlanSchema.index(
  { companyId: 1, factoryId: 1, planNo: 1 },
  { unique: true },
);
cuttingPlanSchema.index({ companyId: 1, factoryId: 1, overallStatus: 1, priority: 1, requiredDate: 1, queuePosition: 1 });

export default mongoose.model("CuttingPlan", cuttingPlanSchema);
