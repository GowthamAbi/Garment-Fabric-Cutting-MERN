import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {EXCEL_REQUIREMENTS} from "../../shared/excelRequirementCatalogue.js";
import {MANAGEMENT_REQUIREMENTS,MANAGEMENT_GAP_REGISTER,managementAuditEntry}
 from "../src/config/managementRequirementAudit.mjs";
const routes=readFileSync(fileURLToPath(new URL("../src/routes/AppRoutes.jsx",import.meta.url)),"utf8");
const appCases=new Set([...routes.matchAll(/case "([^"]+)"/g)].map(x=>x[1]));
test("Phase2 management gap report covers 58+74 exact workbook cells",()=>{
 assert.equal(EXCEL_REQUIREMENTS.length,466);
 assert.equal(MANAGEMENT_REQUIREMENTS.length,132);
 assert.equal(MANAGEMENT_GAP_REGISTER.filter(x=>x.area==="Company Admin").length,58);
 assert.equal(MANAGEMENT_GAP_REGISTER.filter(x=>x.area==="Factory Manager").length,74);
 assert.equal(new Set(MANAGEMENT_GAP_REGISTER.map(x=>x.id)).size,132);
 assert.deepEqual(MANAGEMENT_GAP_REGISTER.map(x=>x.id),MANAGEMENT_REQUIREMENTS.map(x=>x.id));
});
test("Candidate UI pages exist but never imply requirement acceptance",()=>{
 for(const row of MANAGEMENT_GAP_REGISTER){
  assert.equal(row.acceptance,"UNVERIFIED",row.id);
  assert.equal(row.sourceStatus,"UNVERIFIED",row.id);
  assert.equal(row.evidence,"NAVIGATION_CANDIDATE_ONLY",row.id);
  assert.ok(["P0","P1","P2"].includes(row.priority));
  if(row.candidatePage)assert.ok(appCases.has(row.candidatePage),row.id+" missing candidate page "+row.candidatePage);
 }
 assert.equal(managementAuditEntry({area:"Department",id:"F1"}),null);
});
test("Security/privacy/finance/stock management scopes get P0 attention",()=>{
 const byId=new Map(MANAGEMENT_GAP_REGISTER.map(x=>[x.id,x]));
 for(const id of ["A35","A49","A50","A51","A52","A73","A74","A75","A10","A14"])
  assert.equal(byId.get(id)?.priority,"P0",id);
 assert.equal(byId.get("D67")?.priority,"P0");
});
