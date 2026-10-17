import { Router } from "express";
import ApiError from "../utils/ApiError.js";
import {strictAccess} from "../utils/accessPolicy.js";
import {
  deliverToSection,
  getWarehouse,
  transferRework,
} from "../controllers/warehouseController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
// Legacy WarehouseStock rows predate factory-level scoping. Block modern
// delegated identities and require the canonical ERP Warehouse endpoints.
router.use((req,_res,next)=>strictAccess(req.user)&&req.user.role!=="company_owner"?
 next(new ApiError(403,"Use factory-scoped ERP Warehouse; legacy stock is not factory-isolated")):next());
router.get("/", asyncHandler(getWarehouse));
router.post("/rework/:id", asyncHandler(transferRework));
router.post("/deliver/:id", asyncHandler(deliverToSection));
export default router;
