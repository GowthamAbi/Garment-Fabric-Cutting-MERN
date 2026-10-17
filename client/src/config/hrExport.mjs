const inr=v=>Number((Number(v||0)/100).toFixed(2));
export function hrExportRecords(mode,data={}){
 const {employees=[],attendance=[],records=[],payslips=[],permissions={}}=data;
 const recs=k=>records.filter(r=>Array.isArray(k)?k.includes(r.kind):r.kind===k);
 const rows=rs=>rs.map(r=>({
  Employee:r.employeeCode||"",Kind:r.kind,Status:r.status,
  Date:r.payload?.date||"",Period:r.payload?.period||"",
  Details:r.payload?.notes||r.payload?.reason||r.payload?.reference||"",
  Recorded:r.createdAt||""
 }));
 if(["employee","overview"].includes(mode))return employees.map(e=>({
  Code:e.code,Name:e.name,Department:e.department,Designation:e.designation,
  Active:e.active?"YES":"NO"
 }));
 if(["attendance","monitor"].includes(mode))return attendance.map(a=>({
  Employee:a.employeeCode,Date:a.date,Status:a.status,
  Notes:a.notes
 }));
 if(["leave","requests"].includes(mode))return rows(recs(["LEAVE","CORRECTION"]));
 if(mode==="overtime")return recs("OVERTIME").map(r=>({
  Employee:r.employeeCode,Date:r.payload?.date,Hours:r.payload?.hours,Reason:r.payload?.reason
 }));
 if(mode==="payroll-input")return recs("PAYROLL_INPUT").map(r=>({
  Employee:r.employeeCode,Period:r.payload?.period,"Paid Days":r.payload?.paidDays,
  "Overtime Hours":r.payload?.overtimeHours,Status:r.status
 }));
 if(["payroll","payslip"].includes(mode))return permissions.canPayrollRead?payslips.map(p=>({
  Employee:p.employeeCode,Month:p.period,Status:p.status,
  "Gross INR":inr(p.gross),"Deductions INR":inr(p.deductions),"Net INR":inr(p.net),
  "Accounting Document":p.accountingDocumentId||""
 })):[];
 if(mode==="onboarding")return rows(recs(["ONBOARDING","RECRUITMENT"]));
 if(mode==="shift")return rows(recs("SHIFT"));
 if(mode==="documents"||mode==="compliance")return recs("DOCUMENT_META").map(r=>({
  Employee:r.employeeCode,Document:r.payload?.documentType,
  Reference:r.payload?.reference,Expiry:r.payload?.expiryDate||"",Status:r.status
 }));
 if(mode==="performance")return rows(recs("PERFORMANCE"));
 return rows(records);
}
