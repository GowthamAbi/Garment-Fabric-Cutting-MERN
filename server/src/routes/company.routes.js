import { Router } from "express";
import { createCompany, getCompanies, getCompanyWorkspace, updateCompany, updateCompanyUser } from "../controllers/companyController.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.use(allowRoles("saas_super_admin"));
router.get("/", asyncHandler(getCompanies));
router.post("/", asyncHandler(createCompany));
router.get("/:id/workspace", asyncHandler(getCompanyWorkspace));
router.patch("/:id/users/:userId", asyncHandler(updateCompanyUser));
router.put("/:id", asyncHandler(updateCompany));
export default router;
