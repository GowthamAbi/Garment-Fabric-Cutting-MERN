import mongoose from "mongoose";
import { tenantFields } from "./plugins/tenantFields.js";

const sizePlanSchema = new mongoose.Schema(
  {
    size: { type: String, required: true, uppercase: true, trim: true },
    plannedPieces: { type: Number, required: true, min: 1 },
    cuttingWeightPerPieceKg: { type: Number, required: true, min: 0 },
    foldingWeightPerPieceKg: { type: Number, required: true, min: 0 },
    wantedCuttingWeightKg: { type: Number, required: true, min: 0 },
    wantedFoldingWeightKg: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const colourPlanSchema = new mongoose.Schema(
  {
    colour: { type: String, required: true, uppercase: true, trim: true },
    priority: { type: Number, default: 1, min: 1 },
    sizes: { type: [sizePlanSchema], default: [] },
    totalPlannedPieces: { type: Number, required: true, min: 1 },
    wantedCuttingWeightKg: { type: Number, required: true, min: 0 },
    issuedCuttingWeightKg: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["WAITING_STOCK", "PART_ISSUED", "READY", "IN_CUTTING", "COMPLETED"],
      default: "WAITING_STOCK",
    },
  },
  { _id: true },
);

const fabricOutwardSchema = new mongoose.Schema(
  {
    outwardNo: { type: Number, required: true, min: 1000 },
    qrToken: { type: String, required: true, trim: true },
    poNo: { type: String, required: true, uppercase: true, trim: true },
    itemCode: { type: String, required: true, uppercase: true, trim: true },
    itemName: { type: String, required: true, trim: true },
    style: { type: String, required: true, uppercase: true, trim: true },
    bomNo: { type: String, required: true, uppercase: true, trim: true },
    fabricCode: { type: String, required: true, uppercase: true, trim: true },
    fabricGroup: { type: String, required: true, uppercase: true, trim: true },
    fabricType: { type: String, required: true, uppercase: true, trim: true },
    requiredDate: { type: Date, required: true, index: true },
    queuePriority: { type: Number, default: 1, min: 1, index: true },
    colours: { type: [colourPlanSchema], default: [] },
    totalPlannedPieces: { type: Number, required: true, min: 1 },
    totalWantedCuttingWeightKg: { type: Number, required: true, min: 0 },
    totalIssuedCuttingWeightKg: { type: Number, default: 0, min: 0 },
    cuttingSection: { type: String, default: "CUTTING" },
    status: {
      type: String,
      enum: ["DRAFT", "WAITING_STOCK", "PART_ISSUED", "READY", "RUNNING", "PARTIAL", "COMPLETED", "HOLD"],
      default: "DRAFT",
    },
    remarks: { type: String, default: "" },
  },
  { timestamps: true },
);

tenantFields(fabricOutwardSchema);
fabricOutwardSchema.index(
  { companyId: 1, factoryId: 1, outwardNo: 1 },
  { unique: true },
);
fabricOutwardSchema.index(
  { companyId: 1, factoryId: 1, qrToken: 1 },
  { unique: true },
);

export default mongoose.model("FabricOutward", fabricOutwardSchema);
