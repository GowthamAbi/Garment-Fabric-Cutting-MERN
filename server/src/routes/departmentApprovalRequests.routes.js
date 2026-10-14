import {Router} from "express";
import mongoose from "mongoose";
import {asyncHandler} from "../utils/asyncHandler.js";
import DepartmentApprovalRequest from "../models/DepartmentApprovalRequest.js";
import {DEPARTMENTS,departmentCode} from "../../../shared/departmentCatalogue.js";
import {REQUEST_TYPES,evaluateApproval,determineDecision} from "../services/departmentApprovalPolicy.js";

const router=Router();
const permitted=(user,d,action)=>Array.isArray(user?.permissions)&&user.permissions.includes(`department.${d.toLowerCase()}.${action}`);
const hasFactory=user=>mongoose.isValidObjectId(user?.companyId)&&mongoose.isValidObjectId(user?.factoryId);
router.get("/",asyncHandler(async(req,res)=>{
 const user=req.user;
 if(!hasFactory(user))return res.status(403).json({message:"Company/factory required"});
 const d=departmentCode(req.query.department||user.department);
 if(!DEPARTMENTS.includes(d))return res.status(400).json({message:"Select a valid department"});
 const owner=user.role==="company_owner";
 const admin=["company_admin","admin"].includes(user.role);
 if(!owner&&!admin&&(!permitted(user,d,"read")||user.department!==d))return res.status(403).json({message:"Access denied"});
 const rows=await DepartmentApprovalRequest.find({companyId:user.companyId,factoryId:user.factoryId,department:d}).sort({createdAt:-1}).limit(100).lean();
 res.json({items:rows});
}));
router.post("/",asyncHandler(async(req,res)=>{
 const user=req.user;
 const d=departmentCode(user?.department);
 if(!hasFactory(user)||!DEPARTMENTS.includes(d)||!permitted(user,d,"write")||user.accessScope==="SELF")
   return res.status(403).json({message:"Department submission permission required"});
 const {type,title,reason,reference,amount}=req.body||{};
 if(!REQUEST_TYPES.includes(type)||typeof title!=="string"||!title.trim()||title.length>160||typeof reason!=="string"||!reason.trim()||reason.length>2000||typeof amount!=="number"||!Number.isFinite(amount)||amount<0||typeof reference!=="undefined"&&(typeof reference!=="string"||reference.length>100))
   return res.status(400).json({message:"Invalid approval request"});
 const row=await DepartmentApprovalRequest.create({companyId:user.companyId,factoryId:user.factoryId,department:d,type,title:title.trim(),reason:reason.trim(),reference:reference?.trim()||"",amount,requestedBy:user.id});
 res.status(201).json({item:row});
}));
// Decision endpoint is fail-closed until approved limits are explicitly configured.
// No stock, payment or production ledger writes are made by this endpoint.
router.post("/:id/decision",asyncHandler(async(req,res)=>{
 const user=req.user;
 if(!hasFactory(user)||!mongoose.isValidObjectId(req.params.id))
   return res.status(400).json({message:"Invalid request context"});
 const {decision,reason}=req.body||{};
 if(!["APPROVE","REJECT"].includes(decision)||typeof reason!=="string"||!reason.trim()||reason.length>1000)
   return res.status(400).json({message:"Valid decision and reason required"});
 const row=await DepartmentApprovalRequest.findOne({_id:req.params.id,companyId:user.companyId,factoryId:user.factoryId});
 if(!row)return res.status(404).json({message:"Request not found"});
 const level=row.status==="PENDING_HEAD"?"HEAD":row.status==="PENDING_FM"?"FM":row.status==="PENDING_OWNER"?"OWNER":null;
 if(!level)return res.status(409).json({message:"Request already finalized"});
 const roleAllowed=level==="HEAD"?user.role==="department_incharge":level==="FM"?user.role==="management":user.role==="company_owner";
 if(!roleAllowed)return res.status(403).json({message:"Approval role required"});
 // No implicit approval grants, no default spending authority.
 let limits;
 try {limits=JSON.parse(process.env.DEPARTMENT_APPROVAL_LIMITS_JSON||"null");}
 catch {return res.status(503).json({message:"Approval limits not configured"});}
 if(!limits)return res.status(503).json({message:"Approval limits not configured"});
 const actor={companyId:user.companyId,factoryId:user.factoryId,userId:user.id,department:user.department,
   approvalLevel:level,grants:user.permissions||[]};
 const policy=evaluateApproval({request:row,actor,limits});
 const outcome=determineDecision(policy,decision);
 if(!outcome.allowed)return res.status(403).json({message:outcome.reason});
 const updated=await DepartmentApprovalRequest.findOneAndUpdate(
   {_id:row._id,companyId:user.companyId,factoryId:user.factoryId,status:row.status,__v:row.__v},
   {$set:{status:outcome.status},$push:{decisions:{actorId:user.id,decision:outcome.decision,reason:reason.trim(),at:new Date()}},$inc:{__v:1}},
   {new:true,runValidators:true});
 if(!updated)return res.status(409).json({message:"Request was already processed; refresh"});
 res.json({item:updated,message:outcome.decision==="ESCALATE"?"Escalated for review":"Decision recorded; no operational posting performed"});
}));
export default router;
