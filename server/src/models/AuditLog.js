import mongoose from "mongoose";
import { createTenantModel } from "../config/tenantDatabase.js";

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorName: String,
    actorUserId: String,
    actorRole: String,
    method: String,
    path: String,
    action: String,
    entity: String,
    entityId: String,
    statusCode: Number,
    ip: String,
    userAgent: String,
    changes: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true, versionKey: false },
);

auditLogSchema.index({ companyId: 1, createdAt: -1 });
auditLogSchema.index({ companyId: 1, entity: 1, entityId: 1 });
export default createTenantModel("AuditLog", auditLogSchema);
