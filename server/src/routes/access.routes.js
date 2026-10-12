import {Router} from 'express';
import mongoose from 'mongoose';
import {asyncHandler} from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import {hasPermission,validateAccessAssignment,companyOwner} from '../utils/accessPolicy.js';
import {ACCESS_PERMISSIONS,ACCESS_SCOPES,ROLE_TEMPLATES} from '../../../shared/accessCatalogue.js';
import {departmentCode} from '../../../shared/departmentCatalogue.js';
import AccessRole from '../models/AccessRole.js';
import User from '../models/User.js';
import Company from '../models/Company.js';
import AuditLog from '../models/AuditLog.js';
const router=Router();
router.use((req,_res,next)=>req.path==='/factory'||hasPermission(req.user,'users.roles.assign')||hasPermission(req.user,'roles.manage')?next():next(new ApiError(403,'Authorized company role administration required')));
router.get('/',asyncHandler(async(req,res)=>{
 const company=await Company.findById(req.user.companyId).select('ownerUserId factories enabledDepartments').lean();
 if(!company)throw new ApiError(404,'Company not found');
 const users=await User.find({companyId:company._id}).select('userId name role department permissions accessPolicyVersion accessScope assignedFactoryIds assignedWarehouseKeys assignedShopKeys factoryId').limit(2000).lean();
 res.json({company,users,roles:await AccessRole.find({companyId:company._id}).limit(500).lean(),templates:ROLE_TEMPLATES,permissions:ACCESS_PERMISSIONS.filter(p=>companyOwner(req.user)||hasPermission(req.user,p)),scopes:ACCESS_SCOPES});
}));
router.post('/roles',asyncHandler(async(req,res)=>{
 if(!hasPermission(req.user,'roles.manage'))throw new ApiError(403,'Custom role management permission required');
 const {key,name,baseRole,permissions}=req.body;
 if(!/^[A-Z0-9_-]{2,60}$/.test(key||'')||!String(name||'').trim()||!['company_admin','department_incharge','department_entry','management','view_only','store'].includes(baseRole)||!Array.isArray(permissions)||permissions.some(p=>!ACCESS_PERMISSIONS.includes(p)||!hasPermission(req.user,p))||new Set(permissions).size!==permissions.length)throw new ApiError(400,'Valid role, base role and delegable permissions required');
 await AccessRole.init();const session=await mongoose.startSession();let result;
 try{await session.withTransaction(async()=>{
  [result]=await AccessRole.create([{companyId:req.user.companyId,key,name:String(name).trim().slice(0,120),baseRole,permissions,createdBy:req.user.userId}],{session});
  await AuditLog.create([{companyId:req.user.companyId,factoryId:req.user.factoryId,actorUserId:req.user.userId,actorRole:req.user.role,action:'CUSTOM_ROLE_CREATED',method:'POST',path:'/auth/access/roles',changes:{roleKey:key,permissions}}],{session});
 });res.status(201).json(result);}finally{await session.endSession();}
}));
router.post('/users/:id',asyncHandler(async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.id))throw new ApiError(400,'Invalid user');
 const session=await mongoose.startSession();let result;
 try{await session.withTransaction(async()=>{
  const company=await Company.findOneAndUpdate({_id:req.user.companyId},{$inc:{userProvisionRevision:1}},{new:true,session});
  const user=await User.findOne({_id:req.params.id,companyId:req.user.companyId}).select('+sessionVersion').session(session);
  if(!company||!user||user.role==='saas_super_admin')throw new ApiError(404,'Company user not found');
  let role=ROLE_TEMPLATES.find(r=>r.key===req.body.roleKey);
  if(!role)role=await AccessRole.findOne({companyId:company._id,key:req.body.roleKey}).session(session).lean();
  if(!role)throw new ApiError(400,'Select a role template or saved custom role');
  const input={...req.body,permissions:role.key==='DEPARTMENT_OPERATOR'?[`department.${departmentCode(req.body.department).toLowerCase()}.read`,`department.${departmentCode(req.body.department).toLowerCase()}.write`]:role.permissions};
  const assignment=validateAccessAssignment(req.user,user,input,company);
  Object.assign(user,assignment,{role:role.baseRole,accessRoleKey:role.key,sessionVersion:Number(user.sessionVersion||0)+1});await user.save({session});
  await AuditLog.create([{companyId:company._id,factoryId:req.user.factoryId,actorUserId:req.user.userId,actorRole:req.user.role,action:'USER_ACCESS_ASSIGNED',method:'POST',path:'/auth/access/users',changes:{targetUserId:user.userId,roleKey:role.key,...assignment}}],{session});
  result={userId:user.userId,roleKey:role.key,message:'Access assigned; user must sign in again'};
 });res.json(result);}finally{await session.endSession();}
}));
router.post('/factory',asyncHandler(async(req,res)=>{
 const factoryId=String(req.body.factoryId||'');
 if(!mongoose.isValidObjectId(factoryId)||(!companyOwner(req.user)&&!(req.user.assignedFactoryIds||[]).map(String).includes(factoryId)))throw new ApiError(403,'Assigned factory required');
 const company=await Company.findById(req.user.companyId).lean();if(!company?.factories.some(f=>String(f._id)===factoryId))throw new ApiError(403,'Factory outside company');
 const session=await mongoose.startSession();try{await session.withTransaction(async()=>{
  await User.updateOne({_id:req.user.id,companyId:company._id},{$set:{factoryId},$inc:{sessionVersion:1}},{session});
  await AuditLog.create([{companyId:company._id,factoryId:req.user.factoryId,actorUserId:req.user.userId,actorRole:req.user.role,action:'ACTIVE_FACTORY_CHANGED',method:'POST',path:'/auth/access/factory',changes:{from:String(req.user.factoryId),to:factoryId}}],{session});
 });}finally{await session.endSession();}
 res.json({message:'Active factory changed; sign in again'});
}));
export default router;
