import mongoose from "mongoose";
import { createTenantModel } from "../config/tenantDatabase.js";

const schema = new mongoose.Schema({
  financialYear: { type: String, required: true, unique: true },
  value: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

export default createTenantModel("InvoiceSequence", schema);

