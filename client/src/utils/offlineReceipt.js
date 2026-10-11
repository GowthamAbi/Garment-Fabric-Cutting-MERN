export function provisionalReceipt(draft) {
  const p=draft.payload, net=Math.round(p.unitPrice*100)*p.quantity-Math.round(p.discount*100);
  const tax=Math.round(net*p.taxPercent/100);
  if (![net,tax,net+tax].every(Number.isSafeInteger)) throw new Error('Receipt amount exceeds capacity');
  return { reference: draft.key, date: draft.createdAt, bundleId:p.bundleId, quantity:p.quantity,
    net,tax,total:net+tax, paymentMode:'CASH', status:'PROVISIONAL_PENDING_SYNC',
    notice:'Provisional cash record. Not a GST tax invoice. Final invoice and stock approval follow online synchronization.' };
}
