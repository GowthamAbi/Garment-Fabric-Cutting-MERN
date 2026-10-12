import test from 'node:test';
import assert from 'node:assert/strict';
import {subscriptionQuote,assertQuoteFitsUsers,provisioningAccess} from '../src/utils/subscriptionQuote.js';
import {subscriptionAccess} from '../src/utils/subscriptionAccess.js';
const plan={price:100,setupFee:10,taxPercent:18,perUserPrice:20,perDepartmentPrice:30,maxUsers:10,maxDepartments:3,validityDays:30,modules:['FABRIC','SHOP','ERP_CORE','ERP_FINANCE']};
const selection={seats:2,departments:['FABRIC','SHOP']};
test('server quotes selected seats, departments and explicit features',()=>{
 for(const [pricingModel,subtotal] of [['FIXED',110],['PER_USER',50],['PER_DEPARTMENT',70],['COMBINED',210]]){
 const q=subscriptionQuote({...plan,pricingModel},selection);assert.equal(q.subtotalPaise,subtotal*100);assert.equal(q.totalPaise,Math.round(subtotal*118));assert.equal(q.entitlements.maxUsers,2);assert.equal(q.entitlements.maxDepartments,2);assert.deepEqual(q.entitlements.modules,['FABRIC','SHOP','ERP_CORE','ERP_FINANCE']);
 }
});
test('quotes reject invalid selection, fractional prices and package limits',()=>{
 for(const s of [{seats:0,departments:['FABRIC']},{seats:11,departments:['FABRIC']},{seats:1,departments:[]},{seats:1,departments:['FABRIC','FABRIC']},{seats:1,departments:['STITCHING']}])assert.throws(()=>subscriptionQuote(plan,s));
 assert.throws(()=>subscriptionQuote({...plan,price:1.001},selection));assert.throws(()=>subscriptionQuote({...plan,pricingModel:'UNKNOWN'},selection));assert.throws(()=>subscriptionQuote({...plan,modules:['FABRIC']},{seats:1,departments:['FABRIC']}));
 assert.equal(subscriptionQuote({...plan,price:0.1,setupFee:0.2,taxPercent:0},selection).totalPaise,30);
});
test('checkout refuses occupied department removal or insufficient seats',()=>{
 const q=subscriptionQuote(plan,{seats:1,departments:['FABRIC']});
 assert.throws(()=>assertQuoteFitsUsers(q,[{department:'FABRIC'},{department:'FABRIC'}]));assert.throws(()=>assertQuoteFitsUsers(q,[{department:'SHOP'}]));assert.doesNotThrow(()=>assertQuoteFitsUsers(q,[{}]));
});
test('paid provisioning denies operations; valid trial permits access',()=>{
 const end=new Date(Date.now()+86400000);assert.equal(provisioningAccess('Professional'),'PaymentPending');assert.equal(subscriptionAccess({active:true,subscriptionPlan:'Professional',subscriptionStatus:provisioningAccess('Professional'),subscriptionEndsAt:end}).accessAllowed,false);
 assert.equal(subscriptionAccess({active:true,subscriptionPlan:'Trial',subscriptionStatus:provisioningAccess('Trial'),subscriptionEndsAt:end}).accessAllowed,true);
 assert.equal(subscriptionAccess({active:true,subscriptionPlan:'Trial',subscriptionStatus:'Active',subscriptionEndsAt:new Date(0)}).accessAllowed,false);
});
