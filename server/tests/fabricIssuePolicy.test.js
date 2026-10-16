import test from "node:test";
import assert from "node:assert/strict";
import {assertFabricIssueRequest,remainingColourWeight,sumRollBalance} from "../src/erp/fabricIssuePolicy.js";
import {legacyDepartment,enforceAccessBoundary} from "../src/middleware/accessMiddleware.js";

const scope={enabledDepartments:["FABRIC"],departmentCatalogueVersion:1,entitlements:{modules:["FABRIC"],maxDepartments:1}};
const staff={role:"department_entry",department:"FABRIC",accessScope:"DEPARTMENT",accessPolicyVersion:1,permissions:["department.fabric.read","department.fabric.write"]};
const head={...staff,role:"department_incharge",permissions:["department.fabric.read"]};
const req=(user,method,path)=>({user,method,originalUrl:"/api/fabric-cutting/"+path,accessCompany:scope});

test("issue request requires exact fields and unique idempotency key",()=>{
 const a=assertFabricIssueRequest({planNo:" 0001 ",inwardNo:" FIN-4 ",colour:" BLUE ",weightKg:"1.125",key:"valid-key-000000000001"});
 assert.equal(a.weightKg,1.125);assert.equal(a.planNo,"0001");assert.equal(a.inwardNo,"FIN-4");
 for(const wrong of [{weightKg:-1},{weightKg:0},{weightKg:1.2345},{weightKg:"NaN"},{key:"short"},{planNo:"$ne"}]){
  assert.throws(()=>assertFabricIssueRequest({...a,...wrong}),/valid|Issue weight|unique/i);
 }
});
test("per-colour plan weight excludes previous issued allocations",()=>{
 const p={colours:[{colour:"BLUE",wantedWeightKg:12.5}],allocations:[{colour:"BLUE",weightKg:4.125}]};
 assert.equal(remainingColourWeight(p,"BLUE"),8.375);
 assert.equal(remainingColourWeight(p,"RED"),null);
 assert.equal(sumRollBalance([{balanceWeightKg:0.125},{balanceWeightKg:1.2}]),1.325);
});
test("Fabric staff can create plan and issue while Head is strictly read-only",()=>{
 for(const path of ["fabric-plans","fabric-plans/setup/I01","fabric-issues","masters"]){
  assert.equal(legacyDepartment("/fabric-cutting/"+path),"FABRIC");
  const r=req(staff,"POST",path);
  assert.doesNotThrow(()=>enforceAccessBoundary(r),path);
  assert.equal(r.authorizedLegacyDepartment,"FABRIC");
  assert.throws(()=>enforceAccessBoundary(req(head,"POST",path)),/review access/i);
  assert.doesNotThrow(()=>enforceAccessBoundary(req(head,"GET",path)),path);
  assert.throws(()=>enforceAccessBoundary(req({...staff,department:"CUTTING"},"GET",path)),/outside assigned scope/i);
 }
 assert.equal(legacyDepartment("/fabric-cutting/plans"),"CUTTING");
 assert.throws(()=>enforceAccessBoundary(req(staff,"POST","plans")),/outside assigned scope/i);
});
test("Fabric issue respects subscribed modules and immutable monitor",()=>{
 assert.throws(()=>enforceAccessBoundary({...req(staff,"POST","fabric-issues"),accessCompany:{...scope,enabledDepartments:["CUTTING"]}}),/not subscribed/i);
 assert.throws(()=>enforceAccessBoundary(req(staff,"POST","fabric-plan-monitor")),/no write permission/i);
});
