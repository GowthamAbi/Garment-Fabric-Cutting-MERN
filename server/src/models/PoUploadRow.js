import mongoose from "mongoose";
import { tenantFields } from "./plugins/tenantFields.js";

const schema = new mongoose.Schema({
  batchId: { type: mongoose.Schema.Types.ObjectId, ref: "PoUploadBatch", required: true, index: true },
  rowNo: { type: Number, required: true }, poNo: String, soNo: String, itemCode: String,
  itemName: String, itemGroup: String, deliveryMonthLabel: String, deliveryDate: Date,
  orderType: { type: String, enum: ["REGULAR", "SPECIAL"], default: "REGULAR" },
  uploadedQty: { type: Number, required: true, min: 0 }, existingQty: { type: Number, default: 0 },
  isDuplicate: { type: Boolean, default: false },
  decision: { type: String, enum: ["PENDING", "CREATE", "REPLACE", "ADD", "REJECT"], default: "PENDING" },
  finalQty: { type: Number, default: 0 }, decisionReason: { type: String, default: "" },
  decidedBy: { type: String, default: "" }, decidedAt: Date,
}, { timestamps: true });
tenantFields(schema);
schema.index({ companyId: 1, factoryId: 1, batchId: 1, rowNo: 1 }, { unique: true });
export default mongoose.model("PoUploadRow", schema);
