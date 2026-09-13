import mongoose from "mongoose";
import { tenantFields } from "./plugins/tenantFields.js";

const schema = new mongoose.Schema({
  fileName: { type: String, required: true },
  status: { type: String, enum: ["PENDING_APPROVAL", "PARTIAL", "COMPLETED"], default: "PENDING_APPROVAL" },
  totalRows: { type: Number, default: 0 },
  newRows: { type: Number, default: 0 },
  duplicateRows: { type: Number, default: 0 },
  approvedRows: { type: Number, default: 0 },
  rejectedRows: { type: Number, default: 0 },
  uploadedBy: { type: String, default: "" },
  approvedBy: { type: String, default: "" },
  approvedAt: Date,
}, { timestamps: true });
tenantFields(schema);
export default mongoose.model("PoUploadBatch", schema);
