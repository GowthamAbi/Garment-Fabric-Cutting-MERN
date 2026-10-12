import crypto from "node:crypto";
import ApiError from '../utils/ApiError.js';
function mailError(status, message){ const error=new ApiError(status,message); error.exposeToOwner=true; return error; }
export function activationEmailConfiguration(){
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)throw mailError(503,'Configure RESEND_API_KEY and EMAIL_FROM before sending account emails');
 const candidates=(process.env.CLIENT_URL||'').split(',').map(v=>v.trim()).filter(Boolean);
 const value=process.env.NODE_ENV==='production'?candidates.find(v=>{try{const u=new URL(v);return u.protocol==='https:'&&!['localhost','127.0.0.1'].includes(u.hostname);}catch{return false;}}):candidates[0];
 let url;try{url=new URL(value);}catch{throw mailError(503,'Configure a valid public HTTPS CLIENT_URL for activation links');}
 if(process.env.NODE_ENV==='production'&&(url.protocol!=='https:'||['localhost','127.0.0.1'].includes(url.hostname)))throw mailError(503,'Production CLIENT_URL must be a public HTTPS website');
 return value.replace(/\/$/,'');
}

export async function issueEmailVerification(user, companyKey) {
  const clientUrl=activationEmailConfiguration();
  const rawToken = crypto.randomBytes(32).toString("hex");
  user.emailVerificationToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();
  const activationUrl = `${clientUrl}/c/${companyKey}/login?verifyToken=${rawToken}`;
  await sendAccountEmail({to:user.email,subject:"Activate your UG SaaS account",html:`<h2>UG SaaS account activation</h2><p>Your User ID is <b>${user.userId}</b>.</p><p><a href="${activationUrl}">Verify email and activate account</a></p><p>After verification, sign in to review your trial or choose a paid package in Subscription Purchase. Paid access starts only after confirmed payment; failed or pending payments do not activate paid features.</p><p><a href="${clientUrl}/c/${companyKey}/login">Sign in for subscription and invoices</a></p><p>This link expires in 24 hours. UG SaaS will never email your password.</p>`});
  return activationUrl;
}


export async function sendAccountEmail({to,subject,html}) {
  activationEmailConfiguration();
  let result;
  try {
    result=await fetch("https://api.resend.com/emails",{method:"POST",signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[to],subject,html})});
  } catch {throw mailError(502,"Cannot reach Resend email service or request timed out. Retry and check Render connectivity.");}
  if(!result.ok){
    const reason=result.status===401?'Invalid Resend API key':result.status===403?'Resend sender/domain is not verified or API key lacks sending permission':result.status===429?'Resend sending limit reached':'Check Resend email logs and sender configuration';
    throw mailError(502,`Account email rejected by provider (status ${result.status}): ${reason}`);
  }
}

export async function issuePasswordReset(user,companyKey){
 const clientUrl=activationEmailConfiguration();
 const rawToken=crypto.randomBytes(32).toString('hex');
 user.resetPasswordToken=crypto.createHash('sha256').update(rawToken).digest('hex');
 user.resetPasswordExpires=new Date(Date.now()+15*60*1000);
 await user.save();
 const resetUrl=`${clientUrl}/c/${companyKey}/login?resetToken=${rawToken}`;
 await sendAccountEmail({to:user.email,subject:'UG SaaS password reset',html:`<p>Use this one-time link within 15 minutes:</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, contact your administrator.</p>`});
 return resetUrl;
}
