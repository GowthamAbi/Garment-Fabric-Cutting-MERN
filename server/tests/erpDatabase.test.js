import "../src/config/mongoosePlugins.js";
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { runWithTenant } from "../src/utils/tenantContext.js";
import { databaseForName } from "../src/config/tenantDatabase.js";
import { postDocument } from "../src/erp/service.js";
import { ErpSku, ErpSettings, ErpDocument, ErpBalance, ErpEntry } from "../src/erp/models.js";

test("real replica-set: factory/company isolation, duplicate retries, concurrent issues and rollback", { skip: !process.env.TEST_MONGODB_URI }, async () => {
  // Only generated test databases are modified/dropped; never use production tenant names.
  await mongoose.connect(process.env.TEST_MONGODB_URI);
<<<<<<< HEAD
=======
  const hello = await mongoose.connection.db.command({ hello: 1 });
  assert.ok(hello.setName || hello.msg === "isdbgrid", "Use a replica set or transaction-capable sharded staging cluster");
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810
  const nonce = crypto.randomBytes(6).toString("hex");
  const companyId = new mongoose.Types.ObjectId(), factoryId = new mongoose.Types.ObjectId();
  const a = { companyKey: `test-${nonce}-a`, databaseName: `ugs_tenant_test_${nonce}_a`, companyId, factoryId, role: "company_admin" };
  const b = { ...a, companyKey: `test-${nonce}-b`, databaseName: `ugs_tenant_test_${nonce}_b`, companyId: new mongoose.Types.ObjectId() };
  try {
<<<<<<< HEAD
    const hello = await mongoose.connection.db.command({ hello: 1 });
    assert.ok(hello.setName || hello.msg === "isdbgrid", "Use a replica set or transaction-capable sharded staging cluster");
=======
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810
    for (const tenant of [a, b]) await runWithTenant(tenant, async () => {
      await ErpSku.create({ code: "RAW", name: "Test material", unit: "KG", kind: "RAW", location: "FABRIC", companyId: tenant.companyId, factoryId });
    });
    await runWithTenant(a, async () => {
      const body = { type: "OPENING", lines: [{ sku: "RAW", quantity: 10, rate: 2 }] };
      const key = crypto.randomUUID();
      const [first, duplicate] = await Promise.all([postDocument(body, key, "TEST"), postDocument(body, key, "TEST")]);
      assert.equal(String(first._id), String(duplicate._id));
      assert.equal(await ErpDocument.countDocuments(), 1);
      assert.equal((await ErpBalance.findOne()).qty, 10000);
      await assert.rejects(postDocument({ ...body, notes: "different" }, key, "TEST"), /Idempotency/);
      await ErpSettings.updateOne({ companyId, factoryId, key: "ERP" }, { $set: { enabled: true, legacyWritesLocked: true } });
      const results = await Promise.allSettled([1, 2].map(() => postDocument({ type: "WASTE", lines: [{ sku: "RAW", quantity: 7 }] }, crypto.randomUUID(), "TEST")));
      assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
      assert.equal((await ErpBalance.findOne()).qty, 3000);
      const count = await ErpDocument.countDocuments(), rows = await ErpEntry.countDocuments();
      await assert.rejects(postDocument({ type: "STOCK_TRANSFER", lines: [{ sku: "RAW", quantity: 4, target: "CUTTING" }] }, crypto.randomUUID(), "TEST"));
      assert.equal(await ErpDocument.countDocuments(), count); assert.equal(await ErpEntry.countDocuments(), rows);
      assert.equal((await ErpBalance.findOne()).qty, 3000);
      await runWithTenant({ ...a, factoryId: new mongoose.Types.ObjectId() }, async () => assert.equal(await ErpDocument.countDocuments(), 0));
    });
    await runWithTenant(b, async () => { assert.equal(await ErpDocument.countDocuments(), 0); assert.equal(await ErpBalance.countDocuments(), 0); });
  } finally {
    for (const tenant of [a, b]) await databaseForName(tenant.databaseName).dropDatabase();
    await mongoose.disconnect();
  }
});
