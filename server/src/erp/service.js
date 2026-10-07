import mongoose from "mongoose";
import crypto from "node:crypto";
import { getTenant } from "../utils/tenantContext.js";
import { ErpParty, ErpSku, ErpBom, ErpDocument, ErpBalance, ErpEntry, ErpSettings, ErpSequence, ERP_MODELS } from "./models.js";
import { planDocument, planReversal } from "./engine.js";
import { fail } from "./policy.js";
import Company from "../models/Company.js";

export function workspaceFilter() {
  const tenant = getTenant();
  if (!tenant.companyId || !tenant.factoryId || !tenant.companyKey || tenant.role === "saas_super_admin") fail("ERP requires an explicit customer company and factory session");
  return { companyId: tenant.companyId, factoryId: tenant.factoryId };
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export function requestHash(input) { return crypto.createHash("sha256").update(JSON.stringify(canonical(input))).digest("hex"); }
function documentInput(body) {
  const allowed = ["type", "date", "partyCode", "sourceId", "bomCode", "notes", "qcNotes", "amount", "cashAccount", "journalLines", "lines"];
  const input = Object.fromEntries(allowed.filter(k => body[k] !== undefined).map(k => [k, body[k]]));
  if (String(input.notes || "").length > 2000) fail("Narration is too long");
  return input;
}
async function relatedDocuments(sourceId, scope, session) {
  if (!sourceId) return [];
  if (!mongoose.isValidObjectId(sourceId)) fail("Invalid source ID");
  const docs = new Map(); let ids = [sourceId];
  for (let depth = 0; depth < 4 && ids.length; depth++) {
    const rows = await ErpDocument.find({ ...scope, $or: [{ _id: { $in: ids } }, { sourceId: { $in: ids } }] }).session(session).lean();
    ids = [];
    for (const row of rows) {
      const id = String(row._id);
      if (docs.has(id)) continue;
      docs.set(id, { ...row, id });
      ids.push(id);
      if (row.sourceId && mongoose.isValidObjectId(row.sourceId)) ids.push(row.sourceId);
    }
    if (docs.size > 5000) fail("Document link graph exceeds safe posting limit");
  }
  return [...docs.values()];
}
export async function postDocument(body, idempotencyKey, actor, reverseId = null) {
  const scope = workspaceFilter();
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey || "")) fail("An idempotency key of 16–100 characters is required");
  const input = reverseId ? { reverseId, notes: String(body.notes || "") } : documentInput(body);
  if (reverseId && !input.notes.trim()) fail("Reversal reason is required");
  const hash = requestHash(input);
  await Promise.all(ERP_MODELS.map(model => model.init()));
  // Create configuration before the transaction; unique index protects races.
  try { await ErpSettings.updateOne({ ...scope, key: "ERP" }, { $setOnInsert: { ...scope, key: "ERP", revision: 0 } }, { upsert: true }); }
  catch (e) { if (e.code !== 11000) throw e; }
  const session = await mongoose.startSession(); let result;
  try {
    await session.withTransaction(async () => {
      // Factory serialization prevents over-receipts, over-issues and overpayments.
      const settings = await ErpSettings.findOneAndUpdate({ ...scope, key: "ERP" }, { $inc: { revision: 1 } }, { new: true, session });
      const existing = await ErpDocument.findOne({ ...scope, idempotencyKey }).session(session).lean();
      if (existing) { if (existing.requestHash !== hash) fail("Idempotency key was already used for different data"); result = existing; return; }
      if (!settings.enabled && !(!reverseId && input.type === "OPENING")) fail("Review opening balances and activate ERP before posting");
      const documents = await relatedDocuments(reverseId || input.sourceId, scope, session);
      const balances = await ErpBalance.find(scope).session(session).lean();
      if (balances.length > 20000) fail("Factory exceeds current balance planning capacity");
      const [skus, parties, boms] = await Promise.all([
        ErpSku.find(scope).session(session).lean(), ErpParty.find(scope).session(session).lean(), ErpBom.find(scope).session(session).lean(),
      ]);
      const state = { balances, documents, skus, parties, boms, openingAllowed: !settings.enabled };
      const original = reverseId ? await ErpDocument.findOne({ ...scope, _id: reverseId }).session(session) : null;
      if (reverseId && !original) fail("Original document not found");
      if (reverseId && original.type === "OPENING" && settings.enabled) fail("Opening balance is locked after activation");
      if (original?.type === "REVERSAL") fail("A reversal cannot be reversed; post a new correction document");
      const plan = original ? planReversal({ ...original.toObject(), id: String(original._id) }, state) : planDocument(input, state);
      const company = await Company.findById(scope.companyId).session(session).lean();
      const party = parties.find(p => p.code === input.partyCode);
      const factory = company?.factories?.find(f => String(f._id) === String(scope.factoryId));
      plan.metadata.company = { name: company?.companyName || "Company", address: factory?.billingAddress || factory?.address || company?.address || "", gstin: factory?.gstin || "" };
      if (party) plan.metadata.party = { name: party.name, address: party.address, gstin: party.gstin, email: party.email };
      const date = new Date(input.date || Date.now());
      if (Number.isNaN(date.getTime()) || date > new Date(Date.now() + 86400000)) fail("Invalid posting date");
      const year = date.getUTCFullYear(), fy = date.getUTCMonth() >= 3 ? year : year - 1;
      const key = `${plan.type}/${fy}`;
      const sequence = await ErpSequence.findOneAndUpdate({ ...scope, key }, { $inc: { value: 1 }, $setOnInsert: scope }, { upsert: true, new: true, session });
      const number = `${plan.type}/${fy}-${String(fy + 1).slice(-2)}/${String(sequence.value).padStart(6, "0")}`;
      const [document] = await ErpDocument.create([{ ...scope, ...plan, number, date, partyCode: input.partyCode,
        sourceId: reverseId || input.sourceId, bomCode: input.bomCode, notes: input.notes,
        idempotencyKey, requestHash: hash, postedBy: actor }], { session });
      for (const move of plan.moves) {
        await ErpBalance.updateOne({ ...scope, key: move.key }, { $set: { ...scope, sku: move.sku, location: move.location,
          qty: move.qtyAfter, value: move.valueAfter } }, { session, upsert: true });
      }
      const entries = [
        ...plan.moves.map(move => ({ ...scope, ...move, kind: "STOCK", documentId: document._id, documentNo: number, date })),
        ...plan.journals.map(line => ({ ...scope, ...line, kind: "JOURNAL", documentId: document._id, documentNo: number, date })),
      ];
      if (entries.length) await ErpEntry.create(entries, { session });
      if (original) { original.reversedBy = String(document._id); await original.save({ session }); }
      result = document.toObject();
    });
    return result;
  } finally { await session.endSession(); }
}
