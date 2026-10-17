import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {EXCEL_REQUIREMENTS} from "../../shared/excelRequirementCatalogue.js";
import {excelOptionTarget} from "../src/config/excelOptionNavigation.mjs";
import {roleDepartmentPages} from "../src/config/roleDepartmentNavigation.mjs";
const get=(name)=>readFileSync(fileURLToPath(new URL(name,import.meta.url)),"utf8");
const routes=get("../src/routes/AppRoutes.jsx");
const cases=new Set([...routes.matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(m=>m[1]));
const rows=EXCEL_REQUIREMENTS.filter(r=>r.area==="Department"&&r.department==="Inward");
const base={department:"INWARD",accessScope:"DEPARTMENT",accessPolicyVersion:1};
const head={...base,role:"department_incharge",
 permissions:["department.inward.read","approval.head.inward"]};
const staff={...base,role:"department_entry",
 permissions:["department.inward.read","department.inward.write"]};
test("Inward workbook has exactly 10 Head and 11 Staff rows",()=>{
 assert.equal(rows.length,21);
 for(const [actor,role,count] of [[head,"Department Head",10],[staff,"Inventory / Staff",11]]){
  const selected=roleDepartmentPages(actor,{accessAllowed:true,enabledDepartments:["INWARD"]})
   .filter(x=>x.excelCell).map(x=>x.excelCell);
  assert.equal(selected.length,count);
  assert.deepEqual(selected,rows.filter(r=>r.role===role).map(r=>r.id));
 }
});
test("Every Inward Excel option resolves to a real route case",()=>{
 for(const row of rows){
  const target=excelOptionTarget({...row,departmentCode:"INWARD"});
  assert.ok(target,`${row.id} missing Inward route`);
  assert.ok(cases.has(target),`${row.id} missing AppRoutes case: ${target}`);
 }
});
test("Inward Staff posts using existing ERP transactional advance; no fake local stock",()=>{
 const page=get("../src/pages/erp/InwardDepartmentPage.jsx");
 assert.match(page,/advanceInwardBundle/);
 assert.match(page,/createInwardDiscrepancy/);
 assert.match(page,/Departments initialDepartment="INWARD"/);
 const api=get("../src/api/inwardDepartmentApi.js");
 assert.match(api,/erp\/departments\/advance/);
 assert.match(api,/erp\/departments\/inward-discrepancies/);
});
test("Wrong or unlicensed department cannot see Inward role menu",()=>{
 assert.deepEqual(roleDepartmentPages(staff,{accessAllowed:true,enabledDepartments:["STITCHING"]}),[]);
});
