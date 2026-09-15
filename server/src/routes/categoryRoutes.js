import { Router } from "express";
import {
  createCategory,
  deleteCategory,
  getCategories,
} from "../controllers/categoryController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
const router = Router();
router.get("/", asyncHandler(getCategories));
router.post("/", asyncHandler(createCategory));
router.delete("/:id", asyncHandler(deleteCategory));
export default router;
