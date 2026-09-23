import mongoose from "mongoose";

const line = new mongoose.Schema({
  colour: { type: String, uppercase: true },
  size: { type: String, uppercase: true },
  pcs: { type: Number, min: 1 },
}, { _id: true });
const schema = new mongoose.Schema({
  challanNo: { type: String, required: true, uppercase: true },
  deliveryDate: { type: Date, default: Date.now },
  planNo: { type: String, required: true, uppercase: true },
  dcNo: { type: String, required: true, uppercase: true },
  orderNo: { type: String, default: "", uppercase: true },
  itemCode: { type: String, default: "", uppercase: true },
  itemName: { type: String, default: "" },
  style: { type: String, default: "", uppercase: true },
  vendorCode: { type: String, required: true, uppercase: true },
  vendorName: { type: String, required: true },
  vendorAddress: { type: String, default: "" },
  qcName: { type: String, default: "" },
  lines: { type: [line], default: [] },
  totalPcs: { type: Number, default: 0 },
  status: { type: String, enum: ["ISSUED", "CANCELLED"], default: "ISSUED" },
  remarks: { type: String, default: "" },
  createdBy: String,
}, { timestamps: true });
schema.index({ companyId: 1, factoryId: 1, challanNo: 1 }, { unique: true });
schema.index({ companyId: 1, factoryId: 1, planNo: 1, deliveryDate: -1 });
export default mongoose.model("DeliveryChallan", schema);
