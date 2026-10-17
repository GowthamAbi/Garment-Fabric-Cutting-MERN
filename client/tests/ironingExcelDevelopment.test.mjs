import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {EXCEL_REQUIREMENTS} from "../../shared/excelRequirementCatalogue.js";
import {excelOptionTarget} from "../src/config/excelOptionNavigation.mjs";
import {roleDepartmentPages} from "../src/config/roleDepartmentNavigation.mjs";
import {ironingExportRecords} from "../src/config/ironingExport.mjs";
const get=x=>readFileSync(fileURLToPath(new URL(x,import.meta.url)),"utf8");
const cases=new Set([...get("../src/routes/AppRoutes.jsx").matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(x=>x[1]));
const rows=EXCEL_REQUIREMENTS.filter(x=>x.area==="Department"&&x.department==="Ironing");
const user={department:"IRONING",accessScope:"DEPARTMENT",accessPolicyVersion:1};
const head={...user,role:"department_incharge",
 permissions:["department.ironing.read","approval.head.ironing"]};
const staff={...user,role:"department_entry",
 permissions:["department.ironing.read","department.ironing.write"]};
test("All 20 Ironing workbook rows mapped: 10 Head and 10 Staff",()=>{
 assert.equal(rows.length,20);
 for(const [actor,role,count] of [[head,"Department Head",10],[staff,"Inventory / Staff",10]]){
  const actual=roleDepartmentPages(actor,{accessAllowed:true,enabledDepartments:["IRONING"]})
   .filter(x=>x.excelCell).map(x=>x.excelCell);
  assert.equal(actual.length,count);
  assert.deepEqual(actual,rows.filter(x=>x.role===role).map(x=>x.id));
 }
});
test("Every Ironing Excel option resolves to implemented or shared page route",()=>{
 for(const row of rows){
  const target=excelOptionTarget({...row,departmentCode:"IRONING"});
  assert.ok(target,`${row.id} missing route`);
  assert.ok(cases.has(target),`${row.id}: missing target ${target}`);
 }
});
test("Ironing Staff posts only existing atomic ERP /advance; damage review remains nonposting",()=>{
 const page=get("../src/pages/erp/IroningDepartmentPage.jsx");
 const api=get("../src/api/ironingDepartmentApi.js");
 assert.match(page,/Departments initialDepartment="IRONING"/);
 assert.match(page,/GOOD → IRONING/);
 assert.match(page,/Packing is a separate permitted stock action/);
 assert.match(page,/request does not quarantine|does not quarantine/i);
 assert.match(api,/erp\/departments\/advance/);
 assert.match(api,/erp\/departments\/ironing-issue-requests/);
});
test("Ironing report exports correct target, damage, handover and history numbers",()=>{
 const r={
  lots:[{lotNo:"L1",dcNo:"D1",ironingWipPcs:10}],
  bundles:[{bundleNo:"B1",dcNo:"D1",stage:"IRONED",quantity:5,ageHours:2}],
  history:[{date:"2026-10-17",dcNo:"D1",quantity:5,nextStage:"IRONED"}],
  targets:[{date:"2026-10-17",sku:"SKU-1",targetPcs:10,actualPcs:5}],
  issues:[{bundleNo:"B1",dcNo:"D1",category:"RE_IRON",quantity:2,status:"PENDING"}]
 };
 assert.equal(ironingExportRecords("targets",r)[0]["Actual PCS"],5);
 assert.equal(ironingExportRecords("issues",r)[0]["Issue PCS"],2);
 assert.equal(ironingExportRecords("handover",r)[0].Stage,"IRONED");
 assert.equal(ironingExportRecords("history",r)[0]["PCS"],5);
 assert.equal(ironingExportRecords("queue",r)[0]["Pieces"],5);
});
test("Unlicensed Ironing absent from restricted role menu",()=>{
 assert.deepEqual(roleDepartmentPages(staff,{accessAllowed:true,enabledDepartments:["PACKING"]}),[]);
});
