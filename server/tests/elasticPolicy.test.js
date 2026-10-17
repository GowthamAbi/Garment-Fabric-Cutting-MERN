import test from "node:test";
import assert from "node:assert/strict";
import {elasticMaterialInput,elasticQuantity,elasticStockRows,elasticMovementInput,
 elasticRequirementLines,elasticMovementTag,elasticCutNote,elasticPlanProgress,elasticSizeProgress} from "../src/erp/elasticPolicy.js";
import {allowedDepartment,enabledDepartment} from "../src/erp/departmentPolicy.js";

test("Elastic stock is derived from ERP MTR ledger, no independent balance",()=>{
 const stock=elasticStockRows([{code:"ELA01",name:"Elastic tape",minimumQty:10,unit:"MTR"},
  {code:"ELA02",name:"Elastic band",minimumQty:3,unit:"MTR"}],
  [{sku:"ELA01",location:"ELASTIC",qty:6750},{sku:"ELA02",location:"ACCESSORIES",qty:50000}]);
 assert.equal(stock[0].available,6.75);assert.equal(stock[0].shortage,3.25);
 assert.equal(stock[1].available,0);assert.equal(stock[1].shortage,3);
 assert.equal(stock.filter(s=>s.lowStock).length,2);
});
test("Elastic master validates numeric bounds, MTR units and safe identifiers",()=>{
 assert.deepEqual(elasticMaterialInput({code:"ela01",name:"Cotton elastic",minimumQty:1.125}),
 {code:"ELA01",name:"Cotton elastic",kind:"RAW",unit:"MTR",location:"ELASTIC",
 minimumQty:1.125,active:true});
 for(const q of [0,-1,0.00001,"NaN",1000001,undefined,true]){
   assert.throws(()=>elasticQuantity(q),/quantity|MTR/i);
 }
 assert.equal(elasticQuantity(0,{allowZero:true}),0);
 assert.throws(()=>elasticMaterialInput({code:"INVALID NAME",name:"Elastic"}),/Invalid/);
});
test("Elastic planning uses completed Fabric Cutting actual and approved size measurement",()=>{
 const actual={status:"COMPLETED",lines:[
  {colour:"BLUE",size:"M",actualPcs:100},{colour:"BLUE",size:"L",actualPcs:50}]};
 const master={status:"APPROVED",sizes:[{size:"M",elasticMeasurementMtr:0.45},{size:"L",elasticMeasurementMtr:0.5}]};
 const plan=elasticRequirementLines(actual,master);
 assert.equal(plan.totalPcs,150);assert.equal(plan.totalMtr,70);
 assert.deepEqual(plan.lines.map(x=>x.wantedMtr),[45,25]);
 assert.throws(()=>elasticRequirementLines({...actual,status:"PARTIAL"},master),/Completed/);
 assert.throws(()=>elasticRequirementLines(actual,{...master,sizes:master.sizes.slice(0,1)}),/measurement/);
});
test("Elastic issue, return and progress are net of non-reversed ERP transfers",()=>{
 const plan={planNo:"ELA-001",sku:"ELA01",targetMtr:20};
 const docs=[
  {notes:elasticCutNote("CUT","ELA-001","CUT01"),type:"STOCK_TRANSFER",
    lines:[{sku:"ELA01",qty:10000}]},
  {notes:elasticCutNote("RETURN","ELA-001","RET01"),type:"STOCK_TRANSFER",
    lines:[{sku:"ELA01",qty:2000}]},
  {notes:elasticCutNote("CUT","ELA-001","CUT02"),type:"STOCK_TRANSFER",
    reversedBy:"rev",lines:[{sku:"ELA01",qty:5000}]},
 ];
 assert.deepEqual(elasticMovementTag("ELASTIC|CUT|ELA-001|CUT01"),
   {kind:"CUT",planNo:"ELA-001",reference:"CUT01"});
 assert.deepEqual(elasticMovementTag("BAD|CUT|ELA-001|CUT01"),null);
 assert.equal(elasticMovementInput({sku:"ELA01",reference:"REF-1",quantity:"1.5",action:"RETURN"}).quantity,1.5);
 const progress=elasticPlanProgress([plan],docs)[0];
 assert.equal(progress.cutMtr,8);assert.equal(progress.pendingMtr,12);assert.equal(progress.completionPercent,40);
});
test("Elastic department policy enforces Head read, Staff write, subscribed department",()=>{
 const company={departmentCatalogueVersion:1,enabledDepartments:["ELASTIC"],
  entitlements:{modules:["ELASTIC"],maxDepartments:1}};
 const staff={role:"department_entry",department:"ELASTIC",accessScope:"DEPARTMENT",
   accessPolicyVersion:1,permissions:["department.elastic.read","department.elastic.write"]};
 const head={...staff,role:"department_incharge",permissions:["department.elastic.read"]};
 assert.equal(allowedDepartment(staff,"ELASTIC",true),true);
 assert.equal(allowedDepartment(head,"ELASTIC",true),false);
 assert.equal(allowedDepartment(head,"ELASTIC",false),true);
 assert.equal(allowedDepartment({...staff,department:"CUTTING"},"ELASTIC",false),false);
 assert.equal(enabledDepartment(company,"ELASTIC"),true);
 assert.equal(enabledDepartment({...company,enabledDepartments:["CUTTING"]},"ELASTIC"),false);
});


test("Elastic colour/size cutting and returns are traced separately from shared total",()=>{
 const plan={planNo:"ELA-001",sku:"ELA01",targetMtr:35,lines:[
   {colour:"BLUE",size:"M",wantedMtr:20},{colour:"BLUE",size:"L",wantedMtr:15}]};
 const docs=[
   {notes:elasticCutNote("CUT","ELA-001","CUT-M01","BLUE","M"),type:"STOCK_TRANSFER",lines:[{sku:"ELA01",qty:12000}]},
   {notes:elasticCutNote("CUT","ELA-001","CUT-L01","BLUE","L"),type:"STOCK_TRANSFER",lines:[{sku:"ELA01",qty:10000}]},
   {notes:elasticCutNote("RETURN","ELA-001","RET-M01","BLUE","M"),type:"STOCK_TRANSFER",lines:[{sku:"ELA01",qty:1000}]},
 ];
 assert.deepEqual(elasticMovementTag(docs[0].notes),{kind:"CUT",planNo:"ELA-001",reference:"CUT-M01",
   colour:"BLUE",size:"M"});
 const rows=elasticSizeProgress(plan,docs);
 assert.equal(rows[0].cutMtr,11);assert.equal(rows[0].pendingMtr,9);
 assert.equal(rows[1].cutMtr,10);assert.equal(rows[1].pendingMtr,5);
 assert.equal(elasticPlanProgress([plan],docs)[0].cutMtr,21);
 assert.throws(()=>elasticCutNote("CUT","ELA-001","BAD","INVALID|COLOUR","M"),/Invalid/);
});
