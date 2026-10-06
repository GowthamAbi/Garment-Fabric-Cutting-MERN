import mongoose from "mongoose";
import { createTenantModel } from "../config/tenantDatabase.js";
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true, uppercase: true },
  },
  { timestamps: true },
);
export default createTenantModel("Section", schema);
