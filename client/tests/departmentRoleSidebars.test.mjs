import test from "node:test";
import assert from "node:assert/strict";
import {getDepartmentSidebar,PROPOSED_DEPARTMENTS,isDepartmentWorkspaceReady} from "../src/config/departmentRoleSidebars.js";

test("supports 16 proposed departments, with HR and Accounts licensed", () => {
 assert.equal(PROPOSED_DEPARTMENTS.length,16);
 assert.equal(isDepartmentWorkspaceReady("FABRIC"),true);
 assert.equal(isDepartmentWorkspaceReady("HR"),true);
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
test("HR and Accounts sidebars are enabled with separate staff/head views",()=>{
 assert.equal(getDepartmentSidebar("HR","HEAD").length,10);
 assert.equal(getDepartmentSidebar("ACCOUNTS","HEAD").length,10);
 assert.equal(getDepartmentSidebar("ACCOUNTS","STAFF").length,11);
 assert.ok(getDepartmentSidebar("HR","HEAD",{experimentalDepartments:true}).length>0);
});
