import mongoose from "mongoose";

const fabricBundleStockSchema = new mongoose.Schema(
  {
    bundleNo: { type: String, required: true, uppercase: true, trim: true },
    qrToken: { type: String, required: true, trim: true },
    rollNo: { type: Number, required: true, min: 1 },
    inwardType: { type: String, enum: ["SAMPLE", "LOT"], required: true },
    inwardNo: { type: String, required: true, uppercase: true, trim: true },
    fabricCode: { type: String, required: true, uppercase: true, trim: true },
    fabricName: { type: String, required: true, trim: true },
    fabricGroup: { type: String, required: true, uppercase: true, trim: true },
    colour: { type: String, required: true, uppercase: true, trim: true },
    dia: { type: String, required: true, trim: true },
    dyeingName: { type: String, default: "" },
    compactingName: { type: String, default: "" },
    averageWeightKg: { type: Number, required: true, min: 0.001 },
    originalWeightKg: { type: Number, required: true, min: 0.001 },
    balanceWeightKg: { type: Number, required: true, min: 0 },
    provisionalWeight: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["AVAILABLE", "PARTIAL", "CONSUMED", "HOLD"],
      default: "AVAILABLE",
    },
    createdBy: { type: String, default: "Fabric Store" },
  },
  { timestamps: true },
);

fabricBundleStockSchema.index(
  { companyId: 1, factoryId: 1, bundleNo: 1 },
  { unique: true },
);
fabricBundleStockSchema.index({
  companyId: 1,
  factoryId: 1,
  inwardNo: 1,
  colour: 1,
  createdAt: 1,
});

export default mongoose.model("FabricBundleStock", fabricBundleStockSchema);
