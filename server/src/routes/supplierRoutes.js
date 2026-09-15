import { Router } from "express";
import {
  createSupplier,
  deleteSupplier,
  getSuppliers,
} from "../controllers/supplierController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
const router = Router();
router.get("/", asyncHandler(getSuppliers));
router.post("/", asyncHandler(createSupplier));
router.delete("/:id", asyncHandler(deleteSupplier));
export default router;
