import mongoose from "mongoose";

const pendingIssueSchema = new mongoose.Schema(
  {
    issueNo: { type: String, required: true, unique: true },
    outwardNo: { type: String, default: "", uppercase: true },
    section: { type: String, required: true },
    itemCode: { type: String, default: "", uppercase: true },
    itemName: { type: String, default: "" },
    colour: { type: String, required: true, uppercase: true },
    size: { type: String, default: "", uppercase: true },
    requiredPcs: { type: Number, default: 0, min: 0 },
    requiredMtr: { type: Number, default: 0, min: 0 },
    availableMtr: { type: Number, default: 0, min: 0 },
    shortageMtr: { type: Number, default: 0, min: 0 },
    issueType: {
      type: String,
      enum: ["Material Shortage", "Colour Pending", "Elastic Rejected", "Production Hold", "Rework Pending", "Machine Breakdown", "Sewing Hold", "Delivery Pending", "Overdue Requirement", "Other"],
      default: "Material Shortage",
    },
    reason: { type: String, required: true },
    priority: { type: String, enum: ["Low", "Medium", "High", "Critical"], default: "Medium" },
    neededDate: Date,
    expectedMaterialDate: Date,
    rejectedMtr: { type: Number, default: 0, min: 0 },
    affectedPcs: { type: Number, default: 0, min: 0 },
    photo: { type: String, default: "" },
    complaintDetails: { type: String, default: "" },
    rootCause: { type: String, default: "" },
    actionTaken: { type: String, default: "" },
    spareUsed: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Pending", "Requested", "Material Requested", "Store Checking", "Purchase Required", "PO Raised", "In Transit", "Material Received", "Issued", "Resolved", "Reopened", "Cancelled"],
      default: "Pending",
    },
    remarks: { type: String, default: "" },
    createdBy: { type: String, default: "Production User" },
    resolvedAt: Date,
  },
  { timestamps: true },
);

export default mongoose.model("PendingIssue", pendingIssueSchema);
