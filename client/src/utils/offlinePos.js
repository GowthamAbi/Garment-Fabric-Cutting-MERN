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
    const request=indexedDB.open('ugs-pos-drafts-v1',2);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('drafts')){const s=request.result.createObjectStore('drafts',{keyPath:'id'});s.createIndex('scope','scope');}if(!request.result.objectStoreNames.contains('catalogs'))request.result.createObjectStore('catalogs',{keyPath:'id'});};
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
export async function addSaleDraft(draft,available) {
  if(!Number.isSafeInteger(available)||available<draft.payload.quantity)throw new Error('Valid last-known stock required');
  const db=await openDb();
  try{return await new Promise((resolve,reject)=>{
    // A single read/write transaction serializes reservations across tabs.
    const tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),request=store.index('scope').getAll(draft.scope);let error;
    request.onsuccess=()=>{
      const reserved=request.result.filter(d=>d.payload.bundleId===draft.payload.bundleId).reduce((n,d)=>n+d.payload.quantity,0);
      if(!Number.isSafeInteger(reserved)||draft.payload.quantity>available-reserved){error=new Error('Draft exceeds last-known stock after pending drafts');tx.abort();return;}
      store.add(draft);
    };
    tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(error||new Error('Offline draft transaction failed'));
  });}finally{db.close();}
}
export const updateSaleDraft = draft => operation('readwrite',s=>s.put(draft));
export const removeSaleDraft = id => operation('readwrite',s=>s.delete(id));

async function catalogOperation(mode, action) {
  const db=await openDb();
  try {return await new Promise((resolve,reject)=>{
    const tx=db.transaction('catalogs',mode),r=action(tx.objectStore('catalogs'));let result;
    r.onsuccess=()=>{result=r.result;};tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(new Error('Offline catalog storage failed'));
  });}finally{db.close();}
}
async function deviceKey(passphrase,salt) {
  if(typeof passphrase!=='string'||passphrase.length<16)throw new Error('Device passphrase must contain at least 16 characters');
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encryptOfflineCatalog(scope,bundles,passphrase,now=new Date()) {
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const value={scope,savedAt:now.toISOString(),expiresAt:new Date(now.getTime()+24*3600000).toISOString(),
    bundles:bundles.filter(b=>b.stage.startsWith('SHOP:')&&b.qty>0).map(b=>({_id:b._id,code:b.code,qty:b.qty}))};
  const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(scope)},await deviceKey(passphrase,salt),new TextEncoder().encode(JSON.stringify(value)));
  return {id:scope,salt:Array.from(salt),iv:Array.from(iv),data:Array.from(new Uint8Array(data))};
}
export async function saveOfflineCatalog(scope,bundles,passphrase) {const record=await encryptOfflineCatalog(scope,bundles,passphrase);await catalogOperation('readwrite',s=>s.put(record));}
export const listOfflineCatalogs=()=>catalogOperation('readonly',s=>s.getAllKeys());
export const removeOfflineCatalog=scope=>catalogOperation('readwrite',s=>s.delete(scope));
export async function decryptOfflineCatalog(record,scope,passphrase,now=new Date()) {
  if(!record)throw new Error('Enroll this device online first');
  let value;try{const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(record.iv),additionalData:new TextEncoder().encode(scope)},await deviceKey(passphrase,new Uint8Array(record.salt)),new Uint8Array(record.data));value=JSON.parse(new TextDecoder().decode(raw));}catch{throw new Error('Unable to unlock device catalog');}
  if(value.scope!==scope||Date.parse(value.expiresAt)<=now.getTime())throw new Error('Offline catalog expired; reconnect and enroll again');
  return value;
}
export async function unlockOfflineCatalog(scope,passphrase) {return decryptOfflineCatalog(await catalogOperation('readonly',s=>s.get(scope)),scope,passphrase);}
