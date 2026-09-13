export function notFound(request, _response, next) {
  next(Object.assign(new Error(`Route not found: ${request.method} ${request.originalUrl}`), { statusCode: 404 }));
}

export function errorHandler(error, _request, response, _next) {
  console.error(error);
  response.status(error.statusCode || 500).json({ success: false, message: error.message || "Server error" });
}
