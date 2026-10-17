import test from "node:test";
import assert from "node:assert/strict";
import {userDirectoryFilter} from "../src/utils/userDirectoryPolicy.js";

const companyId="a".repeat(24), factoryA="b".repeat(24),factoryB="c".repeat(24);
const companyAdmin={id:"u-company-admin",role:"company_admin",companyId,factoryId:factoryA,accessPolicyVersion:1,accessScope:"COMPANY",permissions:["users.manage"],assignedFactoryIds:[factoryA,factoryB]};
const factoryAdmin={id:"u-factory-admin",role:"admin",companyId,factoryId:factoryA,accessPolicyVersion:1,accessScope:"LOCATION",permissions:["users.manage"],assignedFactoryIds:[factoryA]};
const restrictedAdmin={...companyAdmin,accessScope:"LOCATION",assignedFactoryIds:[factoryA]};
const deptAdmin={...companyAdmin,accessScope:"DEPARTMENT",department:"CUTTING",assignedFactoryIds:[factoryA]};

test("company administrator lists only their company, not unrelated customer users",()=>{
 assert.deepEqual(userDirectoryFilter(companyAdmin),{companyId});
 assert.deepEqual(userDirectoryFilter({...companyAdmin,accessPolicyVersion:undefined}),{companyId});
});
test("factory admin cannot enumerate another factory's staff",()=>{
 assert.deepEqual(userDirectoryFilter(factoryAdmin),{companyId,factoryId:{$in:[factoryA]}});
 assert.deepEqual(userDirectoryFilter({...factoryAdmin,assignedFactoryIds:[factoryA,factoryB]}),{companyId,factoryId:{$in:[factoryA]}});
});
test("location and department-scoped administrators are filtered to their assignments",()=>{
 assert.deepEqual(userDirectoryFilter(restrictedAdmin),{companyId,factoryId:{$in:[factoryA]}});
 assert.deepEqual(userDirectoryFilter(deptAdmin),{companyId,factoryId:{$in:[factoryA]},department:"CUTTING"});
 assert.deepEqual(userDirectoryFilter({...restrictedAdmin,assignedFactoryIds:[factoryA,factoryA]}),{companyId,factoryId:{$in:[factoryA]}});
});
test("fail closed for unauthorized or malformed context",()=>{
 const denied=[null,{role:"department_entry",companyId,factoryId:factoryA},{...companyAdmin,companyId:null},{...companyAdmin,permissions:[]},{...companyAdmin,accessScope:"SELF"},{...restrictedAdmin,assignedFactoryIds:[],factoryId:null},{...deptAdmin,department:""}];
 for(const actor of denied)assert.throws(()=>userDirectoryFilter(actor),e=>e.statusCode===403);
});
test("platform admin retains tenant-bound directory query",()=>{
 assert.deepEqual(userDirectoryFilter({role:"saas_super_admin"}),{});
});
