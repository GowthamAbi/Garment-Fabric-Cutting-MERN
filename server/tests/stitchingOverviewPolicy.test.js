import test from "node:test";
import assert from "node:assert/strict";
import {stitchingOverview} from "../src/erp/stitchingOverviewPolicy.js";
import {allowedDepartment,enabledDepartment} from "../src/erp/departmentPolicy.js";
test("Stitching real bundle/lot summary counts operation WIP, stitched and inward without double counting",()=>{
 const lots=[{_id:"l1",code:"LOT-01",sku:"SHIRT-M",sent:100,received:25,operations:["SEAM","HEM"],section:"LINE1"}];
 const bundles=[
  {lotId:"l1",qty:15,stage:"STITCHING_READY"},
  {lotId:"l1",qty:35,stage:"OP:1"},
  {lotId:"l1",qty:25,stage:"STITCHED"}];
 const masters=[{kind:"STITCHING",key:"STCH-1",sku:"SHIRT-M",operations:["SEAM","HEM"]}];
 const events=[
  {kind:"ADVANCE",department:"STITCHING",lotId:"l1",quantity:35,details:{bundle:{stage:"OP:1"}}},
  {kind:"ADVANCE",department:"STITCHING",lotId:"l1",quantity:25,details:{bundle:{stage:"STITCHED"}}},
  {kind:"ADVANCE",department:"STITCHING",lotId:"l1",quantity:10,
    reversedBy:"undo",details:{bundle:{stage:"STITCHED"}}},
 ];
 const result=stitchingOverview(lots,bundles,masters,
  [{date:"2026-10-17",sku:"SHIRT-M",operation:"SEAM",operator:"OP1",shift:"DAY",quantity:80}],events);
 assert.equal(result.summary.sentPcs,100);
 assert.equal(result.summary.stitchedReadyPcs,25);
 assert.equal(result.summary.handedOverPcs,25);
 assert.equal(result.summary.inOperationPcs,35);
 assert.equal(result.plans[0].pendingPcs,50);
 assert.equal(result.plans[0].completionPercent,50);
 assert.deepEqual(result.operations.map(x=>x.completedEventPcs),[35,25]);
 assert.equal(result.targets[0].targetPcs,80);
});
test("Stitching Head reads; operational changes only for subscribed Stitching Staff",()=>{
 const company={departmentCatalogueVersion:1,enabledDepartments:["STITCHING"],
   entitlements:{modules:["STITCHING"],maxDepartments:1}};
 const head={role:"department_incharge",department:"STITCHING",accessScope:"DEPARTMENT",
   accessPolicyVersion:1,permissions:["department.stitching.read"]};
 const staff={...head,role:"department_entry",permissions:["department.stitching.read","department.stitching.write"]};
 assert.equal(allowedDepartment(head,"STITCHING",false),true);
 assert.equal(allowedDepartment(head,"STITCHING",true),false);
 assert.equal(allowedDepartment(staff,"STITCHING",true),true);
 assert.equal(allowedDepartment({...staff,department:"DELIVERY"},"STITCHING",false),false);
 assert.equal(enabledDepartment(company,"STITCHING"),true);
 assert.equal(enabledDepartment({...company,enabledDepartments:["DELIVERY"]},"STITCHING"),false);
});
