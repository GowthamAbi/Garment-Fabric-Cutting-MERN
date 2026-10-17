import test from "node:test";
import assert from "node:assert/strict";
import {resolveApiEndpoint,assertSafeNetlifyPreview} from "../src/utils/apiEndpointPolicy.mjs";
test("live hosts retain existing production fallback",()=>{
 assert.equal(resolveApiEndpoint({hostname:"ugsaas.com"}),"https://api.ugsaas.com/api");
 assert.equal(resolveApiEndpoint({hostname:"garmentsaas.netlify.app"}),"https://api.ugsaas.com/api");
});
test("Netlify preview without dedicated API must fail closed",()=>{
 assert.throws(()=>assertSafeNetlifyPreview({context:"deploy-preview",apiUrl:""}),/must set/);
 assert.throws(()=>resolveApiEndpoint({hostname:"deploy-preview-1--garmentsaas.netlify.app"}),/not configured/);
});
test("preview cannot connect to live production backend even when explicitly configured",()=>{
 assert.throws(()=>assertSafeNetlifyPreview({context:"branch-deploy",apiUrl:"https://api.ugsaas.com/api"}),/cannot connect/);
 assert.throws(()=>resolveApiEndpoint({hostname:"preview.ugsaas.com",configuredUrl:"https://api.ugsaas.com/api"}),/cannot connect/);
});
test("valid dedicated staging API works",()=>{
 const api="https://staging-api.example.net/api";
 assert.doesNotThrow(()=>assertSafeNetlifyPreview({context:"deploy-preview",apiUrl:api}));
 assert.equal(resolveApiEndpoint({hostname:"deploy-preview-1--garmentsaas.netlify.app",configuredUrl:api}),api);
});
test("unsafe remote http and unexpected API paths are denied",()=>{
 assert.throws(()=>resolveApiEndpoint({hostname:"preview.example.net",configuredUrl:"http://staging-api.example.net/api"}),/safe HTTPS/);
 assert.throws(()=>resolveApiEndpoint({hostname:"preview.example.net",configuredUrl:"https://staging-api.example.net/admin"}),/safe HTTPS/);
 assert.equal(resolveApiEndpoint({hostname:"localhost"}),"http://localhost:5000/api");
});
