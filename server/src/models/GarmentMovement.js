import mongoose from "mongoose";

const garmentMovementSchema = new mongoose.Schema({
  referenceNo: { type: String, required: true, uppercase: true },
  department: { type: String, enum: ["FABRIC", "CUTTING", "ACCESSORIES", "ELASTIC", "STITCHING", "FINISHING", "PACKING", "DISPATCH"], required: true },
  movementType: { type: String, enum: ["INWARD", "OUTWARD", "PRODUCTION", "REWORK", "REJECTION", "WASTE", "DELIVERY"], required: true },
  dcNo: { type: String, default: "", uppercase: true },
  poNo: { type: String, default: "", uppercase: true },
  itemName: { type: String, required: true },
  style: { type: String, required: true, uppercase: true },
  fabricType: { type: String, default: "" },
  colour: { type: String, required: true, uppercase: true },
  size: { type: String, default: "", uppercase: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, default: "PCS", uppercase: true },
  machineCode: { type: String, default: "", uppercase: true },
  employeeCode: { type: String, default: "", uppercase: true },
  fromLocation: { type: String, default: "" },
  toLocation: { type: String, default: "" },
  remarks: { type: String, default: "" },
  status: { type: String, enum: ["PENDING", "RUNNING", "PARTIAL", "COMPLETED", "HOLD"], default: "COMPLETED" },
  transactionDate: { type: Date, default: Date.now },
  createdBy: { type: String, default: "System" },
}, { timestamps: true });

garmentMovementSchema.index({ companyId: 1, factoryId: 1, referenceNo: 1 }, { unique: true });
garmentMovementSchema.index({ companyId: 1, factoryId: 1, dcNo: 1, style: 1, colour: 1, size: 1 });
export default mongoose.model("GarmentMovement", garmentMovementSchema);
