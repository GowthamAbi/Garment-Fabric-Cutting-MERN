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
import {DepartmentLot,DepartmentBundle} from '../src/erp/departmentModels.js';
import router from '../src/erp/departmentRoutes.js';
import workforceRouter from '../src/erp/workforce.js';
test('real replica-set departmental partial inward, duplicate retry, checking split, retail sale/return and atomic rollback',{skip:!process.env.TEST_MONGODB_URI},async()=>{
 const nonce=crypto.randomBytes(6).toString('hex'),tenant={companyKey:`dept-${nonce}`,databaseName:`ugs_tenant_dept_test_${nonce}`,companyId:new mongoose.Types.ObjectId(),factoryId:new mongoose.Types.ObjectId(),role:'company_admin'};let server;
 await mongoose.connect(process.env.TEST_MONGODB_URI);
 try{
  const hello=await mongoose.connection.db.command({hello:1});assert.ok(hello.setName||hello.msg==='isdbgrid','Transaction-capable cluster required');
  await runWithTenant(tenant,async()=>{
   await Company.create({_id:tenant.companyId,companyName:'Test company',factories:[{_id:tenant.factoryId,name:'Test factory',code:'MAIN'}]});
   await ErpSettings.create({...tenant,key:'ERP',enabled:true});
   await ErpSku.create({...tenant,code:'TEE-M',name:'Tee M',kind:'FINISHED',unit:'PCS',location:'CUTTING'});
   await ErpSku.create({...tenant,code:'BAG',name:'Bag',kind:'CONSUMABLE',unit:'PCS',location:'ACCESSORIES'});
   await ErpBalance.create({...tenant,key:'TEE-M@CUTTING',sku:'TEE-M',location:'CUTTING',qty:10000,value:10000});
   await ErpBalance.create({...tenant,key:'BAG@ACCESSORIES',sku:'BAG',location:'ACCESSORIES',qty:10000,value:1000});
  });
  const app=express();app.use(express.json());app.use((req,_res,next)=>runWithTenant(tenant,()=>{req.user={...tenant,userId:'TEST-ADMIN'};next();}));app.use(router);app.use("/workforce",workforceRouter);app.use((e,_req,res,_next)=>res.status(e.statusCode||500).json({message:e.message}));server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
  const call=async(path,body)=>{const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:crypto.randomUUID(),...body})});return {status:response.status,data:await response.json()};};
  const ok=async(path,body)=>{const r=await call(path,body);assert.equal(r.status,200,JSON.stringify(r.data));return r.data;};
  await ok('/masters',{kind:'STITCHING',masterKey:'OPS-1',sku:'TEE-M',operations:['Join']});
  await ok('/masters',{kind:'PACKING',masterKey:'PACK-1',sku:'TEE-M',materials:[{sku:'BAG',quantity:1,perPieces:1}]});
  await ok('/masters',{kind:'WAREHOUSE',masterKey:'WH-1',name:'Warehouse'});await ok('/masters',{kind:'SHOP',masterKey:'SHOP-1',name:'Shop'});
  const request={key:crypto.randomUUID(),sku:'TEE-M',quantity:10,sourceLocation:'CUTTING',operationMaster:'OPS-1',packingMaster:'PACK-1',orderNo:'ORDER1',dcNo:'DC1',section:'SECTION1'};
  const delivery=await ok('/delivery',request),retry=await ok('/delivery',request);assert.equal(delivery._id,retry._id);
  let b=(await ok('/advance',{bundleId:delivery.bundleId,quantity:10})).details.bundle;
  b=(await ok('/advance',{bundleId:b._id,quantity:10})).details.bundle;
  b=(await ok('/advance',{bundleId:b._id,quantity:6})).details.bundle;
  await runWithTenant(tenant,async()=>{const lot=await DepartmentLot.findById(delivery.lotId).lean();assert.equal(lot.sent,10);assert.equal(lot.received,6);});
  assert.equal((await call('/check',{bundleId:b._id,good:7})).status,409);
  const checked=await ok('/check',{bundleId:b._id,good:4,rework:1,oil:1,reject:0});assert.equal(checked.details.children.length,3);
  // Both defect routes return to checking and can cycle again without inflating original DC inward.
  for(const kind of ['REWORK','OIL']){
   let repair=checked.details.children.find(c=>c.stage===kind);
   repair=(await ok('/advance',{bundleId:repair._id,quantity:1})).details.bundle;
   repair=(await ok('/advance',{bundleId:repair._id,quantity:1})).details.bundle;
   assert.equal(repair.stage,'CHECKING');assert.equal(repair.cycle,2);
   const again=await ok('/check',{bundleId:repair._id,[kind==='REWORK'?'rework':'oil']:1});
   repair=again.details.children[0];repair=(await ok('/advance',{bundleId:repair._id,quantity:1})).details.bundle;
   repair=(await ok('/advance',{bundleId:repair._id,quantity:1})).details.bundle;
   const passed=await ok('/check',{bundleId:repair._id,good:1});assert.equal(passed.details.children[0].cycle,3);
  }
  await runWithTenant(tenant,async()=>assert.equal((await DepartmentLot.findById(delivery.lotId)).received,6));
  b=checked.details.children.find(c=>c.stage==='GOOD');b=(await ok('/advance',{bundleId:b._id,quantity:4})).details.bundle;b=(await ok('/advance',{bundleId:b._id,quantity:4})).details.bundle;
  const before=b._id;assert.equal((await call('/pack',{bundleId:before,quantity:5})).status,409);await runWithTenant(tenant,async()=>assert.equal((await DepartmentBundle.findById(before)).qty,4));
  b=(await ok('/pack',{bundleId:before,quantity:4})).details.carton;
  b=(await ok('/transfer',{bundleId:b._id,quantity:4,destination:'WH-1'})).details.bundle;
  b=(await ok('/transfer',{bundleId:b._id,quantity:4})).details.bundle;
  b=(await ok('/transfer',{bundleId:b._id,quantity:4,destination:'SHOP-1'})).details.bundle;
  b=(await ok('/transfer',{bundleId:b._id,quantity:4})).details.bundle;
  const sale=(await ok('/sale',{bundleId:b._id,quantity:2,unitPrice:200,taxPercent:0,paymentMode:'CASH'})).details.sale;
  await ok('/return',{saleId:sale._id,quantity:1,reason:'Size return'});assert.equal((await call('/return',{saleId:sale._id,quantity:2,reason:'Excess'})).status,409);
  assert.equal((await call('/workforce/employees',{code:'EMP1',name:'Test worker'})).status,201);
  const payrollResponse=await fetch(base+'/workforce/payslips',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({employeeCode:'EMP1',period:'2026-10',basic:10000,notes:'Reviewed payroll'})});
  assert.equal(payrollResponse.status,200);const slip=await payrollResponse.json();
  const accrued=await ok(`/workforce/payslips/${slip._id}/accrual`,{confirm:'POST PAYROLL'});
  const accruedRetry=await ok(`/workforce/payslips/${slip._id}/accrual`,{confirm:'POST PAYROLL'});assert.equal(accrued._id,accruedRetry._id);
  assert.equal((await call(`/workforce/payslips/${slip._id}/void`,{confirm:'VOID PAYSLIP',reason:'Correction'})).status,409);
  await ok(`/workforce/payslips/${slip._id}/reverse-accrual`,{confirm:'REVERSE PAYROLL',reason:'Reviewed correction'});
  await ok(`/workforce/payslips/${slip._id}/void`,{confirm:'VOID PAYSLIP',reason:'Corrected salary'});
  const reconciliationResponse=await fetch(base+'/reconciliation');assert.equal(reconciliationResponse.status,200);const report=await reconciliationResponse.json();assert.equal(report.reconciliation.balanced,true);assert.equal(report.sections[0].pending,4);
  await runWithTenant(tenant,async()=>{const entries=await ErpEntry.find({kind:'JOURNAL'}).lean();assert.equal(entries.reduce((n,e)=>n+e.debit-e.credit,0),0);});
 }finally{if(server)await new Promise(r=>server.close(r));await databaseForName(tenant.databaseName).dropDatabase();await mongoose.disconnect();}
});
