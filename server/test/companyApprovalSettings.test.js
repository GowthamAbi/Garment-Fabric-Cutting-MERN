import test from "node:test";
import assert from "node:assert/strict";
import {validateLimits} from "../src/models/CompanyApprovalSettings.js";
import {REQUEST_TYPES} from "../src/services/departmentApprovalPolicy.js";
const limits=(h=100,f=1000,o=10000)=>Object.fromEntries(["HEAD","FM","OWNER"].map((k,i)=>[k,Object.fromEntries(REQUEST_TYPES.map(t=>[t,[h,f,o][i]]))]));
test("accept ordered, fully specified limits",()=>assert.equal(validateLimits(limits()),true));
test("reject missing request types and levels",()=>{
 const a=limits();delete a.HEAD.MATERIAL_VARIANCE;assert.equal(validateLimits(a),false);
 const b=limits();delete b.FM;assert.equal(validateLimits(b),false);
});
test("reject inappropriate bounds",()=>{
 assert.equal(validateLimits(limits(2000,1000,10000)),false);
 assert.equal(validateLimits(limits(-1,1000,10000)),false);
 assert.equal(validateLimits(limits(0,100,Infinity)),false);
});
