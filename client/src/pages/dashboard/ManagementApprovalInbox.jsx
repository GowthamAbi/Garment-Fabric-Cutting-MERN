import {useEffect,useState} from "react";
import {api} from "../../api.js";
import {useAuth} from "../../context/AuthContext.jsx";

// Server filters every row by company, factory, approval level and explicit grants.
// No direct stock, production, or payment transaction happens here.
export default function ManagementApprovalInbox(){
 const {user}=useAuth();
 const [data,setData]=useState({level:"",items:[]});
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 async function load(){
  setBusy(true);try{const r=await api("/department-approval-requests/inbox");setData(r);setError("");}catch(e){setError(e.message||"Unable to load approval requests");}finally{setBusy(false)}
 }
 useEffect(()=>{load()},[user?._id]);
 async function decide(id,decision){
  const reason=window.prompt("Reason for "+decision+" (required)");
  if(!reason?.trim())return;
  setBusy(true);try{
   const r=await api("/department-approval-requests/"+encodeURIComponent(id)+"/decision",{method:"POST",body:JSON.stringify({decision,reason:reason.trim()})});
   setNotice(r.message||"Decision recorded");await load();
  }catch(e){setError(e.message||"Unable to record decision");}finally{setBusy(false)}
 }
 return <section style={{maxWidth:1200,margin:"auto",padding:"1rem"}}>
  <h2>{data.level||"Management"} Approval Inbox</h2><p role="status"><strong>{data.pendingCount ?? data.items.length}</strong> pending requests requiring your review (up to 100 shown).</p>
  <p>Pending requests within your assigned factory and approval authority. Decisions do not directly post operational transactions.</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <button type="button" disabled={busy} onClick={load}>Refresh</button>
  <div style={{overflowX:"auto"}}><table><thead><tr><th>Requested</th><th>Department</th><th>Type</th><th>Reference</th><th>Reason</th><th>Amount</th><th>Actions</th></tr></thead>
  <tbody>{data.items.map(row=><tr key={row._id}>
   <td>{new Date(row.createdAt).toLocaleString()}</td><td>{row.department}</td><td>{row.type}</td><td>{row.reference||"—"}</td><td>{row.reason}</td><td>₹{Number(row.amount).toLocaleString("en-IN")}</td>
   <td><button type="button" disabled={busy} onClick={()=>decide(row._id,"APPROVE")}>Approve</button> <button type="button" disabled={busy} onClick={()=>decide(row._id,"REJECT")}>Reject</button></td>
  </tr>)}</tbody></table>{!data.items.length&&<p>No requests awaiting your authorization.</p>}</div>
 </section>;
}
