import crypto from "node:crypto";
import ApiError from '../utils/ApiError.js';
export function activationEmailConfiguration(){
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)throw new ApiError(503,'Configure RESEND_API_KEY and EMAIL_FROM before creating a company');
 const value=(process.env.CLIENT_URL||'').split(',')[0].trim();
 let url;try{url=new URL(value);}catch{throw new ApiError(503,'Configure a valid CLIENT_URL for activation links');}
 if(process.env.NODE_ENV==='production'&&(url.protocol!=='https:'||['localhost','127.0.0.1'].includes(url.hostname)))throw new ApiError(503,'Production CLIENT_URL must be a public HTTPS website');
 return value.replace(/\/$/,'');
}

export async function issueEmailVerification(user, companyKey) {
  const clientUrl=activationEmailConfiguration();
  const rawToken = crypto.randomBytes(32).toString("hex");
  user.emailVerificationToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();
  const activationUrl = `${clientUrl}/c/${companyKey}/login?verifyToken=${rawToken}`;
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [user.email],
        subject: "Activate your UG SaaS account",
        html: `<h2>UG SaaS account activation</h2><p>Your User ID is <b>${user.userId}</b>.</p><p><a href="${activationUrl}">Verify email and activate account</a></p><p>This link expires in 24 hours. UG SaaS will never email your password.</p>`,
      }),
    });
    if (!result.ok) throw new ApiError(502,`Activation email rejected by provider (status ${result.status}); check Resend domain and sender configuration`);
  }
  return activationUrl;
}

