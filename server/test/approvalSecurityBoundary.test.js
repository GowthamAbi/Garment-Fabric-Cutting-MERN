import test from "node:test";
import assert from "node:assert/strict";
import {approvalRouteAllowed} from "../src/utils/approvalRoutePolicy.js";
import {includesApprovalGrant,retainExistingApprovalGrants} from "../src/utils/approvalGrantPolicy.js";

const staff={role:"department_entry",accessScope:"DEPARTMENT",department:"FABRIC",permissions:["department.fabric.read","department.fabric.write"]};
const head={role:"department_incharge",accessScope:"DEPARTMENT",department:"FABRIC",permissions:["department.fabric.read","approval.head.fabric"]};
const manager={role:"management",accessScope:"LOCATION",department:"",permissions:["approval.fm.fabric"]};
const decision="/department-approval-requests/507f1f77bcf86cd799439011/decision";

test("department staff can submit or view own requests, not decide or manage grants",()=>{
 assert.equal(approvalRouteAllowed(staff,"/department-approval-requests","POST"),true);
 assert.equal(approvalRouteAllowed(staff,"/department-approval-requests","GET"),true);
 assert.equal(approvalRouteAllowed(staff,decision,"POST"),false);
 assert.equal(approvalRouteAllowed(staff,"/approval-grants","PUT"),false);
});
test("department head can review but never submit operational requests",()=>{
 assert.equal(approvalRouteAllowed(head,"/department-approval-requests/inbox","GET"),true);
 assert.equal(approvalRouteAllowed(head,decision,"POST"),true);
 assert.equal(approvalRouteAllowed(head,"/department-approval-requests","POST"),false);
 assert.equal(approvalRouteAllowed({...head,permissions:[]},"/department-approval-requests/inbox","GET"),false);
});
test("factory manager cannot access company configuration",()=>{
 assert.equal(approvalRouteAllowed(manager,"/department-approval-requests/inbox","GET"),true);
 assert.equal(approvalRouteAllowed(manager,decision,"POST"),true);
 assert.equal(approvalRouteAllowed(manager,"/department-approval-requests/settings","PUT"),false);
 assert.equal(approvalRouteAllowed(manager,"/approval-grants","GET"),false);
});
test("deny unassigned/self users, unknown paths and methods",()=>{
 assert.equal(approvalRouteAllowed({...staff,accessScope:"SELF"},"/department-approval-requests","POST"),false);
 assert.equal(approvalRouteAllowed({...staff,permissions:[]},"/department-approval-requests","POST"),false);
 assert.equal(approvalRouteAllowed(staff,"/department-approval-requests/secret","GET"),false);
 assert.equal(approvalRouteAllowed(staff,"/department-approval-requests","DELETE"),false);
});
test("ordinary user creation cannot mint approval grants",()=>{
 assert.equal(includesApprovalGrant(["department.fabric.read","approval.head.fabric"]),true);
 assert.equal(includesApprovalGrant(["department.fabric.read"]),false);
});
test("ordinary permission edits preserve existing owner-delegated approvals",()=>{
 assert.deepEqual(retainExistingApprovalGrants(["erp.read"],["department.fabric.read","approval.head.fabric"]),["erp.read","approval.head.fabric"]);
 assert.deepEqual(retainExistingApprovalGrants([],["approval.fm.fabric","approval.fm.fabric"]),["approval.fm.fabric"]);
});
