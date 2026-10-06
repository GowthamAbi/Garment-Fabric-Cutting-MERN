import mongoose from "mongoose";
import { createTenantModel } from "../config/tenantDatabase.js";
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
  },
  { timestamps: true },
);
export default createTenantModel("Category", schema);
