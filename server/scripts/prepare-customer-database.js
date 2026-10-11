import "dotenv/config";
import "../src/config/mongoosePlugins.js";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { saveCustomerDatabase } from "../src/services/customerDatabaseService.js";
import TenantRegistry from "../src/models/TenantRegistry.js";
import Company from "../src/models/Company.js";
import { runWithTenant } from "../src/utils/tenantContext.js";

export async function prepareCustomerDatabase(env = process.env) {
  const key = env.CUSTOMER_COMPANY_KEY;
  if (!env.CUSTOMER_CONSENT_REFERENCE?.trim()) throw new Error("Customer consent reference required");
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    const registry = await TenantRegistry.findOne({ companyKey: key }).lean();
    if (!registry || !["ACTIVE", "SUSPENDED"].includes(registry.status)) throw new Error("Existing company required");
    const company = await runWithTenant({ companyKey: key, databaseName: registry.databaseName }, () => Company.findOne().lean());
    if (!company) throw new Error("Company metadata missing");
    await saveCustomerDatabase({ companyKey: key, companyId: company._id, actor: `operator:${env.CUSTOMER_CONSENT_REFERENCE.trim()}`, connectionString: env.CUSTOMER_DATABASE_URI, databaseName: env.CUSTOMER_DATABASE_NAME, consent: true });
    console.log("Customer Atlas candidate validated and encrypted. Live routing unchanged until transfer.");
  } finally { await mongoose.disconnect(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prepareCustomerDatabase().catch(() => {
    console.error("Customer database preparation failed. Check configuration, permissions, target emptiness and existing migration. Credentials were not logged.");
    process.exitCode = 1;
  });
}
