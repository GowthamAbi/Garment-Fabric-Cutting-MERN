import "../src/config/mongoosePlugins.js";
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import express from "express";
import mongoose from "mongoose";
import {runWithTenant} from "../src/utils/tenantContext.js";
import {databaseForName} from "../src/config/tenantDatabase.js";
import Company from "../src/models/Company.js";
import User from "../src/models/User.js";
import AuditLog from "../src/models/AuditLog.js";
import CompanyApprovalSettings from "../src/models/CompanyApprovalSettings.js";
import DepartmentApprovalRequest from "../src/models/DepartmentApprovalRequest.js";
import DepartmentApprovalOutbox from "../src/models/DepartmentApprovalOutbox.js";
import approvalGrants from "../src/routes/approvalGrants.routes.js";
import approvalRequests from "../src/routes/departmentApprovalRequests.routes.js";
import {REQUEST_TYPES} from "../src/services/departmentApprovalPolicy.js";

test("P0 approval: real replica-set owner grant and independent decision with scoped history",
 {skip:!process.env.TEST_MONGODB_URI},async()=>{
 const nonce=crypto.randomBytes(6).toString("hex");
 const companyId=new mongoose.Types.ObjectId(),f1=new mongoose.Types.ObjectId(),f2=new mongoose.Types.ObjectId();
 const users=Object.fromEntries(["OWNER","HEAD","STAFF","ADMIN","FORGED","FM"].map(k=>[k,new mongoose.Types.ObjectId()]));
 const tenant={companyKey:"p0-approval-"+nonce,
  databaseName:"ugs_tenant_p0_approval_"+nonce,companyId,factoryId:f1};
 let http;
 await mongoose.connect(process.env.TEST_MONGODB_URI);
 try{
  const hello=await mongoose.connection.db.command({hello:1});
  assert.ok(hello.setName||hello.msg==="isdbgrid","Isolated replica set required");
  await runWithTenant(tenant,async()=>{
   await Company.create({_id:companyId,companyName:"P0 Approval Dummy",ownerUserId:users.OWNER,
    enabledDepartments:["FABRIC","CUTTING"],accessPolicyVersion:1,
    factories:[{_id:f1,name:"Main",code:"MAIN"},{_id:f2,name:"Second",code:"SECOND"}]});
   await User.create([
    {_id:users.OWNER,userId:"UGS-MGT-OWN-1011",name:"P0 owner",
     email:"owner-"+nonce+"@example.test",password:"fixture",role:"company_owner",
     companyId,factoryId:f1,accessScope:"COMPANY",accessPolicyVersion:1,assignedFactoryIds:[f1,f2]},
    {_id:users.HEAD,userId:"UGS-MGT-HED-1012",name:"Fabric head",
     email:"head-"+nonce+"@example.test",password:"fixture",role:"department_incharge",
     department:"FABRIC",companyId,factoryId:f1,accessScope:"DEPARTMENT",
     accessPolicyVersion:1,assignedFactoryIds:[f1],permissions:["department.fabric.read"]},
    {_id:users.STAFF,userId:"UGS-MGT-STF-1013",name:"Fabric staff",
     email:"staff-"+nonce+"@example.test",password:"fixture",role:"department_entry",
     department:"FABRIC",companyId,factoryId:f1,accessScope:"DEPARTMENT",
     accessPolicyVersion:1,assignedFactoryIds:[f1],
     permissions:["department.fabric.read","department.fabric.write"]}
   ]);
   const limits=Object.fromEntries(["HEAD","FM","OWNER"].map((level,i)=>[level,
    Object.fromEntries(REQUEST_TYPES.map(t=>[t,[100,500,1000][i]]))]));
   await CompanyApprovalSettings.create({companyId,limits,modifiedBy:users.OWNER});
   await DepartmentApprovalRequest.create({companyId,factoryId:f1,department:"FABRIC",
    type:"MATERIAL_VARIANCE",title:"QA sample material count",reason:"Count mismatch in dummy roll",
    requestedBy:users.STAFF,amount:75,status:"PENDING_HEAD"});
  });
  const app=express();app.use(express.json());
  app.use((req,_res,next)=>{
   const who=req.get("x-role")||"OWNER",other=req.get("x-factory")==="OTHER";
   const defaults={
    OWNER:{role:"company_owner",id:users.OWNER,userId:"UGS-MGT-OWN-1011",
     accessScope:"COMPANY",permissions:[],assignedFactoryIds:[f1,f2]},
    HEAD:{role:"department_incharge",id:users.HEAD,userId:"UGS-MGT-HED-1012",
     department:"FABRIC",accessScope:"DEPARTMENT",
     permissions:["department.fabric.read"],assignedFactoryIds:[f1]},
    STAFF:{role:"department_entry",id:users.STAFF,userId:"UGS-MGT-STF-1013",
     department:"FABRIC",accessScope:"DEPARTMENT",
     permissions:["department.fabric.read","department.fabric.write"],assignedFactoryIds:[f1]},
    ADMIN:{role:"company_admin",id:users.ADMIN,userId:"ADMIN",
     department:"CUTTING",accessScope:"DEPARTMENT",
     permissions:["department.fabric.read","department.cutting.read"],assignedFactoryIds:[f1]},
    FORGED:{role:"company_owner",id:users.FORGED,userId:"FORGED",
     accessScope:"COMPANY",permissions:[],assignedFactoryIds:[f1,f2]},
    FM:{role:"management",id:users.FM,userId:"FM",
     accessScope:"LOCATION",permissions:["approval.fm.fabric"],assignedFactoryIds:[f1]}
   };
   const actor=defaults[who];if(!actor)return next(new Error("Unknown fixture role"));
   // Read live grant for HEAD; do not fake a stale JWT permission.
   return runWithTenant({...tenant,factoryId:other?f2:f1},async()=>{
    const head=who==="HEAD"?await User.findById(users.HEAD).select("permissions").lean():null;
    req.user={companyId,factoryId:other?f2:f1,accessPolicyVersion:1,...actor,
     permissions:head?.permissions||actor.permissions};
    next();
   });
  });
  app.use("/approval-grants",approvalGrants);
  app.use("/department-approval-requests",approvalRequests);
  app.use((err,_req,res,_next)=>res.status(err.statusCode||err.status||500).json({message:err.message}));
  http=app.listen(0,"127.0.0.1");await new Promise(r=>http.once("listening",r));
  const root="http://127.0.0.1:"+http.address().port;
  const call=async(path,{role="OWNER",method="GET",body,other=false}={})=>{
   const res=await fetch(root+path,{method,headers:{"Content-Type":"application/json",
    "x-role":role,"x-factory":other?"OTHER":"MAIN"},...(body?{body:JSON.stringify(body)}:{})});
   return {status:res.status,data:await res.json()};
  };
  assert.equal((await call("/approval-grants",{role:"FORGED"})).status,403);
  assert.equal((await call("/approval-grants",{role:"FM"})).status,403);
  assert.equal((await call("/department-approval-requests?department=FABRIC",{role:"ADMIN"})).status,403);
  assert.equal((await call("/department-approval-requests/inbox",{role:"HEAD",other:true})).status,403);
  assert.equal((await call("/department-approval-requests/settings",{role:"ADMIN"})).status,403);
  const ungranted=await call("/department-approval-requests/inbox",{role:"HEAD"});
  assert.equal(ungranted.status,200);assert.equal(ungranted.data.items.length,0);
  const visible=await call("/approval-grants");
  assert.equal(visible.status,200);assert.equal(visible.data.users.length,1);
  const grant=await call("/approval-grants/"+users.HEAD,{method:"PUT",
   body:{department:"FABRIC",enabled:true}});
  assert.equal(grant.status,200,JSON.stringify(grant.data));
  assert.equal(grant.data.grant,"approval.head.fabric");
  await runWithTenant(tenant,async()=>{
   const head=await User.findById(users.HEAD).select("+sessionVersion").lean();
   assert.ok(head.permissions.includes("approval.head.fabric"));
   assert.equal(head.sessionVersion,1);
   assert.equal(await AuditLog.countDocuments({action:"APPROVAL_GRANT_CHANGED"}),1);
  });
  const inbox=await call("/department-approval-requests/inbox",{role:"HEAD"});
  assert.equal(inbox.status,200);assert.equal(inbox.data.items.length,1);
  const id=inbox.data.items[0]._id;
  const decision={decision:"APPROVE",reason:"Verified independent material variance"};
  assert.equal((await call("/department-approval-requests/"+id+"/decision",
   {role:"STAFF",method:"POST",body:decision})).status,403);
  assert.equal((await call("/department-approval-requests/"+id+"/decision",
   {role:"HEAD",method:"POST",body:decision,other:true})).status,404); // Hide cross-factory request existence
  const approved=await call("/department-approval-requests/"+id+"/decision",
   {role:"HEAD",method:"POST",body:decision});
  assert.equal(approved.status,200,JSON.stringify(approved.data));
  assert.equal(approved.data.item.status,"APPROVED");
  assert.equal((await call("/department-approval-requests/"+id+"/decision",
   {role:"HEAD",method:"POST",body:decision})).status,409);
  await runWithTenant(tenant,async()=>{
   assert.equal(await DepartmentApprovalOutbox.countDocuments({eventType:"DECISION_RECORDED"}),1);
   assert.equal((await DepartmentApprovalRequest.findById(id).lean()).decisions.length,1);
   assert.equal(await AuditLog.countDocuments({action:"APPROVAL_GRANT_CHANGED"}),1);
  });
 }finally{
  if(http)await new Promise(resolve=>http.close(resolve));
  await databaseForName(tenant.databaseName).dropDatabase();
  await mongoose.disconnect();
 }
});
