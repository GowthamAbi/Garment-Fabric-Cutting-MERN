import test from "node:test";
import assert from "node:assert/strict";
import {approvalFactoryAllowed,reviewableApprovalDepartments,canSubmitApproval,
 canReadApprovalHistory,canReadApprovalSettings,verifiedCompanyOwner}
 from "../src/services/approvalScopePolicy.js";
import {evaluateApproval,determineDecision,REQUEST_TYPES} from "../src/services/departmentApprovalPolicy.js";
const c="a".repeat(24),f1="b".repeat(24),f2="c".repeat(24);
const company={_id:c,ownerUserId:"owner",enabledDepartments:["FABRIC","CUTTING"],
 factories:[{_id:f1,active:true},{_id:f2,active:true}]};
const owner={id:"owner",companyId:c,factoryId:f1,role:"company_owner",accessScope:"COMPANY"};
const head={id:"head",companyId:c,factoryId:f1,role:"department_incharge",
 accessPolicyVersion:1,accessScope:"DEPARTMENT",department:"FABRIC",assignedFactoryIds:[f1],
 permissions:["department.fabric.read","approval.head.fabric"]};
const fm={id:"fm",companyId:c,factoryId:f1,role:"management",
 accessPolicyVersion:1,accessScope:"LOCATION",assignedFactoryIds:[f1],
 permissions:["approval.fm.fabric","approval.fm.cutting"]};
const staff={id:"staff",companyId:c,factoryId:f1,role:"department_entry",
 accessPolicyVersion:1,accessScope:"DEPARTMENT",department:"FABRIC",assignedFactoryIds:[f1],
 permissions:["department.fabric.write","department.fabric.read"]};
const limits=Object.fromEntries(["HEAD","FM","OWNER"].map((level,i)=>[level,
 Object.fromEntries(REQUEST_TYPES.map(x=>[x,[100,500,1000][i]]))]));
test("P0: reviewer cannot claim a different factory, disabled factory or company",()=>{
 assert.equal(approvalFactoryAllowed(head,company),true);
 assert.equal(approvalFactoryAllowed({...fm,factoryId:f2},company),false);
 assert.equal(approvalFactoryAllowed({...head,assignedFactoryIds:[]},company),false);
 assert.equal(approvalFactoryAllowed({...fm,companyId:"wrong"},company),false);
 assert.equal(approvalFactoryAllowed({...owner,factoryId:f2},company),true);
 assert.equal(verifiedCompanyOwner({...owner,id:"forged"},company),false);
 assert.equal(approvalFactoryAllowed({...head,accessScope:"SELF"},company),false);
});
test("P0: head sees own department; FM sees only granted and assigned",()=>{
 assert.deepEqual(reviewableApprovalDepartments(head,company),["FABRIC"]);
 assert.deepEqual(reviewableApprovalDepartments(fm,company),["FABRIC","CUTTING"]);
 assert.deepEqual(reviewableApprovalDepartments({...fm,accessScope:"DEPARTMENT",department:"FABRIC"},company),["FABRIC"]);
 assert.deepEqual(reviewableApprovalDepartments({...fm,permissions:[]},company),[]);
 assert.deepEqual(reviewableApprovalDepartments({...fm,factoryId:f2},company),[]);
 assert.deepEqual(reviewableApprovalDepartments({...head,department:"CUTTING"},company),[]);
 assert.equal(canSubmitApproval(staff,company),true);
 assert.equal(canSubmitApproval({...staff,assignedFactoryIds:[]},company),false);
});
test("P0: strict company admin approval history is permission + scope restricted",()=>{
 const admin={role:"company_admin",accessPolicyVersion:1,accessScope:"DEPARTMENT",
  department:"FABRIC",permissions:["department.fabric.read","department.cutting.read"]};
 assert.equal(canReadApprovalHistory(admin,"FABRIC"),true);
 assert.equal(canReadApprovalHistory(admin,"CUTTING"),false);
 assert.equal(canReadApprovalHistory({...admin,permissions:[]},"FABRIC"),false);
 assert.equal(canReadApprovalHistory({...admin,accessScope:"SELF"},"FABRIC"),false);
 assert.equal(canReadApprovalHistory({...admin,accessScope:"COMPANY",permissions:["company.settings"]},"CUTTING"),true);
 assert.equal(canReadApprovalHistory({...admin,role:"admin",permissions:["company.settings"]},"FABRIC"),false);
 assert.equal(canReadApprovalHistory({...admin,role:"admin",permissions:["department.fabric.read"]},"FABRIC"),true);
 assert.equal(canReadApprovalHistory(owner,"CUTTING"),true);
 assert.equal(canReadApprovalHistory({role:"company_admin",accessScope:"COMPANY"},"CUTTING"),true);
 assert.equal(canReadApprovalHistory({...admin,role:"department_entry"},"CUTTING"),false);
});
test("P0: strict company approval thresholds only visible to properly scoped admin",()=>{
 assert.equal(canReadApprovalSettings(owner),true);
 assert.equal(canReadApprovalSettings({role:"company_admin",accessScope:"COMPANY",
  accessPolicyVersion:1,permissions:["company.settings"]}),true);
 assert.equal(canReadApprovalSettings({role:"company_admin",accessScope:"DEPARTMENT",
  accessPolicyVersion:1,permissions:["company.settings"]}),false);
 assert.equal(canReadApprovalSettings({role:"company_admin",accessScope:"COMPANY",
  accessPolicyVersion:1,permissions:[]}),false);
 assert.equal(canReadApprovalSettings({...owner,role:"management"}),false);
});
test("P0: independent reviewer; threshold escalation, forbidden over-owner approval",()=>{
 const request={companyId:c,factoryId:f1,department:"FABRIC",requestedBy:"staff",
  type:"MATERIAL_VARIANCE",status:"PENDING_HEAD",amount:120};
 const actor={companyId:c,factoryId:f1,department:"FABRIC",userId:"head",
  approvalLevel:"HEAD",grants:["approval.head.fabric"]};
 const policy=evaluateApproval({request,actor,limits});
 assert.equal(policy.action,"ESCALATE");
 assert.equal(determineDecision(policy,"APPROVE").status,"PENDING_FM");
 assert.equal(determineDecision(policy,"REJECT").status,"REJECTED");
 assert.equal(evaluateApproval({request,actor:{...actor,userId:"staff"},limits}).allowed,false);
 assert.equal(evaluateApproval({request,actor:{...actor,factoryId:f2},limits}).allowed,false);
 const over=evaluateApproval({request:{...request,status:"PENDING_OWNER",amount:1001},
  actor:{...actor,approvalLevel:"OWNER",grants:["approval.owner.fabric"]},limits});
 assert.equal(determineDecision(over,"APPROVE").allowed,false);
 assert.equal(determineDecision(over,"REJECT").status,"REJECTED");
});
test("P0: actual routes use permission checks and transactional grant audit",async()=>{
 const fs=await import("node:fs/promises");
 const routes=await fs.readFile(new URL("../src/routes/departmentApprovalRequests.routes.js",import.meta.url),"utf8");
 const grants=await fs.readFile(new URL("../src/routes/approvalGrants.routes.js",import.meta.url),"utf8");
 assert.match(routes,/canReadApprovalHistory\(user,d\)/);
 assert.match(routes,/canReadApprovalSettings\(req.user\)/);
 assert.match(grants,/session\.withTransaction\(async\(\)=>/);
 assert.match(grants,/AuditLog\.create\(\[/);
 assert.match(grants,/Company\.findById\(req.user.companyId\)/);
});
