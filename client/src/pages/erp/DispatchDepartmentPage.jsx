import {useEffect,useMemo,useRef,useState} from "react";
import {Download,Printer,RefreshCw,Save} from "lucide-react";
import {exportCsv} from "../../api.js";
import {useAuth} from "../../context/AuthContext.jsx";
import QRGenerator from "../../components/qr/QRGenerator.jsx";
import {getDispatchOverview,transferDispatchCarton,createDispatchPlan,createDispatchException} from "../../api/dispatchDepartmentApi.js";
import {dispatchExportRecords} from "../../config/dispatchExport.mjs";
import "./DispatchDepartmentPage.css";

const titles={
 ready:"Ready for Despatch",schedule:"Despatch Schedule",orders:"Order-Wise Despatch",
 progress:"Dispatched vs Pending",transit:"Transit / Receipt Status",
 delays:"Delay & Exception Monitoring",reports:"Despatch Reports",
 packed:"Ready Packed Orders",plan:"Despatch Plan",entry:"Despatch Entry",
 destination:"Warehouse / Customer Selection",transport:"Transport & Vehicle Details",
 loading:"Loading / Handover",challen:"Delivery Challan Print",
 pending:"Transit / Pending Status",history:"Despatch History",
 exception:"Dispatch Exception Review Requests"
};
const blank={summary:{},bundles:[],history:[],orders:[],schedules:[],exceptions:[],warehouses:[]};
const fmt=x=>Number(x||0).toLocaleString("en-IN");
function Table({headers,rows}){
 return <div style={{overflowX:"auto"}}><table className="classic-table" style={{width:"100%",minWidth:830}}>
  <thead><tr>{headers.map(s=><th key={s}>{s}</th>)}</tr></thead>
  <tbody>{rows.length?rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v??"—"}</td>)}</tr>):
   <tr><td colSpan={headers.length}>No matching Dispatch records.</td></tr>}</tbody>
 </table></div>;
}
const reasons=["SHORT_LOADING","CARTON_DAMAGE","VEHICLE_DELAY","TRANSIT_MISMATCH","OTHER"];
export default function DispatchDepartmentPage({mode="ready",notify}){
 const {user}=useAuth(),readonly=user?.role==="department_incharge";
 const [data,setData]=useState(blank),[error,setError]=useState(""),[busy,setBusy]=useState(false),
  [search,setSearch]=useState("");
 const [bundleId,setBundleId]=useState(""),[quantity,setQuantity]=useState(""),
  [warehouse,setWarehouse]=useState(""),[vehicleNo,setVehicleNo]=useState(""),
  [transporter,setTransporter]=useState(""),[driver,setDriver]=useState(""),
  [lrNo,setLrNo]=useState(""),[notes,setNotes]=useState("");
 const [planDate,setPlanDate]=useState(()=>new Date().toISOString().slice(0,10)),
  [planSku,setPlanSku]=useState(""),[planDC,setPlanDC]=useState(""),[planPCS,setPlanPCS]=useState(""),
  [planNotes,setPlanNotes]=useState("");
 const [category,setCategory]=useState("SHORT_LOADING"),[reason,setReason]=useState("");
 const [selectedDispatch,setSelectedDispatch]=useState("");
 const [delayThreshold,setDelayThreshold]=useState("24");
 const postKey=useRef(crypto.randomUUID()),planKey=useRef(crypto.randomUUID()),exceptionKey=useRef(crypto.randomUUID());
 const load=async()=>{try{setData(await getDispatchOverview());setError("")}
  catch(e){setError(e.message);notify?.(e.message)}};
 useEffect(()=>{load()},[]);
 const match=(...v)=>v.some(x=>String(x??"").toLowerCase().includes(search.trim().toLowerCase()));
 const r=useMemo(()=>({
  bundles:(data.bundles||[]).filter(x=>match(x.cartonNo,x.dcNo,x.orderNo,x.sku,x.section,x.destination)),
  orders:(data.orders||[]).filter(x=>match(x.orderNo,x.dcNo,x.sku)),
  history:(data.history||[]).filter(x=>match(x.cartonNo,x.dcNo,x.orderNo,x.sku,x.destination,x.transport?.vehicleNo)),
  schedules:(data.schedules||[]).filter(x=>match(x.date,x.sku,x.dcNo,x.destination)),
  exceptions:(data.exceptions||[]).filter(x=>match(x.cartonNo,x.dcNo,x.category))
 }),[data,search]);
 const ready=r.bundles.filter(x=>x.stage==="PACKED"),transit=r.bundles.filter(x=>x.stage==="TRANSIT_WAREHOUSE"),
  viewBundles=["ready","packed","entry","destination"].includes(mode)?ready:r.bundles;
 const selected=(data.bundles||[]).find(x=>x.id===bundleId);
 const doc=(data.history||[]).find(x=>x.eventId===selectedDispatch);
 const rows={...r,bundles:viewBundles};
 const csv=dispatchExportRecords(mode,rows),s=data.summary||{};
 const isPlan=mode==="plan",isEntry=["entry","transport","loading"].includes(mode);
 const isException=mode==="exception";
 async function postDispatch(e){
  e.preventDefault();const pcs=Number(quantity);
  if(!selected||selected.stage!=="PACKED"||!Number.isSafeInteger(pcs)||pcs<1||pcs>selected.quantity||!warehouse){
   setError("Select PACKED carton, available whole PCS and assigned active Warehouse");return}
  if(!vehicleNo.trim()||!transporter.trim()){setError("Vehicle number and transporter required for recorded handover");return}
  setBusy(true);setError("");
  try{
   const response=await transferDispatchCarton({bundleId,quantity:pcs,destination:warehouse,
    dispatch:{vehicleNo,transporter,driver,lrNo,notes},key:postKey.current});
   postKey.current=crypto.randomUUID();setBundleId("");setQuantity("");
   setSelectedDispatch(String(response?._id||""));
   notify?.("Carton moved to warehouse transit with transport details in ERP event");
   await load();
  }catch(err){setError(err.message);notify?.(err.message)}finally{setBusy(false)}
 }
 async function postPlan(e){
  e.preventDefault();setBusy(true);setError("");
  try{
   await createDispatchPlan({date:planDate,sku:planSku,dcNo:planDC,
    destination:warehouse,quantity:Number(planPCS),notes:planNotes,key:planKey.current});
   planKey.current=crypto.randomUUID();setPlanPCS("");setPlanNotes("");
   notify?.("Dispatch schedule recorded without moving stock");await load();
  }catch(err){setError(err.message);notify?.(err.message)}finally{setBusy(false)}
 }
 async function postException(e){
  e.preventDefault();const pcs=Number(quantity);
  if(!selected||!Number.isSafeInteger(pcs)||pcs<1||pcs>selected.quantity){
   setError("Choose active carton and a valid whole-piece exception quantity");return}
  setBusy(true);setError("");
  try{
   await createDispatchException({bundleId,quantity:pcs,category,reason,key:exceptionKey.current});
   exceptionKey.current=crypto.randomUUID();setBundleId("");setQuantity("");setReason("");
   notify?.("Dispatch exception request saved; no stock has changed");await load();
  }catch(err){setError(err.message);notify?.(err.message)}finally{setBusy(false)}
 }
 const warehouseOpts=data.warehouses||[],isTransferPreview=["challen"].includes(mode);
 return <section className={`classic-page dispatch-page ${isTransferPreview?"dispatch-print-memo":""}`}>
  <div className="dispatch-not-memo">
   <header className="classic-title">
    <div><small>DESPATCH · {readonly?"HEAD / READ ONLY":"STAFF / MANAGEMENT"}</small>
     <h2>{titles[mode]||"Dispatch"}</h2>
     <p>Real PACKED cartons, audited warehouse transit and linked warehouse receipt — no duplicate inventory.</p>
    </div><div className="page-actions">
     <button type="button" onClick={load}><RefreshCw size={16}/> Refresh</button>
     <button type="button" disabled={!csv.length} onClick={()=>exportCsv("dispatch-"+mode+".xls",csv)}><Download size={16}/> Excel</button>
     <button type="button" onClick={()=>window.print()}><Printer size={16}/> Print</button>
    </div>
   </header>
   {error&&<p role="alert" className="error-text">{error}</p>}
   <div className="dispatch-counters">
    {Object.entries({"Ready Packed PCS":s.readyPackedPcs,"Warehouse Transit PCS":s.inTransitPcs,
     "Shipped Event PCS":s.shippedEventPcs,"Warehouse Received PCS":s.warehouseReceivedEventPcs,
     "Schedules PCS":s.scheduledPcs,"Open Exception Requests":s.pendingExceptionRequests})
     .map(([name,qty])=><div className="classic-card" key={name}><small>{name}</small><h3>{fmt(qty)}</h3></div>)}
   </div>
   <div className="classic-card">
    <label>Search DC / Carton / Order / Warehouse / Vehicle
     <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="DC, carton, vehicle number…"/>
    </label>
    {mode==="delays"&&<label>Transit ageing threshold (hours; indicative)
     <input type="number" min="1" max="720" step="1" value={delayThreshold}
      onChange={e=>setDelayThreshold(e.target.value)}/></label>}
    {["schedule","plan"].includes(mode)?
     <Table headers={["UTC Date","SKU","DC","Destination","Scheduled PCS","Dispatched PCS","Pending PCS","%"]}
      rows={r.schedules.map(x=>[x.date,x.sku,x.dcNo,x.destination,fmt(x.plannedPcs),
       fmt(x.actualPcs),fmt(x.pendingPcs),x.achievementPercent+"%"])}/>:
    isException?
     <Table headers={["Carton","DC","Category","Stage","PCS","Review Status","Reason"]}
      rows={r.exceptions.map(x=>[x.cartonNo,x.dcNo,x.category,x.stage,fmt(x.quantity),x.status,x.reason])}/>:
    ["transit","pending","history","reports","transport","loading","challen"].includes(mode)?
     <Table headers={["Date","Carton","DC","Warehouse","Shipped","Received","Pending","Status","Vehicle","ERP Doc"]}
      rows={r.history.filter(x=>mode!=="pending"||x.pendingReceiptPcs>0)
       .map(x=>[x.date?new Date(x.date).toLocaleString("en-IN"):"",x.cartonNo,x.dcNo,x.destination,
        fmt(x.shippedPcs),fmt(x.receivedPcs),fmt(x.pendingReceiptPcs),x.status,x.transport?.vehicleNo,x.documentId])}/>:
    mode==="delays"?
     <Table headers={["Carton","DC","Warehouse","Stage","Qty PCS","Transit Age (h)"]}
      rows={transit.filter(x=>x.ageHours!==null&&x.ageHours>=Number(delayThreshold||24))
       .map(x=>[x.cartonNo,x.dcNo,x.destination,x.stage,fmt(x.quantity),x.ageHours])}/>:
    ["ready","packed","entry","destination"].includes(mode)?
     <Table headers={["Carton","Order","DC","SKU","Colour","Size","Section","PCS"]}
      rows={viewBundles.map(x=>[x.cartonNo,x.orderNo,x.dcNo,x.sku,x.colour,x.size,x.section,fmt(x.quantity)])}/>:
     <Table headers={["Order","DC","SKU","Ready Packed PCS","Transit PCS","Cartons"]}
      rows={r.orders.map(x=>[x.orderNo,x.dcNo,x.sku,fmt(x.readyPackedPcs),fmt(x.inTransitPcs),x.cartons])}/>}
   </div>
   {isEntry&&!readonly&&<div className="classic-card">
    <h3>Dispatch Carton → Warehouse Transit</h3>
    <p>Posts one atomic ERP transfer, with vehicle/transporter recorded on its movement event. Warehouse receipt is a separate Warehouse Staff action.</p>
    <form className="form-grid" onSubmit={postDispatch}>
     <label>Packed Carton<select required value={bundleId}
      onChange={e=>{setBundleId(e.target.value);setQuantity("");}}>
      <option value="">Select PACKED carton</option>
      {ready.map(x=><option key={x.id} value={x.id}>
       {x.cartonNo} · {x.dcNo} · {x.sku} · {fmt(x.quantity)} PCS</option>)}
     </select></label>
     <label>Destination Warehouse<select required value={warehouse} onChange={e=>setWarehouse(e.target.value)}>
      <option value="">Choose assigned Warehouse master</option>
      {warehouseOpts.map(w=><option key={w.key} value={w.key}>{w.key} · {w.name}</option>)}
     </select></label>
     <label>Dispatch PCS<input type="number" required min="1" step="1"
      max={selected?.quantity||undefined} value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
     <label>Vehicle Number<input required minLength={3} maxLength={30} value={vehicleNo}
      onChange={e=>setVehicleNo(e.target.value.toUpperCase())}/></label>
     <label>Transporter Name<input required minLength={2} maxLength={100} value={transporter}
      onChange={e=>setTransporter(e.target.value)}/></label>
     <label>Driver Name<input maxLength={80} value={driver} onChange={e=>setDriver(e.target.value)}/></label>
     <label>LR / Docket Number<input maxLength={60} value={lrNo} onChange={e=>setLrNo(e.target.value)}/></label>
     <label>Loading Notes<input maxLength={300} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
     <button className="primary" type="submit" disabled={busy||!selected||!warehouse}>
      <Save size={16}/>{busy?"Posting…":"Post Warehouse Transit"}</button>
    </form>
    {!warehouseOpts.length&&<p role="alert">No active assigned Warehouse available. Company admin must create/assign warehouse access before integrated Dispatch.</p>}
   </div>}
   {isPlan&&!readonly&&<div className="classic-card">
    <h3>Schedule Despatch (non-stock plan)</h3>
    <form className="form-grid" onSubmit={postPlan}>
     <label>Date (UTC)<input type="date" required value={planDate}
      onChange={e=>setPlanDate(e.target.value)}/></label>
     <label>Finished SKU<input required maxLength={80} value={planSku}
      onChange={e=>setPlanSku(e.target.value.toUpperCase())}/></label>
     <label>DC (optional)<input maxLength={100} value={planDC}
      onChange={e=>setPlanDC(e.target.value.toUpperCase())}/></label>
     <label>Destination Warehouse<select required value={warehouse} onChange={e=>setWarehouse(e.target.value)}>
      <option value="">Choose Warehouse</option>
      {warehouseOpts.map(w=><option key={w.key} value={w.key}>{w.key} · {w.name}</option>)}
     </select></label>
     <label>Planned PCS<input required type="number" min="1" max="1000000" step="1"
      value={planPCS} onChange={e=>setPlanPCS(e.target.value)}/></label>
     <label>Notes<input maxLength={300} value={planNotes}
      onChange={e=>setPlanNotes(e.target.value)}/></label>
     <button className="primary" disabled={busy} type="submit"><Save size={16}/> Save Schedule</button>
    </form>
   </div>}
   {isException&&!readonly&&<div className="classic-card">
    <h3>Despatch Exception Review Request</h3>
    <p role="note">Request does NOT quarantine or reverse goods, deduct stock, stop shipment or approve damage; manager disposition is pending.</p>
    <form className="form-grid" onSubmit={postException}>
     <label>Active Carton / Transit<select required value={bundleId}
       onChange={e=>{setBundleId(e.target.value);setQuantity("");}}>
       <option value="">Choose carton</option>
       {r.bundles.map(x=><option key={x.id} value={x.id}>
        {x.cartonNo} · {x.stage} · {fmt(x.quantity)} PCS</option>)}
     </select></label>
     <label>Issue PCS<input required type="number" min="1" step="1"
      value={quantity} max={selected?.quantity||undefined}
      onChange={e=>setQuantity(e.target.value)}/></label>
     <label>Issue category<select value={category} onChange={e=>setCategory(e.target.value)}>
      {reasons.map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}
     </select></label>
     <label>Reason<input minLength={8} maxLength={300} required value={reason}
      onChange={e=>setReason(e.target.value)}/></label>
     <button type="submit" className="primary" disabled={!selected||busy}>
      <Save size={16}/> Submit Review Request</button>
    </form>
   </div>}
   {mode==="destination"&&<p>Current integrated transfer supports an active assigned Warehouse master only. Direct customer despatch, shipping address and customer delivery approval remain pending separate workflows.</p>}
   {mode==="challen"&&<div className="classic-card">
    <h3>Select Posted Transfer for Print</h3>
    <label>Stock movement / Shipment
     <select value={selectedDispatch} onChange={e=>setSelectedDispatch(e.target.value)}>
      <option value="">Choose a posted dispatch</option>
      {r.history.map(x=><option key={x.eventId} value={x.eventId}>
       {x.cartonNo} · {x.dcNo} · {fmt(x.shippedPcs)} PCS · {x.documentId}</option>)}
     </select>
    </label>
    <p>This prints a posted ERP warehouse stock transfer memo, NOT a GST tax invoice, statutory delivery challan, e-way bill or proof of warehouse receipt.</p>
   </div>}
  </div>
  {mode==="challen"&&doc&&<div className="dispatch-memo" aria-label="Stock transfer memo">
   <h3>UG SaaS · WAREHOUSE STOCK TRANSFER MEMO</h3>
   <p>ERP-generated stock movement · Not a tax invoice or signed delivery challan</p>
   <p className="dispatch-code">Document: {doc.documentId||"—"} · Event: {doc.eventId}</p>
   <table><tbody>
    <tr><th>Posted At</th><td>{doc.date?new Date(doc.date).toLocaleString("en-IN"):"—"}</td>
     <th>Warehouse</th><td>{doc.destination}</td></tr>
    <tr><th>Order / DC</th><td>{doc.orderNo||"—"} / {doc.dcNo||"—"}</td>
     <th>Carton</th><td>{doc.cartonNo}</td></tr>
    <tr><th>SKU</th><td>{doc.sku}</td><th>Size / Colour</th><td>{doc.size||"—"} / {doc.colour||"—"}</td></tr>
    <tr><th>Vehicle</th><td>{doc.transport?.vehicleNo||"—"}</td>
     <th>Transporter</th><td>{doc.transport?.transporter||"—"}</td></tr>
    <tr><th>LR / Docket</th><td>{doc.transport?.lrNo||"—"}</td>
     <th>Pieces</th><td>{fmt(doc.shippedPcs)} PCS</td></tr>
    <tr><th>Warehouse Received</th><td>{fmt(doc.receivedPcs)} PCS</td>
     <th>Receipt Pending</th><td>{fmt(doc.pendingReceiptPcs)} PCS</td></tr>
   </tbody></table>
   <QRGenerator value={`UGSAAS|DISPATCH|${doc.eventId}|${doc.documentId}`} size={150}/>
   <p>Verify transaction and physical quantities with the warehouse before acknowledgment.</p>
  </div>}
  {mode==="delays"&&<small>Ageing is based on transit bundle creation time, not a contracted delivery SLA.</small>}
  <small className="dispatch-not-memo">Event shipped/received numbers are cumulative movement records. Do not add them to live PACKED/TRANSIT stock figures.</small>
 </section>;
}
