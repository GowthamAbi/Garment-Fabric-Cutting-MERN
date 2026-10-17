import {useEffect,useMemo,useState} from "react";
import {useAuth} from "../../context/AuthContext.jsx";
import {api} from "../../api.js";
import {Activity,Boxes,ClipboardList,Clock3,FileText,RefreshCw} from "lucide-react";
import {DEPARTMENTS,departmentCode} from "../../../../shared/departmentCatalogue.js";
import {roleDepartmentPages} from "../../config/roleDepartmentNavigation.mjs";

const safeCount=value=>Array.isArray(value)?value.length:0;
const number=n=>new Intl.NumberFormat("en-IN").format(n);

export default function DepartmentDashboardPage({onPageChange}){
 const {user}=useAuth();
 const department=departmentCode(user?.department);
 const [data,setData]=useState(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const valid=DEPARTMENTS.includes(department);

 async function reload(){
  if(!valid)return;
  setBusy(true);setError("");
  try{setData(await api("/erp/departments/"+encodeURIComponent(department)+"/dashboard"))}
  catch(err){setData(null);setError(err?.message||"Unable to load department overview")}
  finally{setBusy(false)}
 }
 useEffect(()=>{setData(null);reload()},[department]);
 const metrics=useMemo(()=>data?[
  {label:"Work in progress",value:safeCount(data.bundles),icon:Activity},
  {label:"Master records",value:safeCount(data.masters),icon:Boxes},
  {label:"Material / handover history",value:safeCount(data.externalHistory),icon:Clock3},
  {label:"Stock balance rows",value:safeCount(data.coreBalances),icon:ClipboardList},
  ...(department==="SHOP"?[{label:"Sales records",value:safeCount(data.sales),icon:FileText}]:[])
 ]:[],[data,department]);
 if(!valid)return <p role="alert">This department is not yet licensed or available.</p>;
 const owner=["company_owner","company_admin","admin"].includes(user?.role);
 const head=user?.role==="department_incharge";
 const allowed=roleDepartmentPages(user);
 const canSubmit=allowed.some(p=>p.page==="Department Approval Requests");
 const canApprove=allowed.some(p=>p.page==="Management Approval Inbox");
 return <section className="department-overview-live">
  <header className="executive-hero department">
   <div><small>DEPARTMENT WORKSPACE</small><h1>{department}</h1>
    <p>{head?"Monitor work in progress, stock and approvals.":"View live assigned work and use your authorised department screens."}</p></div>
   <span>{head?"Department Head":user?.role==="department_entry"?"Department Staff":user?.role}</span>
  </header>
  <div className="department-actions">
   <button type="button" onClick={()=>onPageChange("Department Workspace:"+department)}>Open {department} Workspace</button>
   {canSubmit&&<button type="button" onClick={()=>onPageChange("Department Approval Requests")}>Submit Request</button>}
   {canApprove&&<button type="button" onClick={()=>onPageChange("Management Approval Inbox")}>Review Approvals</button>}
   <button type="button" disabled={busy} onClick={reload}><RefreshCw size={16} aria-hidden="true"/> Refresh</button>
  </div>
  {busy&&!data&&<p role="status">Loading live department information…</p>}
  {error&&<p role="alert" className="erp-error">{error}</p>}
  {data&&<div className="department-board" aria-label="Department live metrics">
    {metrics.map(({label,value,icon:Icon})=><article className="erp-card" key={label}>
      <Icon size={22} aria-hidden="true"/>
      <small>{label}</small><strong>{number(value)}</strong>
     </article>)}
    {metrics.length===0&&<p>No department entries yet.</p>}
  </div>}
  {data&&<div className="erp-card"><h2>Recent department movements</h2>
   {safeCount(data.externalHistory)===0?<p>No recorded handovers yet.</p>:
    <div className="erp-table"><table><thead><tr><th>Reference</th><th>Event type</th><th>Status</th></tr></thead><tbody>
      {data.externalHistory.slice(0,10).map(row=><tr key={row._id}>
       <td>{row.reference||row.key||String(row._id)}</td><td>{row.kind}</td><td>{row.status||"Recorded"}</td>
      </tr>)}
    </tbody></table></div>}
  </div>}
  {!owner&&<p className="department-note">All stock changes and approvals require the permissions assigned to your login. Menu visibility alone does not authorise a database change.</p>}
 </section>;
}
