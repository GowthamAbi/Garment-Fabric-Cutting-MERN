<<<<<<< HEAD
import {DepartmentDemand} from "./departmentModels.js";
import mongoose from "mongoose";
import crypto from "node:crypto";
import { getTenant } from "../utils/tenantContext.js";
import { ErpParty, ErpSku, ErpBom, ErpDocument, ErpBalance, ErpEntry, ErpSettings, ErpSequence, ERP_MODELS, ErpApproval } from "./models.js";
import { planDocument, planReversal } from "./engine.js";
import { fail } from "./policy.js";
import Company from "../models/Company.js";
import { ErpRoute, ErpOperation, ErpRoll, OPERATION_MODELS } from "./operationsModels.js";
import { needsApproval } from "./commercialPolicy.js";
=======
import mongoose from "mongoose";
import crypto from "node:crypto";
import { getTenant } from "../utils/tenantContext.js";
import { ErpParty, ErpSku, ErpBom, ErpDocument, ErpBalance, ErpEntry, ErpSettings, ErpSequence, ERP_MODELS } from "./models.js";
import { planDocument, planReversal } from "./engine.js";
import { fail } from "./policy.js";
import Company from "../models/Company.js";
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810

export function workspaceFilter() {
  const tenant = getTenant();
  if (!tenant.companyId || !tenant.factoryId || !tenant.companyKey || tenant.role === "saas_super_admin") fail("ERP requires an explicit customer company and factory session");
  return { companyId: tenant.companyId, factoryId: tenant.factoryId };
}
function canonical(value) {
<<<<<<< HEAD
  if (value instanceof Date) return value.toISOString();
=======
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
export function requestHash(input) { return crypto.createHash("sha256").update(JSON.stringify(canonical(input))).digest("hex"); }
<<<<<<< HEAD
export function documentInput(body) {
  const allowed = ["demandId", "type", "date", "partyCode", "sourceId", "bomCode", "notes", "qcNotes", "amount", "cashAccount", "journalLines", "lines"];
=======
function documentInput(body) {
  const allowed = ["type", "date", "partyCode", "sourceId", "bomCode", "notes", "qcNotes", "amount", "cashAccount", "journalLines", "lines"];
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810
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
<<<<<<< HEAD
export async function postDocument(body, idempotencyKey, actor, reverseId = null, approvalId = null) {
=======
export async function postDocument(body, idempotencyKey, actor, reverseId = null) {
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810
  const scope = workspaceFilter();
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(idempotencyKey || "")) fail("An idempotency key of 16–100 characters is required");
  const input = reverseId ? { reverseId, notes: String(body.notes || "") } : documentInput(body);
  if (reverseId && !input.notes.trim()) fail("Reversal reason is required");
  const hash = requestHash(input);
<<<<<<< HEAD
  await Promise.all([...ERP_MODELS, ErpApproval, ...OPERATION_MODELS].map(model => model.init()));
=======
  await Promise.all(ERP_MODELS.map(model => model.init()));
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810
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
<<<<<<< HEAD
      if(!reverseId && ["OPENING","GOODS_RECEIPT"].includes(input.type) && await ErpRoll.exists({ ...scope,sku:{$in:(input.lines||[]).map(l=>l.sku)} }).session(session)) fail("Registered physical roll SKUs cannot receive another roll; create a distinct SKU");
=======
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810
      const balances = await ErpBalance.find(scope).session(session).lean();
      if (balances.length > 20000) fail("Factory exceeds current balance planning capacity");
      const [skus, parties, boms] = await Promise.all([
        ErpSku.find(scope).session(session).lean(), ErpParty.find(scope).session(session).lean(), ErpBom.find(scope).session(session).lean(),
      ]);
      const state = { balances, documents, skus, parties, boms, openingAllowed: !settings.enabled };
      const original = reverseId ? await ErpDocument.findOne({ ...scope, _id: reverseId }).session(session) : null;
<<<<<<< HEAD
      if (original?.type === "WORK_ORDER" && await ErpOperation.exists({ ...scope,workOrderId: String(original._id),status: { $ne: "CANCELLED" } }).session(session)) fail("Work order has shop-floor operations; cancel unstarted jobs or complete reviewed corrections before reversal");
      if (!reverseId && input.type === "PRODUCTION_RECEIPT") {
        const route = await ErpRoute.findOne({ ...scope,workOrderId: input.sourceId }).session(session).lean();
        if(!route) fail("Create and complete shop-floor routing before a production receipt");
        if (route) {
          const packed = await ErpOperation.find({ ...scope,workOrderId: input.sourceId,stage: "PACKING",status: "COMPLETE" }).session(session).lean();
          const capacity = packed.reduce((s,j)=>s+j.qty,0);
          const received = documents.filter(d=>d.sourceId===input.sourceId&&d.type==="PRODUCTION_RECEIPT"&&!d.reversedBy).reduce((s,d)=>s+d.lines[0].qty,0);
          const requested = (input.lines || []).reduce((s,l)=>s+Math.round(Number(l.quantity)*1000),0);
          if(received+requested>capacity) fail("Production receipt exceeds completed Packing quantity");
        }
      }
      if (reverseId && !original) fail("Original document not found");
      if(original?.metadata?.departmentManaged) fail("Use department return/correction flow; generic reversal would desynchronise bundles");
      if (original?.clearedAt) fail("Unmatch the bank statement with a reviewed reason before reversing this document");
      if (reverseId && original.type === "OPENING" && settings.enabled) fail("Opening balance is locked after activation");
      if (original?.type === "REVERSAL") fail("A reversal cannot be reversed; post a new correction document");
      const plan = original ? planReversal({ ...original.toObject(), id: String(original._id) }, state) : planDocument(input, state);
      let approval;
      if (approvalId) {
        if (!mongoose.isValidObjectId(approvalId)) fail("Invalid approval ID");
        approval = await ErpApproval.findOne({ ...scope,_id: approvalId,status: "APPROVED" }).session(session);
        if (!approval || approval.requestHash!==hash || approval.decidedBy!==actor || approval.requestedBy===actor) fail("Independent approved request does not match this posting");
      }
      if (!reverseId && needsApproval(settings,plan) && !approval) fail("This document needs independent approval; submit it through the approval queue");
      if(input.demandId){
        if(input.type!=="WORK_ORDER"||!mongoose.isValidObjectId(input.demandId))fail("Demand references belong to work orders");
        const demand=await DepartmentDemand.findOne({...scope,_id:input.demandId,status:"APPROVED"}).session(session).lean();
        if(!demand||plan.lines.length!==1||plan.lines[0].sku!==demand.sku)fail("Approved demand SKU must match output SKU");
        const allocated=await ErpDocument.find({...scope,type:"WORK_ORDER",reversedBy:{$exists:false},"metadata.demandId":input.demandId}).session(session).lean();
        if(allocated.reduce((n,d)=>n+d.lines[0].qty,0)+plan.lines[0].qty>demand.quantity*1000)fail("Production quantity exceeds approved demand");
        plan.metadata.demandId=input.demandId;plan.metadata.demandNumber=demand.number;plan.metadata.shop=demand.shop;
      }
=======
      if (reverseId && !original) fail("Original document not found");
      if (reverseId && original.type === "OPENING" && settings.enabled) fail("Opening balance is locked after activation");
      if (original?.type === "REVERSAL") fail("A reversal cannot be reversed; post a new correction document");
      const plan = original ? planReversal({ ...original.toObject(), id: String(original._id) }, state) : planDocument(input, state);
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810
      const company = await Company.findById(scope.companyId).session(session).lean();
      const party = parties.find(p => p.code === input.partyCode);
      const factory = company?.factories?.find(f => String(f._id) === String(scope.factoryId));
      plan.metadata.company = { name: company?.companyName || "Company", address: factory?.billingAddress || factory?.address || company?.address || "", gstin: factory?.gstin || "" };
      if (party) plan.metadata.party = { name: party.name, address: party.address, gstin: party.gstin, email: party.email };
      const date = new Date(input.date || Date.now());
      if (Number.isNaN(date.getTime()) || date > new Date(Date.now() + 86400000)) fail("Invalid posting date");
<<<<<<< HEAD
      if (["SALES_INVOICE","PURCHASE_INVOICE"].includes(plan.type)) plan.metadata.dueDate = new Date(date.getTime()+(party?.paymentTermDays??30)*86400000).toISOString();
      if (plan.type==="SALES_INVOICE" && party?.creditLimit!==null && party?.creditLimit!==undefined) {
        const entries = await ErpEntry.find({ ...scope,kind:"JOURNAL",account:"AR",party:party.code }).session(session).select("debit credit").limit(20001).lean();
        if(entries.length>20000) fail("Credit review exceeds current capacity");
        if(entries.reduce((s,e)=>s+e.debit-e.credit,0)+plan.totals.gross>party.creditLimit) fail("Customer credit limit exceeded; collect outstanding or obtain a reviewed limit change");
      }
=======
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810
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
<<<<<<< HEAD
      if (approval) { approval.status="POSTED"; approval.documentId=String(document._id); await approval.save({ session }); }
=======
>>>>>>> 50a2d22da23f6913de1a4c7a8fddee39543e5810
      result = document.toObject();
    });
    return result;
  } finally { await session.endSession(); }
}
