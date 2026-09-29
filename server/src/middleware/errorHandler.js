export function notFoundHandler(request, _response, next) {
  const error = new Error(`Route not found: ${request.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, _request, response, _next) {
  const statusCode =
    error.statusCode || (error.name === "ValidationError" ? 400 : 500);
  const message =
    statusCode >= 500 && process.env.NODE_ENV === "production"
      ? "Unexpected server error"
      : error.message || "Unexpected server error";

  response.status(statusCode).json({
    success: false,
    message,
  });
}
