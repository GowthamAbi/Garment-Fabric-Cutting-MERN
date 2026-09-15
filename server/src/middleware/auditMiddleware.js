import AuditLog from "../models/AuditLog.js";

const cleanBody = (body = {}) => Object.fromEntries(Object.entries(body).filter(([key]) => !["password", "token", "adminPassword"].includes(key)));

export function auditMutations(request, response, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method) || !request.user) return next();
  response.on("finish", () => {
    AuditLog.create({
      actorId: request.user.id, actorName: request.user.name, actorRole: request.user.role,
      companyId: request.user.companyId, factoryId: request.user.factoryId,
      method: request.method, path: request.originalUrl, action: `${request.method} ${request.path}`,
      entity: request.path.split("/").filter(Boolean)[1] || "unknown", entityId: request.params.id || "",
      statusCode: response.statusCode, ip: request.ip, userAgent: request.get("user-agent") || "",
      changes: cleanBody(request.body),
    }).catch((error) => console.error("Audit write failed", error.message));
  });
  next();
}
