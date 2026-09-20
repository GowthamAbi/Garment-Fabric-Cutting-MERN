import FabricMaster from "../models/FabricMaster.js";
import FabricInwardLot from "../models/FabricInwardLot.js";
import FabricCutPlan from "../models/FabricCutPlan.js";
import FabricCutActual from "../models/FabricCutActual.js";
import FabricWaste from "../models/FabricWaste.js";
import FabricBundleStock from "../models/FabricBundleStock.js";
import GarmentItemMaster from "../models/GarmentItemMaster.js";
import ProcessMaster from "../models/ProcessMaster.js";
import Sequence from "../models/Sequence.js";
import ApiError from "../utils/ApiError.js";
import { generateReferenceNo } from "../utils/generateReferenceNo.js";
import {
  calculateElasticMtr,
  calculateWantedWeight,
  calculateWaste,
  distributePieces,
  allocatePiecesByStock,
  resolveActualAvailableWeight,
} from "../services/fabricFlowCalculations.js";
import crypto from "node:crypto";
const upper = (v) =>
    String(v || "")
      .trim()
      .toUpperCase(),
  num = (v) => Number(v || 0);

function inwardTotals(colours) {
  return colours.map((c) => {
    const details = (c.details || []).map((d) => ({
      dia: String(d.dia || "").trim(),
      sampleRolls: num(d.sampleRolls),
      sampleWeightKg: num(d.sampleWeightKg),
      lotRolls: num(d.lotRolls),
      lotWeightKg: num(d.lotWeightKg),
      totalRolls: num(d.sampleRolls) + num(d.lotRolls),
      totalWeightKg: Number(
        (num(d.sampleWeightKg) + num(d.lotWeightKg)).toFixed(3),
      ),
    }));
    const totalSampleRolls = details.reduce((s, x) => s + x.sampleRolls, 0);
    const totalSampleWeightKg = details.reduce(
      (s, x) => s + x.sampleWeightKg,
      0,
    );
    const totalLotRolls = details.reduce((s, x) => s + x.lotRolls, 0);
    const totalLotWeightKg = details.reduce((s, x) => s + x.lotWeightKg, 0);
    return {
      colour: upper(c.colour),
      details,
      totalRolls: totalSampleRolls + totalLotRolls,
      totalWeightKg: Number(
        (totalSampleWeightKg + totalLotWeightKg).toFixed(3),
      ),
      balanceWeightKg: Number(
        (totalSampleWeightKg + totalLotWeightKg).toFixed(3),
      ),
    };
  });
}

async function createInwardBundles({
  inwardNo,
  master,
  colours,
  compactingName,
  dyeingName,
  createdBy,
}) {
  let rollNo = 0;
  for (const colour of colours) {
    for (const line of colour.details) {
      for (const [inwardType, count, weight] of [
        ["SAMPLE", line.sampleRolls, line.sampleWeightKg],
        ["LOT", line.lotRolls, line.lotWeightKg],
      ]) {
        if (!count) continue;
        const average = Number((weight / count).toFixed(3));
        let assigned = 0;
        for (let index = 1; index <= count; index += 1) {
          rollNo += 1;
          const rollWeight =
            index === count ? Number((weight - assigned).toFixed(3)) : average;
          assigned = Number((assigned + rollWeight).toFixed(3));
          const bundleNo =
            "FBR-" +
            crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
          const qrDetails = {
            inwardNo,
            inwardType,
            fabricGroup: master.fabricGroup,
            rollNo,
            averageWeightKg: rollWeight,
            colour: colour.colour,
            dyeingName,
            compactingName,
          };
          await FabricBundleStock.create({
            bundleNo,
            qrToken: JSON.stringify(qrDetails),
            rollNo,
            inwardType,
            inwardNo,
            fabricCode: master.fabricCode,
            fabricName: master.fabricName,
            fabricGroup: master.fabricGroup,
            colour: colour.colour,
            dia: line.dia,
            dyeingName,
            compactingName,
            averageWeightKg: rollWeight,
            originalWeightKg: rollWeight,
            balanceWeightKg: rollWeight,
            provisionalWeight: count > 1,
            createdBy,
          });
        }
      }
    }
  }
}
export async function listInwards(req, res) {
  const f = {};
  if (req.query.inwardNo) f.inwardNo = upper(req.query.inwardNo);
  if (req.query.fabricCode) f.fabricCode = upper(req.query.fabricCode);
  if (req.query.dcNo) f.dcNo = upper(req.query.dcNo);
  if (req.query.lotDcNo) f.lotDcNo = upper(req.query.lotDcNo);
  if (req.query.inwardType) f.inwardType = upper(req.query.inwardType);
  if (req.query.from || req.query.to) {
    f.inwardDate = {};
    if (req.query.from) f.inwardDate.$gte = new Date(req.query.from);
    if (req.query.to) {
      const end = new Date(req.query.to);
      end.setHours(23, 59, 59, 999);
      f.inwardDate.$lte = end;
    }
  }
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
  if (
    !colours.length ||
    colours.some(
      (c) =>
        !c.colour ||
        !c.details.length ||
        c.details.some(
          (d) => !d.dia || d.totalRolls <= 0 || d.totalWeightKg <= 0,
        ),
    )
  )
    throw new ApiError(
      400,
      "Every colour needs valid Dia, Roll and Weight details",
    );
  const compacting = req.body.compactingCode
    ? await ProcessMaster.findOne({
        processType: "COMPACTING",
        code: upper(req.body.compactingCode),
      })
    : null;
  const dyeing = req.body.dyeingCode
    ? await ProcessMaster.findOne({
        processType: "DYEING",
        code: upper(req.body.dyeingCode),
      })
    : null;
  if (req.body.compactingCode && !compacting)
    throw new ApiError(404, "Compacting code not found");
  if (req.body.dyeingCode && !dyeing)
    throw new ApiError(404, "Dyeing code not found");
  const inwardNo = upper(req.body.inwardNo) || generateReferenceNo("FIN");
  const data = {
    inwardNo,
    inwardType: upper(req.body.inwardType || "LOT"),
    fabricCode: master.fabricCode,
    fabricName: master.fabricName,
    fabricGroup: master.fabricGroup,
    compactingCode: compacting?.code || "",
    compactingName: compacting?.name || "",
    dyeingCode: dyeing?.code || "",
    dyeingName: dyeing?.name || "",
    dcNo: upper(req.body.dcNo),
    lotDcNo: upper(req.body.lotDcNo),
    lotNo: upper(req.body.lotNo || "NA"),
    inwardDate: req.body.inwardDate,
    colours,
    totalRolls: colours.reduce((s, c) => s + c.totalRolls, 0),
    totalWeightKg: Number(
      colours.reduce((s, c) => s + c.totalWeightKg, 0).toFixed(3),
    ),
    totalSampleRolls: colours.reduce(
      (sum, colour) =>
        sum + colour.details.reduce((s, line) => s + line.sampleRolls, 0),
      0,
    ),
    totalSampleWeightKg: Number(
      colours
        .reduce(
          (sum, colour) =>
            sum +
            colour.details.reduce((s, line) => s + line.sampleWeightKg, 0),
          0,
        )
        .toFixed(3),
    ),
    totalLotRolls: colours.reduce(
      (sum, colour) =>
        sum + colour.details.reduce((s, line) => s + line.lotRolls, 0),
      0,
    ),
    totalLotWeightKg: Number(
      colours
        .reduce(
          (sum, colour) =>
            sum + colour.details.reduce((s, line) => s + line.lotWeightKg, 0),
          0,
        )
        .toFixed(3),
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
    compactingName: data.compactingName,
    dyeingName: data.dyeingName,
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

async function nextPlanNo(user) {
  const tenant = {
    companyId: user.companyId,
    factoryId: user.factoryId,
    key: "FABRIC_PRODUCTION_PLAN",
  };
  const row = await Sequence.findOneAndUpdate(
    tenant,
    {
      $inc: { value: 1 },
      $setOnInsert: tenant,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return String(row.value).padStart(4, "0");
}

async function fabricStockForGroup(fabricGroup, excludePlanId = null) {
  const grossRows = await FabricBundleStock.aggregate([
    {
      $match: {
        fabricGroup: upper(fabricGroup),
        status: { $ne: "HOLD" },
        balanceWeightKg: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: { colour: "$colour", dia: "$dia" },
        availableWeightKg: { $sum: "$balanceWeightKg" },
        fabricCodes: { $addToSet: "$fabricCode" },
      },
    },
    { $sort: { "_id.colour": 1, "_id.dia": 1 } },
  ]);
  const planFilter = {
    fabricGroup: upper(fabricGroup),
    status: { $nin: ["CANCELLED"] },
    ...(excludePlanId && { _id: { $ne: excludePlanId } }),
  };
  const plans = await FabricCutPlan.find(planFilter).lean();
  const reserved = new Map();
  for (const plan of plans) {
    for (const colour of plan.colours || []) {
      let issuedRemaining = (plan.allocations || [])
        .filter((entry) => upper(entry.colour) === upper(colour.colour))
        .reduce((sum, entry) => sum + num(entry.weightKg), 0);
      for (const size of colour.sizes || []) {
        const key = `${upper(colour.colour)}|${upper(size.dia)}`;
        const issuedForSize = Math.min(
          issuedRemaining,
          num(size.wantedWeightKg),
        );
        issuedRemaining = Number((issuedRemaining - issuedForSize).toFixed(3));
        const openReservation = Math.max(
          0,
          num(size.wantedWeightKg) - issuedForSize,
        );
        reserved.set(key, num(reserved.get(key)) + openReservation);
      }
    }
  }
  return grossRows
    .map((row) => ({
      colour: row._id.colour,
      dia: row._id.dia,
      grossWeightKg: Number(row.availableWeightKg.toFixed(3)),
      reservedWeightKg: Number(
        num(reserved.get(`${row._id.colour}|${row._id.dia}`)).toFixed(3),
      ),
      availableWeightKg: Number(
        Math.max(
          0,
          row.availableWeightKg -
            num(reserved.get(`${row._id.colour}|${row._id.dia}`)),
        ).toFixed(3),
      ),
      fabricCodes: row.fabricCodes,
    }))
    .filter((row) => row.availableWeightKg > 0);
}

export async function listFabricStock(req, res) {
  const groups = await FabricMaster.distinct("fabricGroup", { active: true });
  const result = [];
  for (const group of groups) {
    const rows = await fabricStockForGroup(group);
    result.push(...rows.map((row) => ({ fabricGroup: group, ...row })));
  }
  res.json(result);
}

export async function listFabricBalance(req, res) {
  const rows = await FabricBundleStock.aggregate([
    { $group: { _id: { inwardNo: "$inwardNo", fabricName: "$fabricName", fabricGroup: "$fabricGroup", colour: "$colour", dia: "$dia" }, rolls: { $sum: 1 }, inwardWeightKg: { $sum: "$originalWeightKg" }, balanceWeightKg: { $sum: "$balanceWeightKg" }, inwardDate: { $min: "$createdAt" } } },
    { $sort: { inwardDate: -1 } },
  ]);
  res.json(rows.map((row) => ({ ...row._id, rolls: row.rolls, inwardWeightKg: Number(row.inwardWeightKg.toFixed(3)), balanceWeightKg: Number(row.balanceWeightKg.toFixed(3)), inwardDate: row.inwardDate })));
}

export async function getPlanSetup(req, res) {
  const itemCode = upper(req.params.itemCode);
  const item = await GarmentItemMaster.findOne({ itemCode });
  if (!item) throw new ApiError(404, "Item Code not found in Item Master");
  if (item.status !== "APPROVED")
    throw new ApiError(
      409,
      "Item Master is waiting for Company Admin approval",
    );
  res.json({
    item,
    stockColours: await fabricStockForGroup(
      item.fabricGroup,
      req.query.excludePlanId || null,
    ),
  });
}

async function buildPlanData(req, excludePlanId = null) {
  const itemCode = upper(req.body.itemCode);
  const itemMaster = await GarmentItemMaster.findOne({ itemCode });
  if (!itemMaster)
    throw new ApiError(404, "Item Code not found in Item Master");
  if (itemMaster.status !== "APPROVED")
    throw new ApiError(
      409,
      "Item Master is waiting for Company Admin approval",
    );
  if (!upper(req.body.orderNo)) throw new ApiError(400, "Order No is required");
  const dcType = upper(req.body.dcType || "FRESH_LOT");
  if (!["FRESH_LOT", "FOLDING_LOT"].includes(dcType))
    throw new ApiError(400, "Select Fresh Lot or Folding Lot");
  const selectedColours = [
    ...new Set((req.body.selectedColours || []).map(upper).filter(Boolean)),
  ];
  if (!selectedColours.length)
    throw new ApiError(400, "Select at least one available fabric colour");
  const stockRows = await fabricStockForGroup(
    itemMaster.fabricGroup,
    excludePlanId,
  );
  const input = (req.body.sizes || []).map((x) => ({
    size: upper(x.size),
    pcs: num(x.pcs),
  }));
  if (!input.length) throw new ApiError(400, "Add size and PCS");
  if (input.some((x) => !x.size || !Number.isInteger(x.pcs) || x.pcs <= 0))
    throw new ApiError(400, "Every size needs a whole PCS value above zero");
  if (new Set(input.map((x) => x.size)).size !== input.length)
    throw new ApiError(400, "Duplicate sizes are not allowed in one plan");
  const remainingStock = new Map(
    stockRows.map((row) => [
      `${row.colour}|${upper(row.dia)}`,
      Number(row.availableWeightKg),
    ]),
  );
  const colourPlans = new Map(
    selectedColours.map((colour) => [
      colour,
      {
        colour,
        sizes: [],
        totalPcs: 0,
        wantedWeightKg: 0,
        availableWeightBeforeKg: 0,
      },
    ]),
  );
  for (const line of input) {
    const measurement = itemMaster.sizes.find(
      (row) => upper(row.size) === line.size,
    );
    if (!measurement)
      throw new ApiError(
        400,
        `Item Master measurement missing for size ${line.size}`,
      );
    const dia = upper(measurement.dia);
    if (!dia)
      throw new ApiError(
        409,
        `Dia is missing in Item Master for size ${line.size}`,
      );
    for (const colour of selectedColours) {
      if (!remainingStock.has(`${colour}|${dia}`))
        throw new ApiError(
          409,
          `${colour} colour has no fabric stock for Dia ${dia}`,
        );
    }
    const perPieceKg = Number(
      (
        num(measurement.cuttingPieceWeightKg) +
        (dcType === "FOLDING_LOT" ? num(measurement.foldingPieceWeightKg) : 0)
      ).toFixed(6),
    );
    if (perPieceKg <= 0)
      throw new ApiError(409, `Piece weight is missing for size ${line.size}`);
    let allocations;
    try {
      allocations = allocatePiecesByStock(
        line.pcs,
        perPieceKg,
        selectedColours.map((colour) => ({
          colour,
          availableWeightKg: remainingStock.get(`${colour}|${dia}`),
        })),
      );
    } catch (error) {
      if (error instanceof RangeError)
        throw new ApiError(409, `${line.size}: ${error.message}`);
      throw error;
    }
    for (const allocation of allocations) {
      const colourPlan = colourPlans.get(allocation.colour);
      colourPlan.sizes.push({
        size: line.size,
        dia,
        plannedPcs: allocation.plannedPcs,
        cuttingWeightPerPieceKg: perPieceKg,
        wantedWeightKg: allocation.wantedWeightKg,
      });
      colourPlan.totalPcs += allocation.plannedPcs;
      colourPlan.wantedWeightKg = Number(
        (colourPlan.wantedWeightKg + allocation.wantedWeightKg).toFixed(3),
      );
      remainingStock.set(
        `${allocation.colour}|${dia}`,
        Number(
          (
            remainingStock.get(`${allocation.colour}|${dia}`) -
            allocation.wantedWeightKg
          ).toFixed(3),
        ),
      );
    }
  }
  const colours = [...colourPlans.values()];
  return {
    orderNo: upper(req.body.orderNo),
    dcType,
    itemCode: itemMaster.itemCode,
    itemName: itemMaster.itemName,
    style: upper(req.body.style),
    bomNo: itemMaster.itemCode,
    fabricCode: stockRows[0]?.fabricCodes?.[0] || "",
    fabricGroup: itemMaster.fabricGroup,
    numberOfColours: selectedColours.length,
    colours,
    totalPlannedPcs: input.reduce((s, x) => s + x.pcs, 0),
    totalWantedWeightKg: Number(
      colours.reduce((s, x) => s + x.wantedWeightKg, 0).toFixed(3),
    ),
    notes: String(req.body.notes || "").trim(),
    createdBy: req.user.name,
  };
}

export async function createPlan(req, res) {
  const planNo = await nextPlanNo(req.user);
  const data = await buildPlanData(req);
  const row = await FabricCutPlan.create({
    ...data,
    planNo,
    dcNo: upper(req.body.dcNo) || planNo,
  });
  res.status(201).json(row);
}

export async function updatePlan(req, res) {
  const existing = await FabricCutPlan.findById(req.params.id);
  if (!existing) throw new ApiError(404, "Production Plan not found");
  if (existing.issuedWeightKg > 0 || existing.allocations.length)
    throw new ApiError(409, "Issued plan cannot be edited");
  const data = await buildPlanData(req, existing._id);
  Object.assign(existing, data, {
    dcNo: upper(req.body.dcNo) || existing.planNo,
  });
  await existing.save();
  res.json(existing);
}

export async function deletePlan(req, res) {
  const existing = await FabricCutPlan.findById(req.params.id);
  if (!existing) throw new ApiError(404, "Production Plan not found");
  if (existing.issuedWeightKg > 0 || existing.allocations.length)
    throw new ApiError(409, "Issued plan cannot be deleted");
  await existing.deleteOne();
  res.json({ message: "Production Plan deleted and reserved stock released" });
}
export async function listPlans(req, res) {
  const f = {};
  if (req.query.planNo) f.planNo = upper(req.query.planNo);
  if (req.query.dcNo) f.dcNo = upper(req.query.dcNo);
  if (req.query.from || req.query.to) {
    f.createdAt = {};
    if (req.query.from) f.createdAt.$gte = new Date(req.query.from);
    if (req.query.to) {
      const end = new Date(req.query.to);
      end.setHours(23, 59, 59, 999);
      f.createdAt.$lte = end;
    }
  }
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

export async function saveFoldingEntry(req, res) {
  const plan = await FabricCutPlan.findOne({
    $or: [{ planNo: upper(req.params.no) }, { dcNo: upper(req.params.no) }],
  });
  if (!plan) throw new ApiError(404, "Plan / DC not found");
  if (plan.foldingBatches?.length)
    throw new ApiError(409, "Folding entry already saved for this plan");
  const batches = (req.body.batches || [])
    .map((row) => ({
      colour: upper(row.colour),
      dia: upper(row.dia),
      bundleNo: upper(row.bundleNo),
      weightKg: num(row.weightKg),
    }))
    .filter((row) => row.colour || row.bundleNo || row.weightKg);
  if (!batches.length || batches.some((row) => !row.colour || !row.dia || !row.bundleNo || row.weightKg <= 0))
    throw new ApiError(400, "Every folding batch needs Colour, Dia, Batch No and Weight");
  const duplicate = new Set();
  for (const row of batches) {
    if (duplicate.has(row.bundleNo)) throw new ApiError(400, `Duplicate Batch No ${row.bundleNo}`);
    duplicate.add(row.bundleNo);
    const stock = await FabricBundleStock.findOne({ bundleNo: row.bundleNo });
    if (!stock) throw new ApiError(404, `Batch ${row.bundleNo} not found`);
    if (upper(stock.colour) !== row.colour || upper(stock.dia) !== row.dia)
      throw new ApiError(409, `${row.bundleNo} does not match ${row.colour} / Dia ${row.dia}`);
    if (stock.balanceWeightKg + 0.0001 < row.weightKg)
      throw new ApiError(409, `${row.bundleNo} balance is only ${stock.balanceWeightKg} KG`);
  }
  for (const row of batches) {
    const stock = await FabricBundleStock.findOne({ bundleNo: row.bundleNo });
    stock.balanceWeightKg = Number((stock.balanceWeightKg - row.weightKg).toFixed(3));
    stock.status = stock.balanceWeightKg <= 0 ? "CONSUMED" : "PARTIAL";
    await stock.save();
    const inward = await FabricInwardLot.findOne({ inwardNo: stock.inwardNo });
    const colour = inward?.colours.find((line) => upper(line.colour) === row.colour);
    if (colour) {
      colour.balanceWeightKg = Number(Math.max(0, colour.balanceWeightKg - row.weightKg).toFixed(3));
      inward.status = inward.colours.every((line) => line.balanceWeightKg <= 0) ? "CLOSED" : "PARTIAL";
      await inward.save();
    }
  }
  plan.foldingBatches = batches;
  plan.foldingWeightKg = Number(batches.reduce((sum, row) => sum + row.weightKg, 0).toFixed(3));
  await plan.save();
  res.json(plan);
}
export async function saveActual(req, res) {
  const plan = await FabricCutPlan.findOne({ planNo: upper(req.body.planNo) });
  if (!plan) throw new ApiError(404, "Plan not found");
  const lines = (req.body.lines || []).map((x) => {
    const colour = upper(x.colour);
    const size = upper(x.size);
    const planLine = plan.colours
      .find((row) => upper(row.colour) === colour)
      ?.sizes.find((row) => upper(row.size) === size);
    if (!planLine)
      throw new ApiError(400, `${colour} / ${size} is not in this plan`);
    const actualPcs = num(x.actualPcs);
    const bundleWeightKg = num(x.bundleWeightKg);
    const pieceWeightKg = num(planLine.cuttingWeightPerPieceKg);
    const actualWeightKg = calculateWantedWeight(actualPcs, pieceWeightKg);
    const lineWaste = calculateWaste(actualWeightKg, bundleWeightKg);
    if (lineWaste < -0.0001)
      throw new ApiError(
        409,
        `${colour} / ${size}: Bundle weight cannot exceed Actual Weight ${actualWeightKg.toFixed(3)} KG`,
      );
    return {
      colour,
      size,
      dia: upper(planLine.dia),
      plannedPcs: num(planLine.plannedPcs),
      actualPcs,
      pieceWeightKg,
      plannedWeightKg: num(planLine.wantedWeightKg),
      actualWeightKg,
      bundleCount: num(x.bundleCount),
      bundleWeightKg,
      wasteWeightKg: Number(Math.max(0, lineWaste).toFixed(3)),
    };
  });
  const effectiveIssuedWeight = resolveActualAvailableWeight(
    plan.issuedWeightKg,
    plan.totalWantedWeightKg,
  );
  const bundle = lines.reduce((s, x) => s + x.bundleWeightKg, 0);
  if (bundle > effectiveIssuedWeight + 0.0001)
    throw new ApiError(
      409,
      `Total Bundle Weight ${bundle.toFixed(3)} KG exceeds Received Weight ${effectiveIssuedWeight.toFixed(3)} KG`,
    );
  const totalActualWeightKg = Number(
    lines.reduce((sum, line) => sum + line.actualWeightKg, 0).toFixed(3),
  );
  const waste = Number(
    lines.reduce((sum, line) => sum + line.wasteWeightKg, 0).toFixed(3),
  );
  const efficiencyPercent =
    totalActualWeightKg > 0
      ? Number(((bundle / totalActualWeightKg) * 100).toFixed(2))
      : 0;
  const data = {
    actualNo: generateReferenceNo("FCA"),
    planNo: plan.planNo,
    dcNo: plan.dcNo,
    itemCode: plan.itemCode,
    itemName: plan.itemName,
    style: plan.style,
    issuedWeightKg: effectiveIssuedWeight,
    lines,
    totalActualPcs: lines.reduce((s, x) => s + x.actualPcs, 0),
    totalBundleCount: lines.reduce((s, x) => s + x.bundleCount, 0),
    totalBundleWeightKg: Number(bundle.toFixed(3)),
    totalActualWeightKg,
    wasteWeightKg: waste,
    efficiencyPercent,
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
      lines: lines.map((line) => ({
        colour: line.colour,
        size: line.size,
        dia: line.dia,
        actualPcs: line.actualPcs,
        actualWeightKg: line.actualWeightKg,
        bundleWeightKg: line.bundleWeightKg,
        wasteWeightKg: line.wasteWeightKg,
      })),
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
  const itemMaster = await GarmentItemMaster.findOne({
    itemCode: actual.itemCode,
    status: "APPROVED",
  }).sort({ updatedAt: -1 });
  if (!itemMaster) throw new ApiError(404, "Approved Item Master not found");
  const lines = actual.lines.map((x) => {
    const m = itemMaster.sizes.find((s) => upper(s.size) === upper(x.size)),
      measurement = num(m?.elasticMeasurementMtr);
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
