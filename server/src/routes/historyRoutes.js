import { Router } from "express";
import { getHistory } from "../controllers/historyController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
const router = Router();
router.get("/", asyncHandler(getHistory));
export default router;
