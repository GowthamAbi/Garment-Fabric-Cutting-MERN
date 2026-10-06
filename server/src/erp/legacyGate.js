import { ErpSettings } from "./models.js";
import ApiError from "../utils/ApiError.js";
export async function legacyWriteGate(req, _res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || req.path.startsWith("/erp")) return next();
  const stockPaths = ["/items", "/pos", "/transactions", "/public", "/warehouse", "/production", "/fabric-cutting", "/delivery", "/garments"];
  if (!stockPaths.some(p => req.path === p || req.path.startsWith(p + "/"))) return next();
  try {
    const settings = await ErpSettings.findOne({ companyId: req.user.companyId, factoryId: req.user.factoryId, key: "ERP" }).lean();
    if (settings?.legacyWritesLocked) return next(new ApiError(409, "This factory uses the integrated ERP ledger. Legacy screens remain read-only after migration."));
    next();
  } catch (e) { next(e); }
}
