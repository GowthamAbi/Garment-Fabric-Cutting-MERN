import mongoose from "mongoose";
import { createTenantModel } from "../config/tenantDatabase.js";

const schema = new mongoose.Schema({
  codeHash: { type: String, required: true, select: false },
  scopes: [{ type: String }],
  reason: { type: String, required: true, maxlength: 500 },
  status: { type: String, enum: ["ACTIVE", "REVOKED", "EXPIRED"], default: "ACTIVE" },
  expiresAt: { type: Date, required: true },
  issuedByUserId: { type: String, required: true },
  usedByOwnerId: String,
  firstUsedAt: Date,
  revokedAt: Date,
}, { timestamps: true });

schema.index({ expiresAt: 1 });
export default createTenantModel("SupportGrant", schema);

