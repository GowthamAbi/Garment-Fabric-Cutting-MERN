import { Router } from "express";
import {
  forgotPassword,
  createUser,
  getUsers,
  login,
  register,
  resetPassword,
  getProfile,
  updateProfile,
  getSetupStatus,
} from "../controllers/authController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { loginRateLimit } from "../middleware/securityMiddleware.js";

const router = Router();

router.get("/setup-status", asyncHandler(getSetupStatus));
router.post("/register", asyncHandler(register));
router.post("/login", loginRateLimit, asyncHandler(login));
router.post("/forgot-password", asyncHandler(forgotPassword));
router.post("/reset-password", asyncHandler(resetPassword));
router.get("/users", requireAuth, allowRoles("saas_super_admin", "company_admin", "admin"), asyncHandler(getUsers));
router.post("/users", requireAuth, allowRoles("saas_super_admin", "company_admin", "admin"), asyncHandler(createUser));
router.get("/profile", requireAuth, asyncHandler(getProfile));
router.patch("/profile", requireAuth, asyncHandler(updateProfile));

export default router;
