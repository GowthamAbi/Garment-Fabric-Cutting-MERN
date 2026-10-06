import mongoose from "mongoose";
import { createTenantModel } from "../config/tenantDatabase.js";
const schema = new mongoose.Schema(
  {
    inwardNo: { type: String, required: true, unique: true },
    itemCode: { type: String, required: true },
    brand: { type: String, default: "" },
    description: { type: String, default: "" },
    type: { type: String, default: "" },
    colour: { type: String, default: "", uppercase: true },
    unit: { type: String, default: "MTR" },
    poNo: String,
    indentNo: { type: String, default: "" },
    quantity: { type: Number, required: true },
    balanceQty: { type: Number, required: true },
    inwardDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
export default createTenantModel("Inward", schema);
