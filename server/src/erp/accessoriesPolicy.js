import ApiError from "../utils/ApiError.js";

const upper = value => String(value || "").trim().toUpperCase();
const safeCode = (value,label) => {
  const code=upper(value);
  if(!/^[A-Z0-9_/-]{2,75}$/.test(code))throw new ApiError(400,`Invalid ${label}`);
  return code;
};
const quantity = value => {
  if(value==="" || value==null || typeof value==="boolean")throw new ApiError(400,"Quantity is required");
  const n=Number(value);
  if(!Number.isFinite(n)||n<=0||n>1000000||Math.abs(n*1000-Math.round(n*1000))>0.000001)
    throw new ApiError(400,"Quantity must be positive with at most three decimals");
  return n;
};
export const ACCESSORY_STAGES=Object.freeze(["BEFORE_SEWING","AFTER_SEWING"]);
export const ACCESSORY_ACTIONS=Object.freeze(["ISSUE","RETURN"]);
export function validateAccessoryMovement(body={},action="ISSUE"){
  if(!ACCESSORY_ACTIONS.includes(action))throw new ApiError(400,"Invalid Accessories movement");
  const stage=upper(body.stage);
  if(!ACCESSORY_STAGES.includes(stage))throw new ApiError(400,"Select Before or After Sewing stage");
  const sourceId=String(body.workOrderId||"").trim();
  if(!/^[0-9a-fA-F]{24}$/.test(sourceId))throw new ApiError(400,"Choose a valid Work Order");
  const sku=safeCode(body.sku,"Accessories SKU");
  const reference=safeCode(body.reference,"Issue / Return reference");
  const qty=quantity(body.quantity);
  const remarks=String(body.remarks||"").trim();
  if(remarks.length>250)throw new ApiError(400,"Remarks maximum 250 characters");
  return {stage,sourceId,sku,reference,quantity:qty,remarks};
}
export function validateAccessorySku(body={}){
  const code=safeCode(body.code,"SKU Code"),name=String(body.name||"").trim();
  const unit=upper(body.unit||"PCS"),kind=upper(body.kind||"CONSUMABLE");
  const minimumQty=body.minimumQty==null||body.minimumQty===""?0:Number(body.minimumQty);
  if(!name||name.length>120)throw new ApiError(400,"Accessories Name is required (maximum 120)");
  if(!/^[A-Z]{1,12}$/.test(unit))throw new ApiError(400,"Invalid stock unit");
  if(!["CONSUMABLE","RAW"].includes(kind))throw new ApiError(400,"Accessories must be Consumable or Raw");
  if(!Number.isFinite(minimumQty)||minimumQty<0||minimumQty>1000000||Math.abs(minimumQty*1000-Math.round(minimumQty*1000))>0.000001)
    throw new ApiError(400,"Invalid minimum stock level");
  return {code,name,kind,unit,minimumQty,location:"ACCESSORIES",active:body.active!==false};
}
export function accessoryStockRows(skus=[],balances=[]){
  const stock=new Map();
  for(const b of balances)if(b.location==="ACCESSORIES")stock.set(upper(b.sku),(stock.get(upper(b.sku))||0)+Number(b.qty||0)/1000);
  return skus.map(s=>{
    const available=Number((stock.get(upper(s.code))||0).toFixed(3)), minimum=Number(s.minimumQty||0);
    return {code:s.code,name:s.name,unit:s.unit,kind:s.kind,minimumQty:minimum,
      available,shortage:Number(Math.max(0,minimum-available).toFixed(3)),
      lowStock:available<minimum,active:s.active!==false};
  });
}
export function accessoriesMovementNote(action,data){
  return `ACCESSORIES|${action}|${data.stage}|${data.reference}${data.remarks?" | "+data.remarks:""}`;
}
export function accessoryStageFromNote(notes){
  const parts=String(notes||"").split("|");
  return parts[0]==="ACCESSORIES"&&ACCESSORY_ACTIONS.includes(parts[1])&&ACCESSORY_STAGES.includes(parts[2])
    ?{action:parts[1],stage:parts[2],reference:parts[3]||""}:null;
}
export function validateAccessoryPurchase(body={}){
  const partyCode=safeCode(body.partyCode,"Supplier"),sku=safeCode(body.sku,"Accessories SKU");
  const count=quantity(body.quantity),rate=Number(body.rate);
  if(!Number.isFinite(rate)||rate<0||rate>10000000||Math.abs(rate*100-Math.round(rate*100))>0.000001)
    throw new ApiError(400,"Rate must be non-negative with at most two decimals");
  return {partyCode,sku,quantity:count,rate};
}
export function validateAccessoryAdjustment(body={}){
  const sku=safeCode(body.sku,"Accessories SKU");
  const counted=body.countedQty==null||body.countedQty===""?NaN:Number(body.countedQty);
  const reason=String(body.reason||"").trim();
  if(!Number.isFinite(counted)||counted<0||counted>1000000||Math.abs(counted*1000-Math.round(counted*1000))>0.000001)
    throw new ApiError(400,"Invalid physical count");
  if(reason.length<5||reason.length>300)throw new ApiError(400,"Adjustment reason must be 5–300 characters");
  return {sku,countedQty:counted,reason};
}

export function accessoryOrderRequirements(workOrders=[],documents=[],stock=[]) {
  const stockBySku=new Map(stock.map(row=>[String(row.code).toUpperCase(),Number(row.available||0)]));
  const result=[];
  for(const order of workOrders) {
    if(order.reversedBy||order.cancelledAt)continue;
    const bom=order.metadata?.bom, output=Number(bom?.outputQty),workQty=Number(order.lines?.[0]?.qty);
    if(!Number.isSafeInteger(output)||output<=0||!Number.isSafeInteger(workQty)||workQty<=0)continue;
    for(const part of bom.components||[]){
      const sku=String(part.sku||"").toUpperCase(),componentQty=Number(part.qty);
      if(!stockBySku.has(sku)||!Number.isSafeInteger(componentQty)||componentQty<0)continue;
      const requiredScaled=Number((BigInt(componentQty)*BigInt(workQty)+BigInt(output)-1n)/BigInt(output));
      if(!Number.isSafeInteger(requiredScaled))continue;
      const netIssued=documents.filter(doc=>!doc.reversedBy&&String(doc.sourceId)===String(order._id)&&
        ["MATERIAL_ISSUE","MATERIAL_RETURN"].includes(doc.type))
        .reduce((sum,doc)=>sum+(doc.type==="MATERIAL_ISSUE"?1:-1)*
          (doc.lines||[]).filter(line=>line.sku===sku&&line.location==="ACCESSORIES")
            .reduce((v,line)=>v+Number(line.qty||0),0),0);
      const requiredQty=Number((requiredScaled/1000).toFixed(3)),
        issuedQty=Number((netIssued/1000).toFixed(3)),
        pendingQty=Number((Math.max(0,requiredScaled-netIssued)/1000).toFixed(3)),
        availableQty=Number(stockBySku.get(sku)||0);
      result.push({workOrderId:String(order._id),workOrderNo:order.number,sku,
        requiredQty,issuedQty,pendingQty,availableQty,
        shortageQty:Number(Math.max(0,pendingQty-availableQty).toFixed(3))});
    }
  }
  return result;
}
