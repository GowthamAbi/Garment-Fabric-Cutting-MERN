import {useEffect,useMemo,useState} from "react";
import {useAuth} from "../../context/AuthContext.jsx";
import {fabricCuttingApi as api} from "../../api/fabricCuttingApi.js";
import {exportElementExcel} from "../../api.js";
import {RefreshCw,Download,Printer,Search} from "lucide-react";

const format=n=>Number(n||0).toLocaleString("en-IN",{maximumFractionDigits:3});
const day=v=>v?new Date(v).toLocaleDateString("en-IN"):"—";
const modes={
 availability:["Fabric Purchase & Availability","Inward supplier/DC records are receipts, not confirmed purchase orders. Actual available KG is derived from roll balances and open plan reservations."],
 inward:["Inward & Roll Monitoring","Trace Inward No, supplier, DC, original roll weight and each saved roll QR entry."],
 folding:["Folding Status","Status reflects actual saved folding entries against Production Plans."],
 batches:["Batch & Set Tracking","Review inward, colour, dia, batch, set and remaining KG by stored roll history."],
 history:["Inward & Plan History","Review fabric receipts, production plans and recorded fabric issues in one place."],
 reports:["Fabric Reports & Print","Read-only summary and detail exports for Fabric operations."]
};
const sum=(items,key)=>items.reduce((n,x)=>n+Number(x[key]||0),0);
function Table({heads,rows,empty="No records found"}){
 return <div className="erp-table fabric-plan-monitor-table"><table><thead><tr>{heads.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>
 {rows.map((r,i)=><tr key={r.key||i}>{r.values.map((value,j)=><td key={j}>{value??"—"}</td>)}</tr>)}
 </tbody></table>{!rows.length&&<p>{empty}</p>}</div>;
}
export default function FabricOperationsPage({mode="availability"}){
 const {user}=useAuth();
 const [inwards,setInwards]=useState([]),[stock,setStock]=useState([]),[plans,setPlans]=useState([]),[issues,setIssues]=useState([]);
 const [rolls,setRolls]=useState([]),[selectedInward,setSelectedInward]=useState(""),[search,setSearch]=useState("");
 const [loading,setLoading]=useState(false),[warnings,setWarnings]=useState([]);
 const [loaded,setLoaded]=useState(false);
 const [title,description]=modes[mode]||modes.availability;
 const isInward=mode==="inward";
 async function reload(){
  setLoading(true);
  const sources=await Promise.allSettled([api.inwards(),api.fabricBalance(),api.fabricPlanMonitor(),api.fabricIssues()]);
  const setters=[setInwards,setStock,(v)=>setPlans(v.items||[]),(v)=>setIssues(v.items||[])];
  const warn=[];
  sources.forEach((r,i)=>{if(r.status==="fulfilled")setters[i](r.value);else{setters[i]([]);warn.push(["Inwards","Balance Stock","Plans","Fabric Issues"][i]+": "+String(r.reason?.message||"Unable to load"))}});
  setWarnings(warn);setLoading(false);setLoaded(true);
 }
 useEffect(()=>{reload()},[]);
 const query=search.trim().toLowerCase();
 const includes=row=>!query||JSON.stringify(row).toLowerCase().includes(query);
 const inbound=useMemo(()=>inwards.filter(includes),[inwards,query]);
 const balances=useMemo(()=>stock.filter(includes),[stock,query]);
 const planning=useMemo(()=>plans.filter(includes),[plans,query]);
 const movement=useMemo(()=>issues.filter(includes),[issues,query]);
 const totals={original:sum(inbound,"totalWeightKg"),available:sum(balances,"balanceWeightKg"),planned:sum(planning,"totalWantedWeightKg"),issued:sum(planning,"issuedWeightKg")};
 async function openRolls(number){
  if(selectedInward===number){setSelectedInward("");return}
  try{setRolls(await api.bundles(number));setSelectedInward(number)}catch(e){setWarnings(v=>[...v,"Roll history: "+e.message])}
 }
 const stockRows=balances.map(r=>({key:r.inwardNo+"-"+r.colour+"-"+r.dia+"-"+r.batchNo,values:[r.inwardNo,r.fabricGroup,r.fabricName,r.colour,r.dia,r.batchNo,r.setNo,format(r.inwardWeightKg),format(r.balanceWeightKg)]}));
 const planRows=planning.map(r=>({key:r._id,values:[day(r.createdAt),r.planNo,r.dcNo,r.orderNo,r.itemCode,format(r.totalPlannedPcs),format(r.totalWantedWeightKg),format(r.issuedWeightKg),format(Math.max(0,Number(r.totalWantedWeightKg||0)-Number(r.issuedWeightKg||0))),r.status]}));
 const issueRows=movement.map(r=>({key:r._id,values:[day(r.createdAt),r.planNo,r.inwardNo,r.colour,format(r.weightKg),r.actorId]}));
 const inwardRows=inbound.map(r=>({key:r._id,values:[day(r.inwardDate),r.inwardNo,r.supplier||"—",r.dcNo||r.lotDcNo,r.fabricGroup,r.fabricName,format(r.totalRolls),format(r.totalWeightKg),r.status,
  isInward?<button type="button" onClick={()=>openRolls(r.inwardNo)}>{selectedInward===r.inwardNo?"Hide rolls":"View rolls"}</button>:"—"]}));
 const foldingRows=planning.map(r=>({key:r._id,values:[r.planNo,r.dcNo,r.orderNo,r.itemCode,format(r.totalPlannedPcs),r.foldingSavedAt?day(r.foldingSavedAt):"Pending",format(r.foldingWeightKg),r.foldingQuality||"—"]}));
 const inwardHeads=["Date","Inward","Supplier","DC","Fabric Group","Fabric","Rolls","Original KG","Status","Roll Tracking"];
 const planHeads=["Date","Plan","DC","Order","Item","PCS","Wanted KG","Issued KG","Pending KG","Status"];
 const balanceHeads=["Inward","Group","Fabric","Colour","Dia","Batch No","Set No","Original KG","Available KG"];
 return <section className="fabric-plan-monitor">
  <header className="fabric-plan-monitor-heading"><div><small>FABRIC DEPARTMENT · {user?.role==="department_incharge"?"HEAD":"OPERATIONS"} · LIVE RECORDS</small>
   <h2>{title}</h2><p>{description}</p></div>
   <div className="department-actions"><button type="button" onClick={reload} disabled={loading}><RefreshCw size={16}/> Refresh</button>
    <button type="button" onClick={()=>window.print()}><Printer size={16}/> Print</button>
    <button type="button" onClick={()=>exportElementExcel("fabric-"+mode+"-report.xls","fabric-operational-export")}><Download size={16}/> Excel</button>
   </div></header>
  <label className="fabric-ops-search">Search Inward / Plan / Colour / DC / Batch <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Type any reference..."/></label>
  {warnings.length>0&&<div role="alert" className="erp-error">{warnings.map((w,i)=><p key={i}>{w}</p>)}</div>}
  {loading&&<p role="status">Loading Fabric records…</p>}
  <div className="fabric-plan-monitor-kpis">
   <article className="erp-card"><span>Received KG</span><strong>{format(totals.original)}</strong></article>
   <article className="erp-card"><span>Balance stock KG</span><strong>{format(totals.available)}</strong></article>
   <article className="erp-card"><span>Plan requirement KG</span><strong>{format(totals.planned)}</strong></article>
   <article className="erp-card"><span>Issued to Cutting KG</span><strong>{format(totals.issued)}</strong></article>
  </div>
  <div id="fabric-operational-export">
   {["availability","inward","history","reports"].includes(mode)&&<section className="erp-card"><h3>{mode==="availability"?"Fabric Receipts / Supplier Availability":"Fabric Inward Register"}</h3><Table heads={inwardHeads} rows={inwardRows}/></section>}
   {isInward&&selectedInward&&<section className="erp-card"><h3>Saved Roll & QR History — {selectedInward}</h3>
    <Table heads={["Roll / Bundle","Batch","Set","Colour","Dia","Original KG","Balance KG","Status"]} rows={rolls.map((r,i)=>({key:r._id||i,values:[r.bundleNo,r.batchNo,r.setNo,r.colour,r.dia,format(r.originalWeightKg),format(r.balanceWeightKg),r.status]}))}/>
   </section>}
   {["availability","batches","reports"].includes(mode)&&<section className="erp-card"><h3>{mode==="batches"?"Batch / Set Register":"Fabric Balance & Shortage"}</h3>
    <Table heads={balanceHeads} rows={stockRows}/></section>}
   {["folding"].includes(mode)&&<section className="erp-card"><h3>Folding Entry Completion</h3>
    <Table heads={["Plan","DC","Order","Item","PCS","Folding Date","Actual Folding KG","Quality"]} rows={foldingRows}/></section>}
   {["history","reports"].includes(mode)&&<section className="erp-card"><h3>Production Plans</h3><Table heads={planHeads} rows={planRows}/></section>}
   {["history","reports"].includes(mode)&&<section className="erp-card"><h3>Fabric Issue Movements</h3>
    <Table heads={["Date","Plan","Inward","Colour","KG","Issued by"]} rows={issueRows}/></section>}
  </div>
  {loaded&&mode==="availability"&&<p className="department-note">Purchase order placement and supplier payment are separate procurement functions. This view verifies received supplier DCs, available fabric and production commitments, not unrecorded purchase orders.</p>}
 </section>;
}
