import mongoose from "mongoose";

const scanSchema = new mongoose.Schema(
  {
    action: String,
    lineCode: String,
    employeeCode: String,
    okPcs: Number,
    reworkPcs: Number,
    rejectionPcs: Number,
    remarks: String,
    scannedBy: String,
    scannedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const garmentBundleSchema = new mongoose.Schema(
  {
    bundleNo: { type: String, required: true, unique: true, uppercase: true },
    cuttingNo: { type: String, required: true, uppercase: true },
    dcNo: { type: String, required: true, uppercase: true },
    itemName: { type: String, required: true },
    style: { type: String, required: true, uppercase: true },
    colour: { type: String, required: true, uppercase: true },
    size: { type: String, required: true, uppercase: true },
    bundlePcs: { type: Number, required: true, min: 1 },
    okPcs: { type: Number, default: 0, min: 0 },
    reworkPcs: { type: Number, default: 0, min: 0 },
    rejectionPcs: { type: Number, default: 0, min: 0 },
    balancePcs: { type: Number, required: true, min: 0 },
    lineCode: { type: String, default: "", uppercase: true },
    status: {
      type: String,
      enum: ["CUT_READY", "LINE_RECEIVED", "RUNNING", "QC_HOLD", "REWORK", "COMPLETED", "DELIVERED"],
      default: "CUT_READY",
    },
    scans: { type: [scanSchema], default: [] },
    createdBy: { type: String, default: "Cutting User" },
  },
  { timestamps: true },
);

garmentBundleSchema.index({ companyId: 1, factoryId: 1, dcNo: 1, colour: 1, size: 1 });
export default mongoose.model("GarmentBundle", garmentBundleSchema);
