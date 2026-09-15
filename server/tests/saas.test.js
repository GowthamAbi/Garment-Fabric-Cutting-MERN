import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";

test("SaaS security, subscription, audit and backup modules exist", async () => {
  const files = [
    "src/models/AuditLog.js",
    "src/models/SubscriptionPayment.js",
    "src/middleware/securityMiddleware.js",
    "src/middleware/subscriptionMiddleware.js",
    "src/middleware/auditMiddleware.js",
    "src/controllers/saasController.js",
    "src/routes/saas.routes.js",
  ];
  await Promise.all(files.map((file) => access(new URL(`../${file}`, import.meta.url))));
  assert.equal(files.length, 7);
});
