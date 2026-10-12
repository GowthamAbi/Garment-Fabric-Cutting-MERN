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
    for(const path of ['/api/auth/factories','/api/erp/purchase-orders']){const r=await fetch(base+path);assert.equal(r.status,401);}
    const anonymous = await fetch(`${base}/api/erp/documents`); assert.equal(anonymous.status, 401);
    for (const [path, method] of [["customer-database", "GET"], ["customer-database", "POST"], ["customer-database/transfer", "POST"]]) {
      const denied = await fetch(`${base}/api/saas/${path}`, { method, headers: { Origin: "http://localhost:5173" } }); assert.equal(denied.status, 401);
    }
    for(const path of ["operations/dashboard","approvals","commercial","bank","workforce","departments/reconciliation","departments/marketing/analysis"]){
      const denied=await fetch(`${base}/api/erp/${path}`);assert.equal(denied.status,401);
    }
    for(const path of ["purchase-orders/000000000000000000000001/lifecycle","approvals/settings","approvals/settings/approve","approvals/escalate","approvals/000000000000000000000001/decision","departments/routing-masters","departments/boms/000000000000000000000001/approve","departments/routing-masters/000000000000000000000001/approve","departments/external-inward","departments/external-outward","departments/external-materials","departments/integrated-core-transfer","departments/external-market-observation","departments/sale","workforce/payroll-rules","workforce/payroll-preview","workforce/payslips/000000000000000000000001/accrual"]){
      const denied=await fetch(`${base}/api/erp/${path}`,{method:"POST",headers:{Origin:"http://localhost:5173","Content-Type":"application/json"},body:"{}"});assert.equal(denied.status,401);
    }
    const cors = await fetch(`${base}/api/erp/documents`, { method: "OPTIONS", headers: { Origin: "http://localhost:5173", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "idempotency-key,content-type" } });
    assert.equal(cors.status, 204); assert.ok(cors.headers.get("access-control-allow-headers").includes("Idempotency-Key"));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
