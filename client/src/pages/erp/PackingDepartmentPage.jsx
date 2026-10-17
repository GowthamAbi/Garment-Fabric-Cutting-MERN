import {useEffect,useMemo,useRef,useState} from "react";
import {Download,Printer,RefreshCw,Save} from "lucide-react";
import {exportCsv} from "../../api.js";
import {useAuth} from "../../context/AuthContext.jsx";
import QRGenerator from "../../components/qr/QRGenerator.jsx";
import {getPackingOverview,savePackingCarton,savePackingPlan,saveRepackingRequest} from "../../api/packingDepartmentApi.js";
import {packingExportRecords} from "../../config/packingExport.mjs";
import Departments from "./Departments.jsx";
import "./PackingDepartmentPage.css";

const titles={
 overview:"Packing Plan Overview",ready:"Ready for Packing",progress:"Packed vs Pending",
 materials:"Packing Material Availability",assortment:"Size / Colour / Carton Status",
 issues:"Repacking / Damage",reports:"Packing Reports",master:"Packing Material Master",
 plan:"Packing Plan",entry:"Packing Entry", "material-issue":"Packing Accessories Consumption",
 label:"Carton QR / Label",stock:"Packed Stock & Pending",
 issue:"Repacking Request",history:"Packing History / Print",
 handover:"Dispatch Handover Readiness"
};
const initial={summary:{},lots:[],bundles:[],history:[],plans:[],masters:[],issues:[],materialConsumption:[]};
const fmt=n=>Number(n||0).toLocaleString("en-IN");
function Table({heads,rows}){
 return <div style={{overflowX:"auto"}}><table className="classic-table" style={{width:"100%",minWidth:790}}>
  <thead><tr>{heads.map(x=><th key={x}>{x}</th>)}</tr></thead>
  <tbody>{rows.length?rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{v??"—"}</td>)}</tr>):
   <tr><td colSpan={heads.length}>No matching packing records.</td></tr>}</tbody>
 </table></div>;
}
const types=["DAMAGED_CARTON","WRONG_ASSORTMENT","REPACK","SHORT_PACK","OTHER"];
export default function PackingDepartmentPage({mode="overview",notify}){
 const {user}=useAuth(),readonly=user?.role==="department_incharge";
 const [data,setData]=useState(initial),[search,setSearch]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [bundleId,setBundleId]=useState(""),[packingMaster,setPackingMaster]=useState(""),[quantity,setQuantity]=useState("");
 const [planDate,setPlanDate]=useState(()=>new Date().toISOString().slice(0,10)),
  [planSku,setPlanSku]=useState(""),[planDC,setPlanDC]=useState(""),[planQty,setPlanQty]=useState(""),[planNotes,setPlanNotes]=useState("");
 const [type,setType]=useState("REPACK"),[issueReason,setIssueReason]=useState("");
 const [cartonId,setCartonId]=useState("");
 const packingKey=useRef(crypto.randomUUID()),planKey=useRef(crypto.randomUUID()),issueKey=useRef(crypto.randomUUID());
 async function load(){try{const response=await getPackingOverview();setData(response);setError("")}
  catch(e){setError(e.message);notify?.(e.message)}}
 useEffect(()=>{load()},[]);
 const query=search.toLowerCase().trim(),match=(...xs)=>xs.some(x=>String(x??"").toLowerCase().includes(query));
 const filtered=useMemo(()=>({
  lots:(data.lots||[]).filter(l=>match(l.lotNo,l.dcNo,l.orderNo,l.sku,l.colour,l.size,l.section)),
  bundles:(data.bundles||[]).filter(b=>match(b.bundleNo,b.dcNo,b.sku,b.colour,b.size,b.section,b.stage)),
  history:(data.history||[]).filter(h=>match(h.cartonNo,h.dcNo,h.sku,h.lotNo)),
  plans:(data.plans||[]).filter(p=>match(p.date,p.sku,p.dcNo)),
  masters:(data.masters||[]).filter(m=>match(m.key,m.sku,m.name)),
  issues:(data.issues||[]).filter(i=>match(i.cartonNo,i.dcNo,i.lotNo,i.category))
 }),[data,query]);
 const available=mode==="ready"||mode==="entry"?filtered.bundles.filter(b=>b.stage==="IRONED"):
  mode==="label"||mode==="handover"?filtered.bundles.filter(b=>b.stage==="PACKED"):
  filtered.bundles;
 const selected=(data.bundles||[]).find(b=>b.bundleId===bundleId);
 const activeMasters=(data.masters||[]).filter(m=>m.active&&m.sku===selected?.sku);
 const selectedMaster=(data.masters||[]).find(m=>m.key===packingMaster&&m.active&&m.sku===selected?.sku);
 const labelCarton=(data.bundles||[]).find(b=>b.bundleId===cartonId&&b.stage==="PACKED");
 const rows={...filtered,bundles:available};
 const csv=packingExportRecords(mode,rows),s=data.summary||{};
 const needsMaterials=mode==="materials"||mode==="material-issue";
 const issueMode=["issue","issues"].includes(mode);
 const listMaterials=filtered.bundles.filter(b=>b.stage==="IRONED");
 const readyOptions=filtered.bundles.filter(b=>b.stage==="IRONED");
 const packingOptions=filtered.bundles.filter(b=>b.stage==="PACKED");
 function chooseBundle(id){setBundleId(id);setQuantity("");setPackingMaster("");}
 async function postPacking(e){
  e.preventDefault();const qty=Number(quantity);
  if(!selected||selected.stage!=="IRONED"||!Number.isSafeInteger(qty)||qty<1||qty>selected.quantity||
   !selectedMaster){setError("Select IRONED bundle, matching active Packing Master and valid whole PCS");return}
  setBusy(true);setError("");
  try{
   const result=await savePackingCarton({bundleId,quantity:qty,packingMaster,key:packingKey.current});
   packingKey.current=crypto.randomUUID();chooseBundle("");
   const issuedId=result?.details?.carton?._id;
   if(issuedId)setCartonId(String(issuedId));
   notify?.("PACKED carton saved; accessories consumed atomically with ERP stock");
   await load();
  }catch(err){setError(err.message);notify?.(err.message)}finally{setBusy(false)}
 }
 async function savePlan(e){
  e.preventDefault();setBusy(true);setError("");
  try{
   await savePackingPlan({date:planDate,sku:planSku,dcNo:planDC,
    quantity:Number(planQty),notes:planNotes,key:planKey.current});
   planKey.current=crypto.randomUUID();setPlanQty("");setPlanNotes("");
   notify?.("Packing plan saved (planning only; no stock movement)");await load();
  }catch(err){setError(err.message);notify?.(err.message)}finally{setBusy(false)}
 }
 async function saveIssue(e){
  e.preventDefault();const count=Number(quantity);
  if(!selected||selected.stage!=="PACKED"||!Number.isSafeInteger(count)||count<1||count>selected.quantity){
   setError("Choose existing packed carton and valid whole PCS");return;
  }
  setBusy(true);setError("");
  try{
   await saveRepackingRequest({bundleId,quantity:count,category:type,reason:issueReason,
    key:issueKey.current});
   issueKey.current=crypto.randomUUID();chooseBundle("");setIssueReason("");
   notify?.("Repacking review request saved; no stock has changed");await load();
  }catch(err){setError(err.message);notify?.(err.message)}finally{setBusy(false)}
 }
 return <section className={`classic-page packing-page ${mode==="label"?"packing-label-mode":""}`}>
  <div className="packing-nolabel">
   <header className="classic-title">
    <div><small>PACKING · {readonly?"HEAD / READ ONLY":"STAFF / MANAGEMENT"}</small>
     <h2>{titles[mode]||"Packing Department"}</h2>
     <p>Actual IRONED & PACKED ERP bundles. Accessories are issued only in the audited Packing transaction.</p>
    </div><div className="page-actions">
     <button type="button" onClick={load}><RefreshCw size={16}/> Refresh</button>
     <button type="button" disabled={!csv.length} onClick={()=>exportCsv("packing-"+mode+".xls",csv)}>
      <Download size={16}/> Excel</button>
     <button type="button" onClick={()=>window.print()}><Printer size={16}/> Print</button>
    </div>
   </header>
   {error&&<p role="alert" className="error-text">{error}</p>}
   <div className="packing-stat-grid">
    {Object.entries({"Ready from Ironing PCS":s.readyToPackPcs,"Packed Awaiting Dispatch PCS":s.packedAwaitingDispatchPcs,
     "Active Cartons":s.activeCartons,"Recorded Pack Event PCS":s.packedEventPcs,
     "Planning Target PCS":s.plannedPcs,"Pending Repack Requests":s.openIssueRequests})
     .map(([name,value])=><div className="classic-card" key={name}><small>{name}</small><h3>{fmt(value)}</h3></div>)}
   </div>
   <div className="classic-card">
    <label>Search DC / Lot / Carton / SKU / Size / Colour
     <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="DC, SKU or BND carton code"/>
    </label>
    {["plan","overview"].includes(mode)?<Table heads={["Date UTC","SKU","DC","Target PCS","Packed PCS","Pending PCS","Master","Materials Ready"]}
     rows={filtered.plans.map(p=>[p.date,p.sku,p.dcNo||"All DCs",fmt(p.targetPcs),fmt(p.actualPcs),
      fmt(p.balancePcs),p.packingMasterKey||"Not saved",
      p.materialRequirements.length?p.materialRequirements.every(m=>m.sufficient)?"Yes":"Shortage":"No saved master"] )}/>:
    issueMode?<Table heads={["Carton","DC","Lot","Issue","PCS","Status","Reason"]}
     rows={filtered.issues.map(i=>[i.cartonNo,i.dcNo,i.lotNo,i.category,fmt(i.quantity),i.status,i.reason])}/>:
    mode==="master"?<Table heads={["Version Key","Finished SKU","Master","Materials","Active"]}
     rows={filtered.masters.map(m=>[m.key,m.sku,m.name,m.materials.map(x=>x.sku+" ("+x.quantity+"/"+x.perPieces+" PCS)").join(", "),m.active?"Yes":"No"])}/>:
    mode==="materials"?<Table heads={["Bundle","DC","Material","Required","Available","Shortage","Ready"]}
     rows={listMaterials.flatMap(b=>b.materials.map(m=>[b.bundleNo,b.dcNo,m.sku,m.requiredQty,
      m.availableQty,m.shortageQty,m.sufficient?"YES":"NO"]))}/>:
    mode==="material-issue"?<Table heads={["Date UTC","Carton","DC","Material SKU","Consumed Qty"]}
     rows={filtered.history.flatMap(h=>h.materials.map(m=>[h.date,h.cartonNo,h.dcNo,m.sku,m.quantity]))}/>:
    ["history","reports"].includes(mode)?<Table heads={["Date UTC","Carton","DC","Lot","SKU","Packed PCS","Document"]}
     rows={filtered.history.map(h=>[h.date,h.cartonNo,h.dcNo,h.lotNo,h.sku,fmt(h.quantity),h.documentId])}/>:
    ["ready","entry","label","handover","assortment"].includes(mode)?<Table
     heads={["Bundle/Carton","DC","Lot","SKU","Colour","Size","Section","Stage","PCS"]}
     rows={available.map(b=>[b.bundleNo,b.dcNo,b.lotNo,b.sku,b.colour||"—",b.size||"—",
      b.section,b.stage,fmt(b.quantity)])}/>:
     <Table heads={["Lot","DC","Order","SKU","Colour","Size","Ready PCS","Packed Awaiting Dispatch"]}
      rows={filtered.lots.map(l=>[l.lotNo,l.dcNo,l.orderNo,l.sku,l.colour,l.size,
       fmt(l.readyToPackPcs),fmt(l.packedAwaitingDispatchPcs)])}/>}
   </div>
   {mode==="entry"&&!readonly&&<div className="classic-card">
    <h3>Packing Entry — atomic carton & accessories movement</h3>
    <p>Source must be IRONED. Matching approved/current Packing Master is required; material availability is checked again by the ERP transaction.</p>
    <form className="form-grid" onSubmit={postPacking}>
     <label>Ready IRONED bundle<select value={bundleId} required onChange={e=>chooseBundle(e.target.value)}>
      <option value="">Select a bundle</option>
      {readyOptions.map(b=><option key={b.bundleId} value={b.bundleId}>
       {b.bundleNo} · {b.dcNo} · {b.sku} · {fmt(b.quantity)} PCS</option>)}
     </select></label>
     <label>Active Packing Master for this SKU<select required value={packingMaster}
      onChange={e=>setPackingMaster(e.target.value)}>
      <option value="">Choose correct master version</option>
      {activeMasters.map(m=><option key={m.key} value={m.key}>{m.key} · {m.name}</option>)}
     </select></label>
     <label>PCS to Pack<input type="number" min="1" step="1" required value={quantity}
      max={selected?.quantity||undefined} onChange={e=>setQuantity(e.target.value)}/></label>
     {selected&&<p>DC {selected.dcNo}; Available: {fmt(selected.quantity)} PCS. Inventory consumption will depend on the selected master and pack quantity.</p>}
     {!activeMasters.length&&selected&&<p role="alert">No active Packing Master exists for {selected.sku}. Create a master first.</p>}
     <button type="submit" className="primary" disabled={busy||!selected||!selectedMaster}>
      <Save size={16}/>{busy?"Packing…":"Confirm Packing & Issue Materials"}</button>
    </form>
   </div>}
   {mode==="plan"&&!readonly&&<div className="classic-card">
    <h3>Packing Production Plan</h3><p>Plan is a non-posting production target. Actual packed pieces come from committed PACK events only.</p>
    <form className="form-grid" onSubmit={savePlan}>
     <label>Plan date (UTC)<input type="date" required value={planDate}
      onChange={e=>setPlanDate(e.target.value)}/></label>
     <label>Finished SKU<input required value={planSku} maxLength={80}
      onChange={e=>setPlanSku(e.target.value.toUpperCase())}/></label>
     <label>DC No (optional — empty covers SKU total)<input value={planDC} maxLength={100}
      onChange={e=>setPlanDC(e.target.value.toUpperCase())}/></label>
     <label>Target PCS<input type="number" min="1" step="1" max="1000000" required value={planQty}
      onChange={e=>setPlanQty(e.target.value)}/></label>
     <label>Notes<input maxLength={300} value={planNotes}
      onChange={e=>setPlanNotes(e.target.value)}/></label>
     <button type="submit" disabled={busy} className="primary"><Save size={16}/> Save Plan</button>
    </form>
   </div>}
   {mode==="issue"&&!readonly&&<div className="classic-card">
    <h3>Repacking / Damage Review Request</h3>
    <p role="note">Request is recorded for management review. It does NOT change, reserve or quarantine stock or perform a repack.</p>
    <form className="form-grid" onSubmit={saveIssue}>
     <label>Active PACKED carton<select required value={bundleId} onChange={e=>chooseBundle(e.target.value)}>
      <option value="">Select carton</option>
      {packingOptions.map(b=><option key={b.bundleId} value={b.bundleId}>
       {b.bundleNo} · {b.dcNo} · {fmt(b.quantity)} PCS</option>)}
     </select></label>
     <label>Issue PCS<input type="number" required min="1" step="1" value={quantity}
      max={selected?.quantity||undefined} onChange={e=>setQuantity(e.target.value)}/></label>
     <label>Reason category<select value={type} onChange={e=>setType(e.target.value)}>
      {types.map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}
     </select></label>
     <label>Explanation<input required minLength={8} maxLength={300} value={issueReason}
      onChange={e=>setIssueReason(e.target.value)}/></label>
     <button type="submit" disabled={busy||selected?.stage!=="PACKED"} className="primary">
      <Save size={16}/> Submit Review Request</button>
    </form>
   </div>}
   {mode==="master"&&!readonly&&<div className="classic-card">
    <h3>Size/SKU-Specific Packing Master</h3>
    <p>Use the existing versioned ERP Packing Master, which validates material SKUs and quantity-per-pieces. Saving a master does not issue inventory.</p>
    <Departments initialDepartment="PACKING" notify={notify}/>
   </div>}
   {mode==="material-issue"&&<p>Accessories consumption above is from posted PACK documents only. Do not issue material a second time via a separate unlinked form.</p>}
   {mode==="handover"&&<p>PACKED cartons are available to Dispatch. No physical dispatch or warehouse receipt is implied; Dispatch uses the existing controlled transfer workflow.</p>}
   {mode==="label"&&<div className="classic-card">
     <h3>Choose Carton for Label</h3>
     <label>Packed Carton<select value={cartonId} onChange={e=>setCartonId(e.target.value)}>
       <option value="">Select active carton</option>
       {packingOptions.map(b=><option key={b.bundleId} value={b.bundleId}>
         {b.bundleNo} · {b.dcNo} · {b.sku} · {fmt(b.quantity)} PCS</option>)}
     </select></label>
     <p>QR encodes carton/DC identification only; scan with a supported reader and verify ERP login/permissions to open trace. Physical label printer alignment still needs testing.</p>
   </div>}
  </div>
  {(mode==="label"||mode==="entry"&&labelCarton)&&labelCarton&&
   <div className="packing-label-area" aria-label="Packing carton identity label">
    <h3>UG SaaS · PACKED CARTON</h3>
    <QRGenerator value={`UGSAAS|PACKED|${labelCarton.bundleNo}|${labelCarton.dcNo}`} size={190}/>
    <dl>
     <dt>Carton No.</dt><dd>{labelCarton.bundleNo}</dd>
     <dt>DC</dt><dd>{labelCarton.dcNo||"—"}</dd>
     <dt>SKU</dt><dd>{labelCarton.sku}</dd>
     <dt>Colour / Size</dt><dd>{labelCarton.colour||"—"} / {labelCarton.size||"—"}</dd>
     <dt>Pieces</dt><dd>{fmt(labelCarton.quantity)}</dd>
     <dt>Stage</dt><dd>PACKED / Dispatch pending</dd>
    </dl>
   </div>}
  <small className="packing-nolabel">Packed event PCS may include later handling and must not be added to live carton stock; historical records and live stock are different metrics.</small>
 </section>;
}
