import { ACCOUNTS } from "./policy.js";
export function financialReport(entries, balances, documents, from, to) {
  const accounts = Object.entries(ACCOUNTS).map(([code, account]) => {
    const rows = entries.filter(e => e.account === code && new Date(e.date) <= to);
    return { code, ...account, debit: rows.reduce((s, e) => s + e.debit, 0), credit: rows.reduce((s, e) => s + e.credit, 0),
      periodDebit: rows.filter(e => new Date(e.date) >= from).reduce((s, e) => s + e.debit, 0),
      periodCredit: rows.filter(e => new Date(e.date) >= from).reduce((s, e) => s + e.credit, 0) };
  }).map(a => ({ ...a, balance: a.debit - a.credit }));
  const sum = (group, period = false) => accounts.filter(a => a.group === group)
    .reduce((s, a) => s + (period ? a.periodDebit - a.periodCredit : a.balance), 0);
  const parties = [...new Set(entries.filter(e => ["AR", "AP"].includes(e.account)).map(e => e.party))].map(party => ({ party,
    receivable: entries.filter(e => e.party === party && e.account === "AR" && new Date(e.date) <= to).reduce((s, e) => s + e.debit - e.credit, 0),
    payable: entries.filter(e => e.party === party && e.account === "AP" && new Date(e.date) <= to).reduce((s, e) => s + e.credit - e.debit, 0) }));
  const profit = -sum("REVENUE", true) - sum("EXPENSE", true);
  const retainedEarnings = -sum("REVENUE") - sum("EXPENSE");
  const assets = sum("ASSET"), liabilities = -sum("LIABILITY"), equity = -sum("EQUITY");
  const stockValue = balances.filter(b => !b.location.startsWith("WIP")).reduce((s, b) => s + b.value, 0);
  const wipStockValue = balances.filter(b => b.location.startsWith("WIP")).reduce((s, b) => s + b.value, 0);
  const workCostValue = documents.filter(d => d.type === "WORK_COST" && !d.reversedBy).reduce((s, d) => s + d.totals.gross, 0) - documents.filter(d => d.type === "PRODUCTION_RECEIPT" && !d.reversedBy).reduce((s, d) => s + Number(d.metadata.workCostAllocated || 0), 0);
  return { accounts, parties, profitAndLoss: { revenue: -sum("REVENUE", true), expenses: sum("EXPENSE", true), profit },
    balanceSheet: { assets, liabilities, equity, retainedEarnings, difference: assets - liabilities - equity - retainedEarnings },
    trialDifference: accounts.reduce((s, a) => s + a.balance, 0),
    currentReconciliation: { inventoryValue: stockValue, inventoryLedger: accounts.find(a => a.code === "INVENTORY").balance,
      wipValue: wipStockValue + workCostValue, wipLedger: accounts.find(a => a.code === "WIP").balance,
      note: "Current balance comparison is valid only when reporting through the latest posting date" } };
}
