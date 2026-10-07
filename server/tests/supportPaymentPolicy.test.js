import test from "node:test";
import assert from "node:assert/strict";
import { supportRequestAllowed } from "../src/utils/supportPolicy.js";
import { capturedPaymentMatches } from "../src/utils/paymentPolicy.js";

test("support scope allows only approved reads and rejects route tricks", () => {
  assert.equal(supportRequestAllowed("GET", "/api/reports/stock?from=2026", ["reports"]), true);
  for (const [method, path] of [["POST", "/api/reports"], ["GET", "/api/saas/backup"], ["GET", "/api/auth/users"], ["GET", "/api/reports-other"]])
    assert.equal(supportRequestAllowed(method, path, ["reports"]), false);
});
test("captured payment must match currency, amount, provider order and method", () => {
  const billing = { amount: 123.45, providerOrderId: "order_a", paymentMethod: "RAZORPAY" };
  const payment = { id: "pay_a", order_id: "order_a", amount: 12345, currency: "INR", status: "captured" };
  assert.equal(capturedPaymentMatches(payment, billing), true);
  for (const patch of [{amount:1}, {currency:"USD"}, {order_id:"order_b"}, {status:"authorized"}, {id:""}])
    assert.equal(capturedPaymentMatches({...payment,...patch}, billing), false);
});
