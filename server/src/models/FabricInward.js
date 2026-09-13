import mongoose from "mongoose";
import { tenantFields } from "./plugins/tenantFields.js";

const fabricInwardSchema = new mongoose.Schema(
  {
    inwardNo: { type: String, required: true, uppercase: true, trim: true },
    inwardDate: { type: Date, default: Date.now, index: true },
    supplierName: { type: String, required: true, trim: true },
    supplierDcNo: { type: String, default: "", uppercase: true, trim: true },
    invoiceNo: { type: String, default: "", uppercase: true, trim: true },
    fabricCode: { type: String, required: true, uppercase: true, trim: true },
    fabricGroup: { type: String, required: true, uppercase: true, trim: true },
    fabricType: { type: String, required: true, uppercase: true, trim: true },
    colour: { type: String, required: true, uppercase: true, trim: true },
    lotNo: { type: String, required: true, uppercase: true, trim: true },
    setNo: { type: String, default: "", uppercase: true, trim: true },
    dyeingNo: { type: String, default: "", uppercase: true, trim: true },
    compactingNo: { type: String, default: "", uppercase: true, trim: true },
    compactorName: { type: String, default: "", trim: true },
    dia: { type: String, default: "", uppercase: true, trim: true },
    gsm: { type: Number, default: 0, min: 0 },
    rollCount: { type: Number, required: true, min: 1 },
    declaredWeightKg: { type: Number, required: true, min: 0.001 },
    verifiedBundleWeightKg: { type: Number, default: 0, min: 0 },
    availableWeightKg: { type: Number, required: true, min: 0 },
    entryMode: {
      type: String,
      enum: ["TOTAL_ONLY", "BUNDLE_WISE", "HYBRID"],
      default: "TOTAL_ONLY",
    },
    sampleWeightKg: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["WEIGHT_PENDING", "PART_VERIFIED", "VERIFIED", "PART_ISSUED", "ISSUED"],
      default: "WEIGHT_PENDING",
    },
    customFields: { type: Map, of: String, default: {} },
    remarks: { type: String, default: "" },
  },
  { timestamps: true },
);

tenantFields(fabricInwardSchema);
fabricInwardSchema.index(
  { companyId: 1, factoryId: 1, inwardNo: 1 },
  { unique: true },
);
fabricInwardSchema.index({ companyId: 1, factoryId: 1, fabricCode: 1, colour: 1, lotNo: 1, inwardDate: 1 });

export default mongoose.model("FabricInward", fabricInwardSchema);
