import { useEffect, useState, useRef } from 'react';
import { api } from '../../api.js';
import { posScope, saleDraft, listSaleDrafts, addSaleDraft, updateSaleDraft, removeSaleDraft, saveOfflineCatalog, removeOfflineCatalog } from '../../utils/offlinePos.js';
import { companyKeyFromLocation } from '../../utils/tenantClient.js';
import { provisionalReceipt } from '../../utils/offlineReceipt.js';

export default function OfflinePos({ user, bundles, onSynced, onInvoice }) {
  const [drafts,setDrafts]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[receipt,setReceipt]=useState(null);
  const scope=posScope(user,companyKeyFromLocation());
  const syncLock=useRef(false);
  const load=async()=>setDrafts(await listSaleDrafts(scope));
  useEffect(()=>{load().catch(e=>setError(e.message));},[scope]);
  useEffect(()=>{const connected=()=>{sync();};window.addEventListener('online',connected);return()=>window.removeEventListener('online',connected);},[scope]);
  async function save(e) {
    e.preventDefault();setBusy(true);setError('');const form=e.currentTarget;
    try {
      const draft=saleDraft(scope,Object.fromEntries(new FormData(form)));
      const bundle=bundles.find(b=>b._id===draft.payload.bundleId);
      const existing=await listSaleDrafts(scope),reserved=existing.filter(d=>d.payload.bundleId===bundle?._id).reduce((n,d)=>n+d.payload.quantity,0);
      if(!bundle||draft.payload.quantity>bundle.qty-reserved)throw new Error('Draft exceeds last known stock after your pending drafts');
      provisionalReceipt(draft);await addSaleDraft(draft,bundle.qty);setReceipt(provisionalReceipt(draft));form.reset();await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function sync() {
    if(syncLock.current)return;syncLock.current=true;
    setBusy(true);setError('');
    try {
      if(!navigator.onLine)throw new Error('Reconnect and sign in to sync');
      // Verify the current server identity before replaying saved cash-sale drafts.
      const session=await api('/auth/session');
      if(posScope(session.user,companyKeyFromLocation())!==scope)throw new Error('Sign in with the original company, factory and user');
      for(const draft of await listSaleDrafts(scope)) {
        if(draft.state==='CONFLICT')continue;
        try {
          const result=await api('/erp/departments/sale',{method:'POST',body:JSON.stringify(draft.payload),suppressGlobalError:true});
          await removeSaleDraft(draft.id);onInvoice?.(result.details?.sale);
        }catch(e){
          // Network failures remain retryable with the original immutable key.
          const conflict=[400,409,422].includes(e.status);
          await updateSaleDraft({...draft,state:conflict?'CONFLICT':'PENDING',error:e.message});
          if(!conflict)break;
        }
      }
      await load();await onSynced?.();
    }catch(e){setError(e.message);}finally{syncLock.current=false;setBusy(false);}
  }
  return <details><summary>Offline cash-sale drafts ({drafts.length})</summary>
    <form onSubmit={async e=>{e.preventDefault();setError('');const f=e.currentTarget;setBusy(true);try{if(!navigator.onLine)throw new Error('Enroll while online');const session=await api('/auth/session');if(posScope(session.user,companyKeyFromLocation())!==scope)throw new Error('Workspace identity changed');const fresh=await api('/erp/departments/SHOP/dashboard');if(!('serviceWorker' in navigator))throw new Error('This browser does not support offline mode');const registration=await navigator.serviceWorker.register('/offline-pos/sw.js',{scope:'/offline-pos/'});if(!registration.active)await new Promise((resolve,reject)=>{const worker=registration.installing||registration.waiting;if(!worker)return reject(new Error('Offline installation unavailable'));const timer=setTimeout(()=>reject(new Error('Offline installation timed out; reconnect and retry')),20000);worker.addEventListener('statechange',()=>{if(worker.state==='activated'){clearTimeout(timer);resolve();}if(worker.state==='redundant'){clearTimeout(timer);reject(new Error('Offline files failed to install'));}});});await saveOfflineCatalog(scope,fresh.bundles||[],new FormData(f).get('passphrase'));f.reset();setError('Device enrolled for 24 hours. Open the Offline POS link now to verify availability.');}catch(err){setError(err.message);}finally{setBusy(false);}}}><label>Device passphrase (16+ characters)<input name="passphrase" type="password" minLength="16" required autoComplete="new-password"/></label><button disabled={busy}>Enroll offline device</button></form>
    <a href="/offline-pos/">Open offline POS</a><button disabled={busy} onClick={()=>removeOfflineCatalog(scope).then(()=>setError('Catalog removed. Existing drafts retained for reconciliation.')).catch(e=>setError(e.message))}>Remove device catalog</button>
    {receipt&&<div className="erp-document"><h3>Provisional cash receipt</h3><p>{receipt.notice}</p><p>Reference: {receipt.reference}<br/>Pieces: {receipt.quantity}<br/>Total: ₹{(receipt.total/100).toFixed(2)}</p><button onClick={()=>window.print()}>Print provisional receipt</button><button onClick={()=>setReceipt(null)}>Close receipt</button></div>}
    <p>Keep this page open while offline. Drafts are saved on this device for this company, factory and user. Stock and invoice are confirmed only after online sync. Customer contact details are not stored in drafts.</p>
    {error&&<p className="erp-error">{error}</p>}
    <form className="erp-grid" onSubmit={save}><label>Shop bundle<select name="bundleId" required><option value="">Select</option>{bundles.filter(b=>b.stage.startsWith('SHOP:')).map(b=><option key={b._id} value={b._id}>{b.code} · {b.qty} last-known pieces</option>)}</select></label>
      <label>Pieces<input name="quantity" type="number" min="1" step="1" required/></label><label>Unit price INR<input name="unitPrice" type="number" min="0" step="0.01" required/></label>
      <label>Discount INR<input name="discount" type="number" min="0" step="0.01" defaultValue="0"/></label><label>GST %<select name="taxPercent">{[0,5,12,18,28].map(n=><option key={n}>{n}</option>)}</select></label>
      <label>Tax type<select name="taxType">{['NO_TAX','CGST_SGST','IGST'].map(n=><option key={n}>{n}</option>)}</select></label><input type="hidden" name="paymentMode" value="CASH"/><button disabled={busy}>Save pending draft</button></form>
    <button disabled={busy} onClick={sync}>Sync pending drafts</button><button disabled={busy} onClick={()=>load().catch(e=>setError(e.message))}>Refresh drafts</button>
    <div className="erp-table"><table><thead><tr><th>Draft</th><th>Pieces</th><th>Status</th><th>Action</th></tr></thead><tbody>{drafts.map(d=><tr key={d.id}><td>{d.key}</td><td>{d.payload.quantity}</td><td>{d.state} · {d.error}</td><td>{d.state==='CONFLICT'&&<button disabled={busy} onClick={async()=>{try{await updateSaleDraft({...d,state:'PENDING',error:''});await load();}catch(e){setError(e.message);}}}>Retry after review</button>}<button disabled={busy} onClick={async()=>{if(!window.confirm('Remove this draft? Check whether payment or stock needs manual reconciliation.'))return;try{await removeSaleDraft(d.id);await load();}catch(e){setError(e.message);}}}>Remove reviewed draft</button></td></tr>)}</tbody></table></div>
  </details>;
}
