import mongoose from "mongoose";

const sewingHoldSchema = new mongoose.Schema({
  holdNo: { type: String, required: true, unique: true },
  outwardNo: { type: String, required: true, uppercase: true },
  colour: { type: String, required: true, uppercase: true },
  size: { type: String, required: true, uppercase: true },
  quantity: { type: Number, required: true, min: 1 },
  reason: { type: String, required: true },
  remarks: { type: String, default: "" },
  status: { type: String, enum: ["Active", "Resolved", "Cancelled"], default: "Active" },
  createdBy: { type: String, default: "Sewing Coordinator" },
  resolvedAt: Date,
}, { timestamps: true });

export default mongoose.model("SewingHold", sewingHoldSchema);
