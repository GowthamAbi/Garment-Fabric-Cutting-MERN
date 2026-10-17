import {Router} from "express";
import mongoose from "mongoose";
import crypto from "node:crypto";
import {asyncHandler} from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import {workspaceFilter,postDocument} from "./service.js";
import {allowedDepartment,enabledDepartment} from "./departmentPolicy.js";
import {ErpBalance,ErpDocument,ErpParty,ErpSku} from "./models.js";
import AccessoriesAdjustmentRequest from "../models/AccessoriesAdjustmentRequest.js";
import {ACCESSORY_ACTIONS,ACCESSORY_STAGES,accessoryOrderRequirements,accessoryStockRows,accessoriesMovementNote,
  accessoryStageFromNote,validateAccessoryAdjustment,validateAccessoryMovement,
  validateAccessoryPurchase,validateAccessorySku} from "./accessoriesPolicy.js";

const router=Router();
const clean=value=>String(value||"").trim();
const upper=value=>clean(value).toUpperCase();
const code=value=>/^[A-Z0-9_/-]{2,75}$/.test(upper(value))?upper(value):"";
function authorize(req,write=false){
  if(!allowedDepartment(req.user,"ACCESSORIES",write)||!enabledDepartment(req.departmentCompany,"ACCESSORIES"))
    throw new ApiError(403,"Accessories department permission and subscription required");
}
function idempotency(req){
  const key=clean(req.get("Idempotency-Key"));
  if(!/^[A-Za-z0-9_-]{16,100}$/.test(key))throw new ApiError(400,"Idempotency-Key header is required (16-100 characters)");
  return key;
}
function documentView(doc){
  const tags=accessoryStageFromNote(doc.notes);
  return {id:String(doc._id),number:doc.number,type:doc.type,status:doc.status,
    sourceId:doc.sourceId||"",stage:tags?.stage||"",reference:tags?.reference||"",
    sku:doc.lines?.[0]?.sku||"",quantity:(doc.lines?.[0]?.qty||0)/1000,
    postedAt:doc.date||doc.createdAt,postedBy:doc.postedBy,
    reversed:Boolean(doc.reversedBy),notes:doc.notes||""};
}
async function accessorySku(scope,sku){
  const row=await ErpSku.findOne({...scope,code:sku,location:"ACCESSORIES",kind:{$in:["RAW","CONSUMABLE"]},active:{$ne:false}}).lean();
  if(!row)throw new ApiError(404,"Active Accessories SKU master not found");
  return row;
}
async function verifyWorkOrder(scope,id){
  const order=await ErpDocument.findOne({...scope,_id:id,type:"WORK_ORDER",status:"POSTED",
    reversedBy:{$exists:false},cancelledAt:{$exists:false}}).lean();
  if(!order)throw new ApiError(409,"Select an active posted Work Order");
  return order;
}
router.get("/overview",asyncHandler(async(req,res)=>{
  authorize(req,false);
  const scope=workspaceFilter();
  const [skus,balances,orders,receipts,workOrders,issues,adjustments,suppliers]=await Promise.all([
    ErpSku.find({...scope,location:"ACCESSORIES",kind:{$in:["RAW","CONSUMABLE"]}}).sort({code:1}).limit(1000).lean(),
    ErpBalance.find({...scope,location:"ACCESSORIES"}).limit(2000).lean(),
    ErpDocument.find({...scope,type:"PURCHASE_ORDER",reversedBy:{$exists:false}}).sort({createdAt:-1}).limit(250).lean(),
    ErpDocument.find({...scope,type:"GOODS_RECEIPT",reversedBy:{$exists:false}}).sort({createdAt:-1}).limit(500).lean(),
    ErpDocument.find({...scope,type:"WORK_ORDER",reversedBy:{$exists:false}}).sort({createdAt:-1}).limit(250).lean(),
    ErpDocument.find({...scope,type:{$in:["MATERIAL_ISSUE","MATERIAL_RETURN","STOCK_TRANSFER"]}}).sort({createdAt:-1}).limit(500).lean(),
    AccessoriesAdjustmentRequest.find(scope).sort({createdAt:-1}).limit(250).lean(),
    ErpParty.find({...scope,kind:{$in:["SUPPLIER","BOTH"]},active:{$ne:false}}).sort({code:1}).limit(250).lean(),
  ]);
  const stock=accessoryStockRows(skus,balances);
  const requirements=accessoryOrderRequirements(workOrders,issues,stock);
  const pending=orders.map(po=>({
    id:String(po._id),number:po.number,date:po.date,partyCode:po.partyCode,
    cancelled:Boolean(po.cancelledAt),lines:(po.lines||[]).filter(l=>stock.some(s=>s.code===l.sku)).map(line=>{
      const received=receipts.filter(r=>String(r.sourceId)===String(po._id)&&!r.reversedBy)
        .flatMap(r=>r.lines||[]).filter(l=>l.sku===line.sku).reduce((n,l)=>n+Number(l.qty||0),0);
      return {sku:line.sku,ordered:Number(line.qty||0)/1000,
        received:Number((received/1000).toFixed(3)),
        pending:po.cancelledAt?0:Number((Math.max(0,Number(line.qty||0)-received)/1000).toFixed(3))};
    })
  })).filter(po=>po.lines.length);
  const history=issues.filter(doc=>(doc.type==="STOCK_TRANSFER"&&doc.moves?.some(m=>m.location==="ACCESSORIES"))
    ||["MATERIAL_ISSUE","MATERIAL_RETURN"].includes(doc.type)&&
      doc.lines?.some(line=>line.location==="ACCESSORIES")&&accessoryStageFromNote(doc.notes))
    .map(documentView);
  const summary={
    itemCount:stock.length,lowStockItems:stock.filter(s=>s.lowStock).length,
    pendingPoLines:pending.flatMap(p=>p.lines).filter(l=>l.pending>0).length,
    beforeSewingIssues:history.filter(h=>h.stage==="BEFORE_SEWING"&&h.type==="MATERIAL_ISSUE"&&!h.reversed).length,
    afterSewingIssues:history.filter(h=>h.stage==="AFTER_SEWING"&&h.type==="MATERIAL_ISSUE"&&!h.reversed).length,
    adjustmentRequests:adjustments.filter(a=>a.status==="PENDING").length,
    pendingDemandQty:Number(requirements.reduce((n,r)=>n+r.pendingQty,0).toFixed(3)),
    workOrdersWithShortage:new Set(requirements.filter(r=>r.shortageQty>0).map(r=>r.workOrderId)).size,
  };
  res.json({summary,stock,requirements,purchases:pending,
    workOrders:workOrders.map(w=>({id:String(w._id),number:w.number,postedAt:w.date,sku:w.lines?.[0]?.sku||""})),
    suppliers:suppliers.map(s=>({code:s.code,name:s.name})),
    history,adjustments:adjustments.map(a=>({
      id:String(a._id),sku:a.sku,expectedQty:a.expectedQty,countedQty:a.countedQty,
      varianceQty:a.varianceQty,reason:a.reason,status:a.status,requestedBy:a.requestedBy,createdAt:a.createdAt,
    }))});
}));
router.post("/masters",asyncHandler(async(req,res)=>{
  authorize(req,true);
  const scope=workspaceFilter(),data=validateAccessorySku(req.body);
  if(await ErpSku.exists({...scope,code:data.code}))throw new ApiError(409,"SKU Code exists. Edit master through authorized ERP master control.");
  const row=await ErpSku.create({...scope,...data});
  res.status(201).json({code:row.code,name:row.name,unit:row.unit,minimumQty:row.minimumQty});
}));
router.post("/purchase",asyncHandler(async(req,res)=>{
  authorize(req,true);
  const scope=workspaceFilter(),data=validateAccessoryPurchase(req.body);
  await accessorySku(scope,data.sku);
  if(!await ErpParty.exists({...scope,code:data.partyCode,kind:{$in:["SUPPLIER","BOTH"]},active:{$ne:false}}))
    throw new ApiError(409,"Active supplier master required");
  const posted=await postDocument({type:"PURCHASE_ORDER",partyCode:data.partyCode,
    lines:[{sku:data.sku,quantity:data.quantity,rate:data.rate,location:"ACCESSORIES"}],
    notes:"ACCESSORIES|PURCHASE"},idempotency(req),req.user.userId);
  res.status(201).json(documentView(posted));
}));
router.post("/receipt",asyncHandler(async(req,res)=>{
  authorize(req,true);
  const scope=workspaceFilter(),sourceId=clean(req.body.purchaseOrderId);
  if(!mongoose.isValidObjectId(sourceId))throw new ApiError(400,"Select Purchase Order");
  const order=await ErpDocument.findOne({...scope,_id:sourceId,type:"PURCHASE_ORDER",reversedBy:{$exists:false}}).lean();
  if(!order||order.cancelledAt)throw new ApiError(409,"Active Purchase Order required");
  const sku=code(req.body.sku);
  if(!sku||!order.lines?.some(line=>line.sku===sku))throw new ApiError(400,"Choose purchased Accessories SKU");
  await accessorySku(scope,sku);
  const amount=validateAccessoryPurchase({...req.body,partyCode:order.partyCode,rate:0}).quantity;
  const posted=await postDocument({type:"GOODS_RECEIPT",sourceId,partyCode:order.partyCode,
    lines:[{sku,quantity:amount,location:"ACCESSORIES"}],notes:"ACCESSORIES|INWARD"},idempotency(req),req.user.userId);
  res.status(201).json(documentView(posted));
}));
router.post("/movement/:action",asyncHandler(async(req,res)=>{
  authorize(req,true);
  const action=upper(req.params.action);
  if(!ACCESSORY_ACTIONS.includes(action))throw new ApiError(400,"Select Issue or Return");
  const scope=workspaceFilter(),data=validateAccessoryMovement(req.body,action);
  await accessorySku(scope,data.sku);
  await verifyWorkOrder(scope,data.sourceId);
  const posted=await postDocument({
    type:action==="ISSUE"?"MATERIAL_ISSUE":"MATERIAL_RETURN",
    sourceId:data.sourceId,
    lines:[{sku:data.sku,quantity:data.quantity,location:"ACCESSORIES"}],
    notes:accessoriesMovementNote(action,data),
  },idempotency(req),req.user.userId);
  res.status(201).json(documentView(posted));
}));
router.post("/transfer",asyncHandler(async(req,res)=>{
  authorize(req,true);
  if(!enabledDepartment(req.departmentCompany,"DELIVERY"))
    throw new ApiError(409,"Delivery department subscription is required for transfer");
  const scope=workspaceFilter(),sku=code(req.body.sku),reference=code(req.body.reference);
  if(!sku||!reference)throw new ApiError(400,"Accessories SKU and transfer reference required");
  await accessorySku(scope,sku);
  const qty=validateAccessoryPurchase({partyCode:"INTERNAL",sku,quantity:req.body.quantity,rate:0}).quantity;
  const posted=await postDocument({type:"STOCK_TRANSFER",
    lines:[{sku,quantity:qty,location:"ACCESSORIES",target:"DELIVERY"}],
    notes:`ACCESSORIES|TRANSFER|${reference}`},idempotency(req),req.user.userId);
  res.status(201).json(documentView(posted));
}));
router.post("/adjustments",asyncHandler(async(req,res)=>{
  authorize(req,true);
  const scope=workspaceFilter(),data=validateAccessoryAdjustment(req.body);
  await accessorySku(scope,data.sku);
  const balance=await ErpBalance.findOne({...scope,sku:data.sku,location:"ACCESSORIES"}).lean();
  const expected=Number(((balance?.qty||0)/1000).toFixed(3));
  if(Math.abs(expected-data.countedQty)<0.000001)throw new ApiError(409,"Count matches ERP stock; no adjustment needed");
  // Approval is separate; NEVER mutate posted ERP stock from a request.
  const row=await AccessoriesAdjustmentRequest.create({...scope,sku:data.sku,expectedQty:expected,
    countedQty:data.countedQty,varianceQty:Number((data.countedQty-expected).toFixed(3)),
    reason:data.reason,requestedBy:req.user.userId,status:"PENDING"});
  res.status(201).json({id:row.id,sku:row.sku,status:row.status,expectedQty:expected,
    countedQty:row.countedQty,varianceQty:row.varianceQty});
}));
export default router;
