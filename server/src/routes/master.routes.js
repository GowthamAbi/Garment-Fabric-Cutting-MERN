import { Router } from "express";
import { getMasterRecords, saveMasterRecord } from "../controllers/masterController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
const router = Router();
router.get("/", asyncHandler(getMasterRecords));
router.post("/", asyncHandler(saveMasterRecord));
router.put("/:id", asyncHandler(saveMasterRecord));
export default router;
