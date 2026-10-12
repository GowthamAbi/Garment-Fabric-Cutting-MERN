import {Router} from 'express';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import {asyncHandler} from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import {authorizeErp,TYPES,fail} from './policy.js';
import {ErpApproval,ErpSettings,ErpApprovalAudit} from './models.js';
import {documentInput,requestHash,postDocument,workspaceFilter} from './service.js';
import {featureAllowed,featureForRequest} from './featurePolicy.js';
import {approvalPolicy,reviewerAllowed,approvalDue,reviewerCanDecide} from './approvalPolicy.js';
import {appendApprovalAudit,auditHashValid} from './approvalAudit.js';
import {currentDatabase} from '../config/tenantDatabase.js';
import {strictAccess,hasPermission} from '../utils/accessPolicy.js';
import User from '../models/User.js';
import {getTenant,runWithTenant} from '../utils/tenantContext.js';
import {EmailOutbox} from '../automation/models.js';
import {activationEmailConfiguration} from '../services/accountEmailService.js';
const router=Router(),actor=req=>req.user.userId;
const admin=req=>['company_owner','company_admin','admin'].includes(req.user.role);
function configure(req){if(!admin(req)||strictAccess(req.user)&&!hasPermission(req.user,'company.settings'))throw new ApiError(403,'Company policy administration permission required');}
async function tx(fn){const scope=workspaceFilter();await Promise.all([ErpApproval.init(),ErpSettings.init(),ErpApprovalAudit.init()]);const session=await currentDatabase().startSession();try{let result;await session.withTransaction(async()=>{const settings=await ErpSettings.findOneAndUpdate({...scope,key:'ERP'},{$inc:{revision:1}},{new:true,session});if(!settings)fail('Configure ERP first');result=await fn(scope,session,settings);});return result;}finally{await session.endSession();}}
router.get('/',asyncHandler(async(req,res)=>{
 const scope=workspaceFilter(),settings=await ErpSettings.findOne({...scope,key:'ERP'}).select('approvalThreshold approvalTypes reviewerLimits escalationHours approvalPolicyVersion policyRevision pendingApprovalPolicy').lean(),canReview=reviewerAllowed(settings,actor(req),admin(req));
 const requests=await ErpApproval.find({...scope,...(!admin(req)&&!canReview?{requestedBy:actor(req)}:{})}).sort({createdAt:-1}).limit(200).lean();
 res.json({settings,canReview,canConfigure:admin(req)&&(!strictAccess(req.user)||hasPermission(req.user,'company.settings')),requests:requests.filter(r=>r.requestedBy===actor(req)||authorizeErp(req.user,"post",r.input.type)||!strictAccess(req.user)&&admin(req)).map(r=>({...r,...approvalDue(r)}))});
}));
router.post('/settings',asyncHandler(async(req,res)=>{
 configure(req);if(!String(req.body.reason||'').trim())fail('Policy change reason required');const policy=approvalPolicy(req.body),tenant=getTenant();
 const users=await runWithTenant({...tenant,factoryId:undefined,customerDatabaseId:undefined},()=>User.find({companyId:tenant.companyId,active:true,userId:{$in:policy.reviewerLimits.map(r=>r.userId)}}).select('userId role factoryId assignedFactoryIds accessPolicyVersion').lean());if(users.length!==policy.reviewerLimits.length)fail('Reviewers must be active company user IDs');if(users.some(u=>u.role!=='company_owner'&&(u.accessPolicyVersion>=1?!(u.assignedFactoryIds||[]).map(String).includes(String(tenant.factoryId)):String(u.factoryId)!==String(tenant.factoryId))))fail('Reviewers must be assigned to this factory');
 const result=await tx(async(scope,session,settings)=>{const proposal={...policy,proposalId:crypto.randomUUID(),requestedBy:actor(req),reason:String(req.body.reason).slice(0,1000),submittedAt:new Date().toISOString()};settings.pendingApprovalPolicy=proposal;await settings.save({session});await appendApprovalAudit(scope,session,{action:'POLICY_PROPOSED',actor:actor(req),reference:proposal.proposalId,reason:proposal.reason,policy});return proposal;});res.status(202).json(result);
}));
router.post('/settings/approve',asyncHandler(async(req,res)=>{
 configure(req);if(req.body.confirm!=='APPROVE POLICY'||!String(req.body.reason||'').trim())fail('Type APPROVE POLICY and provide review notes');
 res.json(await tx(async(scope,session,settings)=>{const p=settings.pendingApprovalPolicy;if(!p||p.proposalId!==req.body.proposalId||p.requestedBy===actor(req))fail('A different policy administrator must approve the current proposal');for(const key of ['approvalThreshold','approvalTypes','reviewerLimits','escalationHours','approvalPolicyVersion'])settings[key]=p[key];settings.policyRevision=Number(settings.policyRevision||0)+1;settings.pendingApprovalPolicy=undefined;await settings.save({session});await appendApprovalAudit(scope,session,{action:'POLICY_APPROVED',actor:actor(req),reference:p.proposalId,reason:String(req.body.reason).slice(0,1000),policyRevision:settings.policyRevision});return settings;}));
}));
router.get('/audit',asyncHandler(async(req,res)=>{
 if(strictAccess(req.user)?!hasPermission(req.user,'audit.read'):!admin(req))throw new ApiError(403,'Audit read permission required');const rows=await ErpApprovalAudit.find(workspaceFilter()).sort({sequence:-1}).limit(200).lean();res.json({rows:rows.map((r,i)=>({...r,hashValid:auditHashValid(r),chainValid:i===rows.length-1?(r.sequence===1?r.previousHash==='GENESIS':null):r.previousHash===rows[i+1].hash&&r.sequence===rows[i+1].sequence+1})),note:'Latest 200 entries; infrastructure-level protection requires independent retained backups.'});
}));
router.post('/escalate',asyncHandler(async(req,res)=>{
 const scope=workspaceFilter(),settings=await ErpSettings.findOne({...scope,key:'ERP'}).lean();if(!admin(req)&&!reviewerAllowed(settings,actor(req)))throw new ApiError(403,'Reviewer permission required');
 const rows=await ErpApproval.find({...scope,status:'PENDING'}).limit(1000).lean(),overdue=rows.filter(r=>approvalDue(r).overdue);if(!overdue.length)return res.json({status:'NOT_NEEDED',count:0});
 const client=activationEmailConfiguration(),tenant=getTenant(),owner=await runWithTenant({...tenant,factoryId:undefined,customerDatabaseId:undefined},()=>User.findOne({companyId:scope.companyId,role:'company_owner',active:true,emailVerified:true}).select('email').lean());if(!owner)fail('Verified company owner email required');
 const day=new Date().toISOString().slice(0,10),dedupeKey=`approval-escalation:${tenant.companyKey}:${scope.factoryId}:${day}`;
 await EmailOutbox.updateOne({dedupeKey},{$setOnInsert:{dedupeKey,companyKey:tenant.companyKey,databaseName:tenant.databaseName,companyId:scope.companyId,factoryId:scope.factoryId,payload:{to:[owner.email],from:process.env.EMAIL_FROM,subject:'UG SaaS overdue approvals',html:`<p>At alert creation, ${overdue.length} pending approvals were overdue. Sign in to your company workspace and review the approval queue. No documents were automatically approved.</p><p><a href="${client}/c/${tenant.companyKey}/login">Company sign-in</a></p>`}}},{upsert:true});res.status(202).json({status:'QUEUED',count:overdue.length,message:'Owner email queued, at most once per factory per UTC day. Queue acceptance is not inbox delivery.'});
}));
router.post('/',asyncHandler(async(req,res)=>{
 if(!authorizeErp(req.user,'post',req.body.type))throw new ApiError(403,'Posting permission required');const input=documentInput(req.body),hash=requestHash(input),key=req.get('Idempotency-Key');if(!TYPES.includes(input.type)||!/^[A-Za-z0-9_-]{16,100}$/.test(key||''))fail('Valid document and idempotency key required');
 const result=await tx(async(scope,session,settings)=>{const old=await ErpApproval.findOne({...scope,key}).session(session);if(old){if(old.requestHash!==hash||old.requestedBy!==actor(req))fail('Idempotency conflict');return old;}const [request]=await ErpApproval.create([{...scope,key,input,requestHash:hash,requestedBy:actor(req),policyRevision:settings.policyRevision||0,dueAt:new Date(Date.now()+(settings.escalationHours||24)*3600000)}],{session});await appendApprovalAudit(scope,session,{action:'REQUESTED',actor:actor(req),reference:String(request._id),requestHash:hash,policyRevision:settings.policyRevision||0});return request;});res.status(201).json(result);
}));
router.post('/:id/decision',asyncHandler(async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.id)||!['APPROVE','REJECT','POST'].includes(req.body.action)||!String(req.body.reason||'').trim())fail('Valid decision and reason required');
 const user=actor(req),id=req.params.id;
 const request=await tx(async(scope,session,settings)=>{const r=await ErpApproval.findOne({...scope,_id:id}).session(session);if(!r||r.requestedBy===user)fail('Independent reviewer required');if(!reviewerCanDecide(settings,req.user,r.input.type,admin(req)))throw new ApiError(403,'Configured reviewer and document posting permission required');if(!featureAllowed(req.erpModules,featureForRequest('/documents',r.input.type)))throw new ApiError(403,'Posting feature not subscribed');if(r.status==='POSTED')return r;
 if(req.body.action==='REJECT'){if(!['PENDING','APPROVED'].includes(r.status))fail('Request already decided');r.status='REJECTED';r.decidedBy=user;}else{if(r.status==='PENDING'){r.status='APPROVED';r.decidedBy=user;}if(r.status!=='APPROVED'||r.decidedBy!==user)fail('Only the approving reviewer may post; reject and submit a new request to change reviewer');}
 r.reason=String(req.body.reason).slice(0,1000);await r.save({session});await appendApprovalAudit(scope,session,{action:r.status,actor:user,reference:id,reason:r.reason,policyRevision:settings.policyRevision||0});return r.toObject();});
 if(request.status!=='APPROVED')return res.json(request);res.json(await postDocument(request.input,`approval_${id}`,user,null,id));
}));
export default router;
