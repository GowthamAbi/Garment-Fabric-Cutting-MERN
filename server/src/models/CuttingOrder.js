import mongoose from "mongoose";

const sizePlanSchema = new mongoose.Schema(
  {
    size: { type: String, required: true, uppercase: true },
    plannedPcs: { type: Number, required: true, min: 1 },
    cutPcs: { type: Number, default: 0, min: 0 },
  },
  { _id: true },
);

const cuttingOrderSchema = new mongoose.Schema(
  {
    cuttingNo: { type: String, required: true, unique: true, uppercase: true },
    dcNo: { type: String, required: true, uppercase: true },
    buyer: { type: String, default: "" },
    itemName: { type: String, required: true },
    style: { type: String, required: true, uppercase: true },
    fabricInwardNo: { type: String, required: true, uppercase: true },
    fabricCode: { type: String, required: true, uppercase: true },
    colour: { type: String, required: true, uppercase: true },
    issuedKg: { type: Number, default: 0, min: 0 },
    issuedMtr: { type: Number, default: 0, min: 0 },
    sizes: { type: [sizePlanSchema], default: [] },
    totalPlannedPcs: { type: Number, default: 0, min: 0 },
    totalCutPcs: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["PLANNED", "FABRIC_ISSUED", "CUTTING", "PARTIAL", "COMPLETED"],
      default: "FABRIC_ISSUED",
    },
    createdBy: { type: String, default: "Cutting User" },
  },
  { timestamps: true },
);

cuttingOrderSchema.index({ companyId: 1, factoryId: 1, dcNo: 1, style: 1, colour: 1 });
export default mongoose.model("CuttingOrder", cuttingOrderSchema);
