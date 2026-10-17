import Machine from "../models/Machine.js";
import FabricCutPlan from "../models/FabricCutPlan.js";
import FabricCutActual from "../models/FabricCutActual.js";
import CuttingMachinePlan from "../models/CuttingMachinePlan.js";
import ApiError from "../utils/ApiError.js";
import {cuttingOverviewFilter, cuttingOverviewRows, cuttingOverviewSummary} from "../erp/cuttingOverviewPolicy.js";

const code = value => String(value || "").trim().toUpperCase();
const cuttingTypes = {CUTTER: "Cutter", SPREADER: "Spreader"};
const machineFilter = {machineType: {$in: [/^cutter$/i, /^spreader$/i]}};

export function validateCuttingMachine(body = {}) {
  const machineCode = code(body.machineCode);
  const machineName = String(body.machineName || "").trim();
  const machineType = cuttingTypes[code(body.machineType)];
  const capacityPerHour = Number(body.capacityPerHour || 0);
  if (!/^[A-Z0-9_-]{2,35}$/.test(machineCode)) throw new ApiError(400, "Machine Code: 2-35 letters/numbers");
  if (!machineType || !machineName || machineName.length > 120)
    throw new ApiError(400, "Select Spreader/Cutter and enter Machine Name (max 120)");
  if (!Number.isFinite(capacityPerHour) || capacityPerHour < 0 || capacityPerHour > 100000)
    throw new ApiError(400, "Invalid machine capacity");
  return {machineCode, machineName, machineType, capacityPerHour, section:"Cutting", active:body.active !== false};
}

export async function listCuttingMachines(_req,res) {
  res.json(await Machine.find(machineFilter).sort({machineType:1,machineCode:1}).limit(500).lean());
}

export async function saveCuttingMachine(req,res) {
  const input = validateCuttingMachine(req.body);
  if (req.params.id) {
    const old = await Machine.findById(req.params.id);
    if (!old || !cuttingTypes[code(old.machineType)]) throw new ApiError(404, "Cutting machine not found");
    if (old.machineCode !== input.machineCode) throw new ApiError(409, "Machine Code cannot be changed after creation");
    Object.assign(old,input);
    await old.save();
    return res.json(old);
  }
  if (await Machine.exists({machineCode:input.machineCode})) throw new ApiError(409,"Machine Code already exists");
  const saved = await Machine.create(input);
  res.status(201).json(saved);
}

export async function cuttingTargetActual(req,res) {
  const filter = cuttingOverviewFilter(req.query);
  // Legacy Cutting records do not always include factoryId. The route invokes
  // the single-factory guard before querying these historical records.
  const plans = await FabricCutPlan.find(filter).sort({createdAt:-1}).limit(250).lean();
  const planNos = plans.map(row => row.planNo);
  if (!planNos.length) return res.json({summary:cuttingOverviewSummary([]),items:[],limit:250});
  const [actuals,assignments] = await Promise.all([
    FabricCutActual.find({planNo:{$in:planNos}}).limit(250).lean(),
    CuttingMachinePlan.find({planNo:{$in:planNos}}).sort({createdAt:-1}).limit(1000).lean(),
  ]);
  const rows = cuttingOverviewRows(plans, actuals, assignments);
  res.json({summary:cuttingOverviewSummary(rows),items:rows,limit:250});
}
