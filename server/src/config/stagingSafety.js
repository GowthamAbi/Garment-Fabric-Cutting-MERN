// Deployment guard for a deliberately isolated, disposable staging environment.
// Database URIs and passwords are never printed or compared to production secrets here.
// A unique database cluster/user must additionally be verified by its operator.
export function validateStagingSafety(env){
 if(env.APP_ENV!=="staging")return true;
 const fail=message=>{throw new Error("Unsafe staging configuration: "+message)};
 if(env.STAGING_ISOLATED_DATA_ACK!=="true")fail("STAGING_ISOLATED_DATA_ACK must confirm a separate test-only MongoDB deployment");
 if(!env.MONGODB_URI||!/^mongodb(?:\+srv)?:\/\//.test(env.MONGODB_URI))fail("isolated staging MongoDB URI required");
 if(!env.CONTROL_DB_NAME||["ugs_control","admin","test","local"].includes(env.CONTROL_DB_NAME.toLowerCase()))
  fail("CONTROL_DB_NAME must not use the live/default control database");
 if(!env.TENANT_DB_PREFIX||env.TENANT_DB_PREFIX==="ugs_tenant_"||!/^[a-z][a-z0-9_]*_$/.test(env.TENANT_DB_PREFIX))
  fail("TENANT_DB_PREFIX must be a separate named staging prefix");
 if(env.AUTOMATION_ENABLED!=="false")fail("automated jobs must be disabled during staging bootstrap");
 if(env.RESEND_API_KEY)fail("remove live email provider credentials from staging bootstrap");
 if(env.RAZORPAY_KEY_ID&&!/^rzp_test_/.test(env.RAZORPAY_KEY_ID))fail("Razorpay key must be test mode");
 if(env.RAZORPAY_KEY_SECRET&&!env.RAZORPAY_KEY_ID?.startsWith("rzp_test_"))fail("Razorpay secret requires test-mode key");
 if(!env.CLIENT_URL)fail("staging CLIENT_URL must be explicitly set");
 for(const raw of env.CLIENT_URL.split(",")){
  let url;
  try{url=new URL(raw.trim())}catch{fail("CLIENT_URL must contain valid origins")}
  if(url.origin!==raw.trim().replace(/\/$/,"")||url.protocol!=="https:")
   fail("CLIENT_URL must contain HTTPS origins without paths");
  if(["ugsaas.com","www.ugsaas.com","garmentsaas.netlify.app","store-inventory-app.netlify.app"].includes(url.hostname))
   fail("staging cannot allow live production frontend origins");
 }
 return true;
}
