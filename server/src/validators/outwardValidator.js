import { validateRequired } from "../middleware/validateRequest.js";
export const validateOutward = validateRequired("itemCode", "quantity");
