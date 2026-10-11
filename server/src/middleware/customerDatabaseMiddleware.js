import TenantRegistry from "../models/TenantRegistry.js";
import { getTenant, runWithTenant } from "../utils/tenantContext.js";
import { ensureCustomerConnection } from "../services/customerDatabaseService.js";
import ApiError from "../utils/ApiError.js";

export async function enterOperationalDatabase(request, response, next) {
  if (request.operationalDatabaseEntered || request.user?.role === "saas_super_admin") return next();
  const tenant = getTenant();
  let registry, released = false;
  const release = async () => {
    if (!registry || released) return;
    released = true;
    await TenantRegistry.updateOne({ _id: registry._id, operationalRequests: { $gt: 0 } }, { $inc: { operationalRequests: -1 } });
  };
  try {
    // One central atomic counter serializes admission against migration lock
    // acquisition across every backend process, not only this Node process.
    registry = await TenantRegistry.findOneAndUpdate({ companyKey: tenant.companyKey, databaseRoutingState: { $ne: "MIGRATING" } }, { $inc: { operationalRequests: 1 } }, { new: true }).lean();
    if (!registry) throw Object.assign(new ApiError(503, "Company ERP is unavailable while database transfer is being verified. Login and billing remain available."), { safePublic: true });
    await ensureCustomerConnection(registry);
    request.operationalDatabaseEntered = true;
    const context = { ...tenant, ...(registry.databaseRoutingState === "CUSTOMER" && { customerDatabaseId: String(registry.customerDatabaseId) }) };
    request.tenant = { ...request.tenant, ...context };
    // Do not release on a prematurely closed socket: the handler might still
    // write. A crash leaves a conservative lock requiring operator inspection.
    response.once("finish", () => release().catch(() => console.error("Company request lock needs inspection")));
    return runWithTenant(context, next);
  } catch (error) {
    await release().catch(() => {});
    next(error);
  }
}
