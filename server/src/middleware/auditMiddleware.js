import AuditLog from "../models/AuditLog.js";
import { getTenant, runWithTenant } from "../utils/tenantContext.js";

const cleanBody = (body = {}) =>
  Object.fromEntries(
    Object.entries(body).filter(
      ([key]) => !["password", "token", "adminPassword", "pendingPasswordHash", "razorpay_signature", "connectionString", "databaseUri", "encryptedUri"].includes(key),
    ),
  );

export function auditMutations(request, response, next) {
  if (
    !["POST", "PUT", "PATCH", "DELETE"].includes(request.method) ||
    !request.user
  )
    return next();
  const tenant = { ...getTenant() };
  response.on("finish", () => {
    runWithTenant(tenant, () => AuditLog.create({
      actorId: request.user.id,
      actorName: request.user.name,
      actorUserId: request.user.userId,
      actorRole: request.user.role,
      companyId: request.user.companyId,
      factoryId: request.user.factoryId,
      method: request.method,
      path: request.originalUrl.split("?")[0],
      action: `${request.method} ${request.path}`,
      entity: request.path.split("/").filter(Boolean)[1] || "unknown",
      entityId: request.params.id || "",
      statusCode: response.statusCode,
      ip: request.ip,
      userAgent: request.get("user-agent") || "",
      // Database credentials must never reach audit logs, even on failure.
      changes: request.originalUrl.startsWith("/api/saas/customer-database") ? { configurationRequest: true } : { fields: Object.keys(cleanBody(request.body)) },
    })).catch(() => console.error("Audit write failed; inspect database availability"));
  });
  next();
}
