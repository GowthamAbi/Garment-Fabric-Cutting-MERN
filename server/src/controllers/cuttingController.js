import crypto from "node:crypto";
import CuttingPlan from "../models/CuttingPlan.js";
import CuttingMachine from "../models/CuttingMachine.js";
import CuttingMachineRun from "../models/CuttingMachineRun.js";
import CuttingActual from "../models/CuttingActual.js";
import FoldingFabricIssue from "../models/FoldingFabricIssue.js";
import { calculateCuttingActual, calculateFoldingRequirement } from "../services/fabricCalculations.js";

const scope = (request) => ({ companyId: request.tenant.companyId, factoryId: request.tenant.factoryId });

export async function queue(request, response) {
  response.json(await CuttingPlan.find(scope(request)).sort({ priority: 1, requiredDate: 1, queuePosition: 1 }));
}

export async function machines(request, response) {
  response.json(await CuttingMachine.find(scope(request)).sort({ machineType: 1, machineCode: 1 }));
}

export async function saveMachine(request, response) {
  const record = await CuttingMachine.findOneAndUpdate(
    { ...scope(request), machineCode: request.body.machineCode },
    { ...request.body, ...scope(request), qrToken: request.body.qrToken || crypto.randomUUID(), updatedBy: request.tenant.updatedBy },
    { upsert: true, new: true, runValidators: true },
  );
  response.status(201).json(record);
}

export async function machineByQr(request, response) {
  const machine = await CuttingMachine.findOne({ ...scope(request), qrToken: request.params.qrToken });
  if (!machine) throw Object.assign(new Error("Machine QR not found"), { statusCode: 404 });
  const run = machine.currentRunNo ? await CuttingMachineRun.findOne({ ...scope(request), runNo: machine.currentRunNo }) : null;
  response.json({ machine, run });
}

export async function startMachine(request, response) {
  const machine = await CuttingMachine.findOne({ ...scope(request), qrToken: request.body.machineQrToken, active: true });
  if (!machine) throw Object.assign(new Error("Machine QR not found"), { statusCode: 404 });
  if (machine.status !== "AVAILABLE") throw Object.assign(new Error(`Machine is already ${machine.status} for DC ${machine.currentOutwardNo}`), { statusCode: 409 });
  const plan = await CuttingPlan.findOne({ ...scope(request), outwardNo: Number(request.body.outwardNo) });
  if (!plan) throw Object.assign(new Error("Cutting plan not found"), { statusCode: 404 });
  if (machine.machineType === "CUTTER" && plan.spreaderStatus !== "COMPLETED" && !request.body.adminOverrideReason) throw Object.assign(new Error("Spreader must complete before cutter starts"), { statusCode: 409 });
  const runNo = `RUN-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date();
  const run = await CuttingMachineRun.create({ ...scope(request), runNo, planNo: plan.planNo, outwardNo: plan.outwardNo, machineCode: machine.machineCode, machineType: machine.machineType, itemCode: plan.itemCode, style: plan.style, colour: plan.colour, plannedPieces: plan.plannedPieces, startedAt: now, timeline: [{ eventType: "RUNNING", startedAt: now }], operatorCode: request.body.operatorCode || "", updatedBy: request.tenant.updatedBy });
  machine.status = "RUNNING";
  machine.currentOutwardNo = plan.outwardNo;
  machine.currentRunNo = runNo;
  await machine.save();
  if (machine.machineType === "SPREADER") plan.spreaderStatus = "RUNNING";
  else plan.cutterStatus = "RUNNING";
  plan.overallStatus = machine.machineType === "SPREADER" ? "SPREADING" : "CUTTING";
  await plan.save();
  response.status(201).json(run);
}

export async function stopMachine(request, response) {
  const run = await CuttingMachineRun.findOne({ ...scope(request), runNo: request.params.runNo });
  if (!run) throw Object.assign(new Error("Machine run not found"), { statusCode: 404 });
  const allowed = ["BREAKDOWN", "COLOUR_CHANGE", "OTHER_ISSUE", "MAINTENANCE", "TEMPORARY_STOP", "COMPLETED"];
  if (!allowed.includes(request.body.action)) throw Object.assign(new Error("Valid stop action is required"), { statusCode: 400 });
  const now = new Date();
  const active = [...run.timeline].reverse().find((event) => !event.endedAt);
  if (active) active.endedAt = now;
  run.status = request.body.action === "COMPLETED" ? "COMPLETED" : request.body.action === "TEMPORARY_STOP" ? "STOPPED" : request.body.action;
  run.actualPieces = Number(request.body.actualPieces || run.actualPieces);
  if (run.status === "COMPLETED") run.completedAt = now;
  else run.timeline.push({ eventType: request.body.action, startedAt: now, reason: request.body.reason || "", remarks: request.body.remarks || "" });
  await run.save();
  const machine = await CuttingMachine.findOne({ ...scope(request), machineCode: run.machineCode });
  machine.status = run.status === "COMPLETED" ? "AVAILABLE" : run.status;
  if (run.status === "COMPLETED") { machine.currentOutwardNo = null; machine.currentRunNo = ""; }
  await machine.save();
  const plan = await CuttingPlan.findOne({ ...scope(request), planNo: run.planNo });
  if (run.status === "COMPLETED") {
    if (run.machineType === "SPREADER") { plan.spreaderStatus = "COMPLETED"; plan.cutterStatus = "READY"; }
    else { plan.cutterStatus = "COMPLETED"; plan.overallStatus = "COMPLETED"; }
  } else if (run.machineType === "SPREADER") plan.spreaderStatus = "STOPPED";
  else plan.cutterStatus = "STOPPED";
  await plan.save();
  response.json({ run, machine, plan });
}

export async function resumeMachine(request, response) {
  const run = await CuttingMachineRun.findOne({ ...scope(request), runNo: request.params.runNo });
  if (!run || run.status === "COMPLETED") throw Object.assign(new Error("Stopped machine run not found"), { statusCode: 404 });
  const now = new Date();
  const active = [...run.timeline].reverse().find((event) => !event.endedAt);
  if (active) active.endedAt = now;
  run.timeline.push({ eventType: "RUNNING", startedAt: now });
  run.status = "RUNNING";
  await run.save();
  await CuttingMachine.findOneAndUpdate({ ...scope(request), machineCode: run.machineCode }, { status: "RUNNING" });
  response.json(run);
}

export async function machineTimeline(request, response) {
  const days = Number(request.query.days || 1);
  const from = new Date();
  from.setDate(from.getDate() - Math.min(days, 7));
  response.json(await CuttingMachineRun.find({ ...scope(request), machineCode: request.params.machineCode, startedAt: { $gte: from } }).sort({ startedAt: 1 }));
}

export async function saveCuttingActual(request, response) {
  const sizes = (request.body.sizes || []).map((row) => ({ ...row, wantedFoldingWeightKg: calculateFoldingRequirement(row.actualPieces, row.foldingWeightPerPieceKg) }));
  const totalPlannedPieces = sizes.reduce((sum, row) => sum + Number(row.plannedPieces), 0);
  const totalActualPieces = sizes.reduce((sum, row) => sum + Number(row.actualPieces), 0);
  const calculated = calculateCuttingActual({ issuedWeightKg: request.body.issuedCuttingWeightKg, cutBundleWeightKg: request.body.cutBundleWeightKg, returnedWeightKg: request.body.returnedFabricWeightKg, plannedPieces: totalPlannedPieces, actualPieces: totalActualPieces });
  const cuttingActualNo = `CA-${request.body.outwardNo}-${crypto.randomUUID().slice(0, 5)}`;
  const actual = await CuttingActual.create({ ...request.body, ...scope(request), ...calculated, sizes, cuttingActualNo, totalPlannedPieces, totalActualPieces, totalWantedFoldingWeightKg: sizes.reduce((sum, row) => sum + row.wantedFoldingWeightKg, 0), updatedBy: request.tenant.updatedBy });
  const folding = await FoldingFabricIssue.create({ ...scope(request), foldingIssueNo: `FD-${request.body.outwardNo}-${crypto.randomUUID().slice(0, 5)}`, outwardNo: request.body.outwardNo, cuttingActualNo, itemCode: request.body.itemCode, itemName: request.body.itemName, style: request.body.style, colour: request.body.colour, sizes: sizes.map((row) => ({ size: row.size, actualCutPieces: row.actualPieces, foldingWeightPerPieceKg: row.foldingWeightPerPieceKg, wantedWeightKg: row.wantedFoldingWeightKg })), wantedWeightKg: sizes.reduce((sum, row) => sum + row.wantedFoldingWeightKg, 0), shortageWeightKg: sizes.reduce((sum, row) => sum + row.wantedFoldingWeightKg, 0), updatedBy: request.tenant.updatedBy });
  response.status(201).json({ actual, folding });
}

export async function foldingIssues(request, response) {
  response.json(await FoldingFabricIssue.find(scope(request)).sort({ createdAt: -1 }));
}
