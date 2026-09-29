import { Router } from "express";
import {
  publicPlans,
  publicRequest,
  startPublicTrial,
} from "../controllers/saasController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { publicFormRateLimit } from "../middleware/securityMiddleware.js";

const router = Router();
router.get("/plans", asyncHandler(publicPlans));
router.post("/request", publicFormRateLimit, asyncHandler(publicRequest));
router.post("/trial", publicFormRateLimit, asyncHandler(startPublicTrial));
export default router;
