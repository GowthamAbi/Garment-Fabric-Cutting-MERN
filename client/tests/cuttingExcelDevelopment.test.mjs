import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {EXCEL_REQUIREMENTS} from "../../shared/excelRequirementCatalogue.js";
import {excelOptionTarget} from "../src/config/excelOptionNavigation.mjs";
import {roleDepartmentPages} from "../src/config/roleDepartmentNavigation.mjs";

const routes=readFileSync(fileURLToPath(new URL("../src/routes/AppRoutes.jsx",import.meta.url)),"utf8");
const pages=new Set([...routes.matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(match=>match[1]));
const items=EXCEL_REQUIREMENTS.filter(r=>r.area==="Department"&&r.department==="Cutting");
const base={department:"CUTTING",accessScope:"DEPARTMENT",accessPolicyVersion:1};
const head={...base,role:"department_incharge",permissions:["department.cutting.read"]};
const staff={...base,role:"department_entry",permissions:["department.cutting.read","department.cutting.write"]};
const subscription={accessAllowed:true,enabledDepartments:["CUTTING"]};

test("23 exact Cutting workbook options and 10 Head / 13 Staff menu parity",()=>{
  assert.equal(items.length,23);
  for(const [role,expected,who] of [["Department Head",10,head],["Inventory / Staff",13,staff]]){
    const options=roleDepartmentPages(who,subscription).filter(p=>p.excelCell).map(p=>p.excelCell);
    assert.equal(options.length,expected);
    assert.deepEqual(options,items.filter(i=>i.role===role).map(i=>i.id));
  }
});

test("Cutting master and Head target/actual open dedicated page routes",()=>{
  const headTarget=items.find(x=>x.id==="F36");
  const staffMaster=items.find(x=>x.id==="F46");
  assert.equal(excelOptionTarget({...headTarget,departmentCode:"CUTTING"}),"Cutting Target vs Actual");
  assert.equal(excelOptionTarget({...staffMaster,departmentCode:"CUTTING"}),"Cutting Machine Master");
  assert.ok(pages.has("Cutting Target vs Actual"));
  assert.ok(pages.has("Cutting Machine Master"));
});

test("Cutting menus deny Fabric-only staff and route unknown options safely",()=>{
  const fabric={...staff,department:"FABRIC",permissions:["department.fabric.read","department.fabric.write"]};
  assert.equal(roleDepartmentPages(fabric,{accessAllowed:true,enabledDepartments:["FABRIC"]}).some(r=>r.excelCell&&items.some(i=>i.id===r.excelCell)),false);
  assert.equal(roleDepartmentPages(staff,{accessAllowed:true,enabledDepartments:["FABRIC"]}).length,0);
});
