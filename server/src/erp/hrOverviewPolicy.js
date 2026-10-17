import ApiError from "../utils/ApiError.js";
const str=(v,name,min=0,max=240)=>{const s=String(v??"").trim();if(s.length<min||s.length>max)throw new ApiError(400,name+" must be "+min+"–"+max+" characters");return s;};
const date=v=>{const s=str(v,"Date",10,10),d=new Date(s);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(d.valueOf())||d.toISOString().slice(0,10)!==s)throw new ApiError(400,"Valid UTC date required");return s;};
const month=v=>{const s=str(v,"Payroll month",7,7);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(s))throw new ApiError(400,"Valid YYYY-MM month required");return s;};
const code=v=>{const s=str(v,"Employee code",2,60).toUpperCase();if(!/^[A-Z0-9_-]+$/.test(s))throw new ApiError(400,"Invalid employee code");return s;};
const whole=(v,name,lo,hi)=>{const n=Number(v);if(v==null||v===""||typeof v==="boolean"||!Number.isSafeInteger(n)||n<lo||n>hi)throw new ApiError(400,name+" must be a whole number "+lo+"–"+hi);return n;};
const hours=(v,name,lo,hi)=>{const n=Number(v);if(v==null||v===""||typeof v==="boolean"||!Number.isFinite(n)||n<lo||n>hi||Math.round(n*2)!==n*2)throw new ApiError(400,name+" requires half-hour precision");return n;};
export const HR_KINDS=Object.freeze(["ONBOARDING","SHIFT","LEAVE","OVERTIME","PAYROLL_INPUT","DOCUMENT_META","CORRECTION","PERFORMANCE","RECRUITMENT"]);
export function validateHrEmployee(v={}){
 return {code:code(v.code),name:str(v.name,"Employee name",2,120),
  department:str(v.department,"Department",0,60),designation:str(v.designation,"Designation",0,100)};
}
export function validateHrAttendance(v={}){
 const employeeCode=code(v.employeeCode),day=date(v.date),status=str(v.status,"Attendance status",1,20).toUpperCase();
 if(!["PRESENT","ABSENT","HALF_DAY","LEAVE","HOLIDAY"].includes(status))throw new ApiError(400,"Invalid attendance status");
 return {employeeCode,date:day,status,notes:str(v.notes,"Notes",0,300)};
}
export function validateHrRecord(input={}){
 const kind=str(input.kind,"HR record type",1,40).toUpperCase();
 if(!HR_KINDS.includes(kind))throw new ApiError(400,"Unrecognized HR activity");
 const employeeCode=kind==="RECRUITMENT"?"":code(input.employeeCode);
 const notes=str(input.notes,"HR note",0,300);
 const payload={};
 if(kind==="RECRUITMENT"){
  payload.candidate=str(input.candidate,"Candidate name",2,100);
  payload.position=str(input.position,"Vacancy/position",2,100);
  payload.date=date(input.date);payload.notes=notes;
 }else if(kind==="PAYROLL_INPUT"){
  payload.period=month(input.period);payload.paidDays=whole(input.paidDays,"Paid days",0,31);
  payload.overtimeHours=hours(input.overtimeHours??0,"Overtime hours",0,248);
  payload.notes=notes;
 }else{
  payload.date=date(input.date);payload.notes=notes;
  if(kind==="ONBOARDING"){payload.reference=str(input.reference,"Onboarding checklist reference",3,100);}
  if(kind==="SHIFT"){payload.shift=str(input.shift,"Shift",2,60);}
  if(kind==="LEAVE"){
   payload.toDate=date(input.toDate);if(payload.toDate<payload.date)throw new ApiError(400,"Leave end precedes start");
   payload.reason=str(input.reason,"Leave reason",5,300);
  }
  if(kind==="OVERTIME"){payload.hours=hours(input.hours,"Overtime hours",0.5,16);
   payload.reason=str(input.reason,"Overtime reason",5,300);}
  if(kind==="DOCUMENT_META"){
   payload.documentType=str(input.documentType,"Document type",3,80);
   payload.reference=str(input.reference,"Non-sensitive register reference",3,100);
   payload.expiryDate=input.expiryDate?date(input.expiryDate):"";
  }
  if(kind==="CORRECTION"){
   payload.target=str(input.target,"Correction target",3,80);
   payload.reason=str(input.reason,"Correction reason",8,300);
  }
  if(kind==="PERFORMANCE"){payload.reference=str(input.reference,"Performance review reference",3,100);
   if(!notes||notes.length<8)throw new ApiError(400,"Performance summary required");}
 }
 return {kind,employeeCode,payload,
  status:["LEAVE","CORRECTION"].includes(kind)?"PENDING":"RECORDED"};
}
export function hrOverview(employees=[],attendance=[],records=[],payslips=[],canPayrollRead=false,now=new Date()){
 const today=now.toISOString().slice(0,10);
 const empSet=new Set(employees.map(e=>e.code));
 const recordsSafe=records.filter(r=>!r.employeeCode||empSet.has(r.employeeCode));
 const active=employees.filter(e=>e.active!==false);
 const summary={employees:employees.length,activeEmployees:active.length,
  attendanceRows:attendance.length,presentDays:attendance.filter(x=>x.status==="PRESENT").length,
  pendingLeave:recordsSafe.filter(x=>x.kind==="LEAVE"&&x.status==="PENDING").length,
  pendingCorrections:recordsSafe.filter(x=>x.kind==="CORRECTION"&&x.status==="PENDING").length,
  recordedOvertimeHours:recordsSafe.filter(x=>x.kind==="OVERTIME").reduce((n,x)=>n+(x.payload?.hours||0),0),
  upcomingDocumentExpiries:recordsSafe.filter(x=>x.kind==="DOCUMENT_META"&&x.payload?.expiryDate&&x.payload.expiryDate>=today&&x.payload.expiryDate<=new Date(now.getTime()+30*86400000).toISOString().slice(0,10)).length,
  payslipCount:canPayrollRead?payslips.length:null};
 return {summary,employees:employees.map(x=>({code:x.code,name:x.name,department:x.department,
  designation:x.designation,active:x.active!==false})),attendance:attendance.filter(x=>empSet.has(x.employeeCode)),
  records:recordsSafe.map(x=>({...x,id:String(x._id)})),
  // Only an additional payroll permission gives access to salary data.
  payslips:canPayrollRead?payslips.map(x=>({id:String(x._id),
   employeeCode:x.employeeCode,period:x.period,status:x.status,
   gross:x.gross,deductions:x.deductions,net:x.net,accountingDocumentId:x.accountingDocumentId})):[],
  permissions:{canPayrollRead},
  notes:{attendance:"Existing ERP Workforce attendance is authoritative; corrections are only requests",
   leave:"Approval/policy impact not automated",overtime:"Hours entry does not calculate salary",
   payrollInput:"Non-financial inputs only; payroll posting remains independent HR/Finance flow",
   documents:"References only, no private document contents or file uploads",
   payslip:"Access requires payroll-specific read permission; preparation is not payment"}};
}
