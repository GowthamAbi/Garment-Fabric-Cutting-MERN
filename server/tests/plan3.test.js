import test from 'node:test';
import assert from 'node:assert/strict';
import {purchasedSubscriptionPeriod} from '../src/utils/subscriptionPeriod.js';
import crypto from 'node:crypto';
import {providerOrderMatches,validBillingSnapshot} from '../src/utils/paymentPolicy.js';
import {razorpayWebhook} from '../src/controllers/saasController.js';
import BillingRequest from '../src/models/BillingRequest.js';
import {PaymentInbox} from '../src/automation/models.js';
test('provider order must match server amount and INR currency',()=>{const order={id:'order_test',amount:70000,currency:'INR'};assert.equal(providerOrderMatches(order,700),true);for(const change of [{amount:1},{currency:'USD'},{id:''}])assert.equal(providerOrderMatches({...order,...change},700),false);});
test('frozen billing duration and entitlement limits must be valid',()=>{const billing={validityDays:30,entitlements:{maxUsers:5,maxDepartments:3,modules:['ERP_CORE']}};assert.equal(validBillingSnapshot(billing),true);assert.equal(validBillingSnapshot({...billing,validityDays:0}),false);assert.equal(validBillingSnapshot({...billing,entitlements:undefined}),false);});
test('signed captured webhook queues idempotently and ignores failed events',async t=>{
 const old=process.env.RAZORPAY_WEBHOOK_SECRET;process.env.RAZORPAY_WEBHOOK_SECRET='test-secret';
 try{t.mock.method(BillingRequest,'findOne',()=>({lean:async()=>({_id:'billing',amount:700,providerOrderId:'order_test',paymentMethod:'RAZORPAY'})}));t.mock.method(PaymentInbox,'init',async()=>{});let keys=[];t.mock.method(PaymentInbox,'findOneAndUpdate',async filter=>keys.push(filter.key));
 const body={event:'payment.captured',payload:{payment:{entity:{id:'pay_test',order_id:'order_test',status:'captured',amount:70000,currency:'INR'}}}};
 const request=body=>{const rawBody=JSON.stringify(body);return {body,rawBody,get:()=>crypto.createHmac('sha256','test-secret').update(rawBody).digest('hex')};};const response={status(){return this;},json(){}};
 await razorpayWebhook(request(body),response);await razorpayWebhook(request(body),response);assert.deepEqual(keys,['capture-pay_test','capture-pay_test']);
 await razorpayWebhook(request({...body,event:'payment.failed'}),response);assert.equal(keys.length,2);
 await assert.rejects(()=>razorpayWebhook({...request(body),get:()=> '0'.repeat(64)},response),error=>error.statusCode===401);
 const mismatch=structuredClone(body);mismatch.payload.payment.entity.amount=1;await assert.rejects(()=>razorpayWebhook(request(mismatch),response),error=>error.statusCode===409);
 }finally{if(old===undefined)delete process.env.RAZORPAY_WEBHOOK_SECRET;else process.env.RAZORPAY_WEBHOOK_SECRET=old;}
});

test('trial upgrade does not add free remaining days; paid renewal preserves purchased time',()=>{const now=1000,end=new Date(now+7*86400000);assert.equal(purchasedSubscriptionPeriod({subscriptionPlan:'Trial',subscriptionEndsAt:end},30,now).periodEnd.getTime(),now+30*86400000);assert.equal(purchasedSubscriptionPeriod({subscriptionPlan:'Professional',subscriptionEndsAt:end},30,now).periodEnd.getTime(),now+37*86400000);});
