import mongoose from "mongoose";
import { tenantFields } from "./plugins/tenantFields.js";

const sizeOrderSchema = new mongoose.Schema(
  {
    size: { type: String, required: true, uppercase: true, trim: true },
    orderPieces: { type: Number, required: true, min: 1 },
    deliveredPieces: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const garmentPurchaseOrderSchema = new mongoose.Schema(
  {
    poNo: { type: String, required: true, uppercase: true, trim: true },
    soNo: { type: String, default: "", uppercase: true, trim: true },
    poDate: { type: Date, required: true },
    deliveryDate: { type: Date, required: true, index: true },
    buyer: { type: String, default: "", trim: true },
    itemCode: { type: String, required: true, uppercase: true, trim: true },
    itemName: { type: String, required: true, trim: true },
    itemGroup: { type: String, default: "", uppercase: true, trim: true },
    style: { type: String, default: "", uppercase: true, trim: true },
    bomNo: { type: String, default: "", uppercase: true, trim: true },
    colour: { type: String, default: "", uppercase: true, trim: true },
    deliveryMonthLabel: { type: String, required: true, uppercase: true, trim: true },
    orderType: { type: String, enum: ["REGULAR", "SPECIAL"], default: "REGULAR" },
    colourCount: { type: Number, default: 1, min: 1 },
    sizes: { type: [sizeOrderSchema], default: [] },
    orderPieces: { type: Number, required: true, min: 1 },
    deliveredPieces: { type: Number, default: 0, min: 0 },
    cuttingCompletedPieces: { type: Number, default: 0, min: 0 },
    sourceUploadBatch: { type: String, default: "MANUAL" },
    sourcePeriodFrom: Date,
    sourcePeriodTo: Date,
    status: {
      type: String,
      enum: ["OPEN", "PARTIAL", "COMPLETED", "HOLD", "CANCELLED"],
      default: "OPEN",
    },
  },
  { timestamps: true },
);

tenantFields(garmentPurchaseOrderSchema);
garmentPurchaseOrderSchema.index(
  { companyId: 1, factoryId: 1, poNo: 1, soNo: 1, itemCode: 1, deliveryMonthLabel: 1, orderType: 1 },
  { unique: true },
);

export default mongoose.model("GarmentPurchaseOrder", garmentPurchaseOrderSchema);
