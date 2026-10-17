import test from "node:test";
import assert from "node:assert/strict";
import {legacyDepartment,enforceAccessBoundary} from "../src/middleware/accessMiddleware.js";

const subscribed={departmentCatalogueVersion:1,enabledDepartments:["ELASTIC"],
  entitlements:{modules:["ELASTIC"],maxDepartments:1}};
const head={role:"department_incharge",accessScope:"DEPARTMENT",accessPolicyVersion:1,
  department:"ELASTIC",permissions:["department.elastic.read"]};
const staff={...head,role:"department_entry",permissions:["department.elastic.read","department.elastic.write"]};
const request=(user,method="GET",company=subscribed)=>({
  user,method,originalUrl:"/api/production/elastic-machine-summary",accessCompany:company
});
test("Elastic machine Gantt API maps to ELASTIC and is read-only to Head",()=>{
  assert.equal(legacyDepartment("/production/elastic-machine-summary"),"ELASTIC");
  assert.doesNotThrow(()=>enforceAccessBoundary(request(head)));
  assert.equal(request(head).method,"GET");
  assert.throws(()=>enforceAccessBoundary(request(head,"POST")),(error)=>error.statusCode===403);
});
test("Elastic timeline blocks unrelated departments and unsubscribed users",()=>{
  assert.doesNotThrow(()=>enforceAccessBoundary(request(staff)));
  assert.throws(()=>enforceAccessBoundary(request({...staff,department:"CUTTING"})),(e)=>e.statusCode===403);
  assert.throws(()=>enforceAccessBoundary(request(head,"GET",{...subscribed,enabledDepartments:["CUTTING"]})),(e)=>e.statusCode===403);
});
