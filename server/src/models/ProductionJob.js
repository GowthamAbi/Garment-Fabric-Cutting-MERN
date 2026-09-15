import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    type: String,
    reason: { type: String, default: "" },
    startTime: { type: Date, default: Date.now },
    stopTime: Date,
  },
  { _id: true },
);

const productionJobSchema = new mongoose.Schema(
  {
    jobNo: { type: String, required: true, unique: true },
    outwardNo: { type: String, required: true, uppercase: true, trim: true },
    dcNo: { type: String, required: true, uppercase: true, trim: true },
    itemCode: { type: String, required: true, uppercase: true },
    itemName: { type: String, default: "" },
    section: { type: String, required: true },
    colour: { type: String, required: true, uppercase: true },
    size: { type: String, required: true, uppercase: true },
    sizePlan: [{
      size: { type: String, required: true, uppercase: true, trim: true },
      plannedPcs: { type: Number, required: true, min: 1 },
    }],
    completionBySize: [{
      size: { type: String, required: true, uppercase: true },
      okPcs: { type: Number, default: 0, min: 0 },
      reworkPcs: { type: Number, default: 0, min: 0 },
      rejectionPcs: { type: Number, default: 0, min: 0 },
    }],
    plannedPcs: { type: Number, required: true, min: 1 },
    machineCode: { type: String, required: true, uppercase: true },
    employeeCode: { type: String, required: true, uppercase: true },
    planNo: { type: String, default: "", uppercase: true },
    shift: { type: String, default: "General" },
    startTime: { type: Date, default: Date.now },
    stopTime: Date,
    okPcs: { type: Number, default: 0, min: 0 },
    reworkPcs: { type: Number, default: 0, min: 0 },
    rejectionPcs: { type: Number, default: 0, min: 0 },
    balancePcs: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["Running", "Breakdown", "Thread Change", "Bobbin Change", "Box Change", "Size Change", "Other Change", "Partially Completed", "Completed", "Rejected"],
      default: "Running",
    },
    events: [eventSchema],
    remarks: { type: String, default: "" },
    createdBy: { type: String, default: "Production User" },
  },
  { timestamps: true },
);

export default mongoose.model("ProductionJob", productionJobSchema);
