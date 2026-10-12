import {fail,money,TYPES,authorizeErp} from './policy.js';
export function approvalPolicy(body){
 if(typeof body.enabled!=='boolean'||!Array.isArray(body.types)||new Set(body.types).size!==body.types.length||body.types.some(t=>!TYPES.includes(t)||['OPENING','WORK_ORDER'].includes(t)))fail('Select unique supported approval types');
 const hours=Number(body.escalationHours??24);if(!Number.isSafeInteger(hours)||hours<1||hours>720)fail('Escalation must be 1–720 hours');
 const limits=body.reviewerLimits;if(!Array.isArray(limits)||!limits.length||limits.length>50)fail('Configure 1–50 reviewer limits');
 const reviewerLimits=limits.map(r=>({userId:String(r.userId||'').trim(),limitPaise:money(r.limit)}));if(reviewerLimits.some(r=>!r.userId)||new Set(reviewerLimits.map(r=>r.userId)).size!==reviewerLimits.length)fail('Use unique registered reviewer IDs');
 if(body.enabled&&!body.types.length)fail('Select document types before enabling approval');
 return {approvalThreshold:body.enabled?money(body.threshold):null,approvalTypes:body.types,reviewerLimits,escalationHours:hours,approvalPolicyVersion:1};
}
export function reviewerAllowed(settings,userId,legacyAdmin=false){return settings?.approvalPolicyVersion>=1?Boolean(settings.reviewerLimits?.some(r=>r.userId===userId)):legacyAdmin;}
export function assertApprovalLimit(settings,userId,amount){if(!Number.isSafeInteger(amount)||amount<0)fail('Invalid approval exposure');if(settings?.approvalPolicyVersion>=1){const reviewer=settings.reviewerLimits?.find(r=>r.userId===userId);if(!reviewer||!Number.isSafeInteger(reviewer.limitPaise)||amount>reviewer.limitPaise)fail('Actual document exposure exceeds this reviewer limit; another eligible reviewer must decide');}}
export function approvalDue(request,now=Date.now()){const due=request.dueAt?new Date(request.dueAt).getTime():new Date(request.createdAt).getTime()+24*3600000;return {dueAt:Number.isFinite(due)?new Date(due).toISOString():null,overdue:request.status==='PENDING'&&Number.isFinite(due)&&due<=now,escalatedTo:request.status==='PENDING'&&due<=now?'COMPANY_OWNER':null};}

export function reviewerCanDecide(settings,user,type,legacyAdmin=false){return reviewerAllowed(settings,user.userId,legacyAdmin)&&authorizeErp(user,"post",type);}
