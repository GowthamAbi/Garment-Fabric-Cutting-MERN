import { fail, safeInteger } from './policy.js';

export function departmentSummary(lots, bundles, balances) {
  const byLot = new Map(lots.map(l => [String(l._id), l]));
  const stages = new Map(), sections = new Map(), issues = [];
  const physical = new Map(balances.filter(b => b.location?.startsWith('DPT:')).map(b => [`${b.sku}@${b.location}`, b]));
  for (const b of bundles) {
    if (!Number.isSafeInteger(b.qty) || b.qty < 0) fail('Invalid physical bundle quantity');
    const lot = byLot.get(b.lotId);
    if (!lot) { issues.push({ bundle: b.code, reason: 'Lot missing' }); continue; }
    const key = `${lot.sku}@DPT:${b.stage}:${b.code}`, stock = physical.get(key);
    if ((stock?.qty || 0) !== b.qty * 1000) issues.push({ bundle: b.code, reason: 'Bundle/ledger quantity mismatch', pieces: b.qty, ledgerQuantity: stock?.qty || 0 });
    if (!b.qty && stock?.value) issues.push({ bundle: b.code, reason: 'Empty bundle retains stock value' });
    physical.delete(key);
    if (!b.qty) continue;
    const stage = b.stage.startsWith('OP:') ? (lot.operations?.[Number(b.stage.slice(3))] || b.stage) : b.stage;
    const groupKey = JSON.stringify([lot.sku, lot.section, b.stage]);
    const row = stages.get(groupKey) || { sku: lot.sku, section: lot.section, stage: b.stage, operation: stage, pieces: 0 };
    row.pieces = safeInteger(row.pieces + b.qty); stages.set(groupKey, row);
  }
  for (const [key, b] of physical) if (b.qty || b.value) issues.push({ key, reason: 'Unlinked department stock' });
  for (const l of lots) {
    if (l.status === 'CANCELLED') continue;
    if (![l.sent, l.received].every(Number.isSafeInteger) || l.received < 0 || l.received > l.sent) fail('Invalid DC inward totals');
    const k = JSON.stringify([l.section, l.sku]), row = sections.get(k) || { section: l.section, sku: l.sku, sent: 0, received: 0, pending: 0 };
    row.sent = safeInteger(row.sent + l.sent); row.received = safeInteger(row.received + l.received);
    row.pending = row.sent - row.received; sections.set(k, row);
  }
  return { stages: [...stages.values()], sections: [...sections.values()], reconciliation: { balanced: issues.length === 0, issues } };
}
