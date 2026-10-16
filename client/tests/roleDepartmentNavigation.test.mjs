import test from "node:test";
import assert from "node:assert/strict";
import {isSingleDepartmentUser,roleDepartmentPages,rolePageAllowed} from "../src/config/roleDepartmentNavigation.mjs";
const dept="FABRIC",perm=["department.fabric.read","department.fabric.write"];
const subscription={accessAllowed:true,enabledDepartments:["FABRIC","CUTTING"]};
const staff={role:"department_entry",department:dept,accessPolicyVersion:1,accessScope:"DEPARTMENT",permissions:perm};
const head={role:"department_incharge",department:dept,accessPolicyVersion:1,accessScope:"DEPARTMENT",permissions:["department.fabric.read","approval.head.fabric"]};
test("department staff gets own work and submit queue but no head approvals or other departments",()=>{
 assert.equal(isSingleDepartmentUser(staff),true);
 assert.deepEqual(roleDepartmentPages(staff,subscription).map(x=>x.page),["Department Dashboard","Department Workspace:FABRIC","Department Approval Requests","Profile Settings"]);
 assert.equal(rolePageAllowed(staff,"Department Workspace:CUTTING",subscription),false);
 assert.equal(rolePageAllowed(staff,"Management Approval Inbox",subscription),false);
 assert.equal(rolePageAllowed(staff,"User Management",subscription),false);
});
test("head gets own read-only workspace and approval inbox, not staff submission",()=>{
 assert.deepEqual(roleDepartmentPages(head,subscription).map(x=>x.page),["Department Dashboard","Department Workspace:FABRIC","Management Approval Inbox","Profile Settings"]);
 assert.equal(rolePageAllowed(head,"Department Approval Requests",subscription),false);
});
test("subscription, missing access, and unlicensed department fail closed",()=>{
 assert.deepEqual(roleDepartmentPages(staff,{accessAllowed:false,enabledDepartments:["FABRIC"]}),[]);
 assert.deepEqual(roleDepartmentPages(staff,{accessAllowed:true,enabledDepartments:["CUTTING"]}),[]);
 assert.deepEqual(roleDepartmentPages({...staff,permissions:[]},subscription),[]);
 assert.equal(rolePageAllowed(staff,"Profile Settings",{accessAllowed:false}),true);
 assert.equal(rolePageAllowed(staff,"Department Dashboard",{accessAllowed:false}),false);
});
test("location-scoped factory manager is not confined to single-department navigation",()=>{
 const factoryManager={role:"department_incharge",department:"FABRIC",accessPolicyVersion:1,accessScope:"LOCATION",permissions:["erp.read"]};
 assert.equal(isSingleDepartmentUser(factoryManager),false);
 assert.equal(rolePageAllowed(factoryManager,"Production & Retail",subscription),true);
});
