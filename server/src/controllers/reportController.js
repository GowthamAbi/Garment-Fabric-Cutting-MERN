import PurchaseOrder from "../models/PurchaseOrder.js";
import Inward from "../models/Inward.js";
import Outward from "../models/Outward.js";
import ProductionPlan from "../models/ProductionPlan.js";
import ProductionJob from "../models/ProductionJob.js";
import PendingIssue from "../models/PendingIssue.js";
import SewingDelivery from "../models/SewingDelivery.js";
import SewingHold from "../models/SewingHold.js";
import WarehouseStock from "../models/WarehouseStock.js";

const rx = (value) => ({ $regex: String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" });

function dateFilter(query) {
  if (!query.from && !query.to) return {};
  return { createdAt: { ...(query.from && { $gte: new Date(query.from) }), ...(query.to && { $lte: new Date(`${query.to}T23:59:59.999Z`) }) } };
}

const ADMIN_ROLES = ["saas_super_admin", "company_admin", "admin"];
const STORE_KEYS = ["pos", "inwards", "outwards"];
const PRODUCTION_KEYS = ["plans", "jobs", "pending", "sewing", "sewingHolds", "warehouse"];

function allowedReportKeys(role) {
  if (ADMIN_ROLES.includes(role)) return [...STORE_KEYS, ...PRODUCTION_KEYS];
  if (role === "store") return STORE_KEYS;
  return PRODUCTION_KEYS;
}

function scopeReports(reports, role) {
  const allowed = new Set(allowedReportKeys(role));
  return Object.fromEntries(Object.entries(reports).filter(([key]) => allowed.has(key)));
}

export async function getReports(request, response) {
  const common = dateFilter(request.query);
  const [pos, inwards, outwards, plans, jobs, pending, sewing, sewingHolds, warehouse] = await Promise.all([
    PurchaseOrder.find({ ...common, ...(request.query.po && { poNo: rx(request.query.po) }) }).lean(),
    Inward.find({ ...common, ...(request.query.item && { itemCode: rx(request.query.item) }) }).lean(),
    Outward.find({ ...common, ...(request.query.dc && { dcNo: rx(request.query.dc) }), ...(request.query.colour && { colour: rx(request.query.colour) }) }).lean(),
    ProductionPlan.find({ ...common, ...(request.query.dc && { dcNo: rx(request.query.dc) }) }).lean(),
    ProductionJob.find({ ...common, ...(request.query.dc && { dcNo: rx(request.query.dc) }), ...(request.query.machine && { machineCode: rx(request.query.machine) }), ...(request.query.employee && { employeeCode: rx(request.query.employee) }), ...(request.query.status && { status: request.query.status }) }).lean(),
    PendingIssue.find({ ...common }).lean(),
    SewingDelivery.find({ ...common }).lean(),
    SewingHold.find({ ...common }).lean(),
    WarehouseStock.find({ ...common }).lean(),
  ]);
  response.json(scopeReports({ pos, inwards, outwards, plans, jobs, pending, sewing, sewingHolds, warehouse }, request.user?.role));
}

export async function getTraceability(request, response) {
  const value = request.params.value;
  const match = rx(value);
  const [pos, inwards, outwards, plans, jobs, pending, sewing] = await Promise.all([
    PurchaseOrder.find({ $or: [{ poNo: match }, { itemCode: match }, { indentNo: match }] }).lean(),
    Inward.find({ $or: [{ inwardNo: match }, { poNo: match }, { itemCode: match }, { indentNo: match }] }).lean(),
    Outward.find({ $or: [{ outwardNo: match }, { dcNo: match }, { inwardReference: match }, { itemCode: match }, { colour: match }] }).lean(),
    ProductionPlan.find({ $or: [{ planNo: match }, { dcNo: match }, { itemCode: match }] }).lean(),
    ProductionJob.find({ $or: [{ jobNo: match }, { dcNo: match }, { outwardNo: match }, { itemCode: match }, { colour: match }] }).lean(),
    PendingIssue.find({ $or: [{ issueNo: match }, { outwardNo: match }, { itemCode: match }, { colour: match }] }).lean(),
    SewingDelivery.find({ $or: [{ deliveryNo: match }, { outwardNo: match }, { colour: match }] }).lean(),
  ]);
  response.json(scopeReports({ pos, inwards, outwards, plans, jobs, pending, sewing }, request.user?.role));
}
