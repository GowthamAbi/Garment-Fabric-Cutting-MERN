import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    referenceNo: { type: String, required: true, unique: true },
    kind: { type: String, enum: ["INWARD", "OUTWARD"], required: true },
    inwardReference: { type: String, default: "" },
    itemCode: { type: String, required: true, uppercase: true },
    itemName: { type: String, default: "" },
    colour: { type: String, default: "", uppercase: true },
    poNo: { type: String, default: "" },
    indentNo: { type: String, default: "" },
    dcNo: { type: String, default: "" },
    section: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 0.001 },
    balanceQty: { type: Number, required: true, min: 0 },
    transactionDate: { type: Date, default: Date.now },
    createdBy: { type: String, default: "Store User" },
  },
  { timestamps: true },
);

export default mongoose.model("Transaction", transactionSchema);
