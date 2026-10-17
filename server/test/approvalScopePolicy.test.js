import test from "node:test";
import assert from "node:assert/strict";
import {approvalFactoryAllowed,licensedApprovalDepartments,verifiedCompanyOwner,reviewableApprovalDepartments,canSubmitApproval} from "../src/services/approvalScopePolicy.js";

const company={_id:"company-A",ownerUserId:"owner-A",enabledDepartments:["FABRIC","CUTTING"],factories:[{_id:"factory-A",active:true},{_id:"factory-disabled",active:false}]};
const owner={id:"owner-A",companyId:"company-A",factoryId:"factory-A",role:"company_owner",accessScope:"COMPANY",permissions:[]};
const head={id:"head-A",companyId:"company-A",factoryId:"factory-A",role:"department_incharge",department:"FABRIC",accessScope:"DEPARTMENT",permissions:["department.fabric.read","approval.head.fabric","approval.head.cutting"]};
const manager={id:"manager-A",companyId:"company-A",factoryId:"factory-A",role:"management",accessScope:"LOCATION",permissions:["approval.fm.fabric","approval.fm.cutting","approval.fm.packing"]};
const staff={id:"staff-A",companyId:"company-A",factoryId:"factory-A",role:"department_entry",department:"FABRIC",accessScope:"DEPARTMENT",permissions:["department.fabric.write"]};

test("company owner identity and enabled factory are both mandatory",()=>{
 assert.equal(verifiedCompanyOwner(owner,company),true);
 assert.equal(verifiedCompanyOwner({...owner,id:"other"},company),false);
 assert.equal(verifiedCompanyOwner({...owner,companyId:"company-B"},company),false);
 assert.equal(verifiedCompanyOwner({...owner,factoryId:"factory-B"},company),false);
 assert.equal(verifiedCompanyOwner({...owner,factoryId:"factory-disabled"},company),false);
 assert.equal(approvalFactoryAllowed({...head,factoryId:"factory-disabled"},company),false);
});
test("approval inbox permissions never expand disabled departments",()=>{
 assert.deepEqual(licensedApprovalDepartments(company),["FABRIC","CUTTING"]);
 assert.deepEqual(reviewableApprovalDepartments(owner,company),["FABRIC","CUTTING"]);
 assert.deepEqual(reviewableApprovalDepartments({...owner,id:"not-owner"},company),[]);
 assert.deepEqual(reviewableApprovalDepartments(head,company),["FABRIC"]);
 assert.deepEqual(reviewableApprovalDepartments(manager,company),["FABRIC","CUTTING"]);
 assert.deepEqual(reviewableApprovalDepartments({...manager,accessScope:"SELF"},company),[]);
 assert.deepEqual(reviewableApprovalDepartments({...manager,companyId:"company-B"},company),[]);
});
test("only licensed inventory entry staff can submit an approval request",()=>{
 assert.equal(canSubmitApproval(staff,company),true);
 assert.equal(canSubmitApproval({...staff,role:"management"},company),false);
 assert.equal(canSubmitApproval({...staff,role:"company_owner"},company),false);
 assert.equal(canSubmitApproval({...staff,department:"PACKING",permissions:["department.packing.write"]},company),false);
 assert.equal(canSubmitApproval({...staff,department:"CUTTING"},company),false);
 assert.equal(canSubmitApproval({...staff,accessScope:"SELF"},company),false);
 assert.equal(canSubmitApproval({...staff,factoryId:"factory-disabled"},company),false);
 assert.equal(canSubmitApproval({...staff,companyId:"company-B"},company),false);
});
