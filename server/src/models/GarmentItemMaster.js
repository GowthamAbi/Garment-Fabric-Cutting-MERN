import mongoose from "mongoose";

const sizeSchema = new mongoose.Schema(
  {
    size: { type: String, required: true, uppercase: true, trim: true },
    dia: { type: String, required: true, uppercase: true, trim: true },
    cuttingPieceWeightKg: { type: Number, min: 0, default: 0 },
    foldingPieceWeightKg: { type: Number, min: 0, default: 0 },
    elasticMeasurementMtr: { type: Number, min: 0, default: 0 },
  },
  { _id: true },
);

const elasticRangeSchema = new mongoose.Schema(
  {
    fromSize: { type: String, required: true, uppercase: true, trim: true },
    toSize: { type: String, required: true, uppercase: true, trim: true },
    elasticType: { type: String, required: true, trim: true },
    cuttingType: { type: String, required: true, trim: true },
    measurementMtr: { type: Number, min: 0, default: 0 },
  },
  { _id: true },
);

const accessorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, uppercase: true, trim: true },
    required: { type: Boolean, default: false },
    type: { type: String, default: "", trim: true },
    measurement: { type: Number, min: 0, default: 0 },
    unit: { type: String, default: "PCS", uppercase: true, trim: true },
  },
  { _id: true },
);

const schema = new mongoose.Schema(
  {
    itemCode: { type: String, required: true, uppercase: true, trim: true },
    itemName: { type: String, required: true, trim: true },
    fabricGroup: { type: String, required: true, uppercase: true, trim: true },
    sizes: { type: [sizeSchema], default: [] },
    elasticRanges: { type: [elasticRangeSchema], default: [] },
    accessories: { type: [accessorySchema], default: [] },
    status: {
      type: String,
      enum: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"],
      default: "APPROVED",
    },
    createdBy: { type: String, default: "System" },
    approvedBy: { type: String, default: "" },
    approvedAt: Date,
  },
  { timestamps: true },
);

schema.index({ companyId: 1, factoryId: 1, itemCode: 1 }, { unique: true });

export default mongoose.model("GarmentItemMaster", schema);
