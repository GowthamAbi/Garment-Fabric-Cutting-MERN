import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    outwardNo: { type: String, required: true, unique: true },
    inwardNo: String,
    itemCode: { type: String, required: true },
    itemName: { type: String, default: "" },
    colour: { type: String, default: "", uppercase: true },
    dcNo: String,
    section: String,
    quantity: { type: Number, required: true },
    outwardDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
export default mongoose.model("Outward", schema);
