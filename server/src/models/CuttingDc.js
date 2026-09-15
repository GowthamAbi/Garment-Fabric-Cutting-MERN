import mongoose from "mongoose";

const sizeSchema = new mongoose.Schema({
  size: { type: String, required: true, uppercase: true },
  pcs: { type: Number, required: true, min: 1 },
  measurement: { type: Number, required: true, min: 0.0001 },
  wantedMtr: { type: Number, required: true, min: 0 },
}, { _id: true });

const colourSchema = new mongoose.Schema({
  colour: { type: String, required: true, uppercase: true },
  sizes: { type: [sizeSchema], default: [] },
  totalPcs: { type: Number, default: 0 },
  wantedMtr: { type: Number, default: 0 },
  availableMtr: { type: Number, default: 0 },
  materialDecision: { type: String, enum: ["OUTWARD", "BALANCE", "NO_STOCK"], default: "OUTWARD" },
  shortageReason: { type: String, default: "" },
  status: { type: String, enum: ["READY", "MATERIAL_PENDING", "IN_PRODUCTION", "PARTIAL", "COMPLETED"], default: "READY" },
}, { _id: true });

const cuttingDcSchema = new mongoose.Schema({
  dcNo: { type: String, required: true, uppercase: true, trim: true },
  itemName: { type: String, required: true, trim: true },
  itemCode: { type: String, default: "", uppercase: true },
  style: { type: String, required: true, uppercase: true, trim: true },
  target: { type: String, default: "" },
  colours: { type: [colourSchema], default: [] },
  totalPcs: { type: Number, default: 0 },
  totalMtr: { type: Number, default: 0 },
  status: { type: String, enum: ["PLANNED", "MATERIAL_PENDING", "IN_PRODUCTION", "PARTIAL", "COMPLETED"], default: "PLANNED" },
  createdBy: { type: String, default: "Production User" },
}, { timestamps: true });

cuttingDcSchema.index({ companyId: 1, factoryId: 1, dcNo: 1 }, { unique: true });
export default mongoose.model("CuttingDc", cuttingDcSchema);
