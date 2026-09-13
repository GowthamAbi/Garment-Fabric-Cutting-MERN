import crypto from "node:crypto";
import FabricOutward from "../models/FabricOutward.js";
import FabricAllocation from "../models/FabricAllocation.js";
import FabricBundle from "../models/FabricBundle.js";
import CuttingPlan from "../models/CuttingPlan.js";
import { getNextFabricOutwardNo } from "../services/outwardSequence.js";
import { allocateByPriorityAndAge } from "../services/fabricCalculations.js";

const scope = (request) => ({ companyId: request.tenant.companyId, factoryId: request.tenant.factoryId });

export async function listOutwards(request, response) {
  response.json(await FabricOutward.find(scope(request)).sort({ outwardNo: -1 }));
}

export async function getOutward(request, response) {
  const record = await FabricOutward.findOne({ ...scope(request), outwardNo: Number(request.params.outwardNo) });
  if (!record) throw Object.assign(new Error("Outward DC not found"), { statusCode: 404 });
  response.json(record);
}

export async function createOutward(request, response) {
  const outwardNo = await getNextFabricOutwardNo({ ...scope(request), updatedBy: request.tenant.updatedBy });
  const colours = request.body.colours || [];
  const totalPlannedPieces = colours.reduce((sum, colour) => sum + colour.sizes.reduce((sizeSum, row) => sizeSum + Number(row.plannedPieces || 0), 0), 0);
  const totalWantedCuttingWeightKg = colours.reduce((sum, colour) => sum + colour.sizes.reduce((sizeSum, row) => sizeSum + Number(row.wantedCuttingWeightKg || 0), 0), 0);
  const record = await FabricOutward.create({ ...request.body, ...scope(request), outwardNo, qrToken: crypto.randomUUID(), totalPlannedPieces, totalWantedCuttingWeightKg, updatedBy: request.tenant.updatedBy, status: "WAITING_STOCK" });
  response.status(201).json(record);
}

export async function allocateOutward(request, response) {
  const outward = await FabricOutward.findOne({ ...scope(request), outwardNo: Number(request.params.outwardNo) });
  if (!outward) throw Object.assign(new Error("Outward DC not found"), { statusCode: 404 });
  const bundles = await FabricBundle.find({ ...scope(request), fabricCode: outward.fabricCode, availableWeightKg: { $gt: 0 }, status: { $in: ["AVAILABLE", "PART_ISSUED"] } }).sort({ createdAt: 1 }).lean();
  const requirements = outward.colours.flatMap((colour) => colour.sizes.map((size) => ({ fabricCode: outward.fabricCode, colour: colour.colour, size: size.size, priority: colour.priority, wantedWeightKg: size.wantedCuttingWeightKg })));
  const results = allocateByPriorityAndAge(requirements, bundles.map((bundle) => ({ ...bundle, inwardDate: bundle.createdAt })));
  const allocations = [];
  for (const result of results) for (const line of result.allocations) {
    const bundle = await FabricBundle.findOne({ ...scope(request), bundleNo: line.bundleNo });
    if (!bundle || bundle.availableWeightKg < line.issuedWeightKg) throw Object.assign(new Error(`${line.bundleNo} stock changed; scan again`), { statusCode: 409 });
    bundle.availableWeightKg -= line.issuedWeightKg;
    bundle.status = bundle.availableWeightKg > 0 ? "PART_ISSUED" : "ISSUED";
    bundle.currentLocation = "CUTTING";
    await bundle.save();
    allocations.push(await FabricAllocation.create({ ...scope(request), allocationNo: `FA-${crypto.randomUUID().slice(0, 8)}`, outwardNo: outward.outwardNo, poNo: outward.poNo, itemCode: outward.itemCode, style: outward.style, colour: result.colour, size: result.size, inwardNo: line.inwardNo, bundleNo: line.bundleNo, lotNo: line.lotNo, stockAgeDate: bundle.createdAt, priority: result.priority, purpose: "CUTTING", wantedWeightKg: result.wantedWeightKg, issuedWeightKg: line.issuedWeightKg, issuedBy: request.tenant.updatedBy, updatedBy: request.tenant.updatedBy }));
  }
  outward.totalIssuedCuttingWeightKg = results.reduce((sum, row) => sum + row.allocatedWeightKg, 0);
  outward.status = results.some((row) => row.shortageWeightKg > 0) ? "PART_ISSUED" : "READY";
  await outward.save();
  if (!await CuttingPlan.exists({ ...scope(request), outwardNo: outward.outwardNo })) {
    const last = await CuttingPlan.findOne(scope(request)).sort({ queuePosition: -1 });
    await CuttingPlan.create({ ...scope(request), planNo: `CP-${outward.outwardNo}`, outwardNo: outward.outwardNo, queuePosition: Number(last?.queuePosition || 0) + 1, priority: outward.queuePriority, requiredDate: outward.requiredDate, itemCode: outward.itemCode, itemName: outward.itemName, style: outward.style, colour: outward.colours.map((x) => x.colour).join(","), plannedPieces: outward.totalPlannedPieces, updatedBy: request.tenant.updatedBy });
  }
  response.json({ outward, allocations, requirements: results });
}
