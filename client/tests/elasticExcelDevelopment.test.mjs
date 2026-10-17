import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {EXCEL_REQUIREMENTS} from "../../shared/excelRequirementCatalogue.js";
import {excelOptionTarget} from "../src/config/excelOptionNavigation.mjs";
import {roleDepartmentPages} from "../src/config/roleDepartmentNavigation.mjs";
const routes=readFileSync(fileURLToPath(new URL("../src/routes/AppRoutes.jsx",import.meta.url)),"utf8");
const cases=new Set([...routes.matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(m=>m[1]));
const elastic=EXCEL_REQUIREMENTS.filter(x=>x.area==="Department"&&x.department==="Elastic");
const base={department:"ELASTIC",accessScope:"DEPARTMENT",accessPolicyVersion:1};
const head={...base,role:"department_incharge",permissions:["department.elastic.read","approval.head.elastic"]};
const staff={...base,role:"department_entry",permissions:["department.elastic.read","department.elastic.write"]};
test("Elastic Excel exact 20 options / 10 Head / 10 Staff",()=>{
 assert.equal(elastic.length,20);
 for(const [who,role]of [[head,"Department Head"],[staff,"Inventory / Staff"]]){
  const actual=roleDepartmentPages(who,{accessAllowed:true,enabledDepartments:["ELASTIC"]})
    .filter(x=>x.excelCell).map(x=>x.excelCell);
  assert.deepEqual(actual,elastic.filter(x=>x.role===role).map(x=>x.id));
  assert.equal(actual.length,10);
 }
});
test("Elastic 20 Head/Staff workbook options have real screen targets",()=>{
 for(const item of elastic){
  const page=excelOptionTarget({...item,departmentCode:"ELASTIC"});
  assert.ok(page,`${item.id} has no route`);
  assert.ok(cases.has(page),`${item.id} maps to missing page ${page}`);
 }
});
test("Elastic stock, issue/return, inward, cutting, correction are distinct workspaces",()=>{
 for(const [id,target]of [["F106","Elastic Inward Workspace"],["F107","Elastic Cutting Plan Workspace"],
 ["F108","Elastic Cutting Entry Workspace"],["F109","Elastic Issue Return Workspace"],
 ["F110","Elastic Stock Workspace"],["F111","Elastic Correction Workspace"]]){
  const item=elastic.find(x=>x.id===id);
  assert.equal(excelOptionTarget({...item,departmentCode:"ELASTIC"}),target);
 }
});
test("Elastic sidebar not offered to unlicensed or other-department accounts",()=>{
 assert.equal(roleDepartmentPages(staff,{accessAllowed:true,enabledDepartments:["FABRIC"]}).length,0);
 const other={...staff,department:"CUTTING",permissions:["department.cutting.read","department.cutting.write"]};
 assert.equal(roleDepartmentPages(other,{accessAllowed:true,enabledDepartments:["CUTTING"]})
   .some(p=>p.excelCell&&elastic.some(e=>e.id===p.excelCell)),false);
});

test("Original Elastic machine Gantt remains wired to progress, cutting and reports",()=>{
 const elasticPage=readFileSync(fileURLToPath(new URL("../src/pages/erp/ElasticDepartmentPage.jsx",import.meta.url)),"utf8");
 const timeline=readFileSync(fileURLToPath(new URL("../src/pages/production/MachineStatusPage.jsx",import.meta.url)),"utf8");
 const machineControl=readFileSync(fileURLToPath(new URL("../src/pages/production/ProductionControlPage.jsx",import.meta.url)),"utf8");
 assert.match(elasticPage,/\["progress","reports","target","cut"\]\.includes\(mode\)/);
 assert.match(elasticPage,/<MachineStatusPage elasticOnly \/>/);
 assert.match(timeline,/getElasticMachineSummary/);
 assert.match(machineControl,/startProductionJob/);
 assert.match(machineControl,/stopProductionJob/);
 assert.match(machineControl,/resumeProductionJob/);
});
