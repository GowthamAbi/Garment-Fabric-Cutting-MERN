// Quality checking analytics derive from the existing tenant-scoped ERP
// lot, active bundle and movement-event records. No parallel stock balances.
import ApiError from "../utils/ApiError.js";
const pcs=v=>Number.isSafeInteger(v)&&v>=0?v:0;
const active=e=>!e.reversedBy;
const stage=b=>String(b.stage||"");
const categories=["STITCHING","FABRIC","MEASUREMENT","OIL_STAIN","OTHER"];
export const QC_DEFECT_CATEGORIES=Object.freeze(categories);

export function validateQualityHold(body={},bundle={}){
 if(stage(bundle)!=="CHECKING"||!pcs(bundle.qty))
  throw new ApiError(409,"Only active Checking bundles can request QC hold");
 const category=String(body.category||"").trim().toUpperCase();
 if(!categories.includes(category))
  throw new ApiError(400,"Choose a valid quality defect category");
 const reason=String(body.reason||"").trim();
 if(reason.length<8||reason.length>300)
  throw new ApiError(400,"QC hold reason must have 8–300 characters");
 return {category,reason,expectedPcs:bundle.qty,stage:"CHECKING"};
}
export function qcDefectText(category,reason){
 const name=String(category||"").trim().toUpperCase();
 if(!categories.includes(name))throw new ApiError(400,"Unknown QC defect category");
 const details=String(reason||"").trim();
 if(!details||details.length>95)throw new ApiError(400,"Defect details must be 1–95 characters");
 return name+": "+details;
}
export function checkingOverview(lots=[],bundles=[],events=[],holds=[]){
 const lotById=new Map(lots.map(l=>[String(l._id),l]));
 const states=["CHECKING","GOOD","REWORK","REWORK_DONE","OIL","OIL_DONE","WASTE"];
 const summary={lotCount:0,pendingPcs:0,goodStockPcs:0,reworkStockPcs:0,
  oilStockPcs:0,wasteStockPcs:0,checksPerformedPcs:0,
  passRecordedPcs:0,reworkRecordedPcs:0,oilRecordedPcs:0,rejectRecordedPcs:0,
  pendingHoldRequests:holds.filter(x=>x.status==="PENDING").length};
 const lotRows=new Map();
 const groups=new Map();
 for(const l of lots)lotRows.set(String(l._id),{lotId:String(l._id),lotNo:l.code||"",
  dcNo:l.dcNo||"",orderNo:l.orderNo||"",sku:l.sku||"",vendor:l.section||"",
  sentPcs:pcs(l.sent),pendingPcs:0,goodStockPcs:0,reworkStockPcs:0,oilStockPcs:0,wasteStockPcs:0});
 const bundleRows=[];
 for(const b of bundles){
  const l=lotById.get(String(b.lotId)),quantity=pcs(b.qty),s=stage(b);
  if(!l||!quantity||!states.includes(s))continue;
  const data={bundleId:String(b._id),bundleNo:b.code||"",lotId:String(l._id),
   lotNo:l.code||"",dcNo:l.dcNo||"",orderNo:l.orderNo||"",sku:l.sku||"",
   vendor:l.section||"",stage:s,quantity,cycle:pcs(b.cycle)};
  bundleRows.push(data);
  let field=null;
  if(s==="CHECKING")field="pendingPcs";
  if(s==="GOOD")field="goodStockPcs";
  if(s==="REWORK"||s==="REWORK_DONE")field="reworkStockPcs";
  if(s==="OIL"||s==="OIL_DONE")field="oilStockPcs";
  if(s==="WASTE")field="wasteStockPcs";
  if(field){summary[field]+=quantity;lotRows.get(String(l._id))[field]+=quantity;}
  const gkey=l.section||"UNASSIGNED",g=groups.get(gkey)||{
   vendor:gkey,pendingPcs:0,goodStockPcs:0,reworkStockPcs:0,oilStockPcs:0,wasteStockPcs:0};
  if(field)g[field]+=quantity;
  groups.set(gkey,g);
 }
 const inspections=[],defects=new Map(),history=[];
 for(const e of events){
  if(!active(e)||!lotById.has(String(e.lotId)))continue;
  const lot=lotById.get(String(e.lotId));
  if(e.kind==="CHECK"&&e.department==="CHECKING"){
   const split=e.details?.split||{},total=pcs(split.total)||pcs(e.quantity);
   const good=pcs(split.good),rework=pcs(split.rework),oil=pcs(split.oil),reject=pcs(split.reject);
   const defect=String(e.details?.defect||"").trim(),candidate=defect.split(":")[0].trim().toUpperCase();
   const category=categories.includes(candidate)?candidate:"UNCLASSIFIED";
   const row={eventId:String(e._id),date:e.createdAt||null,lotId:String(e.lotId),lotNo:lot.code||"",
    dcNo:lot.dcNo||"",vendor:lot.section||"",sku:lot.sku||"",bundleId:e.bundleId||"",
    total,good,rework,oil,reject,category,defect,actor:e.actor||"",documentId:e.documentId||""};
   inspections.push(row);
   summary.checksPerformedPcs+=total;summary.passRecordedPcs+=good;
   summary.reworkRecordedPcs+=rework;summary.oilRecordedPcs+=oil;summary.rejectRecordedPcs+=reject;
   const d=defects.get(category)||{category,inspections:0,reworkPcs:0,oilPcs:0,rejectPcs:0};
   d.inspections++;d.reworkPcs+=rework;d.oilPcs+=oil;d.rejectPcs+=reject;defects.set(category,d);
  }
  if(e.department==="CHECKING"&&["CHECK","ADVANCE"].includes(e.kind))
   history.push({eventId:String(e._id),date:e.createdAt||null,
    kind:e.kind,lotNo:lot.code||"",dcNo:lot.dcNo||"",vendor:lot.section||"",
    quantity:pcs(e.quantity),bundleId:e.bundleId||"",
    nextStage:e.details?.bundle?.stage||"",
    defect:e.details?.defect||"",documentId:e.documentId||""});
 }
 summary.lotCount=[...lotRows.values()].filter(l=>l.pendingPcs||l.goodStockPcs||
  l.reworkStockPcs||l.oilStockPcs||l.wasteStockPcs).length;
 return {summary,lots:[...lotRows.values()],vendors:[...groups.values()],
  bundles:bundleRows,inspections,defects:[...defects.values()],history,holds};
}
