import test from "node:test";
import assert from "node:assert/strict";
import {warehouseOverview} from "../src/erp/warehouseOverviewPolicy.js";
import {countDifference,approveException} from "../src/erp/warehousePolicy.js";
import {allowedDepartment,enabledDepartment} from "../src/erp/departmentPolicy.js";

test("Warehouse stock uses received bundles, inbound transit, shop-bound transit by source warehouse",()=>{
 const lots=[{_id:"l1",code:"LOT-1",sku:"TEE-M",dcNo:"DC-1",orderNo:"ORDER-1",section:"UNIT-1"}];
 const bundles=[
  {_id:"w1",code:"W1",lotId:"l1",qty:20,stage:"WAREHOUSE:WH1",destination:"WH1",bin:"BIN1"},
  {_id:"w2",code:"W2",lotId:"l1",qty:5,stage:"WAREHOUSE:WH1",destination:"WH1"},
  {_id:"t1",code:"T1",lotId:"l1",qty:10,stage:"TRANSIT_WAREHOUSE",destination:"WH1"},
  {_id:"s1",code:"S1",lotId:"l1",qty:3,stage:"TRANSIT_SHOP:SHOP1",
   sourceWarehouse:"WH1",destination:"SHOP1"},
  {_id:"x1",code:"OTHER",lotId:"bad",qty:999,stage:"WAREHOUSE:WH1",destination:"WH1"}
 ];
 const events=[
  {_id:"e1",kind:"TRANSFER",department:"DISPATCH",quantity:15,
   details:{bundle:{_id:"t1",code:"T1",lotId:"l1",stage:"TRANSIT_WAREHOUSE",destination:"WH1"}}},
  {_id:"e2",kind:"TRANSFER",department:"WAREHOUSE",quantity:5,
   details:{bundle:{_id:"w0",parentId:"t1",lotId:"l1",stage:"WAREHOUSE:WH1",destination:"WH1"}}},
  {_id:"e3",kind:"TRANSFER",department:"WAREHOUSE",quantity:3,sourceWarehouse:"WH1",
   details:{bundle:{_id:"s1",lotId:"l1",stage:"TRANSIT_SHOP:SHOP1",destination:"SHOP1"}}},
  {_id:"e4",kind:"TRANSFER",department:"WAREHOUSE",quantity:9,reversedBy:"undo",
   details:{bundle:{_id:"extra",parentId:"t1",stage:"WAREHOUSE:WH1",destination:"WH1"}}}
 ];
 const masters=[
  {kind:"WAREHOUSE",key:"WH1",name:"Warehouse A",active:true},
  {kind:"WAREHOUSE",key:"WH2",name:"Warehouse B",active:false},
  {kind:"SHOP",key:"SHOP1",name:"Shop One",active:true},
  {kind:"BIN",key:"BIN1",warehouse:"WH1",rack:"R1",bin:"B1",active:true},
  {kind:"BIN",key:"BIN2",warehouse:"WH2",rack:"R2",bin:"B2",active:true}
 ];
 const exceptions=[{_id:"q1",bundleId:"w2",stage:"WAREHOUSE:WH1",destination:"WH1",
  expectedQty:5,countedQty:3,kind:"MISSING",status:"PENDING",reason:"Counted again"},
  {_id:"q2",bundleId:"w1",stage:"WAREHOUSE:WH1",destination:"WH1",
   expectedQty:20,countedQty:20,kind:"DAMAGED",status:"REJECTED"},
  {_id:"q3",bundleId:"w3",stage:"WAREHOUSE:WH2",destination:"WH2",
   expectedQty:10,countedQty:5,kind:"MISSING",status:"PENDING"}];
 const out=warehouseOverview(lots,bundles,events,masters,exceptions,
  [{code:"TEE-M",colour:"RED",size:"M"}],new Date("2026-10-17T12:00:00Z"));
 assert.equal(out.summary.warehouseStockPcs,25);
 assert.equal(out.summary.warehouseBundles,2);
 assert.equal(out.summary.inboundTransitPcs,10);
 assert.equal(out.summary.inboundTransitBundles,1);
 assert.equal(out.summary.outboundTransitPcs,3);
 assert.equal(out.summary.outboundTransitBundles,1);
 assert.equal(out.summary.unassignedBinPcs,5);
 assert.equal(out.summary.openCountRequests,1);
 assert.equal(out.stocks.length,2);
 assert.equal(out.bundles.length,4);
 assert.equal(out.locations.length,1);
 assert.equal(out.bins.length,1);
 assert.equal(out.shops.length,1);
 assert.equal(out.inbound.length,1);
 assert.equal(out.inbound[0].receivedPcs,5);
 assert.equal(out.inbound[0].pendingPcs,10);
 assert.equal(out.inbound[0].status,"PARTIAL_RECEIPT");
 assert.equal(out.history.length,2);
 assert.equal(out.history.find(x=>x.kind==="TRANSFER"&&x.stage==="TRANSIT_SHOP:SHOP1").warehouse,"WH1");
 assert.equal(out.requests.length,2);
 assert.equal(out.requests[0].differencePcs,2);
});
test("Warehouse receipt / return origin is confirmed by independent warehouse TRANSFER",()=>{
 const lots=[{_id:"l",sku:"SHIRT-L",code:"LOT-2",dcNo:"DC2"}];
 const events=[
  {_id:"shop",kind:"TRANSFER",department:"SHOP",quantity:12,
   details:{bundle:{_id:"T2",lotId:"l",code:"RETURN-1",stage:"TRANSIT_WAREHOUSE",destination:"WH1"}}},
  {_id:"receipt",kind:"TRANSFER",department:"WAREHOUSE",quantity:12,
   details:{bundle:{_id:"W2",parentId:"T2",lotId:"l",stage:"WAREHOUSE:WH1",destination:"WH1"}}}
 ];
 const out=warehouseOverview(lots,[],events,[{kind:"WAREHOUSE",key:"WH1"}],[],[]);
 assert.equal(out.inbound.length,1);
 assert.equal(out.inbound[0].origin,"SHOP");
 assert.equal(out.inbound[0].status,"RECEIVED");
 assert.equal(out.inbound[0].pendingPcs,0);
});
test("Physical count difference cannot post automatic loss; independent admin approval rejects changed stock",()=>{
 assert.equal(countDifference(30,26),4);
 assert.throws(()=>countDifference(30,30));
 assert.throws(()=>countDifference(30,35));
 const request={status:"PENDING",requestedBy:"STAFF1",expectedQty:30,countedQty:26,
   stage:"WAREHOUSE:WH1",destination:"WH1"};
 const bundle={qty:30,stage:"WAREHOUSE:WH1",destination:"WH1"};
 assert.equal(approveException(request,bundle,"ADMIN2"),4);
 assert.throws(()=>approveException(request,bundle,"STAFF1"));
 assert.throws(()=>approveException(request,{...bundle,qty:28},"ADMIN2"));
});
test("Warehouse role/subscription gate: Head read-only, Staff write only Warehouse",()=>{
 const base={department:"WAREHOUSE",accessScope:"DEPARTMENT",accessPolicyVersion:1};
 const head={...base,role:"department_incharge",permissions:["department.warehouse.read"]};
 const staff={...base,role:"department_entry",permissions:["department.warehouse.read","department.warehouse.write"]};
 const company={departmentCatalogueVersion:1,enabledDepartments:["WAREHOUSE"],
  entitlements:{modules:["WAREHOUSE"],maxDepartments:1}};
 assert.equal(allowedDepartment(head,"WAREHOUSE",false),true);
 assert.equal(allowedDepartment(head,"WAREHOUSE",true),false);
 assert.equal(allowedDepartment(staff,"WAREHOUSE",true),true);
 assert.equal(allowedDepartment({...staff,department:"SHOP"},"WAREHOUSE",false),false);
 assert.equal(enabledDepartment(company,"WAREHOUSE"),true);
 assert.equal(enabledDepartment({...company,enabledDepartments:["SHOP"]},"WAREHOUSE"),false);
});
