import test from "node:test";
import assert from "node:assert/strict";
import {validateStagingSafety} from "../src/config/stagingSafety.js";
const safe={
 APP_ENV:"staging",STAGING_ISOLATED_DATA_ACK:"true",
 MONGODB_URI:"mongodb+srv://staging-user:fake@staging.example.net/ugs_staging",
 CONTROL_DB_NAME:"ugs_stage_control",TENANT_DB_PREFIX:"ugs_stage_tenant_",
 AUTOMATION_ENABLED:"false",CLIENT_URL:"https://preview--garmentsaas.netlify.app",
 RAZORPAY_KEY_ID:"",RAZORPAY_KEY_SECRET:"",RESEND_API_KEY:""
};
test("isolated staging template passes validation",()=>assert.equal(validateStagingSafety(safe),true));
test("production and local configuration are unaffected",()=>assert.equal(validateStagingSafety({APP_ENV:"production"}),true));
for(const [label,changes] of [
 ["no isolation confirmation",{STAGING_ISOLATED_DATA_ACK:""}],
 ["default live control database",{CONTROL_DB_NAME:"ugs_control"}],
 ["default live tenant prefix",{TENANT_DB_PREFIX:"ugs_tenant_"}],
 ["enabled automation",{AUTOMATION_ENABLED:"true"}],
 ["production live frontend",{CLIENT_URL:"https://ugsaas.com"}],
 ["production Netlify frontend",{CLIENT_URL:"https://garmentsaas.netlify.app"}],
 ["email delivery key",{RESEND_API_KEY:"placeholder-key"}],
 ["live payment key",{RAZORPAY_KEY_ID:"rzp_live_unsafe"}],
 ["payment secret without test key",{RAZORPAY_KEY_SECRET:"fake",RAZORPAY_KEY_ID:""}],
 ["missing staging MongoDB URI",{MONGODB_URI:""}],
 ["missing staging frontend origin",{CLIENT_URL:""}]
]){
 test("reject staging misconfiguration: "+label,()=>{
  assert.throws(()=>validateStagingSafety({...safe,...changes}),/Unsafe staging configuration/);
 });
}
