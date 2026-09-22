import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  action: String,
  fromStatus: String,
  toStatus: String,
  machineCode: String,
  reason: { type: String, default: "" },
  user: String,
  at: { type: Date, default: Date.now },
}, { _id: true });

const schema = new mongoose.Schema({
  machineType: { type: String, enum: ["SPREADER", "CUTTER"], required: true },
  machineCode: { type: String, required: true, uppercase: true, trim: true },
  planNo: { type: String, required: true, uppercase: true, trim: true },
  dcNo: { type: String, required: true, uppercase: true, trim: true },
  colour: { type: String, required: true, uppercase: true, trim: true },
  size: { type: String, default: "ALL", uppercase: true, trim: true },
  pcs: { type: Number, required: true, min: 1 },
  priority: { type: Number, default: 1, min: 1 },
  queuePosition: { type: Number, default: 1, min: 0 },
  status: { type: String, enum: ["QUEUED", "READY", "RUNNING", "PAUSED", "BREAKDOWN", "CHANGE", "PUBLISHED", "COMPLETED"], default: "QUEUED" },
  upstreamAssignmentId: { type: mongoose.Schema.Types.ObjectId, ref: "CuttingMachinePlan" },
  startedAt: Date,
  completedAt: Date,
  events: { type: [eventSchema], default: [] },
  createdBy: String,
}, { timestamps: true });

schema.index({ machineCode: 1, status: 1, queuePosition: 1 });
schema.index({ planNo: 1, createdAt: -1 });
export default mongoose.model("CuttingMachinePlan", schema);
