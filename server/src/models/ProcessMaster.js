import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    processType: {
      type: String,
      enum: ["COMPACTING", "DYEING"],
      required: true,
      uppercase: true,
    },
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
    createdBy: { type: String, default: "System" },
  },
  { timestamps: true },
);

schema.index(
  { companyId: 1, factoryId: 1, processType: 1, code: 1 },
  { unique: true },
);

export default mongoose.model("ProcessMaster", schema);
