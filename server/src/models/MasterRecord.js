import mongoose from "mongoose";

const masterRecordSchema = new mongoose.Schema({
  masterType: { type: String, enum: ["Vendor", "Section", "Colour", "Size", "Sewing Unit"], required: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  contact: { type: String, default: "" },
  address: { type: String, default: "" },
  gst: { type: String, default: "" },
  calculationValue: { type: Number, default: 0 },
  deliveryPerson: { type: String, default: "" },
  active: { type: Boolean, default: true },
  createdBy: { type: String, default: "Admin" },
}, { timestamps: true });

masterRecordSchema.index({ companyId: 1, factoryId: 1, masterType: 1, code: 1 }, { unique: true });
export default mongoose.model("MasterRecord", masterRecordSchema);
