import test from "node:test";
import assert from "node:assert/strict";
import {validateDeliveryLines,deliveryStageStatus,deliveryChallanSummary,validateHandover} from "../src/erp/deliveryPolicy.js";

const actual=[{colour:"BLUE",size:"M",actualPcs:100},{colour:"BLUE",size:"L",actualPcs:50}];
const used=new Map([["P-001|BLUE|M",30]]);
test("Delivery cannot issue negative, fractional, duplicated or over-allocated PCS",()=>{
 assert.deepEqual(validateDeliveryLines([{colour:"blue",size:"m",pcs:70}],actual,used,"P-001"),
  [{colour:"BLUE",size:"M",pcs:70}]);
 for(const lines of [
  [{colour:"BLUE",size:"M",pcs:71}],
  [{colour:"BLUE",size:"M",pcs:0}],
  [{colour:"BLUE",size:"M",pcs:1.5}],
  [{colour:"BLUE",size:"M",pcs:2},{colour:"BLUE",size:"M",pcs:2}],
  [{colour:"BLUE",size:"XXL",pcs:1}],
  []
 ])assert.throws(()=>validateDeliveryLines(lines,actual,used,"P-001"),/available|Valid|Duplicate|Choose/i);
});
test("Cutting and Folding mandatory, Elastic optional",()=>{
 const plan={foldingSavedAt:new Date(),foldingLines:[{colour:"BLUE"}]};
 const ready=deliveryStageStatus(plan,{status:"COMPLETED"});
 assert.equal(ready.eligible,true);
 assert.equal(ready.elasticStatus,"PENDING");
 assert.equal(deliveryStageStatus(plan,{status:"PARTIAL"}).eligible,false);
 assert.equal(deliveryStageStatus({...plan,foldingLines:[]},{status:"COMPLETED"}).eligible,false);
});
test("Issued, handed-over, vendor pending and delayed PCS kept distinct",()=>{
 const now=new Date("2026-10-18T12:00:00Z");
 const challans=[
  {vendorCode:"V1",vendorName:"Vendor One",totalPcs:20,status:"ISSUED",
   expectedHandoverAt:new Date("2026-10-17T00:00:00Z")},
  {vendorCode:"V1",totalPcs:15,status:"ISSUED",
   expectedHandoverAt:new Date("2026-10-17T00:00:00Z"),handoverAt:now},
  {vendorCode:"V2",totalPcs:9,status:"ISSUED",
   expectedHandoverAt:new Date("2026-10-20T00:00:00Z")},
  {vendorCode:"V2",totalPcs:99,status:"CANCELLED"},
 ];
 const data=deliveryChallanSummary(challans,[{vendorCode:"V1",vendorName:"Vendor One"}],now);
 assert.deepEqual(data.summary,{issuedPcs:44,handedOverPcs:15,pendingHandoverPcs:29,
  overduePcs:20,activeChallans:3});
 assert.equal(data.vendors.find(v=>v.vendorCode==="V2").pendingHandoverPcs,9);
 assert.equal(data.vendors.find(v=>v.vendorCode==="V1").overduePcs,20);
});
test("Delivery handover validates reference and reason safely",()=>{
 assert.deepEqual(validateHandover({reference:" pod-2026 ",remarks:"Signed"}),{
  reference:"POD-2026",remarks:"Signed"});
 assert.throws(()=>validateHandover({reference:"?"}),/reference/);
 assert.throws(()=>validateHandover({reference:"POD",remarks:"x".repeat(400)}),/remarks/);
});
