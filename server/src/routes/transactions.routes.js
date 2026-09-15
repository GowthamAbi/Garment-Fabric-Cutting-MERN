import { Router } from "express";
import {
  getTransactions,
  getTransactionByReference,
  getOutwardsByDcNo,
  saveInward,
  saveOutward,
} from "../controllers/transactionController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/", asyncHandler(getTransactions));
router.get("/reference/:referenceNo", asyncHandler(getTransactionByReference));
router.get("/dc/:dcNo", asyncHandler(getOutwardsByDcNo));
router.post("/inward", asyncHandler(saveInward));
router.post("/outward", asyncHandler(saveOutward));

export default router;
