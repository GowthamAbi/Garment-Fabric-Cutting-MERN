import {useEffect,useMemo,useState} from "react";
import {Download,Printer,RefreshCw,Save} from "lucide-react";
import {deliveryApi} from "../../api/deliveryApi.js";
import {exportCsv} from "../../api.js";
import {useAuth} from "../../context/AuthContext.jsx";

const labels={
 overview:"Delivery Dashboard & Monitoring",
 completion:"Cutting & Folding Completion",
 vendors:"Vendor / Section Status",
 challans:"Delivery Challan Monitoring",
 balance:"Delivered vs Pending",
 delays:"Delivery Delays",
 reports:"Delivery Reports",
 handover:"Delivery Handover",
 pending:"Vendor Pending Quantity",
};
function Table({labels,rows,empty="No matching records yet."}){
 return <div style={{overflowX:"auto"}}>
  <table className="classic-table" style={{minWidth:650,width:"100%"}}>
   <thead><tr>{labels.map(x=><th key={x}>{x}</th>)}</tr></thead>
   <tbody>{rows.length?rows.map((r,i)=><tr key={i}>{r.map((x,j)=><td key={j}>{x??"—"}</td>)}</tr>):
    <tr><td colSpan={labels.length}>{empty}</td></tr>}</tbody>
  </table>
 </div>;
}
const n=x=>Number(x||0).toLocaleString("en-IN");
export default function DeliveryMonitoringPage({mode="overview",notify}){
 const {user}=useAuth();
 const readonly=user?.role==="department_incharge";
 const [data,setData]=useState({summary:{},vendors:[],plans:[],overdue:[],awaitingHandover:[]});
 const [ref,setRef]=useState({});
 const [busy,setBusy]=useState("");
 const [query,setQuery]=useState("");
 const [vendorReturns,setVendorReturns]=useState({summary:{},vendors:[],pending:[],history:[]});
 const [receiptForm,setReceiptForm]=useState({challanId:"",lineKey:"",reference:"",goodPcs:"",reworkPcs:"",rejectedPcs:""});
 const [receiptKey,setReceiptKey]=useState(()=>crypto.randomUUID().replaceAll("-","")+"-vendor");
 const refresh=async()=>{
  try{setData(await deliveryApi.monitoring())}catch(e){notify?.(e.message)}
  try{setVendorReturns(await deliveryApi.vendorReturnMonitoring())}catch(e){notify?.(e.message)}
 };
 useEffect(()=>{refresh()},[]);
 const vendorRows=useMemo(()=>(data.vendors||[]).filter(x=>[x.vendorCode,x.vendorName].join(" ").toLowerCase().includes(query.toLowerCase())),[data.vendors,query]);
 const planRows=(data.plans||[]).map(p=>[
   p.planNo,p.dcNo,p.itemName,p.cuttingStatus,p.foldingStatus,p.elasticStatus,
   n(p.actualPcs),n(p.issuedPcs),n(p.unallocatedPcs),p.eligible?"READY":"PENDING"]);
 const vendorCells=vendorRows.map(x=>[x.vendorCode,x.vendorName,n(x.challans),n(x.issuedPcs),
   n(x.handedOverPcs),n(x.pendingHandoverPcs),n(x.overduePcs)]);
 const stitchingRows=(vendorReturns.vendors||[]).filter(v=>[v.vendorCode,v.vendorName].join(" ").toLowerCase().includes(query.toLowerCase()))
  .map(v=>[v.vendorCode,v.vendorName,n(v.sentToVendorPcs),n(v.returnedPcs),n(v.goodPcs),
   n(v.reworkPcs),n(v.rejectedPcs),n(v.pendingStitchingPcs)]);
 const dcRows=(data.awaitingHandover||[]).map(x=>[x.challanNo,x.vendorCode,x.planNo,n(x.totalPcs),
   x.deliveryDate?new Date(x.deliveryDate).toLocaleDateString():"",x.expectedHandoverAt?new Date(x.expectedHandoverAt).toLocaleDateString():""]);
 const overdueRows=(data.overdue||[]).map(x=>[x.challanNo,x.vendorCode,x.planNo,n(x.totalPcs),
   new Date(x.expectedHandoverAt).toLocaleDateString()]);
 const visible=mode==="completion"||mode==="balance"?planRows:
   mode==="vendors"?vendorCells:mode==="pending"?stitchingRows:
   mode==="delays"?overdueRows:dcRows;
 const exporting=()=>exportCsv("delivery-"+mode+".csv",visible.map(row=>Object.fromEntries(row.map((v,i)=>[String(i+1),v]))));
 async function handover(row){
   const reference=String(ref[row.id]||"").trim();
   if(!reference){notify?.("Enter vendor handover reference");return}
   setBusy(row.id);
   try {
     await deliveryApi.handover(row.id,{reference});
     notify?.("Vendor handover confirmed: "+row.challanNo);
     setRef(x=>({...x,[row.id]:""}));
     await refresh();
   }catch(err){notify?.(err.message)}finally{setBusy("")}
 }
 const summary=data.summary||{};
 const chosenDc=(vendorReturns.pending||[]).find(x=>x.id===receiptForm.challanId);
 async function recordVendorReturn(e){
  e.preventDefault();
  const [colour,size]=(receiptForm.lineKey||"").split("|");
  if(!chosenDc||!colour||!size){notify?.("Select handed-over DC and a pending colour/size");return}
  setBusy("receipt");
  try{
   await deliveryApi.saveVendorReturn({challanId:receiptForm.challanId,reference:receiptForm.reference,
    lines:[{colour,size,goodPcs:Number(receiptForm.goodPcs||0),
      reworkPcs:Number(receiptForm.reworkPcs||0),rejectedPcs:Number(receiptForm.rejectedPcs||0)}]},receiptKey);
   setReceiptKey(crypto.randomUUID().replaceAll("-","")+"-vendor");
   setReceiptForm({challanId:"",lineKey:"",reference:"",goodPcs:"",reworkPcs:"",rejectedPcs:""});
   notify?.("Vendor return recorded. Inward/warehouse stock is unchanged.");
   await refresh();
  }catch(err){notify?.(err.message)}finally{setBusy("")}
 }

 return <section className="classic-page">
  <header className="classic-title">
   <div><small>DELIVERY DEPARTMENT · {readonly?"HEAD / READ ONLY":"STAFF"}</small>
    <h2>{labels[mode]||labels.overview}</h2>
    <p>Cutting and Folding must finish before DC issuance. Elastic remains optional. Issued and vendor handover PCS are shown separately.</p>
   </div><div className="page-actions">
    <button type="button" onClick={refresh}><RefreshCw size={16}/> Refresh</button>
    <button type="button" onClick={exporting} disabled={!visible.length}><Download size={16}/> Excel</button>
    <button type="button" onClick={()=>window.print()}><Printer size={16}/> Print</button>
   </div>
  </header>
  {(data.partialResults||vendorReturns.partialResults)&&<p className="error-text">Large-data monitoring limits reached: shown totals may be incomplete. Use filtered history before making stock decisions.</p>}
  {["overview","balance","reports"].includes(mode)&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:12}}>
   {Object.entries({"Cutting Plans":summary.plans,"Unallocated PCS":summary.unallocatedPcs,
    "DC Issued PCS":summary.issuedPcs,"Handed Over PCS":summary.handedOverPcs,
    "Pending Handover PCS":summary.pendingHandoverPcs,"Delayed PCS":summary.overduePcs})
    .map(([label,value])=><div className="classic-card" key={label}><small>{label}</small>
     <h3>{n(value)}</h3></div>)}
  </div>}
  {["completion","overview","balance","reports"].includes(mode)&&<div className="classic-card">
   <h3>Cutting → Folding → Delivery Plan Status</h3>
   <Table labels={["Plan","DC","Item","Cutting","Folding","Elastic","Actual PCS","DC Issued","Not Yet Allocated","Ready"]}
    rows={planRows}/>
  </div>}
  {["vendors","pending","overview","reports"].includes(mode)&&<div className="classic-card">
   <h3>Vendor-wise Issued / Handover / Pending</h3>
   <label>Search Vendor <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Vendor code or name"/></label>
   <Table labels={["Vendor Code","Vendor","DC Count","Issued PCS","Handed Over PCS","Pending Handover","Overdue PCS"]}
    rows={vendorCells}/>
  </div>}
  {["challans","handover","overview","reports"].includes(mode)&&<div className="classic-card">
   <h3>Awaiting Vendor Handover</h3>
   <Table labels={["Challan","Vendor","Plan","PCS","Delivery Date","Expected Handover"]} rows={dcRows}/>
   {mode==="handover"&&readonly&&<p>Delivery Head has read-only access. Staff can confirm handovers.</p>}
   {mode==="handover"&&!readonly&&(data.awaitingHandover||[]).map(row=>
    <form key={row.id} onSubmit={e=>{e.preventDefault();handover(row)}} style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"end",marginTop:10}}>
     <strong>{row.challanNo} · {row.vendorCode} · {n(row.totalPcs)} PCS</strong>
     <label>Handover Reference
      <input required maxLength={80} value={ref[row.id]||""}
       onChange={e=>setRef(x=>({...x,[row.id]:e.target.value.toUpperCase()}))} placeholder="POD / Signature Reference"/>
     </label>
     <button disabled={Boolean(busy)} type="submit"><Save size={16}/> {busy===row.id?"Saving…":"Confirm Handover"}</button>
    </form>
   )}
  </div>}
  {mode==="pending"&&<div className="classic-card">
   <h3>Stitching Vendor Pending & Returned Pieces</h3>
   <p>Pending Stitching = handed-over PCS minus vendor-return acknowledged PCS. This is separate from DC handover pending. No ERP stock is credited here.</p>
   <Table labels={["Vendor Code","Vendor","Sent to Vendor PCS","Returned PCS","Good PCS","Rework PCS","Rejected PCS","Pending Stitching PCS"]} rows={stitchingRows}/>
   {!readonly&&<form className="form-grid" onSubmit={recordVendorReturn}>
    <label>Physically Handed-over DC
     <select required value={receiptForm.challanId} onChange={e=>setReceiptForm(x=>({...x,challanId:e.target.value,lineKey:""}))}>
      <option value="">Select a DC</option>
      {(vendorReturns.pending||[]).map(dc=><option key={dc.id} value={dc.id}>{dc.challanNo} · {dc.vendorCode}</option>)}
     </select>
    </label>
    <label>Colour / Size
     <select required value={receiptForm.lineKey} onChange={e=>setReceiptForm(x=>({...x,lineKey:e.target.value}))}>
      <option value="">Choose pending line</option>
      {(chosenDc?.lines||[]).map(x=><option key={x.colour+"|"+x.size} value={x.colour+"|"+x.size}>
       {x.colour} / {x.size} · {n(x.remainingPcs)} PCS pending
      </option>)}
     </select>
    </label>
    <label>Vendor Return Reference
     <input required maxLength={80} value={receiptForm.reference} placeholder="Vendor signed receipt / return reference"
      onChange={e=>setReceiptForm(x=>({...x,reference:e.target.value.toUpperCase()}))}/>
    </label>
    {["goodPcs","reworkPcs","rejectedPcs"].map((field,i)=><label key={field}>{["Good PCS","Rework PCS","Rejected PCS"][i]}
     <input type="number" min="0" step="1" value={receiptForm[field]}
      onChange={e=>setReceiptForm(x=>({...x,[field]:e.target.value}))}/>
    </label>)}
    <button type="submit" className="primary" disabled={Boolean(busy)}>
     <Save size={16}/>{busy==="receipt"?"Saving…":"Record Vendor Stitched Return"}
    </button>
   </form>}
   {readonly&&<p>Department Head view only; Staff must record vendor acknowledgements.</p>}
   <h3>Recent Vendor Return Register</h3>
   <Table labels={["Receipt","Challan","Vendor","Return Reference","PCS","Date"]}
    rows={(vendorReturns.history||[]).map(r=>[r.receiptNo,r.challanNo,r.vendorCode,r.reference,n(r.totalPcs),
     r.createdAt?new Date(r.createdAt).toLocaleDateString():""])}/>
  </div>}
  {["delays","overview","reports"].includes(mode)&&<div className="classic-card">
   <h3>Overdue Delivery Challans</h3>
   <Table labels={["Challan","Vendor","Plan","PCS","Expected Handover"]} rows={overdueRows}
     empty="No DCs past their expected handover date. Dates are optional until entered at DC creation."/>
  </div>}
 </section>;
}
