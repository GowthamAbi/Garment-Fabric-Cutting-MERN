import test from 'node:test';
import assert from 'node:assert/strict';
import {trialExpiry,subscriptionAccess,reminderBucket} from '../src/utils/subscriptionAccess.js';
import {requireActiveSubscription} from '../src/middleware/subscriptionMiddleware.js';
import Company from '../src/models/Company.js';
import {runWithTenant} from '../src/utils/tenantContext.js';
const now=Date.UTC(2026,9,11);
test('trial expiry starts at approval and lasts exactly fourteen days',()=>{assert.equal(trialExpiry(now).getTime()-now,14*86400000);});
test('expiry boundary and missing dates cannot grant perpetual access',()=>{
 const company={active:true,subscriptionStatus:'Active',subscriptionPlan:'Trial',subscriptionEndsAt:trialExpiry(now)};
 assert.equal(subscriptionAccess(company,now).daysRemaining,14);assert.equal(subscriptionAccess(company,now).accessAllowed,true);
 assert.equal(subscriptionAccess(company,trialExpiry(now).getTime()).accessAllowed,false);
 assert.equal(subscriptionAccess({...company,subscriptionEndsAt:undefined},now).accessAllowed,false);
 assert.equal(subscriptionAccess({...company,subscriptionStatus:'Suspended'},now).accessAllowed,false);
});
test('reminders use stable thresholds even if a daily worker run was missed',()=>{
 for(const [days,bucket] of [[10,null],[7,7],[5,7],[3,3],[2,3],[1,1],[0,0],[-3,0]])assert.equal(reminderBucket(new Date(now+days*86400000),now),bucket);
});
test('expired company business API is denied independently of scheduled worker',async t=>{
 await runWithTenant({companyKey:'test-company',databaseName:'ugs_tenant_test_company'},async()=>{
 const model=Company.model('Company');t.mock.method(model,'findById',()=>({lean:async()=>({active:true,subscriptionStatus:'Active',subscriptionEndsAt:new Date(Date.now()-1000)})}));let result;
 await requireActiveSubscription({user:{role:'company_admin'},path:'/erp/documents'},{},e=>{result=e;});assert.equal(result.statusCode,402);
 });
});

test('valid current access does not depend on a failed pending upgrade',()=>{const company={active:true,subscriptionStatus:'Active',subscriptionPlan:'Professional',subscriptionEndsAt:new Date(now+86400000)};assert.equal(subscriptionAccess(company,now).accessAllowed,true);});
