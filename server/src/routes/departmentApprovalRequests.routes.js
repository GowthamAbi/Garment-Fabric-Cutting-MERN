import {Router} from "express";
import mongoose from "mongoose";
import {asyncHandler} from "../utils/asyncHandler.js";
import DepartmentApprovalRequest from "../models/DepartmentApprovalRequest.js";
import CompanyApprovalSettings,{validateLimits} from "../models/CompanyApprovalSettings.js";
import AuditLog from "../models/AuditLog.js";
import {DEPARTMENTS,departmentCode} from "../../../shared/departmentCatalogue.js";
import {REQUEST_TYPES,evaluateApproval,determineDecision} from "../services/departmentApprovalPolicy.js";

const router=Router();
const permitted=(user,d,action)=>Array.isArray(user?.permissions)&&user.permissions.includes(`department.${d.toLowerCase()}.${action}`);
const hasFactory=user=>mongoose.isValidObjectId(user?.companyId)&&mongoose.isValidObjectId(user?.factoryId);
// Consolidated queue: privileges are checked on the server, not from UI filters.
router.get("/inbox",asyncHandler(async(req,res)=>{
 const user=req.user;
 if(!hasFactory(user))return res.status(403).json({message:"Company/factory required"});
 const level=user.role==="department_incharge"?"HEAD":user.role==="management"?"FM":user.role==="company_owner"?"OWNER":null;
 if(!level)return res.status(403).json({message:"Approval reviewer role required"});
 const status={HEAD:"PENDING_HEAD",FM:"PENDING_FM",OWNER:"PENDING_OWNER"}[level];
 const allowed=DEPARTMENTS.filter(d=>{
  if(level==="HEAD"&&departmentCode(user.department)!==d)return false;
  return level==="OWNER" || user.permissions?.includes(`approval.${level.toLowerCase()}.${d.toLowerCase()}`);
 });
 if(!allowed.length)return res.json({level,items:[]});
 const records=await DepartmentApprovalRequest.find({
  companyId:user.companyId,factoryId:user.factoryId,status,department:{$in:allowed}
 }).sort({createdAt:1}).limit(100).lean();
 res.json({level,items:records,pendingCount:records.length,notificationMessage:records.length?`${records.length} pending approval requests`:"No pending approvals"});
}));
router.get("/settings",asyncHandler(async(req,res)=>{
 if(!hasFactory(req.user)||!["company_owner","company_admin"].includes(req.user.role))return res.status(403).json({message:"Company management only"});
 const record=await CompanyApprovalSettings.findOne({companyId:req.user.companyId}).lean();
 res.json({configured:!!record,limits:record?.limits||null,revision:record?.revision||0});
}));
router.put("/settings",asyncHandler(async(req,res)=>{
 if(!hasFactory(req.user)||req.user.role!=="company_owner")return res.status(403).json({message:"Verified company owner required"});
 if(!validateLimits(req.body?.limits))return res.status(400).json({message:"Invalid per-type limits; all levels and types required, HEAD <= FM <= OWNER"});
 const current=await CompanyApprovalSettings.findOne({companyId:req.user.companyId}).lean();
 if(current){
  const updated=await CompanyApprovalSettings.findOneAndUpdate({_id:current._id,companyId:req.user.companyId,revision:current.revision},
   {$set:{limits:req.body.limits,modifiedBy:req.user.id},$inc:{revision:1}},{new:true,runValidators:true});
  if(!updated)return res.status(409).json({message:"Settings changed; refresh and retry"});
  return res.json({revision:updated.revision,limits:updated.limits});
 }
 try {
  const created=await CompanyApprovalSettings.create({companyId:req.user.companyId,limits:req.body.limits,modifiedBy:req.user.id});
  return res.status(201).json({revision:created.revision,limits:created.limits});
 }catch(error){if(error.code===11000)return res.status(409).json({message:"Settings created concurrently; refresh"});throw error;}
}));
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
 await AuditLog.create({actorId:user.id,actorUserId:user.userId,actorRole:user.role,method:"POST",path:req.originalUrl.split("?")[0],action:"APPROVAL_REQUEST_CREATED",entity:"DepartmentApprovalRequest",entityId:String(row.id),ip:req.ip,userAgent:req.get("user-agent"),changes:{companyId:String(user.companyId),factoryId:String(user.factoryId),department:d,type,amount}});
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
 // Settings are explicitly approved per company; never fall back to platform defaults.
 const settings=await CompanyApprovalSettings.findOne({companyId:user.companyId}).lean();
 if(!settings||!validateLimits(settings.limits))return res.status(503).json({message:"Company approval limits not configured"});
 const limits=settings.limits;
 const actor={companyId:user.companyId,factoryId:user.factoryId,userId:user.id,department:user.department,
   approvalLevel:level,grants:level==="OWNER" && user.role==="company_owner" ? [...(user.permissions||[]),`approval.owner.${row.department.toLowerCase()}`] : (user.permissions||[])};
 const policy=evaluateApproval({request:row,actor,limits});
 const outcome=determineDecision(policy,decision);
 if(!outcome.allowed)return res.status(403).json({message:outcome.reason});
 const updated=await DepartmentApprovalRequest.findOneAndUpdate(
   {_id:row._id,companyId:user.companyId,factoryId:user.factoryId,status:row.status,__v:row.__v},
   {$set:{status:outcome.status},$push:{decisions:{actorId:user.id,decision:outcome.decision,reason:reason.trim(),at:new Date()}},$inc:{__v:1}},
   {new:true,runValidators:true});
 if(!updated)return res.status(409).json({message:"Request was already processed; refresh"});
 await AuditLog.create({actorId:user.id,actorUserId:user.userId,actorRole:user.role,method:"POST",path:req.originalUrl.split("?")[0],action:"APPROVAL_DECISION_RECORDED",entity:"DepartmentApprovalRequest",entityId:String(updated.id),ip:req.ip,userAgent:req.get("user-agent"),changes:{companyId:String(user.companyId),factoryId:String(user.factoryId),department:row.department,fromStatus:row.status,toStatus:outcome.status,decision:outcome.decision,reason:reason.trim()}});
 res.json({item:updated,message:outcome.decision==="ESCALATE"?"Escalated for review":"Decision recorded; no operational posting performed"});
}));
export default router;
