import {useEffect,useMemo,useRef,useState} from "react";
import {useAuth} from "../../context/AuthContext.jsx";
import {fabricCuttingApi as api} from "../../api/fabricCuttingApi.js";
import {RefreshCcw,Save,Printer,Search,ArrowRightLeft} from "lucide-react";

const blank=()=>({planNo:"",inwardNo:"",colour:"",weightKg:"",notes:""});
const format=n=>Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:3});
const date=v=>v?new Date(v).toLocaleString("en-IN"):"—";
export default function FabricIssueEntryPage({notify}){
 const {user}=useAuth();
 const maySave=["company_owner","company_admin","admin","fabric_admin","fabric_entry"].includes(user?.role)||
  user?.role==="department_entry"&&user.department==="FABRIC"&&(user.permissions||[]).includes("department.fabric.write");
 const [plans,setPlans]=useState([]),[inwards,setInwards]=useState([]),[history,setHistory]=useState([]);
 const [form,setForm]=useState(blank()),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [confirmation,setConfirmation]=useState(null);
 const keyRef=useRef("");
 async function reload(){
  setBusy(true);setError("");
  try{
   const [planRows,inwardRows,issues]=await Promise.all([api.fabricPlans(),api.inwards(),api.fabricIssues()]);
   setPlans(planRows||[]);setInwards(inwardRows||[]);setHistory(issues.items||[]);
  }catch(e){setError(e.message||"Unable to load Fabric Issue records")}
  finally{setBusy(false)}
 }
 useEffect(()=>{reload()},[]);
 const plan=useMemo(()=>plans.find(x=>x.planNo===form.planNo),[plans,form.planNo]);
 const inward=useMemo(()=>inwards.find(x=>x.inwardNo===form.inwardNo),[inwards,form.inwardNo]);
 const selectedColour=plan?.colours?.find(x=>x.colour===form.colour);
 const alreadyIssued=(plan?.allocations||[]).filter(x=>x.colour===form.colour).reduce((n,x)=>n+Number(x.weightKg||0),0);
 const remaining=Math.max(0,Number(selectedColour?.wantedWeightKg||0)-alreadyIssued);
 const inwardColour=inward?.colours?.find(x=>x.colour===form.colour);
 const balance=Number(inwardColour?.balanceWeightKg||0);
 function change(values){setConfirmation(null);keyRef.current="";setForm(old=>({...old,...values}));}
 async function submit(event){
  event.preventDefault();
  if(!maySave)return;
  setError("");setBusy(true);
  if(!keyRef.current)keyRef.current=crypto.randomUUID();
  try{
   const response=await api.saveFabricIssue({...form,weightKg:Number(form.weightKg),key:keyRef.current});
   setConfirmation(response);
   notify?.(response.replayed?"Fabric Issue already recorded":"Fabric Issue saved to stock and plan");
   keyRef.current="";setForm(blank());await reload();
  }catch(e){setError(e.message||"Fabric Issue failed. No stock change confirmed. Retry with the same request key.")}
  finally{setBusy(false)}
 }
 return <section className="fabric-issue-entry">
  <header className="fabric-plan-monitor-heading">
   <div><small>FABRIC · STOCK CONTROL</small><h2>Fabric Issue / Transfer to Cutting</h2>
    <p>Issue KG by Plan, Inward No and Colour. Each completed issue is recorded with its allocated rolls.</p></div>
   <button type="button" onClick={reload} disabled={busy}><RefreshCcw size={16}/> Refresh</button>
  </header>
  {error&&<p className="erp-error" role="alert">{error}</p>}
  {confirmation&&<p role="status" className="erp-success">Issue {confirmation.movement?.planNo} · {format(confirmation.movement?.weightKg)} KG {confirmation.replayed?"(existing request)":"saved successfully"}</p>}
  {maySave?<form className="erp-card fabric-plan-monitor-filters" onSubmit={submit}>
   <label>Production Plan<select required value={form.planNo} onChange={e=>change({planNo:e.target.value,colour:""})}>
    <option value="">Select plan…</option>{plans.filter(p=>["PLANNED","PART_ISSUED"].includes(p.status)).map(p=><option value={p.planNo} key={p._id}>{p.planNo} · {p.orderNo} · {p.itemCode}</option>)}
   </select></label>
   <label>Inward No<select required value={form.inwardNo} onChange={e=>change({inwardNo:e.target.value})}>
    <option value="">Select inward…</option>{inwards.filter(x=>x.status!=="HOLD"&&x.status!=="CLOSED"&&(!plan||x.fabricGroup===plan.fabricGroup)).map(x=><option key={x._id} value={x.inwardNo}>{x.inwardNo} · {x.fabricGroup}</option>)}
   </select></label>
   <label>Colour<select required value={form.colour} onChange={e=>change({colour:e.target.value})}>
    <option value="">Select colour…</option>{(plan?.colours||[]).map(c=><option value={c.colour} key={c.colour}>{c.colour}</option>)}
   </select></label>
   <label>Issue Weight (KG)<input required min="0.001" step="0.001" max={Math.min(remaining,balance)||undefined} type="number" value={form.weightKg} onChange={e=>change({weightKg:e.target.value})}/></label>
   <label>Remarks<input maxLength={300} value={form.notes} onChange={e=>change({notes:e.target.value})}/></label>
   <div><small>Plan pending: <strong>{format(remaining)} KG</strong></small>
    <small style={{display:"block"}}>Inward colour balance: <strong>{format(balance)} KG</strong></small></div>
   <button type="submit" disabled={busy||!plan||!inward||!selectedColour||Number(form.weightKg)<=0||Number(form.weightKg)>Math.min(remaining,balance)}>
    <Save size={16}/> {busy?"Saving…":"Issue to Cutting"}
   </button>
  </form>:<p className="erp-card">This is a read-only Fabric user account. Issue posting requires assigned Staff permission.</p>}
  <div className="erp-card">
   <div className="fabric-plan-monitor-heading"><h3>Fabric Issue History</h3>
    <button type="button" onClick={()=>window.print()}><Printer size={16}/> Print</button></div>
   <div className="erp-table fabric-plan-monitor-table">
    <table><thead><tr><th>Date</th><th>Plan</th><th>Inward</th><th>Colour</th><th>KG</th><th>Roll allocations</th><th>Issued by</th></tr></thead><tbody>
    {history.map(h=><tr key={h._id}><td>{date(h.createdAt)}</td><td>{h.planNo}</td><td>{h.inwardNo}</td><td>{h.colour}</td><td>{format(h.weightKg)}</td><td>{(h.allocations||[]).map((r,i)=><small key={i} style={{display:"block"}}>{r.bundleNo} / {r.batchNo}: {format(r.weightKg)} KG</small>)}</td><td>{h.actorId}</td></tr>)}
    </tbody></table>
   </div>
   {history.length===0&&!busy&&<p>No transactional fabric issues saved yet.</p>}
   <small>Older legacy issue allocations may be visible in Plan Monitoring but are not backfilled here. Issue to Cutting records movements; Cutting receipt and acceptance are managed separately.</small>
  </div>
 </section>;
}
