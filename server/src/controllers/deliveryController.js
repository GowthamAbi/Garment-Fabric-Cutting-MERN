import DeliveryVendor from "../models/DeliveryVendor.js";
import DeliveryChallan from "../models/DeliveryChallan.js";
import FabricCutPlan from "../models/FabricCutPlan.js";
import FabricCutActual from "../models/FabricCutActual.js";
import Sequence from "../models/Sequence.js";
import ApiError from "../utils/ApiError.js";

const upper = (v) => String(v || "").trim().toUpperCase();
const num = (v) => Number(v || 0);
async function nextCode(key, prefix, width = 4) {
  const row = await Sequence.findOneAndUpdate({ key }, { $inc: { value: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  return `${prefix}-${String(row.value).padStart(width, "0")}`;
}
async function deliveryMap(planNos) {
  const rows = await DeliveryChallan.find({ planNo: { $in: planNos }, status: "ISSUED" }).lean();
  const map = new Map();
  rows.forEach((doc) => doc.lines.forEach((line) => {
    const key = `${doc.planNo}|${upper(line.colour)}|${upper(line.size)}`;
    map.set(key, (map.get(key) || 0) + num(line.pcs));
  }));
  return map;
}
function stages(plan, actual) {
  const cuttingComplete = Boolean(actual && actual.status === "COMPLETED");
  const foldingComplete = Boolean(plan.foldingSavedAt && plan.foldingLines?.length);
  return {
    cuttingStatus: cuttingComplete ? "COMPLETED" : actual ? "PENDING" : "NOT STARTED",
    foldingStatus: foldingComplete ? "COMPLETED" : "PENDING",
    elasticStatus: plan.elasticCompletedAt ? "COMPLETED" : "PENDING",
    eligible: cuttingComplete && foldingComplete,
  };
}
export async function listVendors(req, res) {
  const search = String(req.query.search || "");
  const query = search ? { $or: [{ vendorCode: new RegExp(search, "i") }, { vendorName: new RegExp(search, "i") }] } : {};
  res.json(await DeliveryVendor.find(query).sort({ vendorCode: 1 }).lean());
}
export async function getVendor(req, res) {
  const row = await DeliveryVendor.findOne({ vendorCode: upper(req.params.code), active: true }).lean();
  if (!row) throw new ApiError(404, "Vendor code not found");
  res.json(row);
}
export async function saveVendor(req, res) {
  if (!String(req.body.vendorName || "").trim()) throw new ApiError(400, "Vendor name is required");
  const values = {
    vendorName: String(req.body.vendorName).trim(), address: String(req.body.address || "").trim(),
    qcName: String(req.body.qcName || "").trim(), active: req.body.active !== false,
    stitchingItems: [...new Set((req.body.stitchingItems || []).map((x) => String(x).trim()).filter(Boolean))],
  };
  let row;
  if (req.params.id) row = await DeliveryVendor.findByIdAndUpdate(req.params.id, values, { new: true, runValidators: true });
  else row = await DeliveryVendor.create({ ...values, vendorCode: await nextCode("DELIVERY_VENDOR", "VEN"), createdBy: req.user?.email });
  if (!row) throw new ApiError(404, "Vendor not found");
  res.status(req.params.id ? 200 : 201).json(row);
}
export async function listPlanDetails(req, res) {
  const plans = await FabricCutPlan.find().sort({ createdAt: -1 }).lean();
  const actuals = await FabricCutActual.find({ planNo: { $in: plans.map((p) => p.planNo) } }).lean();
  const actualMap = new Map(actuals.map((a) => [a.planNo, a]));
  const used = await deliveryMap(plans.map((p) => p.planNo));
  res.json(plans.map((plan) => {
    const actual = actualMap.get(plan.planNo);
    const deliveredPcs = [...used].filter(([key]) => key.startsWith(`${plan.planNo}|`)).reduce((s, [, v]) => s + v, 0);
    return { ...plan, ...stages(plan, actual), actualPcs: num(actual?.totalActualPcs), deliveredPcs, cuttingBalancePcs: Math.max(0, num(actual?.totalActualPcs) - deliveredPcs) };
  }));
}
export async function getPlanSetup(req, res) {
  const no = upper(req.params.no);
  const plan = await FabricCutPlan.findOne({ $or: [{ planNo: no }, { dcNo: no }] }).lean();
  if (!plan) throw new ApiError(404, "Plan / DC not found");
  const actual = await FabricCutActual.findOne({ planNo: plan.planNo }).lean();
  const used = await deliveryMap([plan.planNo]);
  const lines = (actual?.lines || []).map((line) => {
    const deliveredPcs = used.get(`${plan.planNo}|${upper(line.colour)}|${upper(line.size)}`) || 0;
    return { colour: upper(line.colour), size: upper(line.size), actualPcs: num(line.actualPcs), deliveredPcs, balancePcs: Math.max(0, num(line.actualPcs) - deliveredPcs) };
  }).filter((line) => line.balancePcs > 0);
  res.json({ plan, actual, ...stages(plan, actual), lines });
}
export async function createChallan(req, res) {
  const plan = await FabricCutPlan.findOne({ planNo: upper(req.body.planNo) }).lean();
  if (!plan) throw new ApiError(404, "Plan not found");
  const actual = await FabricCutActual.findOne({ planNo: plan.planNo }).lean();
  const status = stages(plan, actual);
  if (!status.eligible) throw new ApiError(400, "Cutting and Folding must be completed before delivery");
  const vendor = await DeliveryVendor.findOne({ vendorCode: upper(req.body.vendorCode), active: true }).lean();
  if (!vendor) throw new ApiError(400, "Valid vendor code is required");
  const requested = (req.body.lines || []).map((x) => ({ colour: upper(x.colour), size: upper(x.size), pcs: num(x.pcs) })).filter((x) => x.pcs > 0);
  if (!requested.length) throw new ApiError(400, "Select at least one colour / size / PCS");
  const used = await deliveryMap([plan.planNo]);
  for (const line of requested) {
    const source = actual.lines.find((x) => upper(x.colour) === line.colour && upper(x.size) === line.size);
    const balance = num(source?.actualPcs) - (used.get(`${plan.planNo}|${line.colour}|${line.size}`) || 0);
    if (!source || line.pcs > balance) throw new ApiError(400, `${line.colour} / ${line.size}: only ${Math.max(0, balance)} PCS available`);
  }
  const challanNo = await nextCode("DELIVERY_CHALLAN", "DCH", 5);
  const row = await DeliveryChallan.create({ challanNo, deliveryDate: req.body.deliveryDate || new Date(), planNo: plan.planNo, dcNo: plan.dcNo, orderNo: plan.orderNo, itemCode: plan.itemCode, itemName: plan.itemName, style: plan.style, vendorCode: vendor.vendorCode, vendorName: vendor.vendorName, vendorAddress: vendor.address, qcName: vendor.qcName, lines: requested, totalPcs: requested.reduce((s, x) => s + x.pcs, 0), remarks: String(req.body.remarks || ""), createdBy: req.user?.email });
  res.status(201).json(row);
}
export async function listHistory(req, res) {
  const q = {};
  if (req.query.from || req.query.to) q.deliveryDate = { ...(req.query.from && { $gte: new Date(req.query.from) }), ...(req.query.to && { $lte: new Date(`${req.query.to}T23:59:59.999Z`) }) };
  if (req.query.vendorCode) q.vendorCode = upper(req.query.vendorCode);
  if (req.query.planNo) q.planNo = upper(req.query.planNo);
  res.json(await DeliveryChallan.find(q).sort({ deliveryDate: -1, createdAt: -1 }).lean());
}
export async function cuttingStock(req, res) {
  const actuals = await FabricCutActual.find({ status: "COMPLETED" }).sort({ createdAt: -1 }).lean();
  const used = await deliveryMap(actuals.map((x) => x.planNo));
  const rows = [];
  actuals.forEach((actual) => actual.lines.forEach((line) => {
    const deliveredPcs = used.get(`${actual.planNo}|${upper(line.colour)}|${upper(line.size)}`) || 0;
    const balancePcs = Math.max(0, num(line.actualPcs) - deliveredPcs);
    if (balancePcs > 0) rows.push({ _id: `${actual._id}-${line._id}`, createdAt: actual.createdAt, planNo: actual.planNo, dcNo: actual.dcNo, itemName: actual.itemName, colour: line.colour, size: line.size, actualPcs: line.actualPcs, deliveredPcs, balancePcs, status: "AVAILABLE" });
  }));
  res.json(rows);
}
