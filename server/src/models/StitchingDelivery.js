import mongoose from "mongoose";

const stitchingDeliverySchema = new mongoose.Schema(
  {
    deliveryNo: { type: String, required: true, unique: true, uppercase: true },
    dcNo: { type: String, required: true, uppercase: true },
    bundleNo: { type: String, required: true, uppercase: true },
    sectionName: { type: String, required: true },
    deliveryPerson: { type: String, required: true },
    itemName: { type: String, required: true },
    style: { type: String, required: true, uppercase: true },
    colour: { type: String, required: true, uppercase: true },
    size: { type: String, required: true, uppercase: true },
    quantity: { type: Number, required: true, min: 1 },
    remarks: { type: String, default: "" },
    deliveryDate: { type: Date, default: Date.now },
    createdBy: { type: String, default: "Stitching User" },
  },
  { timestamps: true },
);

stitchingDeliverySchema.index({ companyId: 1, factoryId: 1, dcNo: 1, deliveryDate: -1 });
export default mongoose.model("StitchingDelivery", stitchingDeliverySchema);
