import { Router } from "express";
import {
  changeIssueStatus,
  createSewingDelivery,
  getEmployees,
  getDcPlan,
  getJobs,
  getMachines,
  getPendingIssues,
  getProductionSummary,
  getSewingDeliveries,
  getPlans,
  savePlan,
  getSewingHolds,
  saveSewingHold,
  resolveSewingHold,
  resumeJob,
  saveEmployee,
  saveMachine,
  savePendingIssue,
  startJob,
  stopJob,
  deletePendingIssue,
} from "../controllers/productionController.js";
import { allowDepartment, allowRoles } from "../middleware/roleMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getCuttingDc,
  getCuttingDcs,
  getMeasurements,
  saveCuttingDc,
} from "../controllers/cuttingDcController.js";
import {
  assignmentAction,
  createAssignment,
  listAssignments,
  machinePlanStatus,
  transferAssignment,
} from "../controllers/cuttingMachinePlanController.js";

import {listCuttingMachines,saveCuttingMachine,cuttingTargetActual} from "../controllers/cuttingDepartmentController.js";
import {requireLegacyFabricFactory} from "../controllers/fabricPlanMonitorController.js";
import {elasticMachineSummary} from "../controllers/elasticMachineSummaryController.js";

const router = Router();
const productionAccess = allowDepartment(
  "ELASTIC",
  "saas_super_admin",
  "company_admin",
  "admin",
  "production",
  "production_planner",
  "production_operator",
  "supervisor",
  "quality",
  "maintenance",
  "sewing_coordinator",
  "management",
  "view_only",
  "cutting_admin",
  "cutting_entry",
);
const productionPlanningWrite = allowDepartment(
  "ELASTIC",
  "saas_super_admin",
  "admin",
  "production_planner",
  "production",
  "cutting_admin",
  "cutting_entry",
);

// Dedicated Cutting APIs are licensed by CUTTING; never rely on ELASTIC.
const cuttingRead = allowDepartment("CUTTING", "saas_super_admin", "company_owner", "company_admin", "admin", "cutting_admin", "cutting_entry", "management", "view_only");
const cuttingWrite = allowDepartment("CUTTING", "saas_super_admin", "company_owner", "admin", "cutting_admin", "cutting_entry", "department_entry");
// Pre-migration machine/plan records may be untagged: block multi-factory reads.
router.get("/cutting-machines", cuttingRead, asyncHandler(requireLegacyFabricFactory), asyncHandler(listCuttingMachines));
router.post("/cutting-machines", cuttingWrite, asyncHandler(requireLegacyFabricFactory), asyncHandler(saveCuttingMachine));
router.put("/cutting-machines/:id", cuttingWrite, asyncHandler(requireLegacyFabricFactory), asyncHandler(saveCuttingMachine));
router.get("/cutting-overview", cuttingRead, asyncHandler(requireLegacyFabricFactory), asyncHandler(cuttingTargetActual));
router.get("/cutting-machine-plans", cuttingRead, asyncHandler(requireLegacyFabricFactory), asyncHandler(listAssignments));
router.get("/cutting-machine-status", cuttingRead, asyncHandler(requireLegacyFabricFactory), asyncHandler(machinePlanStatus));
router.post("/cutting-machine-plans", cuttingWrite, asyncHandler(requireLegacyFabricFactory), asyncHandler(createAssignment));
router.patch("/cutting-machine-plans/:id/action", cuttingWrite, asyncHandler(requireLegacyFabricFactory), asyncHandler(assignmentAction));
router.patch("/cutting-machine-plans/:id/transfer", cuttingWrite, asyncHandler(requireLegacyFabricFactory), asyncHandler(transferAssignment));

// Legacy Elastic timeline; read-only and isolated by both department and
// single-factory guard until old machine/job records have factoryId migration.
const elasticRead = allowDepartment("ELASTIC", "saas_super_admin", "company_owner", "company_admin", "admin", "elastic_admin", "elastic_entry", "management", "view_only");
router.get("/elastic-machine-summary", elasticRead, asyncHandler(requireLegacyFabricFactory), asyncHandler(elasticMachineSummary));

router.use(productionAccess);
router.get("/summary", asyncHandler(getProductionSummary));
router.get("/cutting-dcs", asyncHandler(getCuttingDcs));
router.get("/cutting-dcs/:dcNo", asyncHandler(getCuttingDc));
router.post("/cutting-dcs", asyncHandler(saveCuttingDc));
router.get("/measurements", asyncHandler(getMeasurements));
router.get("/plans", asyncHandler(getPlans));
router.post("/plans", productionPlanningWrite, asyncHandler(savePlan));
router.put("/plans/:id", productionPlanningWrite, asyncHandler(savePlan));
router.get("/machines", asyncHandler(getMachines));
router.post("/machines", asyncHandler(saveMachine));
router.put("/machines/:id", asyncHandler(saveMachine));
router.get("/employees", asyncHandler(getEmployees));
router.post("/employees", asyncHandler(saveEmployee));
router.put("/employees/:id", asyncHandler(saveEmployee));
router.get("/jobs", asyncHandler(getJobs));
router.get("/dc/:dcNo", asyncHandler(getDcPlan));
router.post("/jobs/start", asyncHandler(startJob));
router.patch("/jobs/:id/stop", asyncHandler(stopJob));
router.patch("/jobs/:id/resume", asyncHandler(resumeJob));
router.get("/pending", asyncHandler(getPendingIssues));
router.post("/pending", asyncHandler(savePendingIssue));
router.put("/pending/:id", asyncHandler(savePendingIssue));
router.patch("/pending/:id/status", asyncHandler(changeIssueStatus));
router.delete("/pending/:id", asyncHandler(deletePendingIssue));
router.get("/sewing", asyncHandler(getSewingDeliveries));
router.post("/sewing", asyncHandler(createSewingDelivery));
router.get("/sewing-holds", asyncHandler(getSewingHolds));
router.post("/sewing-holds", asyncHandler(saveSewingHold));
router.patch("/sewing-holds/:id", asyncHandler(resolveSewingHold));

export default router;
