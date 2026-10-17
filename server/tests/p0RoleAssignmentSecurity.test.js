import test from "node:test";
import assert from "node:assert/strict";
import {assertSafeBaseRoleAssignment,roleDirectoryFilter}
 from "../src/utils/roleAssignmentGuard.js";
import {readFileSync} from "node:fs";
const f1="a".repeat(24),f2="b".repeat(24),c="c".repeat(24);
const owner={role:"company_owner",companyId:c,id:"owner",accessPolicyVersion:1,accessScope:"COMPANY"};
const admin={role:"company_admin",companyId:c,id:"admin",factoryId:f1,accessPolicyVersion:1,
 accessScope:"LOCATION",assignedFactoryIds:[f1],permissions:["users.manage","users.roles.assign"]};
test("P0 role guard: only company owner can create or modify privileged base roles",()=>{
 assert.equal(assertSafeBaseRoleAssignment(owner,"company_admin"),true);
 assert.equal(assertSafeBaseRoleAssignment(owner,"admin"),true);
 assert.equal(assertSafeBaseRoleAssignment(owner,"department_entry","company_admin"),true);
 assert.equal(assertSafeBaseRoleAssignment(admin,"department_entry"),true);
 for(const [from,to] of [
  ["","company_admin"],["","admin"],
  ["department_entry","company_admin"],["department_entry","admin"],
  ["company_admin","department_entry"],["admin","department_entry"],
  ["company_admin","company_admin"],["admin","admin"]])
  assert.throws(()=>assertSafeBaseRoleAssignment(admin,to,from),{statusCode:403});
 assert.throws(()=>assertSafeBaseRoleAssignment({role:"saas_super_admin"},"company_admin"),{statusCode:403});
 assert.throws(()=>assertSafeBaseRoleAssignment({role:"support_viewer"},"department_entry"),{statusCode:403});
});
test("P0: delegated user directory never enumerates unassigned factories",()=>{
 const q=roleDirectoryFilter(admin);
 assert.deepEqual(q,{companyId:c,factoryId:{$in:[f1]}});
 assert.ok(!q.factoryId.$in.includes(f2));
 assert.deepEqual(roleDirectoryFilter(owner),{companyId:c});
 const dept={...admin,accessScope:"DEPARTMENT",department:"PACKING"};
 assert.deepEqual(roleDirectoryFilter(dept),{companyId:c,factoryId:{$in:[f1]},department:"PACKING"});
 const fm={...admin,assignedFactoryIds:[f1,f2]};
 assert.deepEqual(roleDirectoryFilter(fm).factoryId.$in,[f1,f2]);
});
test("P0: access scope and permissions fail closed when directory context missing",()=>{
 for(const actor of [
  {...admin,permissions:[]},
  {...admin,companyId:undefined},
  {...admin,accessScope:"SELF"},
  {...admin,accessScope:"LOCATION",assignedFactoryIds:[],factoryId:undefined},
  {...admin,accessScope:"DEPARTMENT",department:""}
 ])assert.throws(()=>roleDirectoryFilter(actor),{statusCode:403});
 const legacy={role:"company_admin",companyId:c,permissions:["users.roles.assign"]};
 assert.deepEqual(roleDirectoryFilter(legacy),{companyId:c});
});
test("P0: all role mutation routes use privilege guard; cross-factory list uses scoped filter",()=>{
 const routes=readFileSync(new URL("../src/routes/access.routes.js",import.meta.url),"utf8");
 const auth=readFileSync(new URL("../src/controllers/authController.js",import.meta.url),"utf8");
 const company=readFileSync(new URL("../src/controllers/companyController.js",import.meta.url),"utf8");
 assert.match(routes,/const userFilter=roleDirectoryFilter\(req.user\)/);
 assert.match(routes,/assertSafeBaseRoleAssignment\(req.user,role.baseRole,user.role\)/);
 assert.match(routes,/assertSafeBaseRoleAssignment\(req.user,baseRole\)/);
 assert.match(auth,/assertSafeBaseRoleAssignment\(request.user,role\)/);
 assert.match(auth,/assertSafeBaseRoleAssignment\(request.user,user.role,user.role\)/);
 assert.match(company,/assertSafeBaseRoleAssignment\(request.user,nextRole,user.role\)/);
 assert.match(company,/Company-wide workspace requires company-scoped access/);
});
