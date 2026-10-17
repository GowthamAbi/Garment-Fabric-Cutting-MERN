import test from "node:test";
import assert from "node:assert/strict";
import {validateHrEmployee,validateHrAttendance,validateHrRecord,hrOverview}
 from "../src/erp/hrOverviewPolicy.js";
import {DEPARTMENTS,WORKFLOW_DEPARTMENTS} from "../../shared/departmentCatalogue.js";
import {allowedDepartment,enabledDepartment} from "../src/erp/departmentPolicy.js";
import {boundaryOptions} from "../src/erp/boundaryPolicy.js";

test("HR is licensed without inventing garment stock stages",()=>{
 assert.equal(DEPARTMENTS.length,15);
 assert.equal(DEPARTMENTS.at(-1),"HR");
 assert.equal(WORKFLOW_DEPARTMENTS.length,9);
 const company={departmentCatalogueVersion:1,enabledDepartments:["HR"],
  entitlements:{maxDepartments:1,modules:["HR","ERP_HR"]}};
 assert.equal(enabledDepartment(company,"HR"),true);
 assert.equal(enabledDepartment({...company,enabledDepartments:["SHOP"]},"HR"),false);
 assert.equal(boundaryOptions(company,"HR").externalInward,false);
 assert.equal(boundaryOptions(company,"HR").externalOutward,false);
 const head={role:"department_incharge",department:"HR",accessScope:"DEPARTMENT",
  accessPolicyVersion:1,permissions:["department.hr.read"]};
 const staff={...head,role:"department_entry",
  permissions:["department.hr.read","department.hr.write"]};
 assert.equal(allowedDepartment(head,"HR",false),true);
 assert.equal(allowedDepartment(head,"HR",true),false);
 assert.equal(allowedDepartment(staff,"HR",true),true);
 assert.equal(allowedDepartment({...staff,department:"SHOP"},"HR",true),false);
});
test("HR employees and attendance reuse Payroll Workforce identity and strict dates",()=>{
 assert.deepEqual(validateHrEmployee({code:" emp01 ",name:" Rani ",department:"Quality",
  designation:"Operator"}),{code:"EMP01",name:"Rani",department:"Quality",designation:"Operator"});
 assert.deepEqual(validateHrAttendance({employeeCode:" emp01 ",date:"2026-10-17",
  status:"present",notes:"AM shift"}),{employeeCode:"EMP01",date:"2026-10-17",
  status:"PRESENT",notes:"AM shift"});
 for(const v of [
  {employeeCode:"E01",date:"2026-02-30",status:"PRESENT"},
  {employeeCode:"E01",date:"2026-10-17",status:"UNKNOWN"},
  {employeeCode:"E01",date:"2026-10-17",status:""}
 ])assert.throws(()=>validateHrAttendance(v));
 assert.throws(()=>validateHrEmployee({code:"?",name:"Rani"}));
});
test("HR leave, overtime and correction records are non-posting",()=>{
 const leave=validateHrRecord({kind:"LEAVE",employeeCode:"EMP01",
  date:"2026-10-17",toDate:"2026-10-19",reason:"Family leave"});
 assert.equal(leave.status,"PENDING");
 assert.equal(leave.payload.toDate,"2026-10-19");
 assert.equal(validateHrRecord({kind:"OVERTIME",employeeCode:"EMP01",
   date:"2026-10-17",hours:2.5,reason:"Shift handover"}).payload.hours,2.5);
 assert.equal(validateHrRecord({kind:"CORRECTION",employeeCode:"EMP01",
   date:"2026-10-17",target:"ATTENDANCE",reason:"Incorrect punch"}).status,"PENDING");
 assert.throws(()=>validateHrRecord({kind:"LEAVE",employeeCode:"EMP01",
   date:"2026-10-19",toDate:"2026-10-17",reason:"Family leave"}));
 assert.throws(()=>validateHrRecord({kind:"OVERTIME",employeeCode:"EMP01",
   date:"2026-10-17",hours:2.3,reason:"Shift handover"}));
});
test("HR payroll-input record is nonfinancial; documents are references only",()=>{
 const input=validateHrRecord({kind:"PAYROLL_INPUT",employeeCode:"EMP01",
  period:"2026-10",paidDays:26,overtimeHours:4.5});
 assert.deepEqual(input.payload,{period:"2026-10",paidDays:26,overtimeHours:4.5,notes:""});
 assert.equal(input.status,"RECORDED");
 const doc=validateHrRecord({kind:"DOCUMENT_META",employeeCode:"EMP01",
  date:"2026-10-17",reference:"HR-DOC-012",documentType:"Contract"});
 assert.equal(doc.payload.reference,"HR-DOC-012");
 assert.equal(doc.payload.expiryDate,"");
 assert.throws(()=>validateHrRecord({kind:"PAYROLL_INPUT",employeeCode:"EMP01",
  period:"2026-13",paidDays:26,overtimeHours:4}));
 assert.throws(()=>validateHrRecord({kind:"PAYROLL_INPUT",employeeCode:"EMP01",
  period:"2026-10",paidDays:40,overtimeHours:4}));
});
test("HR overview hides all salary figures without distinct hr.payroll.read",()=>{
 const employees=[{code:"EMP01",name:"Rani",active:true,department:"Production"}];
 const attendance=[{employeeCode:"EMP01",date:"2026-10-17",status:"PRESENT"},
 {employeeCode:"OTHER",date:"2026-10-17",status:"ABSENT"}];
 const records=[{_id:"r1",kind:"LEAVE",employeeCode:"EMP01",status:"PENDING",
   payload:{date:"2026-10-17"}},
  {_id:"r2",kind:"OVERTIME",employeeCode:"EMP01",status:"RECORDED",
   payload:{date:"2026-10-17",hours:2.5}},
  {_id:"r3",kind:"DOCUMENT_META",employeeCode:"EMP01",status:"RECORDED",
   payload:{expiryDate:"2026-10-20"}}];
 const payslips=[{_id:"p1",employeeCode:"EMP01",period:"2026-10",
  status:"POSTED",gross:500000,deductions:50000,net:450000}];
 const hidden=hrOverview(employees,attendance,records,payslips,false,new Date("2026-10-17T07:00:00Z"));
 assert.equal(hidden.summary.activeEmployees,1);
 assert.equal(hidden.summary.pendingLeave,1);
 assert.equal(hidden.summary.recordedOvertimeHours,2.5);
 assert.equal(hidden.summary.upcomingDocumentExpiries,1);
 assert.equal(hidden.summary.payslipCount,null);
 assert.deepEqual(hidden.payslips,[]);
 assert.equal(hidden.attendance.length,1);
 const allowed=hrOverview(employees,attendance,records,payslips,true,new Date("2026-10-17T07:00:00Z"));
 assert.equal(allowed.payslips[0].net,450000);
 assert.equal(allowed.summary.payslipCount,1);
});
