import mongoose from "mongoose";

const historySchema = new mongoose.Schema({
  action: String,
  quantity: Number,
  fromType: String,
  toType: String,
  targetItemName: String,
  targetColour: String,
  targetSize: String,
  sectionCode: String,
  reason: String,
  user: String,
  at: { type: Date, default: Date.now },
}, { _id: true });

const warehouseStockSchema = new mongoose.Schema({
  referenceNo: { type: String, required: true, unique: true },
  warehouseType: { type: String, enum: ["PRODUCTION_READY", "REWORK", "REJECTION", "SECTION_DELIVERY", "BALANCE_ELASTIC"], required: true, index: true },
  jobNo: { type: String, required: true, uppercase: true, index: true },
  dcNo: { type: String, required: true, uppercase: true, index: true },
  outwardNo: { type: String, required: true, uppercase: true },
  itemCode: { type: String, required: true, uppercase: true },
  itemName: { type: String, default: "" },
  colour: { type: String, required: true, uppercase: true },
  size: { type: String, required: true, uppercase: true },
  originalQty: { type: Number, required: true, min: 0 },
  balanceQty: { type: Number, required: true, min: 0 },
  sectionCode: { type: String, default: "", uppercase: true },
  reason: { type: String, default: "" },
  unit: { type: String, default: "PCS" },
  history: [historySchema],
  createdBy: { type: String, default: "Production User" },
}, { timestamps: true });

export default mongoose.model("WarehouseStock", warehouseStockSchema);
