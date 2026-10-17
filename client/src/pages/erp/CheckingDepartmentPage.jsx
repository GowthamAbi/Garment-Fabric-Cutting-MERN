import {useEffect,useMemo,useRef,useState} from "react";
import {RefreshCw,Download,Printer,Save,ScanLine} from "lucide-react";
import {exportCsv} from "../../api.js";
import {useAuth} from "../../context/AuthContext.jsx";
import {getCheckingOverview,saveCheckingInspection,advanceCheckingStage,requestQualityHold} from "../../api/checkingDepartmentApi.js";
import {checkingExportRecords} from "../../config/checkingExport.mjs";
import Departments from "./Departments.jsx";
const names={
 plans:"Quality Checking Plans",pending:"Pending Checking Qty",results:"Pass / Reject / Rework",
 defects:"Defect-Wise Analysis",followup:"Rework & Oil Removal Follow-Up",
 holds:"Quality Hold Monitoring",reports:"QC Reports",bundles:"Bundles for Checking",
 entry:"Checking Entry",split:"Pass / Rework / Reject Entry",
 classify:"Defect Classification",oil:"Oil Removal Route",
 recheck:"Rechecking Entry",hold:"Quality Hold Request",
 scan:"Bundle QR / Code Lookup",history:"Checking History"
};
const empty={summary:{},lots:[],bundles:[],inspections:[],defects:[],history:[],holds:[]};
const fmt=n=>Number(n||0).toLocaleString("en-IN");
function Grid({headers,rows}){
 return <div style={{overflowX:"auto"}}><table className="classic-table" style={{width:"100%",minWidth:810}}>
  <thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead>
  <tbody>{rows.length?rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v??"—"}</td>)}</tr>):
   <tr><td colSpan={headers.length}>No matching QC records.</td></tr>}</tbody>
 </table></div>;
}
const categories=["STITCHING","FABRIC","MEASUREMENT","OIL_STAIN","OTHER"];
export default function CheckingDepartmentPage({mode="plans",notify}){
 const {user}=useAuth(),readonly=user?.role==="department_incharge";
 const [data,setData]=useState(empty),[search,setSearch]=useState(""),[busy,setBusy]=useState(false);
 const [error,setError]=useState(""),[bundleId,setBundleId]=useState("");
 const [good,setGood]=useState("0"),[rework,setRework]=useState("0"),[oil,setOil]=useState("0"),[reject,setReject]=useState("0");
 const [category,setCategory]=useState("STITCHING"),[reason,setReason]=useState("");
 const [moveQty,setMoveQty]=useState(""),[operator,setOperator]=useState(""),[shift,setShift]=useState("");
 const checkKey=useRef(crypto.randomUUID()),advanceKey=useRef(crypto.randomUUID()),holdKey=useRef(crypto.randomUUID());
 async function load(){try{setData(await getCheckingOverview());setError("")}catch(e){setError(e.message);notify?.(e.message)}}
 useEffect(()=>{load()},[]);
 const match=(...parts)=>parts.some(p=>String(p??"").toLowerCase().includes(search.trim().toLowerCase()));
 const rows=useMemo(()=>({
  lots:(data.lots||[]).filter(x=>match(x.lotNo,x.dcNo,x.orderNo,x.vendor,x.sku)),
  bundles:(data.bundles||[]).filter(x=>match(x.bundleNo,x.lotNo,x.dcNo,x.vendor,x.sku,x.stage)),
  inspections:(data.inspections||[]).filter(x=>match(x.dcNo,x.lotNo,x.vendor,x.defect,x.sku)),
  defects:(data.defects||[]).filter(x=>match(x.category)),
  history:(data.history||[]).filter(x=>match(x.lotNo,x.dcNo,x.vendor,x.defect)),
  holds:(data.holds||[]).filter(x=>match(x.lotNo,x.dcNo,x.bundleNo,x.category))
 }),[data,search]);
 const selected=(data.bundles||[]).find(x=>x.bundleId===bundleId);
 const isSplit=["entry","split","classify"].includes(mode);
 const isOil=["oil","recheck"].includes(mode);
 const isHold=mode==="hold";
 const showForm=(isSplit||isOil||isHold)&&!readonly;
 const candidates=rows.bundles.filter(b=>isSplit||isHold?b.stage==="CHECKING":
  isOil?["OIL","OIL_DONE"].includes(b.stage):false);
 const current=(isSplit||isHold)?rows.bundles.filter(b=>b.stage==="CHECKING"):
  isOil?rows.bundles.filter(b=>["OIL","OIL_DONE"].includes(b.stage)):
  ["pending","bundles","scan"].includes(mode)?rows.bundles.filter(b=>b.stage==="CHECKING"):
  mode==="followup"?rows.bundles.filter(b=>["REWORK","REWORK_DONE","OIL","OIL_DONE"].includes(b.stage)):
  rows.bundles;
 const fileRecords=checkingExportRecords(mode,data,{...rows,bundles:current});
 const s=data.summary||{};
 const posted=Number(good)+Number(rework)+Number(oil)+Number(reject);
 async function submitCheck(e){
  e.preventDefault();
  if(!selected||selected.stage!=="CHECKING"){setError("Select an active QC bundle");return}
  if(!Number.isInteger(posted)||posted<=0||posted>selected.quantity){setError("Invalid split: total exceeds available PCS");return}
  setBusy(true);setError("");
  try{
   await saveCheckingInspection({bundleId,key:checkKey.current,
    good:Number(good),rework:Number(rework),oil:Number(oil),reject:Number(reject),
    defect:category+": "+reason.trim()});
   checkKey.current=crypto.randomUUID();setBundleId("");setReason("");
   setGood("0");setRework("0");setOil("0");setReject("0");
   notify?.("QC result posted through existing atomic ERP /check");
   await load();
  }catch(e){setError(e.message);notify?.(e.message)}finally{setBusy(false)}
 }
 async function submitOil(e){
  e.preventDefault();if(!selected||!["OIL","OIL_DONE"].includes(selected.stage)){
   setError("Select a bundle in Oil / Oil Done");return}
  setBusy(true);setError("");
  try{
   await advanceCheckingStage({bundleId,key:advanceKey.current,quantity:Number(moveQty),operator,shift});
   advanceKey.current=crypto.randomUUID();setMoveQty("");setBundleId("");
   notify?.("Oil movement posted through existing transactional /advance");
   await load();
  }catch(e){setError(e.message);notify?.(e.message)}finally{setBusy(false)}
 }
 async function submitHold(e){
  e.preventDefault();if(!selected||selected.stage!=="CHECKING"){setError("Choose Checking bundle");return}
  setBusy(true);setError("");
  try{
   await requestQualityHold({bundleId,key:holdKey.current,category,reason});
   holdKey.current=crypto.randomUUID();setBundleId("");setReason("");
   notify?.("QC review request saved. This does NOT block physical stock movement.");
   await load();
  }catch(e){setError(e.message);notify?.(e.message)}finally{setBusy(false)}
 }
 return <section className="classic-page">
  <header className="classic-title"><div><small>CHECKING · {readonly?"HEAD / READ ONLY":"STAFF"}</small>
   <h2>{names[mode]||"Checking / QC"}</h2>
   <p>Actual ERP bundles, audited checking splits and defect observations. Rechecks are separately counted as inspections.</p>
  </div><div className="page-actions">
   <button type="button" onClick={load}><RefreshCw size={16}/> Refresh</button>
   <button type="button" disabled={!fileRecords.length} onClick={()=>exportCsv("checking-"+mode+".xls",fileRecords)}>
    <Download size={16}/> Excel</button>
   <button type="button" onClick={()=>window.print()}><Printer size={16}/> Print</button>
  </div></header>
  {error&&<p role="alert" className="error-text">{error}</p>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
   {Object.entries({"QC Pending PCS":s.pendingPcs,"QC Inspected PCS":s.checksPerformedPcs,
    "Pass Recorded PCS":s.passRecordedPcs,"Rework Recorded PCS":s.reworkRecordedPcs,
    "Oil Removal PCS":s.oilStockPcs,"Rejected Stock PCS":s.wasteStockPcs,
    "Pending Hold Requests":s.pendingHoldRequests}).map(([name,num])=>
    <div key={name} className="classic-card"><small>{name}</small><h3>{fmt(num)}</h3></div>)}
  </div>
  <div className="classic-card">
   <label>Search DC / Lot / Bundle / Section / SKU
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Enter DC or Bundle code"/>
   </label>
   {mode==="defects"?<Grid headers={["Defect Category","Inspections","Rework PCS","Oil PCS","Reject PCS"]}
    rows={rows.defects.map(x=>[x.category,fmt(x.inspections),fmt(x.reworkPcs),fmt(x.oilPcs),fmt(x.rejectPcs)])}/>:
    ["hold","holds"].includes(mode)?<Grid headers={["Date","DC","Bundle","Defect","PCS","Review Status","Reason"]}
     rows={rows.holds.map(x=>[x.createdAt?new Date(x.createdAt).toLocaleDateString("en-IN"):"",
       x.dcNo,x.bundleNo,x.category,fmt(x.expectedPcs),x.status,x.reason])}/>:
    mode==="history"?<Grid headers={["Date","DC","Lot","Action","PCS","Next Stage","Defect","Journal"]}
     rows={rows.history.map(x=>[x.date?new Date(x.date).toLocaleString("en-IN"):"",x.dcNo,
       x.lotNo,x.kind,fmt(x.quantity),x.nextStage,x.defect,x.documentId])}/>:
    ["results","classify","reports"].includes(mode)?<Grid headers={["Date","DC","Bundle","Checked PCS","Pass","Rework","Oil","Reject","Defect"]}
     rows={rows.inspections.map(x=>[x.date?new Date(x.date).toLocaleString("en-IN"):"",
       x.dcNo,x.bundleId,fmt(x.total),fmt(x.good),fmt(x.rework),fmt(x.oil),fmt(x.reject),x.defect])}/>:
    ["entry","split","oil","recheck","scan","bundles","pending","followup"].includes(mode)?
     <Grid headers={["Bundle","Lot","DC","Vendor / Section","SKU","Stage","Available PCS","Cycle"]}
      rows={current.map(x=>[x.bundleNo,x.lotNo,x.dcNo,x.vendor,x.sku,x.stage,fmt(x.quantity),x.cycle])}/>:
     <Grid headers={["Lot","DC","Order","Section","SKU","QC Pending","Good Stock","Rework","Oil","Waste"]}
      rows={rows.lots.map(x=>[x.lotNo,x.dcNo,x.orderNo,x.vendor,x.sku,fmt(x.pendingPcs),
       fmt(x.goodStockPcs),fmt(x.reworkStockPcs),fmt(x.oilStockPcs),fmt(x.wasteStockPcs)])}/>}
  </div>
  {showForm&&<div className="classic-card">
   <h3>{isSplit?"QC Inspection / Good-Rework-Oil-Reject Split":
    isOil?"Oil Removal / Rechecking Movement":"Quality Hold Review Request"}</h3>
   {isHold&&<p role="note">Request is for review only. It does NOT quarantine stock or block a checking transaction.
    Approval and physically enforced hold are development pending.</p>}
   <form className="form-grid" onSubmit={isSplit?submitCheck:isOil?submitOil:submitHold}>
    <label><ScanLine size={15}/> Bundle
     <select required value={bundleId} onChange={e=>{setBundleId(e.target.value);setMoveQty("");}}>
      <option value="">Select available bundle</option>
      {candidates.map(x=><option key={x.bundleId} value={x.bundleId}>
       {x.bundleNo} · {x.dcNo} · {x.stage} · {fmt(x.quantity)} PCS
      </option>)}
     </select></label>
    {selected&&<p>DC: {selected.dcNo} · Stage: {selected.stage} · Available: {fmt(selected.quantity)} PCS</p>}
    {isSplit?<><label>Good / Pass PCS<input type="number" min="0" step="1" required
      value={good} onChange={e=>setGood(e.target.value)}/></label>
     <label>Rework PCS<input type="number" min="0" step="1" required
      value={rework} onChange={e=>setRework(e.target.value)}/></label>
     <label>Oil Removal PCS<input type="number" min="0" step="1" required
      value={oil} onChange={e=>setOil(e.target.value)}/></label>
     <label>Reject PCS<input type="number" min="0" step="1" required
      value={reject} onChange={e=>setReject(e.target.value)}/></label>
     <p>Split total: {fmt(posted)} / {fmt(selected?.quantity||0)} PCS · partial checking supported.</p></>:null}
    {isOil?<><p>Stage rule: OIL → OIL_DONE → CHECKING (recheck). Rework returns via Stitching/Inward.</p>
     <label>Move PCS<input type="number" min="1" step="1" required max={selected?.quantity||undefined}
       value={moveQty} onChange={e=>setMoveQty(e.target.value)}/></label>
     <label>Operator<input value={operator} maxLength={120} onChange={e=>setOperator(e.target.value)}/></label>
     <label>Shift<input value={shift} maxLength={120} onChange={e=>setShift(e.target.value)}/></label></>:null}
    {(isSplit||isHold)&&<><label>Defect Category
      <select value={category} onChange={e=>setCategory(e.target.value)}>
       {categories.map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}
      </select></label>
     <label>Reason / Observation<input required minLength={isHold?8:1} maxLength={isHold?300:95}
      value={reason} onChange={e=>setReason(e.target.value)}/></label></>}
    <button className="primary" type="submit" disabled={!selected||busy||isSplit&&(!Number.isInteger(posted)||posted<=0||posted>selected.quantity)}>
     <Save size={16}/>{busy?"Saving…":isHold?"Submit Hold Review":isOil?"Post Oil / Recheck Stage":"Post QC Inspection"}
    </button>
   </form>
  </div>}
  {["entry","split","oil"].includes(mode)&&!readonly&&<div className="classic-card">
    <h3>Existing Checking ERP Operations</h3>
    <Departments initialDepartment="CHECKING" notify={notify}/>
   </div>}
  {mode==="scan"&&<p>Bundle code search supports keyboard-style USB scanning; camera scanning and printed label acceptance remain pending.</p>}
  <small>Metrics reflect posted ERP events. Rechecked pieces may appear in multiple inspection events; pass/rework totals are inspection counts, not unique garment totals.</small>
 </section>;
}
