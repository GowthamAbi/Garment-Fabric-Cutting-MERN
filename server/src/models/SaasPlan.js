import mongoose from "mongoose";

const schema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  price: { type: Number, default: 0, min: 0 },
  cost: { type: Number, default: 0, min: 0 },
  setupFee: { type: Number, default: 0, min: 0 },
  taxPercent: { type: Number, default: 18, min: 0 },
  validityDays: { type: Number, default: 30, min: 1 },
  maxUsers: { type: Number, default: 5, min: 1 },
  maxDepartments: { type: Number, default: 2, min: 1 },
  modules: [{ type: String }],
  active: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model("SaasPlan", schema);
