import { Router } from "express";
import { publicPlans, publicRequest, startPublicTrial } from "../controllers/saasController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.get("/plans", asyncHandler(publicPlans));
router.post("/request", asyncHandler(publicRequest));
router.post("/trial", asyncHandler(startPublicTrial));
export default router;
