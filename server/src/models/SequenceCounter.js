import mongoose from "mongoose";
import { tenantFields } from "./plugins/tenantFields.js";

const sequenceCounterSchema = new mongoose.Schema(
  {
    sequenceName: { type: String, required: true, uppercase: true, trim: true },
    currentValue: { type: Number, default: 999, min: 0 },
  },
  { timestamps: true },
);

tenantFields(sequenceCounterSchema);
sequenceCounterSchema.index(
  { companyId: 1, factoryId: 1, sequenceName: 1 },
  { unique: true },
);

export default mongoose.model("SequenceCounter", sequenceCounterSchema);
