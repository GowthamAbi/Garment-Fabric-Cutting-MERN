import { validateRequired } from "../middleware/validateRequest.js";
export const validatePurchaseOrder = validateRequired(
  "poNo",
  "itemCode",
  "deliveryDate",
  "orderQty",
);
