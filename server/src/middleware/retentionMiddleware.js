import ApiError from "../utils/ApiError.js";

export function preventPermanentDeletion(request, _response, next) {
  if (request.user?.readOnly && request.method !== "GET")
    return next(new ApiError(403, "Customer support access is read-only"));
  if (request.method !== "DELETE") return next();
  return next(new ApiError(
    405,
    "Permanent deletion is disabled by the company data-retention lock. Use cancel, reverse, archive or deactivate instead",
  ));
}
