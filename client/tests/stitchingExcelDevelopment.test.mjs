import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {EXCEL_REQUIREMENTS} from "../../shared/excelRequirementCatalogue.js";
import {excelOptionTarget} from "../src/config/excelOptionNavigation.mjs";
import {roleDepartmentPages} from "../src/config/roleDepartmentNavigation.mjs";
const routes=readFileSync(fileURLToPath(new URL("../src/routes/AppRoutes.jsx",import.meta.url)),"utf8");
const cases=new Set([...routes.matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(m=>m[1]));
const rows=EXCEL_REQUIREMENTS.filter(r=>r.area==="Department"&&r.department==="Stitching");
const base={department:"STITCHING",accessScope:"DEPARTMENT",accessPolicyVersion:1};
const head={...base,role:"department_incharge",permissions:["department.stitching.read","approval.head.stitching"]};
const staff={...base,role:"department_entry",permissions:["department.stitching.read","department.stitching.write"]};
test("Stitching Excel rows exactly 21: 10 Head and 11 Staff",()=>{
 assert.equal(rows.length,21);
 for(const [actor,role,expected] of [[head,"Department Head",10],[staff,"Inventory / Staff",11]]){
  const selected=roleDepartmentPages(actor,{accessAllowed:true,enabledDepartments:["STITCHING"]})
   .filter(p=>p.excelCell).map(p=>p.excelCell);
  assert.equal(selected.length,expected);
  assert.deepEqual(selected,rows.filter(r=>r.role===role).map(r=>r.id));
 }
});
test("Stitching Excel items resolve to real route cases",()=>{
 for(const item of rows){
  const target=excelOptionTarget({...item,departmentCode:"STITCHING"});
  assert.ok(target,`${item.id} missing navigation`);
  assert.ok(cases.has(target),`${item.id} missing page ${target}`);
 }
});
test("Stitching staff uses existing ERP approval-protected actions and QR trace",()=>{
 const page=readFileSync(fileURLToPath(new URL("../src/pages/erp/StitchingDepartmentPage.jsx",import.meta.url)),"utf8");
 assert.match(page,/Departments initialDepartment="STITCHING"/);
 assert.match(page,/getStitchingOverview/);
 assert.match(page,/Handover to Inward/);
 assert.match(page,/Defect Entry – Integration Required/);
});
test("Unlicensed Stitching is absent from department staff menu",()=>{
 assert.deepEqual(roleDepartmentPages(staff,{accessAllowed:true,enabledDepartments:["FABRIC"]}),[]);
});
