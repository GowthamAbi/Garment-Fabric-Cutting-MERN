import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { allocateOutward, createOutward, getOutward, listOutwards } from "../controllers/outwardController.js";
const router = Router();
router.get("/", asyncHandler(listOutwards));
router.post("/", asyncHandler(createOutward));
router.get("/:outwardNo", asyncHandler(getOutward));
router.post("/:outwardNo/allocate", asyncHandler(allocateOutward));
export default router;
