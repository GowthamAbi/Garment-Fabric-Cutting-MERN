import ApiError from "../utils/ApiError.js";
export const allowRoles =
  (...roles) =>
  (req, _res, next) =>
    roles.includes(req.user?.role)
      ? next()
      : next(new ApiError(403, "Access denied"));
