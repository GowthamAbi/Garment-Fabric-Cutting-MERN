import mongoose from "mongoose";
const line = new mongoose.Schema(
  {
    colour: String,
    size: String,
    dia: String,
    actualPcs: Number,
    actualWeightKg: Number,
    bundleWeightKg: Number,
    wasteWeightKg: Number,
  },
  { _id: false },
);
const schema = new mongoose.Schema(
  {
    wasteNo: { type: String, required: true, uppercase: true },
    planNo: String,
    dcNo: String,
    itemCode: String,
    colour: { type: String, default: "MIXED" },
    wasteWeightKg: { type: Number, required: true, min: 0 },
    lines: { type: [line], default: [] },
    source: { type: String, default: "CUTTING" },
    remarks: String,
    createdBy: String,
  },
  { timestamps: true },
);
schema.index({ companyId: 1, factoryId: 1, wasteNo: 1 }, { unique: true });
export default mongoose.model("FabricWaste", schema);
