import mongoose from "mongoose";
const detail = new mongoose.Schema(
  {
    dia: { type: String, required: true, trim: true },
    rollCount: { type: Number, required: true, min: 1 },
    weightKg: { type: Number, required: true, min: 0.001 },
  },
  { _id: true },
);
const colour = new mongoose.Schema(
  {
    colour: { type: String, required: true, uppercase: true, trim: true },
    details: { type: [detail], default: [] },
    totalRolls: { type: Number, default: 0 },
    totalWeightKg: { type: Number, default: 0 },
    balanceWeightKg: { type: Number, default: 0 },
  },
  { _id: true },
);
const schema = new mongoose.Schema(
  {
    inwardNo: { type: String, required: true, uppercase: true, trim: true },
    sampleInwardNo: { type: String, default: "", uppercase: true, trim: true },
    fabricCode: { type: String, required: true, uppercase: true, trim: true },
    fabricGroup: { type: String, required: true, uppercase: true, trim: true },
    itemCode: { type: String, required: true, uppercase: true, trim: true },
    itemName: { type: String, required: true, trim: true },
    compactingCode: String,
    compactingName: String,
    dyeingCode: String,
    dyeingName: String,
    supplier: { type: String, default: "" },
    dcNo: { type: String, default: "", uppercase: true },
    lotNo: { type: String, required: true, uppercase: true, trim: true },
    colours: { type: [colour], default: [] },
    totalRolls: { type: Number, default: 0 },
    totalWeightKg: { type: Number, default: 0 },
    inwardDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["AVAILABLE", "PARTIAL", "CLOSED", "HOLD"],
      default: "AVAILABLE",
    },
    createdBy: { type: String, default: "Fabric Store" },
  },
  { timestamps: true },
);
schema.index({ companyId: 1, factoryId: 1, inwardNo: 1 }, { unique: true });
schema.index({
  companyId: 1,
  factoryId: 1,
  fabricCode: 1,
  "colours.colour": 1,
});
export default mongoose.model("FabricInwardLot", schema);
