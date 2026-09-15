import MasterRecord from "../models/MasterRecord.js";
import ApiError from "../utils/ApiError.js";

export async function getMasterRecords(request, response) {
  response.json(await MasterRecord.find(request.query.type ? { masterType: request.query.type } : {}).sort({ masterType: 1, name: 1 }));
}

export async function saveMasterRecord(request, response) {
  const data = { ...request.body, code: String(request.body.code || "").trim().toUpperCase(), createdBy: request.user.name };
  const record = request.params.id
    ? await MasterRecord.findByIdAndUpdate(request.params.id, data, { new: true, runValidators: true })
    : await MasterRecord.create(data);
  if (!record) throw new ApiError(404, "Master record not found");
  response.status(request.params.id ? 200 : 201).json(record);
}
