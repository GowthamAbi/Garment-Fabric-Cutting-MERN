import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {EXCEL_REQUIREMENTS} from "../../shared/excelRequirementCatalogue.js";
import {excelOptionTarget} from "../src/config/excelOptionNavigation.mjs";
import {roleDepartmentPages} from "../src/config/roleDepartmentNavigation.mjs";
import {hrExportRecords} from "../src/config/hrExport.mjs";
const get=x=>readFileSync(fileURLToPath(new URL(x,import.meta.url)),"utf8");
const cases=new Set([...get("../src/routes/AppRoutes.jsx")
 .matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(x=>x[1]));
const rows=EXCEL_REQUIREMENTS.filter(x=>x.area==="Department"&&x.department==="HR");
const base={department:"HR",accessScope:"DEPARTMENT",accessPolicyVersion:1};
const head={...base,role:"department_incharge",
 permissions:["department.hr.read","approval.head.hr"]};
const staff={...base,role:"department_entry",
 permissions:["department.hr.read","department.hr.write"]};
test("HR has exactly 21 Excel requirements, 10 Head + 11 Staff",()=>{
 assert.equal(rows.length,21);
 for(const [user,role,count] of [[head,"Department Head",10],[staff,"Inventory / Staff",11]]){
  const ids=roleDepartmentPages(user,{accessAllowed:true,enabledDepartments:["HR"]})
   .filter(x=>x.excelCell).map(x=>x.excelCell);
  assert.equal(ids.length,count);
  assert.deepEqual(ids,rows.filter(x=>x.role===role).map(x=>x.id));
 }
});
test("All HR Excel menu items route to a working shared or HR page",()=>{
 for(const row of rows){
  const to=excelOptionTarget({...row,departmentCode:"HR"});
  assert.ok(to,row.id+" has no target");
  assert.ok(cases.has(to),row.id+" missing AppRoutes case "+to);
 }
});
test("HR uses existing Workforce employee/attendance, gated payroll and immutable distinct records",()=>{
 const api=get("../src/api/hrDepartmentApi.js");
 const server=get("../../server/src/erp/hrDepartmentRoutes.js");
 const page=get("../src/pages/erp/HrDepartmentPage.jsx");
 assert.match(api,/erp\/departments\/hr/);
 assert.match(server,/ErpEmployee/);
 assert.match(server,/ErpAttendance/);
 assert.match(server,/hr\.payroll\.read/);
 assert.match(page,/Attendance Entry \/ Import/);
 assert.match(page,/hr\.payroll\.read/);
 assert.match(page,/No email|Do not enter Aadhaar/);
});
test("HR reports/export never return salary without payroll permission",()=>{
 const rows={
  employees:[{code:"EMP01",name:"Rani",department:"Quality",active:true}],
  attendance:[{employeeCode:"EMP01",date:"2026-10-17",status:"PRESENT"}],
  records:[{kind:"LEAVE",employeeCode:"EMP01",status:"PENDING",payload:{date:"2026-10-17"}},
   {kind:"OVERTIME",employeeCode:"EMP01",payload:{hours:2.5}}],
  payslips:[{employeeCode:"EMP01",period:"2026-10",status:"POSTED",net:420000}],
  permissions:{canPayrollRead:false}
 };
 assert.equal(hrExportRecords("employee",rows)[0].Code,"EMP01");
 assert.equal(hrExportRecords("attendance",rows)[0].Status,"PRESENT");
 assert.equal(hrExportRecords("leave",rows)[0].Status,"PENDING");
 assert.equal(hrExportRecords("overtime",rows)[0].Hours,2.5);
 assert.deepEqual(hrExportRecords("payslip",rows),[]);
 assert.equal(hrExportRecords("payslip",{...rows,permissions:{canPayrollRead:true}})[0]["Net INR"],4200);
});
test("HR option sidebar remains disabled when company subscription lacks HR",()=>{
 assert.deepEqual(roleDepartmentPages(staff,{accessAllowed:true,enabledDepartments:["SHOP"]}),[]);
});
