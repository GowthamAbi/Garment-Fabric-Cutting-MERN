import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    fabricCode: { type: String, required: true, uppercase: true, trim: true },
    fabricName: { type: String, required: true, trim: true },
    fabricGroup: { type: String, required: true, uppercase: true, trim: true },
    active: { type: Boolean, default: true },
    createdBy: { type: String, default: "System" },
  },
  { timestamps: true },
);
schema.index({ companyId: 1, factoryId: 1, fabricCode: 1 }, { unique: true });
export default mongoose.model("FabricMaster", schema);
