import { createHash } from "node:crypto";
import ApiError from "./ApiError.js";
import { sanitizeTenantKey } from "../config/tenantDatabase.js";

/** Display names need not satisfy the strict workspace URL format. */
export function companyKeyBase(companyName) {
  if (typeof companyName !== "string" || !companyName.trim()) {
    throw new ApiError(400, "Company name is required");
  }
  const name = companyName.trim().normalize("NFKD");
  let slug = name.toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32).replace(/-$/g, "");
  if (!slug) slug = `company-${createHash("sha256").update(name).digest("hex").slice(0, 12)}`;
  else if (slug.length < 3) slug = `company-${slug}`;
  return sanitizeTenantKey(slug);
}
