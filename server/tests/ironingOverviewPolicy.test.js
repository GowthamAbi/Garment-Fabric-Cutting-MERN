import test from "node:test";
import assert from "node:assert/strict";
import {ironingOverview,validateIroningTarget,validateIroningIssue,IRONING_ISSUE_TYPES} from "../src/erp/ironingOverviewPolicy.js";
import {stageAfter,allowedDepartment,enabledDepartment} from "../src/erp/departmentPolicy.js";

test("Ironing live queue/current completed PCS and historical production event totals are separate",()=>{
 const lots=[{_id:"L1",code:"LOT-1",dcNo:"DC-1",sku:"TSHIRT-M",section:"UNIT-A",orderNo:"ORD-1"},
  {_id:"L2",code:"LOT-2",dcNo:"DC-2",sku:"TSHIRT-L",section:"UNIT-B"}];
 const bundles=[
  {_id:"B1",code:"BND-1",lotId:"L1",stage:"GOOD",qty:15,createdAt:new Date("2026-10-16T00:00:00Z")},
  {_id:"B2",code:"BND-2",lotId:"L1",stage:"IRONING",qty:20,createdAt:new Date("2026-10-16T06:00:00Z")},
  {_id:"B3",code:"BND-3",lotId:"L1",stage:"IRONED",qty:10},
  {_id:"B4",code:"BND-4",lotId:"L2",stage:"IRONING",qty:5},
  {_id:"B5",code:"BND-5",lotId:"WRONG",stage:"IRONED",qty:900},
  {_id:"B6",code:"BND-6",lotId:"L2",stage:"REWORK",qty:100}];
 const events=[
  {_id:"E1",department:"IRONING",kind:"ADVANCE",lotId:"L1",quantity:15,
   createdAt:new Date("2026-10-17T05:00:00Z"),details:{bundle:{stage:"IRONING"},operator:"OP1",shift:"DAY"}},
  {_id:"E2",department:"IRONING",kind:"ADVANCE",lotId:"L1",quantity:10,
   createdAt:new Date("2026-10-17T10:00:00Z"),details:{bundle:{stage:"IRONED"},operator:"OP1",shift:"DAY"}},
  {_id:"E3",department:"IRONING",kind:"ADVANCE",lotId:"L1",quantity:50,reversedBy:"UNDO",
   createdAt:new Date("2026-10-17T12:00:00Z"),details:{bundle:{stage:"IRONED"},operator:"OP1",shift:"DAY"}},
  {_id:"E4",department:"PACKING",kind:"PACK",lotId:"L1",quantity:10}];
 const targets=[{_id:"T1",date:"2026-10-17",sku:"TSHIRT-M",operator:"OP1",shift:"DAY",quantity:25},
  {_id:"T2",date:"2026-10-18",sku:"TSHIRT-M",operator:"OP1",shift:"DAY",quantity:50}];
 const out=ironingOverview(lots,bundles,events,targets,
  [{status:"PENDING"},{status:"REJECTED"}],new Date("2026-10-17T12:00:00Z"));
 assert.equal(out.summary.lotCount,2);
 assert.equal(out.summary.receivedReadyPcs,15);
 assert.equal(out.summary.ironingWipPcs,25);
 assert.equal(out.summary.ironedReadyForPackingPcs,10);
 assert.equal(out.summary.receivedEventPcs,15);
 assert.equal(out.summary.completedEventPcs,10);
 assert.equal(out.summary.openIssueRequests,1);
 assert.equal(out.bundles.length,4);
 assert.equal(out.bundles.find(x=>x.bundleNo==="BND-1").ageHours,36);
 assert.equal(out.history.length,2);
 assert.equal(out.targets[0].actualPcs,10);
 assert.equal(out.targets[0].balancePcs,15);
 assert.equal(out.targets[0].achievementPercent,40);
 assert.equal(out.targets[1].actualPcs,0);
});
test("Ironing target date/whole quantity validates and accepts shift/operator",()=>{
 assert.deepEqual(validateIroningTarget({date:"2026-10-17",sku:" shirt-m ",
  operator:"OP1",shift:"NIGHT",quantity:"250"}),{
  date:"2026-10-17",sku:"SHIRT-M",operator:"OP1",shift:"NIGHT",quantity:250});
 for(const row of [{date:"2026-02-30",sku:"SHIRT-M",quantity:5},
  {date:"2026-10-17",sku:"X",quantity:5},
  {date:"2026-10-17",sku:"SHIRT-M",quantity:1.5},
  {date:"2026-10-17",sku:"SHIRT-M",quantity:""},
  {date:"2026-10-17",sku:"SHIRT-M",quantity:0}])
  assert.throws(()=>validateIroningTarget(row));
});
test("Issue request validates stage, category, whole PCS and reason, never posts stock",()=>{
 assert.ok(IRONING_ISSUE_TYPES.includes("RE_IRON"));
 assert.deepEqual(validateIroningIssue({category:"STAIN",quantity:3,
  reason:"Shirt sleeve stained"},{stage:"IRONED",qty:15}),{
  category:"STAIN",quantity:3,reason:"Shirt sleeve stained",expectedPcs:15,stage:"IRONED"});
 for(const [body,bundle] of [
  [{category:"STAIN",quantity:16,reason:"Stained shirts found"},{stage:"IRONING",qty:15}],
  [{category:"STAIN",quantity:2.3,reason:"Stained shirts found"},{stage:"IRONING",qty:15}],
  [{category:"UNKNOWN",quantity:2,reason:"Stained shirts found"},{stage:"IRONING",qty:15}],
  [{category:"DAMAGE",quantity:2,reason:"Short"},{stage:"IRONING",qty:15}],
  [{category:"DAMAGE",quantity:2,reason:"Sleeve damage found"},{stage:"GOOD",qty:15}]
 ])assert.throws(()=>validateIroningIssue(body,bundle));
});
test("Ironing receipt/complete stage movement and role/subscription control",()=>{
 assert.equal(stageAfter("GOOD",[]),"IRONING");
 assert.equal(stageAfter("IRONING",[]),"IRONED");
 const company={departmentCatalogueVersion:1,enabledDepartments:["IRONING"],
  entitlements:{modules:["IRONING"],maxDepartments:1}};
 const base={department:"IRONING",accessPolicyVersion:1,accessScope:"DEPARTMENT"};
 const head={...base,role:"department_incharge",permissions:["department.ironing.read"]};
 const staff={...base,role:"department_entry",
  permissions:["department.ironing.read","department.ironing.write"]};
 assert.equal(allowedDepartment(head,"IRONING",false),true);
 assert.equal(allowedDepartment(head,"IRONING",true),false);
 assert.equal(allowedDepartment(staff,"IRONING",true),true);
 assert.equal(allowedDepartment({...staff,department:"PACKING"},"IRONING",false),false);
 assert.equal(enabledDepartment(company,"IRONING"),true);
 assert.equal(enabledDepartment({...company,enabledDepartments:["PACKING"]},"IRONING"),false);
});
