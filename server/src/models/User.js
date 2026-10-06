import mongoose from "mongoose";
import { createTenantModel } from "../config/tenantDatabase.js";

const userSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      immutable: true,
      validate: {
        validator: function (value) {
          return /^UGS-[A-Z]{3}-[A-Z]{3}-\d{4}$/.test(value) ||
            (this.role === "saas_super_admin" && value === "GOWTHAM2131");
        },
        message: "Invalid User ID format",
      },
    },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: Date,
    role: {
      type: String,
      enum: [
        "saas_super_admin",
        "company_admin",
        "admin",
        "store",
        "production_planner",
        "production_operator",
        "production",
        "supervisor",
        "quality",
        "maintenance",
        "sewing_coordinator",
        "fabric_admin",
        "fabric_entry",
        "cutting_admin",
        "cutting_entry",
        "accessories_admin",
        "accessories_entry",
        "elastic_admin",
        "elastic_entry",
        "stitching_admin",
        "stitching_entry",
        "delivery_admin",
        "delivery_entry",
        "management",
        "view_only",
        "department_incharge",
        "department_entry",
      ],
      default: "store",
    },
    permissions: [{ type: String }],
    department: {
      type: String,
      enum: [
        "",
        "FABRIC",
        "CUTTING",
        "ACCESSORIES",
        "ELASTIC",
        "STITCHING",
        "FINISHING",
        "PACKING",
        "DISPATCH",
        "DELIVERY",
      ],
      default: "",
      uppercase: true,
      trim: true,
    },
    active: { type: Boolean, default: true },
    accountStatus: {
      type: String,
      enum: ["INVITED", "ACTIVE", "LOCKED", "DISABLED"],
      default: "ACTIVE",
    },
    failedLoginCount: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, select: false },
    lastLoginAt: Date,
    sessionVersion: { type: Number, default: 0, select: false },
    passwordChangedAt: Date,
    passwordHistory: [{ hash: String, changedAt: Date }],
    resetPasswordToken: { type: String, default: "" },
    resetPasswordExpires: Date,
  },
  { timestamps: true },
);


export default createTenantModel("User", userSchema);
