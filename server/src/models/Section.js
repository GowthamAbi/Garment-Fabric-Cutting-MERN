import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    code: { type: String, required: true, unique: true, uppercase: true },
  },
  { timestamps: true },
);
export default mongoose.model("Section", schema);
