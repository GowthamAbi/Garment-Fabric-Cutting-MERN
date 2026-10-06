import "dotenv/config";
import mongoose from "mongoose";
import { EJSON } from "bson";
import { readFile, writeFile } from "node:fs/promises";
import { encryptBackup, decryptBackup } from "../src/utils/backupCrypto.js";
import { tenantDatabaseName } from "../src/config/tenantDatabase.js";

// Offline disaster-recovery tool. Never run against another company's database.
const [command, file] = process.argv.slice(2);
const companyKey = process.env.BACKUP_COMPANY_KEY;
const passphrase = process.env.BACKUP_PASSPHRASE;
if (!["export", "validate", "restore"].includes(command) || !file || !companyKey)
  throw new Error("Usage: node scripts/tenant-backup.js export|validate|restore FILE; set BACKUP_COMPANY_KEY and BACKUP_PASSPHRASE");
const databaseName = tenantDatabaseName(companyKey);
let snapshot;
if (command !== "export") {
  snapshot = EJSON.parse(decryptBackup(await readFile(file, "utf8"), passphrase));
  if (snapshot.formatVersion !== 1 || snapshot.companyKey !== companyKey || snapshot.databaseName !== databaseName)
    throw new Error("Backup workspace identity mismatch");
  if (!Array.isArray(snapshot.collections) || snapshot.collections.some(c =>
    !/^[a-z][a-z0-9_]*$/.test(c.name) || !Array.isArray(c.rows) || !Array.isArray(c.indexes)))
    throw new Error("Invalid backup manifest");
  if (new Set(snapshot.collections.map(c => c.name)).size !== snapshot.collections.length)
    throw new Error("Duplicate backup collections");
  if (command === "validate") { console.log("Backup authenticated and workspace identity validated"); process.exit(0); }
}
await mongoose.connect(process.env.MONGODB_URI);
try {
  const db = mongoose.connection.useDb(databaseName, { useCache: true }).db;
  if (command === "export") {
    // Stop writes externally before exporting: this is NOT a concurrent snapshot.
    if (process.env.BACKUP_WRITES_PAUSED !== "YES") throw new Error("Pause tenant writes and set BACKUP_WRITES_PAUSED=YES");
    const collections = [];
    for (const collection of await db.listCollections({ type: "collection" }).toArray()) {
      if (collection.name.startsWith("system.")) continue;
      const source = db.collection(collection.name);
      collections.push({ name: collection.name, rows: await source.find({}).toArray(), indexes: await source.indexes() });
    }
    if (!collections.length) throw new Error("Tenant database is empty");
    await writeFile(file, encryptBackup(EJSON.stringify({ formatVersion: 1, companyKey, databaseName,
      exportedAt: new Date(), collections }), passphrase), { mode: 0o600, flag: "wx" });
    console.log("Encrypted tenant backup created");
  } else {
    if (process.env.BACKUP_RESTORE_CONFIRMED !== companyKey) throw new Error("Set BACKUP_RESTORE_CONFIRMED to company key after review");
    if ((await db.listCollections().toArray()).length) throw new Error("Restore destination must be empty; existing data will never be overwritten");
    // Failed restores remain isolated for inspection; no automatic deletion.
    for (const collection of snapshot.collections) {
      await db.createCollection(collection.name);
      const target = db.collection(collection.name);
      if (collection.rows.length) await target.insertMany(collection.rows);
      for (const index of collection.indexes) {
        if (index.name === "_id_") continue;
        const { key, name, unique, sparse, expireAfterSeconds, partialFilterExpression, collation } = index;
        const options = Object.fromEntries(Object.entries({ name, unique, sparse, expireAfterSeconds, partialFilterExpression, collation }).filter(([,v]) => v !== undefined));
        await target.createIndex(key, options);
      }
      if (await target.countDocuments() !== collection.rows.length) throw new Error("Restored row count mismatch");
    }
    console.log("Tenant data restored. Reconcile central billing/registry before enabling login.");
  }
} finally { await mongoose.disconnect(); }
