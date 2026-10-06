import test from "node:test";
import assert from "node:assert/strict";
import app from "../src/app.js";
test("HTTP liveness, readiness, anonymous ERP denial and idempotency CORS header", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.on("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const health = await fetch(`${base}/health`); assert.equal(health.status, 200);
    assert.equal((await health.json()).success, true);
    const ready = await fetch(`${base}/ready`); assert.equal(ready.status, 503);
    const anonymous = await fetch(`${base}/api/erp/documents`); assert.equal(anonymous.status, 401);
    const cors = await fetch(`${base}/api/erp/documents`, { method: "OPTIONS", headers: { Origin: "http://localhost:5173", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "idempotency-key,content-type" } });
    assert.equal(cors.status, 204); assert.ok(cors.headers.get("access-control-allow-headers").includes("Idempotency-Key"));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
