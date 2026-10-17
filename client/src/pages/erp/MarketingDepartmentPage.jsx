import {useEffect,useMemo,useRef,useState} from "react";
import {Download,Printer,RefreshCw,Save} from "lucide-react";
import {useAuth} from "../../context/AuthContext.jsx";
import {exportCsv} from "../../api.js";
import {getMarketingOverview,getMarketingForecast,createMarketingLead,
 updateMarketingLeadStatus,createMarketingActivity,createMarketingCampaign,
 createMarketingExpense,createMarketingDemand} from "../../api/marketingDepartmentApi.js";
import {marketingExportRecords} from "../../config/marketingExport.mjs";
import "./MarketingDepartmentPage.css";

const names={
 performance:"Marketing Performance",analysis:"Sales & Demand Analysis",
 pipeline:"Customer / Lead Pipeline",order:"Order Follow-Up",
 forecast:"Replenishment Forecast",expenses:"Marketing Expenses",
 reports:"Marketing Reports",lead:"Customer / Lead Registration",
 enquiry:"Customer Enquiry Entry",followup:"Follow-Up Entry",
 demand:"Sales / Demand Request",campaign:"Marketing Campaign Entry",
 communication:"Customer Communication",calendar:"Follow-Up Calendar",
 history:"Request History & Reports"
};
const init={summary:{},leads:[],activities:[],campaigns:[],expenses:[],demands:[]};
const n=v=>Number(v||0).toLocaleString("en-IN");
const money=v=>"₹"+(Number(v||0)/100).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
function Table({headers,rows}){
 return <div style={{overflowX:"auto"}}><table className="classic-table" style={{width:"100%",minWidth:790}}>
  <thead><tr>{headers.map(x=><th key={x}>{x}</th>)}</tr></thead>
  <tbody>{rows.length?rows.map((x,i)=><tr key={i}>{x.map((v,j)=><td key={j}>{v??"—"}</td>)}</tr>):
   <tr><td colSpan={headers.length}>No matching marketing records.</td></tr>}</tbody>
 </table></div>;
}
const statuses=["NEW","CONTACTED","QUALIFIED","PROPOSAL","WON","LOST"];
export default function MarketingDepartmentPage({mode="performance",notify}){
 const {user}=useAuth(),readonly=user?.role==="department_incharge";
 const [data,setData]=useState(init),[forecast,setForecast]=useState(null),
  [busy,setBusy]=useState(false),[error,setError]=useState(""),[search,setSearch]=useState("");
 const [days,setDays]=useState(30),[leadDays,setLeadDays]=useState(14),[serviceLevel,setServiceLevel]=useState("95");
 const [companyName,setCompanyName]=useState(""),[contactName,setContactName]=useState(""),
  [phone,setPhone]=useState(""),[email,setEmail]=useState(""),[source,setSource]=useState("DIRECT"),
  [leadNotes,setLeadNotes]=useState("");
 const [leadId,setLeadId]=useState(""),[leadStatus,setLeadStatus]=useState("CONTACTED");
 const [sku,setSku]=useState(""),[quantity,setQuantity]=useState(""),[content,setContent]=useState(""),
  [nextDate,setNextDate]=useState(""),[orderReference,setOrderReference]=useState("");
 const [shop,setShop]=useState(""),[reason,setReason]=useState("");
 const [campaignName,setCampaignName]=useState(""),[channel,setChannel]=useState("DIGITAL"),
  [startDate,setStartDate]=useState(()=>new Date().toISOString().slice(0,10)),
  [endDate,setEndDate]=useState(()=>new Date().toISOString().slice(0,10)),
  [budget,setBudget]=useState(""),[campaignNotes,setCampaignNotes]=useState("");
 const [expenseDate,setExpenseDate]=useState(()=>new Date().toISOString().slice(0,10)),
  [expenseCategory,setExpenseCategory]=useState("DIGITAL_ADS"),[description,setDescription]=useState(""),
  [amount,setAmount]=useState(""),[expenseReference,setExpenseReference]=useState(""),
  [campaignId,setCampaignId]=useState("");
 const keys=useRef(Object.fromEntries(["lead","status","activity","campaign","expense","demand"]
  .map(x=>[x,crypto.randomUUID()])));
 const load=async()=>{try{setData(await getMarketingOverview());setError("")}
  catch(e){setError(e.message);notify?.(e.message)}};
 useEffect(()=>{load()},[]);
 const find=(...xs)=>xs.some(x=>String(x??"").toLowerCase().includes(search.trim().toLowerCase()));
 const filtered=useMemo(()=>({
  leads:(data.leads||[]).filter(x=>find(x.companyName,x.contactName,x.phone,x.status)),
  activities:(data.activities||[]).filter(x=>find(x.leadCompany,x.kind,x.content,x.orderReference,x.sku)),
  campaigns:(data.campaigns||[]).filter(x=>find(x.name,x.channel)),
  expenses:(data.expenses||[]).filter(x=>find(x.date,x.category,x.description)),
  demands:(data.demands||[]).filter(x=>find(x.number,x.shop,x.sku,x.status))
 }),[data,search]);
 const rowKinds={enquiry:"ENQUIRY",followup:"FOLLOWUP",order:"ORDER_FOLLOWUP",communication:"COMMUNICATION"};
 const isCRM=["enquiry","followup","order","communication"].includes(mode);
 const filteredActivities=isCRM?filtered.activities.filter(x=>x.kind===rowKinds[mode]):
  mode==="calendar"?filtered.activities.filter(x=>x.nextFollowupDate).sort((a,b)=>
   a.nextFollowupDate.localeCompare(b.nextFollowupDate)):filtered.activities;
 const csv=marketingExportRecords(mode,{...filtered,
  activities:filteredActivities,forecast:forecast?.rows||[],summary:data.summary||{}});
 async function run(e,type,fn,done){
  e.preventDefault();setBusy(true);setError("");
  try{
   const result=await fn(keys.current[type]);keys.current[type]=crypto.randomUUID();
   await load();done?.(result);notify?.("Marketing record saved");
  }catch(err){setError(err.message);notify?.(err.message)}finally{setBusy(false)}
 }
 async function runForecast(e){
  e?.preventDefault();setBusy(true);setError("");
  try{setForecast(await getMarketingForecast({days,leadDays,serviceLevel,method:"forecast"}))}
  catch(err){setError(err.message);notify?.(err.message)}finally{setBusy(false)}
 }
 const s=data.summary||{};
 return <section className="classic-page marketing-dept">
  <header className="classic-title"><div><small>MARKETING · {readonly?"HEAD / READ ONLY":"STAFF / MANAGEMENT"}</small>
   <h2>{names[mode]||"Marketing"}</h2>
   <p>Sales-linked forecasts + tenant-scoped CRM. Marketing records do not post accounting entries or send messages.</p>
  </div><div className="page-actions">
   <button type="button" onClick={load}><RefreshCw size={16}/> Refresh</button>
   <button type="button" disabled={!csv.length} onClick={()=>exportCsv("marketing-"+mode+".xls",csv)}>
    <Download size={16}/> Excel</button>
   <button type="button" onClick={()=>window.print()}><Printer size={16}/> Print</button>
  </div></header>
  {error&&<p className="error-text" role="alert">{error}</p>}
  <div className="marketing-counter-grid">
   {Object.entries({"Open Leads":n(s.openLeads),"Enquiries":n(s.enquiries),
    "Scheduled Followup Entries Due":n(s.followupsDue),
    "Active Campaigns":n(s.activeCampaigns),
    "Pending Replenishments":n(s.pendingReplenishments),
    "Recorded Marketing Spend":money(s.recordedMarketingExpensePaise)})
    .map(([label,val])=><div className="classic-card" key={label}>
     <small>{label}</small><h3>{val}</h3></div>)}
  </div>
  <div className="classic-card">
   <label>Search customer / company / enquiry / order / campaign
    <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search CRM records"/>
   </label>
   {["performance","reports"].includes(mode)?<Table
     headers={["Metric","Value"]} rows={[
      ["Leads",n(s.totalLeads)],["Open Leads",n(s.openLeads)],
      ["Recorded Enquiries",n(s.enquiries)],["Pending Demands",n(s.pendingReplenishments)],
      ["Posted Shop Invoices",n(s.invoiceCount)],
      ["Posted Invoice Gross (before refunds)",money(s.invoiceGrossSalesPaise)],
      ["Campaign Budget (not actual spend)",money(s.plannedCampaignBudgetPaise)],
      ["Recorded Marketing Spend (nonposting)",money(s.recordedMarketingExpensePaise)]
     ]}/>:null}
   {["pipeline","lead"].includes(mode)?<Table headers={["Company","Contact","Phone","Email","Source","Lead Status","Notes"]}
     rows={filtered.leads.map(x=>[x.companyName,x.contactName,x.phone,x.email,x.source,x.status,x.notes])}/>:null}
   {isCRM||["calendar","history"].includes(mode)?<Table
     headers={["Date","Company","Type","SKU","PCS","Order Ref","Note","Next Follow-up"]}
     rows={filteredActivities.map(x=>[x.createdAt?new Date(x.createdAt).toLocaleString("en-IN"):"",
      x.leadCompany,x.kind,x.sku,n(x.quantity),x.orderReference,x.content,x.nextFollowupDate])}/>:null}
   {mode==="expenses"?<Table headers={["Date","Category","Description","Reference","Amount INR"]}
     rows={filtered.expenses.map(x=>[x.date,x.category,x.description,x.reference,money(x.amountPaise)])}/>:null}
   {mode==="campaign"?<Table headers={["Name","Channel","Start","End","Planned Budget INR"]}
     rows={filtered.campaigns.map(x=>[x.name,x.channel,x.startDate,x.endDate,money(x.budgetPaise)])}/>:null}
   {mode==="demand"?<Table headers={["No.","Shop","SKU","PCS","Status","Reason"]}
     rows={filtered.demands.map(x=>[x.number,x.shop,x.sku,n(x.quantity),x.status,x.reason])}/>:null}
  </div>
  {["analysis","forecast"].includes(mode)&&<div className="classic-card">
   <h3>Sales Demand Forecast — Actual Shop Sales</h3>
   <form className="form-grid" onSubmit={runForecast}>
    <label>Sales history (days)<input type="number" min="7" max="365" step="1"
     value={days} onChange={e=>setDays(Number(e.target.value))}/></label>
    <label>Supply lead days<input type="number" min="0" max="365" step="1"
     value={leadDays} onChange={e=>setLeadDays(Number(e.target.value))}/></label>
    <label>Planning Service Level<select value={serviceLevel} onChange={e=>setServiceLevel(e.target.value)}>
     <option value="90">90%</option><option value="95">95%</option><option value="99">99%</option>
    </select></label>
    <button type="submit" disabled={busy}>Calculate Forecast</button>
   </form>
   {forecast&&<><p>{forecast.note}</p><Table
    headers={["Shop","SKU","Net Sold PCS","On-Hand PCS","In Transit","Suggested PCS","Reliability"]}
    rows={(forecast.rows||[]).filter(x=>find(x.shop,x.sku)).map(x=>[
     x.shop,x.sku,n(x.sold),n(x.stock),n(x.inTransit),n(x.suggested),
     x.reliability||""])}/></>}
  </div>}
  {mode==="lead"&&!readonly&&<div className="classic-card marketing-entry-form">
   <h3>Register a Customer / Lead</h3>
   <form className="form-grid" onSubmit={e=>run(e,"lead",key=>createMarketingLead({
    key,companyName,contactName,phone,email,source,notes:leadNotes
   }),()=>{setCompanyName("");setContactName("");setPhone("");setEmail("");setLeadNotes("");})}>
    <label>Company<input required minLength={2} maxLength={120} value={companyName}
     onChange={e=>setCompanyName(e.target.value)}/></label>
    <label>Contact Person<input required minLength={2} maxLength={100} value={contactName}
     onChange={e=>setContactName(e.target.value)}/></label>
    <label>Phone<input maxLength={25} value={phone} onChange={e=>setPhone(e.target.value)}/></label>
    <label>Email<input type="email" maxLength={150} value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label>Lead Source<select value={source} onChange={e=>setSource(e.target.value)}>
     {["DIRECT","WEBSITE","REFERRAL","PHONE","EXHIBITION","OTHER"].map(x=>
      <option key={x} value={x}>{x}</option>)}
    </select></label>
    <label>Notes<input maxLength={500} value={leadNotes} onChange={e=>setLeadNotes(e.target.value)}/></label>
    <button type="submit" className="primary" disabled={busy}><Save size={16}/> Register Lead</button>
   </form>
  </div>}
  {mode==="followup"&&!readonly&&<div className="classic-card marketing-entry-form">
   <h3>Lead Pipeline Status</h3>
   <form className="form-grid" onSubmit={e=>run(e,"status",key=>
    updateMarketingLeadStatus(leadId,{status:leadStatus,key}))}>
    <label>Customer Lead<select required value={leadId} onChange={e=>setLeadId(e.target.value)}>
     <option value="">Choose lead</option>{data.leads.map(x=>
      <option value={x.id} key={x.id}>{x.companyName} · {x.status}</option>)}
    </select></label>
    <label>New Status<select value={leadStatus} onChange={e=>setLeadStatus(e.target.value)}>
     {statuses.map(x=><option key={x} value={x}>{x}</option>)}
    </select></label>
    <button type="submit" disabled={busy||!leadId} className="primary">Update Pipeline Status</button>
   </form>
  </div>}
  {isCRM&&!readonly&&<div className="classic-card marketing-entry-form">
   <h3>Record {names[mode]}</h3>
   <form className="form-grid" onSubmit={e=>run(e,"activity",key=>createMarketingActivity({
    key,leadId,kind:rowKinds[mode],sku,quantity:Number(quantity||0),
    content,nextFollowupDate:nextDate,orderReference
   }),()=>{setContent("");setQuantity("");setNextDate("");setOrderReference("");})}>
    <label>Customer<select value={leadId} required onChange={e=>setLeadId(e.target.value)}>
     <option value="">Choose registered lead</option>{data.leads.map(x=>
      <option key={x.id} value={x.id}>{x.companyName} · {x.contactName}</option>)}
    </select></label>
    {mode==="enquiry"&&<>
     <label>SKU<input required maxLength={80} value={sku} onChange={e=>setSku(e.target.value.toUpperCase())}/></label>
     <label>Quantity PCS<input required type="number" min="1" max="1000000" step="1"
      value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
    </>}
    {mode==="order"&&<label>Order Reference (manual)<input required maxLength={120}
     value={orderReference} onChange={e=>setOrderReference(e.target.value)}/></label>}
    <label>Activity Notes (8–500 chars)<input required minLength={8} maxLength={500}
     value={content} onChange={e=>setContent(e.target.value)}/></label>
    {mode!=="enquiry"&&<label>Next Follow-up (UTC)<input type="date"
     value={nextDate} onChange={e=>setNextDate(e.target.value)}/></label>}
    <button className="primary" disabled={busy||!leadId} type="submit"><Save size={16}/> Save Activity Log</button>
   </form>
   {mode==="communication"&&<p>Communication is an internal log only. No email, WhatsApp or SMS is sent.</p>}
   {mode==="order"&&<p>Order reference is a manual note, not proof of ERP order fulfillment.</p>}
  </div>}
  {mode==="campaign"&&!readonly&&<div className="classic-card marketing-entry-form">
   <h3>Create Campaign Plan</h3>
   <form className="form-grid" onSubmit={e=>run(e,"campaign",key=>createMarketingCampaign({
    key,name:campaignName,channel,startDate,endDate,budgetINR:budget,notes:campaignNotes
   }),()=>{setCampaignName("");setBudget("");setCampaignNotes("");})}>
    <label>Campaign Name<input required minLength={3} maxLength={120} value={campaignName}
     onChange={e=>setCampaignName(e.target.value)}/></label>
    <label>Channel<select value={channel} onChange={e=>setChannel(e.target.value)}>
     {["DIGITAL","EMAIL","EXHIBITION","FIELD","OTHER"].map(x=><option key={x}>{x}</option>)}
    </select></label>
    <label>Start<input required type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label>
    <label>End<input required type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label>
    <label>Planned Budget INR<input required type="number" step="0.01" min="0"
     value={budget} onChange={e=>setBudget(e.target.value)}/></label>
    <label>Notes<input maxLength={300} value={campaignNotes}
     onChange={e=>setCampaignNotes(e.target.value)}/></label>
    <button type="submit" disabled={busy} className="primary"><Save size={16}/> Save Campaign</button>
   </form>
  </div>}
  {mode==="expenses"&&!readonly&&<div className="classic-card marketing-entry-form">
   <h3>Record Marketing Expense — Non-Accounting</h3>
   <form className="form-grid" onSubmit={e=>run(e,"expense",key=>createMarketingExpense({
    key,date:expenseDate,category:expenseCategory,description,
    amountINR:amount,reference:expenseReference,campaignId
   }),()=>{setDescription("");setAmount("");setExpenseReference("");})}>
    <label>Expense Date (UTC)<input required type="date" value={expenseDate}
     onChange={e=>setExpenseDate(e.target.value)}/></label>
    <label>Category<select value={expenseCategory} onChange={e=>setExpenseCategory(e.target.value)}>
     {["DIGITAL_ADS","TRAVEL","EVENT","PRINT","OTHER"].map(x=><option key={x}>{x}</option>)}
    </select></label>
    <label>Description<input required minLength={4} maxLength={200} value={description}
     onChange={e=>setDescription(e.target.value)}/></label>
    <label>Amount INR<input required type="number" min="0.01" step="0.01" value={amount}
     onChange={e=>setAmount(e.target.value)}/></label>
    <label>Reference<input maxLength={100} value={expenseReference}
     onChange={e=>setExpenseReference(e.target.value)}/></label>
    <label>Campaign<select value={campaignId} onChange={e=>setCampaignId(e.target.value)}>
     <option value="">Unallocated</option>{data.campaigns.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
    </select></label>
    <button className="primary" disabled={busy} type="submit"><Save size={16}/> Record Cost Only</button>
   </form>
   <p>Does not create accounts payable, cash journal, invoice, or ERP expense posting.</p>
  </div>}
  {mode==="demand"&&!readonly&&<div className="classic-card marketing-entry-form">
   <h3>Reviewed Shop Replenishment Demand</h3>
   <form className="form-grid" onSubmit={e=>run(e,"demand",key=>createMarketingDemand({
    key,sku,shop,quantity:Number(quantity),reason
   }),()=>{setSku("");setQuantity("");setReason("");})}>
    <label>Finished SKU<input required value={sku} onChange={e=>setSku(e.target.value.toUpperCase())}/></label>
    <label>Shop Master Key<input required value={shop} onChange={e=>setShop(e.target.value)}/></label>
    <label>Demand PCS<input required type="number" min="1" max="1000000" step="1"
     value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
    <label>Reason<input required value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <button className="primary" disabled={busy} type="submit"><Save size={16}/> Send Demand for Review</button>
   </form>
   <p>A separate independent company Admin approves or rejects a replenishment request. Saving does not post inventory or a Work Order.</p>
  </div>}
  {mode==="calendar"&&<p>Follow-up calendar is a saved date list, not a scheduled notification service or meeting integration. Future overdue items are not independently verified.</p>}
  {mode==="history"&&<p>History covers saved CRM activity logs. Request audit for pipeline-status updates is also retained by the existing ERP event mechanism.</p>}
  <small>Marketing data is planning/CRM context. All stock, invoice and payment postings must occur through their dedicated authorized ERP departments.</small>
 </section>;
}
