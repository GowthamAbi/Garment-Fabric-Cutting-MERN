import { Router } from "express";
import { createOutward } from "../controllers/outwardController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
const router = Router();
router.post("/", asyncHandler(createOutward));
export default router;
