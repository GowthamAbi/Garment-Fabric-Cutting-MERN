import test from "node:test";
import assert from "node:assert/strict";
import {EXCEL_REQUIREMENTS,EXCEL_REQUIREMENT_COUNT,EXCEL_DEPARTMENT_CODES,requirementsForRole,outstandingRequirements} from "../../shared/excelRequirementCatalogue.js";
import {getDepartmentSidebar} from "../src/config/departmentRoleSidebars.js";

test("all 466 actual workbook options are retained without claims of completion",()=>{
 assert.equal(EXCEL_REQUIREMENT_COUNT,466);
 assert.equal(EXCEL_REQUIREMENTS.filter(x=>x.area==="Company Admin").length,58);
 assert.equal(EXCEL_REQUIREMENTS.filter(x=>x.area==="Factory Manager").length,74);
 assert.equal(EXCEL_REQUIREMENTS.filter(x=>x.area==="Department").length,334);
 assert.equal(outstandingRequirements().length,466);
 assert.equal(new Set(EXCEL_REQUIREMENTS.map(x=>x.id)).size,466);
});
test("all 16 departments have their exact ordered Head and Staff options",()=>{
 assert.equal(EXCEL_DEPARTMENT_CODES.length,16);
 let total=0;
 for(const department of EXCEL_DEPARTMENT_CODES){
  const head=requirementsForRole("Department",department,"Department Head");
  const staff=requirementsForRole("Department",department,"Inventory / Staff");
  const options={experimentalDepartments:true};
  const headMenu=getDepartmentSidebar(department,"HEAD",options);
  const staffMenu=getDepartmentSidebar(department,"STAFF",options);
  assert.equal(head.length,10,department+" head items");
  assert.equal(headMenu.length,head.length,department+" head menu count");
  assert.equal(staffMenu.length,staff.length,department+" staff menu count");
  assert.deepEqual(headMenu.map(x=>x.label),head.map(x=>x.label));
  assert.deepEqual(staffMenu.map(x=>x.label),staff.map(x=>x.label));
  assert.ok(headMenu.every(x=>x.action!=="write"));
  assert.ok(staffMenu.some(x=>x.action==="write"));
  assert.ok([...headMenu,...staffMenu].every(x=>x.implementationStatus==="UNVERIFIED"));
  total+=head.length+staff.length;
 }
 assert.equal(total,334);
});
test("original source tracking and licensed department guards stay intact",()=>{
 assert.equal(getDepartmentSidebar("HR","HEAD").length,10);
 assert.deepEqual(getDepartmentSidebar("ACCOUNTS","HEAD"),[]);
 assert.equal(getDepartmentSidebar("DESPATCH","HEAD")[0].label,"Dashboard");
 assert.equal(getDepartmentSidebar("FABRIC","STAFF")[0].excelSourceCell,"F16");
 assert.equal(getDepartmentSidebar("FABRIC","STAFF").at(-1).label,"Reports & Print");
 assert.equal(getDepartmentSidebar("CUTTING","HEAD",{enabledDepartments:["FABRIC"]}).length,0);
});
