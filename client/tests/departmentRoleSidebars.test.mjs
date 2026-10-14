import test from "node:test";
import assert from "node:assert/strict";
import {getDepartmentSidebar,PROPOSED_DEPARTMENTS,isDepartmentWorkspaceReady} from "../src/config/departmentRoleSidebars.js";

test("supports 16 proposed departments, preserving 14 licensed departments", () => {
 assert.equal(PROPOSED_DEPARTMENTS.length,16);
 assert.equal(isDepartmentWorkspaceReady("FABRIC"),true);
 assert.equal(isDepartmentWorkspaceReady("HR"),false);
});
test("separates head and staff actions",()=>{
 const head=getDepartmentSidebar("CUTTING","HEAD");
 const staff=getDepartmentSidebar("CUTTING","STAFF");
 assert.ok(head.some(m=>m.action==="approve"));
 assert.ok(!head.some(m=>m.action==="write"));
 assert.ok(staff.some(m=>m.action==="write"));
 assert.ok(!staff.some(m=>m.action==="approve"));
});
test("respects enabled departments and rejects unsupported roles",()=>{
 assert.deepEqual(getDepartmentSidebar("CUTTING","HEAD",{enabledDepartments:["FABRIC"]}),[]);
 assert.deepEqual(getDepartmentSidebar("CUTTING","OWNER"),[]);
 assert.deepEqual(getDepartmentSidebar("UNKNOWN","HEAD"),[]);
});
test("HR and Accounts are not live until licensed and implemented",()=>{
 assert.deepEqual(getDepartmentSidebar("HR","HEAD"),[]);
 assert.ok(getDepartmentSidebar("HR","HEAD",{experimentalDepartments:true}).length>0);
});
