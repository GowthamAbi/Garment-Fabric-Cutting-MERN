import {useEffect,useState} from "react";
import {api} from "../../api.js";
import {DEPARTMENTS} from "../../../../shared/departmentCatalogue.js";
import {useAuth} from "../../context/AuthContext.jsx";
export default function ApprovalGrantsPage(){
 const {user}=useAuth();
 const [users,setUsers]=useState([]),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [selected,setSelected]=useState({}),[enabled,setEnabled]=useState({});
 async function reload(){
  setBusy(true);
  try {const result=await api("/approval-grants");setUsers(result.users||[]);setError("");}
  catch(e){setError(e.message||"Unable to load eligible users");}
  finally{setBusy(false)}
 }
 useEffect(()=>{if(user?.role==="company_owner")reload()},[user?._id]);
 async function save(u){
  const department=selected[u._id]||u.department||"";
  const isEnabled=Boolean(enabled[u._id]);
  if(!DEPARTMENTS.includes(department)){setError("Choose a valid department");return}
  setBusy(true);setError("");setNotice("");
  try{const r=await api("/approval-grants/"+encodeURIComponent(u._id),{method:"PUT",body:JSON.stringify({department,enabled:isEnabled})});setNotice(r.message||"Updated");await reload()}
  catch(e){setError(e.message||"Unable to update grant")}
  finally{setBusy(false)}
 }
 if(user?.role!=="company_owner")return <p role="alert">Company owner required.</p>;
 return <section style={{padding:"1rem",maxWidth:1000,margin:"auto"}}>
  <h2>Department Approval Authority</h2><p>Grant or revoke approval authority for an assigned Department Head or Factory Manager. These grants do not enable operational data entry.</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <button type="button" disabled={busy} onClick={reload}>Refresh Users</button>
  <div style={{overflowX:"auto"}}><table><thead><tr><th>User</th><th>Role</th><th>Department</th><th>Assigned approval grants</th><th>Action</th></tr></thead>
  <tbody>{users.map(u=><tr key={u._id}>
   <td>{u.name} ({u.userId})</td><td>{u.role}</td>
   <td><select aria-label={"Department for "+u.name} value={selected[u._id]||u.department||"FABRIC"} disabled={busy||u.role==="department_incharge"} onChange={e=>setSelected(p=>({...p,[u._id]:e.target.value}))}>{DEPARTMENTS.map(d=><option key={d}>{d}</option>)}</select></td>
   <td>{u.approvalGrants?.join(", ")||"None"}</td>
   <td><label><input type="checkbox" checked={Boolean(enabled[u._id])} disabled={busy} onChange={e=>setEnabled(p=>({...p,[u._id]:e.target.checked}))}/> Grant</label> <button disabled={busy} type="button" onClick={()=>save(u)}>Apply</button></td>
  </tr>)}</tbody></table></div>
  {!users.length&&<p>No eligible Department Head / Factory Manager users found.</p>}
  <p>Company Owner final-level review follows verified ownership; monetary limits are configured separately.</p>
 </section>;
}
