import {Router} from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Company from "../models/Company.js";
import AuditLog from "../models/AuditLog.js";
import {DEPARTMENTS,departmentCode} from "../../../shared/departmentCatalogue.js";
import {asyncHandler} from "../utils/asyncHandler.js";
const router=Router();
router.get("/",asyncHandler(async(req,res)=>{
 if(req.user?.role!=="company_owner")return res.status(403).json({message:"Company owner required"});
 const users=await User.find({companyId:req.user.companyId,factoryId:req.user.factoryId,role:{$in:["department_incharge","management"]}})
  .select("name userId role department permissions").limit(250).lean();
 res.json({users:users.map(u=>({...u,approvalGrants:(u.permissions||[]).filter(p=>p.startsWith("approval."))}))});
}));
router.put("/:id",asyncHandler(async(req,res)=>{
 const owner=req.user;
 if(owner?.role!=="company_owner"||!mongoose.isValidObjectId(owner.companyId)||!mongoose.isValidObjectId(owner.factoryId))
  return res.status(403).json({message:"Company owner required"});
 if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({message:"Invalid user"});
 const d=departmentCode(req.body?.department);
 if(!DEPARTMENTS.includes(d)||typeof req.body?.enabled!=="boolean")return res.status(400).json({message:"Invalid department/grant"});
 const company=await Company.findById(owner.companyId).select("ownerUserId enabledDepartments").lean();
 if(String(company?.ownerUserId)!==String(owner.id)||!company.enabledDepartments?.includes(d))
  return res.status(403).json({message:"Owner identity or company department entitlement mismatch"});
 const user=await User.findOne({_id:req.params.id,companyId:owner.companyId,factoryId:owner.factoryId,active:true}).select("+sessionVersion");
 if(!user||!["department_incharge","management"].includes(user.role))return res.status(404).json({message:"Eligible user not found"});
 if(user.role==="department_incharge"&&departmentCode(user.department)!==d)
  return res.status(403).json({message:"Department heads may approve only their department"});
 if(user.role==="management"&&user.accessPolicyVersion>=1&&!(user.assignedFactoryIds||[]).map(String).includes(String(owner.factoryId)))
  return res.status(403).json({message:"Factory assignment required"});
 const level=user.role==="department_incharge"?"head":"fm";
 const grant=`approval.${level}.${d.toLowerCase()}`;
 const permissions=new Set(user.permissions||[]);
 if(req.body.enabled)permissions.add(grant);else permissions.delete(grant);
 const updated=await User.findOneAndUpdate({_id:user.id,companyId:owner.companyId,factoryId:owner.factoryId,sessionVersion:user.sessionVersion||0},
  {$set:{permissions:[...permissions]},$inc:{sessionVersion:1}},{new:true,runValidators:true});
 if(!updated)return res.status(409).json({message:"User permissions changed concurrently; refresh"});
 await AuditLog.create({actorId:owner.id,actorUserId:owner.userId,actorRole:owner.role,method:"PUT",path:req.originalUrl.split("?")[0],action:"APPROVAL_GRANT_CHANGED",entity:"User",entityId:String(user.id),ip:req.ip,userAgent:req.get("user-agent"),changes:{companyId:String(owner.companyId),factoryId:String(owner.factoryId),grant,enabled:req.body.enabled,previouslyEnabled:(user.permissions||[]).includes(grant)}});
 res.json({message:"Approval authority updated; user must sign in again",grant,enabled:req.body.enabled});
}));
export default router;
