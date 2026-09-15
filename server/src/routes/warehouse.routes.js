import { Router } from "express";
import { deliverToSection, getWarehouse, transferRework } from "../controllers/warehouseController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.get("/", asyncHandler(getWarehouse));
router.post("/rework/:id", asyncHandler(transferRework));
router.post("/deliver/:id", asyncHandler(deliverToSection));
export default router;
