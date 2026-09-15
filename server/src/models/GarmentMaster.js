import mongoose from "mongoose";

const garmentMasterSchema = new mongoose.Schema(
  {
    masterType: {
      type: String,
      enum: ["Buyer", "Supplier", "Fabric", "Style", "Colour", "Size", "Line", "Operation", "Machine", "Employee"],
      required: true,
    },
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    details: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

garmentMasterSchema.index(
  { companyId: 1, factoryId: 1, masterType: 1, code: 1 },
  { unique: true },
);

export default mongoose.model("GarmentMaster", garmentMasterSchema);
