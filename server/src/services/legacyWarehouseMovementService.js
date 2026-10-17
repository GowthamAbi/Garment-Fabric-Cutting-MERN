import crypto from "node:crypto";
import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import {currentDatabase} from "../config/tenantDatabase.js";
import WarehouseStock from "../models/WarehouseStock.js";
import LegacyWarehouseMovement from "../models/LegacyWarehouseMovement.js";
import {generateReferenceNo} from "../utils/generateReferenceNo.js";
const str=v=>String(v??"").trim();
const upper=v=>str(v).toUpperCase();
export function validateLegacyWarehouseMovement(body={},mode){
 const qty=Number(body.quantity);
 if(body.quantity==null||body.quantity===""||typeof body.quantity==="boolean"||
  !Number.isSafeInteger(qty)||qty<1||qty>1000000)
  throw new ApiError(400,"Quantity must be 1–1,000,000 whole pieces");
 if(mode==="REWORK"){
  const action=str(body.action).toLowerCase();
  if(!["complete","convert","reject"].includes(action))throw new ApiError(400,"Choose valid rework action");
  const itemName=str(body.itemName),colour=upper(body.colour),size=upper(body.size);
  if(action==="convert"&&(!itemName||!colour||!size))throw new ApiError(400,"Converted item/colour/size required");
  if(action==="reject"&&str(body.reason).length<3)throw new ApiError(400,"Rejection requires reason");
  return {qty,action,itemName,colour,size,reason:str(body.reason).slice(0,300)};
 }
 if(mode!=="DELIVER")throw new ApiError(400,"Unknown stock movement type");
 const sectionCode=upper(body.sectionCode);
 if(!/^[A-Z0-9_-]{2,60}$/.test(sectionCode))throw new ApiError(400,"Valid section QR required");
 return {qty,action:"section-delivery",sectionCode};
}
export async function moveLegacyWarehouse({sourceId,mode,body,key,actor}){
 if(!mongoose.isValidObjectId(sourceId))throw new ApiError(400,"Valid stock record required");
 if(!/^[A-Za-z0-9_-]{16,100}$/.test(String(key||"")))
  throw new ApiError(400,"Stable 16–100 character idempotency key required");
 if(!actor)throw new ApiError(403,"Authenticated user required");
 const values=validateLegacyWarehouseMovement(body,mode);
 const hash=crypto.createHash("sha256").update(JSON.stringify({sourceId,mode,...values})).digest("hex");
 await Promise.all([WarehouseStock.init(),LegacyWarehouseMovement.init()]);
 const session=await currentDatabase().startSession();
 let result;
 try{
  await session.withTransaction(async()=>{
   const old=await LegacyWarehouseMovement.findOne({key}).session(session).lean();
   if(old){
    if(old.requestHash!==hash)throw new ApiError(409,"Movement key reused with different data");
    if(old.actorUserId!==actor)throw new ApiError(403,"Retry belongs to another operator");
    const [source,destination]=await Promise.all([
     WarehouseStock.findById(old.sourceId).session(session),
     WarehouseStock.findById(old.destinationId).session(session)]);
    if(!source||!destination)throw new ApiError(409,"Stock receipt missing; reconcile");
    result={source,destination,replayed:true,movementId:String(old._id)};
    return;
   }
   const expected=mode==="REWORK"?"REWORK":"PRODUCTION_READY";
   const source=await WarehouseStock.findOne({_id:sourceId,warehouseType:expected}).session(session).lean();
   if(!source)throw new ApiError(404,"Source stock unavailable");
   if(!Number.isSafeInteger(source.balanceQty)||source.balanceQty<values.qty)
    throw new ApiError(409,"Insufficient source pieces");
   const type=mode==="DELIVER"?"SECTION_DELIVERY":
    values.action==="reject"?"REJECTION":"PRODUCTION_READY";
   const target={
    itemName:values.action==="convert"?values.itemName:source.itemName,
    colour:values.action==="convert"?values.colour:source.colour,
    size:values.action==="convert"?values.size:source.size};
   if(!target.itemName||!target.colour||!target.size)throw new ApiError(400,"Target item/colour/size required");
   const history={action:values.action,quantity:values.qty,fromType:expected,
    toType:type,...target,reason:values.reason||"",sectionCode:values.sectionCode||"",user:actor};
   const updated=await WarehouseStock.findOneAndUpdate(
    {_id:sourceId,warehouseType:expected,balanceQty:{$gte:values.qty}},
    {$inc:{balanceQty:-values.qty},$push:{history}},
    {new:true,session,runValidators:true});
   if(!updated)throw new ApiError(409,"Stock changed concurrently; refresh");
   const [dest]=await WarehouseStock.create([{
    referenceNo:generateReferenceNo(type==="REJECTION"?"REJ":type==="SECTION_DELIVERY"?"SEC":"RDY"),
    warehouseType:type,jobNo:source.jobNo,dcNo:source.dcNo,
    outwardNo:source.outwardNo,itemCode:source.itemCode,
    ...target,originalQty:values.qty,balanceQty:values.qty,
    sectionCode:values.sectionCode||"",reason:values.reason||"",
    createdBy:actor,history:[history]
   }],{session});
   const [movement]=await LegacyWarehouseMovement.create([{
    key,requestHash:hash,actorUserId:actor,mode,sourceId:source._id,
    destinationId:dest._id,quantity:values.qty
   }],{session});
   result={source:updated,destination:dest,replayed:false,movementId:String(movement._id)};
  });
  return result;
 }finally{await session.endSession();}
}
