import mongoose from "mongoose";
import { tenantFields } from "./plugins/tenantFields.js";

const foldingSizeSchema = new mongoose.Schema(
  {
    size: { type: String, required: true, uppercase: true, trim: true },
    actualCutPieces: { type: Number, required: true, min: 0 },
    foldingWeightPerPieceKg: { type: Number, required: true, min: 0 },
    wantedWeightKg: { type: Number, required: true, min: 0 },
    issuedWeightKg: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const foldingFabricIssueSchema = new mongoose.Schema(
  {
    foldingIssueNo: { type: String, required: true, uppercase: true, trim: true },
    outwardNo: { type: Number, required: true, min: 1000 },
    cuttingActualNo: { type: String, required: true, uppercase: true, trim: true },
    itemCode: { type: String, required: true, uppercase: true, trim: true },
    itemName: { type: String, required: true, trim: true },
    style: { type: String, required: true, uppercase: true, trim: true },
    colour: { type: String, required: true, uppercase: true, trim: true },
    sizes: { type: [foldingSizeSchema], default: [] },
    wantedWeightKg: { type: Number, required: true, min: 0 },
    issuedWeightKg: { type: Number, default: 0, min: 0 },
    shortageWeightKg: { type: Number, default: 0, min: 0 },
    returnedWeightKg: { type: Number, default: 0, min: 0 },
    usedWeightKg: { type: Number, default: 0, min: 0 },
    wasteWeightKg: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["SHORTAGE", "PART_ISSUED", "READY", "RUNNING", "COMPLETED"],
      default: "SHORTAGE",
    },
    sectionName: { type: String, default: "FOLDING" },
    issuedBy: { type: String, default: "" },
    issuedAt: Date,
    completedAt: Date,
    remarks: { type: String, default: "" },
  },
  { timestamps: true },
);

tenantFields(foldingFabricIssueSchema);
foldingFabricIssueSchema.index(
  { companyId: 1, factoryId: 1, foldingIssueNo: 1 },
  { unique: true },
);
foldingFabricIssueSchema.index({ companyId: 1, factoryId: 1, outwardNo: 1, colour: 1 });

export default mongoose.model("FoldingFabricIssue", foldingFabricIssueSchema);
