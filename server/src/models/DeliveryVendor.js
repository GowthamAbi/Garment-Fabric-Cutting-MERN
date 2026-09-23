import mongoose from "mongoose";

const schema = new mongoose.Schema({
  vendorCode: { type: String, required: true, uppercase: true, trim: true },
  vendorName: { type: String, required: true, trim: true },
  address: { type: String, default: "", trim: true },
  qcName: { type: String, default: "", trim: true },
  stitchingItems: { type: [String], default: [] },
  active: { type: Boolean, default: true },
  createdBy: String,
}, { timestamps: true });
schema.index({ companyId: 1, factoryId: 1, vendorCode: 1 }, { unique: true });
export default mongoose.model("DeliveryVendor", schema);
