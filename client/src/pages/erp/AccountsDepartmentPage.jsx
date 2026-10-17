import {useEffect,useMemo,useRef,useState} from "react";
import {Download,Printer,RefreshCw,Save} from "lucide-react";
import {useAuth} from "../../context/AuthContext.jsx";
import {exportCsv} from "../../api.js";
import {getAccountsOverview,postAccountsDocument} from "../../api/accountsDepartmentApi.js";
import {accountsExportRecords} from "../../config/accountsExport.mjs";
import BankReconciliation from "./BankReconciliation.jsx";
import "./AccountsDepartmentPage.css";

const labels={overview:"Financial Overview",receivable:"Receivables & Payables",
 purchase:"Purchase / Expense Monitoring",cash:"Cash / Bank Position",
 margin:"Cost & Margin Review",due:"Payment Due Alerts",reports:"Financial Reports",
 parties:"Customer / Supplier Ledger",invoice:"Purchase Invoice Entry",
 invoices:"Sales Invoice Review",voucher:"Expense / Voucher Entry",
 payment:"Payment / Receipt Entry",bankEntry:"Cash / Bank Entry",
 bank:"Bank Reconciliation",payroll:"Payroll Accounting",
 tax:"Tax / Ledger Reports",history:"Transaction History"};
const base={summary:{},finance:{accounts:[],parties:[],profitAndLoss:{}},
 ageing:[],paymentsDue:[],journal:[],documents:[],spend:[],bank:[],parties:[],salesOrders:[]};
const amount=p=>"₹"+(Number(p||0)/100).toLocaleString("en-IN",
 {minimumFractionDigits:2,maximumFractionDigits:2});
const n=x=>Number(x||0).toLocaleString("en-IN");
function Table({header,rows}){
 return <div className="accounts-scroll"><table className="classic-table" style={{minWidth:820,width:"100%"}}>
  <thead><tr>{header.map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>
  {rows.length?rows.map((r,i)=><tr key={i}>{r.map((x,j)=><td key={j}>{x??"—"}</td>)}</tr>):
   <tr><td colSpan={header.length}>No matching Accounts records.</td></tr>}</tbody>
 </table></div>;
}
const active=d=>!d.clearedAt;
export default function AccountsDepartmentPage({mode="overview",notify}){
 const {user}=useAuth();
 const head=user?.role==="department_incharge";
 const owner=user?.role==="company_owner";
 const permissions=user?.permissions||[];
 const staffWrite=!head&&(owner||permissions.includes("department.accounts.write"));
 const canAccountPost=staffWrite&&(owner||permissions.includes("erp.accounts"));
 const canPurchase=staffWrite&&(owner||permissions.includes("erp.purchase"));
 const canBankReconcile=owner||permissions.includes("erp.reconcile");
 const [data,setData]=useState(base),[error,setError]=useState(""),[busy,setBusy]=useState(false),
  [days,setDays]=useState(30),[search,setSearch]=useState("");
 const [type,setType]=useState("RECEIPT"),[sourceId,setSourceId]=useState(""),
  [value,setValue]=useState(""),[cashAccount,setCashAccount]=useState("BANK"),
  [party,setParty]=useState(""),[narration,setNarration]=useState(""),
  [taxPercent,setTaxPercent]=useState("0"),[voucherAccount,setVoucherAccount]=useState("OPERATING_EXPENSE");
 const retry=useRef(crypto.randomUUID());
 const load=async()=>{try{setData(await getAccountsOverview(days));setError("")}
  catch(e){setError(e.message);notify?.(e.message)}};
 useEffect(()=>{load()},[days]);
 const match=(...x)=>x.some(v=>String(v??"").toLowerCase().includes(search.trim().toLowerCase()));
 const filtered=useMemo(()=>({
  documents:(data.documents||[]).filter(x=>match(x.number,x.type,x.partyCode,x.sourceId)),
  journal:(data.journal||[]).filter(x=>match(x.documentNo,x.account,x.party)),
  ageing:(data.ageing||[]).filter(x=>match(x.number,x.party,x.partyName,x.kind)),
  due:(data.paymentsDue||[]).filter(x=>match(x.number,x.party,x.partyName,x.kind)),
  parties:(data.parties||[]).filter(x=>match(x.code,x.name,x.kind)),
  bank:(data.bank||[]).filter(x=>match(x.reference,x.documentId,x.date)),
  spend:(data.spend||[]).filter(x=>match(x.number,x.type,x.party)),
  salesOrders:(data.salesOrders||[]).filter(x=>match(x.number,x.party))
 }),[data,search]);
 const docs=filtered.documents;
 const purchaseSources=(data.documents||[]).filter(d=>d.type==="GOODS_RECEIPT"),
  settleSources=(data.documents||[]).filter(d=>type==="RECEIPT"?d.type==="SALES_INVOICE":d.type==="PURCHASE_INVOICE")
   .filter(d=>data.ageing?.some(x=>x.number===d.number&&x.outstanding>0));
 const selectedDoc=(data.documents||[]).find(d=>d.id===sourceId);
 const visible=accountsExportRecords(mode==="bankEntry"?"cash":mode,{...data,
  ...filtered,paymentsDue:filtered.due});
 const summary=data.summary||{},finance=data.finance||{};
 async function submit(e){
  e.preventDefault();setBusy(true);setError("");
  try{
   let doc;
   if(mode==="invoice"){
    if(!selectedDoc||selectedDoc.type!=="GOODS_RECEIPT")throw new Error("Choose posted Goods Receipt");
    const goods=selectedDoc.lines||[];
    if(!goods.length)throw new Error("Goods Receipt lines missing");
    doc={type:"PURCHASE_INVOICE",sourceId:selectedDoc.id,partyCode:selectedDoc.partyCode,
     date:new Date().toISOString().slice(0,10),notes:narration,
     lines:goods.map(l=>({sku:l.sku,quantity:l.quantity/1000,rate:(l.rate||0)/100,
      taxPercent:Number(taxPercent),location:"FABRIC"}))};
   }else if(mode==="payment"){
    if(!selectedDoc||!["SALES_INVOICE","PURCHASE_INVOICE"].includes(selectedDoc.type))
     throw new Error("Choose posted supplier/customer invoice");
    doc={type,sourceId:selectedDoc.id,partyCode:selectedDoc.partyCode,
     amount:value,cashAccount,notes:narration};
   }else if(mode==="voucher"||mode==="bankEntry"){
    if(!narration.trim())throw new Error("Voucher narration required");
    const debit=mode==="voucher"?"OPERATING_EXPENSE":voucherAccount;
    const credit=cashAccount;
    if(debit===credit)throw new Error("Debit and credit account must differ");
    doc={type:"JOURNAL",notes:narration,
     journalLines:[{account:debit,debit:value,credit:"0",party:debit==="AR"||debit==="AP"?party:""},
      {account:credit,debit:"0",credit:value,party:credit==="AR"||credit==="AP"?party:""}]};
   }else throw new Error("Unsupported Accounts input");
   const posted=await postAccountsDocument(doc,retry.current);
   retry.current=crypto.randomUUID();setSourceId("");setValue("");setNarration("");
   notify?.("ERP financial document posted: "+posted.number);await load();
  }catch(e){setError(e.message);notify?.(e.message)}finally{setBusy(false)}
 }
 const showEntry=["invoice","payment","voucher","bankEntry"].includes(mode),
  writable=mode==="invoice"?canPurchase:canAccountPost;
 const currencies=["CASH","BANK"];
 const reportBalance=finance.accounts||[];
 return <section className="classic-page accounts-dept">
  <header className="classic-title"><div>
   <small>ACCOUNTS · {head?"HEAD / READ ONLY":"FINANCE CONTROLLED"}</small>
   <h2>{labels[mode]||"Accounts"}</h2>
   <p>Real posted journal/ERP document data. All postings retain independent approval and finance authorization.</p>
  </div><div className="page-actions">
   <button type="button" onClick={load}><RefreshCw size={16}/> Refresh</button>
   <button type="button" disabled={!visible.length} onClick={()=>exportCsv("accounts-"+mode+".xls",visible)}>
    <Download size={16}/> Excel</button>
   <button type="button" onClick={()=>window.print()}><Printer size={16}/> Print</button>
  </div></header>
  {error&&<p className="error-text" role="alert">{error}</p>}
  <div className="accounts-metrics">
   {Object.entries({"Receivables":amount(summary.receivables),
    "Payables":amount(summary.payables),"Cash (GL)":amount(summary.cash),
    "Bank (GL)":amount(summary.bank),"Period Profit":amount(summary.profit),
    "Overdue Invoices":n(summary.overdueInvoiceCount)}).map(([k,v])=>
    <div className="classic-card" key={k}><small>{k}</small><h3>{v}</h3></div>)}
  </div>
  <div className="classic-card">
   <div className="accounts-filters">
    <label>Report Period (days)<input type="number" step="1" min="1" max="366"
     value={days} onChange={e=>setDays(e.target.value)}/></label>
    <label>Search document / party / account<input value={search}
     onChange={e=>setSearch(e.target.value)} placeholder="Invoice, party, account code"/></label>
   </div>
   {["overview","reports"].includes(mode)?<>
    <Table header={["Account","Group","Debit","Credit","Balance"]}
     rows={reportBalance.map(a=>[a.code,a.group,amount(a.debit),amount(a.credit),amount(a.balance)])}/>
    <p>Trial balance difference: {amount(summary.trialDifference)} · Assets: {amount(finance.balanceSheet?.assets)}</p>
   </>:null}
   {["receivable","due"].includes(mode)?<Table
    header={["Invoice","Party","Kind","Gross","Outstanding","Due Date","Overdue Days"]}
    rows={(mode==="due"?filtered.due:filtered.ageing).map(a=>[
     a.number,a.partyName,a.kind,amount(a.gross),amount(a.outstanding),
     a.dueDate?new Date(a.dueDate).toLocaleDateString("en-IN"):"",
     a.isOverdue?a.overdueDays:0])}/>:null}
   {["purchase","expense"].includes(mode)?<Table
    header={["ERP Document","Type","Party","Date","Gross"]}
    rows={filtered.spend.map(x=>[x.number,x.type,x.party,
     x.date?new Date(x.date).toLocaleDateString("en-IN"):"",amount(x.gross)])}/>:null}
   {["cash","bankEntry","bank"].includes(mode)?<Table
    header={["Date","Bank Reference","Signed Amount","Reconciliation","Document"]}
    rows={filtered.bank.map(x=>[x.date,x.reference,amount(x.amount),x.matched?"MATCHED":"UNMATCHED",x.documentId])}/>:null}
   {mode==="margin"?<Table
    header={["Sales Order","Party","Net Sales","Dispatched COGS","Indicative Margin"]}
    rows={filtered.salesOrders.map(x=>[x.number,x.party,amount(x.sales),amount(x.cogs),
     amount(x.grossMargin)])}/>:null}
   {mode==="parties"?<>
    <Table header={["Code","Name","Party Type","Payment Terms Days"]}
     rows={filtered.parties.map(x=>[x.code,x.name,x.kind,x.paymentTermDays])}/>
    <Table header={["Party","Receivable GL","Payable GL"]}
     rows={(finance.parties||[]).filter(x=>match(x.party)).map(x=>[
      x.party,amount(x.receivable),amount(x.payable)])}/>
   </>:null}
   {["invoice","invoices","payment","payroll"].includes(mode)?<Table
    header={["Date","Document","Type","Party","Amount","Source"]}
    rows={docs.filter(d=>mode==="invoices"?d.type==="SALES_INVOICE":
     mode==="payroll"?d.type.startsWith("PAYROLL"):mode==="invoice"?d.type==="PURCHASE_INVOICE":
     ["RECEIPT","PAYMENT"].includes(d.type)).map(d=>[
      d.date?new Date(d.date).toLocaleDateString("en-IN"):"",d.number,
      d.type,d.partyCode,amount(d.gross),d.sourceId])}/>:null}
   {mode==="tax"?<Table header={["Date","Document","Account","Debit","Credit"]}
    rows={filtered.journal.filter(x=>["INPUT_TAX","OUTPUT_TAX"].includes(x.account))
     .map(x=>[x.date?new Date(x.date).toLocaleDateString("en-IN"):"",
      x.documentNo,x.account,amount(x.debit),amount(x.credit)])}/>:null}
   {mode==="history"?<Table header={["Date","Document","Type","Party","Amount","Linked Source"]}
    rows={docs.map(d=>[d.date?new Date(d.date).toLocaleDateString("en-IN"):"",
     d.number,d.type,d.partyCode,amount(d.gross),d.sourceId])}/>:null}
   {mode==="voucher"?<Table header={["Date","Journal Document","Account","Debit","Credit","Party"]}
    rows={filtered.journal.filter(x=>["OPERATING_EXPENSE","CASH","BANK","AP"].includes(x.account))
     .map(x=>[x.date?new Date(x.date).toLocaleDateString("en-IN"):"",
      x.documentNo,x.account,amount(x.debit),amount(x.credit),x.party])}/>:null}
  </div>
  {showEntry&&writable&&<div className="classic-card accounts-entry-form">
   <h3>{labels[mode]} — Authorized ERP Posting</h3>
   <p>Entries are posted only through the existing ERP service. If an independent approval is required, create/approve it in the ERP approval workflow before posting.</p>
   <form className="form-grid accounts-form" onSubmit={submit}>
    {["invoice","payment"].includes(mode)&&<label>Source Posted ERP Invoice / Receipt
     <select required value={sourceId} onChange={e=>setSourceId(e.target.value)}>
      <option value="">Select source</option>
      {(mode==="invoice"?purchaseSources:settleSources).map(d=>
       <option key={d.id} value={d.id}>{d.number} · {d.partyCode} · {amount(d.gross)}</option>)}
     </select></label>}
    {mode==="payment"&&<label>Payment Type<select value={type} onChange={e=>{setType(e.target.value);setSourceId("");}}>
     <option value="RECEIPT">Customer Receipt</option><option value="PAYMENT">Supplier Payment</option>
    </select></label>}
    {mode==="invoice"&&<label>Tax Percentage
     <input type="number" min="0" max="100" step="0.01" value={taxPercent}
      onChange={e=>setTaxPercent(e.target.value)}/></label>}
    {mode!=="invoice"&&<label>Amount INR<input required type="number" step="0.01" min="0.01"
     value={value} onChange={e=>setValue(e.target.value)}/></label>}
    {mode!=="invoice"&&<label>Cash / Bank<select value={cashAccount} onChange={e=>setCashAccount(e.target.value)}>
     {currencies.map(x=><option key={x}>{x}</option>)}
    </select></label>}
    {mode==="bankEntry"&&<label>Debit Account<select value={voucherAccount}
     onChange={e=>setVoucherAccount(e.target.value)}>
     {["OPERATING_EXPENSE","CASH","BANK"].map(x=><option key={x}>{x}</option>)}
    </select></label>}
    {mode==="voucher"&&<p>This voucher debits OPERATING_EXPENSE and credits the selected CASH/BANK ledger. It does not create an AP invoice or supplier payment.</p>}
    <label>Reviewed Narration<input maxLength={120} required value={narration}
     onChange={e=>setNarration(e.target.value)}/></label>
    <button className="primary" type="submit" disabled={busy||(["invoice","payment"].includes(mode)&&!sourceId)}>
     <Save size={16}/> Post to ERP Ledger</button>
   </form>
  </div>}
  {showEntry&&!writable&&<p>Posting requires Accounts Staff write plus the separate ERP posting grant (erp.accounts or erp.purchase). Read-only users cannot create entries.</p>}
  {mode==="bank"&&<div className="classic-card"><BankReconciliation notify={notify}/></div>}
  {mode==="payroll"&&<p>Payroll accounting here lists posted PAYROLL_ACCRUAL/REVERSAL GL references only. Salary details, PF/ESI rules, individual payslip approvals and payments remain in the separate HR Workforce flow with HR-specific permission.</p>}
  {mode==="tax"&&<p>INPUT_TAX and OUTPUT_TAX are posted accounting balances only; GST return filing, TDS and e-invoicing are NOT provided by this report.</p>}
  {mode==="due"&&<p>Due dates use posted invoice metadata or a 30-day fallback; verify customer/supplier contract terms before sending a payment reminder. No emails/alerts are sent automatically.</p>}
  {mode==="margin"&&<p>Indicative gross margin is invoice net sales minus dispatched COGS. No complete overhead allocation or period-close validation is implied.</p>}
  <small className="accounts-print-note">Finance totals are only as complete as the posted ERP GL. Statement imports do not change the cash/bank GL until reconciled to a posted movement. This feature is not a statutory tax filing system.</small>
 </section>;
}
