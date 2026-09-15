import mongoose from "mongoose";
const line = new mongoose.Schema(
  {
    colour: { type: String, uppercase: true },
    size: { type: String, uppercase: true },
    plannedPcs: Number,
    actualPcs: Number,
    bundleCount: Number,
    bundleWeightKg: Number,
  },
  { _id: true },
);
const schema = new mongoose.Schema(
  {
    actualNo: { type: String, required: true, uppercase: true },
    planNo: { type: String, required: true, uppercase: true },
    dcNo: { type: String, required: true, uppercase: true },
    itemCode: String,
    itemName: String,
    style: String,
    issuedWeightKg: Number,
    lines: [line],
    totalActualPcs: Number,
    totalBundleCount: Number,
    totalBundleWeightKg: Number,
    wasteWeightKg: Number,
    status: {
      type: String,
      enum: ["PARTIAL", "COMPLETED", "HOLD"],
      default: "COMPLETED",
    },
    remarks: String,
    createdBy: String,
  },
  { timestamps: true },
);
schema.index({ companyId: 1, factoryId: 1, actualNo: 1 }, { unique: true });
schema.index({ companyId: 1, factoryId: 1, planNo: 1 }, { unique: true });
export default mongoose.model("FabricCutActual", schema);
