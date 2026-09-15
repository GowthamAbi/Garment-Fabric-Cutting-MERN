import { Router } from "express";
import { allowDepartment, allowRoles } from "../middleware/roleMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as c from "../controllers/fabricCuttingController.js";
import * as m from "../controllers/fabricMasterController.js";
const r = Router(),
  fabricRead = allowDepartment(
    "FABRIC",
    "saas_super_admin",
    "company_admin",
    "admin",
    "fabric_admin",
    "fabric_entry",
    "management",
    "view_only",
  ),
  cuttingRead = allowDepartment(
    "CUTTING",
    "saas_super_admin",
    "company_admin",
    "admin",
    "cutting_admin",
    "cutting_entry",
    "management",
    "view_only",
  ),
  elasticRead = allowDepartment(
    "ELASTIC",
    "saas_super_admin",
    "company_admin",
    "admin",
    "elastic_admin",
    "elastic_entry",
    "management",
    "view_only",
  ),
  fabricEntry = allowDepartment(
    "FABRIC",
    "saas_super_admin",
    "admin",
    "fabric_admin",
    "fabric_entry",
    "department_entry",
  ),
  masterWrite = allowRoles("saas_super_admin", "company_admin", "admin"),
  cutting = allowDepartment(
    "CUTTING",
    "saas_super_admin",
    "company_admin",
    "admin",
    "fabric_admin",
    "cutting_admin",
    "cutting_entry",
    "department_entry",
  ),
  elastic = allowDepartment(
    "ELASTIC",
    "saas_super_admin",
    "company_admin",
    "admin",
    "elastic_admin",
    "elastic_entry",
  );
r.get("/masters", fabricRead, asyncHandler(m.listFabricMasters));
r.get("/masters/:code", fabricRead, asyncHandler(m.getFabricMaster));
r.post("/masters", masterWrite, asyncHandler(m.saveFabricMaster));
r.put("/masters/:id", masterWrite, asyncHandler(m.saveFabricMaster));
r.delete("/masters/:id", masterWrite, asyncHandler(m.deleteFabricMaster));
r.get("/process-masters", fabricRead, asyncHandler(m.listProcesses));
r.get("/process-masters/:type/:code", fabricRead, asyncHandler(m.getProcess));
r.post("/process-masters", masterWrite, asyncHandler(m.saveProcess));
r.put("/process-masters/:id", masterWrite, asyncHandler(m.saveProcess));
r.delete("/process-masters/:id", masterWrite, asyncHandler(m.deleteProcess));
r.get("/item-masters", fabricRead, asyncHandler(m.listItemMasters));
r.post("/item-masters", masterWrite, asyncHandler(m.saveItemMaster));
r.put("/item-masters/:id", masterWrite, asyncHandler(m.saveItemMaster));
r.patch(
  "/item-masters/:id/approval",
  masterWrite,
  asyncHandler(m.approveItemMaster),
);
r.delete("/item-masters/:id", masterWrite, asyncHandler(m.deleteItemMaster));
r.get("/inwards", fabricRead, asyncHandler(c.listInwards));
r.get("/inwards/:no/bundles", fabricRead, asyncHandler(c.listInwardBundles));
r.get("/inwards/:no", fabricRead, asyncHandler(c.getInward));
r.post("/inwards", fabricEntry, asyncHandler(c.saveInward));
r.put("/inwards/:id", fabricEntry, asyncHandler(c.saveInward));
r.get("/plans", cuttingRead, asyncHandler(c.listPlans));
r.get("/plans/setup/:itemCode", cuttingRead, asyncHandler(c.getPlanSetup));
r.get("/plans/:no", cuttingRead, asyncHandler(c.getPlan));
r.post("/plans", cutting, asyncHandler(c.createPlan));
r.post("/plans/:no/issue", cutting, asyncHandler(c.issueFabric));
r.get("/actuals", cuttingRead, asyncHandler(c.listActuals));
r.post("/actuals", cutting, asyncHandler(c.saveActual));
r.get("/elastic/:no", elasticRead, asyncHandler(c.elasticRequirement));
r.get("/waste", cuttingRead, asyncHandler(c.listWaste));
export default r;
