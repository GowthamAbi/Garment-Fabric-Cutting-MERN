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
import { allowRoles } from "../middleware/roleMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getCuttingDc, getCuttingDcs, getMeasurements, saveCuttingDc } from "../controllers/cuttingDcController.js";

const router = Router();
const productionAccess = allowRoles(
  "saas_super_admin", "company_admin", "admin", "production", "production_planner",
  "production_operator", "supervisor", "quality", "maintenance",
  "sewing_coordinator", "management", "view_only",
);

router.use(productionAccess);
router.get("/summary", asyncHandler(getProductionSummary));
router.get("/cutting-dcs", asyncHandler(getCuttingDcs));
router.get("/cutting-dcs/:dcNo", asyncHandler(getCuttingDc));
router.post("/cutting-dcs", asyncHandler(saveCuttingDc));
router.get("/measurements", asyncHandler(getMeasurements));
router.get("/plans", asyncHandler(getPlans));
router.post("/plans", allowRoles("saas_super_admin", "company_admin", "admin", "production_planner", "production"), asyncHandler(savePlan));
router.put("/plans/:id", allowRoles("saas_super_admin", "company_admin", "admin", "production_planner", "production"), asyncHandler(savePlan));
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
