import "../src/config/mongoosePlugins.js";
import test from "node:test";
import assert from "node:assert/strict";
import { routing,timeWindow,overlap,transition,materialPlan,routeCapacity } from "../src/erp/operationsPolicy.js";
import { commercialReport,needsApproval,exposure } from "../src/erp/commercialPolicy.js";
import { requestHash } from "../src/erp/service.js";
import { calculatePay } from "../src/erp/workforce.js";
import { checkUserQuota } from "../src/utils/entitlementPolicy.js";
import {parseStatement} from "../src/erp/bankPolicy.js";
import {featureAllowed,featureForRequest} from "../src/erp/featurePolicy.js";

test("routing requires ordered cutting/folding and final packing; partial previous-stage capacity is capped",()=>{
  assert.throws(()=>routing(["CUTTING","PACKING"]),/Folding/);
  assert.throws(()=>routing(["FOLDING","CUTTING","PACKING"]),/precede/);
  assert.throws(()=>routing(["CUTTING","FOLDING","FOLDING","PACKING"]),/distinct/);
  const stages=routing(["CUTTING","FOLDING","PACKING"]);
  assert.deepEqual(routeCapacity({stages,qty:10000},[],"CUTTING"),{limit:10000,assigned:0});
  const jobs=[{stage:"CUTTING",status:"COMPLETE",qty:6000},{stage:"CUTTING",status:"RUNNING",qty:4000},{stage:"FOLDING",status:"PLANNED",qty:3000},{stage:"FOLDING",status:"CANCELLED",qty:1000}];
  assert.deepEqual(routeCapacity({stages,qty:10000},jobs,"FOLDING"),{limit:6000,assigned:3000});
});
test("machine event state machine counts running and downtime exactly, rejects invalid transitions",()=>{
  let job={status:"PLANNED",runMs:0,pauseMs:0};
  const at=n=>new Date(n*1000);
  job={...job,...transition(job,{action:"START"},at(0))};
  assert.throws(()=>transition(job,{action:"PAUSE",reason:"BREAKDOWN"},at(10)),/notes/);
  job={...job,...transition(job,{action:"PAUSE",reason:"BREAKDOWN",notes:"belt"},at(10))};
  job={...job,...transition(job,{action:"RESUME"},at(30))};
  job={...job,...transition(job,{action:"COMPLETE"},at(50))};
  assert.equal(job.runMs,30000);assert.equal(job.pauseMs,20000);
  assert.throws(()=>transition(job,{action:"START"},at(60)),/Completed/);
  assert.throws(()=>transition({status:"PAUSED",lastEventAt:at(20)},{action:"RESUME"},at(10)),/clock/);
  assert.equal(transition({status:"PLANNED"},{action:"CANCEL",notes:"replan"},at(0)).status,"CANCELLED");
});
test("schedule boundaries and date hashing distinguish changed times",()=>{
  const a=timeWindow("2026-10-07T08:00:00Z","2026-10-07T09:00:00Z"),b=timeWindow("2026-10-07T09:00:00Z","2026-10-07T10:00:00Z");
  assert.equal(overlap(a,b),false);assert.equal(overlap(a,timeWindow("2026-10-07T08:30:00Z","2026-10-07T10:00:00Z")),true);
  assert.notEqual(requestHash(a),requestHash(b));
  assert.throws(()=>timeWindow("bad","bad"),/valid/);assert.throws(()=>timeWindow("2026-10-01","2026-10-10"),/seven/);
});
test("MRP aggregates orders, subtracts net issued material and excludes WIP/QC/jobwork availability",()=>{
  const wo=id=>({_id:id,lines:[{qty:10000}],metadata:{bom:{outputQty:1000,components:[{sku:"RAW",qty:2000}]}}});
  const a=wo("A"),b=wo("B");
  const documents=[a,b,{type:"MATERIAL_ISSUE",sourceId:"A",lines:[{sku:"RAW",qty:10000}]},{type:"MATERIAL_RETURN",sourceId:"A",lines:[{sku:"RAW",qty:2000}]}];
  const rows=materialPlan([a,b],documents,[{sku:"RAW",location:"FABRIC",qty:15000},{sku:"RAW",location:"WIP:A",qty:8000},{sku:"RAW",location:"QC",qty:99000}],[{code:"RAW",unit:"KG"}]);
  assert.equal(rows[0].required,32000);assert.equal(rows[0].shortage,17000);assert.equal(rows[0].available,15000);
});
test("approval threshold includes inventory value, and disabled policy permits ordinary posting",()=>{
  const plan={type:"WASTE",totals:{gross:0},journals:[{debit:12000}],moves:[{value:-12000}]};
  assert.equal(exposure(plan),12000);assert.equal(needsApproval({approvalThreshold:10000,approvalTypes:["WASTE"]},plan),true);
  assert.equal(needsApproval({approvalThreshold:null,approvalTypes:["WASTE"]},plan),false);
  assert.equal(needsApproval({approvalThreshold:10000,approvalTypes:["PAYMENT"]},plan),false);
});
test("ageing nets linked receipts/returns but excludes reversals; work costs and vendor pending reconcile",()=>{
  const date="2026-08-01",documents=[
    {_id:"I",type:"SALES_INVOICE",number:"INV1",date,partyCode:"CUSTOMER",totals:{gross:11800},metadata:{dueDate:"2026-08-31"}},
    {_id:"D",type:"DISPATCH",sourceId:"I",date,journals:[]},
    {_id:"R",type:"RECEIPT",sourceId:"I",date,journals:[{account:"AR",credit:4000,debit:0}]},
    {_id:"S",type:"SALES_RETURN",sourceId:"D",date,journals:[{account:"AR",credit:1800,debit:0}]},
    {_id:"X",type:"RECEIPT",sourceId:"I",date,reversedBy:"REV",journals:[{account:"AR",credit:6000,debit:0}]},
    {_id:"W",type:"WORK_ORDER",number:"WO",date,lines:[{sku:"FIN",qty:2000}]},
    {type:"MATERIAL_ISSUE",sourceId:"W",date,moves:[{location:"WIP:W",value:5000}]},
    {type:"WORK_COST",sourceId:"W",date,totals:{gross:1000}},
    {type:"PRODUCTION_RECEIPT",sourceId:"W",date,lines:[{qty:1000}],metadata:{cost:3000}},
    {_id:"J",type:"JOBWORK_SEND",date,lines:[{sku:"FIN",qty:2000,unit:"PCS"}],partyCode:"V"},
    {type:"JOBWORK_RECEIPT",sourceId:"J",date,lines:[{sku:"FIN",qty:1500}]}];
  const report=commercialReport(documents,new Date("2026-10-01"));
  assert.equal(report.ageing[0].outstanding,6000);assert.equal(report.ageing[0].bucket,"31–60");
  assert.equal(report.workOrders[0].remainingWipCost,3000);assert.equal(report.jobwork[0].pending,500);
});
test("reviewed payroll rejects negative values, excess deductions and precision loss",()=>{
  assert.equal(calculatePay({basic:"20000",allowance:"5000",overtime:"1000",pf:"1800",tax:"200"}).net,2400000);
  assert.throws(()=>calculatePay({basic:100,pf:101}),/exceed/);
  assert.throws(()=>calculatePay({basic:-10}),/non-negative/);assert.throws(()=>calculatePay({basic:0.001}),/decimals/);
});
test("subscription quotas count pending active accounts and distinct departments",()=>{
  const plan={maxUsers:3,maxDepartments:2};
  checkUserQuota(plan,[{department:"Fabric"}],"Cutting");
  assert.throws(()=>checkUserQuota(plan,[{department:"Fabric"},{department:"Cutting"}],"Delivery"),/department limit/);
  assert.throws(()=>checkUserQuota(plan,[{},{},{}],""),/user limit/);
  assert.throws(()=>checkUserQuota(null,[],""),/configuration/);
});
test("CSV bank import preserves signed paise, parses quoted references and rejects ambiguous data",()=>{
 const rows=parseStatement('\ufeffdate,reference,amount\r\n2026-01-01,"REF,001",1200.25\r\n2026-01-02,PAY-2,-100.50');
 assert.equal(rows[0].reference,"REF,001");assert.equal(rows[0].amount,120025);assert.equal(rows[1].amount,-10050);
 assert.throws(()=>parseStatement('date,reference,amount\n2026-01-01,REF,1\n2026-01-02,REF,2'),/Duplicate/);
 assert.throws(()=>parseStatement('date,reference,amount\n2026-02-30,REF,1'),/date/);
 assert.throws(()=>parseStatement('date,reference,amount\n2026-01-01,REF,0'),/Zero/);
 assert.throws(()=>parseStatement('date,reference,amount\n2026-01-01,REF,1.001'),/amount/);
});
test("explicit ERP plan features enforce access while department-only legacy plans remain compatible",()=>{
 assert.equal(featureAllowed(["Fabric","Cutting"],"ERP_HR"),true);
 assert.equal(featureAllowed(["ERP_CORE","ERP_SHOP_FLOOR"],"ERP_HR"),false);
 assert.equal(featureForRequest("/documents/123/reconcile"),"ERP_FINANCE");
 assert.equal(featureForRequest("/operations/routing"),"ERP_SHOP_FLOOR");
 assert.equal(featureForRequest("/documents","PAYMENT"),"ERP_FINANCE");
});
test("sales-order margin nets returns against invoiced revenue and dispatched COGS",()=>{
 const date="2026-01-01",documents=[{_id:"O",number:"SO",type:"SALES_ORDER",date,partyCode:"C"},
 {_id:"I",type:"SALES_INVOICE",sourceId:"O",date,totals:{net:10000,gross:11800}},
 {_id:"D",type:"DISPATCH",sourceId:"I",date,journals:[{account:"COGS",debit:6000,credit:0}]},
 {type:"SALES_RETURN",sourceId:"D",date,totals:{net:2000},journals:[{account:"COGS",debit:0,credit:1200}]}];
 const row=commercialReport(documents).salesOrders[0];assert.equal(row.sales,8000);assert.equal(row.cogs,4800);assert.equal(row.grossMargin,3200);
});
