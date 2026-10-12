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
import PurchaseOrder from '../src/models/PurchaseOrder.js';
import {ErpSettings,ErpSku,ErpParty,ErpBalance,ErpDocument} from '../src/erp/models.js';
import factoryRouter from '../src/routes/factory.routes.js';
import erpRouter from '../src/erp/routes.js';
test('real replica-set company lifecycle: factory ownership, scoped PO identity and concurrent receipt/cancellation',{skip:!process.env.TEST_MONGODB_URI},async()=>{
 const nonce=crypto.randomBytes(6).toString('hex'),tenant={companyKey:`lifecycle-${nonce}`,databaseName:`ugs_tenant_lifecycle_test_${nonce}`,companyId:new mongoose.Types.ObjectId(),factoryId:new mongoose.Types.ObjectId(),role:'company_owner',accessScope:'COMPANY',accessPolicyVersion:1},ownerId=new mongoose.Types.ObjectId();let server,secondFactory;
 await mongoose.connect(process.env.TEST_MONGODB_URI);
 try{
  const hello=await mongoose.connection.db.command({hello:1});assert.ok(hello.setName||hello.msg==='isdbgrid','Replica set required');
  await runWithTenant(tenant,async()=>{await Company.create({_id:tenant.companyId,companyName:'Lifecycle fixture',ownerUserId:ownerId,entitlements:{maxUsers:5,maxDepartments:1,modules:['ACCESSORIES','ERP_CORE','ERP_FINANCE']},factories:[{_id:tenant.factoryId,name:'Main',code:'MAIN'}]});await User.create({...tenant,_id:ownerId,userId:'OWNER',name:'Owner',email:'owner@example.test',password:'fixture-not-for-auth',assignedFactoryIds:[tenant.factoryId],active:true});await ErpSettings.create({...tenant,key:'ERP',enabled:true});await ErpSku.create({...tenant,code:'BTN',name:'Button',kind:'CONSUMABLE',unit:'PCS',location:'ACCESSORIES'});await ErpParty.create({...tenant,code:'SUP',name:'Supplier',kind:'SUPPLIER'});});
  const app=express();app.use(express.json());app.use((req,_res,next)=>{const scope={...tenant,...(req.get('x-test-factory')==='SECOND'&&{factoryId:secondFactory})};req.user={...scope,id:String(ownerId),userId:'OWNER',permissions:[]};runWithTenant(scope,next);});app.use('/factories',factoryRouter);app.use('/erp',erpRouter);app.use((e,_req,res,_next)=>res.status(e.statusCode||500).json({message:e.message}));server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
  const call=async(path,body)=>{const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(body)});return {status:res.status,data:await res.json()};};
  const factory=await call('/factories',{name:'Second',code:'SECOND'});assert.equal(factory.status,201,JSON.stringify(factory.data));secondFactory=factory.data._id;assert.equal((await call('/factories',{name:'Duplicate',code:'second'})).status,409);
  await runWithTenant(tenant,async()=>{assert.ok((await User.findById(ownerId)).assignedFactoryIds.map(String).includes(String(secondFactory)));await PurchaseOrder.init();const po={poNo:'SAME-PO',itemCode:'BTN',deliveryDate:new Date(),orderQty:10};await PurchaseOrder.create({...tenant,...po});await PurchaseOrder.create({...tenant,factoryId:secondFactory,...po});assert.equal(await PurchaseOrder.countDocuments(),1);});
  const po=await call('/erp/documents',{type:'PURCHASE_ORDER',partyCode:'SUP',lines:[{sku:'BTN',quantity:10,rate:5,taxPercent:0}]});assert.equal(po.status,201,JSON.stringify(po.data));
  const actions=await Promise.all([call('/erp/documents',{type:'GOODS_RECEIPT',sourceId:po.data._id,partyCode:'SUP',lines:[{sku:'BTN',quantity:10,rate:5,location:'ACCESSORIES'}]}),call(`/erp/purchase-orders/${po.data._id}/lifecycle`,{action:'CANCEL',reason:'Reviewed cancellation'})]);
  assert.ok(actions.some(r=>r.status===409),JSON.stringify(actions));assert.ok(actions.some(r=>[200,201].includes(r.status)),JSON.stringify(actions));
  await runWithTenant(tenant,async()=>{const order=await ErpDocument.findById(po.data._id);if(order.cancelledAt){assert.equal(await ErpDocument.countDocuments({type:'GOODS_RECEIPT'}),0);assert.equal(await ErpBalance.countDocuments(),0);}else{assert.equal(await ErpDocument.countDocuments({type:'GOODS_RECEIPT'}),1);assert.equal((await ErpBalance.findOne({sku:'BTN'})).qty,10000);}});
  const other=await fetch(base+'/erp/purchase-orders',{headers:{'x-test-factory':'SECOND'}});assert.equal(other.status,200);assert.deepEqual(await other.json(),[]);
 }finally{if(server)await new Promise(r=>server.close(r));await databaseForName(tenant.databaseName).dropDatabase();await mongoose.disconnect();}
});
