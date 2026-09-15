import { validateRequired } from "../middleware/validateRequest.js";
export const validateLogin = validateRequired("email", "password");
export const validateRegister = validateRequired("name", "email", "password");
