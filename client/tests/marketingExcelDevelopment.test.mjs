import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {EXCEL_REQUIREMENTS} from "../../shared/excelRequirementCatalogue.js";
import {excelOptionTarget} from "../src/config/excelOptionNavigation.mjs";
import {roleDepartmentPages} from "../src/config/roleDepartmentNavigation.mjs";
import {marketingExportRecords} from "../src/config/marketingExport.mjs";
const get=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const cases=new Set([...get("../src/routes/AppRoutes.jsx").matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(x=>x[1]));
const rows=EXCEL_REQUIREMENTS.filter(x=>x.area==="Department"&&x.department==="Marketing");
const base={department:"MARKETING",accessScope:"DEPARTMENT",accessPolicyVersion:1};
const head={...base,role:"department_incharge",
 permissions:["department.marketing.read","approval.head.marketing"]};
const staff={...base,role:"department_entry",
 permissions:["department.marketing.read","department.marketing.write"]};
test("Marketing 20 workbook entries: Head 10 Staff 10",()=>{
 assert.equal(rows.length,20);
 for(const [actor,role,count] of [[head,"Department Head",10],[staff,"Inventory / Staff",10]]){
  const ids=roleDepartmentPages(actor,{accessAllowed:true,enabledDepartments:["MARKETING"]})
   .filter(x=>x.excelCell).map(x=>x.excelCell);
  assert.equal(ids.length,count);
  assert.deepEqual(ids,rows.filter(x=>x.role===role).map(x=>x.id));
 }
});
test("All Marketing Excel options have actual app routing",()=>{
 for(const row of rows){
  const target=excelOptionTarget({...row,departmentCode:"MARKETING"});
  assert.ok(target,row.id+" missing route");
  assert.ok(cases.has(target),row.id+" missing AppRoutes case "+target);
 }
});
test("Marketing operations log CRM but do not double-book accounting or send messages",()=>{
 const page=get("../src/pages/erp/MarketingDepartmentPage.jsx");
 const api=get("../src/api/marketingDepartmentApi.js");
 const server=get("../../server/src/erp/departmentRoutes.js");
 assert.match(page,/Customer \/ Lead Registration/);
 assert.match(page,/Replenishment Forecast/);
 assert.match(page,/No email, WhatsApp or SMS is sent/);
 assert.match(api,/erp\/departments/);
 assert.match(api,/\/marketing\/expenses/);
 assert.match(api,/\/marketing\/analysis/);
 assert.match(server,/requireAccess\(req,'MARKETING'\)/);
 assert.match(server,/MARKETING_EXPENSE/);
});
test("Marketing exports distinct pipeline, activities, expense, forecast, and reports",()=>{
 const data={
  leads:[{companyName:"Acme",status:"NEW",source:"PHONE"}],
  activities:[{kind:"ENQUIRY",content:"New enquiry",leadCompany:"Acme",quantity:5}],
  campaigns:[{name:"Launch",budgetPaise:50000}],
  expenses:[{date:"2026-10-17",category:"TRAVEL",amountPaise:1275}],
  forecast:[{shop:"SHOP1",sku:"SHIRT-M",suggested:55}],
  demands:[{number:"DEM-1",quantity:40,status:"PENDING"}],
  summary:{totalLeads:1,recordedMarketingExpensePaise:1275}
 };
 assert.equal(marketingExportRecords("lead",data)[0].LeadStatus,"NEW");
 assert.equal(marketingExportRecords("enquiry",data)[0].Type,"ENQUIRY");
 assert.equal(marketingExportRecords("campaign",data)[0]["Planned Budget INR"],500);
 assert.equal(marketingExportRecords("expenses",data)[0]["Recorded Cost INR"],12.75);
 assert.equal(marketingExportRecords("forecast",data)[0]["Replenishment Suggestion PCS"],55);
 assert.equal(marketingExportRecords("reports",data)[0].Metric,"Leads");
});
test("Unlicensed MARKETING options hidden from SHOP-only staff",()=>{
 assert.deepEqual(roleDepartmentPages(staff,{accessAllowed:true,enabledDepartments:["SHOP"]}),[]);
});
