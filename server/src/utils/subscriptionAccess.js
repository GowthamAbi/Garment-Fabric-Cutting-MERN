export const TRIAL_DAYS=14;
export function trialExpiry(now=Date.now()){return new Date(now+TRIAL_DAYS*86400000);}
export function subscriptionAccess(company,now=Date.now()){
 const expiry=company?.subscriptionEndsAt?new Date(company.subscriptionEndsAt):null;
 const valid=expiry&&Number.isFinite(expiry.getTime());
 const expired=!valid||expiry.getTime()<=now;
 const daysRemaining=valid?Math.max(0,Math.ceil((expiry.getTime()-now)/86400000)):0;
 return {kind:company?.subscriptionPlan==='Trial'?'TRIAL':'PAID',expiresAt:valid?expiry.toISOString():null,daysRemaining,expired,accessAllowed:Boolean(company?.active!==false&&company?.subscriptionStatus==='Active'&&!expired),alert:company?.subscriptionStatus==='PaymentPending'?'PAYMENT_PENDING':expired?'EXPIRED':daysRemaining<=3?'EXPIRING':'ACTIVE'};
}

export function reminderBucket(expiresAt,now=Date.now()){
 const time=new Date(expiresAt).getTime();if(!Number.isFinite(time))return null;
 const days=Math.ceil((time-now)/86400000);
 if(days>7)return null;
 return days>3?7:days>1?3:days>0?1:0;
}
