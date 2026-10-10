import test from "node:test";
import assert from "node:assert/strict";
import { companyKeyBase } from "../src/utils/companyKey.js";
import { availableCompanyKey } from "../src/services/tenantProvisioningService.js";
import TenantRegistry from "../src/models/TenantRegistry.js";

test("company display names generate valid bounded URL keys", () => {
  for (const name of ["AB", "A", "ஸ்ரீ கார்மெண்ட்ஸ்", "A".repeat(200), "---", "Sri Garments", "Élite Textiles", "a".repeat(31)+" - tail"]) {
    assert.match(companyKeyBase(name), /^[a-z0-9][a-z0-9-]{2,31}$/);
  }
  assert.equal(companyKeyBase("Sri Garments"), "sri-garments");
  assert.equal(companyKeyBase("AB"), "company-ab");
  assert.throws(() => companyKeyBase("   "), error => error.statusCode === 400);
  assert.throws(() => companyKeyBase({}), error => error.statusCode === 400);
});

test("existing company keys receive a checked unique suffix", async t => {
  t.mock.method(TenantRegistry, "exists", async ({companyKey}) => companyKey === "company-ab");
  assert.equal(await availableCompanyKey("AB"), "company-ab-2");
});
