import { Router } from "express";
import {
  createPurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrders,
  updatePurchaseOrder,
} from "../controllers/purchaseOrderController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(getPurchaseOrders));
router.post("/", asyncHandler(createPurchaseOrder));
router.put("/:purchaseOrderId", asyncHandler(updatePurchaseOrder));
router.delete("/:purchaseOrderId", asyncHandler(deletePurchaseOrder));

export default router;
