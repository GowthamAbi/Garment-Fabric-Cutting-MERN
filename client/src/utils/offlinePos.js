export function posScope(user, companyKey) {
  if (!user?.userId || !user?.companyId || !user?.factoryId || !companyKey || companyKey === 'platform') throw new Error('A company user and factory are required');
  return JSON.stringify([companyKey, String(user.companyId), String(user.factoryId), user.userId]);
}

export function saleDraft(scope, input, now = new Date()) {
  if (input.paymentMode !== 'CASH') throw new Error('Offline drafts support cash only; bank payments need online confirmation');
  const quantity = Number(input.quantity);
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1000000 || !/^[a-f0-9]{24}$/i.test(input.bundleId || '')) throw new Error('Valid bundle and whole pieces required');
  const price = Number(input.unitPrice), discount = Number(input.discount || 0), tax = Number(input.taxPercent || 0);
  if (![price,discount].every(n=>Number.isFinite(n)&&n>=0&&Number.isSafeInteger(Math.round(n*100))&&Math.abs(n*100-Math.round(n*100))<1e-6) || discount > quantity*price) throw new Error('Invalid price or discount');
  if (![0,5,12,18,28].includes(tax) || (tax && !['CGST_SGST','IGST'].includes(input.taxType))) throw new Error('Invalid GST selection');
  const key = input.key || crypto.randomUUID();
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(key)) throw new Error('Invalid sale retry key');
  // Persist product/price data only. Customer contacts and login tokens are excluded.
  return { id: scope+'|'+key, scope, key, createdAt:now.toISOString(), state:'PENDING', error:'',
    payload:{key,bundleId:input.bundleId,quantity,unitPrice:price,discount,taxPercent:tax,taxType:tax?input.taxType:'NO_TAX',paymentMode:'CASH'} };
}

function openDb() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('ugs-pos-drafts-v1',1);
    request.onupgradeneeded=()=>{const s=request.result.createObjectStore('drafts',{keyPath:'id'});s.createIndex('scope','scope');};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('Browser draft storage unavailable'));
  });
}
async function operation(mode, action) {
  const db=await openDb();
  try { return await new Promise((resolve,reject)=>{
    const tx=db.transaction('drafts',mode), request=action(tx.objectStore('drafts'));let result;
    request.onsuccess=()=>{result=request.result;};
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(new Error('Unable to save/read offline draft'));tx.onabort=()=>reject(new Error('Offline draft transaction aborted'));
  }); } finally { db.close(); }
}
export const listSaleDrafts = scope => operation('readonly',s=>s.index('scope').getAll(scope));
export const addSaleDraft = draft => operation('readwrite',s=>s.add(draft));
export const updateSaleDraft = draft => operation('readwrite',s=>s.put(draft));
export const removeSaleDraft = id => operation('readwrite',s=>s.delete(id));
