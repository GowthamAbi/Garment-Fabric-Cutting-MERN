import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";
import { tenantContext } from "../utils/tenantContext.js";
import User from "../models/User.js";
import { runWithTenant } from "../utils/tenantContext.js";
import { requestCompanyKey } from "./tenantResolver.js";
import SupportGrant from "../models/SupportGrant.js";
import { supportRequestAllowed } from "../utils/supportPolicy.js";
import AuditLog from "../models/AuditLog.js";

const SESSION_COOKIE_NAMES = ["__Host-ug_session", "ug_session"];

function readCookie(request, name) {
  const cookieHeader = request.headers.cookie || "";
  const cookie = cookieHeader
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
}

function readSessionToken(request) {
  for (const name of SESSION_COOKIE_NAMES) {
    const token = readCookie(request, name);
    if (token) return token;
  }

  const authorization = request.headers.authorization || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

export async function requireAuth(request, _response, next) {
  const token = readSessionToken(request);

  if (!token) {
    return next(new ApiError(401, "Please login to continue"));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "ug-saas-api",
      audience: "ug-saas-web",
    });
    if (!payload.databaseName || !payload.companyKey) throw new Error("Tenant-less session");
    const requestedCompanyKey = requestCompanyKey(request);
    if (requestedCompanyKey && requestedCompanyKey !== payload.companyKey)
      throw new Error("Cross-company session blocked");

    return await runWithTenant(
      { databaseName: payload.databaseName, companyKey: payload.companyKey },
      async () => {
        if (payload.supportGrantId) {
          const grant = await SupportGrant.findOne({
            _id: payload.supportGrantId,
            status: "ACTIVE",
            expiresAt: { $gt: new Date() },
          }).lean();
          if (!grant) throw new Error("Support grant expired or revoked");
          if (grant.usedByOwnerId !== payload.userId) throw new Error("Support grant owner mismatch");
          if (!supportRequestAllowed(request.method, request.originalUrl, grant.scopes))
            return next(new ApiError(403, "Request is outside customer-approved support access"));
          request.user = { ...payload, supportScopes: grant.scopes, role: "support_viewer", readOnly: true };
          request.tenant = { databaseName: payload.databaseName, companyKey: payload.companyKey };
          // Audit the read before allowing any customer-data response.
          await AuditLog.create({
            actorId: payload.id, actorUserId: payload.userId, actorName: payload.name,
            actorRole: "support_viewer", method: request.method,
            path: request.originalUrl.split("?")[0], action: "SUPPORT_READ_ATTEMPT",
            companyId: grant.companyId, factoryId: grant.factoryId,
            ip: request.ip, changes: { supportGrantId: String(grant._id) },
          });
          return tenantContext.run({ ...request.tenant, ...request.user }, next);
        }
        const activeUser = await User.findById(payload.id)
          .select("+sessionVersion active role companyId factoryId permissions department")
          .lean();

        if (!activeUser?.active) throw new Error("Inactive session");

        if (Number(activeUser.sessionVersion || 0) !== Number(payload.sessionVersion || 0))
          throw new Error("Revoked session");

        request.user = {
          ...payload,
          role: activeUser.role,
          companyId: activeUser.companyId,
          factoryId: activeUser.factoryId,
          permissions: activeUser.permissions || [],
          department: activeUser.department || "",
        };
        request.tenant = { databaseName: payload.databaseName, companyKey: payload.companyKey };
        return tenantContext.run({ ...request.tenant, ...request.user }, next);
      },
    );
  } catch {
    next(new ApiError(401, "Your login is invalid or expired"));
  }
}
