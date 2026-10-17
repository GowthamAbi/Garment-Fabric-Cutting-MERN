import ApiError from "../utils/ApiError.js";
const upper=v=>String(v??"").trim().toUpperCase();
export function assertDeliveryRole(user,method="GET"){
 if(!user)throw new ApiError(401,"Login required");
 if(["department_incharge","department_entry"].includes(user.role)){
  if(upper(user.department)!=="DELIVERY")throw new ApiError(403,"DELIVERY department access required");
  if(user.role==="department_incharge"&&method!=="GET")
   throw new ApiError(403,"Delivery Head has read-only operational access");
 }
}
export function validateVendorReturnLines(raw,dcLines,already=new Map()){
 if(!Array.isArray(raw)||raw.length<1||raw.length>250)throw new ApiError(400,"Choose 1–250 return lines");
 const seen=new Set();
 return raw.map(x=>{
  const colour=upper(x.colour),size=upper(x.size),key=colour+"|"+size;
  if(!colour||!size||seen.has(key))throw new ApiError(400,"Unique colour/size required");
  seen.add(key);
  const goodPcs=Number(x.goodPcs??0),reworkPcs=Number(x.reworkPcs??0),rejectedPcs=Number(x.rejectedPcs??0);
  if(![goodPcs,reworkPcs,rejectedPcs].every(n=>Number.isSafeInteger(n)&&n>=0))
   throw new ApiError(400,"Return quantities must be nonnegative whole PCS");
  const totalPcs=goodPcs+reworkPcs+rejectedPcs;
  if(!Number.isSafeInteger(totalPcs)||totalPcs<1)throw new ApiError(400,"Return total must be positive whole PCS");
  const sent=(dcLines||[]).find(y=>upper(y.colour)===colour&&upper(y.size)===size);
  const remaining=Number(sent?.pcs||0)-Number(already.get(key)||0);
  if(!sent||!Number.isSafeInteger(remaining)||totalPcs>remaining)
   throw new ApiError(409,`${key} has only ${Math.max(0,remaining)} pending PCS`);
  return {colour,size,goodPcs,reworkPcs,rejectedPcs,totalPcs};
 }).sort((a,b)=>(a.colour+"|"+a.size).localeCompare(b.colour+"|"+b.size));
}
export function vendorReturnSummary(challans=[],receipts=[],vendors=[]){
 const rows=new Map();
 const ensure=(code,name)=>{
  const key=upper(code);
  if(!rows.has(key))rows.set(key,{vendorCode:key,vendorName:name||key,
   sentToVendorPcs:0,returnedPcs:0,goodPcs:0,reworkPcs:0,rejectedPcs:0,pendingStitchingPcs:0});
  return rows.get(key);
 };
 vendors.forEach(v=>ensure(v.vendorCode,v.vendorName));
 const sent=new Map();
 for(const dc of challans){
  if(dc.status==="CANCELLED"||!dc.handoverAt)continue;
  sent.set(String(dc._id),dc);
  ensure(dc.vendorCode,dc.vendorName).sentToVendorPcs+=Number(dc.totalPcs||0);
 }
 for(const receipt of receipts){
  const dc=sent.get(String(receipt.challanId));
  if(!dc)continue;
  const row=ensure(dc.vendorCode,dc.vendorName);
  for(const line of receipt.lines||[]){
   row.returnedPcs+=Number(line.totalPcs||0);
   row.goodPcs+=Number(line.goodPcs||0);
   row.reworkPcs+=Number(line.reworkPcs||0);
   row.rejectedPcs+=Number(line.rejectedPcs||0);
  }
 }
 const summary={sentToVendorPcs:0,returnedPcs:0,goodPcs:0,reworkPcs:0,rejectedPcs:0,pendingStitchingPcs:0};
 for(const row of rows.values()){
  row.pendingStitchingPcs=Math.max(0,row.sentToVendorPcs-row.returnedPcs);
  Object.keys(summary).forEach(k=>summary[k]+=row[k]);
 }
 return {summary,vendors:[...rows.values()]};
}
