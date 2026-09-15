import FabricMaster from "../models/FabricMaster.js";
import FabricInwardLot from "../models/FabricInwardLot.js";
import FabricCutPlan from "../models/FabricCutPlan.js";
import FabricCutActual from "../models/FabricCutActual.js";
import FabricWaste from "../models/FabricWaste.js";
import FabricBundleStock from "../models/FabricBundleStock.js";
import GarmentBom from "../models/GarmentBom.js";
import ApiError from "../utils/ApiError.js";
import { generateReferenceNo } from "../utils/generateReferenceNo.js";
import {
  calculateElasticMtr,
  calculateWantedWeight,
  calculateWaste,
  distributePieces,
} from "../services/fabricFlowCalculations.js";
import crypto from "node:crypto";
const upper = (v) =>
    String(v || "")
      .trim()
      .toUpperCase(),
  num = (v) => Number(v || 0);

export async function listFabricMasters(req, res) {
  const q = req.query.search
    ? {
        $or: ["fabricCode", "fabricGroup", "itemCode", "itemName"].map((k) => ({
          [k]: { $regex: req.query.search, $options: "i" },
        })),
      }
    : {};
  res.json(await FabricMaster.find(q).sort({ fabricGroup: 1, itemName: 1 }));
}
export async function getFabricMaster(req, res) {
  const v = upper(req.params.code),
    row = await FabricMaster.findOne({
      $or: [{ fabricCode: v }, { itemCode: v }],
    });
  if (!row) throw new ApiError(404, "Fabric master not found");
  res.json(row);
}
export async function saveFabricMaster(req, res) {
  const data = {
    ...req.body,
    fabricCode: upper(req.body.fabricCode),
    fabricGroup: upper(req.body.fabricGroup),
    itemCode: upper(req.body.itemCode),
    createdBy: req.user.name,
  };
  const row = await FabricMaster.findOneAndUpdate(
    { fabricCode: data.fabricCode, itemCode: data.itemCode },
    data,
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  res.status(201).json(row);
}
function inwardTotals(colours) {
  return colours.map((c) => {
    const details = (c.details || []).map((d) => ({
      dia: String(d.dia || "").trim(),
      rollCount: num(d.rollCount),
      weightKg: num(d.weightKg),
    }));
    const weight = details.reduce((s, x) => s + x.weightKg, 0);
    return {
      colour: upper(c.colour),
      details,
      totalRolls: details.reduce((s, x) => s + x.rollCount, 0),
      totalWeightKg: Number(weight.toFixed(3)),
      balanceWeightKg: Number(weight.toFixed(3)),
    };
  });
}

async function createInwardBundles({ inwardNo, master, colours, createdBy }) {
  for (const colour of colours) {
    for (const line of colour.details) {
      const average = Number((line.weightKg / line.rollCount).toFixed(3));
      let assigned = 0;
      for (let index = 1; index <= line.rollCount; index += 1) {
        const rollWeight =
          index === line.rollCount
            ? Number((line.weightKg - assigned).toFixed(3))
            : average;
        assigned = Number((assigned + rollWeight).toFixed(3));
        const bundleNo =
          "FBR-" +
          crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
        await FabricBundleStock.create({
          bundleNo,
          qrToken: "FABRIC_BUNDLE:" + bundleNo,
          inwardNo,
          fabricCode: master.fabricCode,
          fabricGroup: master.fabricGroup,
          colour: colour.colour,
          dia: line.dia,
          originalWeightKg: rollWeight,
          balanceWeightKg: rollWeight,
          provisionalWeight: line.rollCount > 1,
          createdBy,
        });
      }
    }
  }
}
export async function listInwards(req, res) {
  const f = {};
  if (req.query.inwardNo) f.inwardNo = upper(req.query.inwardNo);
  if (req.query.fabricCode) f.fabricCode = upper(req.query.fabricCode);
  res.json(await FabricInwardLot.find(f).sort({ inwardDate: -1 }));
}
export async function getInward(req, res) {
  const row = await FabricInwardLot.findOne({ inwardNo: upper(req.params.no) });
  if (!row) throw new ApiError(404, "Fabric inward not found");
  res.json(row);
}
export async function saveInward(req, res) {
  const master = await FabricMaster.findOne({
    fabricCode: upper(req.body.fabricCode),
  });
  if (!master) throw new ApiError(404, "Create Fabric Master first");
  const colours = inwardTotals(req.body.colours);
  if (!colours.length || colours.some((c) => !c.colour || !c.details.length))
    throw new ApiError(400, "Every colour needs Dia, Roll and Weight details");
  const inwardNo = upper(req.body.inwardNo) || generateReferenceNo("FIN");
  const data = {
    inwardNo,
    sampleInwardNo: upper(req.body.sampleInwardNo),
    fabricCode: master.fabricCode,
    fabricGroup: master.fabricGroup,
    itemCode: master.itemCode,
    itemName: master.itemName,
    compactingCode: master.compactingCode,
    compactingName: master.compactingName,
    dyeingCode: master.dyeingCode,
    dyeingName: master.dyeingName,
    supplier: req.body.supplier,
    dcNo: upper(req.body.dcNo),
    lotNo: upper(req.body.lotNo),
    inwardDate: req.body.inwardDate,
    colours,
    totalRolls: colours.reduce((s, c) => s + c.totalRolls, 0),
    totalWeightKg: Number(
      colours.reduce((s, c) => s + c.totalWeightKg, 0).toFixed(3),
    ),
    createdBy: req.user.name,
  };
  let bundlesToReplace = "";
  if (req.params.id) {
    const existing = await FabricInwardLot.findById(req.params.id);
    if (!existing) throw new ApiError(404, "Inward not found");
    const consumed = await FabricBundleStock.exists({
      inwardNo: existing.inwardNo,
      $expr: { $lt: ["$balanceWeightKg", "$originalWeightKg"] },
    });
    if (consumed)
      throw new ApiError(
        409,
        "Issued fabric inward cannot be edited. Use an adjustment entry.",
      );
    data.inwardNo = existing.inwardNo;
    bundlesToReplace = existing.inwardNo;
  }
  const row = req.params.id
    ? await FabricInwardLot.findByIdAndUpdate(req.params.id, data, {
        new: true,
        runValidators: true,
      })
    : await FabricInwardLot.create(data);
  if (!row) throw new ApiError(404, "Inward not found");
  if (bundlesToReplace)
    await FabricBundleStock.deleteMany({ inwardNo: bundlesToReplace });
  await createInwardBundles({
    inwardNo: row.inwardNo,
    master,
    colours,
    createdBy: req.user.name,
  });
  res.status(req.params.id ? 200 : 201).json(row);
}
export async function listInwardBundles(req, res) {
  res.json(
    await FabricBundleStock.find({ inwardNo: upper(req.params.no) }).sort({
      colour: 1,
      dia: 1,
      createdAt: 1,
    }),
  );
}
export async function createPlan(req, res) {
  const itemName = String(req.body.itemName || "").trim(),
    style = upper(req.body.style),
    bom = await GarmentBom.findOne({
      itemName,
      style,
      status: "APPROVED",
    }).sort({ updatedAt: -1 });
  if (!bom) throw new ApiError(404, "Approved BOM not found for Item + Style");
  const master = await FabricMaster.findOne({ itemName });
  if (!master)
    throw new ApiError(404, "Fabric Master mapping not found for this item");
  const requestedColours = Math.max(1, num(req.body.numberOfColours)),
    names = bom.colours.slice(0, requestedColours).map((c) => upper(c.name));
  if (names.length < requestedColours)
    throw new ApiError(400, "BOM does not contain requested number of colours");
  const input = (req.body.sizes || []).map((x) => ({
    size: upper(x.size),
    pcs: num(x.pcs),
  }));
  if (!input.length) throw new ApiError(400, "Add size and PCS");
  if (input.some((x) => !x.size || !Number.isInteger(x.pcs) || x.pcs <= 0))
    throw new ApiError(400, "Every size needs a whole PCS value above zero");
  if (new Set(input.map((x) => x.size)).size !== input.length)
    throw new ApiError(400, "Duplicate sizes are not allowed in one plan");
  const colours = names.map((colour, ci) => {
    const sizes = input.map((line) => {
      const m = bom.sizes.find((x) => upper(x.size) === line.size);
      if (!m)
        throw new ApiError(
          400,
          `BOM measurement missing for size ${line.size}`,
        );
      const plannedPcs = distributePieces(line.pcs, names.length)[ci],
        wt = num(m.cuttingKg);
      return {
        size: line.size,
        plannedPcs,
        cuttingWeightPerPieceKg: wt,
        wantedWeightKg: calculateWantedWeight(plannedPcs, wt),
      };
    });
    return {
      colour,
      sizes,
      totalPcs: sizes.reduce((s, x) => s + x.plannedPcs, 0),
      wantedWeightKg: Number(
        sizes.reduce((s, x) => s + x.wantedWeightKg, 0).toFixed(3),
      ),
    };
  });
  const planNo = upper(req.body.planNo) || generateReferenceNo("FCP"),
    dcNo = upper(req.body.dcNo) || planNo,
    row = await FabricCutPlan.create({
      planNo,
      dcNo,
      itemCode: master.itemCode,
      itemName,
      style,
      bomNo: bom.bomNo,
      fabricCode: master.fabricCode,
      fabricGroup: master.fabricGroup,
      numberOfColours: names.length,
      colours,
      totalPlannedPcs: input.reduce((s, x) => s + x.pcs, 0),
      totalWantedWeightKg: Number(
        colours.reduce((s, x) => s + x.wantedWeightKg, 0).toFixed(3),
      ),
      createdBy: req.user.name,
    });
  res.status(201).json(row);
}
export async function listPlans(req, res) {
  const f = {};
  if (req.query.planNo) f.planNo = upper(req.query.planNo);
  if (req.query.dcNo) f.dcNo = upper(req.query.dcNo);
  res.json(await FabricCutPlan.find(f).sort({ createdAt: -1 }));
}
export async function getPlan(req, res) {
  const no = upper(req.params.no),
    row = await FabricCutPlan.findOne({ $or: [{ planNo: no }, { dcNo: no }] });
  if (!row) throw new ApiError(404, "Plan / DC not found");
  res.json(row);
}
export async function issueFabric(req, res) {
  const plan = await FabricCutPlan.findOne({ planNo: upper(req.params.no) }),
    inward = await FabricInwardLot.findOne({
      inwardNo: upper(req.body.inwardNo),
    });
  if (!plan || !inward) throw new ApiError(404, "Plan or Inward not found");
  const colour = upper(req.body.colour),
    weight = num(req.body.weightKg),
    line = inward.colours.find((c) => upper(c.colour) === colour);
  if (!line || line.balanceWeightKg < weight || weight <= 0)
    throw new ApiError(409, "Selected colour has insufficient inward balance");
  const bundles = await FabricBundleStock.find({
    inwardNo: inward.inwardNo,
    colour,
    balanceWeightKg: { $gt: 0 },
    status: { $ne: "HOLD" },
  }).sort({ createdAt: 1 });
  const bundleBalance = bundles.reduce(
    (sum, bundle) => sum + bundle.balanceWeightKg,
    0,
  );
  if (bundleBalance + 0.0001 < weight)
    throw new ApiError(
      409,
      "Bundle FIFO balance is lower than requested weight",
    );
  let remaining = weight;
  for (const bundle of bundles) {
    const used = Math.min(bundle.balanceWeightKg, remaining);
    bundle.balanceWeightKg = Number((bundle.balanceWeightKg - used).toFixed(3));
    bundle.status = bundle.balanceWeightKg <= 0 ? "CONSUMED" : "PARTIAL";
    remaining = Number((remaining - used).toFixed(3));
    await bundle.save();
    if (remaining <= 0) break;
  }
  line.balanceWeightKg = Number((line.balanceWeightKg - weight).toFixed(3));
  inward.status = inward.colours.every((c) => c.balanceWeightKg <= 0)
    ? "CLOSED"
    : "PARTIAL";
  await inward.save();
  plan.allocations.push({
    inwardNo: inward.inwardNo,
    colour,
    weightKg: weight,
    issuedBy: req.user.name,
  });
  plan.issuedWeightKg = Number((plan.issuedWeightKg + weight).toFixed(3));
  plan.status =
    plan.issuedWeightKg >= plan.totalWantedWeightKg ? "READY" : "PART_ISSUED";
  await plan.save();
  res.json(plan);
}
export async function saveActual(req, res) {
  const plan = await FabricCutPlan.findOne({ planNo: upper(req.body.planNo) });
  if (!plan) throw new ApiError(404, "Plan not found");
  const lines = (req.body.lines || []).map((x) => ({
    ...x,
    colour: upper(x.colour),
    size: upper(x.size),
    actualPcs: num(x.actualPcs),
    bundleCount: num(x.bundleCount),
    bundleWeightKg: num(x.bundleWeightKg),
  }));
  const bundle = lines.reduce((s, x) => s + x.bundleWeightKg, 0),
    waste = calculateWaste(plan.issuedWeightKg, bundle);
  if (waste < 0)
    throw new ApiError(409, "Bundle weight cannot exceed issued fabric weight");
  const data = {
    actualNo: generateReferenceNo("FCA"),
    planNo: plan.planNo,
    dcNo: plan.dcNo,
    itemCode: plan.itemCode,
    itemName: plan.itemName,
    style: plan.style,
    issuedWeightKg: plan.issuedWeightKg,
    lines,
    totalActualPcs: lines.reduce((s, x) => s + x.actualPcs, 0),
    totalBundleCount: lines.reduce((s, x) => s + x.bundleCount, 0),
    totalBundleWeightKg: Number(bundle.toFixed(3)),
    wasteWeightKg: waste,
    status: req.body.status || "COMPLETED",
    remarks: req.body.remarks || "",
    createdBy: req.user.name,
  };
  const row = await FabricCutActual.findOneAndUpdate(
    { planNo: plan.planNo },
    data,
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  await FabricWaste.findOneAndUpdate(
    { planNo: plan.planNo },
    {
      wasteNo: generateReferenceNo("FW"),
      planNo: plan.planNo,
      dcNo: plan.dcNo,
      itemCode: plan.itemCode,
      wasteWeightKg: waste,
      remarks: data.remarks,
      createdBy: req.user.name,
    },
    { upsert: true, new: true },
  );
  plan.status = data.status;
  await plan.save();
  res.status(201).json(row);
}
export async function listActuals(req, res) {
  res.json(
    await FabricCutActual.find(
      req.query.planNo ? { planNo: upper(req.query.planNo) } : {},
    ).sort({ createdAt: -1 }),
  );
}
export async function elasticRequirement(req, res) {
  const no = upper(req.params.no),
    actual = await FabricCutActual.findOne({
      $or: [{ planNo: no }, { dcNo: no }],
    });
  if (!actual) throw new ApiError(404, "Cutting actual not completed");
  const bom = await GarmentBom.findOne({
    itemName: actual.itemName,
    style: upper(actual.style),
    status: "APPROVED",
  }).sort({ updatedAt: -1 });
  if (!bom) throw new ApiError(404, "Approved Elastic BOM not found");
  const lines = actual.lines.map((x) => {
    const m = bom.sizes.find((s) => upper(s.size) === upper(x.size)),
      measurement = num(m?.elasticMeasurement);
    if (!m || measurement <= 0)
      throw new ApiError(
        409,
        `Elastic measurement missing for size ${upper(x.size)}`,
      );
    return {
      colour: x.colour,
      size: x.size,
      actualPcs: x.actualPcs,
      elasticMeasurement: measurement,
      wantedMtr: calculateElasticMtr(x.actualPcs, measurement),
    };
  });
  res.json({
    planNo: actual.planNo,
    dcNo: actual.dcNo,
    itemName: actual.itemName,
    style: actual.style,
    lines,
    totalPcs: lines.reduce((s, x) => s + x.actualPcs, 0),
    totalWantedMtr: Number(
      lines.reduce((s, x) => s + x.wantedMtr, 0).toFixed(3),
    ),
  });
}
export async function listWaste(req, res) {
  res.json(await FabricWaste.find().sort({ createdAt: -1 }));
}
