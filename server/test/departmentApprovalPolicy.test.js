import test from "node:test";
import assert from "node:assert/strict";
import {evaluateApproval,determineDecision,REQUEST_STATUS} from "../src/services/departmentApprovalPolicy.js";
const request={companyId:"c1",factoryId:"f1",requestedBy:"staff1",department:"CUTTING",type:"MATERIAL_VARIANCE",status:REQUEST_STATUS.PENDING_HEAD,amount:200};
const actor={companyId:"c1",factoryId:"f1",userId:"head1",department:"CUTTING",approvalLevel:"HEAD",grants:["approval.head.cutting"]};
const limits={HEAD:{MATERIAL_VARIANCE:500},FM:{MATERIAL_VARIANCE:1000},OWNER:{MATERIAL_VARIANCE:5000}};
test("head approval and rejection",()=>{
 const p=evaluateApproval({request,actor,limits});
 assert.equal(p.action,"DECIDE");
 assert.equal(determineDecision(p,"APPROVE").status,"APPROVED");
 assert.equal(determineDecision(p,"REJECT").status,"REJECTED");
});
test("above-limit escalates without automatically approving",()=>{
 const p=evaluateApproval({request:{...request,amount:600},actor,limits});
 assert.equal(p.action,"ESCALATE");
 assert.equal(determineDecision(p,"APPROVE").status,"PENDING_FM");
});
test("deny self approval and cross tenant access",()=>{
 assert.equal(evaluateApproval({request,actor:{...actor,userId:"staff1"},limits}).allowed,false);
 assert.equal(evaluateApproval({request,actor:{...actor,companyId:"other"},limits}).allowed,false);
 assert.equal(evaluateApproval({request,actor:{...actor,factoryId:"other"},limits}).allowed,false);
});
test("deny missing grants and incorrect department",()=>{
 assert.equal(evaluateApproval({request,actor:{...actor,grants:[]},limits}).allowed,false);
 assert.equal(evaluateApproval({request,actor:{...actor,department:"FABRIC"},limits}).allowed,false);
});
test("deny invalid status and unconfigured amounts",()=>{
 assert.equal(evaluateApproval({request:{...request,status:"APPROVED"},actor,limits}).allowed,false);
 assert.equal(evaluateApproval({request:{...request,amount:NaN},actor,limits}).allowed,false);
 assert.equal(evaluateApproval({request,actor,limits:{}}).allowed,false);
});
