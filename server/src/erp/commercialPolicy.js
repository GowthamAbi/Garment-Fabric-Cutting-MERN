import { safeInteger } from "./policy.js";
export function exposure(plan) { return safeInteger(Math.max(plan.totals.gross,plan.journals.reduce((s,l)=>s+l.debit,0),plan.moves.filter(m=>m.value<0).reduce((s,m)=>s-m.value,0))); }
export function needsApproval(settings,plan) { return settings.approvalThreshold!==null&&settings.approvalThreshold!==undefined&&(settings.approvalTypes||[]).includes(plan.type)&&exposure(plan)>=settings.approvalThreshold; }
export function commercialReport(documents,asOf=new Date()) {
  const active=documents.filter(d=>!d.reversedBy&&d.type!=="REVERSAL"&&new Date(d.date)<=asOf), byId=new Map(documents.map(d=>[String(d._id||d.id),d]));
  const rows=active.filter(d=>["SALES_INVOICE","PURCHASE_INVOICE"].includes(d.type)).map(invoice=>{
    const invoiceId=String(invoice._id||invoice.id),sales=invoice.type==="SALES_INVOICE",account=sales?"AR":"AP";
    const related=active.filter(d=>d.sourceId===invoiceId||(d.type==="SALES_RETURN"&&byId.get(d.sourceId)?.sourceId===invoiceId));
    const adjusted=related.reduce((s,d)=>s+(d.journals||[]).filter(l=>l.account===account).reduce((a,l)=>a+(sales?l.credit-l.debit:l.debit-l.credit),0),0);
    const outstanding=Math.max(0,invoice.totals.gross-adjusted),due=new Date(invoice.metadata?.dueDate||new Date(new Date(invoice.date).getTime()+30*86400000));
    const overdue=Math.max(0,Math.floor((asOf-due)/86400000));
    return { number:invoice.number,party:invoice.partyCode,kind:sales?"RECEIVABLE":"PAYABLE",gross:invoice.totals.gross,outstanding,dueDate:due.toISOString(),overdueDays:overdue,bucket:overdue===0?"CURRENT":overdue<=30?"1–30":overdue<=60?"31–60":overdue<=90?"61–90":"90+" };
  });
  const workOrders=active.filter(d=>d.type==="WORK_ORDER").map(wo=>{
    const children=active.filter(d=>d.sourceId===String(wo._id||wo.id));
    const materials=children.filter(d=>["MATERIAL_ISSUE","MATERIAL_RETURN"].includes(d.type)).flatMap(d=>d.moves).filter(m=>m.location.startsWith("WIP:")).reduce((s,m)=>s+m.value,0);
    const workCosts=children.filter(d=>d.type==="WORK_COST").reduce((s,d)=>s+d.totals.gross,0),receipts=children.filter(d=>d.type==="PRODUCTION_RECEIPT");
    const completed=receipts.reduce((s,d)=>s+d.lines[0].qty,0),allocated=receipts.reduce((s,d)=>s+(d.metadata?.cost||0),0);
    return { number:wo.number,sku:wo.lines[0].sku,planned:wo.lines[0].qty,completed,materials,workCosts,total:materials+workCosts,allocated,remainingWipCost:materials+workCosts-allocated,averageUnitCost:completed?Math.round(allocated*1000/completed):0 };
  });
  const jobwork=active.filter(d=>d.type==="JOBWORK_SEND").flatMap(send=>send.lines.map(l=>{
    const returned=active.filter(d=>d.type==="JOBWORK_RECEIPT"&&d.sourceId===String(send._id||send.id)).flatMap(d=>d.lines).filter(x=>x.sku===l.sku).reduce((s,x)=>s+x.qty,0);
    return { number:send.number,vendor:send.partyCode,sku:l.sku,unit:l.unit,sent:l.qty,returned,pending:l.qty-returned };
  }));
  const salesOrders=active.filter(d=>d.type==="SALES_ORDER").map(order=>{
    const invoices=active.filter(d=>d.type==="SALES_INVOICE"&&d.sourceId===String(order._id||order.id)),ids=new Set(invoices.map(d=>String(d._id||d.id)));
    const dispatches=active.filter(d=>d.type==="DISPATCH"&&ids.has(d.sourceId)),dispatchIds=new Set(dispatches.map(d=>String(d._id||d.id)));
    const returns=active.filter(d=>d.type==="SALES_RETURN"&&dispatchIds.has(d.sourceId));
    const sales=invoices.reduce((s,d)=>s+(d.totals.net||0),0)-returns.reduce((s,d)=>s+(d.totals.net||0),0);
    const cogs=[...dispatches,...returns].flatMap(d=>d.journals||[]).filter(l=>l.account==="COGS").reduce((s,l)=>s+l.debit-l.credit,0);
    return {number:order.number,party:order.partyCode,sales,cogs,grossMargin:sales-cogs,invoiceCount:invoices.length,dispatchCount:dispatches.length};
  });
  return {ageing:rows,workOrders,jobwork,salesOrders,note:"Invoice-linked settlements only; unallocated journals/advances remain in the party GL report. Work costs must be posted explicitly. Sales-order margin compares invoiced net sales with dispatched COGS, excluding overhead; pending dispatches can overstate that indicator. No statutory tax filing or bank feed is performed."};
}
