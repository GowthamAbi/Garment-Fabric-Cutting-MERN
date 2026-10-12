import test from 'node:test';
import assert from 'node:assert/strict';
import {approvalPolicy,reviewerAllowed,assertApprovalLimit,approvalDue,reviewerCanDecide} from '../src/erp/approvalPolicy.js';
import {auditHashValid} from '../src/erp/approvalAudit.js';
import {requestHash} from '../src/erp/service.js';
const body={enabled:true,threshold:100,types:['PAYMENT'],reviewerLimits:[{userId:'REVIEWER',limit:500}],escalationHours:24};
test('approval policy validates reviewer candidates, paise and escalation bounds',()=>{
 const p=approvalPolicy(body);assert.equal(p.approvalThreshold,10000);assert.equal(p.reviewerLimits[0].limitPaise,50000);
 for(const b of [{...body,reviewerLimits:[]},{...body,reviewerLimits:[{userId:'A',limit:-1}]},{...body,reviewerLimits:[{userId:'A',limit:1},{userId:'A',limit:2}]},{...body,escalationHours:0},{...body,types:['OPENING']},{...body,threshold:1.001}])assert.throws(()=>approvalPolicy(b));
});
test('actual exposure respects reviewer limits; owner does not override explicit policy',()=>{
 const p=approvalPolicy(body);assert.doesNotThrow(()=>assertApprovalLimit(p,'REVIEWER',50000));assert.throws(()=>assertApprovalLimit(p,'REVIEWER',50001));assert.throws(()=>assertApprovalLimit(p,'OWNER',1));assert.equal(reviewerAllowed(p,'OWNER',true),false);assert.equal(reviewerAllowed({},'LEGACY',true),true);
});
test('approval queue cannot bypass financial posting permissions',()=>{
 const p=approvalPolicy(body),u={userId:'REVIEWER',role:'company_admin',accessPolicyVersion:1,permissions:['erp.read']};assert.equal(reviewerCanDecide(p,u,'PAYMENT',true),false);assert.equal(reviewerCanDecide(p,{...u,permissions:['erp.accounts']},'PAYMENT',true),true);assert.equal(reviewerCanDecide(p,{...u,userId:'OTHER',permissions:['erp.accounts']},'PAYMENT',true),false);
});
test('pending request due time escalates to owner without automatic approval',()=>{
 const due='2026-10-01T00:00:00Z',now=new Date(due).getTime();assert.equal(approvalDue({status:'PENDING',dueAt:due},now-1).overdue,false);assert.equal(approvalDue({status:'PENDING',dueAt:due},now).escalatedTo,'COMPANY_OWNER');assert.equal(approvalDue({status:'POSTED',dueAt:due},now).overdue,false);
});
test('audit hashes detect actor changes and modified previous links',()=>{
 const r={sequence:1,previousHash:'GENESIS',data:{action:'APPROVED',actor:'REVIEWER',recordedAt:'2026-10-01'}};r.hash=requestHash(r);assert.equal(auditHashValid(r),true);assert.equal(auditHashValid({...r,data:{...r.data,actor:'OTHER'}}),false);assert.equal(auditHashValid({...r,previousHash:'CHANGED'}),false);
});
