import { Router } from "express";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as c from "../controllers/fabricCuttingController.js";
const r = Router(),
  read = allowRoles(
    "saas_super_admin",
    "company_admin",
    "admin",
    "fabric_admin",
    "fabric_entry",
    "cutting_admin",
    "cutting_entry",
    "elastic_admin",
    "elastic_entry",
    "management",
    "view_only",
  ),
  fabric = allowRoles(
    "saas_super_admin",
    "company_admin",
    "admin",
    "fabric_admin",
    "fabric_entry",
  ),
  cutting = allowRoles(
    "saas_super_admin",
    "company_admin",
    "admin",
    "fabric_admin",
    "cutting_admin",
    "cutting_entry",
  ),
  elastic = allowRoles(
    "saas_super_admin",
    "company_admin",
    "admin",
    "elastic_admin",
    "elastic_entry",
  );
r.use(read);
r.get("/masters", asyncHandler(c.listFabricMasters));
r.get("/masters/:code", asyncHandler(c.getFabricMaster));
r.post("/masters", fabric, asyncHandler(c.saveFabricMaster));
r.get("/inwards", asyncHandler(c.listInwards));
r.get("/inwards/:no/bundles", asyncHandler(c.listInwardBundles));
r.get("/inwards/:no", asyncHandler(c.getInward));
r.post("/inwards", fabric, asyncHandler(c.saveInward));
r.put("/inwards/:id", fabric, asyncHandler(c.saveInward));
r.get("/plans", asyncHandler(c.listPlans));
r.get("/plans/:no", asyncHandler(c.getPlan));
r.post("/plans", cutting, asyncHandler(c.createPlan));
r.post("/plans/:no/issue", cutting, asyncHandler(c.issueFabric));
r.get("/actuals", asyncHandler(c.listActuals));
r.post("/actuals", cutting, asyncHandler(c.saveActual));
r.get("/elastic/:no", elastic, asyncHandler(c.elasticRequirement));
r.get("/waste", asyncHandler(c.listWaste));
export default r;
