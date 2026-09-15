import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    fabricCode: { type: String, required: true, uppercase: true, trim: true },
    fabricGroup: { type: String, required: true, uppercase: true, trim: true },
    itemCode: { type: String, required: true, uppercase: true, trim: true },
    itemName: { type: String, required: true, trim: true },
    compactingCode: { type: String, default: "", uppercase: true, trim: true },
    compactingName: { type: String, default: "", trim: true },
    dyeingCode: { type: String, default: "", uppercase: true, trim: true },
    dyeingName: { type: String, default: "", trim: true },
    active: { type: Boolean, default: true },
    createdBy: { type: String, default: "System" },
  },
  { timestamps: true },
);
schema.index(
  { companyId: 1, factoryId: 1, fabricCode: 1, itemCode: 1 },
  { unique: true },
);
export default mongoose.model("FabricMaster", schema);
