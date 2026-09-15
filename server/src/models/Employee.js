import mongoose from "mongoose";

const employeeSchema = new mongoose.Schema(
  {
    employeeCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    employeeName: { type: String, required: true, trim: true },
    department: { type: String, default: "Production" },
    skill: { type: String, default: "" },
    shift: { type: String, default: "General" },
    section: { type: String, default: "Elastic Production" },
    shift: { type: String, default: "General" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model("Employee", employeeSchema);
