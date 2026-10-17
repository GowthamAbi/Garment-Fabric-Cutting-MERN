// Marketing CRM is tenant-local planning data. No client communication,
// customer order, payment or financial stock movement is sent from here.
import ApiError from "../utils/ApiError.js";
const s=x=>String(x??"").trim();
const dateValue=x=>{const v=s(x),dt=new Date(v);return /^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(dt.valueOf())&&dt.toISOString().slice(0,10)===v?v:null;};
const str=(v,name,min=1,max=160)=>{const x=s(v);if(x.length<min||x.length>max)throw new ApiError(400,name+" length must be "+min+"–"+max);return x;};
const email=x=>{const v=s(x).toLowerCase();if(v&&(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)||v.length>150))throw new ApiError(400,"Invalid customer email");return v;};
const statusSet=new Set(["NEW","CONTACTED","QUALIFIED","PROPOSAL","WON","LOST"]);
export function marketingMoney(v,name="Amount"){
 const text=s(v);
 if(!/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(text))throw new ApiError(400,name+" must be INR up to 2 decimals");
 const [whole,decimal=""]=text.split(".");
 const paise=Number(whole)*100+Number((decimal+"00").slice(0,2));
 if(!Number.isSafeInteger(paise)||paise<0)throw new ApiError(400,"Amount too large");
 return paise;
}
export function validateMarketingLead(v={}){
 const companyName=str(v.companyName,"Company name",2,120),
  contactName=str(v.contactName,"Contact name",2,100),
  phone=s(v.phone),emailAddress=email(v.email),source=s(v.source)||"OTHER",
  notes=s(v.notes);
 if(phone&&(!/^[+\d() -]{7,25}$/.test(phone)))throw new ApiError(400,"Phone number invalid");
 if(!["WEBSITE","REFERRAL","PHONE","EXHIBITION","DIRECT","OTHER"].includes(source))
  throw new ApiError(400,"Unknown lead source");
 if(notes.length>500)throw new ApiError(400,"Notes too long");
 return {companyName,contactName,phone,email:emailAddress,source,notes};
}
export function validateMarketingActivity(v={}){
 const kind=s(v.kind).toUpperCase(),
  content=str(v.content,"Activity note",8,500),
  nextFollowupDate=s(v.nextFollowupDate),reference=s(v.orderReference);
 if(!["ENQUIRY","FOLLOWUP","COMMUNICATION","ORDER_FOLLOWUP"].includes(kind))
  throw new ApiError(400,"Unknown activity type");
 if(nextFollowupDate&&!dateValue(nextFollowupDate))throw new ApiError(400,"Invalid next follow-up date");
 if(reference.length>120)throw new ApiError(400,"Order reference too long");
 if(kind==="ORDER_FOLLOWUP"&&!reference)throw new ApiError(400,"Order reference required");
 const sku=s(v.sku).toUpperCase(),quantity=Number(v.quantity||0);
 if(sku.length>80||!Number.isSafeInteger(quantity)||quantity<0||quantity>1000000)
  throw new ApiError(400,"Invalid SKU or quantity");
 if(kind==="ENQUIRY"&&(!sku||quantity<1))throw new ApiError(400,"Enquiry SKU and quantity required");
 return {kind,content,nextFollowupDate,orderReference:reference,sku,quantity};
}
export function validateMarketingCampaign(v={}){
 const name=str(v.name,"Campaign",3,120),startDate=dateValue(v.startDate),endDate=dateValue(v.endDate);
 if(!startDate||!endDate||startDate>endDate)throw new ApiError(400,"Invalid campaign date range");
 const channel=s(v.channel).toUpperCase(),notes=s(v.notes);
 if(!["EMAIL","DIGITAL","EXHIBITION","FIELD","OTHER"].includes(channel)||notes.length>300)
  throw new ApiError(400,"Invalid campaign channel or notes");
 return {name,channel,startDate,endDate,budgetPaise:marketingMoney(v.budgetINR,"Campaign budget"),notes};
}
export function validateMarketingExpense(v={}){
 const date=dateValue(v.date),category=s(v.category).toUpperCase(),
  description=str(v.description,"Expense description",4,200),reference=s(v.reference);
 if(!date||!["TRAVEL","DIGITAL_ADS","EVENT","PRINT","OTHER"].includes(category)||reference.length>100)
  throw new ApiError(400,"Invalid expense date/category/reference");
 const amountPaise=marketingMoney(v.amountINR,"Marketing expense");
 if(amountPaise<=0)throw new ApiError(400,"Expense must be positive");
 return {date,category,description,reference,amountPaise};
}
export function marketingOverview(leads=[],activities=[],campaigns=[],expenses=[],demands=[],sales=[],now=new Date()){
 const byLead=new Map(leads.map(l=>[String(l._id),l])),today=now.toISOString().slice(0,10);
 const summary={totalLeads:leads.length,openLeads:0,enquiries:0,followupsDue:0,
  activeCampaigns:0,plannedCampaignBudgetPaise:0,recordedMarketingExpensePaise:0,
  pendingReplenishments:0,invoiceGrossSalesPaise:0,invoicePcs:0,invoiceCount:sales.length};
 for(const l of leads)if(!["WON","LOST"].includes(l.status))summary.openLeads++;
 for(const a of activities){
  if(a.kind==="ENQUIRY")summary.enquiries++;
  if(a.kind==="FOLLOWUP"&&a.nextFollowupDate&&a.nextFollowupDate<=today&&!["WON","LOST"].includes(byLead.get(String(a.leadId))?.status))summary.followupsDue++;
 }
 for(const c of campaigns){
  summary.plannedCampaignBudgetPaise+=c.budgetPaise||0;
  if(c.startDate<=today&&c.endDate>=today)summary.activeCampaigns++;
 }
 summary.recordedMarketingExpensePaise=expenses.reduce((sum,x)=>sum+(x.amountPaise||0),0);
 summary.pendingReplenishments=demands.filter(x=>x.status==="PENDING").length;
 for(const sale of sales){
  summary.invoiceGrossSalesPaise+=sale.totals?.gross||0;
  summary.invoicePcs+=(sale.quantity||0)-(sale.returned||0);
 }
 return {summary,leads:leads.map(x=>({...x,id:String(x._id)})),
  activities:activities.map(x=>({...x,id:String(x._id),leadCompany:byLead.get(String(x.leadId))?.companyName||""})),
  campaigns:campaigns.map(x=>({...x,id:String(x._id)})),
  expenses:expenses.map(x=>({...x,id:String(x._id)})),
  demands:demands.map(x=>({...x,id:String(x._id)})),
  notes:{campaignCosts:"Management tracking only, not journaled expenditure",
   orderFollowup:"Manual reference, not an ERP sales-order update",
   communication:"Log entry only; no email, WhatsApp or SMS was sent",
   invoiceGrossSales:"Posted shop invoice gross, excluding refund adjustments",
   forecast:"Use existing /marketing/analysis with reviewed assumptions"}};
}
