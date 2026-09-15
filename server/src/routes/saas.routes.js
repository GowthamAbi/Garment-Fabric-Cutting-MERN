import { Router } from "express";
import { approveSubscription, createSubscription, downloadBackup, getAuditHistory, getSubscription } from "../controllers/saasController.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.get("/subscription", allowRoles("saas_super_admin", "company_admin", "admin"), asyncHandler(getSubscription));
router.post("/subscription", allowRoles("saas_super_admin", "company_admin", "admin"), asyncHandler(createSubscription));
router.patch("/subscription/:id/approve", allowRoles("saas_super_admin"), asyncHandler(approveSubscription));
router.get("/audit", allowRoles("saas_super_admin", "company_admin", "admin"), asyncHandler(getAuditHistory));
router.get("/backup", allowRoles("saas_super_admin", "company_admin", "admin"), asyncHandler(downloadBackup));
export default router;
