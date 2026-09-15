import { Router } from "express";
import {
  createSection,
  deleteSection,
  getSections,
} from "../controllers/sectionController.js";
import { asyncHandler } from "../utils/asyncHandler.js";
const router = Router();
router.get("/", asyncHandler(getSections));
router.post("/", asyncHandler(createSection));
router.delete("/:id", asyncHandler(deleteSection));
export default router;
