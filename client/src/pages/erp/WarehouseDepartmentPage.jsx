import {useEffect,useMemo,useRef,useState} from "react";
import {Download,Printer,RefreshCw,Save} from "lucide-react";
import {exportCsv} from "../../api.js";
import {useAuth} from "../../context/AuthContext.jsx";
import {BundleTrace} from "./Departments.jsx";
import {getWarehouseOverview,getWarehouseBoundaries,receiveWarehouseBundle,
 transferWarehouseStock,createWarehouseMaster,createWarehouseBin,
 relocateWarehouseStock,requestWarehouseCount,externalWarehouseOutward} from "../../api/warehouseDepartmentApi.js";
import {warehouseExportRecords} from "../../config/warehouseExport.mjs";
const titles={
 overview:"Warehouse Stock Overview",inbound:"Inbound / Outbound Status",
 receipts:"Pending Receipts",transfers:"Stock Transfers",
 aging:"Stock Aging / Shortage",variance:"Stock Variance Monitoring",
 reports:"Warehouse Reports",master:"Warehouse / Location Master",
 receipt:"Inbound Receipt",putaway:"Put-Away / Location Entry",
 stock:"Warehouse Stock",outward:"Stock Issue / Outward",
 shop:"Transfer to Shop",returns:"Shop Return Receipt",
 count:"Physical Stock Count",adjustment:"Stock Adjustment Request",
 ledger:"Stock Ledger / QR",history:"History & Reports"
};
const initial={summary:{},locations:[],shops:[],bins:[],bundles:[],stocks:[],inbound:[],history:[],requests:[]};
const fmt=n=>Number(n||0).toLocaleString("en-IN");
const table=(head,rows)=><div style={{overflowX:"auto"}}><table className="classic-table"
 style={{width:"100%",minWidth:820}}><thead><tr>{head.map(x=><th key={x}>{x}</th>)}</tr></thead>
 <tbody>{rows.length?rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v??"—"}</td>)}</tr>):
 <tr><td colSpan={head.length}>No matching warehouse records.</td></tr>}</tbody></table></div>;
export default function WarehouseDepartmentPage({mode="overview",notify}){
 const {user}=useAuth(),readonly=user?.role==="department_incharge";
 const [data,setData]=useState(initial),[boundaries,setBoundaries]=useState({}),[search,setSearch]=useState(""),
  [error,setError]=useState(""),[busy,setBusy]=useState(false);
 const [bundleId,setBundleId]=useState(""),[quantity,setQuantity]=useState(""),
  [warehouse,setWarehouse]=useState(""),[binKey,setBinKey]=useState(""),[destination,setDestination]=useState(""),
  [reference,setReference]=useState(""),[counterparty,setCounterparty]=useState("");
 const [masterKey,setMasterKey]=useState(""),[masterName,setMasterName]=useState(""),
  [rack,setRack]=useState(""),[binLabel,setBinLabel]=useState("");
 const [counted,setCounted]=useState(""),[varianceType,setVarianceType]=useState("MISSING"),
  [reason,setReason]=useState(""),[trace,setTrace]=useState("");
 const [ageHours,setAgeHours]=useState("48");
 const keys=useRef({receipt:crypto.randomUUID(),shop:crypto.randomUUID(),
  outward:crypto.randomUUID(),master:crypto.randomUUID(),bin:crypto.randomUUID(),
  putaway:crypto.randomUUID(),count:crypto.randomUUID()});
 const load=async()=>{try{const [overview,limits]=await Promise.all([
  getWarehouseOverview(),getWarehouseBoundaries()]);setData(overview);setBoundaries(limits);setError("")}
  catch(e){setError(e.message);notify?.(e.message)}};
 useEffect(()=>{load()},[]);
 const match=(...v)=>v.some(x=>String(x??"").toLowerCase().includes(search.trim().toLowerCase()));
 const r=useMemo(()=>({
  locations:(data.locations||[]).filter(x=>match(x.key,x.name)),
  shops:(data.shops||[]).filter(x=>match(x.key,x.name)),
  bins:(data.bins||[]).filter(x=>match(x.key,x.warehouse,x.rack,x.bin)),
  bundles:(data.bundles||[]).filter(x=>match(x.code,x.dcNo,x.lotNo,x.sku,x.colour,x.size,x.warehouse,x.bin)),
  stocks:(data.stocks||[]).filter(x=>match(x.warehouse,x.sku,x.bin,x.colour,x.size)),
  inbound:(data.inbound||[]).filter(x=>match(x.dcNo,x.cartonNo,x.warehouse,x.origin,x.status)),
  history:(data.history||[]).filter(x=>match(x.dcNo,x.cartonNo,x.warehouse,x.sku,x.kind)),
  requests:(data.requests||[]).filter(x=>match(x.warehouse,x.kind,x.stage,x.reason))
 }),[data,search]);
 const receipts=r.bundles.filter(x=>x.stage==="TRANSIT_WAREHOUSE");
 const stocks=r.bundles.filter(x=>x.stage.startsWith("WAREHOUSE:"));
 const outgoing=r.bundles.filter(x=>x.stage.startsWith("TRANSIT_SHOP:"));
 const currentList=mode==="receipt"||mode==="receipts"||mode==="returns"?receipts:
  mode==="shop"||mode==="outward"||mode==="putaway"||mode==="count"||mode==="adjustment"?stocks:
  r.bundles;
 const selected=(data.bundles||[]).find(x=>x.id===bundleId);
 const selectableBins=(data.bins||[]).filter(x=>x.warehouse===selected?.warehouse);
 const canMove=(mode==="receipt"&&selected?.stage==="TRANSIT_WAREHOUSE")||
   (mode==="shop"||mode==="outward")&&selected?.stage?.startsWith("WAREHOUSE:")||
   mode==="putaway"&&selected?.stage?.startsWith("WAREHOUSE:");
 const dataForExport={...r,bundles:currentList};
 const csv=warehouseExportRecords(mode==="receipt"?"receipts":mode==="shop"?"transfers":mode,dataForExport);
 const summary=data.summary||{};
 const reset=()=>{setBundleId("");setQuantity("");setCounted("");setReason("");setBinKey("");setDestination("");};
 async function run(e,kind,submit){
  e.preventDefault();setBusy(true);setError("");
  try{
   const body=await submit(keys.current[kind]);const key=keys.current[kind];
   keys.current[kind]=crypto.randomUUID();reset();notify?.("Warehouse action saved (ERP key "+key.slice(0,8)+")");await load();
   return body;
  }catch(err){setError(err.message);notify?.(err.message)}finally{setBusy(false)}
 }
 const pcs=Number(quantity);
 const validQty=selected&&Number.isSafeInteger(pcs)&&pcs>0&&pcs<=selected.quantity;
 return <section className="classic-page">
  <header className="classic-title">
   <div><small>WAREHOUSE · {readonly?"HEAD / READ ONLY":"STAFF / MANAGEMENT"}</small>
    <h2>{titles[mode]||"Warehouse Operations"}</h2>
    <p>Real ERP carton ledger: dispatched transit, received warehouse stock and shop-bound transit are separate stages.</p>
   </div><div className="page-actions">
    <button onClick={load} type="button"><RefreshCw size={16}/> Refresh</button>
    <button onClick={()=>exportCsv("warehouse-"+mode+".xls",csv)} disabled={!csv.length} type="button">
     <Download size={16}/> Excel</button>
    <button onClick={()=>window.print()} type="button"><Printer size={16}/> Print</button>
   </div>
  </header>
  {error&&<p role="alert" className="error-text">{error}</p>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
   {Object.entries({"Warehouse Stock PCS":summary.warehouseStockPcs,"Incoming Transit PCS":summary.inboundTransitPcs,
    "Shop-bound Transit PCS":summary.outboundTransitPcs,"Unassigned Bin PCS":summary.unassignedBinPcs,
    "Open Count Requests":summary.openCountRequests}).map(([label,v])=>
     <div className="classic-card" key={label}><small>{label}</small><h3>{fmt(v)}</h3></div>)}
  </div>
  <div className="classic-card">
   <label>Search warehouse / DC / SKU / carton / bin
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search assigned locations"/>
   </label>
   {mode==="aging"&&<label>Age threshold (hours, indicative)
    <input type="number" step="1" min="1" max="720" value={ageHours}
     onChange={e=>setAgeHours(e.target.value)}/></label>}
   {mode==="master"?table(["Warehouse","Name","Address"],
     r.locations.map(x=>[x.key,x.name,x.address])):null}
   {mode==="putaway"?table(["Warehouse","Bin Key","Rack","Bin Label"],
    r.bins.map(x=>[x.warehouse,x.key,x.rack,x.bin])):null}
   {["overview","stock"].includes(mode)?table(["Warehouse","SKU","Colour","Size","Bin","PCS","Bundles"],
    r.stocks.map(x=>[x.warehouse,x.sku,x.colour,x.size,x.bin||"Unassigned",fmt(x.quantity),x.bundleCount])):null}
   {["inbound","receipts","returns"].includes(mode)?table(
    ["Source","DC","Carton","Warehouse","Sent","Received","Pending","Receipt Status"],
    r.inbound.filter(x=>mode!=="returns"||x.origin==="SHOP")
     .map(x=>[x.origin,x.dcNo,x.cartonNo,x.warehouse,fmt(x.shippedPcs),
      fmt(x.receivedPcs),fmt(x.pendingPcs),x.status])):null}
   {["transfers","outward","shop","history","reports"].includes(mode)?table(
    ["Date","Action","Dept","Warehouse","DC","Carton","PCS","Stage","ERP Doc"],
    r.history.map(x=>[x.date?new Date(x.date).toLocaleString("en-IN"):"",x.kind,x.department,
     x.warehouse,x.dcNo,x.cartonNo,fmt(x.quantity),x.stage,x.documentId])):null}
   {["variance","adjustment"].includes(mode)?table(
    ["Warehouse","Type","Expected","Counted","Difference","Review Status","Reason"],
    r.requests.map(x=>[x.warehouse,x.kind,fmt(x.expectedPcs),fmt(x.countedPcs),
     fmt(x.differencePcs),x.status,x.reason])):null}
   {mode==="aging"?table(["Warehouse","Bin","DC","Carton","SKU","PCS","Age Hours"],
    r.bundles.filter(x=>x.ageHours!==null&&x.ageHours>=Number(ageHours||48))
     .map(x=>[x.warehouse,x.bin,x.dcNo,x.code,x.sku,fmt(x.quantity),x.ageHours])):null}
   {["receipt","ledger","count"].includes(mode)?table(
    ["Bundle","DC","SKU","Warehouse","Stage","Bin","PCS"],
    currentList.map(x=>[x.code,x.dcNo,x.sku,x.warehouse,x.stage,x.bin||"Unassigned",fmt(x.quantity)])):null}
  </div>
  {mode==="master"&&!readonly&&<div className="classic-card">
   <h3>Create Warehouse Location Master</h3>
   <form className="form-grid" onSubmit={e=>run(e,"master",async key=>{
    await createWarehouseMaster({masterKey, name:masterName,key});setMasterKey("");setMasterName("");
   })}>
    <label>Warehouse Key<input value={masterKey} required minLength={2} maxLength={60}
     onChange={e=>setMasterKey(e.target.value.toUpperCase())}/></label>
    <label>Warehouse Name<input required value={masterName} onChange={e=>setMasterName(e.target.value)}/></label>
    <button className="primary" disabled={busy} type="submit"><Save size={16}/> Save Warehouse</button>
   </form>
  </div>}
  {mode==="putaway"&&!readonly&&<>
   <div className="classic-card">
    <h3>Rack / Bin Master</h3>
    <form className="form-grid" onSubmit={e=>run(e,"bin",async key=>{
     await createWarehouseBin({binKey,warehouse,rack,bin:binLabel,key});setBinKey("");setRack("");setBinLabel("");
    })}>
     <label>Warehouse<select required value={warehouse} onChange={e=>setWarehouse(e.target.value)}>
      <option value="">Select Warehouse</option>
      {(data.locations||[]).map(w=><option key={w.key} value={w.key}>{w.name} · {w.key}</option>)}
     </select></label>
     <label>Unique Bin Key<input value={binKey} required onChange={e=>setBinKey(e.target.value.toUpperCase())}/></label>
     <label>Rack Code<input value={rack} required onChange={e=>setRack(e.target.value)}/></label>
     <label>Bin Label<input value={binLabel} required onChange={e=>setBinLabel(e.target.value)}/></label>
     <button disabled={busy} className="primary" type="submit"><Save size={16}/> Save Bin</button>
    </form>
   </div>
   <div className="classic-card"><h3>Put-Away / Move Existing PCS</h3>
    <p>Moves pieces into the selected bin with an audited ERP RELOCATE movement. Quantity cannot exceed live stock.</p>
    <form className="form-grid" onSubmit={e=>run(e,"putaway",async key=>{
     await relocateWarehouseStock({bundleId,binKey,quantity:Number(quantity),key});
    })}>
     <label>Received Stock Bundle<select required value={bundleId} onChange={e=>setBundleId(e.target.value)}>
      <option value="">Select</option>{stocks.map(x=><option key={x.id} value={x.id}>{x.code} · {x.warehouse} · {fmt(x.quantity)} PCS</option>)}
     </select></label>
     <label>Warehouse Bin<select required value={binKey} onChange={e=>setBinKey(e.target.value)}>
      <option value="">Select same-warehouse Bin</option>
      {selectableBins.map(x=><option key={x.key} value={x.key}>{x.rack} / {x.bin}</option>)}
     </select></label>
     <label>PCS<input type="number" min="1" step="1" max={selected?.quantity||undefined}
      value={quantity} required onChange={e=>setQuantity(e.target.value)}/></label>
     <button className="primary" type="submit" disabled={busy||!validQty||!selectableBins.some(x=>x.key===binKey)}>
      <Save size={16}/> Confirm Put-Away</button>
    </form>
   </div>
  </>}
  {mode==="receipt"&&!readonly&&<div className="classic-card">
   <h3>Physical Receipt from Dispatch / Shop Return</h3>
   <p>Partial receipt uses existing ERP TRANSFER transaction. Only Warehouse staff can move TRANSIT_WAREHOUSE → WAREHOUSE location.</p>
   <form className="form-grid" onSubmit={e=>run(e,"receipt",async key=>{
    await receiveWarehouseBundle({bundleId,quantity:Number(quantity),key});
   })}>
    <label>In Transit Bundle<select required value={bundleId} onChange={e=>setBundleId(e.target.value)}>
     <option value="">Select assigned inbound transit</option>
     {receipts.map(x=><option key={x.id} value={x.id}>
      {x.code} · {x.dcNo} · {x.warehouse} · {fmt(x.quantity)} PCS</option>)}
    </select></label>
    <label>Physically Received PCS<input type="number" min="1" step="1" required
     max={selected?.quantity||undefined} value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
    <button disabled={busy||!validQty||!canMove} className="primary" type="submit">
     <Save size={16}/> Confirm Receipt</button>
   </form>
  </div>}
  {["shop","outward"].includes(mode)&&!readonly&&<div className="classic-card">
   <h3>{boundaries?.externalOutward?"External Warehouse Issue":"Warehouse to Shop Transfer"}</h3>
   {boundaries?.externalOutward?<form className="form-grid" onSubmit={e=>run(e,"outward",async key=>{
    await externalWarehouseOutward({bundleId,quantity:Number(quantity),reference,counterparty,key});
   })}>
    <p>Shop subscription inactive: use a unique external issue reference. This posts a controlled outward ledger transaction.</p>
    <label>Stock Bundle<select required value={bundleId} onChange={e=>setBundleId(e.target.value)}>
      <option value="">Select</option>{stocks.map(x=><option key={x.id} value={x.id}>{x.code} · {x.warehouse} · {fmt(x.quantity)} PCS</option>)}</select></label>
    <label>Issue PCS<input type="number" required min="1" step="1" max={selected?.quantity||undefined}
      value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
    <label>External Reference<input required value={reference} onChange={e=>setReference(e.target.value)}/></label>
    <label>Counterparty<input required value={counterparty} onChange={e=>setCounterparty(e.target.value)}/></label>
    <button className="primary" disabled={!validQty||busy}>Post External Outward</button>
   </form>:<form className="form-grid" onSubmit={e=>run(e,"shop",async key=>{
    await transferWarehouseStock({bundleId,quantity:Number(quantity),destination,key});
   })}>
    <p>Shop transit is created first; Shop Staff must separately confirm their physical receipt.</p>
    <label>Warehouse Stock Bundle<select required value={bundleId} onChange={e=>setBundleId(e.target.value)}>
     <option value="">Select</option>{stocks.map(x=><option value={x.id} key={x.id}>{x.code} · {x.warehouse} · {fmt(x.quantity)} PCS</option>)}
    </select></label>
    <label>Destination Shop<select required value={destination} onChange={e=>setDestination(e.target.value)}>
     <option value="">Select Shop</option>{(data.shops||[]).map(x=><option key={x.key} value={x.key}>{x.key} · {x.name}</option>)}
    </select></label>
    <label>Issue PCS<input required type="number" min="1" step="1"
     max={selected?.quantity||undefined} value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
    <button className="primary" disabled={!validQty||!destination||busy} type="submit">
     <Save size={16}/> Transfer to Shop Transit</button>
   </form>}
  </div>}
  {["count","adjustment"].includes(mode)&&!readonly&&<div className="classic-card">
   <h3>Physical Count / Stock Adjustment Request</h3>
   <p>Only lower physical counts create reviewed shortage/damage requests. Matching counts need no adjustment.
    Excess/found stock needs a separately reviewed source receipt. A different authorized company administrator must approve any loss or damage adjustment.</p>
   <form className="form-grid" onSubmit={e=>run(e,"count",async key=>{
    if(Number(counted)===selected?.quantity){notify?.("Physical count matches stock. No adjustment request needed.");return}
    await requestWarehouseCount({bundleId,countedQty:Number(counted),kind:varianceType,reason,key});
   })}>
    <label>Warehouse Stock<select required value={bundleId} onChange={e=>{setBundleId(e.target.value);setCounted("");}}>
     <option value="">Select stock bundle</option>
     {stocks.map(x=><option key={x.id} value={x.id}>{x.code} · {x.warehouse} · {fmt(x.quantity)} PCS</option>)}
    </select></label>
    <label>Physically Counted Good PCS<input type="number" min="0" step="1" required
     max={selected?.quantity||undefined} value={counted} onChange={e=>setCounted(e.target.value)}/></label>
    <label>Difference Type<select value={varianceType} onChange={e=>setVarianceType(e.target.value)}>
     <option value="MISSING">Missing</option><option value="DAMAGED">Damaged</option>
    </select></label>
    <label>Reason<input required minLength={3} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <button className="primary" type="submit" disabled={!selected||busy||counted===""||
      !Number.isSafeInteger(Number(counted))||Number(counted)<0||Number(counted)>selected.quantity}>
      <Save size={16}/> Check & Request Adjustment</button>
   </form>
  </div>}
  {mode==="ledger"&&<div className="classic-card">
   <h3>Authenticated Warehouse Bundle QR / Trace</h3>
   <label>Warehouse Bundle<select value={trace} onChange={e=>setTrace(e.target.value)}>
    <option value="">Select bundle to inspect or print QR</option>
    {stocks.map(x=><option key={x.id} value={x.id}>{x.code} · {x.warehouse} · {x.sku} · {fmt(x.quantity)} PCS</option>)}
   </select></label>
   {trace&&<BundleTrace bundleId={trace} onClose={()=>setTrace("")}/>}
  </div>}
  {mode==="returns"&&<p>Shop-to-Warehouse return is initiated by Shop staff through ERP transfer; Warehouse Staff completes its receipt from Transit in the Inbound Receipt screen. Direct customer sales returns go to Checking and are not credited into Warehouse automatically.</p>}
  {mode==="variance"&&<p>Variance status reflects independent Administrator approval. Pending requests have NOT reduced stock; an approval checks that the original bundle count is unchanged.</p>}
  {mode==="aging"&&<p>Age is bundle creation age, not guaranteed stock expiry or a configured shelf-life rule.</p>}
  <small>Current warehouse stock, pending transit and posted movement history are different metrics. Do not sum them as one balance.</small>
 </section>;
}
