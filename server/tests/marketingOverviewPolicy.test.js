import test from "node:test";
import assert from "node:assert/strict";
import {marketingMoney,validateMarketingLead,validateMarketingActivity,
 validateMarketingCampaign,validateMarketingExpense,marketingOverview}
 from "../src/erp/marketingOverviewPolicy.js";
import {allowedDepartment,enabledDepartment} from "../src/erp/departmentPolicy.js";

test("Marketing money uses integer paise, rejects floats and unsafe values",()=>{
 assert.equal(marketingMoney("134.25"),13425);
 assert.equal(marketingMoney("0.7"),70);
 assert.equal(marketingMoney("0"),0);
 for(const value of ["-1","1.234","NaN","","Infinity","1e5","9999999999","01.1"])
  assert.throws(()=>marketingMoney(value));
});
test("Lead validates contact, source and email",()=>{
 const lead=validateMarketingLead({companyName:" ACME Textile ",contactName:" Rani ",
  phone:"+91 9876543210",email:"User@Example.COM",source:"REFERRAL"});
 assert.equal(lead.companyName,"ACME Textile");
 assert.equal(lead.email,"user@example.com");
 for(const input of [{companyName:"X",contactName:"Rani",source:"DIRECT"},
  {companyName:"ACME",contactName:"A",source:"DIRECT"},
  {companyName:"ACME",contactName:"Rani",email:"not-email",source:"DIRECT"},
  {companyName:"ACME",contactName:"Rani",source:"ILLEGAL"}])
  assert.throws(()=>validateMarketingLead(input));
});
test("Enquiry, follow-up and manually referenced order activity validation",()=>{
 const valid=validateMarketingActivity({kind:"ENQUIRY",content:"500 pieces enquired",
  sku:"shirt-m",quantity:"500",nextFollowupDate:"2026-10-18"});
 assert.equal(valid.quantity,500);assert.equal(valid.sku,"SHIRT-M");
 assert.equal(validateMarketingActivity({kind:"ORDER_FOLLOWUP",content:"Order shipping enquiry",
  orderReference:"ORD-123"}).orderReference,"ORD-123");
 for(const input of [{kind:"ENQUIRY",content:"Quantity requested",sku:"SHIRT-M",quantity:0},
  {kind:"FOLLOWUP",content:"Short"},
  {kind:"FOLLOWUP",content:"Customer follow-up today",nextFollowupDate:"2026-02-30"},
  {kind:"ORDER_FOLLOWUP",content:"Followed up on delivery"},
  {kind:"UNSUPPORTED",content:"Customer followed up"}])
  assert.throws(()=>validateMarketingActivity(input));
});
test("Campaign and expense have validated dates and nonposting costs",()=>{
 const campaign=validateMarketingCampaign({name:"Festive launch",channel:"DIGITAL",
  startDate:"2026-10-18",endDate:"2026-10-20",budgetINR:"2500.50"});
 assert.equal(campaign.budgetPaise,250050);
 assert.deepEqual(validateMarketingExpense({date:"2026-10-17",category:"TRAVEL",
   description:"Client visit",amountINR:"100.25"}),{
   date:"2026-10-17",category:"TRAVEL",description:"Client visit",
   reference:"",amountPaise:10025
 });
 for(const input of [
  {name:"Hi",channel:"DIGITAL",startDate:"2026-10-18",endDate:"2026-10-20",budgetINR:"100"},
  {name:"Campaign",channel:"DIGITAL",startDate:"2026-11-18",endDate:"2026-10-20",budgetINR:"100"},
  {name:"Campaign",channel:"DIRECT",startDate:"2026-10-18",endDate:"2026-10-20",budgetINR:"100"}
 ])assert.throws(()=>validateMarketingCampaign(input));
 assert.throws(()=>validateMarketingExpense({date:"2026-10-17",category:"TRAVEL",
  description:"Travel visit",amountINR:"0"}));
});
test("Marketing KPI reports use CRM, sales and nonposted expense separately",()=>{
 const l=[{_id:"l1",companyName:"Acme",status:"CONTACTED"},
  {_id:"l2",companyName:"Beta",status:"WON"}];
 const acts=[
  {_id:"a1",leadId:"l1",kind:"ENQUIRY",content:"Sample request"},
  {_id:"a2",leadId:"l1",kind:"FOLLOWUP",nextFollowupDate:"2026-10-17"},
  {_id:"a3",leadId:"l2",kind:"FOLLOWUP",nextFollowupDate:"2026-10-16"}];
 const campaigns=[{_id:"c1",startDate:"2026-10-01",endDate:"2026-10-20",budgetPaise:100000},
  {_id:"c2",startDate:"2026-11-01",endDate:"2026-11-20",budgetPaise:25000}];
 const expenses=[{_id:"e1",amountPaise:7200},{_id:"e2",amountPaise:2800}];
 const demands=[{_id:"d1",status:"PENDING"},{_id:"d2",status:"APPROVED"}];
 const sales=[{quantity:20,returned:5,totals:{gross:200000}},
  {quantity:10,returned:0,totals:{gross:100000}}];
 const out=marketingOverview(l,acts,campaigns,expenses,demands,sales,new Date("2026-10-17T05:00:00Z"));
 assert.equal(out.summary.totalLeads,2);
 assert.equal(out.summary.openLeads,1);
 assert.equal(out.summary.enquiries,1);
 assert.equal(out.summary.followupsDue,1);
 assert.equal(out.summary.activeCampaigns,1);
 assert.equal(out.summary.plannedCampaignBudgetPaise,125000);
 assert.equal(out.summary.recordedMarketingExpensePaise,10000);
 assert.equal(out.summary.pendingReplenishments,1);
 assert.equal(out.summary.invoiceGrossSalesPaise,300000);
 assert.equal(out.summary.invoicePcs,25);
 assert.equal(out.summary.invoiceCount,2);
 assert.equal(out.activities[0].leadCompany,"Acme");
 assert.match(out.notes.communication,/no email/i);
});
test("MARKETING Head read-only, Staff write and licensing isolated",()=>{
 const base={department:"MARKETING",accessScope:"DEPARTMENT",accessPolicyVersion:1};
 const head={...base,role:"department_incharge",permissions:["department.marketing.read"]};
 const staff={...base,role:"department_entry",permissions:["department.marketing.read","department.marketing.write"]};
 const company={departmentCatalogueVersion:1,enabledDepartments:["MARKETING"],
  entitlements:{modules:["MARKETING"],maxDepartments:1}};
 assert.equal(allowedDepartment(head,"MARKETING",false),true);
 assert.equal(allowedDepartment(head,"MARKETING",true),false);
 assert.equal(allowedDepartment(staff,"MARKETING",true),true);
 assert.equal(allowedDepartment({...staff,department:"SHOP"},"MARKETING",false),false);
 assert.equal(enabledDepartment(company,"MARKETING"),true);
 assert.equal(enabledDepartment({...company,enabledDepartments:["SHOP"]},"MARKETING"),false);
});
