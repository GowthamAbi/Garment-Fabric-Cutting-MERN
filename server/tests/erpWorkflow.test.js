import test from "node:test";
import assert from "node:assert/strict";
import { planDocument, planReversal } from "../src/erp/engine.js";
import { financialReport } from "../src/erp/reports.js";
import { authorizeErp, quantity, money, ratio } from "../src/erp/policy.js";
import { requestHash, workspaceFilter } from "../src/erp/service.js";
import { runWithTenant } from "../src/utils/tenantContext.js";
function harness() {
  const state = { openingAllowed: true, balances: [], documents: [], boms: [], parties: [
    { code: "SUP", kind: "SUPPLIER" }, { code: "BUY", kind: "CUSTOMER" }], skus: [
    { code: "FAB", unit: "KG", location: "FABRIC", kind: "RAW" },
    { code: "ELA", unit: "MTR", location: "ELASTIC", kind: "RAW" },
    { code: "TEE", unit: "PCS", location: "FINISHED", kind: "FINISHED" }], entries: [] };
  let count = 0;
  const apply = (plan, input) => {
    const id = (++count).toString(16).padStart(24, "0");
    const doc = { ...input, ...plan, id, _id: id, status: "POSTED", date: new Date("2026-10-06") };
    for (const m of plan.moves) { const b = state.balances.find(b => b.key === m.key); const after = { key: m.key, sku: m.sku, location: m.location, qty: m.qtyAfter, value: m.valueAfter }; if (b) Object.assign(b, after); else state.balances.push(after); }
    state.entries.push(...plan.journals.map(j => ({ ...j, date: doc.date, documentId: id })));
    state.documents.push(doc); return doc;
  };
  const post = input => apply(planDocument(input, state), input);
  const reverse = doc => { const result = apply(planReversal(doc, state), { sourceId: doc.id }); doc.reversedBy = result.id; return result; };
  return { state, post, reverse };
}
const line = (sku, quantity, extra = {}) => ({ sku, quantity, ...extra });
test("connected procurement, BOM production, QC, sales, returns and balanced accounting", () => {
  const { state, post } = harness();
  post({ type: "OPENING", lines: [line("ELA", 100, { rate: 10 })] });
  post({ type: "JOURNAL", notes: "Owner capital", journalLines: [{ account: "BANK", debit: 20000 }, { account: "OPENING_EQUITY", credit: 20000 }] });
  state.openingAllowed = false;
  const po = post({ type: "PURCHASE_ORDER", partyCode: "SUP", lines: [line("FAB", 100, { rate: 50 })] });
  const grn = post({ type: "GOODS_RECEIPT", partyCode: "SUP", sourceId: po.id, lines: [line("FAB", 100, { rate: 1 })] });
  assert.equal(grn.totals.net, 500000, "receipt rate inherited from purchase order");
  const pi = post({ type: "PURCHASE_INVOICE", partyCode: "SUP", sourceId: grn.id, lines: [line("FAB", 100, { taxPercent: 18 })] });
  post({ type: "PAYMENT", partyCode: "SUP", sourceId: pi.id, amount: 5900 });
  assert.throws(() => post({ type: "PAYMENT", partyCode: "SUP", sourceId: pi.id, amount: 1 }), /outstanding/);
  state.boms.push({ code: "BOM1", outputSku: "TEE", outputQty: 1000, components: [{ sku: "FAB", qty: 2000 }, { sku: "ELA", qty: 100 }] });
  const wo = post({ type: "WORK_ORDER", bomCode: "BOM1", lines: [line("TEE", 10)] });
  assert.throws(() => post({ type: "PRODUCTION_RECEIPT", sourceId: wo.id, lines: [line("TEE", 10)] }), /Issue all/);
  post({ type: "MATERIAL_ISSUE", sourceId: wo.id, lines: [line("FAB", 20), line("ELA", 1)] });
  post({ type: "WORK_COST", sourceId: wo.id, amount: 100 });
  const finish = post({ type: "PRODUCTION_RECEIPT", sourceId: wo.id, lines: [line("TEE", 10)] });
  assert.equal(finish.metadata.cost, 111000);
  const so = post({ type: "SALES_ORDER", partyCode: "BUY", lines: [line("TEE", 10, { rate: 200, taxPercent: 18 })] });
  const si = post({ type: "SALES_INVOICE", sourceId: so.id, partyCode: "BUY", lines: [line("TEE", 10)] });
  assert.throws(() => post({ type: "DISPATCH", sourceId: si.id, partyCode: "BUY", lines: [line("TEE", 1, { location: "QC" })] }), /pass QC/);
  post({ type: "QC_RELEASE", sourceId: finish.id, qcNotes: "Dimensions and stitching passed", lines: [line("TEE", 10)] });
  const dispatch = post({ type: "DISPATCH", sourceId: si.id, partyCode: "BUY", lines: [line("TEE", 5)] });
  post({ type: "RECEIPT", sourceId: si.id, partyCode: "BUY", amount: 2360 });
  const returned = post({ type: "SALES_RETURN", sourceId: dispatch.id, partyCode: "BUY", lines: [line("TEE", 1)] });
  post({ type: "QC_RELEASE", sourceId: returned.id, qcNotes: "Returned unit inspected", lines: [line("TEE", 1)] });
  const report = financialReport(state.entries, state.balances, state.documents, new Date("2026-01-01"), new Date("2026-12-31"));
  assert.equal(report.trialDifference, 0); assert.equal(report.balanceSheet.difference, 0);
  assert.equal(report.profitAndLoss.profit, 135600);
  assert.equal(report.currentReconciliation.inventoryValue, report.currentReconciliation.inventoryLedger);
  assert.equal(report.currentReconciliation.wipValue, report.currentReconciliation.wipLedger);
});
test("two work orders cannot consume each other's WIP stock/cost", () => {
  const { state, post } = harness();
  post({ type: "OPENING", lines: [line("FAB", 20, { rate: 10 })] });
  state.boms.push({ code: "BOM", outputSku: "TEE", outputQty: 1000, components: [{ sku: "FAB", qty: 2000 }] });
  const a = post({ type: "WORK_ORDER", bomCode: "BOM", lines: [line("TEE", 2)] });
  const b = post({ type: "WORK_ORDER", bomCode: "BOM", lines: [line("TEE", 2)] });
  post({ type: "MATERIAL_ISSUE", sourceId: a.id, lines: [line("FAB", 4)] });
  assert.throws(() => post({ type: "PRODUCTION_RECEIPT", sourceId: b.id, lines: [line("TEE", 2)] }), /Issue all/);
  assert.equal(state.balances.find(s => s.location === `WIP:${a.id}`).qty, 4000);
});
test("partial completions allocate materials and labour without losing value", () => {
  const { state, post, reverse } = harness();
  post({ type: "OPENING", lines: [line("FAB", 6, { rate: 10 })] });
  state.boms.push({ code: "BOM", outputSku: "TEE", outputQty: 1000, components: [{ sku: "FAB", qty: 2000 }] });
  const wo = post({ type: "WORK_ORDER", bomCode: "BOM", lines: [line("TEE", 3)] });
  post({ type: "MATERIAL_ISSUE", sourceId: wo.id, lines: [line("FAB", 6)] });
  const cost = post({ type: "WORK_COST", sourceId: wo.id, amount: 1 });
  const first = post({ type: "PRODUCTION_RECEIPT", sourceId: wo.id, lines: [line("TEE", 1)] });
  assert.equal(first.metadata.workCostAllocated, 33);
  post({ type: "WORK_COST", sourceId: wo.id, amount: 1 });
  const last = post({ type: "PRODUCTION_RECEIPT", sourceId: wo.id, lines: [line("TEE", 2)] });
  assert.equal(last.metadata.workCostAllocated, 167);
  assert.equal(state.balances.find(b => b.location === "QC").value, 6200);
  assert.throws(() => reverse(cost), /allocated work costs/);
  assert.throws(() => reverse(first), /later work-order/);
  assert.throws(() => post({ type: "PRODUCTION_RECEIPT", sourceId: wo.id, lines: [line("TEE", 1)] }), /exceeds/);
  const report = financialReport(state.entries, state.balances, state.documents, new Date(0), new Date("2027-01-01"));
  assert.equal(report.currentReconciliation.wipValue, 0); assert.equal(report.currentReconciliation.wipLedger, 0);
});
test("purchase returns, material returns, QC rejection and jobwork preserve stock/accounting", () => {
  const { state, post } = harness();
  const po = post({ type: "PURCHASE_ORDER", partyCode: "SUP", lines: [line("FAB", 10, { rate: 10 })] });
  const grn = post({ type: "GOODS_RECEIPT", partyCode: "SUP", sourceId: po.id, lines: [line("FAB", 10)] });
  const pi = post({ type: "PURCHASE_INVOICE", partyCode: "SUP", sourceId: grn.id, lines: [line("FAB", 10, { taxPercent: 18 })] });
  post({ type: "PURCHASE_RETURN", partyCode: "SUP", sourceId: pi.id, lines: [line("FAB", 1)] });
  const sent = post({ type: "JOBWORK_SEND", partyCode: "SUP", lines: [line("FAB", 2)] });
  const received = post({ type: "JOBWORK_RECEIPT", sourceId: sent.id, partyCode: "SUP", lines: [line("FAB", 2)] });
  post({ type: "QC_REJECT", sourceId: received.id, qcNotes: "Rejected shade", lines: [line("FAB", 1)] });
  post({ type: "QC_RELEASE", sourceId: received.id, qcNotes: "One unit passed", lines: [line("FAB", 1)] });
  assert.throws(() => post({ type: "QC_RELEASE", sourceId: received.id, qcNotes: "Excess", lines: [line("FAB", 1)] }), /exceeds/);
  state.boms.push({ code: "BOM", outputSku: "TEE", outputQty: 1000, components: [{ sku: "FAB", qty: 1000 }] });
  const wo = post({ type: "WORK_ORDER", bomCode: "BOM", lines: [line("TEE", 3)] });
  post({ type: "MATERIAL_ISSUE", sourceId: wo.id, lines: [line("FAB", 3)] });
  post({ type: "MATERIAL_RETURN", sourceId: wo.id, lines: [line("FAB", 1)] });
  assert.throws(() => post({ type: "PRODUCTION_RECEIPT", sourceId: wo.id, lines: [line("TEE", 3)] }), /Issue all/);
  const report = financialReport(state.entries, state.balances, state.documents, new Date(0), new Date("2027-01-01"));
  assert.equal(report.trialDifference, 0); assert.equal(report.balanceSheet.difference, 0);
  assert.equal(report.currentReconciliation.inventoryValue, report.currentReconciliation.inventoryLedger);
  assert.equal(report.currentReconciliation.wipValue, report.currentReconciliation.wipLedger);
});
test("linked quantity caps, negative stock and reversal downstream protection", () => {
  const { state, post, reverse } = harness();
  const opening = post({ type: "OPENING", lines: [line("FAB", 10, { rate: 2 })] });
  const transfer = post({ type: "STOCK_TRANSFER", lines: [line("FAB", 3, { target: "CUTTING" })] });
  assert.throws(() => post({ type: "WASTE", lines: [line("FAB", 8)] }), /negative/);
  reverse(transfer); assert.equal(state.balances.find(b => b.key === "FAB@FABRIC").qty, 10000);
  assert.throws(() => reverse(transfer), /already reversed/);
  const po = post({ type: "PURCHASE_ORDER", partyCode: "SUP", lines: [line("FAB", 5, { rate: 1 })] });
  post({ type: "GOODS_RECEIPT", sourceId: po.id, partyCode: "SUP", lines: [line("FAB", 4)] });
  assert.throws(() => post({ type: "GOODS_RECEIPT", sourceId: po.id, partyCode: "SUP", lines: [line("FAB", 2)] }), /exceeds/);
  assert.throws(() => reverse(po), /downstream/);
  state.openingAllowed = false; assert.throws(() => post({ type: "OPENING", lines: [line("FAB", 1)] }), /locked/);
  assert.ok(opening.id);
});
test("journal cannot edit inventory control accounts or imbalance totals", () => {
  const { post } = harness();
  assert.throws(() => post({ type: "JOURNAL", notes: "Invalid", journalLines: [{ account: "BANK", debit: 5 }, { account: "SALES", credit: 4 }] }), /balanced/);
  assert.throws(() => post({ type: "JOURNAL", notes: "Invalid", journalLines: [{ account: "INVENTORY", debit: 5 }, { account: "BANK", credit: 5 }] }), /control accounts/);
});
test("permission and workspace gates reject owner/support and unscoped calls", () => {
  assert.equal(authorizeErp({ role: "saas_super_admin" }, "post", "OPENING"), false);
  assert.equal(authorizeErp({ role: "support_viewer" }, "read"), false);
  assert.equal(authorizeErp({ role: "store", permissions: ["erp.stock"] }, "post", "STOCK_TRANSFER"), true);
  assert.equal(authorizeErp({ role: "store", permissions: ["erp.stock"] }, "post", "JOURNAL"), false);
  assert.throws(() => workspaceFilter());
  runWithTenant({ companyKey: "abc", companyId: "a", factoryId: "f", role: "company_admin" }, () => assert.deepEqual(workspaceFilter(), { companyId: "a", factoryId: "f" }));
});
test("precise quantities, monetary integer arithmetic and stable request hashing", () => {
  assert.equal(quantity("0.001"), 1); assert.equal(money("0.01"), 1);
  assert.throws(() => quantity("1.0001")); assert.throws(() => money("1.001"));
  assert.equal(ratio(999999999, 999999999, 1000000), 999999998000);
  assert.equal(requestHash({ b: 2, a: 1 }), requestHash({ a: 1, b: 2 }));
  assert.notEqual(requestHash({ a: 1 }), requestHash({ a: 2 }));
});
