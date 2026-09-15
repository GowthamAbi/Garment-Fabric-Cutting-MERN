import mongoose from "mongoose";

const measurementMasterSchema = new mongoose.Schema({
  itemName: { type: String, required: true, trim: true },
  style: { type: String, required: true, uppercase: true, trim: true },
  size: { type: String, required: true, uppercase: true, trim: true },
  measurement: { type: Number, required: true, min: 0.0001 },
  unit: { type: String, default: "MTR" },
  updatedBy: { type: String, default: "Production User" },
}, { timestamps: true });

measurementMasterSchema.index({ companyId: 1, factoryId: 1, itemName: 1, style: 1, size: 1 }, { unique: true });
export default mongoose.model("MeasurementMaster", measurementMasterSchema);
