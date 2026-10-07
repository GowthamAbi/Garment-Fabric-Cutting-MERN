import test from "node:test";
import assert from "node:assert/strict";
import { EmailOutbox, SubscriptionAction } from "../src/automation/models.js";
import TenantRegistry from "../src/models/TenantRegistry.js";
import { processEmailOutbox, processSubscriptionActions } from "../src/automation/worker.js";
import { queueInvoice, escapeHtml, retryDate } from "../src/automation/queue.js";
import { runWithTenant } from "../src/utils/tenantContext.js";
const job = extra => ({ _id: "job1", leaseToken: "lease", dedupeKey: "invoice-test", companyKey: "test-company", databaseName: "ugs_tenant_test_company", attempts: 1,
  payload: { from: "UG <noreply@example.test>", to: ["customer@example.test"], subject: "Test invoice", html: "<p>test</p>" }, ...extra });
function queueMocks(t, item) {
  let next = item; const updates = [];
  t.mock.method(EmailOutbox, "findOneAndUpdate", async () => { const result = next; next = null; return result; });
  t.mock.method(EmailOutbox, "updateOne", async (filter, update) => { updates.push({ filter, update }); return { matchedCount: 1 }; });
  return updates;
}
test("email outbox sends an immutable payload with provider idempotency key and acknowledges once", async t => {
  const item = job(), updates = queueMocks(t, item); let calls = 0;
  await processEmailOutbox(5, async (payload, key) => { calls++; assert.equal(key, "invoice-test"); assert.deepEqual(payload.to, ["customer@example.test"]); return { ok: true, json: async () => ({ id: "email_receipt" }) }; });
  assert.equal(calls, 1); assert.equal(updates.at(-1).update.$set.status, "SENT");
  assert.equal(updates.at(-1).update.$set.providerId, "email_receipt");
  assert.ok(updates[0].update.$set.firstAttemptAt);
});
test("transient email failure is retried, exhausted attempts are dead-lettered", async t => {
  const updates = queueMocks(t, job({ attempts: 8 }));
  await processEmailOutbox(1, async () => ({ ok: false, status: 503 }));
  assert.equal(updates.at(-1).update.$set.status, "DEAD");
  assert.equal(updates.at(-1).update.$set.lastError, "EmailProvider503");
});
test("ambiguous emails outside provider idempotency window are held without sending", async t => {
  const updates = queueMocks(t, job({ firstAttemptAt: new Date(Date.now() - 24 * 3600000) }));
  let sent = false; await processEmailOutbox(1, async () => { sent = true; });
  assert.equal(sent, false); assert.equal(updates.at(-1).update.$set.status, "DEAD");
});
test("invoice queue escapes HTML and retains company/factory identity", async t => {
  let recorded;
  t.mock.method(EmailOutbox, "findOneAndUpdate", async (_filter, update) => { recorded = update.$setOnInsert; return recorded; });
  await runWithTenant({ companyKey: "abc", databaseName: "ugs_tenant_abc" }, () => queueInvoice({
    _id: "invoice1", companyId: "company1", factoryId: "factory1", invoiceNumber: "<img>", grandTotal: 12, customer: { email: "bill@example.test" } }));
  assert.equal(recorded.companyKey, "abc"); assert.equal(recorded.factoryId, "factory1");
  assert.ok(recorded.payload.html.includes("&lt;img&gt;")); assert.ok(!recorded.payload.html.includes("<img>"));
  assert.equal(escapeHtml('"<&'), "&quot;&lt;&amp;"); assert.ok(retryDate(1).getTime() > Date.now());
});
test("approved cancellation stops renewal reminders without deleting company data or charging cards", async t => {
  let next = { _id: "cancel1", leaseToken: "token", companyKey: "abc", kind: "CANCEL", attempts: 1 }, registry, completed;
  t.mock.method(SubscriptionAction, "findOneAndUpdate", async () => { const value = next; next = null; return value; });
  t.mock.method(SubscriptionAction, "updateOne", async (_filter, update) => { completed = update.$set; });
  t.mock.method(TenantRegistry, "updateOne", async (_filter, update) => { registry = update.$set; });
  await processSubscriptionActions(1); assert.ok(registry.renewalCancelledAt); assert.equal(completed.status, "COMPLETED");
  assert.equal(registry.status, undefined);
});
