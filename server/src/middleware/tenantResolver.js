import TenantRegistry from "../models/TenantRegistry.js";
import ApiError from "../utils/ApiError.js";
import { runWithTenant } from "../utils/tenantContext.js";
import { sanitizeTenantKey } from "../config/tenantDatabase.js";

export function requestCompanyKey(request) {
  const raw = request.get("x-company-key") || request.body?.companyKey || request.query?.companyKey;
  if (!raw) return "";
  try { return sanitizeTenantKey(raw); } catch { return ""; }
}

export async function resolvePublicTenant(request, _response, next) {
  try {
    const companyKey = requestCompanyKey(request) || "platform";
    if (companyKey === "platform") {
      request.tenant = { companyKey, databaseName: process.env.CONTROL_DB_NAME || "ugs_control", platform: true };
      return runWithTenant(request.tenant, next);
    }
    const registry = await TenantRegistry.findOne({ companyKey }).lean();
    if (!registry || !["ACTIVE", "PROVISIONING"].includes(registry.status))
      return next(new ApiError(404, "Company workspace was not found or is inactive"));
    request.tenant = {
      companyKey: registry.companyKey,
      databaseName: registry.databaseName,
      tenantRegistryId: registry._id,
      platform: false,
    };
    return runWithTenant(request.tenant, next);
  } catch (error) {
    next(error);
  }
}

