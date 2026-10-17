import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {EXCEL_REQUIREMENTS} from "../../shared/excelRequirementCatalogue.js";
import {excelOptionTarget} from "../src/config/excelOptionNavigation.mjs";
import {roleDepartmentPages} from "../src/config/roleDepartmentNavigation.mjs";
const src=readFileSync(fileURLToPath(new URL("../src/routes/AppRoutes.jsx",import.meta.url)),"utf8");
const pages=new Set([...src.matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(m=>m[1]));
const source=EXCEL_REQUIREMENTS.filter(x=>x.area==="Department"&&x.department==="Fabric");
const staff={role:"department_entry",department:"FABRIC",accessScope:"DEPARTMENT",accessPolicyVersion:1,permissions:["department.fabric.read","department.fabric.write"]};
const head={...staff,role:"department_incharge",permissions:["department.fabric.read","approval.head.fabric"]};
const subscription={accessAllowed:true,enabledDepartments:["FABRIC"]};

test("all 21 Fabric Excel Head and Staff labels map to existing specific screens",()=>{
 assert.equal(source.length,21);
 for(const item of source){
  const target=excelOptionTarget({...item,departmentCode:"FABRIC"});
  assert.ok(target,"Unmapped Fabric Excel "+item.id+" "+item.label);
  assert.ok(pages.has(target),"Fabric "+item.id+" mapped to missing screen: "+target);
 }
});
test("Fabric Head/Staff menus expose exactly 10/11 workbook entries",()=>{
 for(const [user,role,n] of [[head,"Department Head",10],[staff,"Inventory / Staff",11]]){
  const visible=roleDepartmentPages(user,subscription);
  const refs=visible.filter(x=>x.excelCell).map(x=>x.excelCell);
  const expected=source.filter(x=>x.role===role).map(x=>x.id);
  assert.equal(refs.length,n);
  assert.deepEqual(refs,expected);
 }
});
test("Fabric module does not expose role menus to cross-department staff",()=>{
 const x={...staff,department:"CUTTING",permissions:["department.cutting.read","department.cutting.write"]};
 const pages=roleDepartmentPages(x,{accessAllowed:true,enabledDepartments:["CUTTING"]});
 assert.equal(pages.some(p=>p.excelCell&&source.some(s=>s.id===p.excelCell)),false);
});
