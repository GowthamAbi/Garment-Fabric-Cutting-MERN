import mongoose from "mongoose";
import { createTenantModel } from "../config/tenantDatabase.js";
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: String,
    email: String,
    address: String,
  },
  { timestamps: true },
);
export default createTenantModel("Supplier", schema);
