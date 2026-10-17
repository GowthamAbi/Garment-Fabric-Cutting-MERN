import { Router } from "express";
import { allowDepartment } from "../middleware/roleMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as c from "../controllers/deliveryController.js";
import * as returns from "../controllers/deliveryVendorReceiptController.js";
import {assertDeliveryRole} from "../erp/deliveryVendorReturnPolicy.js";
import {requireLegacyFabricFactory} from "../controllers/fabricPlanMonitorController.js";
const r = Router();
r.use((req,res,next)=>{try{assertDeliveryRole(req.user,req.method);next();}catch(e){next(e);}});
// Legacy Cutting and Delivery records have incomplete factory attribution.
// Fail closed for multi-factory tenants until migrated.
r.use(asyncHandler(requireLegacyFabricFactory));
const read = allowDepartment(
  "DELIVERY",
  "saas_super_admin",
  "company_admin",
  "admin",
  "delivery_admin",
  "delivery_entry",
  "management",
  "view_only",
);
const write = allowDepartment(
  "DELIVERY",
  "saas_super_admin",
  "company_admin",
  "admin",
  "delivery_admin",
  "delivery_entry",
  "department_entry",
);
r.get("/vendors", read, asyncHandler(c.listVendors));
r.get("/vendors/:code", read, asyncHandler(c.getVendor));
r.post("/vendors", write, asyncHandler(c.saveVendor));
r.put("/vendors/:id", write, asyncHandler(c.saveVendor));
r.get("/plans", read, asyncHandler(c.listPlanDetails));
r.get("/plans/:no", read, asyncHandler(c.getPlanSetup));
r.post("/challans", write, asyncHandler(c.createChallan));
r.get("/history", read, asyncHandler(c.listHistory));
r.get("/monitoring", read, asyncHandler(c.deliveryMonitoring));
r.post("/challans/:id/handover", write, asyncHandler(c.handoverChallan));
r.get("/cutting-stock", read, asyncHandler(c.cuttingStock));
r.get("/vendor-returns", read, asyncHandler(returns.listVendorReturns));
r.get("/vendor-return-monitoring", read, asyncHandler(returns.vendorReturnMonitoring));
r.post("/vendor-returns", write, asyncHandler(returns.saveVendorReturn));
export default r;
