import '../src/config/mongoosePlugins.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import express from 'express';
import bcrypt from 'bcryptjs';
import { runWithTenant } from '../src/utils/tenantContext.js';
import { databaseForName } from '../src/config/tenantDatabase.js';
import { enforceAccessBoundary } from '../src/middleware/accessMiddleware.js';
import Company from '../src/models/Company.js';
import User from '../src/models/User.js';
import GarmentItemMaster from '../src/models/GarmentItemMaster.js';
import FabricCutPlan from '../src/models/FabricCutPlan.js';
import FabricInwardLot from '../src/models/FabricInwardLot.js';
import FabricBundleStock from '../src/models/FabricBundleStock.js';
import FabricIssueMovement from '../src/models/FabricIssueMovement.js';
import fabricRoutes from '../src/routes/fabricCutting.routes.js';

// This suite is deliberately skipped by normal unit-only runs; CI's isolated
// replica-set job supplies TEST_MONGODB_URI and runs the complete transaction.
test('fabric: isolated real database company/factory/head/staff -> inward -> plan -> issue -> stock and retries',
  {skip: !process.env.TEST_MONGODB_URI}, async () => {
    const nonce = crypto.randomBytes(5).toString('hex');
    const companyId = new mongoose.Types.ObjectId(), factoryId = new mongoose.Types.ObjectId();
    const tenant = { companyKey:`fabricqa-${nonce}`, databaseName:`ugs_tenant_fabric_ci_${nonce}`, companyId, factoryId };
    const accessCompany = {enabledDepartments:['FABRIC'], departmentCatalogueVersion:1, entitlements:{maxDepartments:1,modules:['FABRIC']}};
    let server;
    await mongoose.connect(process.env.TEST_MONGODB_URI,{serverSelectionTimeoutMS:20000});
    try {
      const hello = await mongoose.connection.db.command({hello:1});
      assert.ok(hello.setName || hello.msg === 'isdbgrid','MongoDB replica-set required for atomic issue');
      let head, staff, other;
      await runWithTenant({...tenant, role:'company_owner'},async()=>{
        await Company.create({_id:companyId,companyName:'Disposable Fabric QA Company',active:true,
          enabledDepartments:['FABRIC'],departmentCatalogueVersion:1,
          entitlements:{maxDepartments:1,modules:['FABRIC'],maxUsers:5},
          subscriptionPlan:'QA',subscriptionStatus:'Active',subscriptionEndsAt:new Date('2030-01-01'),
          factories:[{_id:factoryId,name:'QA Main Factory',code:'QAMAIN',active:true}]});
        const fakeHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'),4);
        const common={companyId,factoryId,assignedFactoryIds:[factoryId],accessScope:'DEPARTMENT',accessPolicyVersion:1,
          department:'FABRIC',emailVerified:true,password:fakeHash,active:true};
        head=await User.create({...common,userId:'UGS-QAT-FAB-0001',name:'QA Fabric Head',email:`head-${nonce}@example.test`,
          role:'department_incharge',permissions:['department.fabric.read']});
        staff=await User.create({...common,userId:'UGS-QAT-FAB-0002',name:'QA Fabric Staff',email:`staff-${nonce}@example.test`,
          role:'department_entry',permissions:['department.fabric.read','department.fabric.write']});
        other={...staff.toObject(), department:'CUTTING', permissions:['department.cutting.read','department.cutting.write']};
      });
      const app=express();
      app.use(express.json());
      app.use('/api/fabric-cutting',(req,_res,next)=>{
        const actor=req.get('x-qa-role')==='HEAD'?head.toObject():req.get('x-qa-role')==='OTHER'?other:staff.toObject();
        req.user={...actor,id:String(actor._id),userId:actor.userId};
        req.accessCompany=accessCompany;
        runWithTenant({...tenant,role:actor.role,name:actor.name,accessScope:actor.accessScope,
          accessPolicyVersion:1,permissions:actor.permissions},()=>{
          try { enforceAccessBoundary(req); next(); }catch(error){ next(error); }
        });
      });
      app.use('/api/fabric-cutting',fabricRoutes);
      app.use((error,_req,res,_next)=>res.status(error.statusCode||500).json({message:error.message}));
      server=app.listen(0,'127.0.0.1');
      await new Promise(resolve=>server.once('listening',resolve));
      const root=`http://127.0.0.1:${server.address().port}/api/fabric-cutting`;
      const call=async(path,method='GET',body,role='STAFF')=>{
        const res=await fetch(root+path,{method,headers:{'Content-Type':'application/json','x-qa-role':role},
          ...(body!==undefined&&{body:JSON.stringify(body)})});
        const raw=await res.text(); let data;try{data=JSON.parse(raw)}catch{data={message:raw.slice(0,500)}}
        return {status:res.status,data};
      };
      const good=async(path,method,body,role,expected)=>{
        const result=await call(path,method,body,role);
        assert.equal(result.status,expected,JSON.stringify({path,...result}));
        return result.data;
      };
      const master=await good('/masters','POST',{fabricCode:'FQA01',fabricName:'QA Cotton',fabricGroup:'COTTON'},'STAFF',201);
      assert.equal(master.fabricCode,'FQA01');
      await runWithTenant({...tenant,role:'company_owner'},async()=>{
        await GarmentItemMaster.create({itemCode:'QAITEM',itemName:'QA Shirt',fabricGroup:'COTTON',
          status:'APPROVED',sizes:[{size:'M',dia:'32',cuttingPieceWeightKg:0.1}]});
      });
      const inward=await good('/inwards','POST',{
        inwardNo:'FINQA01',fabricCode:'FQA01',dcNo:'DCQA01',setNo:'SETQA01',lotNo:'LOTQA01',
        colours:[{colour:'BLUE',details:[{dia:'32',lotRolls:2,lotWeightKg:10}]}]
      },'STAFF',201);
      assert.equal(inward.totalWeightKg,10);
      const beforeRolls=await good('/inwards/FINQA01/bundles','GET',undefined,'STAFF',200);
      assert.equal(beforeRolls.length,2);
      assert.equal(beforeRolls.reduce((n,r)=>n+r.balanceWeightKg,0),10);
      assert.ok(beforeRolls.every(r=>r.batchNo!=='LEGACY'&&r.qrToken));
      const plan=await good('/fabric-plans','POST',{
        itemCode:'QAITEM',orderNo:'ORDQA01',dcNo:'DCPLAN01',selectedColours:['BLUE'],
        sizes:[{size:'M',pcs:20,dia:'32'}]
      },'STAFF',201);
      assert.equal(plan.totalWantedWeightKg,2);
      const headRead=await good('/fabric-plans','GET',undefined,'HEAD',200);
      assert.ok(headRead.some(row=>row.planNo===plan.planNo));
      const headWrite=await call('/fabric-plans','POST',{itemCode:'QAITEM'},'HEAD');
      assert.equal(headWrite.status,403);
      const otherRead=await call('/inwards','GET',undefined,'OTHER');
      assert.equal(otherRead.status,403);
      const entry={planNo:plan.planNo,inwardNo:'FINQA01',colour:'BLUE',dia:'32',
        weightKg:1.25,key:'fabric-test-key-000001'};
      const issue=await good('/fabric-issues','POST',entry,'STAFF',201);
      assert.equal(issue.replayed,false);
      const same=await good('/fabric-issues','POST',entry,'STAFF',200);
      assert.equal(same.replayed,true);
      const conflict=await call('/fabric-issues','POST',{...entry,weightKg:0.5},'STAFF');
      assert.equal(conflict.status,409);
      const wrongDia=await call('/fabric-issues','POST',{...entry,dia:'34',key:'fabric-test-key-000002'},'STAFF');
      assert.equal(wrongDia.status,409);
      const excess=await call('/fabric-issues','POST',{...entry,weightKg:9,key:'fabric-test-key-000003'},'STAFF');
      assert.equal(excess.status,409);
      await runWithTenant({...tenant,role:'department_entry',accessPolicyVersion:1,accessScope:'DEPARTMENT'},async()=>{
        const actualInward=await FabricInwardLot.findOne({inwardNo:'FINQA01'}).lean();
        const actualPlan=await FabricCutPlan.findOne({planNo:plan.planNo}).lean();
        const rolls=await FabricBundleStock.find({inwardNo:'FINQA01'}).sort({rollNo:1}).lean();
        const movements=await FabricIssueMovement.find({}).lean();
        assert.equal(actualInward.colours[0].balanceWeightKg,8.75);
        assert.equal(actualPlan.issuedWeightKg,1.25);
        assert.equal(rolls.reduce((n,r)=>n+r.balanceWeightKg,0),8.75);
        assert.equal(rolls[0].balanceWeightKg,3.75);
        assert.equal(movements.length,1);
        assert.equal(movements[0].allocations.reduce((n,a)=>n+a.weightKg,0),1.25);
      });
      const headIssues=await good('/fabric-issues','GET',undefined,'HEAD',200);
      assert.equal(headIssues.items.length,1);
    }finally{
      if(server)await new Promise(resolve=>server.close(resolve));
      await databaseForName(tenant.databaseName).dropDatabase();
      await mongoose.disconnect();
    }
  });
