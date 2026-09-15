import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: [
        "saas_super_admin", "company_admin", "admin", "store",
        "production_planner", "production_operator", "production",
        "supervisor", "quality", "maintenance", "sewing_coordinator",
        "fabric_admin", "fabric_entry", "cutting_admin", "cutting_entry",
        "accessories_admin", "accessories_entry", "elastic_admin", "elastic_entry",
        "stitching_admin", "stitching_entry", "management", "view_only",
      ],
      default: "store",
    },
    permissions: [{ type: String }],
    active: { type: Boolean, default: true },
    resetPasswordToken: { type: String, default: "" },
    resetPasswordExpires: Date,
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);
