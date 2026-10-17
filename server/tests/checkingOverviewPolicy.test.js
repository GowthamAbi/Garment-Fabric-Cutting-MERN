import test from "node:test";
import assert from "node:assert/strict";
import {checkingOverview,validateQualityHold,qcDefectText,QC_DEFECT_CATEGORIES} from "../src/erp/checkingOverviewPolicy.js";
import {checkSplit,allowedDepartment,enabledDepartment} from "../src/erp/departmentPolicy.js";
test("Checking reports live bundle quantities and audit events without double-counting active stock",()=>{
 const lots=[{_id:"l1",code:"LOT1",dcNo:"DC1",sku:"TEE-M",section:"LINE1",sent:100},
  {_id:"l2",code:"LOT2",dcNo:"DC2",sku:"TEE-L",section:"LINE2",sent:50}];
 const bundles=[
  {_id:"b1",code:"B1",lotId:"l1",stage:"CHECKING",qty:20,cycle:1},
  {_id:"b2",code:"B2",lotId:"l1",stage:"GOOD",qty:40},
  {_id:"b3",code:"B3",lotId:"l1",stage:"REWORK",qty:10},
  {_id:"b4",code:"B4",lotId:"l1",stage:"OIL",qty:5},
  {_id:"b5",code:"B5",lotId:"l1",stage:"WASTE",qty:5},
  {_id:"b6",code:"B6",lotId:"l2",stage:"CHECKING",qty:25},
  {_id:"b7",code:"B7",lotId:"foreign",stage:"CHECKING",qty:100},
  {_id:"b8",code:"B8",lotId:"l1",stage:"CHECKING",qty:0}];
 const events=[
  {_id:"e1",lotId:"l1",bundleId:"b1",department:"CHECKING",kind:"CHECK",quantity:60,
   details:{split:{good:40,rework:10,oil:5,reject:5,total:60},
   defect:"STITCHING: Uneven seam"}},
  {_id:"e2",lotId:"l1",bundleId:"b1",department:"CHECKING",kind:"CHECK",quantity:10,
   reversedBy:"undo",details:{split:{good:10},defect:"STITCHING: Seam"}},
  {_id:"e3",lotId:"l1",bundleId:"b4",department:"CHECKING",kind:"ADVANCE",quantity:5,
   details:{bundle:{stage:"OIL_DONE"}}},
  {_id:"e4",lotId:"foreign",department:"CHECKING",kind:"CHECK",quantity:100}
 ];
 const out=checkingOverview(lots,bundles,events,[{status:"PENDING"},{status:"REJECTED"}]);
 assert.equal(out.summary.pendingPcs,45);
 assert.equal(out.summary.goodStockPcs,40);
 assert.equal(out.summary.reworkStockPcs,10);
 assert.equal(out.summary.oilStockPcs,5);
 assert.equal(out.summary.wasteStockPcs,5);
 assert.equal(out.summary.checksPerformedPcs,60);
 assert.equal(out.summary.passRecordedPcs,40);
 assert.equal(out.summary.reworkRecordedPcs,10);
 assert.equal(out.summary.rejectRecordedPcs,5);
 assert.equal(out.summary.pendingHoldRequests,1);
 assert.equal(out.bundles.length,6);
 assert.equal(out.inspections.length,1);
 assert.equal(out.defects[0].category,"STITCHING");
 assert.equal(out.history.length,2);
 assert.equal(out.lots[1].pendingPcs,25);
});
test("QC split rejects over-issue, decimals, negatives, and zero; supports partial disposition",()=>{
 assert.deepEqual(checkSplit({good:6,rework:2,oil:1,reject:1},12),{
  good:6,rework:2,oil:1,reject:1,total:10});
 for(const values of [
  {good:9,rework:4},{good:0,rework:0,oil:0,reject:0},
  {good:1.1},{good:-2}
 ])assert.throws(()=>checkSplit(values,12));
});
test("QC defect classification and hold request are non-posting, stage-validated",()=>{
 assert.ok(QC_DEFECT_CATEGORIES.includes("OIL_STAIN"));
 assert.equal(qcDefectText("OIL_STAIN","Spots on chest"),"OIL_STAIN: Spots on chest");
 assert.throws(()=>qcDefectText("UNSAFE","Spots"));
 assert.deepEqual(validateQualityHold({category:"FABRIC",reason:"Hole observed in sleeve"},
   {stage:"CHECKING",qty:15}),{
  category:"FABRIC",reason:"Hole observed in sleeve",expectedPcs:15,stage:"CHECKING"});
 for(const bad of [
  [{category:"FABRIC",reason:"Tiny"},{stage:"CHECKING",qty:15}],
  [{category:"BAD",reason:"Fabric issue reported"},{stage:"CHECKING",qty:15}],
  [{category:"FABRIC",reason:"Issue reported"},{stage:"GOOD",qty:15}],
  [{category:"FABRIC",reason:"Issue reported"},{stage:"CHECKING",qty:0}]
 ])assert.throws(()=>validateQualityHold(...bad));
});
test("Checking Head read, Staff write and subscription enforce department isolation",()=>{
 const c={departmentCatalogueVersion:1,enabledDepartments:["CHECKING"],
  entitlements:{modules:["CHECKING"],maxDepartments:1}};
 const base={department:"CHECKING",accessPolicyVersion:1,accessScope:"DEPARTMENT"};
 const head={...base,role:"department_incharge",permissions:["department.checking.read"]};
 const staff={...base,role:"department_entry",permissions:["department.checking.read","department.checking.write"]};
 assert.equal(allowedDepartment(head,"CHECKING",false),true);
 assert.equal(allowedDepartment(head,"CHECKING",true),false);
 assert.equal(allowedDepartment(staff,"CHECKING",true),true);
 assert.equal(allowedDepartment({...staff,department:"INWARD"},"CHECKING",false),false);
 assert.equal(enabledDepartment(c,"CHECKING"),true);
 assert.equal(enabledDepartment({...c,enabledDepartments:["INWARD"]},"CHECKING"),false);
});
