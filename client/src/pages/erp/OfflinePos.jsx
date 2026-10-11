import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { posScope, saleDraft, listSaleDrafts, addSaleDraft, updateSaleDraft, removeSaleDraft } from '../../utils/offlinePos.js';
import { companyKeyFromLocation } from '../../utils/tenantClient.js';

export default function OfflinePos({ user, bundles, onSynced, onInvoice }) {
  const [drafts,setDrafts]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const scope=posScope(user,companyKeyFromLocation());
  const load=async()=>setDrafts(await listSaleDrafts(scope));
  useEffect(()=>{load().catch(e=>setError(e.message));},[scope]);
  async function save(e) {
    e.preventDefault();setBusy(true);setError('');const form=e.currentTarget;
    try {
      const draft=saleDraft(scope,Object.fromEntries(new FormData(form)));
      const bundle=bundles.find(b=>b._id===draft.payload.bundleId);
      const existing=await listSaleDrafts(scope),reserved=existing.filter(d=>d.payload.bundleId===bundle?._id).reduce((n,d)=>n+d.payload.quantity,0);
      if(!bundle||draft.payload.quantity>bundle.qty-reserved)throw new Error('Draft exceeds last known stock after your pending drafts');
      await addSaleDraft(draft);form.reset();await load();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function sync() {
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
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <details><summary>Offline cash-sale drafts ({drafts.length})</summary>
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
