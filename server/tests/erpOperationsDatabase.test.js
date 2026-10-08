import "../src/config/mongoosePlugins.js";
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import mongoose from "mongoose";
import express from "express";
import {runWithTenant} from "../src/utils/tenantContext.js";
import {databaseForName} from "../src/config/tenantDatabase.js";
import {ErpDocument,ErpSettings} from "../src/erp/models.js";
import operationsRoutes from "../src/erp/operationsRoutes.js";

test("real replica-set shop-floor: concurrent overlapping assignments, idempotent events and stage capacity",{skip:!process.env.TEST_MONGODB_URI},async()=>{
  const nonce=crypto.randomBytes(6).toString("hex"),tenant={companyKey:`ops-${nonce}`,databaseName:`ugs_tenant_ops_test_${nonce}`,companyId:new mongoose.Types.ObjectId(),factoryId:new mongoose.Types.ObjectId(),role:"company_admin"};
  let server;
  await mongoose.connect(process.env.TEST_MONGODB_URI);
  try{
    const hello=await mongoose.connection.db.command({hello:1});assert.ok(hello.setName||hello.msg==="isdbgrid","Transaction-capable staging cluster required");
    let wo;
    await runWithTenant(tenant,async()=>{
      await ErpSettings.create({companyId:tenant.companyId,factoryId:tenant.factoryId,key:"ERP",enabled:true});
      wo=await ErpDocument.create({companyId:tenant.companyId,factoryId:tenant.factoryId,number:"WO-TEST",type:"WORK_ORDER",date:new Date(),idempotencyKey:crypto.randomUUID(),requestHash:"test",lines:[{sku:"FIN",qty:10000,unit:"PCS"}],metadata:{bom:{components:[],outputQty:1000}},totals:{gross:0}});
    });
    const app=express();app.use(express.json());app.use((req,_res,next)=>runWithTenant(tenant,()=>{req.user={...tenant,userId:"OPS-ADMIN"};next();}));app.use(operationsRoutes);app.use((e,_req,res,_next)=>res.status(e.statusCode||500).json({message:e.message}));
    server=app.listen(0,"127.0.0.1");await new Promise(resolve=>server.on("listening",resolve));
    const base=`http://127.0.0.1:${server.address().port}`;
    const call=async(path,body,key=crypto.randomUUID())=>{const response=await fetch(base+path,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":key},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
    assert.equal((await call("/machines",{code:"CUT-1",name:"Cutter",stage:"CUTTING"})).status,201);
    assert.equal((await call("/machines",{code:"FOLD-1",name:"Folding table",stage:"FOLDING"})).status,201);
    assert.equal((await call("/routing",{workOrderId:String(wo._id),stages:["CUTTING","FOLDING","PACKING"]})).status,200);
    const input={workOrderId:String(wo._id),machineCode:"CUT-1",stage:"CUTTING",quantity:5,start:"2026-10-07T08:00:00Z",end:"2026-10-07T09:00:00Z"};
    const outcomes=await Promise.all([call("/operations",input),call("/operations",input)]);
    assert.equal(outcomes.filter(r=>r.status===200).length,1);assert.equal(outcomes.filter(r=>r.status===409).length,1);
    const job=outcomes.find(r=>r.status===200).data,eventKey=crypto.randomUUID();
    const startEvent={action:"START",revision:0,notes:"Start cutter"};
    const first=await call(`/operations/${job._id}/events`,startEvent,eventKey),duplicate=await call(`/operations/${job._id}/events`,startEvent,eventKey);
    assert.equal(first.data.revision,1);assert.equal(duplicate.data.revision,1);
    assert.equal((await call(`/operations/${job._id}/events`,{action:"COMPLETE",revision:0,notes:"Stale"})).status,409);
    assert.equal((await call("/operations",{...input,machineCode:"FOLD-1",stage:"FOLDING",quantity:1})).status,409);
    assert.equal((await call(`/operations/${job._id}/events`,{action:"COMPLETE",revision:1,notes:"Cut complete"})).status,200);
    assert.equal((await call("/operations",{...input,machineCode:"FOLD-1",stage:"FOLDING",quantity:6})).status,409);
    assert.equal((await call("/operations",{...input,machineCode:"FOLD-1",stage:"FOLDING",quantity:5})).status,200);
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    await databaseForName(tenant.databaseName).dropDatabase();await mongoose.disconnect();
  }
});
