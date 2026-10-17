import {Router} from "express";
import mongoose from "mongoose";
import {asyncHandler} from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import {postDocument,workspaceFilter} from "./service.js";
import {allowedDepartment,enabledDepartment} from "./departmentPolicy.js";
import {ErpSku,ErpBalance,ErpDocument,ErpParty} from "./models.js";
import FabricCutActual from "../models/FabricCutActual.js";
import GarmentItemMaster from "../models/GarmentItemMaster.js";
import {requireLegacyFabricFactory} from "../controllers/fabricPlanMonitorController.js";
import ElasticWorkPlan from "../models/ElasticWorkPlan.js";
import ElasticCorrectionRequest from "../models/ElasticCorrectionRequest.js";
import {elasticCode,elasticQuantity,elasticMaterialInput,elasticReceiptInput,elasticMovementInput,
 elasticRequirementLines,elasticStockRows,elasticMovementTag,elasticCutNote,elasticPlanProgress} from "./elasticPolicy.js";

const router=Router();
const cleaned=v=>String(v||"").trim();
function authorize(req,write=false){
 if(!allowedDepartment(req.user,"ELASTIC",write)||!enabledDepartment(req.departmentCompany,"ELASTIC"))
   throw new ApiError(403,"Elastic department permission and subscription required");
}
function idempotency(req){
 const key=cleaned(req.get("Idempotency-Key"));
 if(!/^[A-Za-z0-9_-]{16,100}$/.test(key))throw new ApiError(400,"Idempotency-Key required (16-100 characters)");
 return key;
}
async function validSku(scope,sku){
 const found=await ErpSku.findOne({...scope,code:sku,location:"ELASTIC",unit:"MTR",
   kind:{$in:["RAW","CONSUMABLE"]},active:{$ne:false}}).lean();
 if(!found)throw new ApiError(404,"Active ELASTIC MTR material SKU required");
 return found;
}
function receiptView(d){
 return {number:d.number,id:String(d._id),type:d.type,sku:d.lines?.[0]?.sku,
   quantity:Number(d.lines?.[0]?.qty||0)/1000,
   sourceId:d.sourceId||"",date:d.date||d.createdAt,
   notes:d.notes||""};
}
router.get("/overview",asyncHandler(async(req,res)=>{
 authorize(req,false);
 const scope=workspaceFilter();
 const [materials,balances,plans,documents,purchaseOrders,receipts,corrections,suppliers]=await Promise.all([
   ErpSku.find({...scope,location:"ELASTIC",unit:"MTR",kind:{$in:["RAW","CONSUMABLE"]}}).sort({code:1}).limit(1000).lean(),
   ErpBalance.find({...scope,location:"ELASTIC"}).limit(2000).lean(),
   ElasticWorkPlan.find(scope).sort({createdAt:-1}).limit(300).lean(),
   ErpDocument.find({...scope,type:"STOCK_TRANSFER",reversedBy:{$exists:false}}).sort({createdAt:-1}).limit(3000).lean(),
   ErpDocument.find({...scope,type:"PURCHASE_ORDER",reversedBy:{$exists:false}}).sort({createdAt:-1}).limit(300).lean(),
   ErpDocument.find({...scope,type:"GOODS_RECEIPT",reversedBy:{$exists:false}}).sort({createdAt:-1}).limit(600).lean(),
   ElasticCorrectionRequest.find(scope).sort({createdAt:-1}).limit(300).lean(),
   ErpParty.find({...scope,kind:{$in:["SUPPLIER","BOTH"]},active:{$ne:false}}).sort({code:1}).limit(300).lean(),
 ]);
 const stock=elasticStockRows(materials,balances);
 const productionDocs=documents.filter(d=>elasticMovementTag(d.notes));
 const enriched=elasticPlanProgress(plans,productionDocs);
 const purchases=purchaseOrders.map(order=>{
   const rows=(order.lines||[]).filter(line=>stock.some(s=>s.code===line.sku)).map(line=>{
     const received=receipts.filter(d=>String(d.sourceId)===String(order._id))
       .flatMap(d=>d.lines||[]).filter(l=>l.sku===line.sku).reduce((n,l)=>n+Number(l.qty||0),0);
     return {sku:line.sku,orderedMtr:Number(line.qty||0)/1000,
       receivedMtr:received/1000,pendingMtr:order.cancelledAt?0:
         Number((Math.max(0,Number(line.qty||0)-received)/1000).toFixed(3))};
   });
   return {id:String(order._id),number:order.number,partyCode:order.partyCode,lines:rows};
 }).filter(o=>o.lines.length);
 const history=productionDocs.map(d=>({...receiptView(d),...elasticMovementTag(d.notes)}));
 const summary={materials:stock.length,lowStock:stock.filter(s=>s.lowStock).length,
   plans:plans.length,targetMtr:Number(enriched.reduce((n,p)=>n+p.targetMtr,0).toFixed(3)),
   cutMtr:Number(enriched.reduce((n,p)=>n+p.cutMtr,0).toFixed(3)),
   pendingMtr:Number(enriched.reduce((n,p)=>n+p.pendingMtr,0).toFixed(3)),
   wastePending:corrections.filter(c=>c.status==="PENDING").length};
 res.json({summary,stock,plans:enriched,
   purchases,history,corrections:corrections.map(c=>({id:String(c._id),sku:c.sku,reference:c.reference,
     expectedMtr:c.expectedMtr,countedMtr:c.countedMtr,varianceMtr:c.varianceMtr,
     reason:c.reason,status:c.status,createdAt:c.createdAt})),
   suppliers:suppliers.map(s=>({code:s.code,name:s.name}))});
}));
router.post("/materials",asyncHandler(async(req,res)=>{
 authorize(req,true);
 const scope=workspaceFilter(),data=elasticMaterialInput(req.body);
 if(await ErpSku.exists({...scope,code:data.code}))throw new ApiError(409,"Elastic SKU code exists");
 const item=await ErpSku.create({...scope,...data});
 res.status(201).json({code:item.code,name:item.name,unit:item.unit,minimumQty:item.minimumQty});
}));
router.post("/purchase",asyncHandler(async(req,res)=>{
 authorize(req,true);
 const scope=workspaceFilter(),sku=elasticCode(req.body.sku,"Elastic SKU"),
   partyCode=elasticCode(req.body.partyCode,"Supplier"),
   qty=elasticQuantity(req.body.quantity),rate=Number(req.body.rate);
 await validSku(scope,sku);
 if(!Number.isFinite(rate)||rate<0||rate>10000000||Math.abs(rate*100-Math.round(rate*100))>0.000001)
   throw new ApiError(400,"Rate must be non-negative with two decimals");
 if(!await ErpParty.exists({...scope,code:partyCode,kind:{$in:["SUPPLIER","BOTH"]},active:{$ne:false}}))
   throw new ApiError(409,"Active supplier required");
 const d=await postDocument({type:"PURCHASE_ORDER",partyCode,
   lines:[{sku,location:"ELASTIC",quantity:qty,rate}],notes:"ELASTIC|PURCHASE"},
   idempotency(req),req.user.userId);
 res.status(201).json(receiptView(d));
}));
router.post("/inward",asyncHandler(async(req,res)=>{
 authorize(req,true);
 const scope=workspaceFilter(),id=cleaned(req.body.purchaseOrderId);
 if(!mongoose.isValidObjectId(id))throw new ApiError(400,"Purchase Order ID required");
 const order=await ErpDocument.findOne({...scope,_id:id,type:"PURCHASE_ORDER",
   reversedBy:{$exists:false},cancelledAt:{$exists:false}}).lean();
 if(!order)throw new ApiError(409,"Active PO required for Elastic inward");
 const {sku,quantity}=elasticReceiptInput(req.body);
 if(!order.lines?.some(l=>l.sku===sku))throw new ApiError(409,"Elastic SKU not in selected PO");
 await validSku(scope,sku);
 const posted=await postDocument({type:"GOODS_RECEIPT",partyCode:order.partyCode,sourceId:id,
   lines:[{sku,quantity,location:"ELASTIC"}],notes:"ELASTIC|INWARD"},
   idempotency(req),req.user.userId);
 res.status(201).json(receiptView(posted));
}));
// Plans derive from actually completed Fabric Cutting rows; no invented demand.
router.post("/plans",asyncHandler(requireLegacyFabricFactory),asyncHandler(async(req,res)=>{
 authorize(req,true);
 const scope=workspaceFilter(),fabricPlanNo=elasticCode(req.body.fabricPlanNo,"Cutting Plan No"),
   sku=elasticCode(req.body.sku,"Elastic SKU");
 await validSku(scope,sku);
 const actual=await FabricCutActual.findOne({planNo:fabricPlanNo,status:"COMPLETED"}).lean();
 if(!actual)throw new ApiError(409,"Completed Fabric Cutting Actual required");
 const master=await GarmentItemMaster.findOne({itemCode:actual.itemCode,status:"APPROVED"})
   .sort({updatedAt:-1}).lean();
 const requirement=elasticRequirementLines(actual,master);
 const planNo=elasticCode(req.body.planNo||("ELA-"+fabricPlanNo),"Elastic Plan No");
 const existing=await ElasticWorkPlan.findOne({...scope,fabricPlanNo});
 if(existing)throw new ApiError(409,"This Fabric Cutting plan already has an Elastic plan");
 const plan=await ElasticWorkPlan.create({...scope,planNo,dcNo:actual.dcNo,
   fabricPlanNo,sku,itemCode:actual.itemCode,itemName:actual.itemName,
   targetMtr:requirement.totalMtr,targetPcs:requirement.totalPcs,lines:requirement.lines,
   createdBy:req.user.userId});
 res.status(201).json({planNo:plan.planNo,targetMtr:plan.targetMtr,lines:plan.lines});
}));
// Cutting posts a real ERP stock transfer. It does NOT maintain a separate balance.
router.post("/cut",asyncHandler(async(req,res)=>{
 authorize(req,true);
 if(!enabledDepartment(req.departmentCompany,"DELIVERY"))
   throw new ApiError(409,"DELIVERY must be licensed for Elastic cutting handover");
 const scope=workspaceFilter(),planNo=elasticCode(req.body.planNo,"Elastic Plan No"),
   reference=elasticCode(req.body.reference,"Cutting Entry Reference"),quantity=elasticQuantity(req.body.quantity);
 const plan=await ElasticWorkPlan.findOne({...scope,planNo,status:"PLANNED"}).lean();
 if(!plan)throw new ApiError(404,"Elastic plan not found");
 const docs=await ErpDocument.find({...scope,type:"STOCK_TRANSFER",
   reversedBy:{$exists:false},"notes":{$regex:/^ELASTIC\|(CUT|RETURN)\|/}}).limit(5000).lean();
 if(docs.length===5000)throw new ApiError(409,"Elastic movement reconciliation limit; archive first");
 const balance=elasticPlanProgress([plan],docs)[0],key=idempotency(req);
 // Same-key retries must reach the ERP idempotency check even after quota is used.
 const alreadyPosted=await ErpDocument.exists({...scope,idempotencyKey:key});
 if(!alreadyPosted&&quantity>balance.pendingMtr+0.000001)
   throw new ApiError(409,`Plan has only ${balance.pendingMtr} MTR pending`);
 // Idempotent stock posting serializes material quantity; cross-request plan quantity
 // reconciliation still needs an atomic plan reservation before final E2E approval.
 const posted=await postDocument({type:"STOCK_TRANSFER",
   lines:[{sku:plan.sku,quantity,location:"ELASTIC",target:"DELIVERY"}],
   notes:elasticCutNote("CUT",planNo,reference)},key,req.user.userId);
 res.status(201).json({...receiptView(posted),planNo});
}));
router.post("/return",asyncHandler(async(req,res)=>{
 authorize(req,true);
 const scope=workspaceFilter(),data=elasticMovementInput({...req.body,action:"RETURN"});
 const planNo=elasticCode(req.body.planNo,"Elastic Plan No");
 const plan=await ElasticWorkPlan.findOne({...scope,planNo,sku:data.sku}).lean();
 if(!plan)throw new ApiError(404,"Elastic plan not found");
 if(!enabledDepartment(req.departmentCompany,"DELIVERY"))throw new ApiError(409,"DELIVERY subscription required");
 const docs=await ErpDocument.find({...scope,type:"STOCK_TRANSFER",
   reversedBy:{$exists:false},"notes":{$regex:/^ELASTIC\|(CUT|RETURN)\|/}}).limit(5000).lean();
 if(docs.length===5000)throw new ApiError(409,"Elastic reconciliation limit");
 const progress=elasticPlanProgress([plan],docs)[0],key=idempotency(req);
 const alreadyPosted=await ErpDocument.exists({...scope,idempotencyKey:key});
 if(!alreadyPosted&&data.quantity>progress.cutMtr+0.000001)throw new ApiError(409,"Return exceeds net issued metres");
 const posted=await postDocument({type:"STOCK_TRANSFER",
   lines:[{sku:data.sku,quantity:data.quantity,location:"DELIVERY",target:"ELASTIC"}],
   notes:elasticCutNote("RETURN",planNo,data.reference)},key,req.user.userId);
 res.status(201).json(receiptView(posted));
}));
router.post("/corrections",asyncHandler(async(req,res)=>{
 authorize(req,true);
 const scope=workspaceFilter(),sku=elasticCode(req.body.sku,"Elastic SKU"),
  reference=elasticCode(req.body.reference,"Adjustment Reference"),
  countedMtr=elasticQuantity(req.body.countedMtr,{allowZero:true}),
  reason=cleaned(req.body.reason);
 await validSku(scope,sku);
 if(reason.length<5||reason.length>300)throw new ApiError(400,"Correction reason must be 5-300 characters");
 const balance=await ErpBalance.findOne({...scope,sku,location:"ELASTIC"}).lean();
 const expectedMtr=Number(((balance?.qty||0)/1000).toFixed(3));
 if(expectedMtr===countedMtr)throw new ApiError(409,"No Elastic stock variance");
 const row=await ElasticCorrectionRequest.create({...scope,sku,reference,expectedMtr,countedMtr,
   varianceMtr:Number((countedMtr-expectedMtr).toFixed(3)),reason,
   status:"PENDING",requestedBy:req.user.userId});
 // No direct mutations to immutable ERP posted ledger or ErpBalance.
 res.status(201).json({id:String(row._id),reference:row.reference,status:row.status});
}));
export default router;
