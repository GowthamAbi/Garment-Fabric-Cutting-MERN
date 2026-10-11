import {useState} from 'react';
import {api} from '../../api.js';
function Table({head,rows}){return <div className="erp-table"><table><thead><tr>{head.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div>;}
export default function ManagementDashboard(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <details><summary>Management WIP, output, aging and targets</summary>{error&&<p className="erp-error">{error}</p>}
 <form className="erp-grid" onSubmit={async e=>{e.preventDefault();const params=new URLSearchParams(new FormData(e.currentTarget));setBusy(true);setError('');try{setData(await api('/erp/departments/management?'+params));}catch(e){setError(e.message);}finally{setBusy(false);}}}>
 <label>Output window days<input name="days" type="number" min="1" max="90" defaultValue="7" required/></label><label>Overdue stage age days<input name="overdueDays" type="number" min="1" max="365" defaultValue="7" required/></label><button disabled={busy}>Load management report</button></form>
 {data&&<><h4>Current WIP</h4><Table head={['Item','Colour','Size','Section','Operation / stage','Pieces']} rows={data.wip.map(r=>[r.item,r.colour,r.size,r.section,r.operation,r.pieces])}/>
 <h4>Operator / shift output and targets</h4><Table head={['UTC date','SKU','Operation','Operator','Shift','Target','Actual','Variance','Achievement %']} rows={data.output.map(r=>[r.date,r.sku,r.operation,r.operator,r.shift,r.target,r.actual,r.variance,r.achievement??'—'])}/>
 <h4>Overdue current bundles</h4><Table head={['Bundle','SKU','Section','Stage','Pieces','Stage age days']} rows={data.aging.map(r=>[r.bundle,r.sku,r.section,r.stage,r.pieces,r.stageAgeDays])}/>
 <h4>Inspection outcomes</h4><p>{data.checking.note}</p><Table head={['Outcome','Pieces inspected','% of attempts']} rows={['good','rework','oil','reject'].map(k=>[k,data.checking[k],data.checking.percentages[k]])}/></>}
 <h4>Set stitching daily target</h4><form className="erp-grid" onChange={e=>{delete e.currentTarget.dataset.key;}} onSubmit={async e=>{e.preventDefault();const form=e.currentTarget,payload={...Object.fromEntries(new FormData(form)),key:form.dataset.key||(form.dataset.key=crypto.randomUUID())};setBusy(true);setError('');try{await api('/erp/departments/targets',{method:'POST',body:JSON.stringify(payload)});delete form.dataset.key;form.reset();setData(null);}catch(e){setError(e.message);}finally{setBusy(false);}}}>
 <label>Date<input name="date" type="date" required/></label>{['sku','operation','operator','shift'].map(k=><label key={k}>{k}<input name={k} required/></label>)}<label>Target pieces<input name="quantity" type="number" min="1" step="1" required/></label><button disabled={busy}>Save daily target</button></form>
 </details>;
}
