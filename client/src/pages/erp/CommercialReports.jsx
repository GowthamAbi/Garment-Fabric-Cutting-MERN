import { useEffect, useState } from "react";
import { api } from "../../api.js";
const amount=n=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(Number(n||0)/100);
const q=n=>Number(n||0)/1000;
function Table({head,rows}){return <div className="erp-table"><table><thead><tr>{head.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div>;}
export default function CommercialReports(){
  const [data,setData]=useState(null),[error,setError]=useState("");
  const load=()=>api("/erp/commercial").then(setData).catch(e=>setError(e.message));useEffect(()=>{load();},[]);
  return <section className="erp-card"><h2>Ageing, work-order costing & vendor pending</h2><button onClick={load}>Refresh commercial reports</button>{error&&<p className="erp-error">{error}</p>}{data&&<>
    <p>{data.note}</p><h3>Receivables / payables ageing</h3><Table head={["Invoice","Party","Type","Due date","Outstanding","Overdue days","Bucket"]} rows={data.ageing.map(r=>[r.number,r.party,r.kind,new Date(r.dueDate).toLocaleDateString("en-IN"),amount(r.outstanding),r.overdueDays,r.bucket])}/>
    <h3>Work-order cost</h3><Table head={["Work order","SKU","Planned / Completed","Materials","Work costs","Total input cost","Allocated output cost","Remaining WIP","Avg output cost"]} rows={data.workOrders.map(r=>[r.number,r.sku,`${q(r.planned)} / ${q(r.completed)}`,amount(r.materials),amount(r.workCosts),amount(r.total),amount(r.allocated),amount(r.remainingWipCost),amount(r.averageUnitCost)])}/>
    <h3>Sales-order margin indicator</h3><Table head={["Order","Customer","Net sales","Dispatched COGS","Gross margin","Invoices / Dispatches"]} rows={(data.salesOrders||[]).map(r=>[r.number,r.party,amount(r.sales),amount(r.cogs),amount(r.grossMargin),`${r.invoiceCount} / ${r.dispatchCount}`])}/>
    <h3>Vendor jobwork pending</h3><Table head={["Issue","Vendor","SKU","Unit","Sent","Returned","Pending"]} rows={data.jobwork.map(r=>[r.number,r.vendor,r.sku,r.unit,q(r.sent),q(r.returned),q(r.pending)])}/>
  </>}</section>;
}
