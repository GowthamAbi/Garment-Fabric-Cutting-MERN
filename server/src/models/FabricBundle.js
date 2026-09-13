import mongoose from "mongoose";
import { tenantFields } from "./plugins/tenantFields.js";

const fabricBundleSchema = new mongoose.Schema(
  {
    bundleNo: { type: String, required: true, uppercase: true, trim: true },
    qrToken: { type: String, required: true, trim: true },
    inwardNo: { type: String, required: true, uppercase: true, trim: true },
    lotNo: { type: String, required: true, uppercase: true, trim: true },
    fabricCode: { type: String, required: true, uppercase: true, trim: true },
    fabricGroup: { type: String, required: true, uppercase: true, trim: true },
    fabricType: { type: String, required: true, uppercase: true, trim: true },
    colour: { type: String, required: true, uppercase: true, trim: true },
    setNo: { type: String, default: "", uppercase: true, trim: true },
    dyeingNo: { type: String, default: "", uppercase: true, trim: true },
    compactingNo: { type: String, default: "", uppercase: true, trim: true },
    compactorName: { type: String, default: "", trim: true },
    dia: { type: String, default: "", uppercase: true, trim: true },
    gsm: { type: Number, default: 0, min: 0 },
    bundleType: { type: String, enum: ["MAIN", "SAMPLE"], default: "MAIN" },
    weightSource: { type: String, enum: ["AVERAGE", "VERIFIED"], default: "AVERAGE" },
    originalWeightKg: { type: Number, required: true, min: 0 },
    availableWeightKg: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["WEIGHT_PENDING", "AVAILABLE", "PART_ISSUED", "ISSUED", "HOLD", "REJECTED"],
      default: "WEIGHT_PENDING",
    },
    currentLocation: { type: String, default: "FABRIC_STORE" },
    customFields: { type: Map, of: String, default: {} },
  },
  { timestamps: true },
);

tenantFields(fabricBundleSchema);
fabricBundleSchema.index(
  { companyId: 1, factoryId: 1, bundleNo: 1 },
  { unique: true },
);
fabricBundleSchema.index(
  { companyId: 1, factoryId: 1, qrToken: 1 },
  { unique: true },
);
fabricBundleSchema.index({ companyId: 1, factoryId: 1, fabricCode: 1, colour: 1, inwardNo: 1 });

export default mongoose.model("FabricBundle", fabricBundleSchema);
