import { Router } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { authorizeErp, money, TYPES, fail } from "./policy.js";
import { ErpApproval, ErpSettings } from "./models.js";
import { documentInput, requestHash, postDocument, workspaceFilter } from "./service.js";
import {featureAllowed,featureForRequest} from "./featurePolicy.js";
const router=Router();
const admin=req=>["admin","company_admin"].includes(req.user.role);
const actor=req=>req.user.userId||String(req.user._id);
router.get("/",asyncHandler(async (req,res)=>{
  const scope=workspaceFilter();
  res.json({ settings: await ErpSettings.findOne({ ...scope,key:"ERP" }).select("approvalThreshold approvalTypes").lean(),requests: await ErpApproval.find({ ...scope,...(!admin(req)?{requestedBy:actor(req)}:{}) }).sort({createdAt:-1}).limit(200).lean() });
}));
router.post("/settings",asyncHandler(async (req,res)=>{
  if(!admin(req)) throw new ApiError(403,"Company administrator required");
  if(!Array.isArray(req.body.types)||req.body.types.some(t=>!TYPES.includes(t)||["OPENING","WORK_ORDER"].includes(t))) fail("Select valid approval document types");
  const scope=workspaceFilter();
  res.json(await ErpSettings.findOneAndUpdate({ ...scope,key:"ERP" },{$set:{approvalThreshold:req.body.enabled?money(req.body.threshold):null,approvalTypes:req.body.types}},{new:true}));
}));
router.post("/",asyncHandler(async (req,res)=>{
  if(!authorizeErp(req.user,"post",req.body.type)) throw new ApiError(403,"Posting permission required for this document");
  const scope=workspaceFilter(),input=documentInput(req.body),hash=requestHash(input),key=req.get("Idempotency-Key");
  if(!TYPES.includes(input.type)||! /^[A-Za-z0-9_-]{16,100}$/.test(key||"")) fail("Valid document and idempotency key required");
  await ErpApproval.init();
  const existing=await ErpApproval.findOne({...scope,key}).lean();
  if(existing){if(existing.requestHash!==hash||existing.requestedBy!==actor(req)) fail("Idempotency key has different request data"); return res.json(existing);}
  try{res.status(201).json(await ErpApproval.create({...scope,key,input,requestHash:hash,requestedBy:actor(req)}));}
  catch(e){if(e.code!==11000) throw e;const duplicate=await ErpApproval.findOne({...scope,key}).lean();if(duplicate?.requestHash!==hash||duplicate?.requestedBy!==actor(req)) fail("Idempotency conflict");res.json(duplicate);}
}));
router.post("/:id/decision",asyncHandler(async(req,res)=>{
  if(!admin(req)) throw new ApiError(403,"Company administrator required");
  if(!mongoose.isValidObjectId(req.params.id)||!["APPROVE","REJECT","POST"].includes(req.body.action)||!String(req.body.reason||"").trim()) fail("Valid decision and reason required");
  const scope=workspaceFilter(),id=req.params.id,user=actor(req);
  let request=await ErpApproval.findOne({...scope,_id:id}).lean();
  if(request&&!featureAllowed(req.erpModules,featureForRequest("/documents",request.input.type)))throw new ApiError(403,"Approved posting feature is not included in subscription");
  if(!request||request.requestedBy===user) fail("A different company administrator must review this request");
  if(request.status==="POSTED") return res.json(request);
  if(req.body.action==="REJECT") {
    if(request.status!=="PENDING") fail("Request already decided");
    const rejected=await ErpApproval.findOneAndUpdate({...scope,_id:id,status:"PENDING"},{$set:{status:"REJECTED",decidedBy:user,reason:String(req.body.reason).slice(0,1000)}},{new:true});
    if(!rejected) fail("Decision changed; refresh");return res.json(rejected);
  }
  if(request.status==="PENDING") {
    request=await ErpApproval.findOneAndUpdate({...scope,_id:id,status:"PENDING"},{$set:{status:"APPROVED",decidedBy:user,reason:String(req.body.reason).slice(0,1000)}},{new:true}).lean();
    if(!request) fail("Decision changed; refresh");
  }
  if(request.status!=="APPROVED"||request.decidedBy!==user) fail("Only the approving administrator can post the frozen request");
  // A failed post remains APPROVED for review/retry; successful marking is atomic with the ledger.
  res.json(await postDocument(request.input,`approval_${id}`,user,null,id));
}));
export default router;
