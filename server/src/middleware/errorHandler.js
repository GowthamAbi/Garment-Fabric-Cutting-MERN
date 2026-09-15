export function notFoundHandler(request, _response, next) {
  const error = new Error(`Route not found: ${request.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, _request, response, _next) {
  const statusCode =
    error.statusCode || (error.name === "ValidationError" ? 400 : 500);

  response.status(statusCode).json({
    success: false,
    message: error.message || "Unexpected server error",
  });
}
