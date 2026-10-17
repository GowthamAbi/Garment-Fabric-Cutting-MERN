// IRONING reporting consumes tenant/factory scoped ERP lots, bundles and
// committed ADVANCE events; it never maintains parallel inventory quantities.
import ApiError from "../utils/ApiError.js";
const pcs=v=>Number.isSafeInteger(v)&&v>=0?v:0;
const clean=v=>String(v??"").trim();
const date=v=>v instanceof Date&&!Number.isNaN(v.valueOf())?v.toISOString().slice(0,10):"";
export const IRONING_ISSUE_TYPES=Object.freeze(["DAMAGE","RE_IRON","STAIN","QUALITY_OTHER"]);
export function validateIroningIssue(body={},bundle={}){
 if(!["IRONING","IRONED"].includes(bundle.stage)||!pcs(bundle.qty))
  throw new ApiError(409,"Choose an active Ironing or completed Ironed bundle");
 const category=clean(body.category).toUpperCase();
 if(!IRONING_ISSUE_TYPES.includes(category))throw new ApiError(400,"Choose a recognized damage/re-ironing category");
 const quantity=Number(body.quantity);
 if(body.quantity==null||body.quantity===""||typeof body.quantity==="boolean"||
    !Number.isSafeInteger(quantity)||quantity<=0||quantity>pcs(bundle.qty))
  throw new ApiError(400,"Requested quantity must be whole PCS within available bundle");
 const reason=clean(body.reason);
 if(reason.length<8||reason.length>300)throw new ApiError(400,"Explain the issue in 8–300 characters");
 return {category,quantity,reason,expectedPcs:pcs(bundle.qty),stage:bundle.stage};
}
export function validateIroningTarget(body={}){
 const workDate=clean(body.date),day=new Date(workDate);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(workDate)||!Number.isFinite(day.valueOf())||
    day.toISOString().slice(0,10)!==workDate)
  throw new ApiError(400,"Use a valid YYYY-MM-DD date");
 const sku=clean(body.sku).toUpperCase(),operator=clean(body.operator)||"Unassigned",
 shift=clean(body.shift)||"Unassigned";
 if(!/^[A-Z0-9_\/-]{2,80}$/.test(sku)||operator.length>80||shift.length>80)
  throw new ApiError(400,"Valid SKU, operator and shift required");
 const quantity=Number(body.quantity);
 if(body.quantity==null||body.quantity===""||typeof body.quantity==="boolean"||
   !Number.isSafeInteger(quantity)||quantity<=0||quantity>1000000)
  throw new ApiError(400,"Target must be 1–1,000,000 whole PCS");
 return {date:workDate,sku,operator,shift,quantity};
}
export function ironingOverview(lots=[],bundles=[],events=[],targets=[],issues=[],now=new Date()){
 const lotById=new Map(lots.map(l=>[String(l._id),l])),bundleRows=[],lotsById=new Map();
 const summary={lotCount:0,receivedReadyPcs:0,ironingWipPcs:0,
  ironedReadyForPackingPcs:0,completedEventPcs:0,receivedEventPcs:0,
  openIssueRequests:issues.filter(x=>x.status==="PENDING").length};
 const currentStages=new Set(["GOOD","IRONING","IRONED"]);
 for(const b of bundles){
  const l=lotById.get(String(b.lotId)),qty=pcs(b.qty);
  if(!l||!qty||!currentStages.has(b.stage))continue;
  const ageHours=b.createdAt instanceof Date?Math.max(0,(now-b.createdAt)/3600000):null;
  const row={bundleId:String(b._id),bundleNo:b.code||"",lotId:String(l._id),lotNo:l.code||"",
    dcNo:l.dcNo||"",orderNo:l.orderNo||"",sku:l.sku||"",section:l.section||"",
    stage:b.stage,quantity:qty,ageHours:ageHours===null?null:Math.floor(ageHours),
    readyForPacking:b.stage==="IRONED"};
  bundleRows.push(row);
  const field=b.stage==="GOOD"?"receivedReadyPcs":b.stage==="IRONING"?"ironingWipPcs":"ironedReadyForPackingPcs";
  summary[field]+=qty;
  const lrow=lotsById.get(String(l._id))||{lotId:String(l._id),lotNo:l.code||"",
    dcNo:l.dcNo||"",orderNo:l.orderNo||"",sku:l.sku||"",section:l.section||"",
    receivedReadyPcs:0,ironingWipPcs:0,ironedReadyForPackingPcs:0};
  lrow[field]+=qty;lotsById.set(String(l._id),lrow);
 }
 const history=[],daily=new Map();
 for(const e of events){
  if(e.kind!=="ADVANCE"||e.department!=="IRONING"||e.reversedBy||!lotById.has(String(e.lotId)))continue;
  const l=lotById.get(String(e.lotId)),next=e.details?.bundle?.stage||"",quantity=pcs(e.quantity);
  if(!["IRONING","IRONED"].includes(next))continue;
  const operator=clean(e.details?.operator)||"Unassigned",shift=clean(e.details?.shift)||"Unassigned";
  const eventDate=date(e.createdAt instanceof Date?e.createdAt:new Date(e.createdAt||""));
  history.push({eventId:String(e._id),date:eventDate,createdAt:e.createdAt||null,
   lotNo:l.code||"",dcNo:l.dcNo||"",sku:l.sku||"",section:l.section||"",
   bundleId:e.bundleId||"",quantity,operator,shift,nextStage:next,documentId:e.documentId||""});
  if(next==="IRONING")summary.receivedEventPcs+=quantity;
  if(next==="IRONED"){
   summary.completedEventPcs+=quantity;
   const key=JSON.stringify([eventDate,l.sku,operator,shift]);
   daily.set(key,(daily.get(key)||0)+quantity);
  }
 }
 const targetRows=targets.map(t=>{
  const operator=clean(t.operator)||"Unassigned",shift=clean(t.shift)||"Unassigned",
    key=JSON.stringify([t.date,t.sku,operator,shift]);
  const actualPcs=daily.get(key)||0;
  return {id:String(t._id),date:t.date,sku:t.sku,operator,shift,
   targetPcs:pcs(t.quantity),actualPcs,balancePcs:pcs(t.quantity)-actualPcs,
   achievementPercent:t.quantity?Number((actualPcs/t.quantity*100).toFixed(1)):0};
 });
 summary.lotCount=lotsById.size;
 return {summary,lots:[...lotsById.values()],bundles:bundleRows,history,targets:targetRows,
  issues,notes:{targetDateTimezone:"UTC",eventsMayContainRepeatHandling:true}};
}
