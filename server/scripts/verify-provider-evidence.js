import 'dotenv/config';
import {writeFile} from 'node:fs/promises';
import {emailAcceptance,paymentAcceptance,readProviderEvidence} from '../src/utils/providerAcceptance.js';
// GET only. Inspect staging evidence; never send, capture or refund.
const checks=[];
for(const [name,variable] of [['activation','ACCEPTANCE_ACTIVATION_EMAIL_ID'],['resend','ACCEPTANCE_RESENT_EMAIL_ID'],['reset','ACCEPTANCE_RESET_EMAIL_ID']]){
 const id=process.env[variable];if(!process.env.RESEND_API_KEY||!id){checks.push({check:name+'-delivery',status:'PENDING',reason:'Provider key and email evidence ID required'});continue;}
 if(!/^[a-f0-9-]{36}$/i.test(id)){checks.push({check:name+'-delivery',status:'FAILED',reason:'Invalid evidence ID'});continue;}
 const e=await readProviderEvidence('https://api.resend.com/emails/'+id,'Bearer '+process.env.RESEND_API_KEY);checks.push({check:name+'-delivery',...(e.ok?emailAcceptance(e.data):{status:'FAILED',providerStatus:e.status})});
}
for(const [name,variable] of [['captured','ACCEPTANCE_CAPTURED_PAYMENT_ID'],['failed','ACCEPTANCE_FAILED_PAYMENT_ID'],['refunded','ACCEPTANCE_REFUNDED_PAYMENT_ID']]){
 const id=process.env[variable],key=process.env.RAZORPAY_KEY_ID,secret=process.env.RAZORPAY_KEY_SECRET;
 if(!id||!key||!secret){checks.push({check:name+'-payment',status:'PENDING',reason:'Test-mode credentials and payment evidence ID required'});continue;}
 if(!key.startsWith('rzp_test_')||!/^pay_[a-zA-Z0-9]+$/.test(id)){checks.push({check:name+'-payment',status:'FAILED',reason:'Test-mode key and valid payment ID required'});continue;}
 const e=await readProviderEvidence('https://api.razorpay.com/v1/payments/'+id,'Basic '+Buffer.from(key+':'+secret).toString('base64'));checks.push({check:name+'-payment',...(e.ok?paymentAcceptance(e.data,name):{status:'FAILED',providerStatus:e.status})});
}
const report={checkedAt:new Date().toISOString(),checks,providerEvidencePassed:checks.every(x=>x.status==='PASSED'),productionReady:false,note:'Provider evidence does not prove one-time links, entitlement grants, expiry or ERP refund reconciliation.'};
if(process.env.ACCEPTANCE_PROVIDER_REPORT)await writeFile(process.env.ACCEPTANCE_PROVIDER_REPORT,JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
console.log(JSON.stringify(report));if(!report.providerEvidencePassed)process.exitCode=1;
