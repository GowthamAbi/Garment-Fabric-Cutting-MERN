import test from "node:test";
import assert from "node:assert/strict";
import {accountsOverview} from "../src/erp/accountsOverviewPolicy.js";
import {DEPARTMENTS,WORKFLOW_DEPARTMENTS} from "../../shared/departmentCatalogue.js";
import {allowedDepartment,enabledDepartment} from "../src/erp/departmentPolicy.js";
import {featureForRequest} from "../src/erp/featurePolicy.js";
import {authorizeErp} from "../src/erp/policy.js";
import {boundaryOptions} from "../src/erp/boundaryPolicy.js";

test("Accounts licensed as sixteenth department without inventing a garment movement",()=>{
 assert.equal(DEPARTMENTS.length,16);
 assert.equal(DEPARTMENTS.at(-1),"ACCOUNTS");
 assert.equal(WORKFLOW_DEPARTMENTS.length,9);
 const company={departmentCatalogueVersion:1,enabledDepartments:["ACCOUNTS"],
  entitlements:{modules:["ACCOUNTS","ERP_FINANCE"],maxDepartments:1}};
 assert.equal(enabledDepartment(company,"ACCOUNTS"),true);
 assert.equal(enabledDepartment({...company,enabledDepartments:["HR"]},"ACCOUNTS"),false);
 assert.equal(enabledDepartment({enabledDepartments:["ACCOUNTS"],entitlements:{modules:["ACCOUNTS"]}},"ACCOUNTS"),false);
 assert.equal(boundaryOptions(company,"ACCOUNTS").externalInward,false);
 assert.equal(boundaryOptions(company,"ACCOUNTS").externalOutward,false);
 assert.equal(featureForRequest("/departments/accounts/overview"),"ERP_FINANCE");
 assert.equal(featureForRequest("/departments/accounts/post"),"ERP_FINANCE");
});
test("Accounts department, finance and posting grants are independent",()=>{
 const base={accessPolicyVersion:1,accessScope:"DEPARTMENT",department:"ACCOUNTS"};
 const head={...base,role:"department_incharge",
  permissions:["department.accounts.read","erp.finance.read"]};
 const staff={...base,role:"department_entry",
  permissions:["department.accounts.read","department.accounts.write","erp.finance.read"]};
 assert.equal(allowedDepartment(head,"ACCOUNTS",false),true);
 assert.equal(allowedDepartment(head,"ACCOUNTS",true),false);
 assert.equal(authorizeErp(head,"finance"),true);
 assert.equal(allowedDepartment(staff,"ACCOUNTS",true),true);
 assert.equal(authorizeErp(staff,"post","JOURNAL"),false);
 const extra={...staff,permissions:[...staff.permissions,"erp.accounts"]};
 assert.equal(authorizeErp(extra,"post","JOURNAL"),true);
 assert.equal(authorizeErp(extra,"post","PURCHASE_INVOICE"),false);
 assert.equal(authorizeErp({...extra,permissions:[...extra.permissions,"erp.purchase"]},
  "post","PURCHASE_INVOICE"),true);
 assert.equal(allowedDepartment({...extra,department:"SHOP"},"ACCOUNTS",false),false);
});
test("Accounts overview uses actual GL, linked settlement and overdue invoices",()=>{
 const now=new Date("2026-10-17T12:00:00Z");
 const entries=[
  {_id:"E1",kind:"JOURNAL",date:new Date("2026-08-30"),account:"AR",
   party:"CUST1",debit:15000,credit:0,documentNo:"SI1"},
  {_id:"E2",kind:"JOURNAL",date:new Date("2026-08-30"),account:"SALES",
   debit:0,credit:13500,documentNo:"SI1"},
  {_id:"E3",kind:"JOURNAL",date:new Date("2026-08-30"),account:"OUTPUT_TAX",
   debit:0,credit:1500,documentNo:"SI1"},
  {_id:"E4",kind:"JOURNAL",date:new Date("2026-09-15"),account:"BANK",
   debit:5000,credit:0,documentNo:"RCP1"},
  {_id:"E5",kind:"JOURNAL",date:new Date("2026-09-15"),account:"AR",
   party:"CUST1",debit:0,credit:5000,documentNo:"RCP1"},
  {_id:"E6",kind:"JOURNAL",date:new Date("2026-10-01"),account:"GRNI",
   debit:7000,credit:0,documentNo:"PI1"},
  {_id:"E7",kind:"JOURNAL",date:new Date("2026-10-01"),account:"AP",
   party:"SUP1",debit:0,credit:7000,documentNo:"PI1"}
 ];
 const documents=[
  {_id:"SI",number:"SI1",type:"SALES_INVOICE",date:new Date("2026-08-30"),
   partyCode:"CUST1",totals:{gross:15000,net:13500,tax:1500},lines:[],metadata:{}},
  {_id:"RC",number:"RCP1",type:"RECEIPT",date:new Date("2026-09-15"),
   sourceId:"SI",partyCode:"CUST1",totals:{gross:5000,net:0,tax:0},
   journals:[{account:"AR",debit:0,credit:5000},{account:"BANK",debit:5000,credit:0}],lines:[]},
  {_id:"PI",number:"PI1",type:"PURCHASE_INVOICE",date:new Date("2026-10-01"),
   partyCode:"SUP1",totals:{gross:7000,net:7000,tax:0},lines:[],metadata:{}}
 ];
 const parties=[{code:"CUST1",name:"Customer One",kind:"CUSTOMER",paymentTermDays:30},
  {code:"SUP1",name:"Supplier One",kind:"SUPPLIER",paymentTermDays:45}];
 const bank=[{_id:"B1",date:"2026-09-15",reference:"RCP1",amount:5000,
  documentId:"RC"},{_id:"B2",date:"2026-10-01",reference:"OTHER",amount:-300}];
 const out=accountsOverview(entries,[],documents,parties,bank,now,30);
 assert.equal(out.summary.receivables,10000);
 assert.equal(out.summary.payables,7000);
 assert.equal(out.summary.bank,5000);
 assert.equal(out.summary.overdueInvoiceCount,1);
 assert.equal(out.summary.overdueAmount,10000);
 assert.equal(out.summary.pendingBankMatches,1);
 assert.equal(out.paymentsDue[0].partyName,"Customer One");
 assert.equal(out.paymentsDue[0].kind,"RECEIVABLE");
 assert.equal(out.ageing.length,2);
 assert.equal(out.journal.length,entries.length);
 assert.equal(out.finance.trialDifference,0);
 assert.equal(out.documents.length,documents.length);
 assert.equal(out.summary.purchaseExpenseDocuments,1);
});
test("Reversals do not generate current invoice obligations; 366 days max",()=>{
 const docs=[
  {_id:"PI1",number:"PI1",type:"PURCHASE_INVOICE",
   date:new Date("2026-09-01"),partyCode:"SUP1",
   totals:{gross:600,net:600},reversedBy:"REV",lines:[]}
 ];
 const out=accountsOverview([],[],docs,[],[],new Date("2026-10-17T12:00:00Z"),60);
 assert.equal(out.ageing.length,0);
 assert.equal(out.summary.payables,0);
 assert.throws(()=>accountsOverview([],[],[],[],[],new Date(),367));
});
