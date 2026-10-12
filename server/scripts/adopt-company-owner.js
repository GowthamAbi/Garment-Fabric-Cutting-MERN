import 'dotenv/config';
import '../src/config/mongoosePlugins.js';
import mongoose from 'mongoose';
import {runWithTenant} from '../src/utils/tenantContext.js';
import {tenantDatabaseName} from '../src/config/tenantDatabase.js';
import TenantRegistry from '../src/models/TenantRegistry.js';
import Company from '../src/models/Company.js';
import User from '../src/models/User.js';
import AuditLog from '../src/models/AuditLog.js';
import {ACCESS_PERMISSIONS} from '../../shared/accessCatalogue.js';
const apply=process.argv.includes('--apply'),companyKey=process.env.OWNER_COMPANY_KEY,userId=process.env.OWNER_USER_ID;
if(!companyKey||!userId||!process.env.MONGODB_URI)throw new Error('Configure private MONGODB_URI, OWNER_COMPANY_KEY and OWNER_USER_ID');
if(apply&&(process.env.OWNER_ADOPTION_CONFIRMED!=='YES'||!process.env.OWNER_REVIEW_REFERENCE))throw new Error('Apply requires OWNER_ADOPTION_CONFIRMED=YES and independent ownership review reference');
await mongoose.connect(process.env.MONGODB_URI,{serverSelectionTimeoutMS:10000});
try{
 const registry=await TenantRegistry.findOne({companyKey}).lean();
 if(!registry||registry.databaseName!==tenantDatabaseName(companyKey)||registry.adminUserId!==userId)throw new Error('Registered original administrator must be selected');
 await runWithTenant({companyKey,databaseName:registry.databaseName},async()=>{
  const user=await User.findOne({userId}).select('+sessionVersion');
  const company=user?await Company.findById(user.companyId):null;
  if(!user?.active||!user.emailVerified||user.email!==registry.adminEmail||!company||!['company_admin','company_owner'].includes(user.role))throw new Error('Verified registered administrator and company required');
  if(company.ownerUserId&&String(company.ownerUserId)!==String(user._id))throw new Error('Ownership transfer is not supported by this adoption tool');
  console.log(JSON.stringify({companyKey,userId,mode:apply?'APPLY':'DRY_RUN',effect:'Owner identity verified; company strict policy activates. Other legacy users are profile-only until explicitly assigned reviewed roles/scopes. Operational records unchanged.'}));
  if(!apply)return;
  const session=await mongoose.startSession();try{await session.withTransaction(async()=>{
   const fresh=await User.findById(user._id).select('+sessionVersion').session(session),current=await Company.findById(company._id).session(session);
   if(!fresh?.active||!fresh.emailVerified||fresh.email!==registry.adminEmail||!['company_admin','company_owner'].includes(fresh.role)||!current||(current.ownerUserId&&String(current.ownerUserId)!==String(fresh._id)))throw new Error('Ownership changed during adoption');
   Object.assign(fresh,{role:'company_owner',accessPolicyVersion:1,accessScope:'COMPANY',permissions:[...ACCESS_PERMISSIONS],assignedFactoryIds:current.factories.map(f=>f._id),sessionVersion:Number(fresh.sessionVersion||0)+1});
   current.ownerUserId=fresh._id;current.accessPolicyVersion=1;await fresh.save({session});await current.save({session});
   await AuditLog.create([{companyId:current._id,factoryId:fresh.factoryId,actorUserId:'PRIVATE_OWNERSHIP_REVIEW',actorRole:'SECURE_OPERATOR',method:'MIGRATION',path:'adopt-company-owner',action:'COMPANY_OWNER_ADOPTED',changes:{userId,reviewReference:process.env.OWNER_REVIEW_REFERENCE}}],{session});
  });}finally{await session.endSession();}
 });
}finally{await mongoose.disconnect();}
