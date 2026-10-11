import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../src/models/User.js';
import {runWithTenant} from '../src/utils/tenantContext.js';
import {DEPARTMENTS} from '../src/erp/departmentPolicy.js';
import {generateUserId} from '../src/utils/generateUserId.js';
import {createUser,resendUserActivation} from '../src/controllers/authController.js';
import {errorHandler} from '../src/middleware/errorHandler.js';

test('all operational departments validate and generate department user IDs',async t=>{
 await runWithTenant({companyKey:'test-company',databaseName:'ugs_tenant_test_company'},async()=>{
  const model=User.model('User');t.mock.method(model,'exists',async()=>false);
  for(const department of DEPARTMENTS){const id=await generateUserId({name:'Kumar',department,role:'department_entry'});const user=new User({userId:id,name:'Kumar',email:'k@example.com',password:'hash',role:'department_entry',department});assert.equal(user.validateSync(),undefined);assert.ok(!id.startsWith('UGS-USR-'));}
 });
});

test('duplicate and malformed database input returns safe actionable status',()=>{
 for(const error of [{code:11000,message:'private duplicate data'},{name:'CastError',message:'private value'}]){let body,status;errorHandler(error,{}, {status(v){status=v;return this;},json(v){body=v;}},()=>{});assert.equal(status,error.code?409:400);assert.ok(!body.message.includes('private'));}
});

test('mail rejection preserves created user and returns FAILED instead of creation failure',async t=>{
 const old={...process.env};const originalFetch=globalThis.fetch;
 try{process.env.RESEND_API_KEY='test';process.env.EMAIL_FROM='no-reply@example.com';process.env.CLIENT_URL='https://example.com';process.env.NODE_ENV='production';globalThis.fetch=async()=>({ok:false,status:403});t.mock.method(console,'error',()=>{});
 await runWithTenant({companyKey:'test-company',databaseName:'ugs_tenant_test_company'},async()=>{
  const model=User.model('User');t.mock.method(model,'exists',async()=>false);let created=0;
  t.mock.method(model,'create',async data=>{created++;return {...data,_id:'abc',save:async()=>{}};});
  let status,body;await createUser({body:{name:'Kumar',email:' K@example.com ',password:'V7!qLp#892rz',role:'department_entry',department:'CHECKING'},user:{role:'saas_super_admin'}},{status(v){status=v;return this;},json(v){body=v;}});
  assert.equal(created,1);assert.equal(status,201);assert.equal(body.activationEmailStatus,'FAILED');assert.equal(body.email,'k@example.com');assert.equal(body.activationUrl,undefined);
 });}finally{globalThis.fetch=originalFetch;for(const k of ['RESEND_API_KEY','EMAIL_FROM','CLIENT_URL','NODE_ENV'])if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}
});

test('activation resend scopes lookup to customer company and factory',async t=>{
 await runWithTenant({companyKey:'test-company',databaseName:'ugs_tenant_test_company'},async()=>{
  const model=User.model('User');t.mock.method(model,'findOne',async filter=>{assert.equal(filter.companyId,'company-a');assert.equal(filter.factoryId,'factory-a');return null;});
  await assert.rejects(()=>resendUserActivation({params:{id:'507f1f77bcf86cd799439011'},user:{companyId:'company-a',factoryId:'factory-a'}},{}),error=>error.statusCode===404);
 });
});
