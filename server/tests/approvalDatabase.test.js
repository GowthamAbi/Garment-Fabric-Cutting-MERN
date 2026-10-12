import '../src/config/mongoosePlugins.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import express from 'express';
import {runWithTenant} from '../src/utils/tenantContext.js';
import {databaseForName} from '../src/config/tenantDatabase.js';
import Company from '../src/models/Company.js';
import User from '../src/models/User.js';
import {ErpSettings,ErpApproval,ErpDocument,ErpApprovalAudit} from '../src/erp/models.js';
import {auditHashValid} from '../src/erp/approvalAudit.js';
import router from '../src/erp/approvalRoutes.js';
test('real replica-set approval policy: independent policy review, actual limit denial, no unauthorized finance posting and exactly-once posting',{skip:!process.env.TEST_MONGODB_URI},async()=>{
 const nonce=crypto.randomBytes(6).toString('hex'),tenant={companyKey:`approval-${nonce}`,databaseName:`ugs_tenant_approval_test_${nonce}`,companyId:new mongoose.Types.ObjectId(),factoryId:new mongoose.Types.ObjectId()};let server;
 await mongoose.connect(process.env.TEST_MONGODB_URI);
 try{
  const hello=await mongoose.connection.db.command({hello:1});assert.ok(hello.setName||hello.msg==='isdbgrid','Replica set required');
  await runWithTenant(tenant,async()=>{await Company.create({_id:tenant.companyId,companyName:'Approval fixture',factories:[{_id:tenant.factoryId,name:'Main',code:'MAIN'}]});await ErpSettings.create({...tenant,key:'ERP',enabled:true});for(const id of ['OWNER-A','REVIEWER-B','REQUESTER-C'])await User.create({...tenant,userId:id,name:id,email:`${id.toLowerCase()}@example.test`,password:'fixture-hash-not-for-login',role:'company_admin',active:true});});
  const app=express();app.use(express.json());app.use((req,_res,next)=>{const id=req.get('x-test-actor')||'OWNER-A';req.user={...tenant,userId:id==='NO-FINANCE'?'REVIEWER-B':id,role:'company_admin',accessPolicyVersion:1,permissions:['erp.read',...(id==='NO-FINANCE'?[]:['erp.accounts']),...(['OWNER-A','REVIEWER-B'].includes(id)?['company.settings','audit.read']:[])]};req.erpModules=['ERP_CORE','ERP_FINANCE'];runWithTenant({...tenant,...req.user},next);});app.use(router);app.use((e,_req,res,_next)=>res.status(e.statusCode||500).json({message:e.message}));server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
  const call=async(path,body,id='OWNER-A')=>{const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','x-test-actor':id,'Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(body)});return {status:res.status,data:await res.json()};};
  const policy=await call('/settings',{enabled:true,threshold:0,types:['JOURNAL'],reviewerLimits:[{userId:'OWNER-A',limit:500},{userId:'REVIEWER-B',limit:50}],escalationHours:1,reason:'Reviewed finance limits'});assert.equal(policy.status,202);
  const review={proposalId:policy.data.proposalId,confirm:'APPROVE POLICY',reason:'Independent review'};assert.equal((await call('/settings/approve',review)).status,409);assert.equal((await call('/settings/approve',review,'REVIEWER-B')).status,200);
  const input={type:'JOURNAL',journalLines:[{account:'OPERATING_EXPENSE',debit:100,credit:0},{account:'CASH',debit:0,credit:100}],notes:'Reviewed adjustment'};
  const first=await call('/',input,'REQUESTER-C');assert.equal(first.status,201);
  assert.equal((await call(`/${first.data._id}/decision`,{action:'APPROVE',reason:'Review'},'NO-FINANCE')).status,403);
  assert.equal((await call(`/${first.data._id}/decision`,{action:'APPROVE',reason:'Review'},'REVIEWER-B')).status,409);
  await runWithTenant(tenant,async()=>{assert.equal(await ErpDocument.countDocuments(),0);assert.equal((await ErpApproval.findById(first.data._id)).status,'APPROVED');});
  assert.equal((await call(`/${first.data._id}/decision`,{action:'REJECT',reason:'Resubmit to higher reviewer'},'REVIEWER-B')).status,200);
  const second=await call('/',input,'REQUESTER-C');assert.equal(second.status,201);
  const results=await Promise.all([1,2].map(()=>call(`/${second.data._id}/decision`,{action:'APPROVE',reason:'Independent reviewed posting'})));assert.ok(results.every(r=>r.status===200));
  await runWithTenant(tenant,async()=>{assert.equal(await ErpDocument.countDocuments(),1);assert.equal((await ErpApproval.findById(second.data._id)).status,'POSTED');const rows=await ErpApprovalAudit.find().sort({sequence:1}).lean();assert.ok(rows.every(auditHashValid));for(let i=1;i<rows.length;i++)assert.equal(rows[i].previousHash,rows[i-1].hash);assert.equal(rows.filter(r=>r.data.action==='POSTED').length,1);await assert.rejects(()=>ErpApprovalAudit.updateOne({_id:rows[0]._id},{$set:{hash:'changed'}}));});
 }finally{if(server)await new Promise(r=>server.close(r));await databaseForName(tenant.databaseName).dropDatabase();await mongoose.disconnect();}
});
