import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { calculateObjectSize } from "bson";
import Candidate from "../models/CustomerDatabaseCandidate.js";
import TenantRegistry from "../models/TenantRegistry.js";
import ApiError from "../utils/ApiError.js";
import { sealDatabaseUri, openDatabaseUri, validateCustomerDatabase } from "../utils/customerDatabaseSecret.js";
import { databaseSetupEligible, targetFingerprint, canonicalDatabaseRecord, migrationFailureMessage } from "../utils/customerDatabasePolicy.js";
import { databaseForName, customerConnection, customerConnectionCount, registerCustomerConnection, tenantSchemas, PLATFORM_TENANT_MODELS } from "../config/tenantDatabase.js";

class DatabaseSetupError extends ApiError {
  constructor(status, message) { super(status, message); this.safePublic = true; }
}

const CHECK_COLLECTION = "_ugs_connection_check";
const pendingConnections = new Map();
const connectionOptions = { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, maxPoolSize: 5, minPoolSize: 0, autoIndex: false, autoCreate: false, bufferCommands: false, tls: true, retryWrites: true, writeConcern: { w: "majority" }, readPreference: "primary", readConcern: { level: "majority" } };

export async function connectCustomerCandidate(candidate) {
  const uri = openDatabaseUri(candidate.encryptedUri, candidate.companyKey);
  validateCustomerDatabase(uri, candidate.databaseName);
  const connection = mongoose.createConnection(uri, { ...connectionOptions, dbName: candidate.databaseName });
  // Prevent driver events from leaking connection credentials in logs.
  connection.on("error", () => {});
  try { await connection.asPromise(); return connection; }
  catch { await connection.close().catch(() => {}); throw new DatabaseSetupError(503, "Customer Atlas connection unavailable. Check database user, network access and cluster availability."); }
}

export async function ensureCustomerConnection(registry) {
  if (registry.databaseRoutingState !== "CUSTOMER") return null;
  const id = String(registry.customerDatabaseId || "");
  if (!id) throw new DatabaseSetupError(503, "Customer database routing configuration is incomplete");
  const cached = customerConnection(registry.companyKey, id);
  if (cached?.readyState === 1) return cached;
  const key = `${registry.companyKey}:${id}`;
  if (pendingConnections.has(key)) return pendingConnections.get(key);
  if (!cached && customerConnectionCount() + pendingConnections.size >= Number(process.env.CUSTOMER_DB_MAX_CONNECTIONS || 100)) throw new DatabaseSetupError(503, "Customer database connection capacity reached");
  const pending = (async () => {
    const candidate = await Candidate.findOne({ _id: registry.customerDatabaseId, companyKey: registry.companyKey, state: "ACTIVE" }).select("+encryptedUri").lean();
    if (!candidate) throw new DatabaseSetupError(503, "Customer database connection is not active");
    try {
      if (cached) await cached.close().catch(() => {});
      const connection = await connectCustomerCandidate(candidate);
      try {
        // Initialize newly introduced collections/indexes before allowing
        // requests. Unique ledger/idempotency indexes must not be optional.
        for (const [name, schema] of tenantSchemas) {
          if (PLATFORM_TENANT_MODELS.has(name)) continue;
          const model = connection.models[name] || connection.model(name, schema);
          await model.createCollection();
          await model.createIndexes();
        }
      } catch { await connection.close().catch(() => {}); throw new Error("Customer schema preparation failed"); }
      registerCustomerConnection(registry.companyKey, id, connection);
      return connection;
    } catch { throw new DatabaseSetupError(503, "Customer database unavailable. Billing remains available; ERP cannot fall back to platform storage."); }
  })().finally(() => pendingConnections.delete(key));
  pendingConnections.set(key, pending);
  return pending;
}

// Validate actual read/write and transaction permissions, not only a ping.
export async function validateCandidateAccess(candidate, connection) {
  const db = connection.db;
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  const previous = await db.collection(CHECK_COLLECTION).findOne({ _id: "ownership" });
  if (collections.some(c => c.name !== CHECK_COLLECTION) || (previous && previous.companyKey !== candidate.companyKey)) {
    throw new ApiError(409, "Use an empty dedicated customer database; existing data will not be overwritten");
  }
  try {
    await db.collection(CHECK_COLLECTION).updateOne({ _id: "ownership", companyKey: candidate.companyKey }, { $setOnInsert: { companyKey: candidate.companyKey } }, { upsert: true });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "This target database is reserved by another company");
    throw error;
  }
  const session = await connection.startSession();
  try {
    session.startTransaction();
    await db.collection(CHECK_COLLECTION).insertOne({ _id: `probe-${candidate._id}`, companyKey: candidate.companyKey }, { session });
    await db.collection(CHECK_COLLECTION).deleteOne({ _id: `probe-${candidate._id}` }, { session });
    await session.abortTransaction();
  } finally { await session.endSession(); }
}

export async function saveCustomerDatabase({ companyKey, companyId, actor, connectionString, databaseName, consent }) {
  if (consent !== true) throw new ApiError(400, "Customer database ownership and transfer consent are required");
  if (typeof connectionString !== "string" || connectionString.length > 4000) throw new ApiError(400, "Valid Atlas connection string required");
  let validated, encryptedUri;
  try { validated = validateCustomerDatabase(connectionString.trim(), databaseName); }
  catch (error) { throw new ApiError(400, error.message); }
  try { encryptedUri = sealDatabaseUri(connectionString.trim(), companyKey); }
  catch { throw new DatabaseSetupError(503, "Database credential encryption is not configured. Contact the platform administrator."); }
  const registry = await TenantRegistry.findOne({ companyKey }).lean();
  if (!registry || registry.databaseRoutingState === "MIGRATING" || registry.databaseRoutingState === "CUSTOMER") throw new ApiError(409, "Database migration is running or a customer database is already active");
  await Candidate.init();
  let candidate;
  try {
    candidate = await Candidate.findOneAndUpdate({ companyKey, state: { $in: ["FAILED", "VALIDATED_PENDING_MIGRATION"] } }, { $set: {
      companyKey, companyId, requestedBy: actor, databaseName, atlasHost: validated.host,
      encryptedUri, targetFingerprint: targetFingerprint(validated.host, databaseName), state: "VALIDATING",
      validatedAt: new Date(), customerConsentReference: `${actor}:frontend-consent`, lastError: "",
    }, $unset: { migrationWorker: 1, migrationSummary: 1 } }, { new: true, upsert: true }).select("+encryptedUri");
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, "Database validation is already running or this target belongs to another company");
    throw error;
  }
  let connection;
  try {
    connection = await connectCustomerCandidate(candidate);
    await validateCandidateAccess(candidate, connection);
    await Candidate.updateOne({ _id: candidate._id, state: "VALIDATING" }, { $set: { state: "VALIDATED_PENDING_MIGRATION", validatedAt: new Date() } });
  } catch (error) {
    await Candidate.updateOne({ _id: candidate._id, state: "VALIDATING" }, { $set: { state: "FAILED", lastError: "Atlas validation failed. Check permissions, target emptiness and network access." } });
    if (error instanceof ApiError) throw error;
    throw new DatabaseSetupError(503, "Atlas validation failed. Check read/write permissions, transaction support and encryption configuration.");
  } finally { if (connection) await connection.close(); }
  return { message: "Connection validated and encrypted. Transfer can begin after the 7-day trial period; no live data has moved yet." };
}

export async function queueCustomerMigration(companyKey) {
  const registry = await TenantRegistry.findOne({ companyKey }).lean();
  if (!registry || !databaseSetupEligible(registry)) throw new ApiError(409, "Customer database transfer is available after the 7-day trial period");
  // Publish the job and its maintenance lock atomically. A polling worker must
  // never see MIGRATING before the registry has blocked operational admission.
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const candidate = await Candidate.findOneAndUpdate({ companyKey, state: "VALIDATED_PENDING_MIGRATION", companyId: { $exists: true }, targetFingerprint: { $exists: true } }, { $set: { state: "MIGRATING", lastError: "" } }, { new: true, session });
      if (!candidate) throw new ApiError(409, "Validate the customer database before transferring; another transfer may already be running");
      const locked = await TenantRegistry.findOneAndUpdate({ _id: registry._id, databaseRoutingState: { $ne: "CUSTOMER" }, $and: [
        { databaseRoutingState: { $ne: "MIGRATING" } }, { $or: [{ operationalRequests: 0 }, { operationalRequests: { $exists: false } }] },
      ] }, { $set: { databaseRoutingState: "MIGRATING", operationalRequests: 0 } }, { new: true, session });
      if (!locked) throw new ApiError(409, "ERP requests are still running. Close other ERP screens and retry. If the server restarted during a request, an administrator must inspect the request lock.");
    });
  } finally { await session.endSession(); }
  return { message: "Transfer queued. ERP is temporarily unavailable while original data is copied and verified; login and billing remain available." };
}

async function digestCollection(collection) {
  const hash = createHash("sha256"); let count = 0;
  for await (const row of collection.find({}).sort({ _id: 1 })) { hash.update(canonicalDatabaseRecord(row) + "\n"); count++; }
  return { count, hash: hash.digest("hex") };
}

export async function migrateCandidate(candidate) {
  let target;
  const registry = await TenantRegistry.findOne({ companyKey: candidate.companyKey, databaseRoutingState: "MIGRATING" }).lean();
  if (!registry) throw new Error("Migration registry lock missing");
  try {
    target = await connectCustomerCandidate(candidate);
    const ownership = await target.db.collection(CHECK_COLLECTION).findOne({ _id: "ownership" });
    if (ownership?.companyKey !== candidate.companyKey) throw new Error("Target ownership marker missing");
    const source = databaseForName(registry.databaseName).db;
    const centralCollections = new Set([...PLATFORM_TENANT_MODELS].map(name => mongoose.pluralize()(name)));
    const schemasByCollection = new Map([...tenantSchemas].filter(([name]) => !PLATFORM_TENANT_MODELS.has(name)).map(([name, schema]) => [schema.options.collection || mongoose.pluralize()(name), [name, schema]]));
    const sourceCollections = (await source.listCollections({}, { nameOnly: true }).toArray()).filter(c => !centralCollections.has(c.name) && !c.name.startsWith("system."));
    const sourceNames = new Set(sourceCollections.map(c => c.name));
    const collections = [...new Set([...sourceNames, ...schemasByCollection.keys()])].map(name => ({ name }));
    const allowed = new Set(collections.map(c => c.name));
    for (const c of await target.db.listCollections({}, { nameOnly: true }).toArray()) {
      if (c.name !== CHECK_COLLECTION && !allowed.has(c.name)) throw new Error("Unexpected target collection");
    }
    const summary = [];
    for (const { name } of collections) {
      if (!schemasByCollection.has(name)) throw new Error("Unregistered source collection requires review");
      const from = source.collection(name), to = target.db.collection(name);
      const [modelName, schema] = schemasByCollection.get(name);
      const model = target.models[modelName] || target.model(modelName, schema);
      await model.createCollection();
      let batch = [], batchBytes = 0;
      for await (const row of from.find({}).sort({ _id: 1 })) {
        if (row.companyId && String(row.companyId) !== String(candidate.companyId)) throw new Error("Foreign-company source row blocked");
        // Insert only: no replacement/deletion of existing target records. A
        // crashed copy resumes by comparing already copied records bytewise.
        const existing = await to.findOne({ _id: row._id });
        if (existing) {
          if (canonicalDatabaseRecord(existing) !== canonicalDatabaseRecord(row)) throw new Error("Target row differs from original");
        } else { batch.push(row); batchBytes += calculateObjectSize(row); }
        if (batch.length >= 200 || batchBytes >= 4 * 1024 * 1024) { await to.insertMany(batch, { ordered: true }); batch = []; batchBytes = 0; }
      }
      if (batch.length) await to.insertMany(batch, { ordered: true });
      // Rebuild schema indexes, preserve legacy source indexes too.
      await model.createIndexes();
      for (const index of sourceNames.has(name) ? await from.listIndexes().toArray() : []) {
        if (index.name === "_id_") continue;
        const { key, v: _version, ns: _namespace, ...options } = index;
        await to.createIndex(key, options);
      }
      const original = await digestCollection(from), copied = await digestCollection(to);
      if (original.count !== copied.count || original.hash !== copied.hash) throw new Error("Migration content verification failed");
      summary.push({ collection: name, ...copied });
    }
    // The destination is ready before central routing changes. Both records
    // switch together in a central-only transaction; customer data is immutable
    // during this phase because the distributed request gate is locked.
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const updated = await Candidate.updateOne({ _id: candidate._id, state: "MIGRATING" }, { $set: { state: "ACTIVE", activatedAt: new Date(), migrationSummary: summary, lastError: "" } }, { session });
        if (updated.matchedCount !== 1) throw new Error("Candidate state changed");
        const cutover = await TenantRegistry.updateOne({ _id: registry._id, databaseRoutingState: "MIGRATING", operationalRequests: 0 }, { $set: { databaseRoutingState: "CUSTOMER", customerDatabaseId: candidate._id } }, { session });
        if (cutover.matchedCount !== 1) throw new Error("Migration lock changed");
      });
    } finally { await session.endSession(); }
  } finally { if (target) await target.close(); }
}

let localWorker = false;
export async function processCustomerMigrations() {
  if (localWorker) return;
  localWorker = true;
  try {
    const candidates = await Candidate.find({ state: "MIGRATING" }).select("+encryptedUri").limit(10).lean();
    for (const candidate of candidates) {
      // Server deployments can have multiple workers. Use an explicit durable
      // lease; never steal one while its process may still be copying data.
      const claimed = await Candidate.collection.updateOne({ _id: candidate._id, state: "MIGRATING", migrationWorker: { $exists: false } }, { $set: { migrationWorker: { pid: process.pid, startedAt: new Date() } } });
      if (!claimed.modifiedCount) continue;
      try { await migrateCandidate(candidate); }
      catch {
        // Keep the maintenance lock on failure. A partially copied database is
        // never served; an operator must inspect and resume or cancel safely.
        await Candidate.updateOne({ _id: candidate._id, state: "MIGRATING" }, { $set: { lastError: migrationFailureMessage() } });
      }
    }
  } finally { localWorker = false; }
}
