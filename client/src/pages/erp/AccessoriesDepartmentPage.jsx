import {useEffect,useMemo,useState} from "react";
import {Download,Printer,RefreshCw,Save} from "lucide-react";
import {useAuth} from "../../context/AuthContext.jsx";
import {accessoriesApi} from "../../api/accessoriesApi.js";
import {exportCsv} from "../../api.js";

const modes={
  overview:"Accessories Overview",availability:"Stock Availability",
  requirement:"Accessories Requirement",purchaseStatus:"Accessories Purchase Status",
  beforeStatus:"Before-Sewing Issue Status",afterStatus:"After-Sewing Issue Status",
  shortage:"Shortage & Consumption",reports:"Accessories Reports",
  master:"Accessories Master",purchase:"Purchase / Inward Entry",
  stock:"Accessories Stock",before:"Before-Sewing Issue",after:"After-Sewing Issue",
  return:"Accessories Return",transfer:"Accessories Transfer",
  adjustment:"Shortage / Adjustment Request",history:"Issue History",
};
const initial={code:"",name:"",kind:"CONSUMABLE",unit:"PCS",minimumQty:"0",
  partyCode:"",sku:"",quantity:"",rate:"0",purchaseOrderId:"",
  workOrderId:"",reference:"",stage:"BEFORE_SEWING",countedQty:"",reason:"",remarks:""};
function DataGrid({headers,rows,empty="No matching records yet."}) {
  return <div style={{overflowX:"auto"}}><table className="classic-table" style={{minWidth:700,width:"100%"}}>
    <thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead>
    <tbody>{rows.length?rows.map((cells,i)=><tr key={i}>{cells.map((cell,j)=><td key={j}>{cell??"—"}</td>)}</tr>):
      <tr><td colSpan={headers.length}>{empty}</td></tr>}</tbody>
  </table></div>;
}
const n=value=>Number(value||0).toLocaleString("en-IN",{maximumFractionDigits:3});
export default function AccessoriesDepartmentPage({mode="overview",notify}){
  const {user}=useAuth();
  const readonly=user?.role==="department_incharge";
  const [data,setData]=useState({stock:[],requirements:[],purchases:[],workOrders:[],suppliers:[],history:[],adjustments:[],summary:{}});
  const [form,setForm]=useState(initial);
  const [busy,setBusy]=useState(false),[search,setSearch]=useState("");
  const [subMode,setSubMode]=useState(mode==="purchase"?"purchase":"return");
  const title=modes[mode]||modes.overview;
  const load=async()=>{
    try{setData(await accessoriesApi.overview());}
    catch(e){notify?.(e.message);}
  };
  useEffect(()=>{load()},[]);
  const stock=useMemo(()=>(data.stock||[]).filter(r=>`${r.code} ${r.name}`.toLowerCase().includes(search.toLowerCase())),[data.stock,search]);
  const stockRows=stock.map(r=>[r.code,r.name,r.kind,r.unit,n(r.available),n(r.minimumQty),n(r.shortage),
    r.lowStock?"LOW STOCK":"Available"]);
  const history=(data.history||[]).filter(r=>mode==="beforeStatus"?r.stage==="BEFORE_SEWING":mode==="afterStatus"?r.stage==="AFTER_SEWING":true);
  const historyRows=history.map(r=>[r.number,r.type,r.stage?.replaceAll("_"," ")||"Transfer",r.reference,
    r.sku,n(r.quantity),r.postedAt?new Date(r.postedAt).toLocaleDateString():"",r.reversed?"Reversed":"Posted"]);
  const purchaseRows=(data.purchases||[]).flatMap(p=>p.lines.map(l=>
    [p.number,p.partyCode,l.sku,n(l.ordered),n(l.received),n(l.pending),p.cancelled?"Cancelled":"Open"]));
  const adjustmentRows=(data.adjustments||[]).map(r=>[r.sku,n(r.expectedQty),n(r.countedQty),n(r.varianceQty),
    r.reason,r.status,r.createdAt?new Date(r.createdAt).toLocaleDateString():""]);
  const filteredPurchase=(data.purchases||[]).filter(p=>p.lines.some(l=>l.pending>0));
  const showStock=["overview","stock","availability","shortage","requirement","reports"].includes(mode);
  const showPurchases=["overview","requirement","purchaseStatus","purchase","reports"].includes(mode);
  const showHistory=["overview","beforeStatus","afterStatus","history","shortage","reports"].includes(mode);
  const showRequests=["shortage","adjustment","reports"].includes(mode);
  const isForm=["master","purchase","before","after","return","transfer","adjustment"].includes(mode);
  const field=(label,key,extra={})=><label key={key}>{label}
    <input value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}
      required={extra.required!==false} maxLength={extra.maxLength||120}
      type={extra.numeric?"number":"text"} step={extra.numeric?"0.001":undefined}
      min={extra.numeric?"0":undefined} placeholder={extra.placeholder||""}/>
  </label>;
  const select=(label,key,options)=><label key={key}>{label}
    <select value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} required>
      <option value="">Select…</option>
      {options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
    </select></label>;
  const products=(data.stock||[]).filter(r=>r.active).map(r=>({value:r.code,label:`${r.code} – ${r.name} (${n(r.available)} ${r.unit})`}));
  const orders=(data.workOrders||[]).map(w=>({value:w.id,label:`${w.number} · ${w.sku}`}));
  const vendors=(data.suppliers||[]).map(v=>({value:v.code,label:`${v.code} – ${v.name}`}));
  const pos=filteredPurchase.map(p=>({value:p.id,label:`${p.number} – ${p.partyCode}`}));
  const purchaseForm=mode==="purchase";
  const issueForm=["before","after"].includes(mode)||(mode==="return"&&subMode==="return");
  const transferForm=mode==="transfer"||(mode==="return"&&subMode==="transfer");
  const adjustForm=mode==="adjustment";
  async function submit(e){
    e.preventDefault();if(readonly||busy)return;
    setBusy(true);
    try{
      let save;
      if(mode==="master")save=()=>accessoriesApi.master(form);
      else if(purchaseForm)save=subMode==="receipt"
        ?()=>accessoriesApi.receipt({...form,purchaseOrderId:form.purchaseOrderId})
        :()=>accessoriesApi.purchase(form);
      else if(issueForm) {
        const stage=mode==="before"?"BEFORE_SEWING":mode==="after"?"AFTER_SEWING":form.stage;
        save=()=>mode==="return"?accessoriesApi.returnStock({...form,stage}):accessoriesApi.issue({...form,stage});
      }else if(transferForm)save=()=>accessoriesApi.transfer(form);
      else if(adjustForm)save=()=>accessoriesApi.adjustment(form);
      if(!save)return;
      const result=await save();
      notify?.(`Saved ${result?.number||result?.code||result?.status||""}. ${mode==="adjustment"?"Approval pending; stock unchanged.":""}`);
      setForm(initial);await load();
    }catch(err){notify?.(err.message);}finally{setBusy(false);}
  }
  const exportRows=mode==="purchaseStatus"?purchaseRows:mode==="beforeStatus"||mode==="afterStatus"||mode==="history"?historyRows:
    mode==="adjustment"?adjustmentRows:stockRows;
  return <section className="classic-page">
    <div className="classic-title"><div><small>ACCESSORIES DEPARTMENT · {readonly?"HEAD / READ ONLY":"STAFF"}</small>
      <h2>{title}</h2><p>Live ERP stock and posting records. All issue and return quantities are checked by the ERP ledger.</p></div>
      <div className="page-actions">
        <button type="button" onClick={load} disabled={busy}><RefreshCw size={16}/> Refresh</button>
        <button type="button" disabled={!exportRows.length} onClick={()=>exportCsv("accessories-"+mode+".csv",
          exportRows.map(row=>Object.fromEntries(row.map((v,i)=>[String(i+1),v]))))}><Download size={16}/> Excel</button>
        <button type="button" onClick={()=>window.print()}><Printer size={16}/> Print</button>
      </div></div>
    {mode==="overview"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(165px,1fr))",gap:12}}>
      {Object.entries({Items:data.summary?.itemCount||0,"Low Stock":data.summary?.lowStockItems||0,
        "PO Lines Pending":data.summary?.pendingPoLines||0,
        "Before Sewing Issues":data.summary?.beforeSewingIssues||0,
        "After Sewing Issues":data.summary?.afterSewingIssues||0,
        "Adjustment Requests":data.summary?.adjustmentRequests||0,
        "BOM Pending Qty":data.summary?.pendingDemandQty||0}).map(([name,count])=>
        <div className="classic-card" key={name}><small>{name}</small><h3>{count}</h3></div>)}
    </div>}
    {isForm&&readonly&&<div className="classic-card">Department Head access is read-only. Staff submit operational entries.</div>}
    {isForm&&!readonly&&<form className="classic-card" onSubmit={submit}>
      <h3>{mode==="master"?"Register Accessories SKU":mode==="adjustment"?"Request Stock Correction":title}</h3>
      {mode==="return"&&<label>Action
        <select value={subMode} onChange={e=>{setSubMode(e.target.value);setForm(initial)}}>
          <option value="return">Return from Work Order</option><option value="transfer">Transfer to Delivery</option>
        </select></label>}
      {purchaseForm&&<label>Entry Type
        <select value={subMode} onChange={e=>{setSubMode(e.target.value);setForm(initial)}}>
          <option value="purchase">Purchase Order</option><option value="receipt">Goods Receipt against PO</option>
        </select></label>}
      <div className="form-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
        {mode==="master"&&<>
          {field("SKU Code","code")}{field("Accessory Name","name")}
          {select("Type","kind",[{value:"CONSUMABLE",label:"Consumable"},{value:"RAW",label:"Raw Material"}])}
          {field("Unit (PCS / KG / MTR)","unit")}{field("Minimum Quantity","minimumQty",{numeric:true})}
        </>}
        {purchaseForm&&(subMode==="receipt"?select("Purchase Order","purchaseOrderId",pos):select("Supplier","partyCode",vendors))}
        {(purchaseForm||issueForm||transferForm||adjustForm)&&select("Accessories SKU","sku",
          purchaseForm&&subMode==="receipt"?(data.purchases||[]).find(p=>p.id===form.purchaseOrderId)?.lines.map(l=>({value:l.sku,label:l.sku}))||[]:products)}
        {issueForm&&select("Work Order","workOrderId",orders)}
        {mode==="return"&&select("Issue Stage","stage",[
          {value:"BEFORE_SEWING",label:"Before Sewing"},{value:"AFTER_SEWING",label:"After Sewing"}])}
        {(purchaseForm||issueForm||transferForm)&&field("Quantity","quantity",{numeric:true})}
        {purchaseForm&&subMode==="purchase"&&field("Rate per Unit (₹)","rate",{numeric:true})}
        {(issueForm||transferForm)&&field("Issue / Return / Transfer Reference","reference")}
        {adjustForm&&<>{field("Physical Count","countedQty",{numeric:true})}{field("Reason for Adjustment","reason")}</>}
        {issueForm&&field("Remarks","remarks",{required:false})}
      </div>
      {mode==="adjustment"&&<p>Approval request only. This action does not change stock quantity.</p>}
      {issueForm&&<p>Choose the correct sewing stage. Work Order BOM quantity and current stock are enforced. Sewing completion confirmation requires final production integration QA.</p>}
      <div className="page-actions"><button type="submit" disabled={busy}><Save size={16}/> {busy?"Saving…":"Submit"}</button></div>
    </form>}
    {showStock&&<div className="classic-card">
      <h3>Accessories Stock & Availability</h3>
      <label>Search SKU <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Code or name"/></label>
      <DataGrid headers={["Code","Name","Type","Unit","Available","Minimum","Shortage","Status"]} rows={stockRows}/>
    </div>}
    {showPurchases&&<div className="classic-card">
      <h3>Purchase Orders & Goods Receipt Status</h3>
      <DataGrid headers={["Purchase No","Supplier","SKU","Ordered","Received","Pending","Status"]} rows={purchaseRows}/>
    </div>}
    {["requirement","overview","shortage","reports"].includes(mode)&&<div className="classic-card">
      <h3>Accessories Requirement – Work Order BOM</h3>
      <DataGrid headers={["Work Order","Accessories SKU","Required Qty","Issued Qty","Pending Qty","Available Qty","Order Shortage"]}
        rows={(data.requirements||[]).map(r=>[r.workOrderNo,r.sku,n(r.requiredQty),n(r.issuedQty),
          n(r.pendingQty),n(r.availableQty),n(r.shortageQty)])}
        empty="No approved Work Order BOM requires an Accessories SKU yet."/>
      <p>Work Order demand is calculated from posted BOM and material issue/return documents. Stock shown is shared across plans, not reserved per order.</p>
    </div>}
    {["requirement","overview"].includes(mode)&&<div className="classic-card">
      <h3>Posted Work Orders</h3>
      <DataGrid headers={["Work Order","Output SKU","Date"]} rows={(data.workOrders||[]).map(w=>[
        w.number,w.sku,w.postedAt?new Date(w.postedAt).toLocaleDateString():""
      ])}/>
      <p>Use the above BOM table for required, issued, pending and available quantities.</p>
    </div>}
    {showHistory&&<div className="classic-card">
      <h3>Accessories Issue / Return / Transfer History</h3>
      <DataGrid headers={["Document No","Movement","Stage","Reference","SKU","Quantity","Date","Status"]} rows={historyRows}/>
    </div>}
    {showRequests&&<div className="classic-card">
      <h3>Stock Adjustment Requests</h3>
      <DataGrid headers={["SKU","ERP Qty","Counted Qty","Variance","Reason","Status","Created"]} rows={adjustmentRows}/>
    </div>}
    {mode==="purchaseStatus"&&<p>Purchase order lifecycle is managed using the ERP purchase ledger. No duplicate stock entry is created.</p>}
  </section>;
}
