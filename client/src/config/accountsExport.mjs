const rupees=x=>Number((Number(x||0)/100).toFixed(2));
export function accountsExportRecords(mode,data={}){
 const {documents=[],ageing=[],paymentsDue=[],journal=[],spend=[],
  parties=[],bank=[],finance={},summary={},salesOrders=[]}=data;
 if(["receivable","due"].includes(mode))return (mode==="due"?paymentsDue:ageing).map(x=>({
  Invoice:x.number,Party:x.party,PartyName:x.partyName,Kind:x.kind,
  "Invoice INR":rupees(x.gross),"Unpaid INR":rupees(x.outstanding),
  "Due Date":x.dueDate,"Days Overdue":x.overdueDays
 }));
 if(["ledger","tax","history"].includes(mode))return journal.filter(x=>mode!=="tax"||["INPUT_TAX","OUTPUT_TAX"].includes(x.account))
  .map(x=>({Date:x.date,Document:x.documentNo,Account:x.account,Party:x.party,
   "Debit INR":rupees(x.debit),"Credit INR":rupees(x.credit)}));
 if(["purchase","expense"].includes(mode))return spend.map(x=>({
  Date:x.date,Document:x.number,Type:x.type,Party:x.party,"Gross INR":rupees(x.gross)
 }));
 if(["bank","cash"].includes(mode))return bank.map(x=>({
  Date:x.date,Reference:x.reference,"Signed INR":rupees(x.amount),
  Matched:x.matched?"YES":"NO",Document:x.documentId
 }));
 if(mode==="margin")return salesOrders.map(x=>({
  SalesOrder:x.number,Party:x.party,"Net Sales INR":rupees(x.sales),
  "Dispatched COGS INR":rupees(x.cogs),"Indicative Margin INR":rupees(x.grossMargin)
 }));
 if(["invoices","invoice","payment","voucher","payroll"].includes(mode))return documents
  .filter(x=>mode!=="invoices"||x.type==="SALES_INVOICE")
  .filter(x=>mode!=="payroll"||x.type.startsWith("PAYROLL"))
  .map(x=>({Date:x.date,Number:x.number,Type:x.type,Party:x.partyCode,
   "Gross INR":rupees(x.gross),Source:x.sourceId,"ERP Document":x.id}));
 if(mode==="parties")return parties.map(x=>({Code:x.code,Name:x.name,
  Type:x.kind,PaymentTermDays:x.paymentTermDays}));
 const accounts=finance.accounts||[];
 return accounts.map(x=>({Account:x.code,Name:x.name,Group:x.group,
  "Debit INR":rupees(x.debit),"Credit INR":rupees(x.credit),
  "Balance INR":rupees(x.balance)}));
}
