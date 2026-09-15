import mongoose from "mongoose";

const colourSchema = new mongoose.Schema({ name: { type: String, required: true, uppercase: true } }, { _id: false });
const sizeSchema = new mongoose.Schema({
  size: { type: String, required: true, uppercase: true },
  cuttingKg: { type: Number, required: true, min: 0 },
  foldingKg: { type: Number, default: 0, min: 0 },
  elasticType: { type: String, default: "" },
  elasticMeasurement: { type: Number, default: 0, min: 0 },
}, { _id: false });
const accessorySchema = new mongoose.Schema({
  itemCode: { type: String, required: true, uppercase: true },
  itemName: { type: String, required: true },
  unit: { type: String, default: "PCS", uppercase: true },
  consumption: { type: Number, required: true, min: 0 },
}, { _id: false });

const garmentBomSchema = new mongoose.Schema({
  bomNo: { type: String, required: true, uppercase: true },
  itemName: { type: String, required: true },
  brand: { type: String, default: "" },
  style: { type: String, required: true, uppercase: true },
  category: { type: String, default: "" },
  fabricType: { type: String, required: true },
  colours: { type: [colourSchema], default: [] },
  sizes: { type: [sizeSchema], default: [] },
  accessories: { type: [accessorySchema], default: [] },
  status: { type: String, enum: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"], default: "DRAFT" },
  createdBy: { type: String, default: "System" },
  approvedBy: { type: String, default: "" },
  approvedAt: Date,
}, { timestamps: true });

garmentBomSchema.index({ companyId: 1, factoryId: 1, bomNo: 1 }, { unique: true });
garmentBomSchema.index({ companyId: 1, factoryId: 1, style: 1 });
export default mongoose.model("GarmentBom", garmentBomSchema);
