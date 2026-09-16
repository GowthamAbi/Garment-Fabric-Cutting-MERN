import mongoose from "mongoose";
const size = new mongoose.Schema(
  {
    size: String,
    dia: String,
    plannedPcs: Number,
    cuttingWeightPerPieceKg: Number,
    wantedWeightKg: Number,
  },
  { _id: false },
);
const colour = new mongoose.Schema(
  {
    colour: String,
    sizes: [size],
    totalPcs: Number,
    wantedWeightKg: Number,
    availableWeightBeforeKg: Number,
  },
  { _id: true },
);
const allocation = new mongoose.Schema(
  {
    inwardNo: String,
    colour: String,
    weightKg: Number,
    issuedAt: { type: Date, default: Date.now },
    issuedBy: String,
  },
  { _id: true },
);
const schema = new mongoose.Schema(
  {
    planNo: { type: String, required: true, uppercase: true },
    orderNo: { type: String, required: true, uppercase: true, trim: true },
    dcNo: { type: String, required: true, uppercase: true },
    dcType: {
      type: String,
      enum: ["FRESH_LOT", "FOLDING_LOT"],
      required: true,
    },
    itemCode: { type: String, required: true, uppercase: true },
    itemName: { type: String, required: true },
    style: { type: String, default: "", uppercase: true },
    bomNo: { type: String, default: "", uppercase: true },
    fabricCode: { type: String, default: "", uppercase: true },
    fabricGroup: { type: String, required: true, uppercase: true },
    numberOfColours: { type: Number, required: true, min: 1 },
    colours: [colour],
    allocations: [allocation],
    totalPlannedPcs: Number,
    totalWantedWeightKg: Number,
    issuedWeightKg: { type: Number, default: 0 },
    status: {
      type: String,
      enum: [
        "PLANNED",
        "PART_ISSUED",
        "READY",
        "RUNNING",
        "PARTIAL",
        "COMPLETED",
        "HOLD",
      ],
      default: "PLANNED",
    },
    notes: { type: String, default: "", trim: true },
    createdBy: String,
  },
  { timestamps: true },
);
schema.index({ companyId: 1, factoryId: 1, planNo: 1 }, { unique: true });
schema.index({ companyId: 1, factoryId: 1, dcNo: 1 });
export default mongoose.model("FabricCutPlan", schema);
