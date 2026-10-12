import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";
import { tenantContext } from "../utils/tenantContext.js";
import User from "../models/User.js";
import { runWithTenant } from "../utils/tenantContext.js";
import { requestCompanyKey } from "./tenantResolver.js";
import SupportGrant from "../models/SupportGrant.js";
import { supportRequestAllowed } from "../utils/supportPolicy.js";
import AuditLog from "../models/AuditLog.js";
import TenantRegistry from "../models/TenantRegistry.js";
import {sessionIsIdle} from '../utils/sessionIdlePolicy.js';
import {enforceAccessBoundary} from './accessMiddleware.js';
import Company from '../models/Company.js';

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
    // Resolve routing from the registry, never from an old or copied JWT.
    const registry = payload.companyKey === "platform" ? null : await TenantRegistry.findOne({ companyKey: payload.companyKey }).lean();
    if (payload.companyKey !== "platform" && (!registry || !["ACTIVE", "PROVISIONING", "SUSPENDED"].includes(registry.status))) throw new Error("Company inactive");
    const resolvedDatabaseName = registry?.databaseName || process.env.CONTROL_DB_NAME || "ugs_control";

    return await runWithTenant(
      { databaseName: resolvedDatabaseName, companyKey: payload.companyKey },
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
          request.tenant = { databaseName: resolvedDatabaseName, companyKey: payload.companyKey, ...(request.operationalDatabaseEntered && registry?.databaseRoutingState === "CUSTOMER" && { customerDatabaseId: String(registry.customerDatabaseId) }) };
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
          .select("+sessionVersion +lastSessionActivityAt active role companyId factoryId permissions department accessPolicyVersion accessRoleKey accessScope assignedFactoryIds assignedWarehouseKeys assignedShopKeys")
          .lean();

        if (!activeUser?.active) throw new Error("Inactive session");
        if(payload.companyKey!=='platform'){
          const policyCompany=await Company.findById(activeUser.companyId).select('accessPolicyVersion').lean();
          if(policyCompany?.accessPolicyVersion>=1&&!(activeUser.accessPolicyVersion>=1)){activeUser.accessPolicyVersion=1;activeUser.accessScope='SELF';activeUser.permissions=[];activeUser.assignedFactoryIds=[activeUser.factoryId];}
        }
        if(activeUser.role==='company_owner'){
          const company=await Company.findById(activeUser.companyId).select('ownerUserId').lean();
          if(String(company?.ownerUserId)!==String(activeUser._id))throw new Error('Owner identity mismatch');
        }
        if(activeUser.accessPolicyVersion>=1&&activeUser.role!=='company_owner'&&!(activeUser.assignedFactoryIds||[]).map(String).includes(String(activeUser.factoryId)))throw new Error('Factory not assigned');
        if(sessionIsIdle(activeUser.lastSessionActivityAt,payload.iat))throw new Error('Inactive session expired');

        if (Number(activeUser.sessionVersion || 0) !== Number(payload.sessionVersion || 0))
          throw new Error("Revoked session");
        const version=Number(activeUser.sessionVersion||0);
        const touched=await User.updateOne({_id:activeUser._id,active:true,...(version===0?{$or:[{sessionVersion:0},{sessionVersion:{$exists:false}}]}:{sessionVersion:version})},{$set:{lastSessionActivityAt:new Date()}});
        if(!touched.matchedCount)throw new Error('Session revoked during request');

        request.user = {
          ...payload,
          role: activeUser.role,
          companyId: activeUser.companyId,
          factoryId: activeUser.factoryId,
          permissions: activeUser.permissions || [],
          department: activeUser.department || "",
          accessPolicyVersion:activeUser.accessPolicyVersion,accessRoleKey:activeUser.accessRoleKey,accessScope:activeUser.accessScope,
          assignedFactoryIds:activeUser.assignedFactoryIds,assignedWarehouseKeys:activeUser.assignedWarehouseKeys,assignedShopKeys:activeUser.assignedShopKeys,
        };
        if(activeUser.accessPolicyVersion>=1){request.accessCompany=await Company.findById(activeUser.companyId).select('enabledDepartments departmentCatalogueVersion entitlements accessPolicyVersion').lean();if(!request.accessCompany)throw new Error('Company unavailable');}
        try{enforceAccessBoundary(request);}catch(error){
          if(error instanceof ApiError&&error.statusCode===403)await AuditLog.create({companyId:activeUser.companyId,factoryId:activeUser.factoryId,actorUserId:activeUser.userId||payload.userId,actorRole:activeUser.role,method:request.method,path:request.originalUrl.split('?')[0],action:'ACCESS_DENIED',changes:{reason:error.message}});
          throw error;
        }
        request.tenant = { databaseName: resolvedDatabaseName, companyKey: payload.companyKey, ...(request.operationalDatabaseEntered && registry?.databaseRoutingState === "CUSTOMER" && { customerDatabaseId: String(registry.customerDatabaseId) }) };
        return tenantContext.run({ ...request.tenant, ...request.user }, next);
      },
    );
  } catch(error) {
    if(error instanceof ApiError)return next(error);
    next(new ApiError(401, "Your login is invalid or expired"));
  }
}
