import test from "node:test";
import assert from "node:assert/strict";
import {shopOverview,validateShopReturnRequest} from "../src/erp/shopOverviewPolicy.js";
import {saleTotals,allowedDepartment,enabledDepartment} from "../src/erp/departmentPolicy.js";
import {countDifference,approveException} from "../src/erp/warehousePolicy.js";
test("Shop live stock and inbound Warehouse transit remain separate",()=>{
 const lots=[{_id:"L1",code:"LOT1",sku:"TEE-M",dcNo:"DC1"}];
 const bundles=[
  {_id:"S1",code:"SHOP1",lotId:"L1",destination:"SHOP-A",stage:"SHOP:SHOP-A",qty:15},
  {_id:"T1",code:"TRANS1",lotId:"L1",destination:"SHOP-A",stage:"TRANSIT_SHOP:SHOP-A",qty:5},
  {_id:"X1",code:"OTHER",lotId:"L1",destination:"SHOP-B",stage:"SHOP:SHOP-B",qty:100},
  {_id:"BAD",code:"BAD",lotId:"OTHER",destination:"SHOP-A",stage:"SHOP:SHOP-A",qty:1000}
 ];
 const events=[
  {_id:"E1",kind:"TRANSFER",department:"WAREHOUSE",quantity:8,
   details:{bundle:{_id:"T1",code:"TRANS1",stage:"TRANSIT_SHOP:SHOP-A",destination:"SHOP-A"}}},
  {_id:"E2",kind:"TRANSFER",department:"SHOP",quantity:3,
   details:{bundle:{_id:"R1",parentId:"T1",stage:"SHOP:SHOP-A",destination:"SHOP-A"}}},
  {_id:"E3",kind:"TRANSFER",department:"SHOP",quantity:99,reversedBy:"undo",
   details:{bundle:{_id:"R2",parentId:"T1",stage:"SHOP:SHOP-A",destination:"SHOP-A"}}}
 ];
 const out=shopOverview(lots,bundles,[],events,[],
  [{kind:"SHOP",key:"SHOP-A",name:"Store A"}],[],[{code:"TEE-M",size:"M",colour:"RED"}]);
 assert.equal(out.summary.shopStockPcs,15);
 assert.equal(out.summary.incomingTransitPcs,5);
 assert.equal(out.stock.length,1);
 assert.equal(out.incoming.length,1);
 assert.equal(out.stockBySku.length,1);
 assert.equal(out.stockBySku[0].size,"M");
 assert.equal(out.receipts.length,1);
 assert.equal(out.receipts[0].sentPcs,8);
 assert.equal(out.receipts[0].receivedPcs,3);
 assert.equal(out.receipts[0].pendingPcs,5);
 assert.equal(out.receipts[0].status,"PARTIAL_RECEIPT");
 assert.equal(out.shops.length,1);
});
test("Shop net margin excludes posted refunds and returned COGS, with paise precision",()=>{
 const invoice={_id:"S1",number:"POS-0001",shop:"SHOP-A",sku:"TEE-M",
  quantity:10,returned:2,paymentMode:"CASH",documentId:"DOC1",
  totals:{net:100000,tax:5000,gross:105000},customer:{name:"Retail Buyer"},
  supplier:{name:"Shop Owner"}};
 const doc={_id:"DOC1",journals:[{account:"COGS",debit:65000}]};
 const event={_id:"R1",kind:"RETURN",department:"SHOP",quantity:2,
  details:{saleId:"S1",refund:{net:20000,tax:1000,gross:21000},cost:13000}};
 const out=shopOverview([],[],[invoice],[event],[doc],[{kind:"SHOP",key:"SHOP-A"}],[],[]);
 assert.equal(out.summary.invoiceCount,1);
 assert.equal(out.summary.netSalesPaise,80000);
 assert.equal(out.summary.salesTaxPaise,4000);
 assert.equal(out.summary.grossSalesPaise,84000);
 assert.equal(out.summary.returnedRefundPaise,21000);
 assert.equal(out.summary.recognizedMarginPaise,28000);
 assert.equal(out.invoices[0].cogsPaise,52000);
 assert.equal(out.invoices[0].marginPaise,28000);
 assert.equal(out.shopSales[0].soldNetPcs,8);
 assert.equal(out.returns[0].refundPaise,21000);
});
test("No fake Shop margin without authoritative COGS journal",()=>{
 const out=shopOverview([],[],[{_id:"S1",number:"INV1",shop:"A",sku:"SKU",
  quantity:1,returned:0,totals:{net:1000,tax:0,gross:1000},documentId:"MISSING"}],
  [],[],[{kind:"SHOP",key:"A"}],[],[]);
 assert.equal(out.summary.invoiceCogsMissing,1);
 assert.equal(out.summary.recognizedMarginPaise,null);
 assert.equal(out.shopSales[0].marginPaise,null);
});
test("Return request checks unreturned invoice pieces, requires reason, does not post a refund",()=>{
 const invoice={quantity:9,returned:3};
 assert.deepEqual(validateShopReturnRequest({
  quantity:2,kind:"QUALITY",reason:"Fabric quality issue"
 },invoice,[{status:"PENDING",quantity:1},{status:"REJECTED",quantity:4}]),{
  quantity:2,kind:"QUALITY",reason:"Fabric quality issue",unreturnedPcs:6,otherPendingPcs:1});
 for(const input of [
  {quantity:7,reason:"Damaged garment found"},
  {quantity:2.5,reason:"Damaged garment found"},
  {quantity:0,reason:"Damaged garment found"},
  {quantity:2,kind:"OTHER",reason:"Damaged garment found"},
  {quantity:2,reason:"Short"}
 ])assert.throws(()=>validateShopReturnRequest(input,invoice));
});
test("Existing POS amounts and independent stock count approval have authorization constraints",()=>{
 const paid=saleTotals(2,100,5,0);
 assert.equal(paid.gross,21000);
 assert.equal(countDifference(20,18),2);
 assert.throws(()=>countDifference(20,22));
 const request={status:"PENDING",requestedBy:"STAFF",expectedQty:20,
  countedQty:18,stage:"SHOP:SHOP-A",destination:"SHOP-A"};
 assert.equal(approveException(request,{qty:20,stage:"SHOP:SHOP-A",destination:"SHOP-A"},"ADMIN"),2);
 assert.throws(()=>approveException(request,{qty:20,stage:"SHOP:SHOP-A",destination:"SHOP-A"},"STAFF"));
 const base={department:"SHOP",accessPolicyVersion:1,accessScope:"DEPARTMENT"};
 const head={...base,role:"department_incharge",permissions:["department.shop.read"]};
 const staff={...base,role:"department_entry",permissions:["department.shop.read","department.shop.write"]};
 const company={departmentCatalogueVersion:1,enabledDepartments:["SHOP"],
  entitlements:{modules:["SHOP"],maxDepartments:1}};
 assert.equal(allowedDepartment(head,"SHOP",false),true);
 assert.equal(allowedDepartment(head,"SHOP",true),false);
 assert.equal(allowedDepartment(staff,"SHOP",true),true);
 assert.equal(allowedDepartment({...staff,department:"WAREHOUSE"},"SHOP",false),false);
 assert.equal(enabledDepartment(company,"SHOP"),true);
 assert.equal(enabledDepartment({...company,enabledDepartments:["WAREHOUSE"]},"SHOP"),false);
});
