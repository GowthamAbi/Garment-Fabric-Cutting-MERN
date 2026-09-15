import { Router } from "express";
import asyncHandler from "../middleware/asyncHandler.js";
import {
  createPublicOutward,
  getPublicInward,
} from "../controllers/publicOutwardController.js";

const router = Router();

router.get("/inwards/:inwardNo", asyncHandler(getPublicInward));
router.post("/outwards", asyncHandler(createPublicOutward));

export default router;
