import ApiError from "../utils/ApiError.js";
const upper=value=>String(value||"").trim().toUpperCase();
export function elasticCode(value,label="Code"){
 const code=upper(value);
 if(!/^[A-Z0-9_/-]{2,75}$/.test(code))throw new ApiError(400,`Invalid ${label}`);
 return code;
}
export function elasticQuantity(value,{allowZero=false}={}){
 if(value==null||value===""||typeof value==="boolean")throw new ApiError(400,"Elastic MTR quantity is required");
 const n=Number(value);
 if(!Number.isFinite(n)||n<0||(!allowZero&&n===0)||n>1000000||
   Math.abs(n*1000-Math.round(n*1000))>0.000001)
   throw new ApiError(400,"Elastic quantity must be positive MTR (up to 3 decimals)");
 return n;
}
export function elasticMaterialInput(body={}){
 const code=elasticCode(body.code,"Elastic SKU"),name=String(body.name||"").trim();
 if(!name||name.length>120)throw new ApiError(400,"Elastic Material Name required, max 120");
 return {code,name,kind:"RAW",unit:"MTR",location:"ELASTIC",
   minimumQty:elasticQuantity(body.minimumQty??0,{allowZero:true}),active:true};
}
export function elasticMovementInput(body={}){
 const sku=elasticCode(body.sku,"Elastic SKU"),reference=elasticCode(body.reference,"Reference");
 const quantity=elasticQuantity(body.quantity);
 const action=upper(body.action);
 if(!["ISSUE","RETURN"].includes(action))throw new ApiError(400,"Select Issue or Return");
 return {sku,reference,quantity,action};
}
export function elasticReceiptInput(body={}){
 const sku=elasticCode(body.sku,"Elastic SKU"),quantity=elasticQuantity(body.quantity);
 return {sku,quantity};
}
export function elasticRequirementLines(actual,item){
 if(!actual||actual.status!=="COMPLETED")throw new ApiError(409,"Completed Fabric Cutting Actual required");
 if(!item||item.status!=="APPROVED")throw new ApiError(409,"Approved Garment Item Master required");
 if(!Array.isArray(actual.lines)||!actual.lines.length)throw new ApiError(409,"No Cutting actual size lines");
 const lines=actual.lines.map(line=>{
   const size=upper(line.size),colour=upper(line.colour);
   const master=item.sizes?.find(x=>upper(x.size)===size);
   const pcs=Number(line.actualPcs),mtr=Number(master?.elasticMeasurementMtr);
   if(!colour||!size||!Number.isSafeInteger(pcs)||pcs<0||!Number.isFinite(mtr)||mtr<=0)
     throw new ApiError(409,`Missing elastic measurement or PCS for size ${size}`);
   const wantedMtr=Number((pcs*mtr).toFixed(3));
   elasticQuantity(wantedMtr,{allowZero:true});
   return {colour,size,actualPcs:pcs,measurementMtr:mtr,wantedMtr};
 });
 const totalMtr=Number(lines.reduce((n,x)=>n+x.wantedMtr,0).toFixed(3));
 if(totalMtr<=0)throw new ApiError(409,"Elastic plan requires positive Cutting output");
 return {lines,totalMtr,totalPcs:lines.reduce((n,x)=>n+x.actualPcs,0)};
}
export function elasticStockRows(skus=[],balances=[]){
 const totals=new Map();
 for(const b of balances)if(b.location==="ELASTIC")totals.set(b.sku,(totals.get(b.sku)||0)+Number(b.qty||0)/1000);
 return skus.map(s=>{
   const available=Number((totals.get(s.code)||0).toFixed(3)),minimum=Number(s.minimumQty||0);
   return {code:s.code,name:s.name,unit:s.unit,available,minimum,
     shortage:Number(Math.max(0,minimum-available).toFixed(3)),lowStock:available<minimum};
 });
}
export function elasticCutNote(kind,planNo,reference,colour="",size=""){
 const base=`ELASTIC|${kind}|${elasticCode(planNo,"Plan No")}|${elasticCode(reference,"Reference")}`;
 return colour&&size?base+`|${elasticLineCode(colour)}|${elasticLineCode(size)}`:base;
}
export function elasticLineCode(value){
 const val=upper(value);
 if(!/^[A-Z0-9 _/-]{1,40}$/.test(val))throw new ApiError(400,"Invalid Elastic colour / size");
 return val;
}
export function elasticMovementTag(notes){
 const p=String(notes||"").split("|");
 return p.length>=4&&p[0]==="ELASTIC"&&["CUT","RETURN"].includes(p[1])
  ?{kind:p[1],planNo:p[2],reference:p[3],...(p.length>=6?{colour:p[4],size:p[5]}:{})}:null;
}
export function elasticPlanProgress(plans=[],documents=[]){
 return plans.map(plan=>{
   const transactions=documents.filter(d=>!d.reversedBy&&elasticMovementTag(d.notes)?.planNo===plan.planNo
       &&(d.type==="STOCK_TRANSFER"));
   const cutMtr=Number((transactions.reduce((n,d)=>n+(elasticMovementTag(d.notes)?.kind==="CUT"?1:-1)*
      (d.lines||[]).filter(l=>l.sku===plan.sku).reduce((v,l)=>v+Number(l.qty||0)/1000,0),0)).toFixed(3));
   const pendingMtr=Number(Math.max(0,plan.targetMtr-cutMtr).toFixed(3));
   return {...plan,cutMtr,pendingMtr,completionPercent:plan.targetMtr
    ?Number(Math.min(100,Math.max(0,cutMtr/plan.targetMtr*100)).toFixed(1)):0};
 });
}

export function elasticSizeProgress(plan,documents=[]){
 return (plan.lines||[]).map(line=>{
  const cutMtr=Number(documents.filter(d=>{
    const tag=elasticMovementTag(d.notes);
    return !d.reversedBy&&tag?.planNo===plan.planNo&&tag.colour===line.colour&&tag.size===line.size;
  }).reduce((sum,d)=>sum+(elasticMovementTag(d.notes)?.kind==="CUT"?1:-1)*
    (d.lines||[]).filter(x=>x.sku===plan.sku).reduce((n,x)=>n+Number(x.qty||0)/1000,0),0).toFixed(3));
  return {...line,cutMtr,pendingMtr:Number(Math.max(0,line.wantedMtr-cutMtr).toFixed(3))};
 });
}
