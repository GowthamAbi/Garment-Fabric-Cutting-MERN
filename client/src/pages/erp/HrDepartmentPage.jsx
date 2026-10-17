import {useEffect,useMemo,useRef,useState} from "react";
import {Download,Printer,RefreshCw,Save} from "lucide-react";
import {useAuth} from "../../context/AuthContext.jsx";
import {exportCsv} from "../../api.js";
import {getHrOverview,hrCreateEmployee,hrRecordAttendance,hrCreateRecord} from "../../api/hrDepartmentApi.js";
import {hrExportRecords} from "../../config/hrExport.mjs";
import "./HrDepartmentPage.css";
const labels={
 overview:"Employee Overview",monitor:"Attendance & Shift Monitoring",
 leave:"Leave / Overtime Overview",payroll:"Payroll Review",
 performance:"Employee Performance",compliance:"Recruitment / Compliance",
 reports:"HR Reports",employee:"Employee Master",onboarding:"Employee Onboarding",
 attendance:"Attendance Entry / Import",shift:"Shift / Leave Entry",
 overtime:"Overtime Entry", "payroll-input":"Payroll Input Preparation",
 documents:"Employee Documents",requests:"Leave / Correction Request",
 payslip:"Payslip / History"
};
const initial={summary:{},employees:[],attendance:[],records:[],payslips:[],permissions:{}};
const today=()=>new Date().toISOString().slice(0,10);
const money=x=>"₹"+(Number(x||0)/100).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt=x=>Number(x||0).toLocaleString("en-IN");
function Table({head,rows}){
 return <div style={{overflowX:"auto"}}><table className="classic-table" style={{minWidth:790,width:"100%"}}>
 <thead><tr>{head.map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>
 {rows.length?rows.map((r,i)=><tr key={i}>{r.map((x,j)=><td key={j}>{x??"—"}</td>)}</tr>):
 <tr><td colSpan={head.length}>No matching HR records.</td></tr>}</tbody></table></div>;
}
const hrKinds=["ONBOARDING","SHIFT","LEAVE","OVERTIME","PAYROLL_INPUT","DOCUMENT_META","CORRECTION","PERFORMANCE","RECRUITMENT"];
export default function HrDepartmentPage({mode="overview",notify}){
 const {user}=useAuth(),readonly=user?.role==="department_incharge";
 const [period,setPeriod]=useState(()=>today().slice(0,7)),[data,setData]=useState(initial),
  [search,setSearch]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [code,setCode]=useState(""),[name,setName]=useState(""),[department,setDepartment]=useState(""),
  [designation,setDesignation]=useState("");
 const [employeeCode,setEmployeeCode]=useState(""),[date,setDate]=useState(today()),
  [attStatus,setAttStatus]=useState("PRESENT"),[notes,setNotes]=useState("");
 const [csvInput,setCsvInput]=useState(""),[recordKind,setRecordKind]=useState("ONBOARDING"),
  [toDate,setToDate]=useState(today()),[shift,setShift]=useState("GENERAL"),[hours,setHours]=useState(""),
  [paidDays,setPaidDays]=useState(""),[otHours,setOtHours]=useState("0"),
  [reference,setReference]=useState(""),[reason,setReason]=useState(""),
  [target,setTarget]=useState("ATTENDANCE"),[documentType,setDocumentType]=useState("CONTRACT"),
  [expiryDate,setExpiryDate]=useState(""),[candidate,setCandidate]=useState(""),[position,setPosition]=useState("");
 const keys=useRef(Object.fromEntries(["employee","attendance","record"].map(k=>[k,crypto.randomUUID()])));
 const load=async()=>{try{setData(await getHrOverview(period));setError("")}
  catch(e){setError(e.message);notify?.(e.message)}};
 useEffect(()=>{load()},[period]);
 const find=(...v)=>v.some(x=>String(x??"").toLowerCase().includes(search.trim().toLowerCase()));
 const filtered=useMemo(()=>({
  employees:(data.employees||[]).filter(x=>find(x.code,x.name,x.department,x.designation)),
  attendance:(data.attendance||[]).filter(x=>find(x.employeeCode,x.date,x.status)),
  records:(data.records||[]).filter(x=>find(x.employeeCode,x.kind,x.status,x.payload?.notes,x.payload?.reason)),
  payslips:(data.payslips||[]).filter(x=>find(x.employeeCode,x.period))
 }),[data,search]);
 const exportRows=hrExportRecords(mode,{...filtered,permissions:data.permissions||{}});
 const s=data.summary||{};
 const employeeOptions=(data.employees||[]).filter(x=>x.active);
 async function run(e,keyName,action,after){
  e.preventDefault();setBusy(true);setError("");
  try{const result=await action(keys.current[keyName]);keys.current[keyName]=crypto.randomUUID();
   await load();after?.(result);notify?.("HR record saved");}
  catch(err){setError(err.message);notify?.(err.message)}finally{setBusy(false)}
 }
 function employeePick(){
  return <label>Employee<select required value={employeeCode} onChange={e=>setEmployeeCode(e.target.value)}>
   <option value="">Choose active employee</option>
   {employeeOptions.map(x=><option key={x.code} value={x.code}>{x.code} · {x.name}</option>)}
  </select></label>;
 }
 function effectiveKind(){
  if(mode==="shift")return recordKind==="LEAVE"?"LEAVE":"SHIFT";
  if(mode==="requests")return recordKind==="LEAVE"?"LEAVE":"CORRECTION";
  if(mode==="onboarding")return recordKind==="RECRUITMENT"?"RECRUITMENT":"ONBOARDING";
  if(mode==="overtime")return "OVERTIME";
  if(mode==="payroll-input")return "PAYROLL_INPUT";
  if(mode==="documents")return "DOCUMENT_META";
  return "ONBOARDING";
 }
 const kind=effectiveKind(),showRecord=["onboarding","shift","overtime","payroll-input","documents","requests"].includes(mode);
 const kinds=mode==="shift"?["SHIFT","LEAVE"]:mode==="requests"?["LEAVE","CORRECTION"]:
  mode==="onboarding"?["ONBOARDING","RECRUITMENT"]:[kind];
 const applicableKind=kinds.includes(recordKind)?recordKind:kinds[0];
 const recKind=(mode==="overtime"||mode==="payroll-input"||mode==="documents")?kind:applicableKind;
 const selection=filtered.records.filter(x=>{
  const dictionary={
   onboarding:["ONBOARDING","RECRUITMENT"],shift:["SHIFT","LEAVE"],
   requests:["LEAVE","CORRECTION"],overtime:["OVERTIME"],
   "payroll-input":["PAYROLL_INPUT"],documents:["DOCUMENT_META"],
   performance:["PERFORMANCE"],compliance:["RECRUITMENT","ONBOARDING","DOCUMENT_META"]
  };
  return !dictionary[mode]||dictionary[mode].includes(x.kind);
 });
 function recordPayload(key){
  const payload={key,kind:recKind,employeeCode,date,notes,shift,toDate,
   hours:Number(hours),period,paidDays:Number(paidDays),
   overtimeHours:Number(otHours),reference,reason,target,
   documentType,expiryDate,candidate,position};
  return payload;
 }
 return <section className="classic-page hr-dept">
  <header className="classic-title">
   <div><small>HR · {readonly?"DEPARTMENT HEAD / READ ONLY":"STAFF / MANAGEMENT"}</small>
    <h2>{labels[mode]||"HR Operations"}</h2>
    <p>Existing ERP workforce records + permission-gated payroll. Leave/OT records do not automatically pay salary.</p>
   </div><div className="page-actions">
    <button type="button" onClick={load}><RefreshCw size={16}/> Refresh</button>
    <button type="button" disabled={!exportRows.length}
     onClick={()=>exportCsv("hr-"+mode+".xls",exportRows)}><Download size={16}/> Excel</button>
    <button type="button" onClick={()=>window.print()}><Printer size={16}/> Print</button>
   </div>
  </header>
  {error&&<p className="error-text" role="alert">{error}</p>}
  <div className="hr-metrics">
   {Object.entries({"Employees":fmt(s.employees),"Active Employees":fmt(s.activeEmployees),
    "Attendance Rows":fmt(s.attendanceRows),"Open Leave Requests":fmt(s.pendingLeave),
    "Pending Corrections":fmt(s.pendingCorrections),"Recorded OT Hours":fmt(s.recordedOvertimeHours)})
    .map(([name,value])=><div className="classic-card" key={name}><small>{name}</small><h3>{value}</h3></div>)}
  </div>
  <div className="classic-card">
   <div className="hr-controls">
    <label>Search employee / department / status<input value={search}
     onChange={e=>setSearch(e.target.value)} placeholder="Employee code or department"/></label>
    {["payslip","payroll"].includes(mode)&&<label>Payroll month
     <input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label>}
   </div>
   {["overview","employee"].includes(mode)?<Table head={["Code","Name","Department","Designation","Active"]}
    rows={filtered.employees.map(x=>[x.code,x.name,x.department,x.designation,x.active?"YES":"NO"])}/>:
   ["monitor","attendance"].includes(mode)?<Table head={["Employee","Date","Status","Notes"]}
    rows={filtered.attendance.map(x=>[x.employeeCode,x.date,x.status,x.notes])}/>:
   ["payroll","payslip"].includes(mode)?data.permissions?.canPayrollRead?
    <Table head={["Employee","Month","Status","Gross INR","Deductions INR","Net INR","Accounting Document"]}
     rows={filtered.payslips.map(x=>[x.employeeCode,x.period,x.status,money(x.gross),
      money(x.deductions),money(x.net),x.accountingDocumentId||"Not accrued"])}/>:
    <p role="note">Payroll monetary data requires an additional <strong>hr.payroll.read</strong> permission. HR department read alone cannot see salary or payslips.</p>:
   ["leave","requests","shift","overtime","payroll-input","documents","performance","compliance","onboarding"].includes(mode)?
    <Table head={["Employee","Record Type","Date/Period","Status","Summary / Reference"]}
     rows={selection.map(x=>[x.employeeCode||x.payload?.candidate,x.kind,
      x.payload?.date||x.payload?.period,x.status,
      x.payload?.reason||x.payload?.notes||x.payload?.reference||x.payload?.position])}/>:
    <Table head={["Employee","Type","Date/Period","Status","Notes"]}
     rows={filtered.records.map(x=>[x.employeeCode,x.kind,
      x.payload?.date||x.payload?.period,x.status,x.payload?.notes])}/>}
  </div>
  {mode==="employee"&&!readonly&&<div className="classic-card hr-entry">
   <h3>Create ERP Payroll Employee Master</h3>
   <p>Employee code is unique within this factory. Do not enter Aadhaar, bank details or private KYC documents here.</p>
   <form className="form-grid" onSubmit={e=>run(e,"employee",key=>hrCreateEmployee({
    key,code,name,department,designation
   }),()=>{setCode("");setName("");setDepartment("");setDesignation("");})}>
    <label>Employee Code<input required maxLength={60} value={code}
     onChange={e=>setCode(e.target.value.toUpperCase())}/></label>
    <label>Name<input required maxLength={120} value={name}
     onChange={e=>setName(e.target.value)}/></label>
    <label>Department<input maxLength={60} value={department} onChange={e=>setDepartment(e.target.value)}/></label>
    <label>Designation<input maxLength={100} value={designation} onChange={e=>setDesignation(e.target.value)}/></label>
    <button className="primary" type="submit" disabled={busy}><Save size={16}/> Save Employee</button>
   </form>
  </div>}
  {mode==="attendance"&&!readonly&&<div className="classic-card hr-entry">
   <h3>Attendance Entry / Up to 100 CSV Rows</h3>
   <p>Attendance writes to existing Payroll Workforce attendance. Existing employee/date cannot be overwritten: use correction request.</p>
   <form className="form-grid" onSubmit={e=>run(e,"attendance",key=>{
    const rows=csvInput.trim()?csvInput.trim().split(/\r?\n/).map((line,i)=>{
     const parts=line.split(",").map(v=>v.trim());
     if(parts.length<3||parts.length>4)throw new Error("CSV line "+(i+1)+": expected employeeCode,date,status,notes");
     return {employeeCode:parts[0],date:parts[1],status:parts[2],notes:parts[3]||""};
    }):[{employeeCode,date,status:attStatus,notes}];
    return hrRecordAttendance({key,rows});
   },()=>{setCsvInput("");setNotes("");})}>
    {employeePick()}
    <label>Date<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label>
    <label>Status<select value={attStatus} onChange={e=>setAttStatus(e.target.value)}>
     {["PRESENT","ABSENT","HALF_DAY","LEAVE","HOLIDAY"].map(x=><option key={x}>{x}</option>)}
    </select></label>
    <label>Notes<input maxLength={300} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
    <label>CSV (optional; employeeCode,date,status,notes; no quoted commas)
     <textarea rows={4} value={csvInput} onChange={e=>setCsvInput(e.target.value)}
      placeholder={"EMP01,2026-10-17,PRESENT,\nEMP02,2026-10-17,ABSENT,Personal leave"}/></label>
    <button type="submit" className="primary" disabled={busy}>
     <Save size={16}/> Save Attendance / Import</button>
   </form>
  </div>}
  {showRecord&&!readonly&&<div className="classic-card hr-entry">
   <h3>{labels[mode]} — Controlled Record</h3>
   <form className="form-grid" onSubmit={e=>run(e,"record",key=>hrCreateRecord(recordPayload(key)),
    ()=>{setNotes("");setReason("");setReference("");setHours("");setPaidDays("");setCandidate("");setPosition("");})}>
    {kinds.length>1&&<label>Record Type<select value={recKind} onChange={e=>setRecordKind(e.target.value)}>
     {kinds.map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}
    </select></label>}
    {recKind!=="RECRUITMENT"&&employeePick()}
    {recKind==="RECRUITMENT"&&<>
     <label>Candidate name (internal note)<input required value={candidate} onChange={e=>setCandidate(e.target.value)}/></label>
     <label>Vacancy / position<input required value={position} onChange={e=>setPosition(e.target.value)}/></label>
    </>}
    {recKind!=="PAYROLL_INPUT"&&<label>Date (UTC)<input type="date" required value={date}
     onChange={e=>setDate(e.target.value)}/></label>}
    {recKind==="SHIFT"&&<label>Shift<select value={shift} onChange={e=>setShift(e.target.value)}>
     {["GENERAL","MORNING","EVENING","NIGHT"].map(x=><option key={x}>{x}</option>)}
    </select></label>}
    {recKind==="LEAVE"&&<>
     <label>Last Leave Date<input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}/></label>
     <label>Leave Reason<input required minLength={5} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    </>}
    {recKind==="OVERTIME"&&<>
     <label>Worked OT Hours (0.5–16)<input required type="number" min="0.5" max="16" step="0.5"
      value={hours} onChange={e=>setHours(e.target.value)}/></label>
     <label>Overtime reason<input required minLength={5} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    </>}
    {recKind==="PAYROLL_INPUT"&&<>
     <label>Payroll Period<input type="month" required value={period} onChange={e=>setPeriod(e.target.value)}/></label>
     <label>Paid Days<input type="number" step="1" min="0" max="31" required value={paidDays}
      onChange={e=>setPaidDays(e.target.value)}/></label>
     <label>Reviewed OT Hours<input type="number" step="0.5" min="0" max="248" required
      value={otHours} onChange={e=>setOtHours(e.target.value)}/></label>
    </>}
    {["ONBOARDING","PERFORMANCE","DOCUMENT_META"].includes(recKind)&&
     <label>Register Reference<input required minLength={3} maxLength={100} value={reference}
      onChange={e=>setReference(e.target.value)}/></label>}
    {recKind==="DOCUMENT_META"&&<>
     <label>Document Type<input required minLength={3} value={documentType}
      onChange={e=>setDocumentType(e.target.value)}/></label>
     <label>Document Expiry (optional)<input type="date" value={expiryDate}
      onChange={e=>setExpiryDate(e.target.value)}/></label>
    </>}
    {recKind==="CORRECTION"&&<>
     <label>Correction Target<input required minLength={3} value={target} onChange={e=>setTarget(e.target.value)}/></label>
     <label>Correction Reason<input required minLength={8} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    </>}
    <label>Notes<input maxLength={300} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
    <button type="submit" disabled={busy} className="primary"><Save size={16}/> Save HR Record</button>
   </form>
   <p className="hr-help">Leave/correction is a pending request only; shift/OT/payroll inputs do not recalculate wages. Document records are metadata only, no actual file upload.</p>
  </div>}
  {mode==="payroll"&&<p>Official payroll is a separate Workforce workflow with reviewed rule versions and authorized independent GL accrual. A payroll preparation row does not pay an employee.</p>}
  {mode==="performance"&&<p>Employee performance formal ratings/approvals are not auto-derived from attendance. Only separately recorded reviews can be shown.</p>}
  {mode==="compliance"&&<p>Recruitment/onboarding and document-expiry records are a reference register, not verified statutory compliance certification.</p>}
  {mode==="requests"&&<p>Leave and correction requests are not approved by the shared generic inbox yet. Explicit HR manager decision and employee notification remain pending.</p>}
  {mode==="payslip"&&<p>Historical monetary payslips appear only with additional payroll read permission. Payslip preparation, approval and payment remain independent.</p>}
  <small className="hr-help">HR operational data is sensitive. Tenant/factory and department restrictions are required; payroll amounts need extra permission.</small>
 </section>;
}
