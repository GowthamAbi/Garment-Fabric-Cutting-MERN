import { Router } from "express";
import { getDashboard } from "../controllers/dashboardController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { getCompanyAdminOverview } from "../controllers/companyAdminController.js";

const router = Router();

router.get("/", asyncHandler(getDashboard));
router.get(
  "/company-overview",
  allowRoles("company_admin", "admin"),
  asyncHandler(getCompanyAdminOverview),
);

export default router;
