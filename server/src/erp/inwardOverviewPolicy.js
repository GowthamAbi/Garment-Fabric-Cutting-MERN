// INWARD read-only reporting uses existing DepartmentLot, DepartmentBundle and
// DepartmentEvent data, never an independent stock balance.
import ApiError from "../utils/ApiError.js";
const qty=v=>Number.isSafeInteger(Number(v))&&Number(v)>=0?Number(v):0;
const up=v=>String(v??"").trim().toUpperCase();

export function validateInwardDiscrepancy(body={},bundle={}){
 const stage=up(bundle.stage);
 if(!["STITCHED","REWORK_DONE"].includes(stage))
  throw new ApiError(409,"Only stitched or completed rework bundles may be counted");
 const observed=body.countedPcs;
 if(observed===""||observed==null||typeof observed==="boolean"||
    !Number.isSafeInteger(Number(observed))||Number(observed)<0||Number(observed)>1000000)
  throw new ApiError(400,"Physical count must be a whole nonnegative PCS value");
 const countedPcs=Number(observed),expectedPcs=qty(bundle.qty);
 if(countedPcs===expectedPcs)throw new ApiError(400,"Count matches bundle; no discrepancy to request");
 const type=countedPcs<expectedPcs?"SHORTAGE":"EXCESS";
 const reason=String(body.reason||"").trim();
 if(reason.length<8||reason.length>300)
  throw new ApiError(400,"Explain shortage/excess in 8–300 characters");
 return {type,expectedPcs,countedPcs,variancePcs:countedPcs-expectedPcs,reason};
}

export function inwardOverview(lots=[],bundles=[],events=[],requests=[]){
 const lotIds=new Set(lots.map(x=>String(x._id)));
 const bundled=new Map(),lotMap=new Map(lots.map(l=>[String(l._id),l]));
 for(const b of bundles){
  const id=String(b.lotId);
  if(!lotIds.has(id)||qty(b.qty)===0)continue;
  if(!bundled.has(id))bundled.set(id,[]);
  bundled.get(id).push(b);
 }
 const rows=lots.map(l=>{
  const id=String(l._id),parts=bundled.get(id)||[];
  const expectedPcs=qty(l.sent),receivedPcs=qty(l.received),
    readyPcs=parts.filter(b=>b.stage==="STITCHED").reduce((n,b)=>n+qty(b.qty),0),
    reworkReadyPcs=parts.filter(b=>b.stage==="REWORK_DONE").reduce((n,b)=>n+qty(b.qty),0);
  return {lotId:id,lotNo:l.code||"",dcNo:l.dcNo||"",orderNo:l.orderNo||"",
    vendor:l.section||"",sku:l.sku||"",expectedPcs,receivedPcs,
    readyPcs,reworkReadyPcs,pendingPcs:Math.max(0,expectedPcs-receivedPcs),
    sourceChallanId:l.sourceChallanId||"",status:l.status||"ACTIVE"};
 });
 const summary=rows.reduce((acc,row)=>{
  for(const field of ["expectedPcs","receivedPcs","readyPcs","reworkReadyPcs","pendingPcs"])
   acc[field]+=row[field];
  return acc;
 },{lots:rows.length,expectedPcs:0,receivedPcs:0,readyPcs:0,reworkReadyPcs:0,pendingPcs:0,
    pendingRequests:requests.filter(r=>r.status==="PENDING").length});
 const vendors=new Map();
 for(const p of rows){
  const key=up(p.vendor)||"UNASSIGNED",v=vendors.get(key)||{vendor:key,expectedPcs:0,
    receivedPcs:0,pendingPcs:0,readyPcs:0,reworkReadyPcs:0,lotCount:0};
  v.lotCount++;
  for(const name of ["expectedPcs","receivedPcs","pendingPcs","readyPcs","reworkReadyPcs"])
   v[name]+=p[name];
  vendors.set(key,v);
 }
 const readyBundles=bundles.filter(b=>lotIds.has(String(b.lotId))&&
   qty(b.qty)>0&&["STITCHED","REWORK_DONE"].includes(b.stage))
  .map(b=>{const lot=lotMap.get(String(b.lotId));return {
   id:String(b._id),code:b.code||"",lotId:String(b.lotId),
   lotNo:lot.code||"",dcNo:lot.dcNo||"",vendor:lot.section||"",
   sku:lot.sku||"",pcs:qty(b.qty),stage:b.stage,
   canReceive:!lot.routeSnapshot||lot.routeSnapshot.stages?.includes("INWARD")===true
  };});
 const history=events.filter(e=>e.kind==="ADVANCE"&&e.department==="INWARD"&&
   !e.reversedBy&&lotIds.has(String(e.lotId)))
  .map(e=>({id:String(e._id),lotId:String(e.lotId),
   lotNo:lotMap.get(String(e.lotId))?.code||"",dcNo:lotMap.get(String(e.lotId))?.dcNo||"",
   vendor:lotMap.get(String(e.lotId))?.section||"",quantity:qty(e.quantity),
   sourceBundleId:String(e.bundleId||""),nextStage:e.details?.bundle?.stage||"",
   actor:e.actor||"",createdAt:e.createdAt||null,documentId:e.documentId||""}));
 return {summary,rows,vendors:[...vendors.values()].sort((a,b)=>a.vendor.localeCompare(b.vendor)),
   readyBundles,history,requests};
}
