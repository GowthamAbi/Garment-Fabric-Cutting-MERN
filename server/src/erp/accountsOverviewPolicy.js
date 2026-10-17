import {financialReport} from "./reports.js";
import {commercialReport} from "./commercialPolicy.js";
// Derive Accounts from the same immutable ERP documents and journals.
// This module neither posts money nor maintains a secondary balance table.
const p=x=>Number.isSafeInteger(x)?x:0;
export function accountsOverview(entries=[],balances=[],documents=[],parties=[],bankRows=[],now=new Date(),days=30){
 if(!Number.isInteger(days)||days<1||days>366)throw new Error("Reporting period must be 1–366 days");
 const utc=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());
 const from=new Date(utc-(days-1)*86400000);
 const finance=financialReport(entries,balances,documents,from,now);
 const commercial=commercialReport(documents,now);
 const partyMap=new Map(parties.map(p=>[p.code,p]));
 const ageing=commercial.ageing.map(r=>({
  ...r,partyName:partyMap.get(r.party)?.name||r.party,
  dueDateBasis:"INVOICE_OR_30_DAY_FALLBACK",
  isOverdue:r.outstanding>0&&new Date(r.dueDate)<now
 }));
 const paymentsDue=ageing.filter(r=>r.isOverdue);
 const posted=documents.filter(d=>!d.reversedBy&&!d.cancelledAt&&!d.archivedAt);
 const journal=entries.filter(e=>e.kind==="JOURNAL").slice().sort((a,b)=>new Date(b.date)-new Date(a.date))
  .map(e=>({id:String(e._id),date:e.date,documentNo:e.documentNo,account:e.account,
   party:e.party||"",debit:p(e.debit),credit:p(e.credit)}));
 const docs=posted.slice().sort((a,b)=>new Date(b.date)-new Date(a.date))
  .map(d=>({id:String(d._id),number:d.number,type:d.type,date:d.date,partyCode:d.partyCode||"",
   gross:p(d.totals?.gross),net:p(d.totals?.net),tax:p(d.totals?.tax),
   sourceId:d.sourceId||"",clearedAt:d.clearedAt||null,
   lines:(d.lines||[]).map(x=>({sku:x.sku,quantity:x.qty,rate:x.rate,net:x.net,tax:x.tax}))}));
 const bank=bankRows.map(r=>({id:String(r._id),date:r.date,reference:r.reference,
  amount:p(r.amount),documentId:r.documentId||"",matched:Boolean(r.documentId)}));
 const balance=code=>p(finance.accounts.find(a=>a.code===code)?.balance);
 const summary={receivables:balance("AR"),payables:-balance("AP")||0,
  cash:balance("CASH"),bank:balance("BANK"),
  revenue:p(finance.profitAndLoss.revenue),expenses:p(finance.profitAndLoss.expenses),
  profit:p(finance.profitAndLoss.profit),trialDifference:p(finance.trialDifference),
  overdueInvoiceCount:paymentsDue.length,
  overdueAmount:paymentsDue.reduce((n,x)=>n+p(x.outstanding),0),
  pendingBankMatches:bank.filter(x=>!x.matched).length,
  purchaseExpenseDocuments:posted.filter(x=>
   ["PURCHASE_INVOICE","WORK_COST","PAYROLL_ACCRUAL"].includes(x.type)).length};
 return {summary,finance,ageing,paymentsDue,
  salesOrders:commercial.salesOrders||[],workOrders:commercial.workOrders||[],
  spend:posted.filter(x=>["PURCHASE_INVOICE","WORK_COST","PAYROLL_ACCRUAL"].includes(x.type))
   .map(x=>({number:x.number,type:x.type,date:x.date,party:x.partyCode||"",
    gross:p(x.totals?.gross)})),
  journal,documents:docs,bank,
  parties:parties.map(x=>({code:x.code,name:x.name,kind:x.kind,
   paymentTermDays:x.paymentTermDays??30,creditLimit:x.creditLimit??null})),
  from:from.toISOString(),to:now.toISOString(),days,
  notes:{due:"Invoice due date or 30-day fallback; check agreed payment terms",
   cash:"Cash/Bank figures are journal balances, not a statement import",
   tax:"Statutory GST filing/e-invoicing and tax reconciliation not implemented",
   payroll:"HR payslips require separate HR permission; this report uses only posted GL",
   source:"Posted ERP journals, no separate Accounts ledger"}};
}
