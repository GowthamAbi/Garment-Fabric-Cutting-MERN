import ApiError from "../utils/ApiError.js";
import WarehouseStock from "../models/WarehouseStock.js";
import { generateReferenceNo } from "../utils/generateReferenceNo.js";

const normalize = (value) => String(value || "").trim().toUpperCase();

export async function getWarehouse(request, response) {
  const filter = {};
  if (request.query.type) filter.warehouseType = normalize(request.query.type);
  if (request.query.dcNo) filter.dcNo = normalize(request.query.dcNo);
  response.json(await WarehouseStock.find(filter).sort({ createdAt: -1 }));
}

export async function transferRework(request, response) {
  const source = await WarehouseStock.findById(request.params.id);
  if (!source || source.warehouseType !== "REWORK") throw new ApiError(404, "Rework stock not found");
  const quantity = Number(request.body.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > source.balanceQty) throw new ApiError(400, `Only ${source.balanceQty} rework pcs available`);
  const action = request.body.action;
  const destinationType = action === "complete" || action === "convert" ? "PRODUCTION_READY" : action === "reject" ? "REJECTION" : "";
  if (!destinationType) throw new ApiError(400, "Select Complete, Convert or Reject");
  const target = {
    itemName: action === "convert" ? request.body.itemName : source.itemName,
    colour: action === "convert" ? normalize(request.body.colour) : source.colour,
    size: action === "convert" ? normalize(request.body.size) : source.size,
  };
  if (!target.itemName || !target.colour || !target.size) throw new ApiError(400, "Target item, colour and size are required");
  source.balanceQty -= quantity;
  source.history.push({ action, quantity, fromType: "REWORK", toType: destinationType, ...target, reason: request.body.reason || "", user: request.user?.name });
  await source.save();
  const destination = await WarehouseStock.create({
    referenceNo: generateReferenceNo(destinationType === "REJECTION" ? "REJ" : "RDY"),
    warehouseType: destinationType, jobNo: source.jobNo, dcNo: source.dcNo,
    outwardNo: source.outwardNo, itemCode: source.itemCode, ...target,
    originalQty: quantity, balanceQty: quantity, reason: request.body.reason || "",
    createdBy: request.user?.name || "Production User",
    history: [{ action, quantity, fromType: "REWORK", toType: destinationType, ...target, reason: request.body.reason || "", user: request.user?.name }],
  });
  response.json({ source, destination });
}

export async function deliverToSection(request, response) {
  const source = await WarehouseStock.findById(request.params.id);
  if (!source || source.warehouseType !== "PRODUCTION_READY") throw new ApiError(404, "Production-ready stock not found");
  const quantity = Number(request.body.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > source.balanceQty) throw new ApiError(400, `Only ${source.balanceQty} ready pcs available`);
  const sectionCode = normalize(request.body.sectionCode);
  if (!sectionCode) throw new ApiError(400, "Section QR is required");
  source.balanceQty -= quantity;
  source.history.push({ action: "section-delivery", quantity, fromType: "PRODUCTION_READY", toType: "SECTION_DELIVERY", sectionCode, user: request.user?.name });
  await source.save();
  const delivery = await WarehouseStock.create({
    referenceNo: generateReferenceNo("SEC"), warehouseType: "SECTION_DELIVERY",
    jobNo: source.jobNo, dcNo: source.dcNo, outwardNo: source.outwardNo,
    itemCode: source.itemCode, itemName: source.itemName, colour: source.colour,
    size: source.size, originalQty: quantity, balanceQty: quantity, sectionCode,
    createdBy: request.user?.name || "Production User",
  });
  response.json({ source, delivery });
}
