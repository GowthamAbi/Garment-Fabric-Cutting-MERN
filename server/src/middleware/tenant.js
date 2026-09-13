import mongoose from "mongoose";

export function tenant(request, _response, next) {
  const companyId = request.headers["x-company-id"] || process.env.DEFAULT_COMPANY_ID;
  const factoryId = request.headers["x-factory-id"] || process.env.DEFAULT_FACTORY_ID;
  if (!mongoose.isValidObjectId(companyId) || !mongoose.isValidObjectId(factoryId)) {
    return next(Object.assign(new Error("Valid company and factory are required"), { statusCode: 400 }));
  }
  request.tenant = { companyId, factoryId, updatedBy: request.headers["x-user-name"] || "Garment User", role: String(request.headers["x-user-role"] || "admin").toLowerCase() };
  next();
}
