import test from "node:test";
import assert from "node:assert/strict";
import { currentDatabase } from "../src/config/tenantDatabase.js";
import { runWithTenant } from "../src/utils/tenantContext.js";

test("tenant data cannot resolve without explicit workspace context", () => {
  assert.throws(() => currentDatabase(), /Explicit workspace context/);
});

test("two explicit company contexts resolve different connections", () => {
  const a = runWithTenant({companyKey:"company-a", databaseName:"ugs_tenant_company_a"}, currentDatabase);
  const b = runWithTenant({companyKey:"company-b", databaseName:"ugs_tenant_company_b"}, currentDatabase);
  assert.notEqual(a, b);
  assert.equal(a.name, "ugs_tenant_company_a");
  assert.equal(b.name, "ugs_tenant_company_b");
});
