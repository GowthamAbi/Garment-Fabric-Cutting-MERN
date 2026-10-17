import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {EXCEL_REQUIREMENTS} from "../../shared/excelRequirementCatalogue.js";
import {excelOptionTarget} from "../src/config/excelOptionNavigation.mjs";
import {roleDepartmentPages} from "../src/config/roleDepartmentNavigation.mjs";
import {packingExportRecords} from "../src/config/packingExport.mjs";
const get=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const cases=new Set([...get("../src/routes/AppRoutes.jsx").matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(x=>x[1]));
const rows=EXCEL_REQUIREMENTS.filter(x=>x.area==="Department"&&x.department==="Packing");
const base={department:"PACKING",accessScope:"DEPARTMENT",accessPolicyVersion:1};
const head={...base,role:"department_incharge",permissions:["department.packing.read","approval.head.packing"]};
const staff={...base,role:"department_entry",permissions:["department.packing.read","department.packing.write"]};
test("Packing workbook contains 21 Excel options: 10 Head 11 Staff",()=>{
 assert.equal(rows.length,21);
 for(const [actor,role,count] of [[head,"Department Head",10],[staff,"Inventory / Staff",11]]){
  const selected=roleDepartmentPages(actor,{accessAllowed:true,enabledDepartments:["PACKING"]})
   .filter(x=>x.excelCell).map(x=>x.excelCell);
  assert.equal(selected.length,count);
  assert.deepEqual(selected,rows.filter(x=>x.role===role).map(x=>x.id));
 }
});
test("All 21 Packing workbook items reach existing dashboard or an actual page",()=>{
 for(const item of rows){
  const page=excelOptionTarget({...item,departmentCode:"PACKING"});
  assert.ok(page,`${item.id} no mapped page`);
  assert.ok(cases.has(page),`${item.id} missing route: ${page}`);
 }
});
test("Packing UI and APIs use ERP transactional /pack, actual QR and no duplicate issue",()=>{
 const page=get("../src/pages/erp/PackingDepartmentPage.jsx");
 const api=get("../src/api/packingDepartmentApi.js");
 assert.match(page,/savePackingCarton/);
 assert.match(page,/QRGenerator/);
 assert.match(page,/Departments initialDepartment="PACKING"/);
 assert.match(page,/does NOT change, reserve or quarantine stock/);
 assert.match(api,/erp\/departments\/pack/);
 assert.match(api,/erp\/departments\/packing-plans/);
 assert.match(api,/erp\/departments\/packing-repack-requests/);
});
test("Packing exports distinct plan, carton, consumption, damage and history rows",()=>{
 const rows={
  plans:[{date:"2026-10-17",sku:"TEE-M",targetPcs:20,actualPcs:15}],
  lots:[{lotNo:"LOT-1",readyToPackPcs:5,packedAwaitingDispatchPcs:15}],
  bundles:[{bundleNo:"BND-1",stage:"IRONED",quantity:5,
   materials:[{sku:"POLY",requiredQty:1,availableQty:3,shortageQty:0,sufficient:true}]},
   {bundleNo:"BND-2",stage:"PACKED",quantity:15,materials:[]}],
  history:[{date:"2026-10-17",cartonNo:"BND-2",quantity:15,
   materials:[{sku:"POLY",quantity:2}]}],
  masters:[{key:"M1",sku:"TEE-M",name:"Master",active:true,materials:[]}],
  issues:[{cartonNo:"BND-2",category:"REPACK",quantity:2,status:"PENDING"}]
 };
 assert.equal(packingExportRecords("plan",rows)[0]["Packed PCS"],15);
 assert.equal(packingExportRecords("entry",rows)[0].Bundle,"BND-1");
 assert.equal(packingExportRecords("material-issue",rows)[0]["Consumed Qty"],2);
 assert.equal(packingExportRecords("materials",rows)[0]["Material SKU"],"POLY");
 assert.equal(packingExportRecords("issue",rows)[0]["Issue PCS"],2);
 assert.equal(packingExportRecords("history",rows)[0]["Packed PCS"],15);
 assert.equal(packingExportRecords("stock",rows).length,2);
});
test("Unlicensed Packing hidden from single-department user menu",()=>{
 assert.deepEqual(roleDepartmentPages(staff,{accessAllowed:true,enabledDepartments:["IRONING"]}),[]);
});
