import "dotenv/config";
import mongoose from "mongoose";
import crypto from "node:crypto";

const apply = process.argv.includes("--apply");
const legacyDatabaseName = process.env.LEGACY_DB_NAME;
const controlDatabaseName = process.env.CONTROL_DB_NAME || "ugs_control";
const prefix = process.env.TENANT_DB_PREFIX || "ugs_tenant_";

if (!process.env.MONGODB_URI || !legacyDatabaseName) {
  throw new Error("MONGODB_URI and LEGACY_DB_NAME are required");
}

const slug = (value) => String(value || "company")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

await mongoose.connect(process.env.MONGODB_URI);
const legacy = mongoose.connection.useDb(legacyDatabaseName, { useCache: true }).db;
const control = mongoose.connection.useDb(controlDatabaseName, { useCache: true }).db;
const companies = await legacy.collection("companies").find({}).toArray();
const collections = await legacy.listCollections().toArray();

console.log(`${apply ? "APPLY" : "DRY RUN"}: ${companies.length} companies, ${collections.length} collections`);

for (const company of companies) {
  let companyKey = slug(company.companyName);
  const duplicate = await control.collection("tenantregistries").findOne({
    companyKey: new RegExp(`^${escapeRegex(companyKey)}(?:-\\d+)?$`),
  });
  if (duplicate && String(duplicate._id) !== String(company._id))
    companyKey = `${companyKey}-${crypto.randomInt(1000, 10000)}`;
  const databaseName = `${prefix}${companyKey.replace(/-/g, "_")}`;
  console.log(`\n${company.companyName} -> ${databaseName} -> /c/${companyKey}/login`);
  if (!apply) continue;

  const target = mongoose.connection.useDb(databaseName, { useCache: true }).db;
  await target.collection("companies").replaceOne(
    { _id: company._id },
    { ...company, retentionLock: true },
    { upsert: true },
  );

  for (const { name } of collections) {
    if (["companies", "system.version"].includes(name)) continue;
    const rows = await legacy.collection(name).find({ companyId: company._id }).toArray();
    if (!rows.length) continue;
    if (name === "users") {
      rows.forEach((row, index) => {
        if (row.userId) return;
        const dept = String(row.department || row.role || "USR").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3).padEnd(3, "X");
        const who = String(row.name || "USR").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3).padEnd(3, "X");
        row.userId = `UGS-${dept}-${who}-${String(1000 + index).slice(-4)}`;
        row.emailVerified = true;
        row.accountStatus = row.active === false ? "DISABLED" : "ACTIVE";
      });
    }
    const operations = rows.map((row) => ({
      replaceOne: { filter: { _id: row._id }, replacement: row, upsert: true },
    }));
    await target.collection(name).bulkWrite(operations, { ordered: false });
    const copied = await target.collection(name).countDocuments({ companyId: company._id });
    if (copied < rows.length) throw new Error(`Verification failed for ${company.companyName}/${name}`);
    console.log(`  ${name}: ${rows.length} copied and verified`);
  }

  await control.collection("tenantregistries").updateOne(
    { companyKey },
    { $set: {
      companyKey,
      companyName: company.companyName,
      databaseName,
      loginPath: `/c/${companyKey}/login`,
      status: company.active === false ? "SUSPENDED" : "ACTIVE",
      subscriptionPlan: company.subscriptionPlan || "Trial",
      subscriptionEndsAt: company.subscriptionEndsAt,
      dataOwner: "CUSTOMER",
      ownerDataAccess: false,
      retentionLock: true,
      updatedAt: new Date(),
    }, $setOnInsert: { createdAt: new Date(), createdBy: "Migration" } },
    { upsert: true },
  );
}

console.log(apply
  ? "\nMigration complete. The legacy database was not deleted."
  : "\nDry run complete. Re-run with --apply only after taking an Atlas snapshot.");
await mongoose.disconnect();

