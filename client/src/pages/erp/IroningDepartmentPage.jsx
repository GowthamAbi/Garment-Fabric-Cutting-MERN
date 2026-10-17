import {useEffect,useMemo,useRef,useState} from "react";
import {Download,Printer,RefreshCw,Save} from "lucide-react";
import {exportCsv} from "../../api.js";
import {useAuth} from "../../context/AuthContext.jsx";
import {getIroningOverview,saveIroningMovement,saveIroningTarget,saveIroningIssue} from "../../api/ironingDepartmentApi.js";
import {ironingExportRecords} from "../../config/ironingExport.mjs";
import Departments from "./Departments.jsx";

const labels={
 queue:"Ironing Work Queue",targets:"Target vs Actual",status:"Pending & Completed",
 issues:"Re-Ironing / Damage",handover:"Transfer to Packing Status",
 delays:"Production Delays / Ageing",reports:"Ironing Reports",
 received:"Received for Ironing",entry:"Ironing Entry",completed:"Completed Qty",
 damage:"Damage / Re-Ironing Request",qr:"QR / Bundle Status",
 history:"Ironing History",print:"Print & Reports"
};
const defaults={summary:{},lots:[],bundles:[],history:[],targets:[],issues:[]};
const fmt=n=>Number(n||0).toLocaleString("en-IN");
function Table({headers,rows}){
 return <div style={{overflowX:"auto"}}><table className="classic-table" style={{width:"100%",minWidth:770}}>
  <thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead>
  <tbody>{rows.length?rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v??"—"}</td>)}</tr>):
   <tr><td colSpan={headers.length}>No matching ERP Ironing records.</td></tr>}</tbody>
 </table></div>;
}
const categories=["DAMAGE","RE_IRON","STAIN","QUALITY_OTHER"];
export default function IroningDepartmentPage({mode="queue",notify}){
 const {user}=useAuth(),readonly=user?.role==="department_incharge";
 const management=["company_owner","company_admin","admin"].includes(user?.role);
 const [data,setData]=useState(defaults),[search,setSearch]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [bundleId,setBundleId]=useState(""),[qty,setQty]=useState(""),[operator,setOperator]=useState(""),[shift,setShift]=useState("");
 const [category,setCategory]=useState("RE_IRON"),[reason,setReason]=useState("");
 const [targetDate,setTargetDate]=useState(()=>new Date().toISOString().slice(0,10)),[targetSku,setTargetSku]=useState(""),
  [targetOperator,setTargetOperator]=useState("Unassigned"),[targetShift,setTargetShift]=useState("Unassigned"),[targetQty,setTargetQty]=useState("");
 const [ageThreshold,setAgeThreshold]=useState("24");
 const movementKey=useRef(crypto.randomUUID()),issueKey=useRef(crypto.randomUUID()),targetKey=useRef(crypto.randomUUID());
 async function load(){try{setData(await getIroningOverview());setError("")}catch(e){setError(e.message);notify?.(e.message)}}
 useEffect(()=>{load()},[]);
 const match=(...v)=>v.some(x=>String(x??"").toLowerCase().includes(search.trim().toLowerCase()));
 const r=useMemo(()=>({
  lots:(data.lots||[]).filter(x=>match(x.dcNo,x.lotNo,x.sku,x.section,x.orderNo)),
  bundles:(data.bundles||[]).filter(x=>match(x.bundleNo,x.dcNo,x.lotNo,x.sku,x.section,x.stage)),
  history:(data.history||[]).filter(x=>match(x.lotNo,x.dcNo,x.sku,x.operator,x.section)),
  targets:(data.targets||[]).filter(x=>match(x.date,x.sku,x.operator,x.shift)),
  issues:(data.issues||[]).filter(x=>match(x.bundleNo,x.dcNo,x.lotNo,x.category))
 }),[data,search]);
 const list=mode==="received"?r.bundles.filter(x=>x.stage==="GOOD"):
  mode==="entry"?r.bundles.filter(x=>["GOOD","IRONING"].includes(x.stage)):
  mode==="handover"?r.bundles.filter(x=>x.stage==="IRONED"):
  mode==="delays"?r.bundles.filter(x=>["GOOD","IRONING"].includes(x.stage)&&
    x.ageHours!==null&&x.ageHours>=Number(ageThreshold||24)):
  mode==="queue"?r.bundles.filter(x=>["GOOD","IRONING"].includes(x.stage)):
  r.bundles;
 const selected=(data.bundles||[]).find(x=>x.bundleId===bundleId);
 const selectedIssue=["IRONING","IRONED"].includes(selected?.stage);
 const rows={...r,bundles:list,history:["completed"].includes(mode)?
  r.history.filter(x=>x.nextStage==="IRONED"):r.history};
 const csv=ironingExportRecords(mode,rows),summary=data.summary||{};
 async function postMove(e){
  e.preventDefault();
  if(!selected||!["GOOD","IRONING"].includes(selected.stage)||
   !Number.isSafeInteger(Number(qty))||Number(qty)<1||Number(qty)>selected.quantity){
   setError("Select GOOD/IRONING bundle and 1–available whole PCS");return;
  }
  setBusy(true);setError("");
  try{
   await saveIroningMovement({bundleId,quantity:Number(qty),operator,shift,key:movementKey.current});
   movementKey.current=crypto.randomUUID();setBundleId("");setQty("");setOperator("");setShift("");
   notify?.(selected.stage==="GOOD"?"Received into IRONING with audited ERP movement":"IRONED complete; ready for Packing intake");
   await load();
  }catch(e){setError(e.message);notify?.(e.message)}finally{setBusy(false)}
 }
 async function requestIssue(e){
  e.preventDefault();
  if(!selectedIssue||!Number.isSafeInteger(Number(qty))||Number(qty)<1||Number(qty)>selected.quantity){
   setError("Choose active Ironing/Ironed bundle and available whole PCS");return;
  }
  setBusy(true);setError("");
  try{
   await saveIroningIssue({bundleId,quantity:Number(qty),category,reason,key:issueKey.current});
   issueKey.current=crypto.randomUUID();setBundleId("");setQty("");setReason("");
   notify?.("Damage/re-ironing review request saved; stock was NOT moved");
   await load();
  }catch(e){setError(e.message);notify?.(e.message)}finally{setBusy(false)}
 }
 async function createTarget(e){
  e.preventDefault();setBusy(true);setError("");
  try{
   await saveIroningTarget({date:targetDate,sku:targetSku,operator:targetOperator,
    shift:targetShift,quantity:Number(targetQty),key:targetKey.current});
   targetKey.current=crypto.randomUUID();setTargetQty("");notify?.("Ironing target recorded");await load();
  }catch(e){setError(e.message);notify?.(e.message)}finally{setBusy(false)}
 }
 const isIssues=["issues","damage"].includes(mode),isMovement=mode==="entry",isTarget=mode==="targets";
 const showIssue=isIssues&&!readonly;
 return <section className="classic-page">
  <header className="classic-title"><div><small>IRONING · {readonly?"DEPARTMENT HEAD / READ ONLY":"STAFF / MANAGEMENT"}</small>
   <h2>{labels[mode]||"Ironing Production"}</h2>
   <p>Real ERP GOOD → IRONING → IRONED bundles; Packing is a separate permitted stock action.</p>
  </div><div className="page-actions">
   <button type="button" onClick={load}><RefreshCw size={16}/> Refresh</button>
   <button type="button" disabled={!csv.length} onClick={()=>exportCsv("ironing-"+mode+".xls",csv)}>
    <Download size={16}/> Excel</button>
   <button type="button" onClick={()=>window.print()}><Printer size={16}/> Print</button>
  </div></header>
  {error&&<p role="alert" className="error-text">{error}</p>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
   {Object.entries({"Ready from QC PCS":summary.receivedReadyPcs,
    "Ironing WIP PCS":summary.ironingWipPcs,"Ready for Packing PCS":summary.ironedReadyForPackingPcs,
    "Completed Event PCS":summary.completedEventPcs,"Open Issue Requests":summary.openIssueRequests})
    .map(([k,v])=><div className="classic-card" key={k}><small>{k}</small><h3>{fmt(v)}</h3></div>)}
  </div>
  <div className="classic-card">
   <label>Search DC / Bundle / SKU / Operator / Section
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="DC-001 / BND-..."/>
   </label>
   {mode==="delays"&&<label>Age threshold (hours; planning view only)
    <input type="number" min="1" max="720" step="1" value={ageThreshold}
     onChange={e=>setAgeThreshold(e.target.value)}/></label>}
   {isTarget?<Table headers={["Date UTC","SKU","Operator","Shift","Target PCS","Actual PCS","Balance PCS","Achievement %"]}
    rows={r.targets.map(t=>[t.date,t.sku,t.operator,t.shift,fmt(t.targetPcs),fmt(t.actualPcs),
     fmt(t.balancePcs),t.achievementPercent+"%"])}/>:
    isIssues?<Table headers={["DC","Lot","Bundle","Stage","Category","PCS","Status","Reason"]}
     rows={r.issues.map(t=>[t.dcNo,t.lotNo,t.bundleNo,t.stage,t.category,fmt(t.quantity),t.status,t.reason])}/>:
    ["history","completed","reports","print"].includes(mode)?
    <Table headers={["Date UTC","Lot","DC","SKU","PCS","Event Stage","Operator","Shift","Journal"]}
     rows={rows.history.map(t=>[t.date,t.lotNo,t.dcNo,t.sku,fmt(t.quantity),t.nextStage,
     t.operator,t.shift,t.documentId])}/>:
    ["queue","received","entry","handover","qr","delays"].includes(mode)?
    <Table headers={["Bundle","Lot","DC","Section","SKU","Stage","PCS","Age (hours)"]}
     rows={list.map(b=>[b.bundleNo,b.lotNo,b.dcNo,b.section,b.sku,b.stage,fmt(b.quantity),
      b.ageHours===null?"—":fmt(b.ageHours)])}/>:
    <Table headers={["Lot","DC","Order","Section","SKU","Ready from QC","WIP","Ready for Packing"]}
     rows={r.lots.map(l=>[l.lotNo,l.dcNo,l.orderNo,l.section,l.sku,fmt(l.receivedReadyPcs),
      fmt(l.ironingWipPcs),fmt(l.ironedReadyForPackingPcs)])}/>}
  </div>
  {isMovement&&!readonly&&<div className="classic-card">
   <h3>Receive from QC / Complete Ironing</h3>
   <p>GOOD → IRONING means received for Ironing. IRONING → IRONED means completed and ready for Packing. Both use atomic ERP movement and stable retry keys.</p>
   <form className="form-grid" onSubmit={postMove}>
    <label>Bundle<select required value={bundleId} onChange={e=>{setBundleId(e.target.value);setQty("");}}>
     <option value="">Select received or active Ironing bundle</option>
     {list.map(b=><option value={b.bundleId} key={b.bundleId}>
      {b.bundleNo} · {b.dcNo} · {b.stage} · {fmt(b.quantity)} PCS</option>)}
    </select></label>
    {selected&&<p>{selected.bundleNo} / {selected.stage} / Available {fmt(selected.quantity)} PCS</p>}
    <label>Move PCS<input type="number" required step="1" min="1" max={selected?.quantity||undefined}
     value={qty} onChange={e=>setQty(e.target.value)}/></label>
    <label>Operator<input maxLength={120} value={operator} onChange={e=>setOperator(e.target.value)}/></label>
    <label>Shift<input maxLength={120} value={shift} onChange={e=>setShift(e.target.value)}/></label>
    <button type="submit" className="primary" disabled={busy||!selected}><Save size={16}/>
     {busy?"Posting…":selected?.stage==="GOOD"?"Receive into Ironing":"Complete Ironing"}</button>
   </form>
  </div>}
  {showIssue&&<div className="classic-card">
   <h3>Damage / Re-ironing — review request only</h3>
   <p role="note">Request does not quarantine pieces, block Packing, rework stock, or automatically approve damage. Separate controlled disposition is pending.</p>
   <form className="form-grid" onSubmit={requestIssue}>
    <label>Ironing / Ironed Bundle<select required value={bundleId}
      onChange={e=>{setBundleId(e.target.value);setQty("");}}>
      <option value="">Select bundle</option>
      {r.bundles.filter(b=>["IRONING","IRONED"].includes(b.stage)).map(b=>
       <option key={b.bundleId} value={b.bundleId}>{b.bundleNo} · {b.dcNo} · {b.stage} · {fmt(b.quantity)} PCS</option>)}
    </select></label>
    <label>Issue PCS<input type="number" required min="1" step="1"
      max={selected?.quantity||undefined} value={qty} onChange={e=>setQty(e.target.value)}/></label>
    <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}>
      {categories.map(c=><option key={c} value={c}>{c.replaceAll("_"," ")}</option>)}
    </select></label>
    <label>Reason (8–300 characters)<input required minLength={8} maxLength={300}
     value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <button className="primary" type="submit" disabled={busy||!selectedIssue}>
      <Save size={16}/>{busy?"Submitting…":"Submit Review Request"}</button>
   </form>
  </div>}
  {isTarget&&management&&<div className="classic-card">
   <h3>Management: Set Ironing Production Target</h3>
   <p>Target vs Actual matches UTC date, SKU, operator and shift from saved completion events. One target per combination.</p>
   <form className="form-grid" onSubmit={createTarget}>
    <label>Production date (UTC)<input type="date" required value={targetDate}
      onChange={e=>setTargetDate(e.target.value)}/></label>
    <label>Finished SKU<input required value={targetSku} maxLength={80}
      onChange={e=>setTargetSku(e.target.value.toUpperCase())}/></label>
    <label>Operator<input required value={targetOperator} maxLength={80}
      onChange={e=>setTargetOperator(e.target.value)}/></label>
    <label>Shift<input required value={targetShift} maxLength={80}
      onChange={e=>setTargetShift(e.target.value)}/></label>
    <label>Target PCS<input required type="number" min="1" max="1000000" step="1"
      value={targetQty} onChange={e=>setTargetQty(e.target.value)}/></label>
    <button className="primary" disabled={busy} type="submit"><Save size={16}/> Save Target</button>
   </form>
  </div>}
  {mode==="handover"&&<p role="note">IRONED is ready for Packing intake; it is not yet PACKED stock or proof of Packing acknowledgment. Packing staff use the existing controlled pack transaction.</p>}
  {mode==="delays"&&<p>Ageing uses bundle creation age; the chosen threshold is for management planning only, not an agreed SLA or verified production delay cause.</p>}
  {mode==="qr"&&<p>Bundle code search supports keyboard-style scanning; camera QR and physical label acceptance are pending.</p>}
  {["entry"].includes(mode)&&!readonly&&<div className="classic-card">
   <h3>Existing ERP Ironing Workspace</h3><Departments initialDepartment="IRONING" notify={notify}/>
  </div>}
  <small>Event completion is cumulative and may include repeated handling. Current IRONED stock is live quantity; do not add event totals to current stock. No separate stock posting.</small>
 </section>;
}
