import mongoose from "mongoose";
import { createTenantModel } from "../config/tenantDatabase.js";
const schema = new mongoose.Schema({
  sourceId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  referenceNo: { type: String, required: true },
  itemCode: { type: String, required: true },
  unit: { type: String, required: true },
  direction: { type: String, enum: ["INWARD", "OUTWARD"], required: true },
  quantity: { type: Number, required: true, min: 0.001 },
  signedQuantity: { type: Number, required: true },
  balanceAfter: { type: Number, required: true, min: 0 },
  postedAt: { type: Date, required: true },
}, { timestamps: true });
schema.pre("save", function () { if (!this.isNew) throw new Error("Stock ledger entries are immutable"); });
for (const operation of ["updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "deleteOne", "deleteMany", "findOneAndDelete"])
  schema.pre(operation, function () { throw new Error("Stock ledger entries are immutable; post a separate correction document"); });
export default createTenantModel("StockLedger", schema);
