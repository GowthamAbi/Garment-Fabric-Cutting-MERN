import {useEffect,useMemo,useState} from "react";
import {RefreshCw,Download,Printer} from "lucide-react";
import {exportCsv} from "../../api.js";
import {useAuth} from "../../context/AuthContext.jsx";
import {getStitchingOverview} from "../../api/stitchingApi.js";
import Departments from "./Departments.jsx";

const pageNames={
 orders:"Stitching Orders & Plans",operations:"Stitching Operation Progress",
 vendor:"Line / Vendor Monitoring",targets:"Stitching Target vs Actual",
 wip:"Bundle & WIP Status",defects:"Stitching Defects / Rework",
 reports:"Stitching Reports",master:"Stitching Master / Operations",
 assigned:"Assigned Bundles / DC",bulletin:"Operation Bulletin",
 start:"Stitching Start / Update",completion:"Operation-Wise Completion",
 completed:"Completed Stitching Qty",rework:"Rework / Defect Entry",
 handover:"Handover to Inward",trace:"Bundle QR / History",
};
const fmt=x=>Number(x||0).toLocaleString("en-IN");
const defaults={summary:{},plans:[],operations:[],targets:[],defects:[],stageCounts:{}};
function Table({headers,rows,empty="No records available"}){
 return <div style={{overflowX:"auto"}}><table className="classic-table" style={{width:"100%",minWidth:780}}>
  <thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead>
  <tbody>{rows.length?rows.map((r,i)=><tr key={i}>{r.map((cell,j)=><td key={j}>{cell??"—"}</td>)}</tr>):
  <tr><td colSpan={headers.length}>{empty}</td></tr>}</tbody></table></div>;
}
export default function StitchingDepartmentPage({mode="orders",notify}){
 const {user}=useAuth(),readonly=user?.role==="department_incharge";
 const [data,setData]=useState(defaults),[loading,setLoading]=useState(false),[query,setQuery]=useState("");
 async function load(){setLoading(true);try{setData(await getStitchingOverview())}
  catch(e){notify?.(e.message)}finally{setLoading(false)}}
 useEffect(()=>{load()},[]);
 const plans=useMemo(()=>data.plans.filter(p=>[p.lotNo,p.orderNo,p.dcNo,p.section,p.sku]
  .some(v=>String(v||"").toLowerCase().includes(query.toLowerCase()))),[data.plans,query]);
 const planRows=plans.map(p=>[p.lotNo,p.orderNo,p.dcNo,p.sku,p.section,fmt(p.sentPcs),
  fmt(p.stitchedPcs),fmt(p.handedOverPcs),fmt(p.pendingPcs),fmt(p.reworkPcs),p.completionPercent+"%"]);
 const operationRows=data.operations.map(o=>[o.sku,o.masterKey,o.sequence,o.operation,fmt(o.completedEventPcs)]);
 const targetRows=data.targets.map(t=>[t.date,t.sku,t.operation,t.operator,t.shift,fmt(t.targetPcs)]);
 const defectRows=data.defects.map(d=>[d.date?new Date(d.date).toLocaleDateString():"",d.lotId,d.kind,d.department,fmt(d.quantity),d.reason]);
 const summary=data.summary||{};
 const operational=["master","start","completion","handover","trace"].includes(mode);
 const listTargets=["targets","reports"].includes(mode);
 const listOperations=["operations","bulletin","completion","reports"].includes(mode);
 const listDefects=["defects","rework","reports"].includes(mode);
 return <section className="classic-page">
  <header className="classic-title"><div><small>STITCHING DEPARTMENT · {readonly?"HEAD / READ ONLY":"STAFF"}</small>
   <h2>{pageNames[mode]||"Stitching Operations"}</h2>
   <p>Actual ERP lots, bundles, route operations and posted movement events. No duplicate stock counter.</p>
  </div><div className="page-actions">
   <button type="button" onClick={load} disabled={loading}><RefreshCw size={16}/> Refresh</button>
   <button type="button" disabled={!planRows.length} onClick={()=>exportCsv("stitching-"+mode+".csv",
    planRows.map(r=>Object.fromEntries(r.map((v,i)=>[String(i+1),v]))))}><Download size={16}/> Excel</button>
   <button type="button" onClick={()=>window.print()}><Printer size={16}/> Print</button>
  </div></header>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
   {Object.entries({Lots:summary.lots||0,"Sent PCS":summary.sentPcs||0,
    "Running WIP":summary.inOperationPcs||0,"Stitched PCS":summary.stitchedReadyPcs||0,
    "Handed Over PCS":summary.handedOverPcs||0,"Pending PCS":summary.pendingPcs||0,
    "Rework PCS":summary.reworkPcs||0}).map(([title,count])=><div className="classic-card" key={title}>
    <small>{title}</small><h3>{fmt(count)}</h3></div>)}
  </div>
  <div className="classic-card">
   <h3>Lot / DC / Section Progress</h3>
   <label>Search order, lot, DC, SKU or line/vendor
    <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search stitching records"/>
   </label>
   <Table headers={["Lot","Order","DC","SKU","Section","Sent","Stitched","Handover","Pending","Rework","Complete"]}
    rows={planRows}/>
   <small>Stitched PCS means completed bundles awaiting inward. Handover PCS is credited only by recorded ERP advances. Pending excludes neither stock outside the selected route nor unpublished manual reports.</small>
  </div>
  {listOperations&&<div className="classic-card"><h3>Operation Bulletin / Posted Completions</h3>
   <Table headers={["SKU","Master Version","Step","Operation","Completion Event PCS"]} rows={operationRows}/>
   <small>Completion event counts are historical event totals, not a daily target figure. Detailed staff efficiency mapping requires final shift-level integration.</small>
  </div>}
  {listTargets&&<div className="classic-card"><h3>Approved Operation Targets</h3>
   <Table headers={["Date","SKU","Operation","Operator","Shift","Target PCS"]} rows={targetRows}/>
   <small>Targets and cumulative event counts use different time windows; no misleading percent comparison is shown.</small>
  </div>}
  {listDefects&&<div className="classic-card"><h3>Stitching Event / Rework Records</h3>
   <Table headers={["Date","Lot ID","Event","Department","PCS","Reason"]} rows={defectRows}/>
   <small>Checking-stage defects are controlled by the subscribed CHECKING department. A separate Stitching defect approval/repair ledger remains pending.</small>
  </div>}
  {operational&&!readonly&&<div className="classic-card">
   <h3>Existing ERP Stitching Operations</h3>
   <p>Use the existing transaction-backed operation master, bundle receive, advance, QR trace and handover controls below. These use the approved route and real ERP balance.</p>
   <Departments initialDepartment="STITCHING" notify={notify}/>
  </div>}
  {operational&&readonly&&<div className="classic-card">Department Head is read-only. Staff handle movement entries within assigned company/factory.</div>}
  {mode==="rework"&&<div className="classic-card">
   <h3>Rework / Defect Entry – Integration Required</h3>
   <p>Defects affecting Checking and Stitching must be routed through the appropriate approval and bundle correction workflow. No unsafe direct stock adjustment form has been introduced.</p>
  </div>}
  {mode==="handover"&&<p>INWARD subscription and reviewed operation-route completion are required for final stitched bundle acceptance.</p>}
 </section>;
}
