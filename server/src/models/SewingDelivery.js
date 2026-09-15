import mongoose from "mongoose";

const sewingDeliverySchema = new mongoose.Schema(
  {
    deliveryNo: { type: String, required: true, unique: true },
    outwardNo: { type: String, required: true, uppercase: true },
    sewingName: { type: String, required: true },
    deliveryPerson: { type: String, required: true },
    colour: { type: String, required: true, uppercase: true },
    size: { type: String, required: true, uppercase: true },
    quantity: { type: Number, required: true, min: 1 },
    partialDelivery: { type: Boolean, default: false },
    incompleteReason: { type: String, default: "" },
    approvalUser: { type: String, default: "" },
    remarks: { type: String, default: "" },
    deliveryDate: { type: Date, default: Date.now },
    createdBy: { type: String, default: "Production User" },
  },
  { timestamps: true },
);

export default mongoose.model("SewingDelivery", sewingDeliverySchema);
