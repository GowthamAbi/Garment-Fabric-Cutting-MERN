import mongoose from "mongoose";
import { tenantFields } from "./plugins/tenantFields.js";

const fabricAllocationSchema = new mongoose.Schema(
  {
    allocationNo: { type: String, required: true, uppercase: true, trim: true },
    outwardNo: { type: Number, required: true, min: 1000 },
    poNo: { type: String, required: true, uppercase: true, trim: true },
    itemCode: { type: String, required: true, uppercase: true, trim: true },
    style: { type: String, required: true, uppercase: true, trim: true },
    colour: { type: String, required: true, uppercase: true, trim: true },
    size: { type: String, required: true, uppercase: true, trim: true },
    inwardNo: { type: String, required: true, uppercase: true, trim: true },
    bundleNo: { type: String, required: true, uppercase: true, trim: true },
    lotNo: { type: String, required: true, uppercase: true, trim: true },
    stockAgeDate: { type: Date, required: true, index: true },
    priority: { type: Number, default: 1, min: 1 },
    purpose: { type: String, enum: ["CUTTING", "FOLDING"], required: true },
    wantedWeightKg: { type: Number, required: true, min: 0 },
    issuedWeightKg: { type: Number, required: true, min: 0.001 },
    returnedWeightKg: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["RESERVED", "ISSUED", "PART_RETURNED", "CLOSED", "CANCELLED"],
      default: "ISSUED",
    },
    issuedAt: { type: Date, default: Date.now },
    issuedBy: { type: String, required: true },
  },
  { timestamps: true },
);

tenantFields(fabricAllocationSchema);
fabricAllocationSchema.index(
  { companyId: 1, factoryId: 1, allocationNo: 1 },
  { unique: true },
);
fabricAllocationSchema.index({ companyId: 1, factoryId: 1, outwardNo: 1, colour: 1, size: 1, purpose: 1 });

export default mongoose.model("FabricAllocation", fabricAllocationSchema);
