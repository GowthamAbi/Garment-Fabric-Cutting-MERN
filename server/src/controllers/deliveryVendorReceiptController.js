import crypto from "node:crypto";
import DeliveryChallan from "../models/DeliveryChallan.js";
import DeliveryVendor from "../models/DeliveryVendor.js";
import DeliveryVendorReceipt from "../models/DeliveryVendorReceipt.js";
import {currentDatabase} from "../config/tenantDatabase.js";
import {validateVendorReturnLines,vendorReturnSummary} from "../erp/deliveryVendorReturnPolicy.js";
import ApiError from "../utils/ApiError.js";
const upper=v=>String(v??"").trim().toUpperCase();

export async function saveVendorReturn(req,res){
 const challanId=String(req.body.challanId||"").trim();
 if(!/^[a-f0-9]{24}$/i.test(challanId))throw new ApiError(400,"Valid DC ID required");
 const reference=upper(req.body.reference),remarks=String(req.body.remarks||"").trim();
 if(!/^[A-Z0-9_/-]{3,80}$/.test(reference)||remarks.length>300)
  throw new ApiError(400,"Reference 3–80 and remarks at most 300 characters required");
 const key=String(req.get?.("Idempotency-Key")||"").trim();
 if(!/^[A-Za-z0-9_-]{16,100}$/.test(key))
  throw new ApiError(400,"Stable Idempotency-Key (16–100 characters) required");
 await Promise.all([DeliveryChallan.init(),DeliveryVendorReceipt.init()]);
 const session=await currentDatabase().startSession();
 let result,replay=false;
 try{
  await session.withTransaction(async()=>{
   // Explicit write serializes concurrent receipts on the same handed-over DC.
   const dc=await DeliveryChallan.findOneAndUpdate({_id:challanId,status:"ISSUED",handoverAt:{$exists:true}},
    {$inc:{receiptRevision:1}},{new:true,session});
   if(!dc)throw new ApiError(409,"DC must be handed over to vendor first");
   const existing=await DeliveryVendorReceipt.findOne({requestKey:key}).session(session).lean();
   const previous=await DeliveryVendorReceipt.find({challanId}).session(session).lean();
   const used=new Map();
   for(const prev of previous)for(const line of prev.lines||[]){
    const k=upper(line.colour)+"|"+upper(line.size);
    used.set(k,(used.get(k)||0)+Number(line.totalPcs||0));
   }
   const lines=validateVendorReturnLines(req.body.lines,dc.lines,existing?new Map():used);
   const hash=crypto.createHash("sha256").update(JSON.stringify({challanId,reference,remarks,lines})).digest("hex");
   if(existing){
    if(existing.requestHash!==hash)throw new ApiError(409,"Idempotency-Key reused with different return");
    result=existing;replay=true;return;
   }
   const [saved]=await DeliveryVendorReceipt.create([{
    receiptNo:"VR-"+crypto.randomUUID().slice(0,12).toUpperCase(),
    challanId:dc._id,challanNo:dc.challanNo,planNo:dc.planNo,
    vendorCode:dc.vendorCode,vendorName:dc.vendorName,reference,remarks,
    requestKey:key,requestHash:hash,lines,
    totalPcs:lines.reduce((s,x)=>s+x.totalPcs,0),
    createdBy:req.user?.userId||req.user?.email
   }],{session});
   result=saved.toObject();
  });
 }finally{await session.endSession()}
 res.status(replay?200:201).json(result);
}

export async function listVendorReturns(req,res){
 const filter={};
 if(req.query.challanId){
  if(!/^[a-f0-9]{24}$/i.test(req.query.challanId))throw new ApiError(400,"Invalid DC ID");
  filter.challanId=req.query.challanId;
 }
 const page=Math.max(1,Math.min(10000,Number.parseInt(req.query.page,10)||1));
 res.json({page,pageSize:50,rows:await DeliveryVendorReceipt.find(filter).sort({createdAt:-1,_id:-1})
  .skip((page-1)*50).limit(50).lean()});
}
export async function vendorReturnMonitoring(req,res){
 const [challans,receipts,vendors]=await Promise.all([
  DeliveryChallan.find({}).sort({deliveryDate:-1}).limit(5001).lean(),
  DeliveryVendorReceipt.find({}).sort({createdAt:-1}).limit(5001).lean(),
  DeliveryVendor.find({active:true}).limit(1001).lean()
 ]);
 const result=vendorReturnSummary(challans,receipts,vendors);
 const used=new Map();
 for(const rec of receipts){
  const id=String(rec.challanId),map=used.get(id)||new Map();
  for(const line of rec.lines||[]){
   const key=upper(line.colour)+"|"+upper(line.size);
   map.set(key,(map.get(key)||0)+Number(line.totalPcs||0));
  }
  used.set(id,map);
 }
 const pending=challans.filter(dc=>dc.status==="ISSUED"&&dc.handoverAt).map(dc=>({
  id:String(dc._id),challanNo:dc.challanNo,vendorCode:dc.vendorCode,planNo:dc.planNo,
  lines:(dc.lines||[]).map(line=>({colour:line.colour,size:line.size,
   remainingPcs:Math.max(0,Number(line.pcs||0)-Number(used.get(String(dc._id))?.get(upper(line.colour)+"|"+upper(line.size))||0))}))
   .filter(x=>x.remainingPcs>0)
 })).filter(dc=>dc.lines.length).slice(0,500);
 res.json({...result,pending,history:receipts.slice(0,250),
  partialResults:challans.length>=5001||receipts.length>=5001||vendors.length>=1001});
}
