import {useEffect,useState} from "react";
import {api} from "../../api.js";
import {useAuth} from "../../context/AuthContext.jsx";
const types=["MATERIAL_VARIANCE","STOCK_ADJUSTMENT","PRODUCTION_PLAN_CHANGE","REWORK_REJECTION","QUANTITY_MISMATCH","DISPATCH_EXCEPTION","PURCHASE_EXCEPTION"];
export default function DepartmentApprovalQueue(){
 const {user}=useAuth();
 const dept=user?.department||"";
 const canWrite=(user?.permissions||[]).includes(`department.${dept.toLowerCase()}.write`);
 const [rows,setRows]=useState([]),[error,setError]=useState(""),[loading,setLoading]=useState(false);
 const [form,setForm]=useState({type:types[0],title:"",reason:"",reference:"",amount:"0"});
 async function reload(){if(!dept)return;setLoading(true);try{const result=await api("/department-approval-requests?department="+encodeURIComponent(dept));setRows(result.items||[]);setError("");}catch(e){setError(e.message||"Unable to load requests");}finally{setLoading(false)}}
 useEffect(()=>{reload()},[dept]);
 async function decide(id,decision){const reason=window.prompt("Reason for "+decision+" (required):");if(!reason?.trim())return;setLoading(true);try{await api("/department-approval-requests/"+encodeURIComponent(id)+"/decision",{method:"POST",body:JSON.stringify({decision,reason:reason.trim()})});await reload();}catch(err){setError(err.message||"Decision failed")}finally{setLoading(false)}}
 async function submit(e){e.preventDefault();setLoading(true);try{
  await api("/department-approval-requests",{method:"POST",body:JSON.stringify({...form,amount:Number(form.amount)})});
  setForm({type:types[0],title:"",reason:"",reference:"",amount:"0"});await reload();
 }catch(err){setError(err.message||"Unable to submit");}finally{setLoading(false)}}
 return <section style={{maxWidth:1050,margin:"auto",padding:"1rem"}}>
  <h2>{dept} – Department Approval Requests</h2><p>Requests are logged for review. Final approval, escalation and stock/accounting posting are not yet enabled.</p>
  {error&&<p role="alert">{error}</p>}
  {canWrite&&<form onSubmit={submit} style={{display:"grid",gap:12,maxWidth:600}}>
   <label>Request Type <select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{types.map(t=><option key={t}>{t}</option>)}</select></label>
   <label>Title <input required maxLength={160} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
   <label>Reason <textarea required maxLength={2000} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></label>
   <label>Document / Plan Reference <input maxLength={100} value={form.reference} onChange={e=>setForm({...form,reference:e.target.value})}/></label>
   <label>Estimated Amount (INR) <input type="number" min="0" step="0.01" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label>
   <button type="submit" disabled={loading}>Submit Request</button>
  </form>}
  <h3>Department Requests</h3><button type="button" onClick={reload} disabled={loading}>Refresh</button>
  <div style={{overflowX:"auto"}}><table><thead><tr><th>Date</th><th>Type</th><th>Title</th><th>Reference</th><th>Status</th><th>History</th><th>Actions</th></tr></thead><tbody>
   {rows.map(r=><tr key={r._id}><td>{new Date(r.createdAt).toLocaleString()}</td><td>{r.type}</td><td>{r.title}</td><td>{r.reference}</td><td>{r.status}</td><td>{(r.decisions||[]).map((d,i)=><div key={i}>{d.decision} – {d.reason}</div>)}</td><td>{((r.status==="PENDING_HEAD"&&user?.role==="department_incharge")||(r.status==="PENDING_FM"&&user?.role==="management")||(r.status==="PENDING_OWNER"&&user?.role==="company_owner"))&&(user?.permissions||[]).includes("approval."+(r.status==="PENDING_HEAD"?"head":r.status==="PENDING_FM"?"fm":"owner")+"."+r.department.toLowerCase())?<><button type="button" disabled={loading} onClick={()=>decide(r._id,"APPROVE")}>Approve</button><button type="button" disabled={loading} onClick={()=>decide(r._id,"REJECT")}>Reject</button></>:null}</td></tr>)}
  </tbody></table>{!rows.length&&<p>No requests found.</p>}</div>
 </section>;
}
