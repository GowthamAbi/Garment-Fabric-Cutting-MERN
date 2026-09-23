import { Router } from "express";
import { createCompany, getCompanies, getCompanyWorkspace, updateCompany, updateCompanyUser } from "../controllers/companyController.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.get("/", allowRoles("saas_super_admin", "company_admin"), asyncHandler(getCompanies));
router.post("/", allowRoles("saas_super_admin"), asyncHandler(createCompany));
router.get("/:id/workspace", allowRoles("saas_super_admin"), asyncHandler(getCompanyWorkspace));
router.patch("/:id/users/:userId", allowRoles("saas_super_admin"), asyncHandler(updateCompanyUser));
router.put("/:id", allowRoles("saas_super_admin"), asyncHandler(updateCompany));
export default router;
