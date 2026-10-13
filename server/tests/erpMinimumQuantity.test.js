import test from "node:test";
import assert from "node:assert/strict";
import { minimumQuantity, quantity } from "../src/erp/policy.js";
test("SKU threshold permits zero and defaults empty values to zero", () => {
  for (const value of [0, "0", "", null, undefined]) assert.equal(minimumQuantity(value), 0);
  assert.equal(minimumQuantity("0.001"), 0.001);
  assert.equal(minimumQuantity("12.345"), 12.345);
});
test("SKU thresholds reject negatives, precision loss and invalid inputs", () => {
  for (const value of [-1, "-0.001", "0.0001", "invalid", true]) assert.throws(() => minimumQuantity(value));
  assert.throws(() => quantity(0));
});
