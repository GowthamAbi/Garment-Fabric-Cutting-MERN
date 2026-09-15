import CuttingDc from "../models/CuttingDc.js";
import MeasurementMaster from "../models/MeasurementMaster.js";
import Outward from "../models/Outward.js";
import PendingIssue from "../models/PendingIssue.js";
import WarehouseStock from "../models/WarehouseStock.js";
import ApiError from "../utils/ApiError.js";
import { generateReferenceNo } from "../utils/generateReferenceNo.js";

const upper = (value) => String(value || "").trim().toUpperCase();

export async function getMeasurements(request, response) {
  const filter = {};
  if (request.query.itemName) filter.itemName = request.query.itemName.trim();
  if (request.query.style) filter.style = upper(request.query.style);
  if (request.query.size) filter.size = upper(request.query.size);
  response.json(await MeasurementMaster.find(filter).sort({ itemName: 1, style: 1, size: 1 }));
}

export async function getCuttingDcs(request, response) {
  const filter = request.query.dcNo ? { dcNo: upper(request.query.dcNo) } : {};
  response.json(await CuttingDc.find(filter).sort({ createdAt: -1 }));
}

export async function getCuttingDc(request, response) {
  const row = await CuttingDc.findOne({ dcNo: upper(request.params.dcNo) });
  if (!row) throw new ApiError(404, "Cutting DC not found");
  response.json(row);
}

export async function saveCuttingDc(request, response) {
  const dcNo = upper(request.body.dcNo);
  const itemName = String(request.body.itemName || "").trim();
  const style = upper(request.body.style);
  if (!dcNo || !itemName || !style) throw new ApiError(400, "DC No, Item Name and Style are required");
  const outwardRows = await Outward.find({ dcNo }).lean();
  const colours = [];
  for (const input of request.body.colours || []) {
    const colour = upper(input.colour);
    const sizes = (input.sizes || []).map((line) => ({
      size: upper(line.size), pcs: Number(line.pcs), measurement: Number(line.measurement),
      wantedMtr: Number((Number(line.pcs) * Number(line.measurement)).toFixed(3)),
    }));
    if (!colour || !sizes.length || sizes.some((line) => !line.size || line.pcs <= 0 || line.measurement <= 0)) throw new ApiError(400, "Every colour needs valid Size, PCS and Measurement");
    const totalPcs = sizes.reduce((sum, line) => sum + line.pcs, 0);
    const wantedMtr = Number(sizes.reduce((sum, line) => sum + line.wantedMtr, 0).toFixed(3));
    const availableMtr = outwardRows.filter((row) => upper(row.colour) === colour).reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const materialDecision = upper(input.materialDecision || "OUTWARD");
    const shortageReason = String(input.shortageReason || "").trim();
    if (wantedMtr > availableMtr && materialDecision === "OUTWARD") throw new ApiError(409, `${colour}: wanted ${wantedMtr} MTR, outward has ${availableMtr} MTR. Select Balance or No Stock.`);
    if (wantedMtr > availableMtr && !shortageReason) throw new ApiError(400, `${colour}: shortage reason is required`);
    if (materialDecision === "BALANCE") {
      const balanceRows = await WarehouseStock.find({ warehouseType: "BALANCE_ELASTIC", colour, itemCode: upper(request.body.itemCode), balanceQty: { $gt: 0 } }).sort({ createdAt: 1 });
      let needed = Math.max(0, wantedMtr - availableMtr);
      const availableBalance = balanceRows.reduce((sum, row) => sum + row.balanceQty, 0);
      if (availableBalance < needed) throw new ApiError(409, `${colour}: Balance Warehouse needs ${needed} MTR, only ${availableBalance} MTR available`);
      for (const row of balanceRows) { const used = Math.min(row.balanceQty, needed); row.balanceQty -= used; needed -= used; await row.save(); if (!needed) break; }
    }
    if (materialDecision === "NO_STOCK") await PendingIssue.create({ issueNo: generateReferenceNo("WNT"), outwardNo: dcNo, section: "Store", itemCode: upper(request.body.itemCode), itemName, colour, requiredPcs: totalPcs, requiredMtr: wantedMtr, availableMtr, issueType: "Material Shortage", reason: shortageReason || "No stock", status: "Material Requested", createdBy: request.user?.name || "Production User" });
    for (const size of sizes) await MeasurementMaster.findOneAndUpdate({ itemName, style, size: size.size }, { measurement: size.measurement, unit: "MTR", updatedBy: request.user?.name || "Production User" }, { upsert: true, new: true, setDefaultsOnInsert: true });
    colours.push({ colour, sizes, totalPcs, wantedMtr, availableMtr, materialDecision, shortageReason, status: materialDecision === "NO_STOCK" ? "MATERIAL_PENDING" : "READY" });
  }
  if (!colours.length || colours.reduce((sum, line) => sum + line.sizes.length, 0) > 10) throw new ApiError(400, "Add 1 to 10 size lines");
  const data = { dcNo, itemName, itemCode: upper(request.body.itemCode), style, target: request.body.target || "", colours, totalPcs: colours.reduce((sum, line) => sum + line.totalPcs, 0), totalMtr: Number(colours.reduce((sum, line) => sum + line.wantedMtr, 0).toFixed(3)), status: colours.some((line) => line.status === "MATERIAL_PENDING") ? "MATERIAL_PENDING" : "PLANNED", createdBy: request.user?.name || "Production User" };
  const saved = await CuttingDc.findOneAndUpdate({ dcNo }, data, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  response.status(201).json(saved);
}
