import mongoose from "mongoose";

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNo: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    vendorName: { type: String, default: "", trim: true },
    itemCode: { type: String, required: true, uppercase: true },
    brand: { type: String, default: "" },
    description: { type: String, default: "" },
    category: { type: String, default: "Uncategorized" },
    type: { type: String, default: "" },
    colour: { type: String, default: "" },
    unit: { type: String, default: "MTR" },
    indentNo: { type: String, default: "" },
    indentDate: Date,
    poDate: Date,
    deliveryDate: { type: Date, required: true },
    orderQty: { type: Number, required: true, min: 0 },
    inwardQty: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["Open", "Part received", "Completed", "Cancelled"],
      default: "Open",
    },
  },
  { timestamps: true },
);

// One PO can contain many items, but the same item cannot repeat in that PO.
purchaseOrderSchema.index({ poNo: 1, itemCode: 1 }, { unique: true });

purchaseOrderSchema.virtual("pendingQty").get(function () {
  return Math.max(0, this.orderQty - this.inwardQty);
});
purchaseOrderSchema.set("toJSON", { virtuals: true });

export default mongoose.model("PurchaseOrder", purchaseOrderSchema);
