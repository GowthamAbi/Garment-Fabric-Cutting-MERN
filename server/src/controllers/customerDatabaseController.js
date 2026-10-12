import Candidate from "../models/CustomerDatabaseCandidate.js";
import TenantRegistry from "../models/TenantRegistry.js";
import { getTenant } from "../utils/tenantContext.js";
import { databaseSetupEligible } from "../utils/customerDatabasePolicy.js";
import { saveCustomerDatabase, queueCustomerMigration } from "../services/customerDatabaseService.js";
import ApiError from "../utils/ApiError.js";

function companyKey(request) {
  if (!["company_owner","company_admin"].includes(request.user?.role) || !request.user.companyId || getTenant().companyKey === "platform") throw new ApiError(403, "Company administrator access required");
  return getTenant().companyKey;
}
export async function getCustomerDatabaseStatus(request, response) {
  const key = companyKey(request);
  const registry = await TenantRegistry.findOne({ companyKey: key }).lean();
  if (!registry) throw new ApiError(404, "Company workspace missing");
  // Explicit allowlist: URI, encrypted secret and consent record never leave server.
  const candidate = await Candidate.findOne({ companyKey: key }).select("state databaseName validatedAt activatedAt lastError migrationSummary").lean();
  response.json({ routing: registry.databaseRoutingState || "PLATFORM", eligible: databaseSetupEligible(registry), trialEndsAt: registry.trialEndsAt || new Date(new Date(registry.createdAt).getTime() + 7 * 86400000), encryptionConfigured: /^[a-f0-9]{64}$/i.test(process.env.TENANT_CREDENTIAL_KEY || ""), candidate: candidate || null });
}
export async function saveCustomerDatabaseConnection(request, response) {
  const key = companyKey(request);
  const result = await saveCustomerDatabase({ companyKey: key, companyId: request.user.companyId, actor: request.user.userId, ...Object.fromEntries(["connectionString", "databaseName", "consent"].map(field => [field, request.body[field]])) });
  response.status(201).json(result);
}
export async function startCustomerDatabaseTransfer(request, response) {
  const key = companyKey(request);
  if (request.body.confirmTransfer !== true) throw new ApiError(400, "Confirm transfer and temporary ERP maintenance");
  response.status(202).json(await queueCustomerMigration(key));
  // The server's tracked periodic worker picks up this durable job. Do not
  // start an untracked task after responding: shutdown must await the worker.
}
