import crypto from "node:crypto";
import FabricInward from "../models/FabricInward.js";
import FabricBundle from "../models/FabricBundle.js";

const scope = (request) => ({ companyId: request.tenant.companyId, factoryId: request.tenant.factoryId });

export async function listInwards(request, response) {
  response.json(await FabricInward.find(scope(request)).sort({ inwardDate: -1 }));
}

export async function listBundles(request, response) {
  const filter = scope(request);
  if (request.query.inwardNo) filter.inwardNo = request.query.inwardNo.toUpperCase();
  if (request.query.available === "true") filter.availableWeightKg = { $gt: 0 };
  response.json(await FabricBundle.find(filter).sort({ inwardNo: 1, bundleNo: 1 }));
}

export async function getBundleByQr(request, response) {
  const record = await FabricBundle.findOne({ ...scope(request), qrToken: request.params.qrToken });
  if (!record) throw Object.assign(new Error("Fabric bundle QR not found"), { statusCode: 404 });
  response.json(record);
}

export async function createInward(request, response) {
  const input = request.body;
  const count = Number(input.rollCount);
  const declaredWeightKg = Number(input.declaredWeightKg);
  const weights = (input.bundleWeights || []).map(Number);
  if (!Number.isInteger(count) || count < 1 || declaredWeightKg <= 0) throw Object.assign(new Error("Valid roll count and total weight are required"), { statusCode: 400 });
  if (weights.length && weights.length !== count) throw Object.assign(new Error("Bundle weight count must equal roll count"), { statusCode: 400 });
  const average = declaredWeightKg / count;
  const verified = weights.reduce((sum, value) => sum + value, 0);
  if (weights.length && Math.abs(verified - declaredWeightKg) > 0.01) throw Object.assign(new Error("Bundle total does not match declared inward weight"), { statusCode: 400 });

  const inwardNo = String(input.inwardNo).toUpperCase();
  const common = { ...scope(request), inwardNo, lotNo: input.lotNo, fabricCode: input.fabricCode, fabricGroup: input.fabricGroup, fabricType: input.fabricType, colour: input.colour, setNo: input.setNo, dyeingNo: input.dyeingNo, compactingNo: input.compactingNo, compactorName: input.compactorName, dia: input.dia, gsm: input.gsm, updatedBy: request.tenant.updatedBy };
  const inward = await FabricInward.create({ ...input, ...common, verifiedBundleWeightKg: verified, availableWeightKg: declaredWeightKg, entryMode: weights.length ? "BUNDLE_WISE" : "TOTAL_ONLY", status: weights.length ? "VERIFIED" : "WEIGHT_PENDING" });
  const bundles = Array.from({ length: count }, (_, index) => {
    const weight = weights[index] ?? average;
    return { ...common, bundleNo: `${inwardNo}-B${String(index + 1).padStart(3, "0")}`, qrToken: crypto.randomUUID(), bundleType: index < Number(input.sampleRollCount || 0) ? "SAMPLE" : "MAIN", weightSource: weights.length ? "VERIFIED" : "AVERAGE", originalWeightKg: Number(weight.toFixed(3)), availableWeightKg: Number(weight.toFixed(3)), status: weights.length ? "AVAILABLE" : "WEIGHT_PENDING", currentLocation: "FABRIC_STORE" };
  });
  await FabricBundle.insertMany(bundles);
  response.status(201).json({ inward, bundles });
}

export async function verifyBundleWeight(request, response) {
  const bundle = await FabricBundle.findOne({ ...scope(request), bundleNo: request.params.bundleNo });
  if (!bundle) throw Object.assign(new Error("Bundle not found"), { statusCode: 404 });
  const alreadyIssued = bundle.originalWeightKg - bundle.availableWeightKg;
  const newWeight = Number(request.body.weightKg);
  if (newWeight < alreadyIssued) throw Object.assign(new Error("Verified weight cannot be lower than already issued weight"), { statusCode: 409 });
  bundle.originalWeightKg = newWeight;
  bundle.availableWeightKg = newWeight - alreadyIssued;
  bundle.weightSource = "VERIFIED";
  bundle.status = bundle.availableWeightKg > 0 ? "AVAILABLE" : "ISSUED";
  bundle.updatedBy = request.tenant.updatedBy;
  await bundle.save();
  response.json(bundle);
}
