import '../src/config/mongoosePlugins.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import express from 'express';
import Company from '../src/models/Company.js';
import {runWithTenant} from '../src/utils/tenantContext.js';
import {databaseForName} from '../src/config/tenantDatabase.js';
import {ErpSettings,ErpSku,ErpBalance,ErpEntry} from '../src/erp/models.js';
import {DepartmentBundle} from '../src/erp/departmentModels.js';
import router from '../src/erp/departmentRoutes.js';
test('real replica-set standalone ironing: external duplicate prevention, partial output, concurrent rollback and factory isolation',{skip:!process.env.TEST_MONGODB_URI},async()=>{
 const nonce=crypto.randomBytes(6).toString('hex'),tenant={companyKey:`boundary-${nonce}`,databaseName:`ugs_tenant_boundary_test_${nonce}`,companyId:new mongoose.Types.ObjectId(),factoryId:new mongoose.Types.ObjectId(),role:'company_owner'},otherFactory=new mongoose.Types.ObjectId();let server;
 await mongoose.connect(process.env.TEST_MONGODB_URI);
 try{
  const hello=await mongoose.connection.db.command({hello:1});assert.ok(hello.setName||hello.msg==='isdbgrid','Replica set required');
  await runWithTenant(tenant,async()=>{
   await Company.create({_id:tenant.companyId,companyName:'Standalone ironing',departmentCatalogueVersion:1,enabledDepartments:['IRONING'],entitlements:{maxUsers:2,maxDepartments:1,modules:['IRONING','ERP_CORE']},factories:[{_id:tenant.factoryId,name:'Main',code:'MAIN'},{_id:otherFactory,name:'Other',code:'OTHER'}]});
   await ErpSettings.create({...tenant,key:'ERP',enabled:true});await ErpSku.create({...tenant,code:'TEE-M',name:'Tee M',kind:'FINISHED',unit:'PCS',location:'FINISHED'});
  });
  const app=express();app.use(express.json());app.use((req,_res,next)=>runWithTenant({...tenant,...(req.get('x-test-factory')==='OTHER'&&{factoryId:otherFactory})},()=>{req.user={...tenant,userId:'OWNER'};next();}));app.use(router);app.use((e,_req,res,_next)=>res.status(e.statusCode||500).json({message:e.message}));server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
  const call=async(path,body)=>{const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:crypto.randomUUID(),...body})});return {status:res.status,data:await res.json()};};
  const ok=async(path,body)=>{const r=await call(path,body);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
  const input={key:crypto.randomUUID(),department:'IRONING',sku:'TEE-M',quantity:10,totalValue:100,reference:'EXT-001',counterparty:'External checker'};
  const received=await ok('/external-inward',input);assert.equal((await ok('/external-inward',input))._id,received._id);assert.equal((await call('/external-inward',{...input,key:crypto.randomUUID()})).status,409);
  let b=(await ok('/advance',{bundleId:received.bundleId,quantity:6})).details.bundle;b=(await ok('/advance',{bundleId:b._id,quantity:6})).details.bundle;
  await ok('/external-outward',{department:'IRONING',bundleId:b._id,quantity:5,reference:'OUT-001',counterparty:'External packer'});
  assert.equal((await call('/external-outward',{department:'IRONING',bundleId:b._id,quantity:2,reference:'OUT-BAD',counterparty:'External packer'})).status,409);
  await runWithTenant(tenant,async()=>assert.equal((await DepartmentBundle.findById(b._id)).qty,1));
  const attempts=await Promise.all(['OUT-002','OUT-003'].map(reference=>call('/external-outward',{department:'IRONING',bundleId:b._id,quantity:1,reference,counterparty:'External packer'})));assert.deepEqual(attempts.map(a=>a.status).sort(),[200,409]);
  await runWithTenant(tenant,async()=>{const balances=await ErpBalance.find().lean();assert.equal(balances.reduce((n,b)=>n+b.qty,0),4000);assert.equal(balances.reduce((n,b)=>n+b.value,0),4000);const entries=await ErpEntry.find({kind:'JOURNAL'}).lean();assert.equal(entries.reduce((n,e)=>n+e.debit-e.credit,0),0);});
  const other=await fetch(base+'/IRONING/dashboard',{headers:{'x-test-factory':'OTHER'}});assert.equal(other.status,200);assert.deepEqual((await other.json()).bundles,[]);
 }finally{if(server)await new Promise(r=>server.close(r));await databaseForName(tenant.databaseName).dropDatabase();await mongoose.disconnect();}
});
