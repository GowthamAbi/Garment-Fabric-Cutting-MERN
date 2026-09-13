import mongoose from "mongoose";
import { tenantFields } from "./plugins/tenantFields.js";

const cuttingMachineSchema = new mongoose.Schema(
  {
    machineCode: { type: String, required: true, uppercase: true, trim: true },
    machineName: { type: String, required: true, trim: true },
    machineType: { type: String, enum: ["SPREADER", "CUTTER"], required: true },
    qrToken: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["AVAILABLE", "RUNNING", "BREAKDOWN", "COLOUR_CHANGE", "OTHER_ISSUE", "MAINTENANCE", "STOPPED"],
      default: "AVAILABLE",
    },
    currentOutwardNo: { type: Number, default: null },
    currentRunNo: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

tenantFields(cuttingMachineSchema);
cuttingMachineSchema.index(
  { companyId: 1, factoryId: 1, machineCode: 1 },
  { unique: true },
);
cuttingMachineSchema.index(
  { companyId: 1, factoryId: 1, qrToken: 1 },
  { unique: true },
);

export default mongoose.model("CuttingMachine", cuttingMachineSchema);
