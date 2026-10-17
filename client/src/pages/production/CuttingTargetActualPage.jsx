import {useEffect,useMemo,useState} from "react";
import {Download,Printer,RefreshCw} from "lucide-react";
import {exportCsv} from "../../api.js";
import {getCuttingTargetActual} from "../../api/productionApi.js";

export default function CuttingTargetActualPage({notify}) {
  const [payload,setPayload]=useState({items:[],summary:{}});
  const [planNo,setPlanNo]=useState("");
  const [loading,setLoading]=useState(false);
  async function load(filter="") {
    setLoading(true);
    try {setPayload(await getCuttingTargetActual(filter));}
    catch(error){notify?.(error.message);}
    finally{setLoading(false);}
  }
  useEffect(()=>{load();},[]);
  const rows=useMemo(()=>payload.items||[],[payload.items]);
  const summary=payload.summary||{};
  const fields=[
    ["Plans",summary.plans||0],
    ["Target pieces",summary.targetPcs||0],
    ["Actual pieces",summary.actualPcs||0],
    ["Pending pieces",summary.pendingPcs||0],
    ["Waste (KG)",summary.wasteWeightKg||0],
  ];
  const exportRows=rows.map(x=>({
    Plan:x.planNo,DC:x.dcNo,Item:x.itemName,Status:x.actualStatus,
    TargetPCS:x.targetPcs,ActualPCS:x.actualPcs,PendingPCS:x.pendingPcs,
    CompletionPercent:x.completionPercent,TargetKG:x.targetWeightKg,
    ActualKG:x.actualWeightKg,WasteKG:x.wasteWeightKg,
    Spreader:x.spreaderStatus.join(", "),Cutter:x.cutterStatus.join(", "),
  }));
  return <section className="classic-page">
    <header className="classic-title">
      <div><small>CUTTING DEPARTMENT · HEAD OVERVIEW</small><h2>Target vs Actual</h2>
      <p>Plan-wise Cutting PCS, actual pieces, pending pieces, fabric usage and machine progress.</p></div>
      <div className="page-actions">
        <button type="button" onClick={()=>load(planNo)} disabled={loading}><RefreshCw size={16}/> Refresh</button>
        <button type="button" onClick={()=>exportCsv("cutting-target-vs-actual.csv",exportRows)} disabled={!rows.length}><Download size={16}/> Excel</button>
        <button type="button" onClick={()=>window.print()}><Printer size={16}/> Print</button>
      </div>
    </header>
    <div className="classic-card">
      <form onSubmit={e=>{e.preventDefault();load(planNo);}} style={{display:"flex",gap:12,alignItems:"end",flexWrap:"wrap"}}>
        <label style={{flex:"1 1 230px"}}>Plan No (optional)
          <input value={planNo} maxLength={100} onChange={e=>setPlanNo(e.target.value)} placeholder="Leave empty for latest plans"/>
        </label>
        <button type="submit" disabled={loading}>{loading?"Loading…":"Filter"}</button>
        <button type="button" onClick={()=>{setPlanNo("");load("");}}>Clear</button>
      </form>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
      {fields.map(([name,value])=><div className="classic-card" key={name}>
        <small>{name}</small><h3 style={{margin:"8px 0"}}>{value}</h3>
      </div>)}
    </div>
    <div className="classic-card" style={{overflowX:"auto"}}>
      <table className="classic-table" style={{width:"100%",minWidth:1050}}>
        <thead><tr>
          <th>Plan / DC</th><th>Item</th><th>Target PCS</th><th>Actual PCS</th><th>Pending PCS</th>
          <th>Complete</th><th>Target KG</th><th>Actual KG</th><th>Waste KG</th>
          <th>Spreader</th><th>Cutter</th><th>Status</th>
        </tr></thead>
        <tbody>{rows.map(r=><tr key={r.planNo}>
          <td><strong>{r.planNo}</strong><div>{r.dcNo}</div></td><td>{r.itemName||r.itemCode||"—"}</td>
          <td>{r.targetPcs}</td><td>{r.actualPcs}</td><td>{r.pendingPcs}</td>
          <td>{r.completionPercent}%</td><td>{r.targetWeightKg}</td><td>{r.actualWeightKg}</td>
          <td>{r.wasteWeightKg}</td><td>{r.spreaderStatus.join(", ")||"—"}</td>
          <td>{r.cutterStatus.join(", ")||"—"}</td><td>{r.actualStatus}</td>
        </tr>)}</tbody>
      </table>
      {!rows.length&&<p>{loading?"Loading Cutting plans…":"No matching Cutting plans. Create a Production Plan and enter Cutting Actual to see results."}</p>}
      {rows.length>=250&&<small>Showing latest 250 plans. Filter by Plan No to narrow results.</small>}
    </div>
  </section>;
}
