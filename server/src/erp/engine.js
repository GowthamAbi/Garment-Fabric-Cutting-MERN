import { ACCOUNTS, TYPES, LOCATIONS, quantity, money, stockKey, safeInteger, ratio, ceilingRatio, fail } from "./policy.js";

// Pure posting rules. Persistence applies this plan inside a database transaction.
export function planDocument(input, state) {
  const type = input.type;
  if (!TYPES.includes(type)) fail("Unknown ERP document type");
  const source = input.sourceId ? state.documents.find(d => String(d.id || d._id) === input.sourceId) : null;
  if (input.sourceId && (!source || source.status !== "POSTED" || source.reversedBy)) fail("Source document is unavailable or reversed");
  const lines = (input.lines || []).map(raw => {
    const sku = state.skus.find(s => s.code === raw.sku && s.active !== false);
    if (!sku) fail(`SKU not found: ${raw.sku}`);
    return { sku: sku.code, qty: quantity(raw.quantity), rate: money(raw.rate ?? 0), location: raw.location || sku.location,
      target: raw.target || "", unit: sku.unit, kind: sku.kind, taxBps: Math.round(Number(raw.taxPercent || 0) * 100) };
  });
  if (lines.length > 100) fail("At most 100 lines per document");
  if (new Set(lines.map(l => l.sku)).size !== lines.length) fail("Use one line per variant SKU; separate batch/colour/size have distinct SKUs");
  for (const l of lines) {
    if (!LOCATIONS.includes(l.location) || l.location === "WIP") fail("Select an ordinary location; WIP is managed by work orders");
    stockKey(l.sku, l.location);
    if (!Number.isInteger(l.taxBps) || l.taxBps < 0 || l.taxBps > 10000) fail("Invalid tax percentage");
  }
  const plan = { type, lines, moves: [], journals: [], totals: { net: 0, tax: 0, gross: 0 }, metadata: {} };
  const wipLocation = source ? `WIP:${String(source.id || source._id)}` : "WIP";
  const completions = source ? state.documents.filter(d => d.sourceId === String(source.id || source._id) && d.type === "PRODUCTION_RECEIPT" && !d.reversedBy) : [];
  const completedQty = completions.reduce((s, d) => s + d.lines[0].qty, 0);
  if (["MATERIAL_ISSUE", "MATERIAL_RETURN", "WORK_COST"].includes(type) && source && completedQty >= source.lines[0].qty)
    fail("Work order is completed; reverse completion before changing materials or costs");
  const current = new Map(state.balances.map(b => [b.key, { ...b }]));
  const journal = (account, debit, credit, party = input.partyCode || "") => {
    if (!ACCOUNTS[account] || !Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) || debit < 0 || credit < 0 || (debit && credit)) fail("Invalid journal line");
    if (debit || credit) plan.journals.push({ account, debit, credit, party });
  };
  const pair = (debit, credit, value) => { journal(debit, value, 0); journal(credit, 0, value); };
  const move = (line, location, delta, receiptValue = 0, exactIssueValue = null) => {
    const key = stockKey(line.sku, location);
    const before = current.get(key) || { key, sku: line.sku, location, qty: 0, value: 0 };
    let value = delta > 0 ? receiptValue : -(exactIssueValue ?? (Math.abs(delta) === before.qty ? before.value : ratio(before.value, Math.abs(delta), before.qty)));
    if (!Number.isFinite(value)) fail(`No stock available for ${key}`);
    const after = { ...before, qty: safeInteger(before.qty + delta), value: safeInteger(before.value + value) };
    if (after.qty === 0 && after.value !== 0) fail("Zero quantity cannot retain inventory value");
    current.set(key, after);
    plan.moves.push({ key, sku: line.sku, location, delta, value, qtyAfter: after.qty, valueAfter: after.value, unit: line.unit });
    return Math.abs(value);
  };
  const linked = (types) => { if (!source || !types.includes(source.type)) fail(`Link a posted ${types.join(" or ")}`); };
  const consumed = (sourceId, types, sku) => state.documents.filter(d => d.sourceId === String(sourceId) && types.includes(d.type) && d.status === "POSTED" && !d.reversedBy)
    .reduce((sum, d) => sum + (d.lines || []).filter(l => l.sku === sku).reduce((s, l) => s + l.qty, 0), 0);
  const cap = (types) => {
    for (const l of lines) {
      const original = source.lines.find(s => s.sku === l.sku);
      if (!original || consumed(source.id || source._id, types, l.sku) + l.qty > original.qty) fail(`Quantity exceeds remaining source quantity: ${l.sku}`);
    }
  };
  const priced = () => {
    for (const l of lines) { l.net = ratio(l.qty, l.rate, 1000); l.tax = ratio(l.net, l.taxBps, 10000); }
    plan.totals.net = safeInteger(lines.reduce((s, l) => s + l.net, 0));
    plan.totals.tax = safeInteger(lines.reduce((s, l) => s + l.tax, 0));
    plan.totals.gross = safeInteger(plan.totals.net + plan.totals.tax);
  };
  const party = (kind) => {
    const p = state.parties.find(p => p.code === input.partyCode && p.active !== false && (p.kind === kind || p.kind === "BOTH"));
    if (!p) fail(`Select an active ${kind.toLowerCase()}`);
    if (source?.partyCode && source.partyCode !== input.partyCode && type !== "WORK_COST") fail("Party differs from source document");
  };
  if (!["JOURNAL", "RECEIPT", "PAYMENT", "WORK_COST"].includes(type) && !lines.length) fail("Add at least one item line");
  switch (type) {
    case "QUOTATION": party("CUSTOMER"); priced(); break;
    case "PURCHASE_ORDER": party("SUPPLIER"); priced(); break;
    case "SALES_ORDER":
      party("CUSTOMER"); if (source) { linked(["QUOTATION"]); cap(["SALES_ORDER"]); } priced(); break;
    case "WORK_ORDER": {
      if (source) { linked(["SALES_ORDER"]); cap(["WORK_ORDER"]); }
      const bom = state.boms.find(b => b.code === input.bomCode && b.active !== false);
      if (!bom || lines.length !== 1 || lines[0].sku !== bom.outputSku) fail("Select a BOM matching one finished output SKU");
      plan.metadata.bom = structuredClone(bom); break;
    }
    case "OPENING":
      if (!state.openingAllowed) fail("Opening balances are locked after ERP activation");
      for (const l of lines) l.taxBps = 0;
      priced(); for (const l of lines) move(l, l.location, l.qty, l.net);
      pair("INVENTORY", "OPENING_EQUITY", plan.totals.net); break;
    case "GOODS_RECEIPT":
      party("SUPPLIER"); linked(["PURCHASE_ORDER"]); cap(["GOODS_RECEIPT"]);
      for (const l of lines) { const original = source.lines.find(s => s.sku === l.sku); l.rate = original.rate; l.taxBps = 0; }
      priced(); for (const l of lines) move(l, l.kind === "FINISHED" ? "QC" : l.location, l.qty, l.net);
      pair("INVENTORY", "GRNI", plan.totals.net); break;
    case "PURCHASE_INVOICE":
      party("SUPPLIER"); linked(["GOODS_RECEIPT"]); cap(["PURCHASE_INVOICE"]);
      for (const l of lines) l.rate = source.lines.find(s => s.sku === l.sku).rate;
      priced(); journal("GRNI", plan.totals.net, 0); journal("INPUT_TAX", plan.totals.tax, 0); journal("AP", 0, plan.totals.gross); break;
    case "PURCHASE_RETURN":
      party("SUPPLIER"); linked(["PURCHASE_INVOICE"]); cap(["PURCHASE_RETURN"]);
      for (const l of lines) { const original = source.lines.find(s => s.sku === l.sku); l.rate = original.rate; l.taxBps = original.taxBps; }
      priced(); {
        let cost = 0; for (const l of lines) cost += move(l, l.location, -l.qty);
        journal("AP", plan.totals.gross, 0); journal("INPUT_TAX", 0, plan.totals.tax); journal("INVENTORY", 0, cost);
        if (cost > plan.totals.net) journal("COGS", cost - plan.totals.net, 0);
        if (cost < plan.totals.net) journal("COGS", 0, plan.totals.net - cost);
      } break;
    case "SALES_INVOICE":
      party("CUSTOMER"); linked(["SALES_ORDER"]); cap(["SALES_INVOICE"]);
      for (const l of lines) { const original = source.lines.find(s => s.sku === l.sku); l.rate = original.rate; l.taxBps = original.taxBps; }
      priced(); journal("AR", plan.totals.gross, 0); journal("SALES", 0, plan.totals.net); journal("OUTPUT_TAX", 0, plan.totals.tax); break;
    case "DISPATCH":
      party("CUSTOMER"); linked(["SALES_INVOICE"]); cap(["DISPATCH"]);
      for (const l of lines) { if (l.kind === "FINISHED" && !["FINISHED", "DELIVERY"].includes(l.location)) fail("Finished goods must pass QC before dispatch"); pair("COGS", "INVENTORY", move(l, l.location, -l.qty)); }
      break;
    case "SALES_RETURN":
      party("CUSTOMER"); linked(["DISPATCH"]); cap(["SALES_RETURN"]);
      for (const l of lines) {
        const invoice = state.documents.find(d => String(d.id || d._id) === source.sourceId);
        if (!invoice || invoice.reversedBy) fail("Original sales invoice unavailable");
        const original = invoice.lines.find(s => s.sku === l.sku);
        l.rate = original.rate; l.taxBps = original.taxBps;
        const issued = source.moves.filter(m => m.sku === l.sku && m.delta < 0).reduce((s, m) => s - m.value, 0);
        const dispatched = source.lines.find(s => s.sku === l.sku).qty;
        const cost = ratio(issued, l.qty, dispatched);
        move(l, "QC", l.qty, cost); pair("INVENTORY", "COGS", cost);
      }
      priced(); journal("SALES", plan.totals.net, 0); journal("OUTPUT_TAX", plan.totals.tax, 0); journal("AR", 0, plan.totals.gross); break;
    case "STOCK_TRANSFER": case "JOBWORK_SEND": case "JOBWORK_RECEIPT":
      if (type === "JOBWORK_RECEIPT") { linked(["JOBWORK_SEND"]); cap(["JOBWORK_RECEIPT"]); }
      if (type === "JOBWORK_SEND") party("SUPPLIER");
      for (const l of lines) {
        const from = type === "JOBWORK_RECEIPT" ? "JOBWORK" : l.location;
        const to = type === "JOBWORK_SEND" ? "JOBWORK" : type === "JOBWORK_RECEIPT" ? "QC" : l.target;
        if (from === to || from.startsWith("WIP") || to.startsWith("WIP") || to === "FINISHED" || from === "QC" || from === "REJECTED" || (type === "STOCK_TRANSFER" && to === "QC")) fail("Use production/QC documents for controlled locations");
        if (type === "JOBWORK_RECEIPT" && source.partyCode !== input.partyCode) fail("Jobwork supplier mismatch");
        const value = move(l, from, -l.qty); move(l, to, l.qty, value);
      } break;
    case "MATERIAL_ISSUE": {
      linked(["WORK_ORDER"]);
      const bom = source.metadata.bom;
      for (const l of lines) {
        const component = bom.components.find(c => c.sku === l.sku);
        const issued = consumed(source.id || source._id, ["MATERIAL_ISSUE"], l.sku) - consumed(source.id || source._id, ["MATERIAL_RETURN"], l.sku);
        if (!component || issued + l.qty > ceilingRatio(component.qty, source.lines[0].qty, bom.outputQty)) fail("Material issue exceeds BOM requirement");
        if (["WIP", "QC", "REJECTED"].includes(l.location)) fail("Choose an approved material store");
        const cost = move(l, l.location, -l.qty); move(l, wipLocation, l.qty, cost); pair("WIP", "INVENTORY", cost);
      } break;
    }
    case "MATERIAL_RETURN":
      linked(["WORK_ORDER"]);
      for (const l of lines) {
        const netIssue = consumed(source.id || source._id, ["MATERIAL_ISSUE"], l.sku) - consumed(source.id || source._id, ["MATERIAL_RETURN"], l.sku);
        const used = completions.reduce((s, d) => s + d.moves.filter(m => m.sku === l.sku && m.location === wipLocation && m.delta < 0).reduce((n, m) => n - m.delta, 0), 0);
        if (l.qty > netIssue - used || l.location === "WIP" || ["FINISHED", "QC"].includes(l.location)) fail("Material return exceeds unconsumed work-order issue");
        const cost = move(l, wipLocation, -l.qty); move(l, l.location, l.qty, cost); pair("INVENTORY", "WIP", cost);
      } break;
    case "WORK_COST":
      linked(["WORK_ORDER"]); {
        const amount = money(input.amount); if (!amount) fail("Work cost must be positive");
        const account = input.cashAccount || "BANK"; if (!["BANK", "CASH", "AP"].includes(account)) fail("Invalid cost payment account");
        if (account === "AP") party("SUPPLIER");
        pair("WIP", account, amount); plan.totals.gross = amount;
      } break;
    case "PRODUCTION_RECEIPT": {
      linked(["WORK_ORDER"]); cap(["PRODUCTION_RECEIPT"]);
      if (lines.length !== 1) fail("Receive one work-order output SKU");
      const bom = source.metadata.bom; let totalCost = 0;
      for (const component of bom.components) {
        const totalRequired = ceilingRatio(component.qty, source.lines[0].qty, bom.outputQty);
        const alreadyConsumed = ceilingRatio(totalRequired, completedQty, source.lines[0].qty);
        const needed = ceilingRatio(totalRequired, completedQty + lines[0].qty, source.lines[0].qty) - alreadyConsumed;
        const netIssue = consumed(source.id || source._id, ["MATERIAL_ISSUE"], component.sku) - consumed(source.id || source._id, ["MATERIAL_RETURN"], component.sku);
        if (netIssue < alreadyConsumed + needed) fail("Issue all BOM components needed for this completion");
        const sku = state.skus.find(s => s.code === component.sku);
        if (needed) totalCost += move({ sku: component.sku, unit: sku.unit }, wipLocation, -needed);
      }
      const costs = state.documents.filter(d => d.sourceId === String(source.id || source._id) && d.type === "WORK_COST" && !d.reversedBy);
      const remainingCost = costs.reduce((s, d) => s + d.totals.gross, 0) - completions.reduce((s, d) => s + Number(d.metadata.workCostAllocated || 0), 0);
      const allocated = ratio(remainingCost, lines[0].qty, source.lines[0].qty - completedQty);
      totalCost += allocated;
      move(lines[0], "QC", lines[0].qty, totalCost); pair("INVENTORY", "WIP", totalCost);
      plan.metadata.cost = totalCost; plan.metadata.workCostAllocated = allocated; break;
    }
    case "QC_RELEASE": case "QC_REJECT":
      linked(["PRODUCTION_RECEIPT", "JOBWORK_RECEIPT", "SALES_RETURN", "GOODS_RECEIPT"]); cap(["QC_RELEASE", "QC_REJECT"]);
      if (!String(input.qcNotes || "").trim()) fail("QC findings are required");
      for (const l of lines) { const value = move(l, "QC", -l.qty); move(l, type === "QC_RELEASE" ? "FINISHED" : "REJECTED", l.qty, value); }
      plan.metadata.qcNotes = String(input.qcNotes).slice(0, 2000); break;
    case "WASTE":
      for (const l of lines) { if (l.location === "WIP") fail("WIP waste must be handled through a revised work order"); pair("WASTE_EXPENSE", "INVENTORY", move(l, l.location, -l.qty)); } break;
    case "RECEIPT": case "PAYMENT": {
      const receive = type === "RECEIPT"; party(receive ? "CUSTOMER" : "SUPPLIER"); linked([receive ? "SALES_INVOICE" : "PURCHASE_INVOICE"]);
      const amount = money(input.amount), account = input.cashAccount || "BANK";
      if (!amount || !["BANK", "CASH"].includes(account)) fail("Choose cash/bank and a positive amount");
      const settlements = state.documents.filter(d => d.sourceId === String(source.id || source._id) && d.type === type && !d.reversedBy).reduce((s, d) => s + d.totals.gross, 0);
      const returns = state.documents.filter(d => !d.reversedBy && (receive ? d.type === "SALES_RETURN" && state.documents.some(dispatch => String(dispatch.id || dispatch._id) === d.sourceId && dispatch.sourceId === String(source.id || source._id)) : d.type === "PURCHASE_RETURN" && d.sourceId === String(source.id || source._id))).reduce((s, d) => s + d.totals.gross, 0);
      if (settlements + returns + amount > source.totals.gross) fail("Amount exceeds invoice outstanding");
      pair(receive ? account : "AP", receive ? "AR" : account, amount); plan.totals.gross = amount; break;
    }
    case "JOURNAL":
      if (!String(input.notes || "").trim()) fail("Journal narration is required");
      if (!Array.isArray(input.journalLines) || input.journalLines.length > 100) fail("Use at most 100 journal lines");
      for (const line of input.journalLines || []) {
        if (["INVENTORY", "WIP", "GRNI"].includes(line.account)) fail("Inventory control accounts require stock/production documents");
        if (["AR", "AP"].includes(line.account) && !state.parties.some(p => p.code === line.party && p.active !== false)) fail("Receivable/payable line requires a party");
        journal(line.account, money(line.debit || 0), money(line.credit || 0), line.party || "");
      }
      if (plan.journals.length < 2) fail("Journal needs at least two nonzero lines"); break;
  }
  if (plan.journals.reduce((s, l) => s + l.debit - l.credit, 0) !== 0) fail("Journal is not balanced");
  return plan;
}

export function planReversal(original, state) {
  if (original.status !== "POSTED" || original.reversedBy) fail("Document already reversed");
  if (state.documents.some(d => d.sourceId === String(original.id || original._id) && !d.reversedBy && d.status === "POSTED")) fail("Reverse downstream documents first");
  if (original.type === "WORK_COST" && state.documents.some(d => d.sourceId === original.sourceId && d.type === "PRODUCTION_RECEIPT" && !d.reversedBy)) fail("Reverse production receipts before reversing allocated work costs");
  if (original.type === "PRODUCTION_RECEIPT" && state.documents.some(d => d.sourceId === original.sourceId && d.type === "PRODUCTION_RECEIPT" && !d.reversedBy && String(d.id || d._id) > String(original.id || original._id))) fail("Reverse later work-order completions first");
  const current = new Map(state.balances.map(b => [b.key, { ...b }]));
  const moves = [...original.moves].reverse().map(m => {
    const before = current.get(m.key); if (!before) fail("Stock balance missing");
    const after = { ...before, qty: safeInteger(before.qty - m.delta), value: safeInteger(before.value - m.value) };
    if (!after.qty && after.value) fail("Reversal leaves residual stock value; reconcile later movements first");
    current.set(m.key, after);
    return { ...m, delta: -m.delta, value: -m.value, qtyAfter: after.qty, valueAfter: after.value };
  });
  return { type: "REVERSAL", lines: original.lines, moves, totals: original.totals,
    journals: original.journals.map(l => ({ ...l, debit: l.credit, credit: l.debit })), metadata: { reverses: String(original.id || original._id) } };
}
