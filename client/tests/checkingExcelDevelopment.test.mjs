import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {EXCEL_REQUIREMENTS} from "../../shared/excelRequirementCatalogue.js";
import {excelOptionTarget} from "../src/config/excelOptionNavigation.mjs";
import {roleDepartmentPages} from "../src/config/roleDepartmentNavigation.mjs";
import {checkingExportRecords} from "../src/config/checkingExport.mjs";
const get=(s)=>readFileSync(fileURLToPath(new URL(s,import.meta.url)),"utf8");
const routes=get("../src/routes/AppRoutes.jsx");
const cases=new Set([...routes.matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(m=>m[1]));
const rows=EXCEL_REQUIREMENTS.filter(r=>r.area==="Department"&&r.department==="Checking");
const base={department:"CHECKING",accessScope:"DEPARTMENT",accessPolicyVersion:1};
const head={...base,role:"department_incharge",permissions:["department.checking.read","approval.head.checking"]};
const staff={...base,role:"department_entry",permissions:["department.checking.read","department.checking.write"]};
test("Checking 21 Excel options: 10 Head and 11 Staff",()=>{
 assert.equal(rows.length,21);
 for(const [user,role,count] of [[head,"Department Head",10],[staff,"Inventory / Staff",11]]){
  const selected=roleDepartmentPages(user,{accessAllowed:true,enabledDepartments:["CHECKING"]})
   .filter(x=>x.excelCell).map(x=>x.excelCell);
  assert.equal(selected.length,count);
  assert.deepEqual(selected,rows.filter(x=>x.role===role).map(x=>x.id));
 }
});
test("Checking workbook items resolve to deployed page cases",()=>{
 for(const item of rows){
  const target=excelOptionTarget({...item,departmentCode:"CHECKING"});
  assert.ok(target,`${item.id}: no target`);
  assert.ok(cases.has(target),`${item.id}: missing page ${target}`);
 }
});
test("Checking UI uses existing audited ERP check and advance API",()=>{
 const source=get("../src/pages/erp/CheckingDepartmentPage.jsx");
 const api=get("../src/api/checkingDepartmentApi.js");
 assert.match(source,/saveCheckingInspection/);
 assert.match(source,/advanceCheckingStage/);
 assert.match(source,/Departments initialDepartment="CHECKING"/);
 assert.match(source,/It does NOT quarantine stock/);
 assert.match(api,/erp\/departments\/check/);
 assert.match(api,/erp\/departments\/advance/);
});
test("QC export selects matching defect, inspection, follow-up and hold data",()=>{
 const data={
  defects:[{category:"STITCHING",inspections:1,reworkPcs:3,oilPcs:2,rejectPcs:1}],
  inspections:[{dcNo:"DC1",lotNo:"L1",total:8,good:2,rework:3,oil:2,reject:1,defect:"STITCHING"}],
  bundles:[{bundleNo:"B1",lotNo:"L1",dcNo:"DC1",stage:"OIL",quantity:2}],
  holds:[{dcNo:"DC1",bundleNo:"B1",category:"FABRIC",status:"PENDING"}],
  history:[],lots:[]
 };
 assert.equal(checkingExportRecords("defects",data,data)[0]["Defect Category"],"STITCHING");
 assert.equal(checkingExportRecords("results",data,data)[0]["Inspected PCS"],8);
 assert.equal(checkingExportRecords("oil",data,data)[0]["Qty PCS"],2);
 assert.equal(checkingExportRecords("followup",data,data)[0]["Qty PCS"],2);
 assert.equal(checkingExportRecords("holds",data,data)[0]["Status"],"PENDING");
});
test("Unlicensed Checking disappears from isolated menu",()=>{
 assert.deepEqual(roleDepartmentPages(staff,{accessAllowed:true,enabledDepartments:["STITCHING"]}),[]);
});
