import GarmentBom from "../models/GarmentBom.js";
import GarmentPo from "../models/GarmentPo.js";
import GarmentMovement from "../models/GarmentMovement.js";
import ApiError from "../utils/ApiError.js";
import { generateReferenceNo } from "../utils/generateReferenceNo.js";

const upper = (value) => String(value || "").trim().toUpperCase();
const number = (value) => Number(value || 0);
const editableRoles = ["saas_super_admin", "company_admin", "admin"];

function dateFilter(query) {
  if (!query.from && !query.to) return {};
  return { $gte: query.from ? new Date(query.from) : new Date("2000-01-01"), $lte: query.to ? new Date(`${query.to}T23:59:59.999Z`) : new Date() };
}

export async function listBoms(request, response) {
  const filter = {};
  if (request.query.status) filter.status = request.query.status;
  if (request.query.search) filter.$or = ["bomNo", "style", "itemName", "brand"].map((key) => ({ [key]: { $regex: request.query.search, $options: "i" } }));
  response.json(await GarmentBom.find(filter).sort({ updatedAt: -1 }));
}

export async function saveBom(request, response) {
  const sizes = (request.body.sizes || []).map((row) => ({ ...row, size: upper(row.size), cuttingKg: number(row.cuttingKg), foldingKg: number(row.foldingKg), elasticMeasurement: number(row.elasticMeasurement) }));
  const colours = (request.body.colours || []).map((row) => typeof row === "string" ? { name: upper(row) } : { name: upper(row.name) }).filter((row) => row.name);
  if (!sizes.length || !colours.length) throw new ApiError(400, "At least one colour and size measurement is required");
  const data = { ...request.body, bomNo: upper(request.body.bomNo), style: upper(request.body.style), colours, sizes, createdBy: request.user.name };
  if (request.params.id && !editableRoles.includes(request.user.role)) data.status = "PENDING_APPROVAL";
  const record = request.params.id
    ? await GarmentBom.findByIdAndUpdate(request.params.id, data, { new: true, runValidators: true })
    : await GarmentBom.create(data);
  if (!record) throw new ApiError(404, "BOM not found");
  response.status(request.params.id ? 200 : 201).json(record);
}

export async function approveBom(request, response) {
  const record = await GarmentBom.findByIdAndUpdate(request.params.id, { status: request.body.status || "APPROVED", approvedBy: request.user.name, approvedAt: new Date() }, { new: true, runValidators: true });
  if (!record) throw new ApiError(404, "BOM not found");
  response.json(record);
}

export async function deleteBom(request, response) {
  const record = await GarmentBom.findByIdAndDelete(request.params.id);
  if (!record) throw new ApiError(404, "BOM not found");
  response.json({ message: "BOM deleted" });
}

export async function listPos(request, response) {
  const filter = {};
  const dates = dateFilter(request.query);
  if (Object.keys(dates).length) filter.poDate = dates;
  if (request.query.status) filter.status = request.query.status;
  response.json(await GarmentPo.find(filter).sort({ poDate: -1 }));
}

async function normalizePo(row, user, batch = "MANUAL") {
  const sizes = (row.sizes || []).map((line) => ({ size: upper(line.size), quantity: number(line.quantity) })).filter((line) => line.size && line.quantity > 0);
  return { ...row, poNo: upper(row.poNo), style: upper(row.style), bomNo: upper(row.bomNo), colour: upper(row.colour), sizes, orderQty: sizes.reduce((sum, line) => sum + line.quantity, 0) || number(row.orderQty), uploadBatch: batch, createdBy: user.name };
}

export async function savePo(request, response) {
  const data = await normalizePo(request.body, request.user);
  const duplicate = await GarmentPo.findOne({ poNo: data.poNo, style: data.style, colour: data.colour });
  if (duplicate && !editableRoles.includes(request.user.role)) throw new ApiError(409, "Duplicate PO needs company admin approval");
  const record = duplicate
    ? await GarmentPo.findByIdAndUpdate(duplicate._id, data, { new: true, runValidators: true })
    : await GarmentPo.create(data);
  response.status(duplicate ? 200 : 201).json(record);
}

export async function uploadPos(request, response) {
  const rows = request.body.rows || [];
  if (!rows.length) throw new ApiError(400, "Upload contains no PO rows");
  const batch = generateReferenceNo("POU");
  const saved = [];
  for (const row of rows) {
    const data = await normalizePo({ ...row, sourcePeriodFrom: request.body.from, sourcePeriodTo: request.body.to }, request.user, batch);
    saved.push(await GarmentPo.findOneAndUpdate({ poNo: data.poNo, style: data.style, colour: data.colour }, data, { upsert: true, new: true, runValidators: true }));
  }
  response.status(201).json({ batch, count: saved.length, rows: saved });
}

export async function materialStatus(request, response) {
  const filter = {};
  const dates = dateFilter(request.query);
  if (Object.keys(dates).length) filter.poDate = dates;
  const [orders, boms, fabricMovements] = await Promise.all([GarmentPo.find(filter).lean(), GarmentBom.find({ status: "APPROVED" }).lean(), GarmentMovement.find({ department: "FABRIC" }).lean()]);
  const bomMap = new Map(boms.map((row) => [row.bomNo, row]));
  const stockMap = new Map();
  for (const row of fabricMovements) {
    const key = `${upper(row.fabricType || row.itemName)}|${upper(row.colour)}`;
    const direction = ["OUTWARD", "WASTE", "REJECTION"].includes(row.movementType) ? -1 : 1;
    stockMap.set(key, (stockMap.get(key) || 0) + direction * number(row.quantity));
  }
  const map = new Map();
  for (const order of orders) {
    const bom = bomMap.get(order.bomNo);
    if (!bom) continue;
    for (const sizeLine of order.sizes) {
      const measurement = bom.sizes.find((row) => upper(row.size) === upper(sizeLine.size));
      if (!measurement) continue;
      const wantedPerColourKg = number(sizeLine.quantity) * (number(measurement.cuttingKg) + number(measurement.foldingKg)) / Math.max(1, bom.colours.length);
      const key = `${upper(bom.fabricType)}|${upper(order.colour)}`;
      const current = map.get(key) || { fabricType: bom.fabricType, colour: order.colour, wantedKg: 0, stockKg: stockMap.get(key) || 0 };
      current.wantedKg += wantedPerColourKg;
      map.set(key, current);
    }
  }
  response.json([...map.values()].map((row) => ({ ...row, wantedKg: Number(row.wantedKg.toFixed(3)), balanceKg: Number((row.stockKg - row.wantedKg).toFixed(3)), status: row.stockKg >= row.wantedKg ? "AVAILABLE" : "SHORTAGE" })));
}

export async function listMovements(request, response) {
  const filter = {};
  for (const key of ["department", "movementType", "dcNo", "poNo", "style", "colour", "size", "status"]) if (request.query[key]) filter[key] = upper(request.query[key]);
  const dates = dateFilter(request.query);
  if (Object.keys(dates).length) filter.transactionDate = dates;
  response.json(await GarmentMovement.find(filter).sort({ transactionDate: -1, createdAt: -1 }).limit(2000));
}

export async function saveMovement(request, response) {
  const data = { ...request.body, department: upper(request.body.department), movementType: upper(request.body.movementType), dcNo: upper(request.body.dcNo), poNo: upper(request.body.poNo), style: upper(request.body.style), colour: upper(request.body.colour), size: upper(request.body.size), quantity: number(request.body.quantity), createdBy: request.user.name };
  if (data.quantity <= 0) throw new ApiError(400, "Quantity must be greater than zero");
  const record = await GarmentMovement.create({ ...data, referenceNo: generateReferenceNo(data.department.slice(0, 3)) });
  if (data.department === "CUTTING" && data.movementType === "PRODUCTION" && data.poNo) {
    const po = await GarmentPo.findOne({ poNo: data.poNo, style: data.style, colour: data.colour });
    if (po) {
      po.cuttingCompletedQty = Math.min(po.orderQty, po.cuttingCompletedQty + data.quantity);
      po.status = po.cuttingCompletedQty >= po.orderQty ? "COMPLETED" : "PARTIAL";
      await po.save();
    }
  }
  response.status(201).json(record);
}

export async function dashboard(_request, response) {
  const [orders, movements] = await Promise.all([GarmentPo.find().lean(), GarmentMovement.find().sort({ transactionDate: -1 }).limit(500).lean()]);
  const departments = ["FABRIC", "CUTTING", "ACCESSORIES", "ELASTIC", "STITCHING", "FINISHING", "PACKING", "DISPATCH"];
  response.json({
    orderQty: orders.reduce((sum, row) => sum + number(row.orderQty), 0),
    cuttingPending: orders.reduce((sum, row) => sum + Math.max(0, number(row.orderQty) - number(row.cuttingCompletedQty)), 0),
    departments: departments.map((department) => ({ department, quantity: movements.filter((row) => row.department === department && ["PRODUCTION", "INWARD", "DELIVERY"].includes(row.movementType)).reduce((sum, row) => sum + number(row.quantity), 0), pending: movements.filter((row) => row.department === department && ["PENDING", "HOLD", "PARTIAL"].includes(row.status)).length })),
    recent: movements.slice(0, 20),
  });
}
