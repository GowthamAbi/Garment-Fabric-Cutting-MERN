import { Router } from "express";
import { getReports } from "../controllers/reportController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.get("/", asyncHandler(getReports));
export default router;
