// Warehouse analytics: read-only snapshots of authoritative ERP lots,
// bundles, masters and events. No replacement quantity balances.
const pcs=x=>Number.isSafeInteger(x)&&x>=0?x:0;
const str=x=>String(x??"").trim();
const warehouseStage=x=>str(x).startsWith("WAREHOUSE:");
const transitStage=x=>x==="TRANSIT_WAREHOUSE"||str(x).startsWith("TRANSIT_SHOP:");
export function warehouseOverview(lots=[],bundles=[],events=[],masters=[],exceptions=[],skus=[],now=new Date()){
 const byLot=new Map(lots.map(l=>[String(l._id),l]));
 const skuMap=new Map(skus.map(s=>[s.code,s]));
 const locations=masters.filter(m=>m.kind==="WAREHOUSE"&&m.active!==false)
   .map(m=>({key:m.key,name:m.name||m.key,address:m.address||""}));
 const locSet=new Set(locations.map(x=>x.key));
 const shops=masters.filter(m=>m.kind==="SHOP"&&m.active!==false)
   .map(m=>({key:m.key,name:m.name||m.key}));
 const bins=masters.filter(m=>m.kind==="BIN"&&m.active!==false&&locSet.has(m.warehouse))
   .map(m=>({key:m.key,warehouse:m.warehouse,rack:m.rack||"",bin:m.bin||"",name:m.name||m.key}));
 const rows=[],aggregates=new Map(),summary={
  warehouseStockPcs:0,warehouseBundles:0,
  inboundTransitPcs:0,inboundTransitBundles:0,
  outboundTransitPcs:0,outboundTransitBundles:0,
  unassignedBinPcs:0,openCountRequests:0};
 for(const b of bundles){
  const l=byLot.get(String(b.lotId)),qty=pcs(b.qty),stage=str(b.stage);
  if(!l||!qty||!locSet.has(b.destination))continue;
  if(!warehouseStage(stage)&&!transitStage(stage))continue;
  const direction=warehouseStage(stage)?"IN_STOCK":
   stage==="TRANSIT_WAREHOUSE"?"INBOUND_TRANSIT":"OUTBOUND_TRANSIT";
  const sku=skuMap.get(l.sku)||{};
  const date=b.createdAt?new Date(b.createdAt):null;
  const ageHours=date&&Number.isFinite(date.valueOf())?Math.floor(Math.max(0,(now-date)/3600000)):null;
  const row={id:String(b._id),code:b.code||"",lotId:String(l._id),
   lotNo:l.code||"",dcNo:l.dcNo||"",orderNo:l.orderNo||"",sku:l.sku||"",
   colour:sku.colour||"",size:sku.size||"",section:l.section||"",
   stage,quantity:qty,warehouse:b.destination||"",bin:b.bin||"",
   direction,parentId:b.parentId||"",ageHours,createdAt:b.createdAt||null};
  rows.push(row);
  if(direction==="IN_STOCK"){
   summary.warehouseStockPcs+=qty;summary.warehouseBundles++;
   if(!b.bin)summary.unassignedBinPcs+=qty;
   const key=JSON.stringify([row.warehouse,row.sku,row.bin]),a=aggregates.get(key)||{
    warehouse:row.warehouse,sku:row.sku,colour:row.colour,size:row.size,
    bin:row.bin,quantity:0,bundleCount:0};
   a.quantity+=qty;a.bundleCount++;aggregates.set(key,a);
  }else if(direction==="INBOUND_TRANSIT"){
   summary.inboundTransitPcs+=qty;summary.inboundTransitBundles++;
  }else{
   summary.outboundTransitPcs+=qty;summary.outboundTransitBundles++;
  }
 }
 const allReceipts=events.filter(e=>e.kind==="TRANSFER"&&e.department==="WAREHOUSE"&&!e.reversedBy&&
   warehouseStage(e.details?.bundle?.stage)&&locSet.has(e.details?.bundle?.destination));
 const receiptsByTransit=new Map();
 for(const e of allReceipts){
  const transitId=str(e.details?.bundle?.parentId);
  if(!transitId)continue;
  receiptsByTransit.set(transitId,(receiptsByTransit.get(transitId)||0)+pcs(e.quantity));
 }
 const shipments=[];
 for(const e of events.filter(e=>e.kind==="TRANSFER"&&!e.reversedBy&&
   ["DISPATCH","SHOP"].includes(e.department)&&e.details?.bundle?.stage==="TRANSIT_WAREHOUSE"&&
   locSet.has(e.details?.bundle?.destination))){
  const t=e.details.bundle,l=byLot.get(String(t.lotId||e.lotId));
  if(!l)continue;
  const shipped=pcs(e.quantity),received=Math.min(shipped,receiptsByTransit.get(String(t._id))||0);
  shipments.push({id:String(e._id),date:e.createdAt||null,
   origin:e.department,sourceBundleId:e.bundleId||"",transitBundleId:String(t._id),
   cartonNo:t.code||"",lotNo:l.code||"",dcNo:l.dcNo||"",sku:l.sku||"",
   warehouse:t.destination,shippedPcs:shipped,receivedPcs:received,
   pendingPcs:Math.max(0,shipped-received),
   status:received===0?"IN_TRANSIT":received>=shipped?"RECEIVED":"PARTIAL_RECEIPT",
   documentId:e.documentId||""});
 }
 const history=events.filter(e=>!e.reversedBy&&
  (e.department==="WAREHOUSE"||
   (e.department==="SHOP"&&e.kind==="TRANSFER"&&e.details?.bundle?.stage==="TRANSIT_WAREHOUSE")))
 .map(e=>{
  const b=e.details?.bundle||{},l=byLot.get(String(b.lotId||e.lotId));
  return {id:String(e._id),date:e.createdAt||null,kind:e.kind,department:e.department,
   quantity:pcs(e.quantity),warehouse:b.destination||"",stage:b.stage||"",
   cartonNo:b.code||"",dcNo:l?.dcNo||"",sku:l?.sku||"",
   sourceBundleId:e.bundleId||"",documentId:e.documentId||"",actor:e.actor||""};
 });
 const requests=exceptions.filter(x=>locSet.has(x.destination)&&
  (warehouseStage(x.stage)||x.stage==="TRANSIT_WAREHOUSE"))
  .map(x=>({id:String(x._id),bundleId:x.bundleId,warehouse:x.destination,stage:x.stage,
    expectedPcs:pcs(x.expectedQty),countedPcs:pcs(x.countedQty),
    differencePcs:Math.max(0,pcs(x.expectedQty)-pcs(x.countedQty)),
    kind:x.kind,status:x.status,reason:x.reason,requestedBy:x.requestedBy,
    createdAt:x.createdAt||null,documentId:x.documentId||""}));
 summary.openCountRequests=requests.filter(x=>x.status==="PENDING").length;
 return {summary,locations,shops,bins,bundles:rows,stocks:[...aggregates.values()],
  inbound:shipments,history,requests,
  notes:{inboundReceipt:"Warehouse TRANSFER only",shopReturns:"SHOP origin transit",
   adjustment:"Separate independent admin decision",aging:"Bundle creation age only"}};
}
