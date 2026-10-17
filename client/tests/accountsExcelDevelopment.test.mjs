import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {EXCEL_REQUIREMENTS} from "../../shared/excelRequirementCatalogue.js";
import {excelOptionTarget} from "../src/config/excelOptionNavigation.mjs";
import {roleDepartmentPages} from "../src/config/roleDepartmentNavigation.mjs";
import {accountsExportRecords} from "../src/config/accountsExport.mjs";
const get=p=>readFileSync(fileURLToPath(new URL(p,import.meta.url)),"utf8");
const cases=new Set([...get("../src/routes/AppRoutes.jsx")
 .matchAll(/case\s+["']([^"']+)["']\s*:/g)].map(x=>x[1]));
const rows=EXCEL_REQUIREMENTS.filter(x=>x.area==="Department"&&x.department==="Accounts");
const base={department:"ACCOUNTS",accessScope:"DEPARTMENT",accessPolicyVersion:1};
const head={...base,role:"department_incharge",
 permissions:["department.accounts.read","erp.finance.read","approval.head.accounts"]};
const staff={...base,role:"department_entry",
 permissions:["department.accounts.read","department.accounts.write","erp.finance.read","erp.accounts"]};
test("Accounts final department has exactly 21 workbook options 10 Head, 11 Staff",()=>{
 assert.equal(rows.length,21);
 for(const [user,role,count] of [[head,"Department Head",10],[staff,"Inventory / Staff",11]]){
  const actual=roleDepartmentPages(user,{accessAllowed:true,enabledDepartments:["ACCOUNTS"]})
   .filter(x=>x.excelCell).map(x=>x.excelCell);
  assert.equal(actual.length,count);
  assert.deepEqual(actual,rows.filter(x=>x.role===role).map(x=>x.id));
 }
});
test("All 21 Accounts options link to real Head/Staff application cases",()=>{
 for(const row of rows){
  const to=excelOptionTarget({...row,departmentCode:"ACCOUNTS"});
  assert.ok(to,row.id+" missing target");
  assert.ok(cases.has(to),row.id+" missing case: "+to);
 }
});
test("Accounts uses canonical posted ERP service and secure Finance gate",()=>{
 const routes=get("../../server/src/erp/accountsDepartmentRoutes.js");
 const app=get("../src/pages/erp/AccountsDepartmentPage.jsx");
 const api=get("../src/api/accountsDepartmentApi.js");
 const feature=get("../../server/src/erp/featurePolicy.js");
 assert.match(routes,/postDocument/);
 assert.match(routes,/authorizeErp\(req.user,"finance"\)/);
 assert.match(routes,/allowedDepartment\(req.user,"ACCOUNTS",write\)/);
 assert.match(routes,/separate ERP posting permission/i);
 assert.match(routes,/PURCHASE_INVOICE/);
 assert.match(api,/Idempotency-Key/);
 assert.match(app,/BankReconciliation/);
 assert.match(app,/SOURCE|Source Posted ERP Invoice/i);
 assert.match(feature,/departments\/accounts/);
});
test("Finance export distinguishes GL, overdue, invoice and tax entries in INR",()=>{
 const fixture={
  ageing:[{number:"PI1",party:"P1",gross:10000,outstanding:7000}],
  paymentsDue:[{number:"SI1",party:"C1",gross:5000,outstanding:2500}],
  journal:[{account:"OUTPUT_TAX",debit:0,credit:500,documentNo:"SI1"}],
  documents:[{number:"SI1",type:"SALES_INVOICE",gross:5000}],
  spend:[{number:"PI1",type:"PURCHASE_INVOICE",gross:10000}],
  bank:[{date:"2026-10-17",reference:"BANK1",amount:-1400,matched:false}],
  salesOrders:[{number:"SO1",party:"C1",sales:10000,cogs:5000,grossMargin:5000}],
  finance:{accounts:[{code:"BANK",name:"Bank",group:"ASSET",debit:1000,
   credit:500,balance:500}]}
 };
 assert.equal(accountsExportRecords("receivable",fixture)[0]["Unpaid INR"],70);
 assert.equal(accountsExportRecords("due",fixture)[0]["Unpaid INR"],25);
 assert.equal(accountsExportRecords("tax",fixture)[0]["Credit INR"],5);
 assert.equal(accountsExportRecords("purchase",fixture)[0]["Gross INR"],100);
 assert.equal(accountsExportRecords("bank",fixture)[0]["Signed INR"],-14);
 assert.equal(accountsExportRecords("margin",fixture)[0]["Indicative Margin INR"],50);
 assert.equal(accountsExportRecords("reports",fixture)[0]["Balance INR"],5);
});
test("Accounts must remain invisible when not subscribed",()=>{
 assert.deepEqual(roleDepartmentPages(staff,{accessAllowed:true,enabledDepartments:["HR"]}),[]);
});
