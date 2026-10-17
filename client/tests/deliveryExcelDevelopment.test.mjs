import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {EXCEL_REQUIREMENTS} from "../../shared/excelRequirementCatalogue.js";
import {excelOptionTarget} from "../src/config/excelOptionNavigation.mjs";
import {roleDepartmentPages} from "../src/config/roleDepartmentNavigation.mjs";
const routes=readFileSync(fileURLToPath(new URL("../src/routes/AppRoutes.jsx",import.meta.url)),"utf8");
const cases=new Set([...routes.matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(x=>x[1]));
const options=EXCEL_REQUIREMENTS.filter(x=>x.area==="Department"&&x.department==="Delivery");
const base={department:"DELIVERY",accessScope:"DEPARTMENT",accessPolicyVersion:1};
const head={...base,role:"department_incharge",permissions:["department.delivery.read","approval.head.delivery"]};
const staff={...base,role:"department_entry",permissions:["department.delivery.read","department.delivery.write"]};
test("Delivery exact workbook has 20 options, 10 Head and 10 Staff",()=>{
 assert.equal(options.length,20);
 for(const [actor,role]of [[head,"Department Head"],[staff,"Inventory / Staff"]]){
  const actual=roleDepartmentPages(actor,{accessAllowed:true,enabledDepartments:["DELIVERY"]})
    .filter(x=>x.excelCell).map(x=>x.excelCell);
  assert.deepEqual(actual,options.filter(x=>x.role===role).map(x=>x.id));
  assert.equal(actual.length,10);
 }
});
test("Every Delivery Excel option routes to an implemented screen case",()=>{
 for(const item of options){
  const page=excelOptionTarget({...item,departmentCode:"DELIVERY"});
  assert.ok(page,`${item.id}: missing route`);
  assert.ok(cases.has(page),`${item.id}: missing screen ${page}`);
 }
});
test("Delivery Head status and Staff handover have dedicated screens",()=>{
 for(const [id,expected] of [["F122","Delivery Completion Monitor"],
  ["F123","Delivery Vendor Status"],["F125","Delivery Balance Monitor"],
  ["F126","Delivery Delay Monitor"],["F138","Delivery Handover Workspace"],
  ["F139","Delivery Vendor Pending"]]){
  const row=options.find(x=>x.id===id);
  assert.equal(excelOptionTarget({...row,departmentCode:"DELIVERY"}),expected);
 }
});
test("Delivery sidebar denied to unsubscribed or other department users",()=>{
 assert.equal(roleDepartmentPages(staff,{accessAllowed:true,enabledDepartments:["FABRIC"]}).length,0);
 const other={...staff,department:"FABRIC",permissions:["department.fabric.read","department.fabric.write"]};
 assert.equal(roleDepartmentPages(other,{accessAllowed:true,enabledDepartments:["FABRIC"]})
  .some(x=>x.excelCell&&options.some(o=>o.id===x.excelCell)),false);
});
