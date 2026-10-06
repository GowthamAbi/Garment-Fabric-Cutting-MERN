import { Router } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { ErpParty, ErpSku, ErpBom, ErpDocument, ErpBalance, ErpEntry, ErpSettings } from "./models.js";
import { postDocument, workspaceFilter } from "./service.js";
import { ACCOUNTS, TYPES, LOCATIONS, quantity, money, authorizeErp, fail } from "./policy.js";
import { financialReport } from "./reports.js";
import { currentDatabase } from "../config/tenantDatabase.js";
const router = Router();
const finance = req => authorizeErp(req.user, "finance");
function visibleDocument(req, doc) {
  if (finance(req)) return doc;
  const pricing = authorizeErp(req.user, "post", doc.type);
  return { ...doc, journals: [], moves: doc.moves.map(m => ({ ...m, value: null, valueAfter: null })),
    totals: pricing ? doc.totals : { net: null, tax: null, gross: null },
    metadata: { ...doc.metadata, cost: null },
    lines: doc.lines.map(l => pricing ? l : { ...l, rate: null, net: null, tax: null }) };
}
function gate(action, type = "") {
  return (req, _res, next) => authorizeErp(req.user, action, type || req.body?.type) ? next() : next(new ApiError(403, "ERP permission denied"));
}
router.use(gate("read"));
router.get("/workspace", asyncHandler(async (_req, res) => {
  const scope = workspaceFilter();
  const [settings, skus, parties, boms, company] = await Promise.all([
    ErpSettings.findOne({ ...scope, key: "ERP" }).lean(), ErpSku.find(scope).limit(2000).lean(),
    ErpParty.find(scope).limit(2000).lean(), ErpBom.find(scope).limit(1000).lean(),
    (await import("../models/Company.js")).default.findById(scope.companyId).lean(),
  ]);
  res.json({ settings: settings || { enabled: false }, skus, parties, boms, accounts: ACCOUNTS, types: TYPES, locations: LOCATIONS,
    company: { name: company?.companyName, address: company?.address, factory: company?.factories?.find(f => String(f._id) === String(scope.factoryId))?.name } });
}));
router.get("/migration-snapshot", gate("masters"), asyncHandler(async (_req, res) => {
  const scope = workspaceFilter(), db = currentDatabase().db;
  const filter = { companyId: new mongoose.Types.ObjectId(scope.companyId), factoryId: new mongoose.Types.ObjectId(scope.factoryId) };
  const snapshot = { capturedAt: new Date(), factoryId: scope.factoryId, reviewRequired: true, rows: [], warnings: [] };
  for (const name of ["items", "fabricbundlestocks", "warehousestocks", "fabriccutactuals", "deliverychallans"]) {
    const rows = await db.collection(name).find(filter).limit(10001).toArray();
    if (rows.length > 10000) { snapshot.warnings.push(`${name}: truncated at 10000 records; request a full maintenance export`); rows.pop(); }
    for (const row of rows) {
      if (name === "items") snapshot.rows.push({ source: name, sourceId: row._id, itemCode: row.itemCode, colour: row.colour, unit: row.unit, location: "ACCESSORIES", quantity: row.stockQty, note: "No opening cost provided; verify valuation" });
      if (name === "fabricbundlestocks") snapshot.rows.push({ source: name, sourceId: row._id, itemCode: row.fabricCode, colour: row.colour, batch: row.batchNo, setNo: row.setNo, dia: row.dia, unit: "KG", location: "FABRIC", quantity: row.balanceWeightKg, note: `Status ${row.status}; provisional=${row.provisionalWeight}. Reconcile plan reservations separately.` });
      if (name === "warehousestocks") snapshot.rows.push({ source: name, sourceId: row._id, itemCode: row.itemCode, colour: row.colour, size: row.size, unit: row.unit, location: row.warehouseType, quantity: row.balanceQty, note: "Review QC/jobwork status before mapping to ERP location" });
      if (["fabriccutactuals", "deliverychallans"].includes(name)) snapshot.rows.push({ source: name, sourceId: row._id, planNo: row.planNo, itemCode: row.itemCode, lines: row.lines, status: row.status, note: "Historical production/dispatch reference, not an automatic opening stock amount" });
    }
  }
  snapshot.warnings.push("Pause legacy writes during reconciliation. Avoid double-counting fabric, cutting, jobwork and warehouse quantities. Verify physical stock and unit costs before ERP activation.");
  res.json(snapshot);
}));
const code = value => {
  const result = String(value || "").trim().toUpperCase(); if (!/^[A-Z0-9_-]{2,60}$/.test(result)) fail("Code must be 2–60 letters, numbers, underscores or hyphens"); return result;
};
router.post("/masters/:kind", gate("masters"), asyncHandler(async (req, res) => {
  const scope = workspaceFilter(), body = req.body;
  const models = { skus: ErpSku, parties: ErpParty, boms: ErpBom }, model = models[req.params.kind];
  if (!model) fail("Unknown master type");
  let data;
  if (req.params.kind === "skus") {
    if (!LOCATIONS.includes(body.location) || !["RAW", "FINISHED", "CONSUMABLE"].includes(body.kind)) fail("Invalid item classification/location");
    if (!String(body.name || "").trim() || !/^[A-Za-z0-9]{1,12}$/.test(body.unit || "")) fail("Item name and unit required");
    data = { code: code(body.code), name: String(body.name).slice(0, 120), unit: body.unit.toUpperCase(), kind: body.kind,
      location: body.location, batch: String(body.batch || "").slice(0, 60), colour: String(body.colour || "").slice(0, 60), size: String(body.size || "").slice(0, 30), minimumQty: quantity(body.minimumQty || 0.001) / 1000 };
  } else if (req.params.kind === "parties") {
    if (!String(body.name || "").trim() || !["CUSTOMER", "SUPPLIER", "BOTH"].includes(body.kind)) fail("Party name/type required");
    if (body.email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(body.email)) fail("Invalid billing email");
    data = { code: code(body.code), name: String(body.name).slice(0, 120), kind: body.kind,
      email: String(body.email || "").slice(0, 200), phone: String(body.phone || "").slice(0, 30), address: String(body.address || "").slice(0, 500), gstin: String(body.gstin || "").slice(0, 20) };
  } else {
    const components = (body.components || []).map(c => ({ sku: code(c.sku), qty: quantity(c.quantity) }));
    if (!components.length || components.length > 100 || new Set(components.map(c => c.sku)).size !== components.length) fail("Use 1–100 unique BOM components");
    const outputSku = code(body.outputSku);
    const skus = await ErpSku.find({ ...scope, code: { $in: [outputSku, ...components.map(c => c.sku)] } }).lean();
    if (skus.length !== components.length + 1 || skus.find(s => s.code === outputSku)?.kind !== "FINISHED") fail("BOM needs distinct valid component SKUs and finished output");
    data = { code: code(body.code), outputSku, outputQty: quantity(body.outputQuantity), components };
  }
  const existing = await model.findOne({ ...scope, code: data.code });
  if (existing) {
    if (req.params.kind !== "parties") fail("SKU/BOM definitions are versioned: create a new code instead of changing existing stock rules");
    Object.assign(existing, data); await existing.save(); res.json(existing);
  } else res.status(201).json(await model.create({ ...scope, ...data }));
}));
router.post("/activate", gate("activate"), asyncHandler(async (req, res) => {
  if (req.body.confirm !== "OPENING BALANCES REVIEWED" || !String(req.body.notes || "").trim()) fail("Confirm reviewed opening balances and record migration notes");
  const scope = workspaceFilter();
  await ErpSettings.updateOne({ ...scope, key: "ERP" }, { $setOnInsert: { ...scope, key: "ERP", enabled: false, revision: 0 } }, { upsert: true });
  const result = await ErpSettings.findOneAndUpdate({ ...scope, key: "ERP", enabled: false }, { $set: {
    enabled: true, legacyWritesLocked: true, activationAt: new Date(), activatedBy: req.user.userId,
    migrationNotes: String(req.body.notes).slice(0, 2000) } }, { new: true });
  if (!result) fail("ERP is already activated");
  res.json(result);
}));
router.post("/documents", gate("post"), asyncHandler(async (req, res) => res.status(201).json(visibleDocument(req, await postDocument(req.body, req.get("Idempotency-Key"), req.user.userId)))));
router.post("/documents/:id/reverse", gate("reverse"), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) fail("Invalid document ID");
  res.json(visibleDocument(req, await postDocument(req.body, req.get("Idempotency-Key"), req.user.userId, req.params.id)));
}));
router.get("/documents", asyncHandler(async (req, res) => {
  const scope = workspaceFilter(), filter = { ...scope };
  if (req.query.type) filter.type = String(req.query.type);
  if (req.query.before && mongoose.isValidObjectId(req.query.before)) filter._id = { $lt: req.query.before };
  res.json((await ErpDocument.find(filter).sort({ _id: -1 }).limit(200).lean()).map(d => visibleDocument(req, d)));
}));
router.get("/documents/:id", asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) fail("Invalid document ID");
  const row = await ErpDocument.findOne({ ...workspaceFilter(), _id: req.params.id }).lean();
  if (!row) throw new ApiError(404, "Document not found"); res.json(visibleDocument(req, row));
}));
router.get("/stock", asyncHandler(async (req, res) => {
  const scope = workspaceFilter();
  const rows = await ErpBalance.find(scope).sort({ sku: 1, location: 1 }).limit(20000).lean();
  res.json(finance(req) ? rows : rows.map(b => ({ ...b, value: null })));
}));
router.get("/ledger", asyncHandler(async (req, res) => {
  const filter = { ...workspaceFilter() };
  if (!finance(req)) filter.kind = "STOCK";
  if (req.query.kind) filter.kind = req.query.kind;
  if (!finance(req) && filter.kind !== "STOCK") throw new ApiError(403, "Financial ledger permission required");
  if (req.query.sku) filter.sku = req.query.sku;
  if (req.query.account) filter.account = req.query.account;
  const rows = await ErpEntry.find(filter).sort({ date: -1, _id: -1 }).limit(1000).lean();
  res.json(finance(req) ? rows : rows.map(e => ({ ...e, value: null, valueAfter: null })));
}));
router.get("/financials", gate("finance"), asyncHandler(async (req, res) => {
  const scope = workspaceFilter(), from = new Date(req.query.from || "1970-01-01"), to = new Date(req.query.to || Date.now());
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) fail("Invalid report date range");
  const [entries, balances, documents] = await Promise.all([ErpEntry.find({ ...scope, kind: "JOURNAL", date: { $lte: to } }).lean(), ErpBalance.find(scope).lean(), ErpDocument.find({ ...scope, type: { $in: ["WORK_COST", "PRODUCTION_RECEIPT"] } }).lean()]);
  res.json(financialReport(entries, balances, documents, from, to));
}));
router.post("/documents/:id/reconcile", gate("reconcile"), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) fail("Invalid document ID");
  const doc = await ErpDocument.findOne({ ...workspaceFilter(), _id: req.params.id });
  if (!doc || doc.reversedBy) fail("Posted bank document required");
  const bank = doc.journals.filter(l => l.account === "BANK").reduce((s, l) => s + l.debit - l.credit, 0);
  if (!bank || Math.abs(bank) !== money(req.body.amount) || !String(req.body.bankReference || "").trim()) fail("Bank statement amount/reference must match this document");
  const clearedAt = new Date(req.body.clearedAt);
  if (Number.isNaN(clearedAt.getTime()) || clearedAt < doc.date || clearedAt > new Date()) fail("Invalid bank clearance date");
  if (doc.clearedAt) fail("Document is already reconciled");
  doc.clearedAt = clearedAt; doc.bankReference = String(req.body.bankReference).slice(0, 100); await doc.save(); res.json(doc);
}));
export default router;
