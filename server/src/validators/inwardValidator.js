import { validateRequired } from "../middleware/validateRequest.js";
export const validateInward = validateRequired("itemCode", "quantity");
