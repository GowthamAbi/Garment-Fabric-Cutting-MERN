export function notFoundHandler(request, _response, next) {
  const error = new Error(`Route not found: ${request.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, request, response, _next) {
  const statusCode =
    error.statusCode || (error.code === 11000 ? 409 : ["ValidationError", "CastError"].includes(error.name) ? 400 : 500);
  if (statusCode >= 500) {
    console.error("API request failed", error.stack);
  }
  const message = error.code===11000 ? "An account or record with these details already exists" :
    error.name==="CastError" ? "Invalid record identifier or value" :
    statusCode >= 500 && process.env.NODE_ENV === "production" &&
      !(error.exposeToOwner === true && request.user?.role === "saas_super_admin")
      ? "Unexpected server error"
      : error.message || "Unexpected server error";

  response.status(statusCode).json({
    success: false,
    message,
  });
}
