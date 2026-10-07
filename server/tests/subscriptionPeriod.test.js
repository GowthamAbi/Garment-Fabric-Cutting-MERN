import test from "node:test";
import assert from "node:assert/strict";
import { subscriptionPeriod } from "../src/utils/subscriptionPeriod.js";
test("renewal preserves remaining paid days", () => {
  const now = Date.UTC(2026, 9, 6);
  const future = now + 10 * 86400000;
  const result = subscriptionPeriod(future, 30, now);
  assert.equal(result.periodStart.getTime(), future);
  assert.equal(result.periodEnd.getTime(), now + 40 * 86400000);
});
test("expired and new subscriptions start now", () => {
  for (const end of [null, 1]) assert.equal(subscriptionPeriod(end, 30, 1000).periodStart.getTime(), 1000);
});
test("invalid duration or expiry cannot settle", () => {
  for (const days of [0, -1, 1.5, NaN]) assert.throws(() => subscriptionPeriod(null, days));
  assert.throws(() => subscriptionPeriod("invalid", 30));
});
