import test from "node:test";
import assert from "node:assert/strict";
import {dispatchOverview,validateDispatchTransport,validateDispatchPlan,validateDispatchException} from "../src/erp/dispatchOverviewPolicy.js";
import {allowedDepartment,enabledDepartment} from "../src/erp/departmentPolicy.js";
test("Dispatch shows packed live PCS, transit and separately warehouse-confirmed partial receipts",()=>{
 const lots=[{_id:"L1",code:"LOT1",sku:"TEE-M",dcNo:"DC-1",orderNo:"ORD-1"},
 { _id:"L2",code:"LOT2",sku:"TEE-L",dcNo:"DC-2",orderNo:"ORD-1"}];
 const bundles=[
  {_id:"C1",code:"CARTON1",lotId:"L1",stage:"PACKED",qty:30},
  {_id:"T1",code:"TRANSIT1",lotId:"L1",stage:"TRANSIT_WAREHOUSE",qty:5,destination:"WH1",createdAt:new Date("2026-10-16T00:00:00Z")},
  {_id:"C2",code:"CARTON2",lotId:"L2",stage:"PACKED",qty:20},
  {_id:"X",code:"FOREIGN",lotId:"BAD",stage:"PACKED",qty:999}
 ];
 const events=[
  {_id:"E1",kind:"TRANSFER",department:"DISPATCH",bundleId:"C1",quantity:10,
   createdAt:new Date("2026-10-17T10:00:00Z"),documentId:"DOC1",
   details:{bundle:{_id:"T1",code:"TRANSIT1",lotId:"L1",stage:"TRANSIT_WAREHOUSE",
     destination:"WH1"},dispatch:{vehicleNo:"TN01AB1234",transporter:"ABC Transport"}}},
  {_id:"E2",kind:"TRANSFER",department:"WAREHOUSE",quantity:5,
   details:{bundle:{_id:"W1",parentId:"T1",stage:"WAREHOUSE:WH1",destination:"WH1"}}},
  {_id:"E3",kind:"TRANSFER",department:"WAREHOUSE",quantity:999,
   details:{bundle:{_id:"W2",parentId:"unknown",stage:"WAREHOUSE:WH1",destination:"WH1"}}},
  {_id:"E4",kind:"TRANSFER",department:"DISPATCH",quantity:100,reversedBy:"UNDO",
   details:{bundle:{_id:"T2",lotId:"L1",stage:"TRANSIT_WAREHOUSE",destination:"WH1"}}}
 ];
 const plans=[{_id:"P1",date:"2026-10-17",sku:"TEE-M",dcNo:"DC-1",
   destination:"WH1",quantity:20},
 { _id:"P2",date:"2026-10-17",sku:"TEE-M",dcNo:"",destination:"WH1",quantity:30}];
 const out=dispatchOverview(lots,bundles,events,plans,[{status:"PENDING"}],
 [{kind:"WAREHOUSE",key:"WH1",name:"Warehouse 1",active:true}],
 [{code:"TEE-M",size:"M",colour:"Red"}],new Date("2026-10-17T12:00:00Z"));
 assert.equal(out.summary.readyPackedPcs,50);
 assert.equal(out.orders.length,2);
 assert.equal(out.summary.inTransitPcs,5);
 assert.equal(out.summary.readyCartons,2);
 assert.equal(out.summary.transitCartons,1);
 assert.equal(out.summary.shippedEventPcs,10);
 assert.equal(out.summary.warehouseReceivedEventPcs,5);
 assert.equal(out.summary.pendingExceptionRequests,1);
 assert.equal(out.bundles.length,3);
 assert.equal(out.history.length,1);
 assert.equal(out.history[0].status,"PARTIAL_RECEIPT");
 assert.equal(out.history[0].pendingReceiptPcs,5);
 assert.equal(out.history[0].transport.vehicleNo,"TN01AB1234");
 assert.equal(out.schedules[0].actualPcs,10);
 assert.equal(out.schedules[0].pendingPcs,10);
 assert.equal(out.schedules[1].actualPcs,10);
 assert.equal(out.warehouses[0].name,"Warehouse 1");
});
test("Transfer can record validated truck details while preserving old transfer callers",()=>{
 assert.equal(validateDispatchTransport({}),null);
 assert.deepEqual(validateDispatchTransport({
  vehicleNo:" tn01ab1234 ",transporter:"Transport Limited",driver:"Raj",
  lrNo:"LR001",notes:"Loading checked"
 }),{vehicleNo:"TN01AB1234",transporter:"Transport Limited",driver:"Raj",
  lrNo:"LR001",notes:"Loading checked"});
 for(const bad of [{vehicleNo:"@!",transporter:"XYZ"},
  {vehicleNo:"TN01AB1234",transporter:""},
  {vehicleNo:"TN01AB1234",transporter:"X"},
  {notes:"Needs truck"}])assert.throws(()=>validateDispatchTransport(bad));
});
test("Schedule date, destination and whole-PCS input are validated",()=>{
 assert.deepEqual(validateDispatchPlan({
  date:"2026-10-17",sku:" tee-m ",dcNo:" dc1 ",destination:" wh1 ",quantity:"100"
 }),{date:"2026-10-17",sku:"TEE-M",dcNo:"DC1",destination:"WH1",quantity:100,notes:""});
 for(const bad of [
  {date:"2026-02-30",sku:"TEE-M",destination:"WH1",quantity:100},
  {date:"2026-10-17",sku:"TEE-M",destination:"WH1",quantity:0},
  {date:"2026-10-17",sku:"TEE-M",destination:"WH1",quantity:10.5},
  {date:"2026-10-17",sku:"TEE-M",destination:"",quantity:100}
 ])assert.throws(()=>validateDispatchPlan(bad));
});
test("Transit exceptions are requests only; no stock movement",()=>{
 const bundle={stage:"TRANSIT_WAREHOUSE",qty:6};
 assert.deepEqual(validateDispatchException({
  category:"CARTON_DAMAGE",quantity:2,reason:"Damaged outer carton found"
 },bundle),{category:"CARTON_DAMAGE",reason:"Damaged outer carton found",
  quantity:2,stage:"TRANSIT_WAREHOUSE",availablePcs:6});
 for(const bad of [
  [{category:"CARTON_DAMAGE",quantity:7,reason:"Damaged outer carton found"},bundle],
  [{category:"CARTON_DAMAGE",quantity:1.1,reason:"Damaged outer carton found"},bundle],
  [{category:"CARTON_DAMAGE",quantity:2,reason:"Few"},bundle],
  [{category:"UNKNOWN",quantity:2,reason:"Damaged outer carton found"},bundle],
  [{category:"CARTON_DAMAGE",quantity:2,reason:"Damaged outer carton found"},{stage:"WAREHOUSE:WH1",qty:6}]
 ])assert.throws(()=>validateDispatchException(...bad));
});
test("Head read-only, Staff write and department subscription are isolated",()=>{
 const base={department:"DISPATCH",accessPolicyVersion:1,accessScope:"DEPARTMENT"};
 const head={...base,role:"department_incharge",permissions:["department.dispatch.read"]};
 const staff={...base,role:"department_entry",permissions:["department.dispatch.read","department.dispatch.write"]};
 const company={departmentCatalogueVersion:1,enabledDepartments:["DISPATCH"],
 entitlements:{modules:["DISPATCH"],maxDepartments:1}};
 assert.equal(allowedDepartment(head,"DISPATCH",false),true);
 assert.equal(allowedDepartment(head,"DISPATCH",true),false);
 assert.equal(allowedDepartment(staff,"DISPATCH",true),true);
 assert.equal(allowedDepartment({...staff,department:"PACKING"},"DISPATCH",false),false);
 assert.equal(enabledDepartment(company,"DISPATCH"),true);
 assert.equal(enabledDepartment({...company,enabledDepartments:["WAREHOUSE"]},"DISPATCH"),false);
});
