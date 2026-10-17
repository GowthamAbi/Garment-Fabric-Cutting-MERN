import test from "node:test";
import assert from "node:assert/strict";
import {enforceAccessBoundary} from "../src/middleware/accessMiddleware.js";
const req=(role,method,url,permissions=[],department="FABRIC",accessScope="DEPARTMENT")=>({
 originalUrl:"/api"+url,method,
 user:{role,accessScope,accessPolicyVersion:1,department,permissions,companyId:"507f1f77bcf86cd799439011",factoryId:"507f1f77bcf86cd799439012"}
});
const checkAllowed=r=>assert.doesNotThrow(()=>enforceAccessBoundary(r));
const checkDenied=r=>assert.throws(()=>enforceAccessBoundary(r),e=>e.statusCode===403);
test("strict department staff can access request endpoints but not decisions",()=>{
 const grants=["department.fabric.read","department.fabric.write"];
 checkAllowed(req("department_entry","POST","/department-approval-requests",grants));
 checkAllowed(req("department_entry","GET","/department-approval-requests",grants));
 checkDenied(req("department_entry","POST","/department-approval-requests/507f1f77bcf86cd799439013/decision",grants));
});
test("strict department heads can access inbox and review, not submit requests",()=>{
 const grants=["department.fabric.read","approval.head.fabric"];
 checkAllowed(req("department_incharge","GET","/department-approval-requests/inbox",grants));
 checkAllowed(req("department_incharge","POST","/department-approval-requests/507f1f77bcf86cd799439013/decision",grants));
 checkDenied(req("department_incharge","POST","/department-approval-requests",grants));
});
test("strict factory managers only access their review API",()=>{
 const grants=["approval.fm.fabric"];
 checkAllowed(req("management","GET","/department-approval-requests/inbox",grants,"","LOCATION"));
 checkDenied(req("management","PUT","/department-approval-requests/settings",grants,"","LOCATION"));
 checkDenied(req("management","PUT","/approval-grants/507f1f77bcf86cd799439013",grants,"","LOCATION"));
});
test("self-scoped and unknown approval API paths are always denied",()=>{
 checkDenied(req("department_entry","POST","/department-approval-requests",["department.fabric.write"],"FABRIC","SELF"));
 checkDenied(req("department_entry","GET","/department-approval-requests/unexpected",["department.fabric.read"]));
});
