import test from 'node:test';
import assert from 'node:assert/strict';
import {activationEmailConfiguration,issueEmailVerification,issuePasswordReset} from '../src/services/accountEmailService.js';
test('activation configuration blocks missing provider settings and production localhost',()=>{
 const old={...process.env};try{delete process.env.RESEND_API_KEY;delete process.env.EMAIL_FROM;assert.throws(()=>activationEmailConfiguration(),/Configure RESEND/);process.env.RESEND_API_KEY='test-key';process.env.EMAIL_FROM='UG SaaS <no-reply@example.com>';process.env.CLIENT_URL='http://localhost:5173';process.env.NODE_ENV='production';assert.throws(()=>activationEmailConfiguration(),/public HTTPS/);process.env.CLIENT_URL='https://example.com/';assert.equal(activationEmailConfiguration(),'https://example.com');}finally{for(const k of ['RESEND_API_KEY','EMAIL_FROM','CLIENT_URL','NODE_ENV'])if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}
});
test('activation saves a hashed token, sends company URL and reports provider rejection',async()=>{
 const old={...process.env},originalFetch=globalThis.fetch;try{
  process.env.RESEND_API_KEY='test-key';process.env.EMAIL_FROM='UG SaaS <no-reply@example.com>';process.env.CLIENT_URL='https://example.com';process.env.NODE_ENV='production';let saved=0,payload;
  const user={userId:'UGS-ADMIN-1001',email:'admin@example.com',save:async()=>{saved++;}};
  globalThis.fetch=async(_url,options)=>{payload=JSON.parse(options.body);return {ok:true,status:200};};const link=await issueEmailVerification(user,'company-a');assert.equal(saved,1);assert.match(link,/https:\/\/example.com\/c\/company-a\/login\?verifyToken=/);assert.equal(user.emailVerificationToken.length,64);assert.notEqual(user.emailVerificationToken,link.split('verifyToken=')[1]);assert.equal(payload.to[0],user.email);assert.match(payload.html,/UGS-ADMIN-1001/);
  globalThis.fetch=async()=>({ok:false,status:403});await assert.rejects(()=>issueEmailVerification(user,'company-a'),/status 403/);
 }finally{globalThis.fetch=originalFetch;for(const k of ['RESEND_API_KEY','EMAIL_FROM','CLIENT_URL','NODE_ENV'])if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}
});

test('production activation chooses HTTPS frontend from a CORS origin list',()=>{
 const old={...process.env};try{process.env.RESEND_API_KEY='test';process.env.EMAIL_FROM='no-reply@example.com';process.env.NODE_ENV='production';process.env.CLIENT_URL='http://localhost:5173,https://ugsaas.com';assert.equal(activationEmailConfiguration(),'https://ugsaas.com');}finally{for(const k of ['RESEND_API_KEY','EMAIL_FROM','CLIENT_URL','NODE_ENV'])if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}
});

test('reset delivery uses production URL, hashes token and rejects provider failure/timeout', async()=>{
 const old={...process.env},originalFetch=globalThis.fetch;
 try {
  process.env.RESEND_API_KEY='test';process.env.EMAIL_FROM='UG SaaS <no-reply@example.com>';process.env.CLIENT_URL='http://localhost:5173,https://ugsaas.com';process.env.NODE_ENV='production';
  let payload,signal;const user={email:'user@example.com',save:async()=>{}};
  globalThis.fetch=async(_url,options)=>{payload=JSON.parse(options.body);signal=options.signal;return {ok:true,status:200};};
  const url=await issuePasswordReset(user,'company-a');
  assert.match(url,/^https:\/\/ugsaas.com\/c\/company-a\/login\?resetToken=/);
  assert.equal(user.resetPasswordToken.length,64);assert.notEqual(user.resetPasswordToken,url.split('=')[1]);assert.ok(signal);assert.match(payload.html,/15 minutes/);
  globalThis.fetch=async()=>({ok:false,status:403});await assert.rejects(()=>issuePasswordReset(user,'company-a'),/status 403/);
  globalThis.fetch=async()=>{throw new Error('private network diagnostic');};await assert.rejects(()=>issuePasswordReset(user,'company-a'),error=>error.statusCode===502&&!error.message.includes('private'));
  delete process.env.RESEND_API_KEY;await assert.rejects(()=>issuePasswordReset(user,'company-a'),error=>error.statusCode===503);
 }finally{globalThis.fetch=originalFetch;for(const k of ['RESEND_API_KEY','EMAIL_FROM','CLIENT_URL','NODE_ENV'])if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}
});
