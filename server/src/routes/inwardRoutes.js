import { Router } from "express";
import { createInward } from "../controllers/inwardController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
const router = Router();
router.post("/", asyncHandler(createInward));
export default router;
