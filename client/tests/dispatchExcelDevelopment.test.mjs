import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {EXCEL_REQUIREMENTS} from "../../shared/excelRequirementCatalogue.js";
import {excelOptionTarget} from "../src/config/excelOptionNavigation.mjs";
import {roleDepartmentPages} from "../src/config/roleDepartmentNavigation.mjs";
import {dispatchExportRecords} from "../src/config/dispatchExport.mjs";
const get=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const cases=new Set([...get("../src/routes/AppRoutes.jsx").matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(x=>x[1]));
const rows=EXCEL_REQUIREMENTS.filter(x=>x.area==="Department"&&x.department==="Despatch");
const base={department:"DISPATCH",accessScope:"DEPARTMENT",accessPolicyVersion:1};
const head={...base,role:"department_incharge",
 permissions:["department.dispatch.read","approval.head.dispatch"]};
const staff={...base,role:"department_entry",
 permissions:["department.dispatch.read","department.dispatch.write"]};
test("Despatch 21 workbook options: Head 10 Staff 11",()=>{
 assert.equal(rows.length,21);
 for(const [user,role,count] of [[head,"Department Head",10],[staff,"Inventory / Staff",11]]){
  const ids=roleDepartmentPages(user,{accessAllowed:true,enabledDepartments:["DISPATCH"]})
    .filter(x=>x.excelCell).map(x=>x.excelCell);
  assert.equal(ids.length,count);
  assert.deepEqual(ids,rows.filter(x=>x.role===role).map(x=>x.id));
 }
});
test("All Despatch workbook options resolve existing route cases",()=>{
 for(const item of rows){
  const target=excelOptionTarget({...item,departmentCode:"DISPATCH"});
  assert.ok(target,`${item.id} missing route`);
  assert.ok(cases.has(target),`${item.id} no AppRoutes case ${target}`);
 }
});
test("Dispatcher posts one atomic transfer with truck details, not a second stock ledger",()=>{
 const page=get("../src/pages/erp/DispatchDepartmentPage.jsx");
 const api=get("../src/api/dispatchDepartmentApi.js");
 const backend=get("../../server/src/erp/departmentRoutes.js");
 assert.match(page,/transferDispatchCarton/);
 assert.match(page,/QRGenerator/);
 assert.match(page,/NOT a GST tax invoice/);
 assert.match(api,/erp\/departments\/transfer/);
 assert.match(backend,/validateDispatchTransport\(req\.body\.dispatch/);
 assert.match(backend,/next='TRANSIT_WAREHOUSE'/);
});
test("CSV exports separate plan, transit, vehicle, ready carton and history",()=>{
 const rows={
  schedules:[{date:"2026-10-17",sku:"TEE-M",plannedPcs:100,actualPcs:40,pendingPcs:60}],
  bundles:[{cartonNo:"CT1",stage:"PACKED",quantity:50}],
  orders:[{orderNo:"O1",readyPackedPcs:50,inTransitPcs:40,cartons:2}],
  history:[{cartonNo:"CT2",shippedPcs:40,receivedPcs:20,pendingReceiptPcs:20,
   status:"PARTIAL_RECEIPT",transport:{vehicleNo:"TN01AB1234"}}],
  exceptions:[{cartonNo:"CT2",category:"SHORT_LOADING",quantity:3,status:"PENDING"}]
 };
 assert.equal(dispatchExportRecords("plan",rows)[0]["Scheduled PCS"],100);
 assert.equal(dispatchExportRecords("ready",rows)[0].Carton,"CT1");
 assert.equal(dispatchExportRecords("transit",rows)[0]["Warehouse Receipt PCS"],20);
 assert.equal(dispatchExportRecords("transport",rows)[0].Vehicle,"TN01AB1234");
 assert.equal(dispatchExportRecords("exception",rows)[0].Status,"PENDING");
 assert.equal(dispatchExportRecords("orders",rows)[0]["Ready PCS"],50);
});
test("Other department or unlicensed factory hides Dispatch menu",()=>{
 assert.deepEqual(roleDepartmentPages(staff,{accessAllowed:true,enabledDepartments:["PACKING"]}),[]);
});
