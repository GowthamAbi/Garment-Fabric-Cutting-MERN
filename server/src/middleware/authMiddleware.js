import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";
import { tenantContext } from "../utils/tenantContext.js";

export function requireAuth(request, _response, next) {
  const token = request.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return next(new ApiError(401, "Please login to continue"));
  }

  try {
    request.user = jwt.verify(token, process.env.JWT_SECRET);
    tenantContext.run(request.user, next);
  } catch {
    next(new ApiError(401, "Your login is invalid or expired"));
  }
}
