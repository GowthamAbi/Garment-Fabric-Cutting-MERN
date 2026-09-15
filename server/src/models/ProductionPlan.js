import mongoose from "mongoose";

const sizeLineSchema = new mongoose.Schema({
  size: { type: String, required: true, uppercase: true },
  requiredPcs: { type: Number, required: true, min: 1 },
  measurement: { type: Number, required: true, min: 0.0001 },
  requiredMtr: { type: Number, default: 0, min: 0 },
  producedPcs: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ["Not Started", "Running", "Partial", "Complete", "Material Pending", "Rework Pending", "Rejected", "On Hold"], default: "Not Started" },
}, { _id: true });

const colourLineSchema = new mongoose.Schema({
  colour: { type: String, required: true, uppercase: true },
  sizes: { type: [sizeLineSchema], default: [] },
}, { _id: true });

const productionPlanSchema = new mongoose.Schema({
  planNo: { type: String, required: true, unique: true },
  dcNo: { type: String, required: true, uppercase: true, trim: true },
  customerOrder: { type: String, default: "" },
  section: { type: String, required: true },
  itemCode: { type: String, required: true, uppercase: true },
  itemName: { type: String, default: "" },
  priority: { type: String, enum: ["Low", "Normal", "High", "Urgent"], default: "Normal" },
  requiredDate: Date,
  plannedMachine: { type: String, default: "", uppercase: true },
  colours: { type: [colourLineSchema], default: [] },
  status: { type: String, enum: ["Draft", "Planned", "Running", "Partial", "Completed", "On Hold", "Cancelled"], default: "Planned" },
  createdBy: { type: String, default: "Planner" },
}, { timestamps: true });

productionPlanSchema.index({ companyId: 1, dcNo: 1, itemCode: 1 }, { unique: true });
export default mongoose.model("ProductionPlan", productionPlanSchema);
