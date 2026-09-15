import { Router } from "express";
import {
  createItem,
  deleteItem,
  getItemByCode,
  getItemByCodeAndColour,
  getItems,
  getStockLots,
  updateItem,
} from "../controllers/itemController.js";
import { validateItem } from "../validators/itemValidator.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(getItems));
router.get("/stock-lots", asyncHandler(getStockLots));
router.get("/lookup", asyncHandler(getItemByCodeAndColour));
router.get("/:itemCode", asyncHandler(getItemByCode));
router.post("/", validateItem, asyncHandler(createItem));
router.put("/:itemId", validateItem, asyncHandler(updateItem));
router.delete("/:itemId", asyncHandler(deleteItem));

export default router;
