import mongoose from "mongoose";
import { tenantFields } from "./plugins/tenantFields.js";

const sizeMeasurementSchema = new mongoose.Schema(
  {
    size: { type: String, required: true, uppercase: true, trim: true },
    dia: { type: String, default: "", uppercase: true, trim: true },
    cuttingWeightPerPieceKg: { type: Number, required: true, min: 0 },
    foldingWeightPerPieceKg: { type: Number, required: true, min: 0 },
    totalWeightPerPieceKg: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const colourSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, uppercase: true, trim: true },
    priority: { type: Number, default: 1, min: 1 },
  },
  { _id: false },
);

const garmentBomSchema = new mongoose.Schema(
  {
    bomNo: { type: String, required: true, uppercase: true, trim: true },
    itemCode: { type: String, required: true, uppercase: true, trim: true },
    itemName: { type: String, required: true, trim: true },
    brand: { type: String, default: "", trim: true },
    style: { type: String, required: true, uppercase: true, trim: true },
    category: { type: String, default: "", trim: true },
    fabricGroup: { type: String, required: true, uppercase: true, trim: true },
    fabricType: { type: String, required: true, uppercase: true, trim: true },
    fabricPriority: { type: Number, default: 1, min: 1 },
    numberOfColours: { type: Number, required: true, min: 1 },
    colours: { type: [colourSchema], default: [] },
    sizeMeasurements: { type: [sizeMeasurementSchema], default: [] },
    revision: { type: Number, default: 1, min: 1 },
    isActive: { type: Boolean, default: false },
    parentRevisionId: { type: mongoose.Schema.Types.ObjectId, ref: "GarmentBom", default: null },
    changeReason: { type: String, default: "", trim: true },
    rejectionReason: { type: String, default: "", trim: true },
    submittedBy: { type: String, default: "" },
    status: {
      type: String,
      enum: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"],
      default: "DRAFT",
    },
    approvedBy: { type: String, default: "" },
    approvedAt: Date,
  },
  { timestamps: true },
);

tenantFields(garmentBomSchema);
garmentBomSchema.index(
  { companyId: 1, factoryId: 1, bomNo: 1, revision: 1 },
  { unique: true },
);
garmentBomSchema.index({ companyId: 1, factoryId: 1, bomNo: 1, isActive: 1 });
garmentBomSchema.index({ companyId: 1, factoryId: 1, itemCode: 1, style: 1 });

export default mongoose.model("GarmentBom", garmentBomSchema);
