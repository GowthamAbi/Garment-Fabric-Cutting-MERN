import {Router} from "express";
import mongoose from "mongoose";
import {asyncHandler} from "../utils/asyncHandler.js";
import DepartmentApprovalRequest from "../models/DepartmentApprovalRequest.js";
import {DEPARTMENTS,departmentCode} from "../../../shared/departmentCatalogue.js";
import {REQUEST_TYPES} from "../services/departmentApprovalPolicy.js";

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
export default router;
