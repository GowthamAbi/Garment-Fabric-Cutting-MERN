import test from "node:test";
import assert from "node:assert/strict";
import {fabricPlanMonitorQuery,isSingleFactoryScope} from "../src/controllers/fabricPlanMonitorController.js";
import {legacyDepartment,enforceAccessBoundary} from "../src/middleware/accessMiddleware.js";

const company={active:true,factories:[{_id:"factory1",active:true}]};
const accessCompany={enabledDepartments:["FABRIC"],departmentCatalogueVersion:1,entitlements:{modules:["FABRIC"],maxDepartments:1}};
const head={role:"department_incharge",department:"FABRIC",accessScope:"DEPARTMENT",accessPolicyVersion:1,permissions:["department.fabric.read"]};
const staff={role:"department_entry",department:"FABRIC",accessScope:"DEPARTMENT",accessPolicyVersion:1,permissions:["department.fabric.read","department.fabric.write"]};
const req=(user,method="GET")=>({user,method,originalUrl:"/api/fabric-cutting/fabric-plan-monitor",accessCompany});

test("Fabric plan monitor is classified as FABRIC, not CUTTING",()=>{
 assert.equal(legacyDepartment("/fabric-cutting/fabric-plan-monitor"),"FABRIC");
 assert.equal(legacyDepartment("/fabric-cutting/plans"),"CUTTING");
 assert.equal(legacyDepartment("/fabric-cutting/plans/PLAN-001/issue"),"CUTTING");
});
test("Fabric head and staff may read monitoring but cannot post or cross into Cutting",()=>{
 const r1=req(head),r2=req(staff);
 assert.doesNotThrow(()=>enforceAccessBoundary(r1));
 assert.doesNotThrow(()=>enforceAccessBoundary(r2));
 assert.equal(r1.authorizedLegacyDepartment,"FABRIC");
 assert.throws(()=>enforceAccessBoundary(req(head,"POST")),/review access|permission/i);
 assert.throws(()=>enforceAccessBoundary(req(staff,"POST")),/permission|Legacy department/i);
 assert.throws(()=>enforceAccessBoundary(req({...head,department:"CUTTING"})),/outside assigned scope/i);
 assert.throws(()=>enforceAccessBoundary(req({...head,permissions:[]})),/permission/i);
 assert.throws(()=>enforceAccessBoundary({...req(head),accessCompany:{...accessCompany,enabledDepartments:["CUTTING"]}}),/not subscribed/i);
});
test("legacy untagged plans are never exposed across two active factories",()=>{
 assert.equal(isSingleFactoryScope(company,"factory1"),true);
 assert.equal(isSingleFactoryScope(company,"factory2"),false);
 assert.equal(isSingleFactoryScope({...company,factories:[...company.factories,{_id:"factory2",active:true}]},"factory1"),false);
 assert.equal(isSingleFactoryScope({...company,active:false},"factory1"),false);
});
test("monitor filters accept only valid exact plans, statuses and UTC date windows",()=>{
 assert.deepEqual(fabricPlanMonitorQuery({planNo:" 25-26/01 ",status:"ready"}),{planNo:"25-26/01",status:"READY"});
 const date=fabricPlanMonitorQuery({from:"2026-10-01",to:"2026-10-16"});
 assert.equal(date.createdAt.$gte.toISOString(),"2026-10-01T00:00:00.000Z");
 assert.equal(date.createdAt.$lte.toISOString(),"2026-10-16T23:59:59.999Z");
 assert.throws(()=>fabricPlanMonitorQuery({planNo:{$ne:""}}),/Invalid/);
 assert.throws(()=>fabricPlanMonitorQuery({status:"HACKED"}),/Invalid/);
 assert.throws(()=>fabricPlanMonitorQuery({from:"2026-02-30"}),/Invalid/);
 assert.throws(()=>fabricPlanMonitorQuery({from:"2026-10-17",to:"2026-10-16"}),/From date/);
});
