import "../src/config/mongoosePlugins.js";
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import express from "express";
import Company from "../src/models/Company.js";
import {DEPARTMENTS} from "../../shared/departmentCatalogue.js";
import {runWithTenant} from "../src/utils/tenantContext.js";
import {databaseForName} from "../src/config/tenantDatabase.js";
import {ErpSettings,ErpSku,ErpBalance,ErpDocument,ErpEntry} from "../src/erp/models.js";
import {DepartmentBundle,DepartmentLot,DepartmentMaster} from "../src/erp/departmentModels.js";
import departmentRoutes from "../src/erp/departmentRoutes.js";

/**
 * Real-MongoDB, ephemeral factory integration gate:
 * Cutting stock -> delivery -> stitching -> inward -> checking -> ironing ->
 * packing -> dispatch -> Warehouse receipt -> Shop receipt -> paid POS ->
 * returned piece -> GL. Role/subscription isolation is asserted at handoffs.
 * Not a replacement for legacy Fabric/Cutting form/browser acceptance.
 */
test("Phase 2: end-to-end partial cartons, separate department roles, Shop POS to Accounts GL",
 {skip:!process.env.TEST_MONGODB_URI},async()=>{
 const nonce=crypto.randomBytes(6).toString("hex");
 const factoryId=new mongoose.Types.ObjectId(),otherFactory=new mongoose.Types.ObjectId();
 const tenant={companyKey:"phase2-"+nonce,databaseName:"ugs_tenant_phase2_test_"+nonce,
  companyId:new mongoose.Types.ObjectId(),factoryId,role:"company_owner"};
 const departments=[...DEPARTMENTS],modules=[...departments,"ERP_CORE","ERP_FINANCE","ERP_HR"];
 let server;
 await mongoose.connect(process.env.TEST_MONGODB_URI);
 try{
  const hello=await mongoose.connection.db.command({hello:1});
  assert.ok(hello.setName||hello.msg==="isdbgrid","Disposable transactional replica set required");
  await runWithTenant(tenant,async()=>{
   await Company.create({_id:tenant.companyId,companyName:"Phase 2 Dummy Factory",
    departmentCatalogueVersion:1,enabledDepartments:departments,
    entitlements:{maxUsers:30,maxDepartments:16,modules},
    factories:[{_id:factoryId,name:"Main Dummy",code:"TEST"},
     {_id:otherFactory,name:"Isolated Dummy",code:"TEST2"}]});
   await ErpSettings.create({...tenant,key:"ERP",enabled:true});
   await ErpSku.create({...tenant,code:"TEE-QA",name:"Integration Tee",kind:"FINISHED",
    unit:"PCS",location:"CUTTING"});
   await ErpSku.create({...tenant,code:"BAG-QA",name:"Packing Bag",kind:"CONSUMABLE",
    unit:"PCS",location:"ACCESSORIES"});
   await ErpBalance.create({...tenant,key:"TEE-QA@CUTTING",sku:"TEE-QA",
    location:"CUTTING",qty:6000,value:12000});
   await ErpBalance.create({...tenant,key:"BAG-QA@ACCESSORIES",sku:"BAG-QA",
    location:"ACCESSORIES",qty:6000,value:600});
  });
  const users={
   OWNER:{role:"company_owner"},
   FORGED:{role:"department_entry",department:"WAREHOUSE",
    permissions:["department.warehouse.read","department.warehouse.write"]},
   DISPATCH:{role:"department_entry",department:"DISPATCH",
    permissions:["department.dispatch.read","department.dispatch.write"]},
   WAREHOUSE_OTHER:{role:"department_entry",department:"WAREHOUSE",
    permissions:["department.warehouse.read","department.warehouse.write"],
    assignedWarehouseKeys:[String(factoryId)+":WH-QA2"]},
   WAREHOUSE:{role:"department_entry",department:"WAREHOUSE",
    permissions:["department.warehouse.read","department.warehouse.write"],
    assignedWarehouseKeys:[String(factoryId)+":WH-QA"]},
   SHOP2:{role:"department_entry",department:"SHOP",
    permissions:["department.shop.read","department.shop.write"],
    assignedShopKeys:[String(factoryId)+":SH-QA2"]},
   SHOP:{role:"department_entry",department:"SHOP",
    permissions:["department.shop.read","department.shop.write"],
    assignedShopKeys:[String(factoryId)+":SH-QA"]},
   ACCOUNTS_HEAD:{role:"department_incharge",department:"ACCOUNTS",
    permissions:["department.accounts.read","erp.finance.read"]},
   ACCOUNTS_NO_FINANCE:{role:"department_entry",department:"ACCOUNTS",
    permissions:["department.accounts.read","department.accounts.write"]},
   ACCOUNTS_POST:{role:"department_entry",department:"ACCOUNTS",
    permissions:["department.accounts.read","department.accounts.write",
     "erp.finance.read","erp.accounts"]}
  };
  const app=express();app.use(express.json());
  app.use((req,_res,next)=>{
   const context=req.get("x-test-factory")==="OTHER"?{...tenant,factoryId:otherFactory}:tenant;
   return runWithTenant(context,()=>{
    const roleKey=req.get("x-test-role")||"OWNER",user=users[roleKey];
    if(!user)return next(new Error("Unknown synthetic test role"));
    req.user={...context,...user,userId:"PHASE2_"+roleKey,
     accessPolicyVersion:user.role==="company_owner"?undefined:1,
     accessScope:user.role==="company_owner"?"COMPANY":"DEPARTMENT"};
    next();
   });
  });
  app.use(departmentRoutes);
  app.use((error,_req,res,_next)=>res.status(error.statusCode||500).json({message:error.message}));
  server=app.listen(0,"127.0.0.1");
  await new Promise(resolve=>server.once("listening",resolve));
  const url="http://127.0.0.1:"+server.address().port;
  const request=async(path,{method="GET",body,role="OWNER",factory="MAIN",key}={})=>{
   const response=await fetch(url+path,{method,headers:{
    "Content-Type":"application/json","x-test-role":role,"x-test-factory":factory,
    ...(key?{"Idempotency-Key":key}:{})},
    ...(method!=="GET"?{body:JSON.stringify(body)}:{})});
   return {status:response.status,data:await response.json()};
  };
  const post=(path,body,role="OWNER",key=crypto.randomUUID())=>
   request(path,{method:"POST",body:{key,...body},role});
  const ok=async(path,body,role="OWNER")=>{
   const res=await post(path,body,role);
   assert.equal(res.status,200,JSON.stringify({path,role,body:res.data}));
   return res.data;
  };
  await ok("/masters",{kind:"STITCHING",masterKey:"ST-QA",sku:"TEE-QA",operations:["Sew"]});
  await ok("/masters",{kind:"PACKING",masterKey:"PK-QA",sku:"TEE-QA",
   materials:[{sku:"BAG-QA",quantity:1,perPieces:1}]});
  await ok("/masters",{kind:"WAREHOUSE",masterKey:"WH-QA",name:"QA Warehouse"});
  await ok("/masters",{kind:"SHOP",masterKey:"SH-QA",name:"QA Shop"});
  await ok("/masters",{kind:"WAREHOUSE",masterKey:"WH-QA2",name:"Separate Warehouse"});
  await ok("/masters",{kind:"SHOP",masterKey:"SH-QA2",name:"Separate Shop"});
  await ok("/masters",{kind:"WAREHOUSE",masterKey:"WH-DISABLED",name:"Inactive Warehouse"});
  await ok("/masters",{kind:"SHOP",masterKey:"SH-DISABLED",name:"Inactive Shop"});
  await runWithTenant(tenant,async()=>DepartmentMaster.updateMany(
   {key:{$in:["WH-DISABLED","SH-DISABLED"]}},{$set:{active:false}}));
  const delivery=await ok("/delivery",{sku:"TEE-QA",quantity:6,
   sourceLocation:"CUTTING",operationMaster:"ST-QA",packingMaster:"PK-QA",
   orderNo:"SO-QA",dcNo:"DC-QA",section:"TEST"});
  let bundle=(await ok("/advance",{bundleId:delivery.bundleId,quantity:6})).details.bundle;
  bundle=(await ok("/advance",{bundleId:bundle._id,quantity:6})).details.bundle;
  bundle=(await ok("/advance",{bundleId:bundle._id,quantity:6})).details.bundle;
  assert.equal(bundle.stage,"CHECKING");
  const check=await ok("/check",{bundleId:bundle._id,good:5,reject:1});
  bundle=check.details.children.find(c=>c.stage==="GOOD");
  assert.equal(bundle.qty,5);
  bundle=(await ok("/advance",{bundleId:bundle._id,quantity:5})).details.bundle;
  bundle=(await ok("/advance",{bundleId:bundle._id,quantity:5})).details.bundle;
  assert.equal(bundle.stage,"IRONED");
  const invalidPack=await post("/pack",{bundleId:bundle._id,quantity:6});
  assert.equal(invalidPack.status,409);
  const carton=(await ok("/pack",{bundleId:bundle._id,quantity:5})).details.carton;
  assert.equal(carton.stage,"PACKED");
  // A Warehouse operator does not gain Dispatch posting permission.
  const denied=await post("/transfer",{bundleId:carton._id,quantity:5,destination:"WH-QA"},"FORGED");
  assert.equal(denied.status,403);
  const dispatchKey=crypto.randomUUID();
  const dispatchPayload={bundleId:carton._id,quantity:4,destination:"WH-QA",
   dispatch:{vehicleNo:"TN-01-QA",transporter:"Test Carrier"}};
  const firstDispatch=await post("/transfer",dispatchPayload,"DISPATCH",dispatchKey);
  assert.equal(firstDispatch.status,200,JSON.stringify(firstDispatch.data));
  const repeatDispatch=await post("/transfer",dispatchPayload,"DISPATCH",dispatchKey);
  assert.equal(repeatDispatch.status,200,JSON.stringify(repeatDispatch.data));
  assert.equal(String(firstDispatch.data._id),String(repeatDispatch.data._id));
  assert.equal((await post("/transfer",{...dispatchPayload,quantity:3},"DISPATCH",dispatchKey)).status,409);
  let transfer=firstDispatch.data.details.bundle;
  assert.equal(transfer.stage,"TRANSIT_WAREHOUSE");
  assert.equal((await post("/transfer",{bundleId:transfer._id,quantity:5},"WAREHOUSE")).status,409);
  transfer=(await ok("/transfer",{bundleId:transfer._id,quantity:4},"WAREHOUSE")).details.bundle;
  assert.equal(transfer.stage,"WAREHOUSE:WH-QA");
  const transit=(await ok("/transfer",{bundleId:transfer._id,quantity:3,
   destination:"SH-QA"},"WAREHOUSE")).details.bundle;
  assert.equal(transit.stage,"TRANSIT_SHOP:SH-QA");
  const otherWh=await request("/WAREHOUSE/dashboard",{role:"WAREHOUSE_OTHER"});
  assert.equal(otherWh.status,200,JSON.stringify(otherWh.data));
  assert.ok(!otherWh.data.bundles.some(x=>String(x._id)===String(transit._id)));
  const otherWhOverview=await request("/warehouse-overview",{role:"WAREHOUSE_OTHER"});
  assert.equal(otherWhOverview.status,200,JSON.stringify(otherWhOverview.data));
  assert.equal(otherWhOverview.data.summary.outboundTransitPcs,0);
  const ownerRead=await request("/accounts/overview?days=30");
  assert.equal(ownerRead.status,200,JSON.stringify(ownerRead.data));
  assert.equal((await request("/accounts/overview?days=30",{role:"SHOP"})).status,403);
  assert.equal((await request("/accounts/overview?days=30",
   {role:"ACCOUNTS_NO_FINANCE"})).status,403);
  const headRead=await request("/accounts/overview?days=30",{role:"ACCOUNTS_HEAD"});
  assert.equal(headRead.status,200,JSON.stringify(headRead.data));
  assert.equal((await post("/accounts/post",{type:"JOURNAL",
   journalLines:[{account:"BANK",debit:100,credit:0},
    {account:"OPENING_EQUITY",debit:0,credit:100}],notes:"Unauthorized"},
   "ACCOUNTS_HEAD")).status,403);
  const stockShop=(await ok("/transfer",{bundleId:transit._id,quantity:3},"SHOP")).details.bundle;
  assert.equal(stockShop.stage,"SHOP:SH-QA");
  const sale=(await ok("/sale",{bundleId:stockShop._id,quantity:2,
   unitPrice:200,taxPercent:0,paymentMode:"CASH"},"SHOP")).details.sale;
  const returned=await ok("/return",{saleId:sale._id,quantity:1,
   reason:"Size not suitable"},"SHOP");
  assert.equal(returned.details.refund.gross,sale.totals.gross/2);
  assert.equal((await post("/return",{saleId:sale._id,quantity:2,
   reason:"Over return"},"SHOP")).status,409);
  assert.equal((await post("/transfer",{bundleId:stockShop._id,quantity:1,
   destination:"WH-DISABLED"},"SHOP")).status,409);
  assert.equal((await post("/transfer",{bundleId:stockShop._id,quantity:1,
   destination:"SH-DISABLED"},"SHOP")).status,409);
  const interShop=(await ok("/transfer",{bundleId:stockShop._id,quantity:1,
   destination:"SH-QA2"},"SHOP")).details.bundle;
  assert.equal(interShop.stage,"TRANSIT_SHOP:SH-QA2");
  assert.equal((await post("/transfer",{bundleId:interShop._id,quantity:1},"SHOP")).status,403);
  const shop2Stock=(await ok("/transfer",{bundleId:interShop._id,quantity:1},"SHOP2")).details.bundle;
  assert.equal(shop2Stock.stage,"SHOP:SH-QA2");
  const backToWh=(await ok("/transfer",{bundleId:shop2Stock._id,quantity:1,
   destination:"WH-QA2"},"SHOP2")).details.bundle;
  assert.equal(backToWh.stage,"TRANSIT_WAREHOUSE");
  assert.equal((await post("/transfer",{bundleId:backToWh._id,quantity:1},"WAREHOUSE")).status,403);
  const received=(await ok("/transfer",{bundleId:backToWh._id,
   quantity:1},"WAREHOUSE_OTHER")).details.bundle;
  assert.equal(received.stage,"WAREHOUSE:WH-QA2");
  const moneyBefore=await request("/accounts/overview?days=30",{role:"ACCOUNTS_HEAD"});
  assert.equal(moneyBefore.status,200,JSON.stringify(moneyBefore.data));
  assert.equal(moneyBefore.data.summary.trialDifference,0);
  assert.equal(moneyBefore.data.summary.cash,sale.totals.gross-returned.details.refund.gross);
  const key=crypto.randomUUID();
  const journal={type:"JOURNAL",notes:"Phase 2 signed-off opening bank deposit",
   journalLines:[{account:"BANK",debit:100,credit:0},
    {account:"OPENING_EQUITY",debit:0,credit:100}]};
  const first=await request("/accounts/post",{method:"POST",role:"ACCOUNTS_POST",
   body:journal,key});
  assert.equal(first.status,201,JSON.stringify(first.data));
  const retry=await request("/accounts/post",{method:"POST",role:"ACCOUNTS_POST",body:journal,key});
  assert.equal(retry.status,201,JSON.stringify(retry.data));
  assert.equal(String(first.data._id),String(retry.data._id));
  const different=await request("/accounts/post",{method:"POST",role:"ACCOUNTS_POST",
   body:{...journal,notes:"Modified duplicate"},key});
  assert.equal(different.status,409);
  const final=await request("/accounts/overview?days=30",{role:"ACCOUNTS_HEAD"});
  assert.equal(final.status,200);
  assert.equal(final.data.summary.bank,10000);
  assert.equal(final.data.summary.trialDifference,0);
  const crossFactory=await request("/accounts/overview?days=30",
   {role:"ACCOUNTS_HEAD",factory:"OTHER"});
  assert.equal(crossFactory.status,200);
  assert.equal(crossFactory.data.documents.length,0);
  assert.equal(crossFactory.data.summary.cash,0);
  assert.equal(crossFactory.data.summary.bank,0);
  const reconciliation=await request("/reconciliation");
  assert.equal(reconciliation.status,200,JSON.stringify(reconciliation.data));
  assert.equal(reconciliation.data.reconciliation.balanced,true);
  await runWithTenant(tenant,async()=>{
   const lot=await DepartmentLot.findOne({code:/^LOT/}).lean();
   assert.equal(lot.sent,6);
   const packed=await DepartmentBundle.findById(carton._id).lean();
   assert.equal(packed.qty,1,"Undispatched carton balance retained");
   const all=await ErpEntry.find({kind:"JOURNAL"}).lean();
   assert.equal(all.reduce((sum,x)=>sum+x.debit-x.credit,0),0);
   assert.equal(await ErpDocument.countDocuments({type:"JOURNAL"}),1);
  });
 }finally{
  if(server)await new Promise(resolve=>server.close(resolve));
  await databaseForName(tenant.databaseName).dropDatabase();
  await mongoose.disconnect();
 }
});
