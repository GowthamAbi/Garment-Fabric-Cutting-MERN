import test from "node:test";
import assert from "node:assert/strict";
import {inwardOverview,validateInwardDiscrepancy} from "../src/erp/inwardOverviewPolicy.js";
import {allowedDepartment,enabledDepartment} from "../src/erp/departmentPolicy.js";
test("Inward DC and section totals reuse saved lot and current bundle state",()=>{
 const lots=[{_id:"L1",code:"LOT-1",dcNo:"DC-1",orderNo:"O-1",sku:"TSHIRT-M",
  section:"VENDOR-A",sent:100,received:30,operations:["SEAM","HEM"]},
  {_id:"L2",code:"LOT-2",dcNo:"DC-2",sku:"TSHIRT-L",section:"VENDOR-A",
  sent:20,received:0,operations:["SEAM"]}];
 const bundles=[
  {_id:"b1",code:"BND-1",lotId:"L1",stage:"STITCHED",qty:25},
  {_id:"b2",code:"BND-2",lotId:"L1",stage:"REWORK_DONE",qty:5},
  {_id:"b3",code:"BND-3",lotId:"L1",stage:"OP:1",qty:40},
  {_id:"b4",code:"BND-4",lotId:"L2",stage:"STITCHED",qty:20},
  {_id:"b5",code:"BND-X",lotId:"FOREIGN",stage:"STITCHED",qty:5}
 ];
 const events=[{_id:"e1",kind:"ADVANCE",department:"INWARD",lotId:"L1",quantity:30,details:{bundle:{stage:"CHECKING"}}},
  {_id:"e2",kind:"ADVANCE",department:"INWARD",lotId:"L1",quantity:30,reversedBy:"undo"},
  {_id:"e3",kind:"ADVANCE",department:"STITCHING",lotId:"L2",quantity:10}];
 const result=inwardOverview(lots,bundles,events,[{status:"PENDING"},{status:"REJECTED"}]);
 assert.equal(result.summary.expectedPcs,120);
 assert.equal(result.summary.receivedPcs,30);
 assert.equal(result.summary.pendingPcs,90);
 assert.equal(result.summary.readyPcs,45);
 assert.equal(result.summary.reworkReadyPcs,5);
 assert.equal(result.summary.pendingRequests,1);
 assert.equal(result.vendors[0].pendingPcs,90);
 assert.equal(result.readyBundles.length,3);
 assert.equal(result.history.length,1);
 assert.equal(result.history[0].quantity,30);
 assert.ok(!result.readyBundles.some(x=>x.code==="BND-X"));
});
test("Inward physical count requests validate shortage/excess only and never post stock",()=>{
 const b={stage:"STITCHED",qty:20};
 assert.deepEqual(validateInwardDiscrepancy({countedPcs:15,reason:"Five units missing"},b),
  {type:"SHORTAGE",expectedPcs:20,countedPcs:15,variancePcs:-5,reason:"Five units missing"});
 assert.deepEqual(validateInwardDiscrepancy({countedPcs:21,reason:"One extra piece checked"},b).type,"EXCESS");
 for(const input of [
  {countedPcs:20,reason:"No difference"},
  {countedPcs:1.5,reason:"Fractional units"},
  {countedPcs:-1,reason:"Negative pieces"},
  {countedPcs:"",reason:"Missing count"},
  {countedPcs:12,reason:"short"}
 ])assert.throws(()=>validateInwardDiscrepancy(input,b));
 assert.throws(()=>validateInwardDiscrepancy({countedPcs:1,reason:"Wrong source stage"},
  {stage:"OP:1",qty:20}));
});
test("Inward Department Head read / Staff write policy and active license",()=>{
 const company={departmentCatalogueVersion:1,enabledDepartments:["INWARD"],
  entitlements:{modules:["INWARD"],maxDepartments:1}};
 const base={department:"INWARD",accessScope:"DEPARTMENT",accessPolicyVersion:1};
 const head={...base,role:"department_incharge",permissions:["department.inward.read"]};
 const staff={...base,role:"department_entry",permissions:["department.inward.read","department.inward.write"]};
 assert.equal(allowedDepartment(head,"INWARD",false),true);
 assert.equal(allowedDepartment(head,"INWARD",true),false);
 assert.equal(allowedDepartment(staff,"INWARD",true),true);
 assert.equal(allowedDepartment({...staff,department:"STITCHING"},"INWARD",false),false);
 assert.equal(enabledDepartment(company,"INWARD"),true);
 assert.equal(enabledDepartment({...company,enabledDepartments:["STITCHING"]},"INWARD"),false);
});
