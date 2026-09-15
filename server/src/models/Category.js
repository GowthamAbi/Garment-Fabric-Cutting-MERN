import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
  },
  { timestamps: true },
);
export default mongoose.model("Category", schema);
