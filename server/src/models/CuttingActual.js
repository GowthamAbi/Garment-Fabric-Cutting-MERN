import mongoose from "mongoose";
import { tenantFields } from "./plugins/tenantFields.js";

const actualSizeSchema = new mongoose.Schema(
  {
    size: { type: String, required: true, uppercase: true, trim: true },
    plannedPieces: { type: Number, required: true, min: 0 },
    actualPieces: { type: Number, required: true, min: 0 },
    foldingWeightPerPieceKg: { type: Number, required: true, min: 0 },
    wantedFoldingWeightKg: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const cuttingActualSchema = new mongoose.Schema(
  {
    cuttingActualNo: { type: String, required: true, uppercase: true, trim: true },
    outwardNo: { type: Number, required: true, min: 1000 },
    planNo: { type: String, required: true, uppercase: true, trim: true },
    itemCode: { type: String, required: true, uppercase: true, trim: true },
    itemName: { type: String, required: true, trim: true },
    style: { type: String, required: true, uppercase: true, trim: true },
    colour: { type: String, required: true, uppercase: true, trim: true },
    sizes: { type: [actualSizeSchema], default: [] },
    issuedCuttingWeightKg: { type: Number, required: true, min: 0 },
    cutBundleWeightKg: { type: Number, required: true, min: 0 },
    returnedFabricWeightKg: { type: Number, default: 0, min: 0 },
    wasteWeightKg: { type: Number, required: true, min: 0 },
    wastePercentage: { type: Number, required: true, min: 0 },
    totalPlannedPieces: { type: Number, required: true, min: 0 },
    totalActualPieces: { type: Number, required: true, min: 0 },
    piecesDifference: { type: Number, required: true },
    totalWantedFoldingWeightKg: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["PARTIAL", "COMPLETED", "HOLD"], default: "COMPLETED" },
    completedAt: { type: Date, default: Date.now },
    remarks: { type: String, default: "" },
  },
  { timestamps: true },
);

tenantFields(cuttingActualSchema);
cuttingActualSchema.index(
  { companyId: 1, factoryId: 1, cuttingActualNo: 1 },
  { unique: true },
);
cuttingActualSchema.index({ companyId: 1, factoryId: 1, outwardNo: 1, colour: 1 });

export default mongoose.model("CuttingActual", cuttingActualSchema);
