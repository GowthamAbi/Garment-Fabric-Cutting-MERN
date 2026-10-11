import { fail } from './policy.js';
export function legacyHandoff(challan, lineId, sku, lots, quantity) {
  if (!challan || challan.status !== 'ISSUED') fail('Issued delivery challan required');
  const line=challan.lines.find(l=>String(l._id)===lineId);
  if(!line||!Number.isSafeInteger(line.pcs)||line.pcs<=0)fail('Valid challan colour/size line required');
  const upper=v=>String(v||'').trim().toUpperCase();
  if(!sku||sku.kind!=='FINISHED'||!['PCS','PC','PIECE','PIECES'].includes(sku.unit)||sku.active===false||!upper(sku.colour)||!upper(sku.size)||upper(sku.colour)!==upper(line.colour)||upper(sku.size)!==upper(line.size))fail('Finished piece SKU colour and size must match the challan line');
  const linked=lots.filter(l=>l.status!=='CANCELLED'&&l.sourceChallanId===String(challan._id)&&l.sourceChallanLineId===lineId);
  if(linked.some(l=>l.sku!==sku.code))fail('Challan line is already mapped to a different variant SKU');
  const sent=linked.reduce((n,l)=>n+l.sent,0);
  if(!Number.isSafeInteger(quantity)||quantity<=0||sent+quantity>line.pcs)fail('Quantity exceeds unlinked challan pieces');
  return {sourceChallanId:String(challan._id),sourceChallanLineId:lineId,legacyPlanNo:challan.planNo,dcNo:challan.challanNo,orderNo:challan.orderNo||challan.planNo,section:challan.vendorCode,pending:line.pcs-sent-quantity};
}
