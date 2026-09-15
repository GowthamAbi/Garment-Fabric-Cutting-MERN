import mongoose from "mongoose";

const orderLineSchema = new mongoose.Schema({
  size: { type: String, required: true, uppercase: true },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });

const garmentPoSchema = new mongoose.Schema({
  poNo: { type: String, required: true, uppercase: true },
  poDate: { type: Date, required: true },
  deliveryDate: Date,
  buyer: { type: String, default: "" },
  itemName: { type: String, required: true },
  style: { type: String, required: true, uppercase: true },
  bomNo: { type: String, required: true, uppercase: true },
  colour: { type: String, required: true, uppercase: true },
  sizes: { type: [orderLineSchema], default: [] },
  orderQty: { type: Number, required: true, min: 1 },
  cuttingCompletedQty: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ["OPEN", "PARTIAL", "COMPLETED", "HOLD"], default: "OPEN" },
  sourcePeriodFrom: Date,
  sourcePeriodTo: Date,
  uploadBatch: { type: String, default: "MANUAL" },
  createdBy: { type: String, default: "System" },
}, { timestamps: true });

garmentPoSchema.index({ companyId: 1, factoryId: 1, poNo: 1, style: 1, colour: 1 }, { unique: true });
export default mongoose.model("GarmentPo", garmentPoSchema);
