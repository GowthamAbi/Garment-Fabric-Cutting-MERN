import "../src/config/mongoosePlugins.js";
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import {runWithTenant} from "../src/utils/tenantContext.js";
import {databaseForName} from "../src/config/tenantDatabase.js";
import WarehouseStock from "../src/models/WarehouseStock.js";
import LegacyWarehouseMovement from "../src/models/LegacyWarehouseMovement.js";
import {moveLegacyWarehouse} from "../src/services/legacyWarehouseMovementService.js";

test("P0 stock: MongoDB atomic partial moves, idempotency, rollback, overdraw and concurrent requests",
 {skip:!process.env.TEST_MONGODB_URI},async()=>{
 const nonce=crypto.randomBytes(6).toString("hex");
 const tenant={companyKey:"legacy-stock-"+nonce,databaseName:"ugs_tenant_legacy_stock_"+nonce,
  companyId:new mongoose.Types.ObjectId(),factoryId:new mongoose.Types.ObjectId()};
 await mongoose.connect(process.env.TEST_MONGODB_URI);
 try{
  const hello=await mongoose.connection.db.command({hello:1});
  assert.ok(hello.setName||hello.msg==="isdbgrid","Disposable replica set required");
  await runWithTenant(tenant,async()=>{
   const [source]=await WarehouseStock.create([{
    referenceNo:"RW-"+nonce,warehouseType:"REWORK",jobNo:"JOB1",dcNo:"DC1",
    outwardNo:"OUT1",itemCode:"TEE-M",itemName:"TEE",colour:"RED",size:"M",
    originalQty:10,balanceQty:10
   }]);
   const args={sourceId:String(source._id),mode:"REWORK",body:{quantity:4,action:"complete"},
    key:crypto.randomUUID(),actor:"OP1"};
   const posted=await moveLegacyWarehouse(args);
   assert.equal(posted.replayed,false);
   assert.equal(posted.source.balanceQty,6);
   assert.equal(posted.destination.balanceQty,4);
   const retry=await moveLegacyWarehouse(args);
   assert.equal(retry.replayed,true);
   assert.equal(String(retry.destination._id),String(posted.destination._id));
   await assert.rejects(()=>moveLegacyWarehouse({...args,body:{quantity:3,action:"complete"}}),
    e=>e.statusCode===409);
   await assert.rejects(()=>moveLegacyWarehouse({...args,actor:"OP2"}),
    e=>e.statusCode===403);
   await assert.rejects(()=>moveLegacyWarehouse({...args,key:crypto.randomUUID(),
    body:{quantity:7,action:"complete"}}),e=>e.statusCode===409);
   assert.equal((await WarehouseStock.findById(source._id).lean()).balanceQty,6);
   const delivered=await moveLegacyWarehouse({sourceId:String(posted.destination._id),
    mode:"DELIVER",body:{quantity:2,sectionCode:"SEC1"},
    key:crypto.randomUUID(),actor:"OP1"});
   assert.equal(delivered.destination.warehouseType,"SECTION_DELIVERY");
   assert.equal(delivered.destination.balanceQty,2);
   assert.equal(delivered.source.balanceQty,2);
   const [second]=await WarehouseStock.create([{
    referenceNo:"RW2-"+nonce,warehouseType:"REWORK",jobNo:"JOB2",dcNo:"DC2",
    outwardNo:"OUT2",itemCode:"TEE-M",itemName:"TEE",colour:"BLUE",size:"L",
    originalQty:3,balanceQty:3
   }]);
   const a=async(key)=>moveLegacyWarehouse({sourceId:String(second._id),mode:"REWORK",
    body:{quantity:2,action:"complete"},key,actor:"OP1"});
   const concurrent=await Promise.allSettled([a(crypto.randomUUID()),a(crypto.randomUUID())]);
   assert.equal(concurrent.filter(x=>x.status==="fulfilled").length,1);
   assert.equal((await WarehouseStock.findById(second._id).lean()).balanceQty,1);
   const receipts=await LegacyWarehouseMovement.find().lean();
   assert.equal(receipts.length,3);
   const all=await WarehouseStock.find({jobNo:{$in:["JOB1","JOB2"]}}).lean();
   for(const job of ["JOB1","JOB2"]){
    const rows=all.filter(x=>x.jobNo===job);
    assert.equal(rows.reduce((s,x)=>s+x.balanceQty,0),job==="JOB1"?10:3);
    assert.ok(rows.every(x=>x.balanceQty>=0&&Number.isSafeInteger(x.balanceQty)));
   }
  });
 }finally{
  await databaseForName(tenant.databaseName).dropDatabase();
  await mongoose.disconnect();
 }
});
