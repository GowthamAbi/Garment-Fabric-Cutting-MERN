import {useEffect,useState} from "react";
import {api} from "../../api.js";
import {useAuth} from "../../context/AuthContext.jsx";
const types=["MATERIAL_VARIANCE","STOCK_ADJUSTMENT","PRODUCTION_PLAN_CHANGE","REWORK_REJECTION","QUANTITY_MISMATCH","DISPATCH_EXCEPTION","PURCHASE_EXCEPTION"];
const levels=["HEAD","FM","OWNER"];
const blank=()=>Object.fromEntries(levels.map(level=>[level,Object.fromEntries(types.map(type=>[type,0]))]));
export default function CompanyApprovalSettingsPage(){
 const {user}=useAuth();
 const [limits,setLimits]=useState(blank),[configured,setConfigured]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const permitted=["company_owner","company_admin"].includes(user?.role);
 useEffect(()=>{if(!permitted)return;api("/department-approval-requests/settings").then(r=>{setConfigured(r.configured);if(r.limits)setLimits(r.limits)}).catch(e=>setError(e.message))},[permitted]);
 async function save(e){e.preventDefault();setBusy(true);setError("");setMessage("");try{
  await api("/department-approval-requests/settings",{method:"PUT",body:JSON.stringify({limits})});
  setConfigured(true);setMessage("Company approval limits saved.");
 }catch(e){setError(e.message||"Unable to save limits")}finally{setBusy(false)}}
 if(!permitted)return <p role="alert">Not authorized.</p>;
 return <section style={{maxWidth:960,margin:"auto",padding:"1rem"}}>
  <h2>Company Approval Limits</h2><p>Define approval ceilings (INR) by request type. Each row must satisfy Department Head ≤ Factory Manager ≤ Company Owner. No limits are active until saved.</p>
  <p role="status">{configured?"Company settings configured":"Not configured: all approval decisions denied"}</p>
  {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
  <form onSubmit={save}><div style={{overflowX:"auto"}}><table><thead><tr><th>Request Type</th>{levels.map(l=><th key={l}>{l} (₹)</th>)}</tr></thead>
   <tbody>{types.map(t=><tr key={t}><th>{t.replaceAll("_"," ")}</th>{levels.map(l=><td key={l}><input aria-label={l+" "+t} disabled={user.role!=="company_owner"} type="number" min="0" step="0.01" value={limits[l]?.[t]??0} onChange={e=>setLimits(old=>({...old,[l]:{...old[l],[t]:Number(e.target.value)}}))}/></td>)}</tr>)}</tbody></table></div>
   {user.role==="company_owner"&&<button type="submit" disabled={busy}>Save Approval Limits</button>}
  </form><p>These limits control approval-request decisions only. They do not authorize stock, production, payment, or accounting postings.</p>
 </section>;
}
