import mongoose from "mongoose";
import { controlDatabase } from "../config/tenantDatabase.js";

const schema = new mongoose.Schema({
  financialYear: { type: String, required: true, unique: true },
  value: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

const connection = controlDatabase();
export default connection.models.InvoiceSequence || connection.model("InvoiceSequence", schema);
