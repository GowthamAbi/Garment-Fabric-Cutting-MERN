import ApiError from "../utils/ApiError.js";
export const validateRequired =
  (...fields) =>
  (req, _res, next) => {
    const missing = fields.filter((field) => !req.body[field]);
    return missing.length
      ? next(new ApiError(400, `Required: ${missing.join(", ")}`))
      : next();
  };
