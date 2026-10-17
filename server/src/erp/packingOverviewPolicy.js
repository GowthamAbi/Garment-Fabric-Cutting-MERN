// Packing reports aggregate existing ERP stock, masters and posted journal events.
// Plan/repacking requests are NON-STOCK records; only /pack posts material consumption.
import ApiError from "../utils/ApiError.js";
import {packingRequirements} from "./departmentPolicy.js";
const num=x=>Number.isSafeInteger(x)&&x>=0?x:0;
const norm=x=>String(x??"").trim();
const iso=x=>x instanceof Date&&!Number.isNaN(x.valueOf())?x.toISOString().slice(0,10):"";
export const PACKING_ISSUE_TYPES=Object.freeze(["DAMAGED_CARTON","WRONG_ASSORTMENT","REPACK","SHORT_PACK","OTHER"]);
export function validatePackingPlan(body={}){
 const date=norm(body.date),dt=new Date(date);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(dt.valueOf())||
    dt.toISOString().slice(0,10)!==date)throw new ApiError(400,"Valid planning date (YYYY-MM-DD) required");
 const sku=norm(body.sku).toUpperCase(),dcNo=norm(body.dcNo).toUpperCase(),
  quantity=Number(body.quantity),notes=norm(body.notes);
 if(!/^[A-Z0-9_./-]{2,80}$/.test(sku))throw new ApiError(400,"Valid finished SKU required");
 if(dcNo.length>100||notes.length>300)throw new ApiError(400,"Invalid DC/notes length");
 if(body.quantity==null||body.quantity===""||typeof body.quantity==="boolean"||
   !Number.isSafeInteger(quantity)||quantity<1||quantity>1000000)
  throw new ApiError(400,"Plan must use 1–1,000,000 whole PCS");
 return {date,sku,dcNo,quantity,notes};
}
export function validatePackingIssue(body={},bundle={}){
 if(bundle.stage!=="PACKED"||!num(bundle.qty))
  throw new ApiError(409,"Only active packed cartons can request repacking review");
 const category=norm(body.category).toUpperCase(),quantity=Number(body.quantity),reason=norm(body.reason);
 if(!PACKING_ISSUE_TYPES.includes(category))throw new ApiError(400,"Unknown carton issue category");
 if(body.quantity==null||body.quantity===""||typeof body.quantity==="boolean"||
   !Number.isSafeInteger(quantity)||quantity<1||quantity>num(bundle.qty))
  throw new ApiError(400,"Reported pieces must be within existing carton balance");
 if(reason.length<8||reason.length>300)throw new ApiError(400,"Describe issue in 8–300 characters");
 return {category,quantity,reason,expectedPcs:bundle.qty,stage:"PACKED"};
}
function masterMaterials(master,balanceMap,forPcs){
 if(!master?.materials?.length||!Number.isSafeInteger(forPcs)||forPcs<1)return [];
 let requirements;
 try{requirements=packingRequirements(master.materials,forPcs);}catch{return [];}
 return requirements.map(m=>{
  const availableScaled=num(balanceMap.get(m.sku)),neededScaled=num(m.qty);
  return {sku:m.sku,requiredQty:neededScaled/1000,availableQty:availableScaled/1000,
   shortageQty:Math.max(0,neededScaled-availableScaled)/1000,sufficient:availableScaled>=neededScaled};
 });
}
export function packingOverview(lots=[],bundles=[],events=[],masters=[],plans=[],issues=[],balances=[],skus=[]){
 const byLot=new Map(lots.map(l=>[String(l._id),l])),
  bySku=new Map(skus.map(s=>[s.code,s])),byMaster=new Map();
 for(const m of masters.filter(m=>m.kind==="PACKING"&&m.active!==false)){
  if(!byMaster.has(m.sku))byMaster.set(m.sku,[]);
  byMaster.get(m.sku).push(m);
 }
 const balanceMap=new Map(balances.filter(b=>b.location==="ACCESSORIES").map(b=>[b.sku,num(b.qty)]));
 const summary={lotCount:0,readyToPackPcs:0,packedAwaitingDispatchPcs:0,
  packedEventPcs:0,activeCartons:0,openIssueRequests:issues.filter(x=>x.status==="PENDING").length,
  plannedPcs:plans.reduce((s,p)=>s+num(p.quantity),0)};
 const lotsMap=new Map(),bundleRows=[];
 for(const b of bundles){
  const l=byLot.get(String(b.lotId)),quantity=num(b.qty);
  if(!l||!quantity||!["IRONED","PACKED"].includes(b.stage))continue;
  const sku=bySku.get(l.sku)||{},master=byMaster.get(l.sku)?.[0],
   materials=b.stage==="IRONED"?masterMaterials(master,balanceMap,quantity):[];
  const info={bundleId:String(b._id),bundleNo:b.code||"",
   lotId:String(l._id),lotNo:l.code||"",dcNo:l.dcNo||"",orderNo:l.orderNo||"",
   sku:l.sku||"",colour:sku.colour||"",size:sku.size||"",section:l.section||"",
   stage:b.stage,quantity,packingMasterKey:master?.key||"",
   materials,materialReady:!!master&&materials.length>0&&materials.every(m=>m.sufficient),
   parentBundleId:b.parentId||""};
  bundleRows.push(info);
  if(b.stage==="IRONED")summary.readyToPackPcs+=quantity;
  if(b.stage==="PACKED"){summary.packedAwaitingDispatchPcs+=quantity;summary.activeCartons++;}
  const row=lotsMap.get(String(l._id))||{lotId:String(l._id),lotNo:l.code||"",dcNo:l.dcNo||"",
   orderNo:l.orderNo||"",sku:l.sku||"",colour:sku.colour||"",size:sku.size||"",
   section:l.section||"",readyToPackPcs:0,packedAwaitingDispatchPcs:0};
  row[b.stage==="IRONED"?"readyToPackPcs":"packedAwaitingDispatchPcs"]+=quantity;
  lotsMap.set(String(l._id),row);
 }
 summary.lotCount=lotsMap.size;
 const history=[],daily=new Map(),materialConsumption=new Map();
 for(const e of events){
  if(e.kind!=="PACK"||e.department!=="PACKING"||e.reversedBy||!byLot.has(String(e.lotId)))continue;
  const l=byLot.get(String(e.lotId)),q=num(e.quantity),date=iso(e.createdAt instanceof Date?e.createdAt:new Date(e.createdAt||""));
  summary.packedEventPcs+=q;
  const row={id:String(e._id),date,createdAt:e.createdAt||null,dcNo:l.dcNo||"",lotNo:l.code||"",
   sku:l.sku||"",section:l.section||"",quantity:q,cartonNo:e.details?.carton?.code||"",
   cartonId:e.details?.carton?._id||"",documentId:e.documentId||"",
   materials:(e.details?.requirements||[]).map(r=>({sku:r.sku,quantity:num(r.qty)/1000}))};
  history.push(row);
  for(const m of row.materials)materialConsumption.set(m.sku,(materialConsumption.get(m.sku)||0)+m.quantity);
  const key=JSON.stringify([date,l.sku,l.dcNo||""]),allKey=JSON.stringify([date,l.sku,""]);
  daily.set(key,(daily.get(key)||0)+q);
  if(key!==allKey)daily.set(allKey,(daily.get(allKey)||0)+q);
 }
 const planRows=plans.map(p=>{
  const actualPcs=daily.get(JSON.stringify([p.date,p.sku,p.dcNo||""]))||0,
   master=byMaster.get(p.sku)?.[0];
  return {id:String(p._id),date:p.date,sku:p.sku,dcNo:p.dcNo||"",
   targetPcs:num(p.quantity),actualPcs,balancePcs:num(p.quantity)-actualPcs,
   achievementPercent:p.quantity?Number((actualPcs/p.quantity*100).toFixed(1)):0,
   notes:p.notes||"",packingMasterKey:master?.key||"",
   materialRequirements:masterMaterials(master,balanceMap,num(p.quantity))};
 });
 return {summary,lots:[...lotsMap.values()],bundles:bundleRows,plans:planRows,history,
  masters:masters.filter(x=>x.kind==="PACKING").map(m=>({key:m.key,sku:m.sku,name:m.name,
   active:m.active!==false,materials:m.materials||[]})),
  materialConsumption:[...materialConsumption].map(([sku,quantity])=>({sku,quantity})),
  issues,notes:{productionDate:"UTC",packedEventPcsMayIncludeRepacking:true}};
}
