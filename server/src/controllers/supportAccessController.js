import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import SupportGrant from "../models/SupportGrant.js";
import TenantRegistry from "../models/TenantRegistry.js";
import Company from "../models/Company.js";
import ApiError from "../utils/ApiError.js";
import { runWithTenant } from "../utils/tenantContext.js";

const allowedScopes = ["dashboard", "reports", "fabric-cutting", "production", "delivery", "items", "pos", "transactions", "warehouse", "garments", "masters"];

export async function createSupportGrant(request, response) {
  const durationHours = Math.min(24, Math.max(1, Number(request.body.durationHours) || 1));
  const scopes = [...new Set(Array.isArray(request.body.scopes) ? request.body.scopes : [])]
    .filter((scope) => allowedScopes.includes(scope));
  if (!scopes.length) throw new ApiError(400, "Select at least one support scope");
  if (!String(request.body.reason || "").trim()) throw new ApiError(400, "Support reason is required");
  const rawCode = crypto.randomBytes(24).toString("base64url");
  const grant = await SupportGrant.create({
    codeHash: crypto.createHash("sha256").update(rawCode).digest("hex"),
    scopes,
    reason: String(request.body.reason).trim(),
    expiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000),
    issuedByUserId: request.user.userId,
    companyId: request.user.companyId,
    factoryId: request.user.factoryId,
  });
  response.status(201).json({
    grantId: grant._id,
    supportCode: rawCode,
    expiresAt: grant.expiresAt,
    scopes,
    message: "Share this one-time support code with UG SaaS Owner. It is shown only now.",
  });
}

export async function listSupportGrants(_request, response) {
  response.json(await SupportGrant.find().select("-codeHash").sort({ createdAt: -1 }).lean());
}

export async function revokeSupportGrant(request, response) {
  const grant = await SupportGrant.findById(request.params.id);
  if (!grant) throw new ApiError(404, "Support grant not found");
  grant.status = "REVOKED";
  grant.revokedAt = new Date();
  await grant.save();
  response.json({ message: "Support access revoked" });
}

export async function exchangeSupportGrant(request, response) {
  const registry = await TenantRegistry.findOne({ companyKey: String(request.body.companyKey || "").toLowerCase() }).lean();
  if (!registry || registry.status !== "ACTIVE") throw new ApiError(404, "Company workspace not found");
  const codeHash = crypto.createHash("sha256").update(String(request.body.supportCode || "")).digest("hex");
  const grant = await runWithTenant(
    { companyKey: registry.companyKey, databaseName: registry.databaseName },
    () => SupportGrant.findOneAndUpdate(
      { codeHash, status: "ACTIVE", expiresAt: { $gt: new Date() }, firstUsedAt: { $exists: false } },
      { $set: { firstUsedAt: new Date(), usedByOwnerId: request.user.userId } },
      { new: true },
    ).select("+codeHash"),
  );
  if (!grant) throw new ApiError(403, "Support grant is invalid, expired or revoked");
  const company = await runWithTenant(
    { companyKey: registry.companyKey, databaseName: registry.databaseName },
    () => Company.findOne().lean(),
  );
  await runWithTenant(
    { companyKey: registry.companyKey, databaseName: registry.databaseName },
    async () => {
      grant.usedByOwnerId = request.user.userId;
      grant.firstUsedAt ||= new Date();
      await grant.save();
    },
  );
  const token = jwt.sign({
    id: request.user.id,
    userId: request.user.userId,
    name: request.user.name,
    role: "support_viewer",
    companyId: company?._id,
    factoryId: company?.factories?.[0]?._id,
    companyKey: registry.companyKey,
    databaseName: registry.databaseName,
    supportGrantId: grant._id,
    supportScopes: grant.scopes,
  }, process.env.JWT_SECRET, { expiresIn: "1h", issuer: "ug-saas-api", audience: "ug-saas-web" });
  response.json({
    token,
    expiresAt: grant.expiresAt,
    scopes: grant.scopes,
    warning: "Read-only support token. Every request is audited.",
  });
}
