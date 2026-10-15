// Shared by Vite's build guard, Node tests, and the browser runtime.
// A preview must never silently communicate with the live UG SaaS API.
const LIVE_HOSTS=new Set(["ugsaas.com","www.ugsaas.com","garmentsaas.netlify.app"]);
const LIVE_API_HOST="api.ugsaas.com";
const isLoopback=host=>["localhost","127.0.0.1","[::1]"].includes(host);
export function resolveApiEndpoint({hostname,configuredUrl}){
 const host=String(hostname||"").trim().toLowerCase();
 const url=String(configuredUrl||"").trim()||(isLoopback(host)?"http://localhost:5000/api":LIVE_HOSTS.has(host)?"https://api.ugsaas.com/api":"");
 if(!url)throw new Error("Staging/preview API endpoint is not configured. Refusing connection to production.");
 let parsed;
 try{parsed=new URL(url)}catch{throw new Error("Invalid VITE_API_URL");}
 if(parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=="/api"||
    !(parsed.protocol==="https:"||(parsed.protocol==="http:"&&isLoopback(parsed.hostname))))
  throw new Error("VITE_API_URL must be a safe HTTPS URL ending in /api");
 if(!LIVE_HOSTS.has(host)&&!isLoopback(host)&&parsed.hostname===LIVE_API_HOST)
  throw new Error("Preview cannot connect to the production UG SaaS API");
 return parsed.origin+parsed.pathname;
}
export function assertSafeNetlifyPreview({context,apiUrl}){
 if(!["deploy-preview","branch-deploy"].includes(String(context||"")))return;
 const value=String(apiUrl||"").trim();
 if(!value)throw new Error("Netlify preview must set VITE_API_URL for an isolated staging backend");
 // Preview host always differs from an approved production host.
 resolveApiEndpoint({hostname:"preview--garmentsaas.netlify.app",configuredUrl:value});
}
