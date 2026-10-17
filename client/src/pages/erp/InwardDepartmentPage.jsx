import {useEffect,useMemo,useRef,useState} from "react";
import {RefreshCw,Download,Printer,Save,ScanLine} from "lucide-react";
import {exportCsv} from "../../api.js";
import {useAuth} from "../../context/AuthContext.jsx";
import {getInwardOverview,advanceInwardBundle,createInwardDiscrepancy} from "../../api/inwardDepartmentApi.js";
import Departments from "./Departments.jsx";

const pageNames={
 expected:"Expected Inward / DC List",vendor:"Vendor / Section Pending",
 progress:"DC-Wise Receipt Progress",balance:"Received vs Delivered",
 variance:"Shortage / Excess Monitoring",rework:"Rework Return Receipt",
 reports:"Inward Reports",entry:"Stitched Goods Inward Entry",
 partial:"Partial Inward",scan:"QR / Bundle Scan",request:"Shortage / Excess Request",
 pending:"Pending Inward",history:"Inward History",print:"Receipt Print & Reports"
};
const empty={summary:{},rows:[],vendors:[],readyBundles:[],history:[],requests:[]};
const fmt=x=>Number(x||0).toLocaleString("en-IN");
const fixed=(headers,rows,emptyText="No matching records yet.")=>
 <div style={{overflowX:"auto"}}><table className="classic-table" style={{width:"100%",minWidth:740}}>
  <thead><tr>{headers.map(x=><th key={x}>{x}</th>)}</tr></thead>
  <tbody>{rows.length?rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v??"—"}</td>)}</tr>)
   :<tr><td colSpan={headers.length}>{emptyText}</td></tr>}</tbody>
 </table></div>;
const records=(mode,data,plans,vendors,bundles,history,requests)=>{
 if(mode==="vendor")return vendors.map(v=>({Vendor:v.vendor,"Lots":v.lotCount,
   "Expected PCS":v.expectedPcs,"Received PCS":v.receivedPcs,
   "Pending PCS":v.pendingPcs,"Ready PCS":v.readyPcs}));
 if(["variance","request"].includes(mode))return requests.map(x=>({
  "DC":x.dcNo,"Lot":x.lotNo,"Bundle":x.bundleCode,"Type":x.type,
  "Expected PCS":x.expectedPcs,"Counted PCS":x.countedPcs,"Variance PCS":x.variancePcs,
  "Status":x.status,"Reason":x.reason}));
 if(["history","print"].includes(mode))return history.map(h=>({
  "Date":h.createdAt?new Date(h.createdAt).toLocaleString("en-IN"):"",
  "Lot":h.lotNo,"DC":h.dcNo,"Vendor":h.vendor,
  "Received PCS":h.quantity,"To Stage":h.nextStage,"Document":h.documentId
 }));
 if(["scan","entry","partial","rework"].includes(mode))return bundles.map(b=>({
  "Bundle Code":b.code,"Lot":b.lotNo,"DC":b.dcNo,
  "Vendor":b.vendor,"SKU":b.sku,"Stage":b.stage,"Available PCS":b.pcs
 }));
 return plans.map(p=>({"Lot":p.lotNo,"DC":p.dcNo,"Order":p.orderNo,
  "Vendor / Section":p.vendor,"SKU":p.sku,"Expected PCS":p.expectedPcs,
  "Received PCS":p.receivedPcs,"Stitched Ready PCS":p.readyPcs,
  "Rework Ready PCS":p.reworkReadyPcs,"Pending PCS":p.pendingPcs}));
};
export default function InwardDepartmentPage({mode="expected",notify}){
 const {user}=useAuth(),readonly=user?.role==="department_incharge";
 const [data,setData]=useState(empty),[search,setSearch]=useState(""),[busy,setBusy]=useState(false);
 const [bundleId,setBundleId]=useState(""),[pcs,setPcs]=useState(""),[operator,setOperator]=useState(""),[shift,setShift]=useState("");
 const [counted,setCounted]=useState(""),[reason,setReason]=useState("");
 const receiptKey=useRef(crypto.randomUUID()),discrepancyKey=useRef(crypto.randomUUID());
 const [error,setError]=useState("");
 const load=async()=>{try{setData(await getInwardOverview());setError("")}
  catch(e){setError(e.message);notify?.(e.message)}};
 useEffect(()=>{load()},[]);
 const q=search.trim().toLowerCase(),match=(...v)=>v.some(x=>String(x||"").toLowerCase().includes(q));
 const plans=useMemo(()=>(data.rows||[]).filter(p=>match(p.lotNo,p.dcNo,p.orderNo,p.vendor,p.sku)),[data.rows,q]);
 const vendors=useMemo(()=>(data.vendors||[]).filter(v=>match(v.vendor)),[data.vendors,q]);
 const candidates=useMemo(()=>(data.readyBundles||[]).filter(b=>(mode!=="rework"||b.stage==="REWORK_DONE")&&
  match(b.code,b.dcNo,b.lotNo,b.vendor,b.sku)),[data.readyBundles,q,mode]);
 const history=useMemo(()=>(data.history||[]).filter(x=>match(x.lotNo,x.dcNo,x.vendor)),[data.history,q]);
 const requests=useMemo(()=>(data.requests||[]).filter(x=>match(x.lotNo,x.dcNo,x.bundleCode)),[data.requests,q]);
 const selected=(data.readyBundles||[]).find(x=>x.id===bundleId);
 const rec=records(mode,data,plans,vendors,candidates,history,requests);
 async function receive(e){
  e.preventDefault();if(!selected||!selected.canReceive){setError("Select an eligible Inward bundle");return}
  setBusy(true);
  try{
   await advanceInwardBundle({bundleId,quantity:Number(pcs),operator,shift,key:receiptKey.current});
   receiptKey.current=crypto.randomUUID();
   setBundleId("");setPcs("");setOperator("");setShift("");
   notify?.("Inward received using existing atomic ERP bundle and stock transaction");
   await load();
  }catch(err){setError(err.message);notify?.(err.message)}finally{setBusy(false)}
 }
 async function requestCorrection(e){
  e.preventDefault();if(!selected){setError("Choose a bundle");return}
  setBusy(true);
  try{
   await createInwardDiscrepancy({bundleId,countedPcs:Number(counted),reason,key:discrepancyKey.current});
   discrepancyKey.current=crypto.randomUUID();
   setCounted("");setReason("");notify?.("Discrepancy request saved. No stock changed.");
   await load();
  }catch(err){setError(err.message);notify?.(err.message)}finally{setBusy(false)}
 }
 const showReceive=["entry","partial","scan","rework"].includes(mode);
 const showRequest=["request","variance"].includes(mode);
 const summary=data.summary||{};
 return <section className="classic-page">
  <header className="classic-title"><div><small>INWARD · {readonly?"DEPARTMENT HEAD / VIEW ONLY":"INWARD STAFF"}</small>
   <h2>{pageNames[mode]||"Inward DC Monitoring"}</h2>
   <p>Stitching to Inward: existing ERP bundle, transaction and stock ledger. No duplicate inward stock posting.</p>
  </div><div className="page-actions">
   <button type="button" onClick={load}><RefreshCw size={16}/> Refresh</button>
   <button type="button" disabled={!rec.length} onClick={()=>exportCsv("inward-"+mode+".xls",rec)}>
    <Download size={16}/> Excel</button>
   <button type="button" onClick={()=>window.print()}><Printer size={16}/> Print</button>
  </div></header>
  {error&&<p role="alert" className="error-text">{error}</p>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
   {Object.entries({"Expected PCS":summary.expectedPcs,"Received PCS":summary.receivedPcs,
    "Pending PCS":summary.pendingPcs,"Stitched Ready PCS":summary.readyPcs,
    "Rework Ready PCS":summary.reworkReadyPcs,"Open Discrepancies":summary.pendingRequests})
    .map(([k,v])=><div className="classic-card" key={k}><small>{k}</small><h3>{fmt(v)}</h3></div>)}
  </div>
  <div className="classic-card">
   <label>Search by DC, Lot, Vendor, SKU or Bundle
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="DC-001 / LOT-001 / BND-..."/>
   </label>
   {mode==="vendor"?fixed(["Section / Vendor","Lots","Expected PCS","Received PCS","Pending PCS","Ready PCS"],
    vendors.map(v=>[v.vendor,fmt(v.lotCount),fmt(v.expectedPcs),fmt(v.receivedPcs),fmt(v.pendingPcs),fmt(v.readyPcs)])):
    showRequest?fixed(["DC","Lot","Bundle","Type","Expected PCS","Counted PCS","Variance PCS","Status","Reason"],
    requests.map(v=>[v.dcNo,v.lotNo,v.bundleCode,v.type,fmt(v.expectedPcs),fmt(v.countedPcs),
     fmt(v.variancePcs),v.status,v.reason])):
    ["history","print"].includes(mode)?fixed(["Date","Lot","DC","Section","PCS","To Stage","Document"],
    history.map(h=>[h.createdAt?new Date(h.createdAt).toLocaleString("en-IN"):"",
    h.lotNo,h.dcNo,h.vendor,fmt(h.quantity),h.nextStage,h.documentId])):
    showReceive?fixed(["Bundle","Lot","DC","Section","SKU","Stage","Available PCS"],
    candidates.map(b=>[b.code,b.lotNo,b.dcNo,b.vendor,b.sku,b.stage,fmt(b.pcs)])):
    fixed(["Lot","DC","Order","Vendor / Section","SKU","Expected PCS","Received PCS","Ready PCS","Rework Ready","Pending PCS"],
    plans.map(p=>[p.lotNo,p.dcNo,p.orderNo,p.vendor,p.sku,fmt(p.expectedPcs),
    fmt(p.receivedPcs),fmt(p.readyPcs),fmt(p.reworkReadyPcs),fmt(p.pendingPcs)]))}
  </div>
  {(showReceive||showRequest)&&!readonly&&<div className="classic-card">
   <h3>{showRequest?"Raise Physical Shortage / Excess Request":mode==="rework"?"Receive Completed Rework Bundle":"Partial Stitched Bundle Inward"}</h3>
   <p>{showRequest?"Physical count request is non-posting. Review/decision is not yet integrated.":"Every receipt uses existing transactional /advance with idempotency. A retry cannot issue stock twice."}</p>
   <form className="form-grid" onSubmit={showRequest?requestCorrection:receive}>
    <label><ScanLine size={15}/> Bundle (scanner can type bundle code into Search)
     <select required value={bundleId} onChange={e=>{setBundleId(e.target.value);setPcs("");}}>
      <option value="">Choose stitched bundle</option>
      {candidates.map(b=><option key={b.id} value={b.id} disabled={!b.canReceive}>
       {b.code} · {b.dcNo} · {b.stage} · {b.pcs} PCS {b.canReceive?"":"(route skips Inward)"}
      </option>)}
     </select>
    </label>
    {selected&&<p>Lot {selected.lotNo} · DC {selected.dcNo} · {selected.stage} · {fmt(selected.pcs)} PCS available</p>}
    {showRequest?<><label>Actual Physically Counted PCS
      <input type="number" step="1" min="0" required value={counted} onChange={e=>setCounted(e.target.value)}/>
     </label><label>Reason (8–300 characters)
      <input required minLength={8} maxLength={300} value={reason} onChange={e=>setReason(e.target.value)}/>
     </label></>:
    <><label>Receive PCS (partial allowed)
      <input type="number" step="1" min="1" required max={selected?.pcs||undefined}
       value={pcs} onChange={e=>setPcs(e.target.value)}/></label>
     <label>Operator <input value={operator} onChange={e=>setOperator(e.target.value)} maxLength={100}/></label>
     <label>Shift <input value={shift} onChange={e=>setShift(e.target.value)} maxLength={80}/></label></>}
    <button className="primary" disabled={busy||!selected||!selected.canReceive} type="submit">
     <Save size={16}/>{busy?"Saving…":showRequest?"Submit Discrepancy Request":"Receive Bundle"}
    </button>
   </form>
  </div>}
  {mode==="scan"&&<p>Scanner support is keyboard-style bundle code lookup only. Camera scanning and physical QR print verification remain pending.</p>}
  {["entry","rework"].includes(mode)&&!readonly&&<div className="classic-card">
   <h3>Existing ERP Inward Operations</h3>
   <p>Advanced routing, audited ERP movements and trace remain available in the existing workspace.</p>
   <Departments initialDepartment="INWARD" notify={notify}/>
  </div>}
  {mode==="reports"&&<div className="classic-card"><h3>Inward Movement History</h3>
   {fixed(["Lot","DC","Received PCS","Next Stage"],
    history.map(h=>[h.lotNo,h.dcNo,fmt(h.quantity),h.nextStage]))}
  </div>}
  <small>Expected/Received are from saved ERP lots. Rework return is a separate step; shortage requests never alter posted stock. Full cross-department E2E is pending.</small>
 </section>;
}
