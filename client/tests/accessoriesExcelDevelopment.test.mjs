import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {EXCEL_REQUIREMENTS} from "../../shared/excelRequirementCatalogue.js";
import {excelOptionTarget} from "../src/config/excelOptionNavigation.mjs";
import {roleDepartmentPages} from "../src/config/roleDepartmentNavigation.mjs";
const routeText=readFileSync(fileURLToPath(new URL("../src/routes/AppRoutes.jsx",import.meta.url)),"utf8");
const cases=new Set([...routeText.matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(match=>match[1]));
const excel=EXCEL_REQUIREMENTS.filter(x=>x.area==="Department"&&x.department==="Accessories");
const base={department:"ACCESSORIES",accessScope:"DEPARTMENT",accessPolicyVersion:1};
const head={...base,role:"department_incharge",permissions:["department.accessories.read","approval.head.accessories"]};
const staff={...base,role:"department_entry",permissions:["department.accessories.read","department.accessories.write"]};
const subscription={accessAllowed:true,enabledDepartments:["ACCESSORIES"]};
test("Accessories original Excel contains 20, Head 10, Staff 10 options",()=>{
 assert.equal(excel.length,20);
 for(const [actor,role] of [[head,"Department Head"],[staff,"Inventory / Staff"]]){
  const ids=roleDepartmentPages(actor,subscription).filter(x=>x.excelCell).map(x=>x.excelCell);
  assert.deepEqual(ids,excel.filter(x=>x.role===role).map(x=>x.id));
  assert.equal(ids.length,10);
 }
});
test("Every Accessories workbook option has a real case/route rather than unimplemented placeholder",()=>{
 for(const entry of excel){
  const target=excelOptionTarget({...entry,departmentCode:"ACCESSORIES"});
  assert.ok(target,`${entry.id} ${entry.label} missing mapping`);
  assert.ok(cases.has(target),`${entry.id} target ${target} missing page`);
 }
});
test("Before/After Sewing, Stock Correction and Return/Transfer are independent workspaces",()=>{
 for(const [id,expectation]of [["F68","Accessories Before Status"],["F69","Accessories After Status"],
   ["F80","Accessories Before Issue"],["F81","Accessories After Issue"],
   ["F82","Accessories Return Transfer"],["F83","Accessories Adjustment Request"]]){
   const row=excel.find(r=>r.id===id);
   assert.equal(excelOptionTarget({...row,departmentCode:"ACCESSORIES"}),expectation);
 }
});
test("Unsubscribed and wrong department staff cannot view Accessories sidebar",()=>{
 assert.equal(roleDepartmentPages(staff,{accessAllowed:true,enabledDepartments:["FABRIC"]}).length,0);
 assert.equal(roleDepartmentPages({...staff,department:"CUTTING"},
   {accessAllowed:true,enabledDepartments:["CUTTING"]}).some(x=>x.excelCell&&excel.some(e=>e.id===x.excelCell)),false);
});
