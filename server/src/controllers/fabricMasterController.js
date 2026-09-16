import FabricMaster from "../models/FabricMaster.js";
import ProcessMaster from "../models/ProcessMaster.js";
import GarmentItemMaster from "../models/GarmentItemMaster.js";
import ApiError from "../utils/ApiError.js";

const upper = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

function companyAdmin(request) {
  return ["saas_super_admin", "company_admin", "admin"].includes(
    request.user.role,
  );
}

export async function listFabricMasters(request, response) {
  const search = String(request.query.search || "").trim();
  const filter = search
    ? {
        $or: ["fabricCode", "fabricName", "fabricGroup"].map((key) => ({
          [key]: { $regex: search, $options: "i" },
        })),
      }
    : {};
  response.json(await FabricMaster.find(filter).sort({ fabricGroup: 1 }));
}

export async function getFabricMaster(request, response) {
  const row = await FabricMaster.findOne({
    fabricCode: upper(request.params.code),
  });
  if (!row) throw new ApiError(404, "Fabric code not found");
  response.json(row);
}

export async function saveFabricMaster(request, response) {
  const data = {
    fabricCode: upper(request.body.fabricCode),
    fabricName: String(request.body.fabricName || "").trim(),
    fabricGroup: upper(request.body.fabricGroup),
    active: request.body.active !== false,
    createdBy: request.user.name,
  };
  if (!data.fabricCode || !data.fabricName || !data.fabricGroup)
    throw new ApiError(400, "Fabric Code, Name and Group are required");
  const row = request.params.id
    ? await FabricMaster.findByIdAndUpdate(request.params.id, data, {
        new: true,
        runValidators: true,
      })
    : await FabricMaster.create(data);
  if (!row) throw new ApiError(404, "Fabric master not found");
  response.status(request.params.id ? 200 : 201).json(row);
}

export async function deleteFabricMaster(request, response) {
  if (!companyAdmin(request))
    throw new ApiError(403, "Only Company Admin can delete master data");
  const row = await FabricMaster.findByIdAndDelete(request.params.id);
  if (!row) throw new ApiError(404, "Fabric master not found");
  response.json({ message: "Fabric master deleted" });
}

export async function listProcesses(request, response) {
  const filter = request.query.type
    ? { processType: upper(request.query.type) }
    : {};
  response.json(
    await ProcessMaster.find(filter).sort({ processType: 1, code: 1 }),
  );
}

export async function getProcess(request, response) {
  const row = await ProcessMaster.findOne({
    processType: upper(request.params.type),
    code: upper(request.params.code),
  });
  if (!row) throw new ApiError(404, "Process code not found");
  response.json(row);
}

export async function saveProcess(request, response) {
  const data = {
    processType: upper(request.body.processType),
    code: upper(request.body.code),
    name: String(request.body.name || "").trim(),
    active: request.body.active !== false,
    createdBy: request.user.name,
  };
  const row = request.params.id
    ? await ProcessMaster.findByIdAndUpdate(request.params.id, data, {
        new: true,
        runValidators: true,
      })
    : await ProcessMaster.create(data);
  if (!row) throw new ApiError(404, "Process master not found");
  response.status(request.params.id ? 200 : 201).json(row);
}

export async function deleteProcess(request, response) {
  if (!companyAdmin(request))
    throw new ApiError(403, "Only Company Admin can delete master data");
  await ProcessMaster.findByIdAndDelete(request.params.id);
  response.json({ message: "Process master deleted" });
}

export async function listItemMasters(request, response) {
  const search = String(request.query.search || "").trim();
  const filter = search
    ? {
        $or: ["itemCode", "itemName", "fabricGroup"].map((key) => ({
          [key]: { $regex: search, $options: "i" },
        })),
      }
    : {};
  response.json(await GarmentItemMaster.find(filter).sort({ itemName: 1 }));
}

export async function saveItemMaster(request, response) {
  const sizes = (request.body.sizes || []).map((row) => ({
    size: upper(row.size),
    dia: upper(row.dia),
    cuttingPieceWeightKg: Number(row.cuttingPieceWeightKg || 0),
    foldingPieceWeightKg: Number(row.foldingPieceWeightKg || 0),
    elasticMeasurementMtr: Number(row.elasticMeasurementMtr || 0),
  }));
  if (!sizes.length || sizes.some((row) => !row.size || !row.dia))
    throw new ApiError(400, "Every size needs a valid Dia");
  const data = {
    ...request.body,
    itemCode: upper(request.body.itemCode),
    itemName: String(request.body.itemName || "").trim(),
    fabricGroup: upper(request.body.fabricGroup),
    sizes,
    elasticRanges: request.body.elasticRanges || [],
    accessories: request.body.accessories || [],
    status: companyAdmin(request) ? "APPROVED" : "PENDING_APPROVAL",
    createdBy: request.user.name,
    ...(companyAdmin(request) && {
      approvedBy: request.user.name,
      approvedAt: new Date(),
    }),
  };
  const row = request.params.id
    ? await GarmentItemMaster.findByIdAndUpdate(request.params.id, data, {
        new: true,
        runValidators: true,
      })
    : await GarmentItemMaster.create(data);
  if (!row) throw new ApiError(404, "Item master not found");
  response.status(request.params.id ? 200 : 201).json(row);
}

export async function approveItemMaster(request, response) {
  if (!companyAdmin(request))
    throw new ApiError(403, "Company Admin approval required");
  const row = await GarmentItemMaster.findByIdAndUpdate(
    request.params.id,
    {
      status: request.body.status === "REJECTED" ? "REJECTED" : "APPROVED",
      approvedBy: request.user.name,
      approvedAt: new Date(),
    },
    { new: true },
  );
  if (!row) throw new ApiError(404, "Item master not found");
  response.json(row);
}

export async function deleteItemMaster(request, response) {
  if (!companyAdmin(request))
    throw new ApiError(403, "Only Company Admin can delete master data");
  await GarmentItemMaster.findByIdAndDelete(request.params.id);
  response.json({ message: "Item master deleted" });
}
