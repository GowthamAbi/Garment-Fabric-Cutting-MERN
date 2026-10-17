import test from "node:test";
import assert from "node:assert/strict";
import {validateDeliveryLines,deliveryStageStatus,deliveryChallanSummary,validateHandover} from "../src/erp/deliveryPolicy.js";
import {assertDeliveryRole,validateVendorReturnLines,vendorReturnSummary} from "../src/erp/deliveryVendorReturnPolicy.js";

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

test("Delivery role guard blocks other departments and Head write",()=>{
 assert.throws(()=>assertDeliveryRole({role:"department_entry",department:"FABRIC"},"POST"),/DELIVERY/);
 assert.throws(()=>assertDeliveryRole({role:"department_entry",department:"ELASTIC"},"GET"),/DELIVERY/);
 assert.throws(()=>assertDeliveryRole({role:"department_incharge",department:"DELIVERY"},"POST"),/read-only/);
 assert.doesNotThrow(()=>assertDeliveryRole({role:"department_entry",department:"DELIVERY"},"POST"));
 assert.doesNotThrow(()=>assertDeliveryRole({role:"department_incharge",department:"DELIVERY"},"GET"));
});
test("Delivery vendor stitched receipt rejects over-return, duplicate, negative, fractional PCS",()=>{
 const dc=[{colour:"BLUE",size:"M",pcs:20},{colour:"BLUE",size:"L",pcs:5}],
  used=new Map([["BLUE|M",10]]);
 assert.deepEqual(validateVendorReturnLines([{colour:"blue",size:"m",goodPcs:7,
  reworkPcs:2,rejectedPcs:1}],dc,used),[
  {colour:"BLUE",size:"M",goodPcs:7,reworkPcs:2,rejectedPcs:1,totalPcs:10}]);
 for(const lines of [
  [{colour:"BLUE",size:"M",goodPcs:11}],
  [{colour:"BLUE",size:"M",goodPcs:-1,reworkPcs:1}],
  [{colour:"BLUE",size:"M",goodPcs:1.5}],
  [{colour:"BLUE",size:"M",goodPcs:0}],
  [{colour:"BLUE",size:"XXL",goodPcs:1}],
  [{colour:"BLUE",size:"L",goodPcs:1},{colour:"blue",size:"l",goodPcs:1}]
 ])assert.throws(()=>validateVendorReturnLines(lines,dc,used));
});
test("Vendor stitched pending excludes unhanded-over DC and counts good/rework/rejected separately",()=>{
 const now=new Date();
 const dcs=[{_id:"aaa",status:"ISSUED",handoverAt:now,vendorCode:"VEN-1",totalPcs:20},
  {_id:"bbb",status:"ISSUED",vendorCode:"VEN-1",totalPcs:30}];
 const returns=[{challanId:"aaa",lines:[{goodPcs:6,reworkPcs:2,rejectedPcs:1,totalPcs:9}]}];
 const r=vendorReturnSummary(dcs,returns,[{vendorCode:"VEN-1",vendorName:"Supplier"}]);
 assert.deepEqual(r.summary,{sentToVendorPcs:20,returnedPcs:9,
  goodPcs:6,reworkPcs:2,rejectedPcs:1,pendingStitchingPcs:11});
});
