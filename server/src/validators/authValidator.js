import { validateRequired } from "../middleware/validateRequest.js";
export const validateLogin = validateRequired("companyKey", "userId", "password");
export const validateRegister = validateRequired("name", "email", "password");
