import {getTenant,runWithTenant} from '../utils/tenantContext.js';
import {Router} from 'express';
import mongoose from 'mongoose';
import Company from '../models/Company.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import {asyncHandler} from '../utils/asyncHandler.js';
import {factoryInput} from '../utils/companySetupPolicy.js';
import {strictAccess,hasPermission} from '../utils/accessPolicy.js';
import ApiError from '../utils/ApiError.js';
const router=Router();
function manage(req){if(!['company_owner','company_admin','admin'].includes(req.user.role)||strictAccess(req.user)&&(!hasPermission(req.user,'company.settings')||req.user.accessScope!=='COMPANY'))throw new ApiError(403,'Company-wide settings permission required');}
router.get('/',asyncHandler(async(req,res)=>{if(['saas_super_admin','support_viewer'].includes(req.user.role))throw new ApiError(403,'Company member access required');const c=await Company.findById(req.user.companyId).lean();if(!c)throw new ApiError(404,'Company not found');res.json({factories:c.factories.filter(f=>req.user.role==='company_owner'||!strictAccess(req.user)||req.user.assignedFactoryIds?.map(String).includes(String(f._id))),activeFactoryId:req.user.factoryId});}));
router.post('/',asyncHandler(async(req,res)=>{manage(req);const data=factoryInput(req.body),session=await mongoose.startSession();try{let result;await session.withTransaction(async()=>{const c=await Company.findById(req.user.companyId).session(session);if(!c)throw new ApiError(404,'Company not found');if(c.factories.length>=50||c.factories.some(f=>String(f.code).toUpperCase()===data.code))throw new ApiError(409,'Factory code already exists or company limit reached');c.factories.push(data);await c.save({session});result=c.factories.at(-1);if(c.ownerUserId)await runWithTenant({...getTenant(),factoryId:undefined},()=>User.updateOne({_id:c.ownerUserId,companyId:c._id},{$addToSet:{assignedFactoryIds:result._id}},{session}));await AuditLog.create([{companyId:c._id,factoryId:result._id,actorUserId:req.user.userId,action:'FACTORY_CREATED',changes:{code:result.code,name:result.name}}],{session});});res.status(201).json(result);}finally{await session.endSession();}}));
router.put('/:id',asyncHandler(async(req,res)=>{manage(req);if(!mongoose.isValidObjectId(req.params.id))throw new ApiError(400,'Invalid factory');const data=factoryInput(req.body),session=await mongoose.startSession();try{let result;await session.withTransaction(async()=>{const c=await Company.findById(req.user.companyId).session(session),f=c?.factories.id(req.params.id);if(!f)throw new ApiError(404,'Factory not found');if(data.code!==f.code)throw new ApiError(409,'Factory code is immutable; update its name/billing details');Object.assign(f,data);await c.save({session});await AuditLog.create([{companyId:c._id,factoryId:f._id,actorUserId:req.user.userId,action:'FACTORY_DETAILS_UPDATED',changes:{code:f.code}}],{session});result=f;});res.json(result);}finally{await session.endSession();}}));
export default router;
