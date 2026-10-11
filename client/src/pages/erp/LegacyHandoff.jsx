import {useState} from 'react';
import {api} from '../../api.js';
export default function LegacyHandoff({onSaved}){
 const [rows,setRows]=useState([]),[line,setLine]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const entries=rows.flatMap(c=>c.lines.filter(l=>l.pcs>l.linked).map(l=>({id:`${c._id}|${l._id}`,challan:c,line:l})));
 return <details><summary>Link existing Delivery Challan to stitching</summary><p>This consumes reviewed CUTTING ledger stock once. It does not create opening stock or invent costs. Map the exact colour/size SKU; partial links retain the remaining challan quantity.</p>{error&&<p className="erp-error">{error}</p>}
 <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{setRows(await api('/erp/departments/legacy-challans?'+new URLSearchParams(new FormData(e.currentTarget))));}catch(e){setError(e.message);}finally{setBusy(false);}}}><label>Legacy plan number filter<input name="planNo"/></label><button disabled={busy}>Load challans</button></form>
 <form className="erp-grid" onChange={e=>{delete e.currentTarget.dataset.key;}} onSubmit={async e=>{e.preventDefault();const form=e.currentTarget,selected=entries.find(x=>x.id===line);if(!selected)return;setBusy(true);setError('');const key=form.dataset.key||(form.dataset.key=crypto.randomUUID());try{await api('/erp/departments/delivery',{method:'POST',body:JSON.stringify({...Object.fromEntries(new FormData(form)),key,sourceLocation:'CUTTING',sourceChallanId:selected.challan._id,sourceChallanLineId:selected.line._id})});delete form.dataset.key;form.reset();setLine('');setRows([]);await onSaved();}catch(e){setError(e.message);}finally{setBusy(false);}}}>
 <label>Challan / colour / size<select required value={line} onChange={e=>setLine(e.target.value)}><option value="">Select</option>{entries.map(x=><option key={x.id} value={x.id}>{x.challan.challanNo} · {x.line.colour} / {x.line.size} · {x.line.pcs-x.line.linked} pending</option>)}</select></label>
 {['sku','operationMaster','packingMaster'].map(k=><label key={k}>{k}<input name={k} required/></label>)}<label>Pieces<input name="quantity" type="number" min="1" step="1" required/></label><button disabled={busy||!line}>Link and send to stitching</button>
 </form></details>;
}
