import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";

// Optional real two-cluster acceptance test. Use disposable staging principals
// able to create databases with the generated test prefixes, never live users.
test("two Atlas clusters: validate, copy, cut over, transact and preserve platform identity", {
  skip: !process.env.TEST_MONGODB_URI || !process.env.TEST_CUSTOMER_MONGODB_URI,
  timeout: 180000,
}, async () => {
  const suffix = randomBytes(8).toString("hex"), companyKey = `p4-${suffix}`;
  const controlName = `ugs_p4_control_${suffix}`, sourceName = `ugs_tenant_p4_${suffix}`, targetName = `ugs_p4_customer_${suffix}`;
  process.env.CONTROL_DB_NAME = controlName;
  process.env.TENANT_CREDENTIAL_KEY = randomBytes(32).toString("hex");
  await import("../src/config/mongoosePlugins.js");
  await import("../src/app.js");
  const { default: Registry } = await import("../src/models/TenantRegistry.js");
  const { default: Candidate } = await import("../src/models/CustomerDatabaseCandidate.js");
  const { default: Company } = await import("../src/models/Company.js");
  const { runWithTenant } = await import("../src/utils/tenantContext.js");
  const { createTenantModel, databaseForName, currentDatabase } = await import("../src/config/tenantDatabase.js");
  const { saveCustomerDatabase, queueCustomerMigration, migrateCandidate, ensureCustomerConnection, connectCustomerCandidate } = await import("../src/services/customerDatabaseService.js");
  const Record = createTenantModel("Plan4IntegrationRecord", new mongoose.Schema({ qty: Number }));
  const uri = new URL(process.env.TEST_CUSTOMER_MONGODB_URI); uri.pathname = `/${targetName}`;
  let customer, company;
  try {
    await mongoose.connect(process.env.TEST_MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    await Registry.create({ companyKey, companyName: "Plan 4 integration", databaseName: sourceName, loginPath: `/c/${companyKey}/login`, status: "ACTIVE", trialEndsAt: new Date(0) });
    await runWithTenant({ companyKey, databaseName: sourceName }, async () => {
      company = await Company.create({ companyName: "Plan 4 integration", factories: [{ name: "Test", code: "TEST" }] });
      await Record.init(); await Record.create({ companyId: company._id, qty: 12 });
    });
    await saveCustomerDatabase({ companyKey, companyId: company._id, actor: "TEST-ADMIN", connectionString: uri.toString(), databaseName: targetName, consent: true });
    await queueCustomerMigration(companyKey);
    const candidate = await Candidate.findOne({ companyKey }).select("+encryptedUri").lean();
    await migrateCandidate(candidate);
    const registry = await Registry.findOne({ companyKey }).lean();
    assert.equal(registry.databaseRoutingState, "CUSTOMER");
    customer = await ensureCustomerConnection(registry);
    await runWithTenant({ companyKey, databaseName: sourceName, customerDatabaseId: String(registry.customerDatabaseId) }, async () => {
      assert.equal(currentDatabase().name, targetName);
      assert.equal((await Record.findOne().lean()).qty, 12);
      assert.equal(String((await Company.findOne().lean())._id), String(company._id));
      const session = await currentDatabase().startSession();
      try { await session.withTransaction(async () => { await Record.create([{ companyId: company._id, qty: 5 }], { session }); }); }
      finally { await session.endSession(); }
      assert.equal(await Record.countDocuments(), 2);
    });
    assert.equal(await databaseForName(sourceName).db.collection("plan4integrationrecords").countDocuments(), 1, "original source retained");
    assert.equal(await customer.db.collection("companies").countDocuments(), 0, "identity/billing metadata stays on central client");
  } finally {
    // Cleanup only generated databases owned by this exact test company.
    if (mongoose.connection.readyState === 1) {
      const candidate = await Candidate.findOne({ companyKey }).select("+encryptedUri").lean();
      if (!customer && candidate) customer = await connectCustomerCandidate(candidate).catch(() => null);
      if (customer && (await customer.db.collection("_ugs_connection_check").findOne({ _id: "ownership" }))?.companyKey === companyKey) await customer.dropDatabase();
      if (customer) await customer.close();
      const registered = await Registry.findOne({ companyKey }).lean();
      if (registered?.databaseName === sourceName) await databaseForName(sourceName).dropDatabase();
      await mongoose.connection.useDb(controlName, { useCache: true }).dropDatabase();
    }
    await mongoose.disconnect();
  }
});
