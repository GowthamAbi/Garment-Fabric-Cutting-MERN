// Despatch/Dispatch: all metrics derive from real ERP bundles and TRANSFER
// events. Warehouse receipt is confirmed only by a WAREHOUSE movement whose
// source is an actual transit bundle created by Dispatch.
import ApiError from "../utils/ApiError.js";
const clean=x=>String(x??"").trim();
const pcs=x=>Number.isSafeInteger(x)&&x>=0?x:0;
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(new Date(s).valueOf())&&new Date(s).toISOString().slice(0,10)===s;
export const DISPATCH_EXCEPTIONS=Object.freeze(["SHORT_LOADING","CARTON_DAMAGE","VEHICLE_DELAY","TRANSIT_MISMATCH","OTHER"]);
export function validateDispatchTransport(input={}){
 if(input==null||typeof input!=="object"||Array.isArray(input))throw new ApiError(400,"Transport details must be a record");
 const vehicleNo=clean(input.vehicleNo).toUpperCase(),transporter=clean(input.transporter),
  driver=clean(input.driver),lrNo=clean(input.lrNo),notes=clean(input.notes);
 if(!vehicleNo&&!transporter&&!driver&&!lrNo&&!notes)return null; // legacy transfer compatibility
 if(vehicleNo.length<3||vehicleNo.length>30||!/^[A-Z0-9 -]+$/.test(vehicleNo))
  throw new ApiError(400,"Vehicle number must be 3–30 letters/digits");
 if(transporter.length<2||transporter.length>100||driver.length>80||lrNo.length>60||notes.length>300)
  throw new ApiError(400,"Transporter and vehicle details required; check limits");
 return {vehicleNo,transporter,driver,lrNo,notes};
}
export function validateDispatchPlan(input={}){
 const date=clean(input.date),sku=clean(input.sku).toUpperCase(),
  dcNo=clean(input.dcNo).toUpperCase(),destination=clean(input.destination).toUpperCase(),
  quantity=Number(input.quantity),notes=clean(input.notes);
 if(!validDate(date))throw new ApiError(400,"Valid dispatch date YYYY-MM-DD required");
 if(!/^[A-Z0-9_./-]{2,80}$/.test(sku)||dcNo.length>100||
   !/^[A-Z0-9_-]{2,60}$/.test(destination)||notes.length>300)
  throw new ApiError(400,"Valid SKU/DC/warehouse destination required");
 if(input.quantity==null||input.quantity===""||typeof input.quantity==="boolean"||
  !Number.isSafeInteger(quantity)||quantity<1||quantity>1000000)
  throw new ApiError(400,"Schedule quantity must be 1–1,000,000 whole PCS");
 return {date,sku,dcNo,destination,quantity,notes};
}
export function validateDispatchException(input={},bundle={}){
 if(!["PACKED","TRANSIT_WAREHOUSE"].includes(bundle.stage)||!pcs(bundle.qty))
  throw new ApiError(409,"Active packed or in-transit carton required");
 const category=clean(input.category).toUpperCase(),reason=clean(input.reason),
  quantity=Number(input.quantity);
 if(!DISPATCH_EXCEPTIONS.includes(category))throw new ApiError(400,"Unknown Dispatch exception category");
 if(input.quantity==null||input.quantity===""||typeof input.quantity==="boolean"||
    !Number.isSafeInteger(quantity)||quantity<1||quantity>pcs(bundle.qty))
  throw new ApiError(400,"Exception quantity must be available whole pieces");
 if(reason.length<8||reason.length>300)throw new ApiError(400,"Exception reason must be 8–300 characters");
 return {category,reason,quantity,stage:bundle.stage,availablePcs:pcs(bundle.qty)};
}
export function dispatchOverview(lots=[],bundles=[],events=[],plans=[],exceptions=[],warehouses=[],skuRows=[],now=new Date()){
 const byLot=new Map(lots.map(l=>[String(l._id),l]));
 const bySku=new Map(skuRows.map(s=>[s.code,s]));
 const activeBundles=[],byOrder=new Map(),summary={readyPackedPcs:0,
  inTransitPcs:0,shippedEventPcs:0,warehouseReceivedEventPcs:0,
  readyCartons:0,transitCartons:0,pendingExceptionRequests:exceptions.filter(x=>x.status==="PENDING").length,
  scheduledPcs:plans.reduce((s,p)=>s+pcs(p.quantity),0)};
 for(const b of bundles){
  const l=byLot.get(String(b.lotId)),qty=pcs(b.qty);
  if(!l||!qty||!["PACKED","TRANSIT_WAREHOUSE"].includes(b.stage))continue;
  const sku=bySku.get(l.sku)||{},ageHours=b.createdAt?Math.floor(Math.max(0,(now-new Date(b.createdAt))/3600000)):null;
  const row={id:String(b._id),cartonNo:b.code||"",lotId:String(l._id),lotNo:l.code||"",
    dcNo:l.dcNo||"",orderNo:l.orderNo||"",sku:l.sku||"",size:sku.size||"",colour:sku.colour||"",
    section:l.section||"",stage:b.stage,quantity:qty,destination:b.destination||"",
    parentId:b.parentId||"",ageHours:Number.isFinite(ageHours)?ageHours:null};
  activeBundles.push(row);
  const field=b.stage==="PACKED"?"readyPackedPcs":"inTransitPcs";
  summary[field]+=qty;
  summary[b.stage==="PACKED"?"readyCartons":"transitCartons"]++;
  const key=l.orderNo||l.dcNo||l.code||String(l._id);
  const agg=byOrder.get(key)||{orderNo:l.orderNo||"",dcNo:l.dcNo||"",sku:l.sku||"",
   readyPackedPcs:0,inTransitPcs:0,cartons:0};
  agg[field]+=qty;agg.cartons++;byOrder.set(key,agg);
 }
 const dispatchEvents=events.filter(e=>e.department==="DISPATCH"&&e.kind==="TRANSFER"&&!e.reversedBy&&
  e.details?.bundle?.stage==="TRANSIT_WAREHOUSE"&&byLot.has(String(e.details?.bundle?.lotId||e.lotId)));
 const transitIds=new Set(dispatchEvents.map(e=>String(e.details.bundle._id)));
 const receipts=new Map();
 for(const e of events.filter(e=>e.department==="WAREHOUSE"&&e.kind==="TRANSFER"&&!e.reversedBy)){
  const child=e.details?.bundle,parentId=String(child?.parentId||"");
  if(!transitIds.has(parentId)||!String(child?.stage||"").startsWith("WAREHOUSE:"))continue;
  receipts.set(parentId,(receipts.get(parentId)||0)+pcs(e.quantity));
 }
 const history=[];
 for(const e of dispatchEvents){
  const child=e.details.bundle,l=byLot.get(String(child.lotId||e.lotId));
  const shipped=pcs(e.quantity),received=Math.min(shipped,receipts.get(String(child._id))||0),
   transport=e.details?.dispatch||{};
  summary.shippedEventPcs+=shipped;summary.warehouseReceivedEventPcs+=received;
  history.push({eventId:String(e._id),date:e.createdAt||null,cartonNo:child.code||"",
   transitId:String(child._id),sourceBundleId:e.bundleId||"",lotNo:l.code||"",
   dcNo:l.dcNo||"",orderNo:l.orderNo||"",sku:l.sku||"",size:bySku.get(l.sku)?.size||"",
   colour:bySku.get(l.sku)?.colour||"",destination:child.destination||"",
   shippedPcs:shipped,receivedPcs:received,pendingReceiptPcs:shipped-received,
   status:received===0?"IN_TRANSIT":received===shipped?"RECEIVED":"PARTIAL_RECEIPT",
   documentId:e.documentId||"",transport});
 }
 const keyed=new Map();
 for(const h of history){
  const isoDate=h.date?new Date(h.date).toISOString().slice(0,10):"";
  for(const key of [JSON.stringify([isoDate,h.sku,h.dcNo]),JSON.stringify([isoDate,h.sku,""])])
   if(keyed.has(key)||key===JSON.stringify([isoDate,h.sku,h.dcNo]))
    keyed.set(key,(keyed.get(key)||0)+h.shippedPcs);
 }
 const schedules=plans.map(p=>{
  const actualPcs=keyed.get(JSON.stringify([p.date,p.sku,p.dcNo||""]))||0;
  return {id:String(p._id),date:p.date,sku:p.sku,dcNo:p.dcNo||"",
    destination:p.destination,plannedPcs:pcs(p.quantity),actualPcs,
    pendingPcs:Math.max(0,pcs(p.quantity)-actualPcs),
    achievementPercent:p.quantity?Number((actualPcs/p.quantity*100).toFixed(1)):0,notes:p.notes||""};
 });
 return {summary,bundles:activeBundles,orders:[...byOrder.values()],history,schedules,
  exceptions,warehouses:warehouses.filter(w=>w.kind==="WAREHOUSE"&&w.active!==false)
   .map(w=>({key:w.key,name:w.name||w.key,address:w.address||""})),
  notes:{transferDestinations:"WAREHOUSE_ONLY",customerDispatch:"NOT_IMPLEMENTED",
   receiptLinkedByTransitBundle:true,printDocumentIsStockMovementNotTaxInvoice:true}};
}
