import mongoose from "mongoose";
import { createTenantModel } from "../config/tenantDatabase.js";

const schema = new mongoose.Schema(
  {
    key: { type: String, required: true, uppercase: true, trim: true },
    value: { type: Number, default: 999 },
  },
  { timestamps: true },
);

schema.index({ companyId: 1, factoryId: 1, key: 1 }, { unique: true });

export default createTenantModel("Sequence", schema);
