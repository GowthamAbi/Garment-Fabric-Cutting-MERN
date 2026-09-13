import mongoose from "mongoose";
import { tenantFields } from "./plugins/tenantFields.js";

const timelineEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: ["RUNNING", "BREAKDOWN", "COLOUR_CHANGE", "OTHER_ISSUE", "MAINTENANCE", "TEMPORARY_STOP"],
      required: true,
    },
    startedAt: { type: Date, required: true },
    endedAt: Date,
    reason: { type: String, default: "" },
    remarks: { type: String, default: "" },
  },
  { _id: true },
);

const cuttingMachineRunSchema = new mongoose.Schema(
  {
    runNo: { type: String, required: true, uppercase: true, trim: true },
    planNo: { type: String, required: true, uppercase: true, trim: true },
    outwardNo: { type: Number, required: true, min: 1000 },
    machineCode: { type: String, required: true, uppercase: true, trim: true },
    machineType: { type: String, enum: ["SPREADER", "CUTTER"], required: true },
    itemCode: { type: String, required: true, uppercase: true, trim: true },
    style: { type: String, required: true, uppercase: true, trim: true },
    colour: { type: String, required: true, uppercase: true, trim: true },
    plannedPieces: { type: Number, required: true, min: 1 },
    actualPieces: { type: Number, default: 0, min: 0 },
    startedAt: { type: Date, required: true },
    completedAt: Date,
    status: {
      type: String,
      enum: ["RUNNING", "BREAKDOWN", "COLOUR_CHANGE", "OTHER_ISSUE", "MAINTENANCE", "STOPPED", "COMPLETED"],
      default: "RUNNING",
    },
    timeline: { type: [timelineEventSchema], default: [] },
    operatorCode: { type: String, default: "", uppercase: true },
  },
  { timestamps: true },
);

tenantFields(cuttingMachineRunSchema);
cuttingMachineRunSchema.index(
  { companyId: 1, factoryId: 1, runNo: 1 },
  { unique: true },
);
cuttingMachineRunSchema.index({ companyId: 1, factoryId: 1, machineCode: 1, startedAt: -1 });
cuttingMachineRunSchema.index(
  { companyId: 1, factoryId: 1, machineCode: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["RUNNING", "BREAKDOWN", "COLOUR_CHANGE", "OTHER_ISSUE", "MAINTENANCE", "STOPPED"] },
    },
  },
);

export default mongoose.model("CuttingMachineRun", cuttingMachineRunSchema);
