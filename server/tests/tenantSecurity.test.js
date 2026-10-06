import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { tenantDatabaseName, sanitizeTenantKey } from "../src/config/tenantDatabase.js";
import { validateStrongPassword } from "../src/utils/passwordPolicy.js";

test("company keys produce isolated database names", () => {
  assert.equal(sanitizeTenantKey("ABC Garments"), "abc-garments");
  assert.equal(tenantDatabaseName("ABC Garments"), "ugs_tenant_abc_garments");
  assert.notEqual(tenantDatabaseName("ABC Garments"), tenantDatabaseName("XYZ Garments"));
});

test("strong password policy blocks weak and personal passwords", () => {
  assert.equal(validateStrongPassword("Password@123").valid, false);
  assert.equal(validateStrongPassword("Gowtham@Secure2026!", { name: "Gowtham" }).valid, false);
  assert.equal(validateStrongPassword("Violet#River942!Stone").valid, true);
});

test("tenant session, retention lock and invoice controls exist", async () => {
  const [auth, routes, invoice] = await Promise.all([
    readFile(new URL("../src/middleware/authMiddleware.js", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/index.js", import.meta.url), "utf8"),
    readFile(new URL("../src/models/SubscriptionInvoice.js", import.meta.url), "utf8"),
  ]);
  assert.match(auth, /Cross-company session blocked/);
  assert.match(auth, /payload\.databaseName/);
  assert.match(routes, /preventPermanentDeletion/);
  assert.match(invoice, /Issued invoices cannot be deleted/);
});

