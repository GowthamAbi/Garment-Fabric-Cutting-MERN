import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {EXCEL_REQUIREMENTS} from "../../shared/excelRequirementCatalogue.js";
import {EXCEL_PAGE_PREFIX,findExcelDepartmentOption,excelOptionForUser,excelOptionTarget} from "../src/config/excelOptionNavigation.mjs";
import {roleDepartmentPages,rolePageAllowed} from "../src/config/roleDepartmentNavigation.mjs";
const source=readFileSync(fileURLToPath(new URL("../src/routes/AppRoutes.jsx",import.meta.url)),"utf8");
const cases=new Set([...source.matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(m=>m[1]));
const subscription={accessAllowed:true,enabledDepartments:["FABRIC","CUTTING","ACCESSORIES","ELASTIC","DELIVERY","STITCHING","INWARD","CHECKING","IRONING","PACKING","DISPATCH","WAREHOUSE","SHOP","MARKETING"]};

test("every directly mapped Excel option opens a real AppRoutes page; no dead route names",()=>{
 let mapped=0;
 for(const item of EXCEL_REQUIREMENTS.filter(x=>x.area==="Department")){
  const excel=findExcelDepartmentOption(item.id);
  const target=excelOptionTarget(excel);
  if(!target)continue;
  assert.ok(cases.has(target),item.id+": missing route "+target);
  mapped++;
 }
 assert.ok(mapped>=40,"Expected existing routed workflows for core departments");
});
test("Excel option cannot be opened by another department or by the wrong role",()=>{
 const fabricEntry=EXCEL_REQUIREMENTS.find(x=>x.area==="Department"&&x.department.toUpperCase()==="FABRIC"&&x.role==="Inventory / Staff"&&x.label==="Fabric Inward Entry");
 const staff={role:"department_entry",department:"FABRIC",accessPolicyVersion:1,accessScope:"DEPARTMENT",permissions:["department.fabric.read","department.fabric.write"]};
 const head={...staff,role:"department_incharge",permissions:["department.fabric.read"]};
 const cutting={...staff,department:"CUTTING",permissions:["department.cutting.read","department.cutting.write"]};
 assert.ok(excelOptionForUser(staff,fabricEntry.id));
 assert.equal(excelOptionForUser(head,fabricEntry.id),null);
 assert.equal(excelOptionForUser(cutting,fabricEntry.id),null);
 assert.equal(excelOptionForUser(staff,"A4"),null);
 assert.equal(excelOptionTarget(excelOptionForUser(staff,fabricEntry.id)),"Fabric Inward Entry");
 assert.ok(rolePageAllowed(staff,EXCEL_PAGE_PREFIX+fabricEntry.id,subscription));
 assert.equal(rolePageAllowed(cutting,EXCEL_PAGE_PREFIX+fabricEntry.id,subscription),false);
 assert.equal(rolePageAllowed(staff,EXCEL_PAGE_PREFIX+"NONEXISTENT",subscription),false);
});
test("the exact workbook links are visible only while the department is entitled and readable",()=>{
 const head={role:"department_incharge",department:"WAREHOUSE",accessPolicyVersion:1,accessScope:"DEPARTMENT",permissions:["department.warehouse.read","approval.head.warehouse"]};
 const visible=roleDepartmentPages(head,subscription);
 assert.equal(visible.filter(x=>x.page.startsWith(EXCEL_PAGE_PREFIX)).length,10);
 assert.deepEqual(roleDepartmentPages(head,{accessAllowed:true,enabledDepartments:["FABRIC"]}),[]);
 assert.deepEqual(roleDepartmentPages({...head,permissions:[]},subscription),[]);
});
