import {useEffect,useMemo,useState} from "react";
import {RefreshCcw,Search,PackageCheck,ClipboardList,Clock3} from "lucide-react";
import {fabricCuttingApi} from "../../api/fabricCuttingApi.js";

const fmt=number=>Number(number||0).toLocaleString("en-IN",{maximumFractionDigits:3});
const blank={planNo:"",dcNo:"",from:"",to:"",status:""};
const dateLabel=value=>value?new Date(value).toLocaleDateString("en-IN"):"—";

export default function FabricPlanMonitorPage({mode="plans"}){
 const [filters,setFilters]=useState(blank),[rows,setRows]=useState([]),[loading,setLoading]=useState(false);
 const [error,setError]=useState(""),[selected,setSelected]=useState("");
 const issueMode=mode==="issues";
 async function load(event){
  event?.preventDefault();
  setLoading(true);setError("");
  try{
   const result=await fabricCuttingApi.fabricPlanMonitor(filters);
   setRows(Array.isArray(result.items)?result.items:[]);
  }catch(e){setRows([]);setError(e.message||"Unable to fetch Fabric plan monitoring data");}
  finally{setLoading(false)}
 }
 useEffect(()=>{load()},[]);
 const totals=useMemo(()=>({
  plans:rows.length,
  wanted:rows.reduce((n,r)=>n+Number(r.totalWantedWeightKg||0),0),
  issued:rows.reduce((n,r)=>n+Number(r.issuedWeightKg||0),0)
 }),[rows]);
 return <section className="fabric-plan-monitor">
  <header className="fabric-plan-monitor-heading">
   <div><small>FABRIC DEPARTMENT · READ-ONLY LIVE MONITORING</small>
    <h2>{issueMode?"Issue to Cutting Monitoring":"Fabric Production Plan Overview"}</h2>
    <p>Track registered cutting plans, issued fabric weight and pending issue quantities. This screen does not post inventory movements.</p>
   </div>
   <button type="button" onClick={()=>load()} disabled={loading}><RefreshCcw size={16} aria-hidden="true"/> Refresh</button>
  </header>
  <form className="erp-card fabric-plan-monitor-filters" onSubmit={load}>
   <label>Plan No<input value={filters.planNo} onChange={e=>setFilters({...filters,planNo:e.target.value})} placeholder="Plan No"/></label>
   <label>DC No<input value={filters.dcNo} onChange={e=>setFilters({...filters,dcNo:e.target.value})} placeholder="DC No"/></label>
   <label>From<input type="date" value={filters.from} onChange={e=>setFilters({...filters,from:e.target.value})}/></label>
   <label>To<input type="date" value={filters.to} onChange={e=>setFilters({...filters,to:e.target.value})}/></label>
   <label>Status<select value={filters.status} onChange={e=>setFilters({...filters,status:e.target.value})}>
    <option value="">All statuses</option>
    {["PLANNED","PART_ISSUED","READY","RUNNING","PARTIAL","COMPLETED","HOLD"].map(status=><option value={status} key={status}>{status.replaceAll("_"," ")}</option>)}
   </select></label>
   <button type="submit" disabled={loading}><Search size={16} aria-hidden="true"/> Apply</button>
  </form>
  <div className="fabric-plan-monitor-kpis" aria-label="Current search plan totals">
   <article className="erp-card"><ClipboardList aria-hidden="true"/><span>Plans</span><strong>{fmt(totals.plans)}</strong></article>
   <article className="erp-card"><Clock3 aria-hidden="true"/><span>Wanted KG</span><strong>{fmt(totals.wanted)}</strong></article>
   <article className="erp-card"><PackageCheck aria-hidden="true"/><span>Issued KG</span><strong>{fmt(totals.issued)}</strong></article>
   <article className="erp-card"><span>Pending KG</span><strong>{fmt(Math.max(0,totals.wanted-totals.issued))}</strong></article>
  </div>
  {error&&<p role="alert" className="erp-error">{error}</p>}
  {loading&&<p role="status">Loading production plans…</p>}
  <div className="erp-card">
   <div className="erp-table fabric-plan-monitor-table"><table>
    <thead><tr><th>Date</th><th>Plan / DC</th><th>Order / Item</th><th>PCS</th><th>Wanted KG</th><th>Issued KG</th><th>Pending KG</th><th>Status</th><th>Issue Detail</th></tr></thead>
    <tbody>{rows.map(row=><tr key={row._id}>
     <td>{dateLabel(row.createdAt)}</td>
     <td><strong>{row.planNo}</strong><small>{row.dcNo}</small></td>
     <td>{row.orderNo}<small>{row.itemCode} · {row.itemName}</small></td>
     <td>{fmt(row.totalPlannedPcs)}</td><td>{fmt(row.totalWantedWeightKg)}</td>
     <td>{fmt(row.issuedWeightKg)}</td>
     <td>{fmt(Math.max(0,Number(row.totalWantedWeightKg||0)-Number(row.issuedWeightKg||0)))}</td>
     <td>{String(row.status||"PLANNED").replaceAll("_"," ")}</td>
     <td><button type="button" aria-expanded={selected===row._id} onClick={()=>setSelected(selected===row._id?"":row._id)}>{selected===row._id?"Hide":"View"}</button>
      {selected===row._id&&<div className="fabric-plan-issue-details">
       {(row.allocations||[]).length===0?<small>No fabric issued yet</small>:
        (row.allocations||[]).map((a,i)=><p key={a._id||i}>
         <strong>{a.inwardNo}</strong> · {a.colour} · {fmt(a.weightKg)} KG
         <small>{a.issuedBy||"—"} · {dateLabel(a.issuedAt)}</small>
        </p>)}
      </div>}
     </td>
    </tr>)}</tbody>
   </table></div>
   {!loading&&!error&&rows.length===0&&<p>No plans found for these filters.</p>}
   <small>Showing up to 250 latest plans from the selected company. Multi-factory legacy records require factory-scoped migration before this view can be enabled.</small>
  </div>
 </section>;
}
