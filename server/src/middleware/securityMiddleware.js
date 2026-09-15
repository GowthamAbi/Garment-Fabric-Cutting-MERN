import ApiError from "../utils/ApiError.js";

const loginAttempts = new Map();

export function securityHeaders(request, response, next) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader("Permissions-Policy", "camera=(self), geolocation=(), microphone=()");
  response.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data: blob:; connect-src 'self' https:; style-src 'self' 'unsafe-inline'; script-src 'self'");
  if (process.env.NODE_ENV === "production") response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
}

export function loginRateLimit(request, _response, next) {
  const key = `${request.ip}:${String(request.body.email || "").toLowerCase()}`;
  const now = Date.now();
  const record = loginAttempts.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  if (record.resetAt < now) { record.count = 0; record.resetAt = now + 15 * 60 * 1000; }
  record.count += 1; loginAttempts.set(key, record);
  if (record.count > 10) return next(new ApiError(429, "Too many login attempts. Try again after 15 minutes"));
  next();
}

export function clearLoginAttempts(request) {
  const key = `${request.ip}:${String(request.body.email || "").toLowerCase()}`;
  loginAttempts.delete(key);
}
