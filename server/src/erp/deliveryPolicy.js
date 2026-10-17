import ApiError from "../utils/ApiError.js";

const clean = value => String(value ?? "").trim();
const upper = value => clean(value).toUpperCase();

export function validateDeliveryLines(rawLines, actualLines, used=new Map(), planNo="") {
  if (!Array.isArray(rawLines)||!rawLines.length||rawLines.length>250)
    throw new ApiError(400,"Choose 1–250 colour/size rows");
  const merged=new Map();
  for(const raw of rawLines) {
    const colour=upper(raw.colour),size=upper(raw.size),pcs=Number(raw.pcs);
    if(!colour||!size||colour.length>80||size.length>50||
      !Number.isSafeInteger(pcs)||pcs<=0)
      throw new ApiError(400,"Valid colour, size and whole positive PCS are required");
    const k=colour+"|"+size;
    if(merged.has(k))throw new ApiError(400,"Duplicate colour/size rows are not allowed");
    const actual=(actualLines||[]).find(x=>upper(x.colour)===colour&&upper(x.size)===size);
    const previous=used.get(planNo+"|"+k)||0;
    const available=Number(actual?.actualPcs||0)-previous;
    if(!actual||!Number.isSafeInteger(available)||pcs>available)
      throw new ApiError(409,`${colour}/${size}: only ${Math.max(0,available)} PCS available`);
    merged.set(k,{colour,size,pcs});
  }
  return [...merged.values()];
}

export function deliveryStageStatus(plan,actual) {
  const cuttingComplete=Boolean(actual&&actual.status==="COMPLETED");
  const foldingComplete=Boolean(plan?.foldingSavedAt&&(plan.foldingLines||[]).length);
  return {
    cuttingStatus:cuttingComplete?"COMPLETED":actual?"PENDING":"NOT STARTED",
    foldingStatus:foldingComplete?"COMPLETED":"PENDING",
    elasticStatus:plan?.elasticCompletedAt?"COMPLETED":"PENDING",
    eligible:cuttingComplete&&foldingComplete
  };
}

export function deliveryChallanSummary(challans=[],vendors=[],now=new Date()){
  const byVendor=new Map(vendors.map(v=>[upper(v.vendorCode),{
    vendorCode:upper(v.vendorCode),vendorName:v.vendorName,issuedPcs:0,
    handedOverPcs:0,pendingHandoverPcs:0,overduePcs:0,challans:0
  }]));
  let issuedPcs=0,handedOverPcs=0,pendingHandoverPcs=0,overduePcs=0;
  for(const row of challans){
    if(row.status==="CANCELLED")continue;
    const pcs=Number(row.totalPcs||0),handedOver=Boolean(row.handoverAt);
    const late=!handedOver&&row.expectedHandoverAt&&new Date(row.expectedHandoverAt)<now;
    if(!Number.isSafeInteger(pcs)||pcs<0)continue;
    const id=upper(row.vendorCode);
    if(!byVendor.has(id))byVendor.set(id,{vendorCode:id,vendorName:row.vendorName||id,
      issuedPcs:0,handedOverPcs:0,pendingHandoverPcs:0,overduePcs:0,challans:0});
    const v=byVendor.get(id);
    v.issuedPcs+=pcs;issuedPcs+=pcs;v.challans++;
    if(handedOver){v.handedOverPcs+=pcs;handedOverPcs+=pcs;}
    else{v.pendingHandoverPcs+=pcs;pendingHandoverPcs+=pcs;
      if(late){v.overduePcs+=pcs;overduePcs+=pcs;}}
  }
  return {summary:{issuedPcs,handedOverPcs,pendingHandoverPcs,overduePcs,
    activeChallans:challans.filter(x=>x.status!=="CANCELLED").length},
    vendors:[...byVendor.values()].sort((a,b)=>a.vendorCode.localeCompare(b.vendorCode))};
}

export function validateHandover(body={}){
  const reference=upper(body.reference);
  const remarks=clean(body.remarks);
  if(!/^[A-Z0-9_/-]{3,80}$/.test(reference))
    throw new ApiError(400,"Handover reference must be 3–80 letters/numbers");
  if(remarks.length>300)throw new ApiError(400,"Handover remarks max 300 characters");
  return {reference,remarks};
}
