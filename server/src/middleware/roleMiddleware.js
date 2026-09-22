import ApiError from "../utils/ApiError.js";
export const allowRoles =
  (...roles) =>
  (req, _res, next) => {
    if (!roles.includes(req.user?.role))
      return next(new ApiError(403, "Access denied"));

    if (req.user?.role === "company_admin" && req.method !== "GET") {
      const allowedManagementMutation = [
        "/fabric-cutting/masters",
        "/fabric-cutting/process-masters",
        "/fabric-cutting/item-masters",
        "/garments/boms",
        "/auth/users",
        "/saas/subscription",
        "/fabric-cutting/actuals",
        "/fabric-cutting/inwards",
        "/fabric-cutting/plans/",
        "/production/cutting-machine-plans",
      ].some((path) => req.originalUrl.includes(path));
      if (!allowedManagementMutation)
        return next(
          new ApiError(
            403,
            "Company Admin has management view only; operational entry is restricted",
          ),
        );
    }
    next();
  };

export const allowDepartment =
  (department, ...roles) =>
  (request, response, next) => {
    const genericDepartmentRole = [
      "department_incharge",
      "department_entry",
    ].includes(request.user?.role);
    if (
      genericDepartmentRole &&
      String(request.user?.department || "").toUpperCase() === department
    )
      return next();
    return allowRoles(...roles)(request, response, next);
  };
