import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: String,
    email: String,
    address: String,
  },
  { timestamps: true },
);
export default mongoose.model("Supplier", schema);
