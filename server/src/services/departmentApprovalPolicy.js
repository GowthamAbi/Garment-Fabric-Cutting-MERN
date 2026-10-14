// Department approval policy primitives. NOT an API endpoint.
// Call from authenticated tenant-scoped handlers after verifying request ownership,
// immutable transaction snapshots, and server-side company/factory entitlements.
import {DEPARTMENTS, departmentCode} from "../../../shared/departmentCatalogue.js";

export const REQUEST_STATUS=Object.freeze({
 PENDING_HEAD:"PENDING_HEAD",PENDING_FM:"PENDING_FM",PENDING_OWNER:"PENDING_OWNER",
 APPROVED:"APPROVED",REJECTED:"REJECTED"
});
export const REQUEST_TYPES=Object.freeze([
 "MATERIAL_VARIANCE","STOCK_ADJUSTMENT","PRODUCTION_PLAN_CHANGE",
 "REWORK_REJECTION","QUANTITY_MISMATCH","DISPATCH_EXCEPTION","PURCHASE_EXCEPTION"
]);
const AUTHORITY=Object.freeze({HEAD:0,FM:1,OWNER:2});
const nextStatus=Object.freeze({HEAD:REQUEST_STATUS.PENDING_FM,FM:REQUEST_STATUS.PENDING_OWNER});
export function evaluateApproval({request,actor,limits}={}){
 if(!request||!actor||!limits)return {allowed:false,reason:"Missing approval context"};
 const department=departmentCode(request.department);
 if(!DEPARTMENTS.includes(department)||!REQUEST_TYPES.includes(request.type))return {allowed:false,reason:"Unsupported request"};
 if(request.status!==REQUEST_STATUS.PENDING_HEAD&&request.status!==REQUEST_STATUS.PENDING_FM&&request.status!==REQUEST_STATUS.PENDING_OWNER)return {allowed:false,reason:"Request not pending"};
 if(!request.companyId||!request.factoryId||!actor.companyId||!actor.factoryId||
  String(request.companyId)!==String(actor.companyId)||String(request.factoryId)!==String(actor.factoryId))
  return {allowed:false,reason:"Company/factory mismatch"};
 if(!request.requestedBy||!actor.userId||String(request.requestedBy)===String(actor.userId))
  return {allowed:false,reason:"Independent approver required"};
 const level=request.status===REQUEST_STATUS.PENDING_HEAD?"HEAD":request.status===REQUEST_STATUS.PENDING_FM?"FM":"OWNER";
 if(actor.approvalLevel!==level)return {allowed:false,reason:"Incorrect approval level"};
 if(level==="HEAD"&&departmentCode(actor.department)!==department)return {allowed:false,reason:"Department mismatch"};
 if(!Array.isArray(actor.grants)||!actor.grants.includes(`approval.${level.toLowerCase()}.${department.toLowerCase()}`))
  return {allowed:false,reason:"Missing approval grant"};
 const max=limits[level]?.[request.type];
 const amount=request.amount;
 if(typeof max!=="number"||!Number.isFinite(max)||max<0||typeof amount!=="number"||!Number.isFinite(amount)||amount<0)
  return {allowed:false,reason:"Invalid approval amount/limit"};
 if(amount>max){
  if(level==="OWNER")return {allowed:false,reason:"Above owner approval limit"};
  return {allowed:true,action:"ESCALATE",nextStatus:nextStatus[level]};
 }
 return {allowed:true,action:"DECIDE",nextStatus:REQUEST_STATUS.APPROVED};
}
export function determineDecision(policy,decision){
 if(!policy?.allowed)return {allowed:false,reason:policy?.reason||"Denied"};
 if(decision==="REJECT")return {allowed:true,status:REQUEST_STATUS.REJECTED,decision};
 if(policy.action==="ESCALATE")return {allowed:true,status:policy.nextStatus,decision:"ESCALATE"};
 if(!["APPROVE","REJECT"].includes(decision))return {allowed:false,reason:"Invalid decision"};
 return {allowed:true,status:decision==="APPROVE"?REQUEST_STATUS.APPROVED:REQUEST_STATUS.REJECTED,decision};
}
