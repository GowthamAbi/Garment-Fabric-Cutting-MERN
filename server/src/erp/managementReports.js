import {fail} from './policy.js';
export function managementReport(lots,bundles,events,skus,targets,now=new Date(),overdueDays=7){
 if(!Number.isInteger(overdueDays)||overdueDays<1||overdueDays>365)fail('Overdue threshold must be 1–365 days');
 const lotMap=new Map(lots.map(l=>[String(l._id),l])),bundleMap=new Map(bundles.map(b=>[String(b._id),b])),skuMap=new Map(skus.map(s=>[s.code,s]));
 const wip=new Map(),output=new Map(),aging=[],checking={good:0,rework:0,oil:0,reject:0,total:0};
 const outputKey=r=>JSON.stringify([r.date,r.sku,r.operation,r.operator,r.shift]);
 for(const b of bundles){
  if(!b.qty)continue;const l=lotMap.get(b.lotId);if(!l)fail('Bundle lot missing');const sku=skuMap.get(l.sku);
  const operation=b.stage.startsWith('OP:')?(l.operations[Number(b.stage.slice(3))]||b.stage):b.stage;
  const key=JSON.stringify([l.sku,operation,l.section]),row=wip.get(key)||{sku:l.sku,item:sku?.name||l.sku,colour:sku?.colour||'',size:sku?.size||'',section:l.section,operation,pieces:0};row.pieces+=b.qty;wip.set(key,row);
  const created=new Date(b.createdAt).getTime();if(!Number.isFinite(created))continue;
  const stageAgeDays=Math.max(0,Math.floor((now-created)/86400000));
  if(stageAgeDays>=overdueDays)aging.push({bundle:b.code,sku:l.sku,section:l.section,stage:b.stage,pieces:b.qty,stageAgeDays});
 }
 for(const e of events){
  if(e.reversedBy)continue;
  if(e.kind==='CHECK'&&e.details?.split){for(const k of ['good','rework','oil','reject'])checking[k]+=e.details.split[k]||0;}
  if(e.kind!=='ADVANCE')continue;const original=bundleMap.get(e.bundleId),lot=lotMap.get(e.lotId||original?.lotId);
  if(!original?.stage?.startsWith('OP:')||!lot)continue;
  const operation=lot.operations[Number(original.stage.slice(3))];if(!operation)continue;
  const row={date:new Date(e.createdAt).toISOString().slice(0,10),sku:lot.sku,operation,operator:e.details?.operator||'Unassigned',shift:e.details?.shift||'Unassigned'};
  const key=outputKey(row),out=output.get(key)||{...row,actual:0,target:0};out.actual+=e.quantity;output.set(key,out);
 }
 for(const t of targets){const row={date:t.date,sku:t.sku,operation:t.operation,operator:t.operator||'Unassigned',shift:t.shift||'Unassigned'},key=outputKey(row),out=output.get(key)||{...row,actual:0,target:0};out.target+=t.quantity;output.set(key,out);}
 checking.total=checking.good+checking.rework+checking.oil+checking.reject;
 return {wip:[...wip.values()],aging:aging.sort((a,b)=>b.stageAgeDays-a.stageAgeDays),output:[...output.values()].map(r=>({...r,variance:r.actual-r.target,achievement:r.target?Math.round(r.actual/r.target*10000)/100:null})),checking:{...checking,percentages:Object.fromEntries(['good','rework','oil','reject'].map(k=>[k,checking.total?Math.round(checking[k]/checking.total*10000)/100:0])),note:'Percentages count inspection attempts, including repeated checking; not first-pass yield.'}};
}
