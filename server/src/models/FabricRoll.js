import mongoose from "mongoose";

const fabricRollSchema = new mongoose.Schema(
  {
    inwardNo: { type: String, required: true, unique: true, uppercase: true },
    supplier: { type: String, required: true },
    invoiceNo: { type: String, default: "", uppercase: true },
    fabricCode: { type: String, required: true, uppercase: true },
    fabricName: { type: String, required: true },
    lotNo: { type: String, required: true, uppercase: true },
    colour: { type: String, required: true, uppercase: true },
    dia: { type: String, default: "" },
    gsm: { type: Number, default: 0, min: 0 },
    rollCount: { type: Number, required: true, min: 1 },
    quantityKg: { type: Number, default: 0, min: 0 },
    quantityMtr: { type: Number, default: 0, min: 0 },
    balanceKg: { type: Number, default: 0, min: 0 },
    balanceMtr: { type: Number, default: 0, min: 0 },
    inspectionStatus: {
      type: String,
      enum: ["PENDING", "PASSED", "HOLD", "REJECTED"],
      default: "PENDING",
    },
    inspectedKg: { type: Number, default: 0, min: 0 },
    rejectedKg: { type: Number, default: 0, min: 0 },
    inspectionRemarks: { type: String, default: "" },
    inwardDate: { type: Date, default: Date.now },
    createdBy: { type: String, default: "Fabric Store" },
  },
  { timestamps: true },
);

fabricRollSchema.index({ companyId: 1, factoryId: 1, fabricCode: 1, colour: 1, lotNo: 1 });
export default mongoose.model("FabricRoll", fabricRollSchema);
