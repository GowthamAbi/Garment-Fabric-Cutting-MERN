import {currentDatabase} from "../config/tenantDatabase.js";
import {workspaceFilter} from "../erp/service.js";
import FabricCutPlan from "../models/FabricCutPlan.js";
import FabricInwardLot from "../models/FabricInwardLot.js";
import FabricBundleStock from "../models/FabricBundleStock.js";
import FabricIssueMovement from "../models/FabricIssueMovement.js";
import ApiError from "../utils/ApiError.js";
import {assertFabricIssueRequest,remainingColourWeight,sumRollBalance} from "../erp/fabricIssuePolicy.js";
const round=n=>Math.round((n+Number.EPSILON)*1000)/1000;
export async function saveFabricIssue(req,res){
 const input=assertFabricIssueRequest(req.body);
 const scope=workspaceFilter();
 await FabricIssueMovement.init(); // Enforce idempotency key uniqueness for each tenant/factory.
 const session=await currentDatabase().startSession();
 let response;
 try{
  await session.withTransaction(async()=>{
   const old=await FabricIssueMovement.findOne({...scope,key:input.key}).session(session).lean();
   if(old){
    if(old.planNo!==input.planNo||old.inwardNo!==input.inwardNo||old.colour!==input.colour||old.weightKg!==input.weightKg)
      throw new ApiError(409,"Issue key already used for different details");
    response={movement:old,replayed:true};
    return;
   }
   const plan=await FabricCutPlan.findOne({planNo:input.planNo}).session(session);
   const inward=await FabricInwardLot.findOne({inwardNo:input.inwardNo}).session(session);
   if(!plan||!inward)throw new ApiError(404,"Fabric Plan or Inward not found");
   if(!["PLANNED","PART_ISSUED"].includes(plan.status)||inward.status==="HOLD")
    throw new ApiError(409,"Only active planned fabric can be issued");
   if(String(plan.fabricGroup)!==String(inward.fabricGroup))
    throw new ApiError(409,"Fabric group differs between plan and inward");
   const colourRemaining=remainingColourWeight(plan,input.colour);
   if(colourRemaining===null||input.weightKg>colourRemaining+0.00001)
    throw new ApiError(409,"Issue exceeds remaining plan colour requirement");
   const row=(inward.colours||[]).find(c=>String(c.colour).toUpperCase()===input.colour);
   if(!row||Number(row.balanceWeightKg||0)+0.00001<input.weightKg)
    throw new ApiError(409,"Not enough usable inward colour balance");
   const bundles=await FabricBundleStock.find({
    inwardNo:input.inwardNo,colour:input.colour,status:{$nin:["HOLD","CONSUMED"]},balanceWeightKg:{$gt:0}
   }).sort({createdAt:1,_id:1}).session(session);
   if(sumRollBalance(bundles)+0.00001<input.weightKg)
    throw new ApiError(409,"Insufficient available roll balance");
   let balance=input.weightKg;const allocations=[];
   for(const bundle of bundles){
    if(balance<=0)break;
    const take=round(Math.min(balance,Number(bundle.balanceWeightKg)));
    if(take<=0)continue;
    bundle.balanceWeightKg=round(bundle.balanceWeightKg-take);
    bundle.status=bundle.balanceWeightKg<=0?"CONSUMED":"PARTIAL";
    await bundle.save({session});
    allocations.push({bundleNo:bundle.bundleNo,batchNo:bundle.batchNo,dia:bundle.dia,weightKg:take});
    balance=round(balance-take);
   }
   if(balance>0)throw new ApiError(409,"Roll issue allocation did not reconcile");
   row.balanceWeightKg=round(row.balanceWeightKg-input.weightKg);
   inward.status=inward.colours.every(c=>Number(c.balanceWeightKg||0)<=0)?"CLOSED":"PARTIAL";
   await inward.save({session});
   plan.allocations.push({inwardNo:input.inwardNo,colour:input.colour,weightKg:input.weightKg,issuedBy:req.user.name||req.user.userId});
   plan.issuedWeightKg=round(Number(plan.issuedWeightKg||0)+input.weightKg);
   plan.status=plan.issuedWeightKg>=Number(plan.totalWantedWeightKg||0)-0.00001?"READY":"PART_ISSUED";
   await plan.save({session});
   const [movement]=await FabricIssueMovement.create([{
    ...scope,...input,actorId:req.user.userId||String(req.user.id),
    notes:String(req.body.notes||"").trim().slice(0,300),allocations
   }],{session});
   response={movement,plan:{planNo:plan.planNo,status:plan.status,issuedWeightKg:plan.issuedWeightKg},replayed:false};
  });
  res.status(response.replayed?200:201).json(response);
 }finally{await session.endSession()}
}
export async function listFabricIssues(req,res){
 const scope=workspaceFilter();const filter={...scope};
 for(const key of ["planNo","inwardNo"]){
  if(req.query[key]){
   const value=String(req.query[key]).trim().toUpperCase();
   if(!/^[A-Z0-9_\/-]{1,100}$/.test(value))throw new ApiError(400,"Invalid issue history filter");
   filter[key]=value;
  }
 }
 const items=await FabricIssueMovement.find(filter).sort({createdAt:-1}).limit(500).lean();
 res.json({items,limit:500,note:"This register contains transactional issues recorded after the new workflow was enabled. Older legacy plan allocations are not backfilled."});
}
