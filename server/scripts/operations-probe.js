import 'dotenv/config';
// Read-only probe. Non-zero exit is suitable for an external scheduled monitor.
// Never print token, response payloads, provider references or request URLs.
const base=new URL(process.env.MONITOR_API_URL||'https://api.ugsaas.com');
if(base.protocol!=='https:'||base.username||base.password||base.search||base.hash)throw new Error('Configure a public HTTPS API origin without credentials');
const results=[];
async function check(path,token){
 try{const response=await fetch(new URL(path,base),{headers:token?{Authorization:`Bearer ${token}`}:{},signal:AbortSignal.timeout(15000)});if(!response.ok)return {path,ok:false,status:response.status};return {path,ok:true,data:await response.json()};}catch{return {path,ok:false,status:'UNREACHABLE'};}
}
const health=await check('/health');results.push({check:'http-health',ok:health.ok});
const ready=await check('/ready');results.push({check:'database-readiness',ok:ready.ok&&ready.data.ready===true});
if(process.env.MONITOR_OWNER_TOKEN){
 const ops=await check('/api/saas/operations-status',process.env.MONITOR_OWNER_TOKEN);
 const maxAge=Number(process.env.MONITOR_MAX_PENDING_SECONDS||900);if(!Number.isSafeInteger(maxAge)||maxAge<60)throw new Error('Monitor pending threshold must be at least 60 seconds');
 results.push({check:'platform-database',ok:ops.ok&&ops.data.databaseConnected===true});
 if(ops.ok)for(const queue of ['email','payment'])results.push({check:queue+'-queue',ok:!(ops.data[queue].counts.DEAD||0)&&ops.data[queue].oldestPendingSeconds<=maxAge});
}else results.push({check:'owner-queue-monitor',ok:false,reason:'CONFIGURATION_REQUIRED'});
console.log(JSON.stringify({checkedAt:new Date().toISOString(),passed:results.every(r=>r.ok),results}));
if(results.some(r=>!r.ok))process.exitCode=1;
