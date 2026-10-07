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
  getSession,
  logout,
  verifyEmail,
} from "../controllers/authController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { loginRateLimit } from "../middleware/securityMiddleware.js";
import { resolvePublicTenant } from "../middleware/tenantResolver.js";

const router = Router();

router.get("/setup-status", resolvePublicTenant, asyncHandler(getSetupStatus));
router.post("/register", resolvePublicTenant, asyncHandler(register));
router.post("/login", resolvePublicTenant, loginRateLimit, asyncHandler(login));
router.post("/forgot-password", resolvePublicTenant, asyncHandler(forgotPassword));
router.post("/reset-password", resolvePublicTenant, asyncHandler(resetPassword));
router.post("/verify-email", resolvePublicTenant, asyncHandler(verifyEmail));
router.get("/session", requireAuth, asyncHandler(getSession));
router.post("/logout", requireAuth, asyncHandler(logout));
router.get(
  "/users",
  requireAuth,
  allowRoles("saas_super_admin", "company_admin", "admin"),
  asyncHandler(getUsers),
);
router.post(
  "/users",
  requireAuth,
  allowRoles("saas_super_admin", "company_admin", "admin"),
  asyncHandler(createUser),
);
router.get("/profile", requireAuth, asyncHandler(getProfile));
router.patch("/profile", requireAuth, asyncHandler(updateProfile));

export default router;
