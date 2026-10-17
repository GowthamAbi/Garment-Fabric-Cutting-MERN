const inr=p=>Number((Number(p||0)/100).toFixed(2));
export function marketingExportRecords(mode,records={}){
 const {leads=[],activities=[],campaigns=[],expenses=[],demands=[],forecast=[],summary={}}=records;
 if(["pipeline","lead"].includes(mode))return leads.map(x=>({
  Company:x.companyName,Contact:x.contactName,Phone:x.phone,Email:x.email,
  LeadStatus:x.status,Source:x.source,Notes:x.notes,Created:x.createdAt||""
 }));
 if(["enquiry","followup","order","communication","calendar","history"].includes(mode))
  return activities.map(a=>({Type:a.kind,Company:a.leadCompany,SKU:a.sku,PCS:a.quantity,
   Note:a.content,"Order Reference":a.orderReference,"Next Follow-up Date":a.nextFollowupDate,
   Recorded:a.createdAt||"",RecordedBy:a.createdBy}));
 if(["campaign"].includes(mode))return campaigns.map(c=>({
  Campaign:c.name,Channel:c.channel,Start:c.startDate,End:c.endDate,
  "Planned Budget INR":inr(c.budgetPaise),Notes:c.notes
 }));
 if(["expenses"].includes(mode))return expenses.map(x=>({
  Date:x.date,Category:x.category,Description:x.description,Reference:x.reference,
  "Recorded Cost INR":inr(x.amountPaise),Campaign:x.campaignId
 }));
 if(["demand","forecast","analysis"].includes(mode))
  return forecast.length?forecast.map(f=>({
    Shop:f.shop,SKU:f.sku,"Net Sold PCS":f.sold,
    "Returned PCS":f.returns,"Stock PCS":f.stock,"Transit PCS":f.inTransit,
    "Replenishment Suggestion PCS":f.suggested,
    Reliability:f.reliability||""
  })):demands.map(d=>({Number:d.number,Shop:d.shop,SKU:d.sku,
   "Requested PCS":d.quantity,Status:d.status,Reason:d.reason}));
 if(mode==="reports"||mode==="performance")return [
  {"Metric":"Leads","Value":summary.totalLeads||0},
  {"Metric":"Open Leads","Value":summary.openLeads||0},
  {"Metric":"Enquiries Recorded","Value":summary.enquiries||0},
  {"Metric":"Scheduled Followups Due (entries)","Value":summary.followupsDue||0},
  {"Metric":"Pending Replenishments","Value":summary.pendingReplenishments||0},
  {"Metric":"Campaign Budget INR","Value":inr(summary.plannedCampaignBudgetPaise)},
  {"Metric":"Recorded Expense INR","Value":inr(summary.recordedMarketingExpensePaise)},
  {"Metric":"Posted Shop Invoice Gross INR (before refunds)","Value":inr(summary.invoiceGrossSalesPaise)}
 ];
 return demands.map(d=>({Number:d.number,Shop:d.shop,SKU:d.sku,
  "Requested PCS":d.quantity,Status:d.status,Reason:d.reason}));
}
