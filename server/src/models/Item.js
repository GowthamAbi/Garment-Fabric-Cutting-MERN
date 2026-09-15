import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    itemCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    brand: { type: String, default: "" },
    description: { type: String, required: true },
    category: { type: String, required: true },
    type: { type: String, default: "" },
    colour: { type: String, default: "" },
    unit: { type: String, default: "PCS" },
    minimumQty: { type: Number, default: 0 },
    stockQty: { type: Number, default: 0 },
    sourcePoNo: { type: String, default: "", uppercase: true },
    sourceIndentNo: { type: String, default: "", uppercase: true },
  },
  { timestamps: true },
);

// The same item code can exist in different colours. Each colour is a separate
// stock/master variant inside one company and factory.
itemSchema.index(
  { companyId: 1, factoryId: 1, itemCode: 1, colour: 1 },
  { unique: true },
);

export default mongoose.model("Item", itemSchema);
