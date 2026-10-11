import { createHash } from "node:crypto";
import { EJSON } from "bson";

export function databaseSetupEligible(registry, now = new Date()) {
  const end = new Date(registry.trialEndsAt || new Date(registry.createdAt).getTime() + 7 * 86400000);
  return Number.isFinite(end.getTime()) && now >= end;
}
export function targetFingerprint(host, name) {
  return createHash("sha256").update(`${host.toLowerCase()}/${name}`).digest("hex");
}
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(k => [k, sorted(value[k])]));
  return value;
}
export function canonicalDatabaseRecord(record) {
  return JSON.stringify(sorted(EJSON.serialize(record, { relaxed: false })));
}
export function migrationFailureMessage() {
  return "Database transfer failed. Original data was retained and live routing was not changed. Check Atlas access and server migration status before retrying.";
}
