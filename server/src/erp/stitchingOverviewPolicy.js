// Read-only production analytics built from existing tenant-scoped ERP lot,
// bundle, target and event models. These calculations never post inventory.
const pcs=value=>Number.isSafeInteger(Number(value))&&Number(value)>=0?Number(value):0;
const stage=value=>String(value||"");
const text=value=>String(value||"").trim();
export function stitchingOverview(lots=[],bundles=[],masters=[],targets=[],events=[]){
 const lotById=new Map(lots.map(l=>[String(l._id),l]));
 const bundleByLot=new Map();
 for(const b of bundles){
   const id=String(b.lotId);
   if(!bundleByLot.has(id))bundleByLot.set(id,[]);
   bundleByLot.get(id).push(b);
 }
 const stageCounts={READY:0,OPERATION:0,STITCHED:0,REWORK:0,HANDOFF:0};
 let sentPcs=0,receivedPcs=0;
 const plans=lots.map(l=>{
   const child=bundleByLot.get(String(l._id))||[];
   const ready=child.filter(b=>stage(b.stage)==="STITCHING_READY").reduce((sum,b)=>sum+pcs(b.qty),0);
   const inOperation=child.filter(b=>stage(b.stage).startsWith("OP:")).reduce((sum,b)=>sum+pcs(b.qty),0);
   const stitched=child.filter(b=>stage(b.stage)==="STITCHED").reduce((sum,b)=>sum+pcs(b.qty),0);
   const rework=child.filter(b=>stage(b.stage)==="REWORK").reduce((sum,b)=>sum+pcs(b.qty),0);
   const handover=pcs(l.received);
   stageCounts.READY+=ready;stageCounts.OPERATION+=inOperation;
   stageCounts.STITCHED+=stitched;stageCounts.REWORK+=rework;stageCounts.HANDOFF+=handover;
   sentPcs+=pcs(l.sent);receivedPcs+=handover;
   return {lotId:String(l._id),lotNo:l.code,sku:l.sku,orderNo:l.orderNo||"",dcNo:l.dcNo||"",
     section:l.section||"",sentPcs:pcs(l.sent),readyPcs:ready,operationPcs:inOperation,
     stitchedPcs:stitched,handedOverPcs:handover,reworkPcs:rework,
     pendingPcs:Math.max(0,pcs(l.sent)-stitched-handover),
     completionPercent:l.sent?Number((Math.min(100,(stitched+handover)/l.sent*100)).toFixed(1)):0,
     status:l.status||"ACTIVE",operations:l.operations||[]};
 });
 const operationCounts=new Map();
 for(const e of events.filter(e=>e.kind==="ADVANCE"&&e.department==="STITCHING"&&!e.reversedBy)){
   const lot=lotById.get(String(e.lotId));
   const next=stage(e.details?.bundle?.stage);
   const ops=lot?.operations||[];
   const finished=next==="STITCHED"?ops.at(-1):next.startsWith("OP:")?ops[Number(next.slice(3))-1]:undefined;
   if(!finished)continue;
   const key=String(lot.sku)+"|"+finished;
   operationCounts.set(key,(operationCounts.get(key)||0)+pcs(e.quantity));
 }
 const operations=masters.filter(m=>m.kind==="STITCHING").flatMap(m=>
   (m.operations||[]).map((op,index)=>({sku:m.sku,masterKey:m.key,operation:op,
     sequence:index+1,completedEventPcs:operationCounts.get(String(m.sku)+"|"+op)||0})));
 const targetRows=targets.map(t=>({date:t.date,sku:t.sku,operation:t.operation,
   operator:t.operator,shift:t.shift,targetPcs:pcs(t.quantity)}));
 const defects=events.filter(e=>!e.reversedBy&&
   (e.kind==="CHECK"||stage(e.details?.bundle?.stage)==="REWORK"))
   .map(e=>({date:e.createdAt,lotId:e.lotId,kind:e.kind,quantity:pcs(e.quantity),
     reason:text(e.details?.defect),department:e.department}));
 return {
   summary:{lots:lots.length,sentPcs,handedOverPcs:receivedPcs,
     stitchedReadyPcs:stageCounts.STITCHED,inOperationPcs:stageCounts.OPERATION,
     pendingPcs:plans.reduce((n,p)=>n+p.pendingPcs,0),reworkPcs:stageCounts.REWORK,
     activeTargets:targetRows.length},
   plans,stageCounts,operations,targets:targetRows,defects,
 };
}
