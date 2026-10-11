import "dotenv/config";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { sealDatabaseUri, validateCustomerDatabase } from "../src/utils/customerDatabaseSecret.js";

export async function prepareCustomerDatabase(env = process.env) {
  const { CUSTOMER_DATABASE_URI: uri, CUSTOMER_DATABASE_NAME: databaseName, CUSTOMER_COMPANY_KEY: companyKey, CUSTOMER_CONSENT_REFERENCE: consent } = env;
  validateCustomerDatabase(uri, databaseName);
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(companyKey || "") || !consent?.trim()) throw new Error("Company key and customer consent reference are required");
  const encryptedUri = sealDatabaseUri(uri, companyKey, env.TENANT_CREDENTIAL_KEY);
  let customer;
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    const { default: TenantRegistry } = await import("../src/models/TenantRegistry.js");
    const registry = await TenantRegistry.findOne({ companyKey }).lean();
    if (!registry || registry.status !== "ACTIVE") throw new Error("An active existing company is required");
    customer = mongoose.createConnection(uri, { dbName: databaseName, serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, maxPoolSize: 2, autoIndex: false, autoCreate: false });
    await customer.asPromise();
    await customer.db.command({ ping: 1 });
    const collections = await customer.db.listCollections({}, { nameOnly: true }).toArray();
    if (collections.length) throw new Error("Customer target database must be empty; existing data will not be overwritten");
    const { default: Candidate } = await import("../src/models/CustomerDatabaseCandidate.js");
    await Candidate.init();
    await Candidate.create({ companyKey, databaseName, atlasHost: validateCustomerDatabase(uri, databaseName).host, encryptedUri, state: "VALIDATED_PENDING_MIGRATION", validatedAt: new Date(), customerConsentReference: consent.trim() });
    console.log("Customer database candidate validated. Live routing unchanged; migration and cutover are still required.");
  } finally {
    if (customer) await customer.close();
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  prepareCustomerDatabase().catch(() => {
    // Driver errors can contain connection details. Do not print them or credentials.
    console.error("Customer database preparation failed. Check configuration, Atlas permissions, target emptiness and existing candidate. Credentials were not logged.");
    process.exitCode = 1;
  });
}
