import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import mongoose from "mongoose";
import { databaseSetupEligible, canonicalDatabaseRecord, targetFingerprint } from "../src/utils/customerDatabasePolicy.js";
import { createTenantModel, currentDatabase, databaseForName, registerCustomerConnection } from "../src/config/tenantDatabase.js";
import { runWithTenant, getTenant } from "../src/utils/tenantContext.js";
import { enterOperationalDatabase } from "../src/middleware/customerDatabaseMiddleware.js";
import { getCustomerDatabaseStatus } from "../src/controllers/customerDatabaseController.js";
import { migrateCandidate, validateCandidateAccess, queueCustomerMigration } from "../src/services/customerDatabaseService.js";
import { sealDatabaseUri } from "../src/utils/customerDatabaseSecret.js";
import Candidate from "../src/models/CustomerDatabaseCandidate.js";
import TenantRegistry from "../src/models/TenantRegistry.js";

const query = value => ({ lean: async () => value, select() { return this; } });

test("transfer waits for the full 7 days and invalid dates cannot enable it", () => {
  const registry = { createdAt: new Date("2026-10-01T10:00:00Z") };
  assert.equal(databaseSetupEligible(registry, new Date("2026-10-08T09:59:59Z")), false);
  assert.equal(databaseSetupEligible(registry, new Date("2026-10-08T10:00:00Z")), true);
  assert.equal(databaseSetupEligible({ createdAt: "invalid" }), false);
  assert.equal(databaseSetupEligible({ ...registry, trialEndsAt: "2026-10-10T10:00:00Z" }, new Date("2026-10-09")), false);
});
test("migration checksum preserves BSON identity and ignores field order", () => {
  const id = new mongoose.Types.ObjectId();
  assert.equal(canonicalDatabaseRecord({ _id: id, nested: { b: 2, a: 1 }, date: new Date(0) }), canonicalDatabaseRecord({ date: new Date(0), nested: { a: 1, b: 2 }, _id: id }));
  assert.notEqual(canonicalDatabaseRecord({ _id: id }), canonicalDatabaseRecord({ _id: String(id) }));
  assert.notEqual(canonicalDatabaseRecord({ qty: 1 }), canonicalDatabaseRecord({ qty: 2 }));
  assert.equal(targetFingerprint("CLUSTER.mongodb.net", "erp"), targetFingerprint("cluster.mongodb.net", "erp"));
  assert.notEqual(targetFingerprint("cluster.mongodb.net", "erp"), targetFingerprint("cluster.mongodb.net", "other"));
});
test("operational routing has no platform fallback and isolates companies; identity stays on billing client", () => {
  const fake = { readyState: 1, name: "customer-one", models: { Plan4Routing: { marker: "own-cluster" } } };
  registerCustomerConnection("routing-company", "binding-one", fake);
  const operational = createTenantModel("Plan4Routing", new mongoose.Schema({}));
  const identity = createTenantModel("User", new mongoose.Schema({}));
  runWithTenant({ companyKey: "routing-company", databaseName: "ugs_tenant_routing_company", customerDatabaseId: "binding-one" }, () => {
    assert.equal(currentDatabase(), fake);
    assert.equal(operational.marker, "own-cluster");
    assert.equal(identity.db, databaseForName("ugs_tenant_routing_company"));
  });
  assert.throws(() => runWithTenant({ companyKey: "other-company", databaseName: "ugs_tenant_other_company", customerDatabaseId: "binding-one" }, currentDatabase), /unavailable/);
});
test("request gate blocks migration admission, releases exactly once and supplies customer context", async () => {
  const originalFind = TenantRegistry.findOneAndUpdate, originalUpdate = TenantRegistry.updateOne;
  const ctx = { companyKey: "gate-company", databaseName: "ugs_tenant_gate_company" };
  const connection = { readyState: 1 };
  registerCustomerConnection("gate-company", "gate-binding", connection);
  let releases = 0, mode = "blocked", entered;
  TenantRegistry.findOneAndUpdate = filter => { assert.equal(filter.databaseRoutingState.$ne, "MIGRATING"); return query(mode === "blocked" ? null : { _id: "registry", ...ctx, databaseRoutingState: "CUSTOMER", customerDatabaseId: "gate-binding" }); };
  TenantRegistry.updateOne = async () => { releases++; };
  try {
    const blocked = new EventEmitter(); let error;
    await runWithTenant(ctx, () => enterOperationalDatabase({ user: { role: "company_admin" } }, blocked, e => { error = e; }));
    assert.equal(error.statusCode, 503); assert.equal(releases, 0);
    mode = "active"; const response = new EventEmitter(), request = { user: { role: "company_admin" } };
    await runWithTenant(ctx, () => enterOperationalDatabase(request, response, e => { assert.equal(e, undefined); entered = getTenant(); }));
    assert.equal(entered.customerDatabaseId, "gate-binding");
    response.emit("finish"); response.emit("finish");
    await new Promise(resolve => setImmediate(resolve)); assert.equal(releases, 1);
    const closed = new EventEmitter();
    await runWithTenant(ctx, () => enterOperationalDatabase({ user: { role: "company_admin" } }, closed, () => {}));
    closed.emit("close"); await new Promise(resolve => setImmediate(resolve));
    assert.equal(releases, 1, "premature socket closure must not unlock a possible database writer");
  } finally { TenantRegistry.findOneAndUpdate = originalFind; TenantRegistry.updateOne = originalUpdate; }
});
test("connection status is company-admin-only and query excludes credential envelopes", async () => {
  const oldRegistry = TenantRegistry.findOne, oldCandidate = Candidate.findOne;
  TenantRegistry.findOne = filter => { assert.equal(filter.companyKey, "status-company"); return query({ createdAt: new Date(0), databaseRoutingState: "PLATFORM" }); };
  Candidate.findOne = filter => {
    assert.equal(filter.companyKey, "status-company");
    return { select(fields) { assert.ok(!fields.includes("encryptedUri")); assert.ok(!fields.includes("atlasHost")); return query({ state: "VALIDATED_PENDING_MIGRATION", databaseName: "customer_erp" }); } };
  };
  try {
    let payload;
    await runWithTenant({ companyKey: "status-company" }, () => getCustomerDatabaseStatus({ user: { role: "company_admin", companyId: "company" } }, { json(value) { payload = value; } }));
    assert.equal(payload.candidate.databaseName, "customer_erp"); assert.equal(payload.eligible, true);
    for (const role of ["saas_super_admin", "admin", "store", "support_viewer"]) await assert.rejects(() => getCustomerDatabaseStatus({ user: { role, companyId: "company" } }, {}), { statusCode: 403 });
  } finally { TenantRegistry.findOne = oldRegistry; Candidate.findOne = oldCandidate; }
});

function memoryDatabase(initial = {}) {
  const rows = new Map(Object.entries(initial).map(([name, values]) => [name, [...values]]));
  const indexes = [];
  const db = {
    rows, indexes,
    listCollections() { return { toArray: async () => [...rows.keys()].map(name => ({ name })) }; },
    collection(name) {
      const all = () => rows.get(name) || [];
      return {
        find() { return { sort() { const values = [...all()].sort((a, b) => String(a._id).localeCompare(String(b._id))); return { async *[Symbol.asyncIterator]() { yield* values; } }; } }; },
        findOne: async filter => all().find(row => String(row._id) === String(filter._id)) || null,
        insertMany: async values => { if (!rows.has(name)) rows.set(name, []); for (const value of values) { if (all().some(row => String(row._id) === String(value._id))) throw Object.assign(new Error("duplicate"), { code: 11000 }); rows.get(name).push({ ...value }); } },
        listIndexes: () => ({ toArray: async () => [{ name: "_id_", key: { _id: 1 } }, { name: "companyId_1", key: { companyId: 1 }, v: 2 }] }),
        createIndex: async (key, options) => { indexes.push({ name, key, options }); },
      };
    },
  };
  return db;
}

test("migration copies, verifies and resumes matching rows; corrupt or foreign data cannot cut over", async () => {
  const companyKey = "migration-company", databaseName = "ugs_tenant_migration_company", companyId = new mongoose.Types.ObjectId(), id = new mongoose.Types.ObjectId();
  createTenantModel("Plan4MigrationRecord", new mongoose.Schema({ qty: Number }, { collection: "plan4records" }));
  const sourceConnection = databaseForName(databaseName), oldDb = sourceConnection.db;
  const originals = { find: TenantRegistry.findOne, update: TenantRegistry.updateOne, candidateUpdate: Candidate.updateOne, connect: mongoose.createConnection, session: mongoose.startSession };
  const oldKey = process.env.TENANT_CREDENTIAL_KEY; process.env.TENANT_CREDENTIAL_KEY = "ab".repeat(32);
  const candidate = { _id: id, companyKey, companyId, databaseName: "customer_erp", encryptedUri: sealDatabaseUri("mongodb+srv://user:pass@cluster.example.mongodb.net/customer_erp", companyKey) };
  const row = { _id: new mongoose.Types.ObjectId(), companyId, qty: 12 };
  const source = memoryDatabase({ plan4records: [row] }); sourceConnection.db = source;
  let destination, switched = 0, closed = 0;
  TenantRegistry.findOne = () => query({ _id: "registry", companyKey, databaseName, databaseRoutingState: "MIGRATING", operationalRequests: 0 });
  TenantRegistry.updateOne = async (_filter, update) => { assert.equal(update.$set.databaseRoutingState, "CUSTOMER"); switched++; return { matchedCount: 1 }; };
  Candidate.updateOne = async (_filter, update) => { assert.equal(update.$set.state, "ACTIVE"); assert.equal(update.$set.migrationSummary[0].count, 1); return { matchedCount: 1 }; };
  mongoose.startSession = async () => ({ withTransaction: async callback => callback(), endSession: async () => {} });
  mongoose.createConnection = () => {
    const conn = { db: destination, models: {}, on() {}, asPromise: async () => conn, close: async () => { closed++; }, model() { return { createCollection: async () => { if (!destination.rows.has("plan4records")) destination.rows.set("plan4records", []); }, createIndexes: async () => {} }; } };
    return conn;
  };
  const empty = () => memoryDatabase({ _ugs_connection_check: [{ _id: "ownership", companyKey }] });
  try {
    destination = empty(); await migrateCandidate(candidate);
    assert.equal(switched, 1); assert.deepEqual(destination.rows.get("plan4records"), [row]); assert.equal(destination.indexes.length, 1);
    // A restart can safely compare and retain previously copied matching rows.
    await migrateCandidate(candidate); assert.equal(switched, 2); assert.equal(destination.rows.get("plan4records").length, 1);
    destination = empty(); destination.rows.set("plan4records", [{ ...row, qty: 99 }]);
    await assert.rejects(() => migrateCandidate(candidate), /differs/); assert.equal(switched, 2); assert.equal(source.rows.get("plan4records")[0].qty, 12);
    destination = empty(); source.rows.set("plan4records", [{ ...row, companyId: new mongoose.Types.ObjectId() }]);
    await assert.rejects(() => migrateCandidate(candidate), /Foreign-company/); assert.equal(switched, 2);
    assert.equal(closed, 4);
  } finally {
    sourceConnection.db = oldDb; TenantRegistry.findOne = originals.find; TenantRegistry.updateOne = originals.update; Candidate.updateOne = originals.candidateUpdate; mongoose.createConnection = originals.connect; mongoose.startSession = originals.session;
    if (oldKey === undefined) delete process.env.TENANT_CREDENTIAL_KEY; else process.env.TENANT_CREDENTIAL_KEY = oldKey;
  }
});
test("target ownership, emptiness and transaction support are checked before saving", async () => {
  const candidate = { companyKey: "own-company", _id: "candidate" };
  const foreign = memoryDatabase({ _ugs_connection_check: [{ _id: "ownership", companyKey: "other-company" }] });
  await assert.rejects(() => validateCandidateAccess(candidate, { db: foreign }), { statusCode: 409 });
  const existing = memoryDatabase({ customers: [{ _id: "record" }] });
  await assert.rejects(() => validateCandidateAccess(candidate, { db: existing }), { statusCode: 409 });
});
test("queue denies early transfer without changing registry or candidate", async () => {
  const old = TenantRegistry.findOne;
  TenantRegistry.findOne = () => query({ createdAt: new Date(), databaseRoutingState: "PLATFORM" });
  try { await assert.rejects(() => queueCustomerMigration("early-company"), { statusCode: 409 }); }
  finally { TenantRegistry.findOne = old; }
});

test("queue publishes candidate and maintenance in one transaction; busy ERP aborts admission", async () => {
  const originals = { find: TenantRegistry.findOne, registryUpdate: TenantRegistry.findOneAndUpdate, candidateUpdate: Candidate.findOneAndUpdate, startSession: mongoose.startSession };
  let busy = true, ended = 0, transactionActive = false, commits = 0;
  const session = { endSession: async () => { ended++; }, withTransaction: async callback => {
    transactionActive = true;
    try { await callback(); commits++; } finally { transactionActive = false; }
  } };
  TenantRegistry.findOne = () => query({ _id: "registry", trialEndsAt: new Date(0) });
  mongoose.startSession = async () => session;
  Candidate.findOneAndUpdate = async (filter, _update, options) => {
    assert.equal(transactionActive, true); assert.equal(options.session, session);
    assert.equal(filter.targetFingerprint.$exists, true); return { _id: "candidate" };
  };
  TenantRegistry.findOneAndUpdate = async (filter, update, options) => {
    assert.equal(transactionActive, true); assert.equal(options.session, session);
    assert.equal(filter.$and[1].$or[0].operationalRequests, 0);
    assert.equal(update.$set.databaseRoutingState, "MIGRATING");
    return busy ? null : { _id: "registry" };
  };
  try {
    await assert.rejects(() => queueCustomerMigration("queue-company"), { statusCode: 409 }); assert.equal(commits, 0);
    busy = false; assert.ok((await queueCustomerMigration("queue-company")).message.includes("queued")); assert.equal(commits, 1); assert.equal(ended, 2);
  } finally { TenantRegistry.findOne = originals.find; TenantRegistry.findOneAndUpdate = originals.registryUpdate; Candidate.findOneAndUpdate = originals.candidateUpdate; mongoose.startSession = originals.startSession; }
});
