import test from "node:test";
import assert from "node:assert/strict";
import {packingOverview,validatePackingPlan,validatePackingIssue} from "../src/erp/packingOverviewPolicy.js";
import {packingRequirements,allowedDepartment,enabledDepartment} from "../src/erp/departmentPolicy.js";

test("Packing overview uses actual IRONED/PACKED ERP bundles, carton data, and material balances",()=>{
 const lots=[{_id:"l1",code:"LOT-1",dcNo:"DC-1",orderNo:"O-1",sku:"TEE-M",section:"LINE-1"},
  {_id:"l2",code:"LOT-2",dcNo:"DC-2",sku:"TEE-L",section:"LINE-2"}];
 const bundles=[
  {_id:"B1",code:"BND-1",lotId:"l1",stage:"IRONED",qty:20},
  {_id:"B2",code:"BND-2",lotId:"l1",stage:"PACKED",qty:15},
  {_id:"B3",code:"BND-3",lotId:"l2",stage:"IRONED",qty:10},
  {_id:"B4",code:"BND-4",lotId:"foreign",stage:"PACKED",qty:1000},
  {_id:"B5",code:"BND-5",lotId:"l1",stage:"PACKED",qty:0}
 ];
 const masters=[{kind:"PACKING",key:"PK-M-01",sku:"TEE-M",active:true,
   materials:[{sku:"BAG",quantity:1,perPieces:10},{sku:"LABEL",quantity:1,perPieces:1}]},
   {kind:"PACKING",key:"PK-L-01",sku:"TEE-L",active:true,
    materials:[{sku:"BAG",quantity:1,perPieces:10}]}];
 const balances=[{sku:"BAG",location:"ACCESSORIES",qty:5000},
  {sku:"LABEL",location:"ACCESSORIES",qty:12000}];
 const event=[
  // Existing /pack does NOT write top-level lotId; lot identity is carton.lotId.
  {_id:"E1",kind:"PACK",department:"PACKING",quantity:15,createdAt:new Date("2026-10-17T05:00:00Z"),
   details:{carton:{_id:"B2",lotId:"l1",code:"BND-2"},
    requirements:[{sku:"BAG",qty:2000},{sku:"LABEL",qty:15000}]}},
  {_id:"E2",kind:"PACK",department:"PACKING",lotId:"l1",quantity:100,
   reversedBy:"UNDO",details:{carton:{lotId:"l1",code:"BND-X"}}},
  {_id:"E3",kind:"PACK",department:"PACKING",quantity:120,
   details:{carton:{lotId:"foreign",code:"BND-Y"}}}
 ];
 const plans=[
  {_id:"P1",date:"2026-10-17",sku:"TEE-M",dcNo:"DC-1",quantity:20},
  {_id:"P2",date:"2026-10-17",sku:"TEE-M",dcNo:"",quantity:30},
  {_id:"P3",date:"2026-10-18",sku:"TEE-M",dcNo:"DC-1",quantity:10}];
 const skus=[{code:"TEE-M",colour:"RED",size:"M"},
  {code:"TEE-L",colour:"BLUE",size:"L"}];
 const out=packingOverview(lots,bundles,event,masters,plans,
  [{status:"PENDING"},{status:"REJECTED"}],balances,skus);
 assert.equal(out.summary.readyToPackPcs,30);
 assert.equal(out.summary.packedAwaitingDispatchPcs,15);
 assert.equal(out.summary.activeCartons,1);
 assert.equal(out.summary.packedEventPcs,15);
 assert.equal(out.summary.plannedPcs,60);
 assert.equal(out.summary.openIssueRequests,1);
 assert.equal(out.history.length,1);
 assert.equal(out.history[0].cartonNo,"BND-2");
 assert.equal(out.history[0].materials[0].quantity,2);
 assert.equal(out.bundles.length,3);
 assert.equal(out.bundles.find(b=>b.bundleNo==="BND-1").materialReady,false);
 assert.equal(out.bundles.find(b=>b.bundleNo==="BND-1").materials[1].shortageQty,8);
 assert.equal(out.plans[0].actualPcs,15);
 assert.equal(out.plans[0].balancePcs,5);
 assert.equal(out.plans[1].actualPcs,15);
 assert.equal(out.plans[2].actualPcs,0);
 assert.equal(out.bundles.find(b=>b.bundleNo==="BND-1").colour,"RED");
});
test("Packing material consumption uses carton capacity, not per-piece double issues",()=>{
 assert.deepEqual(packingRequirements([{sku:"POLY",quantity:1,perPieces:10}],21),
  [{sku:"POLY",qty:3000}]);
 assert.throws(()=>packingRequirements([{sku:"POLY",quantity:-1,perPieces:10}],10));
});
test("Packing plan validates real dates, finished SKU and whole PCS",()=>{
 assert.deepEqual(validatePackingPlan({date:"2026-10-17",sku:" tee-m ",dcNo:" dc-1 ",
  quantity:"25",notes:" Morning packing "}),{
  date:"2026-10-17",sku:"TEE-M",dcNo:"DC-1",quantity:25,notes:"Morning packing"});
 for(const data of [
  {date:"2026-02-30",sku:"TEE-M",quantity:1},
  {date:"2026-10-17",sku:"Z",quantity:1},
  {date:"2026-10-17",sku:"TEE-M",quantity:1.5},
  {date:"2026-10-17",sku:"TEE-M",quantity:0},
  {date:"2026-10-17",sku:"TEE-M",quantity:""}
 ])assert.throws(()=>validatePackingPlan(data));
});
test("Repacking request validates active carton and never independently changes stock",()=>{
 assert.deepEqual(validatePackingIssue({category:"REPACK",quantity:4,reason:"Carton label mismatch"},
  {stage:"PACKED",qty:20}),{category:"REPACK",quantity:4,reason:"Carton label mismatch",
   expectedPcs:20,stage:"PACKED"});
 for(const [request,bundle] of [
  [{category:"REPACK",quantity:21,reason:"Carton label mismatch"},{stage:"PACKED",qty:20}],
  [{category:"REPACK",quantity:1.25,reason:"Carton label mismatch"},{stage:"PACKED",qty:20}],
  [{category:"UNKNOWN",quantity:2,reason:"Carton label mismatch"},{stage:"PACKED",qty:20}],
  [{category:"REPACK",quantity:2,reason:"Tiny"},{stage:"PACKED",qty:20}],
  [{category:"REPACK",quantity:2,reason:"Carton label mismatch"},{stage:"IRONED",qty:20}]
 ])assert.throws(()=>validatePackingIssue(request,bundle));
});
test("Packing Head can read, Staff can pack only with subscribed department",()=>{
 const c={departmentCatalogueVersion:1,enabledDepartments:["PACKING"],
  entitlements:{modules:["PACKING"],maxDepartments:1}};
 const base={department:"PACKING",accessPolicyVersion:1,accessScope:"DEPARTMENT"};
 const head={...base,role:"department_incharge",permissions:["department.packing.read"]};
 const staff={...base,role:"department_entry",permissions:["department.packing.read","department.packing.write"]};
 assert.equal(allowedDepartment(head,"PACKING",false),true);
 assert.equal(allowedDepartment(head,"PACKING",true),false);
 assert.equal(allowedDepartment(staff,"PACKING",true),true);
 assert.equal(allowedDepartment({...staff,department:"IRONING"},"PACKING",false),false);
 assert.equal(enabledDepartment(c,"PACKING"),true);
 assert.equal(enabledDepartment({...c,enabledDepartments:["IRONING"]},"PACKING"),false);
});
