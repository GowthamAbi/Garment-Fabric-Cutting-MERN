import test from "node:test";
import assert from "node:assert/strict";
import {validateLegacyWarehouseMovement} from "../src/services/legacyWarehouseMovementService.js";

test("P0: legacy warehouse only accepts positive whole-piece movements",()=>{
 const values=validateLegacyWarehouseMovement({quantity:"4",action:"complete"},"REWORK");
 assert.equal(values.qty,4);
 for(const qty of ["",null,0,-1,0.5,"1.5","NaN",true,"Infinity",1000001])
  assert.throws(()=>validateLegacyWarehouseMovement({quantity:qty,action:"complete"},"REWORK"),{statusCode:400});
});
test("P0: reject reason, conversion target and section QR are mandatory",()=>{
 assert.throws(()=>validateLegacyWarehouseMovement({quantity:2,action:"reject"},"REWORK"),{statusCode:400});
 assert.throws(()=>validateLegacyWarehouseMovement({quantity:2,action:"convert",itemName:"X"},"REWORK"),{statusCode:400});
 assert.throws(()=>validateLegacyWarehouseMovement({quantity:2,sectionCode:"!"},"DELIVER"),{statusCode:400});
 assert.equal(validateLegacyWarehouseMovement({quantity:2,sectionCode:"sec-01"},"DELIVER").sectionCode,"SEC-01");
});
test("P0: legacy scoped Warehouse route and client retry key are enforced",async()=>{
 const {readFile}=await import("node:fs/promises");
 const routes=await readFile(new URL("../src/routes/warehouse.routes.js",import.meta.url),"utf8");
 const api=await readFile(new URL("../../client/src/api/productionApi.js",import.meta.url),"utf8");
 const ui=await readFile(new URL("../../client/src/pages/production/WarehousePage.jsx",import.meta.url),"utf8");
 assert.match(routes,/strictAccess\(req.user\)/);
 assert.match(routes,/legacy stock is not factory-isolated/);
 assert.match(api,/Idempotency-Key/);
 assert.match(ui,/key: crypto.randomUUID\(\)/);
});
