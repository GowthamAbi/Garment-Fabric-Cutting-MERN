import test from "node:test";
import assert from "node:assert/strict";
import {accessoryStockRows,accessoryStageFromNote,accessoriesMovementNote,
validateAccessoryMovement,validateAccessorySku,validateAccessoryPurchase,
validateAccessoryAdjustment} from "../src/erp/accessoriesPolicy.js";
import {allowedDepartment,enabledDepartment} from "../src/erp/departmentPolicy.js";
import {enforceAccessBoundary} from "../src/middleware/accessMiddleware.js";
const subscribed={enabledDepartments:["ACCESSORIES"],departmentCatalogueVersion:1,
  entitlements:{maxDepartments:1,modules:["ACCESSORIES"]}};
const staff={role:"department_entry",department:"ACCESSORIES",accessScope:"DEPARTMENT",
  accessPolicyVersion:1,permissions:["department.accessories.read","department.accessories.write"]};
const head={...staff,role:"department_incharge",permissions:["department.accessories.read"]};
test("Accessories stage issue is tied to posted work order ID and validates quantity",()=>{
 const body={stage:"before_sewing",workOrderId:"abcdabcdabcdabcdabcdabcd",sku:"TRIM-01",
   reference:"DC-001",quantity:1.25};
 const v=validateAccessoryMovement(body);
 assert.equal(v.stage,"BEFORE_SEWING");assert.equal(v.sourceId,body.workOrderId);
 assert.equal(v.quantity,1.25);
 assert.equal(accessoriesMovementNote("ISSUE",v),"ACCESSORIES|ISSUE|BEFORE_SEWING|DC-001");
 assert.deepEqual(accessoryStageFromNote("ACCESSORIES|ISSUE|BEFORE_SEWING|DC-001"),
   {action:"ISSUE",stage:"BEFORE_SEWING",reference:"DC-001"});
 assert.equal(accessoryStageFromNote("UNKNOWN|ISSUE|BEFORE_SEWING"),null);
 for(const changes of [{stage:"UNKNOWN"},{workOrderId:"other"},{quantity:-1},{quantity:0},
   {quantity:0.0001},{reference:"?"},{sku:"?"}]){
   assert.throws(()=>validateAccessoryMovement({...body,...changes}),/Invalid|Quantity|stage|Work Order|reference|SKU/);
 }
 assert.equal(validateAccessoryMovement({...body,stage:"AFTER_SEWING"},"RETURN").stage,"AFTER_SEWING");
});
test("Accessories Master and purchase inputs reject invalid SKU and price",()=>{
 assert.deepEqual(validateAccessorySku({code:"ABC-1",name:"Thread",unit:"PCS",kind:"CONSUMABLE"}),
   {code:"ABC-1",name:"Thread",unit:"PCS",kind:"CONSUMABLE",minimumQty:0,location:"ACCESSORIES",active:true});
 assert.equal(validateAccessoryPurchase({partyCode:"VEND-1",sku:"ABC-1",quantity:10.125,rate:0}).quantity,10.125);
 assert.throws(()=>validateAccessoryPurchase({partyCode:"VEND-1",sku:"ABC-1",quantity:2,rate:-1}),/Rate/);
 assert.throws(()=>validateAccessorySku({code:"ABC-1",name:"",unit:"PCS",kind:"CONSUMABLE"}),/Name/);
 assert.throws(()=>validateAccessorySku({code:"ABC-1",name:"Thread",unit:"PCS",kind:"FINISHED"}),/Consumable/);
});
test("Accessories minimum stock shortage is calculated from ERP ledger in milliunits",()=>{
 const stock=accessoryStockRows([{code:"TRIM1",name:"Thread",unit:"PCS",kind:"CONSUMABLE",minimumQty:10},
 {code:"TRIM2",name:"Button",unit:"PCS",kind:"CONSUMABLE",minimumQty:2}],
 [{location:"ACCESSORIES",sku:"TRIM1",qty:5750},{location:"CUTTING",sku:"TRIM2",qty:50000}]);
 assert.equal(stock[0].available,5.75);assert.equal(stock[0].shortage,4.25);
 assert.equal(stock[1].available,0);assert.equal(stock[1].shortage,2);
 assert.equal(stock.filter(s=>s.lowStock).length,2);
});
test("Accessories adjustment request never carries an inventory mutation",()=>{
 const x=validateAccessoryAdjustment({sku:"TRIM1",countedQty:4.125,reason:"Physical stock shortage"});
 assert.deepEqual(x,{sku:"TRIM1",countedQty:4.125,reason:"Physical stock shortage"});
 assert.throws(()=>validateAccessoryAdjustment({...x,countedQty:-2}),/physical count/);
 assert.throws(()=>validateAccessoryAdjustment({...x,reason:"x"}),/reason/);
});
test("Accessories department authorization: staff writes, head reads, other department and unsubscribed blocked",()=>{
 assert.equal(allowedDepartment(staff,"ACCESSORIES",true),true);
 assert.equal(allowedDepartment(head,"ACCESSORIES",true),false);
 assert.equal(allowedDepartment(head,"ACCESSORIES",false),true);
 assert.equal(enabledDepartment(subscribed,"ACCESSORIES"),true);
 assert.equal(enabledDepartment({...subscribed,enabledDepartments:["FABRIC"]},"ACCESSORIES"),false);
 const req={method:"GET",user:head,accessCompany:subscribed,originalUrl:"/api/erp/departments/accessories/overview"};
 // The shared ERP /departments boundary defers to the authoritative department router.
 assert.doesNotThrow(()=>enforceAccessBoundary(req));
 assert.equal(allowedDepartment({...staff,department:"FABRIC"},"ACCESSORIES",false),false);
});
