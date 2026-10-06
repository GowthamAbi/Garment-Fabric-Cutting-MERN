import ApiError from "../utils/ApiError.js";

const loginAttempts = new Map();
const publicFormAttempts = new Map();

export function securityHeaders(request, response, next) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private",
  );
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  response.setHeader(
    "Permissions-Policy",
    "camera=(self), geolocation=(), microphone=()",
  );
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: blob:; connect-src 'self' https:; style-src 'self' 'unsafe-inline'; script-src 'self'",
  );
  if (process.env.NODE_ENV === "production")
    response.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  next();
}

export function trustedMutationOrigin(allowedOrigins) {
  return function verifyMutationOrigin(request, _response, next) {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
    if (request.originalUrl === "/api/webhooks/razorpay") return next();

    const origin = String(request.headers.origin || "").replace(/\/$/, "");
    const hasBearerToken = request.headers.authorization?.startsWith("Bearer ");
    const isCredentiallessAuthRequest =
      !origin &&
      !request.headers.cookie &&
      /^\/api\/auth\/(login|register|forgot-password|reset-password|verify-email)$/.test(
        request.originalUrl,
      );

    if (
      (origin && allowedOrigins.has(origin)) ||
      (!origin && hasBearerToken) ||
      isCredentiallessAuthRequest
    ) {
      return next();
    }

    return next(new ApiError(403, "Untrusted request origin"));
  };
}

export function loginRateLimit(request, _response, next) {
  const key = `${request.ip}:${String(request.body.companyKey || request.get("x-company-key") || "platform").toLowerCase()}:${String(request.body.userId || request.body.email || "").toLowerCase()}`;
  const now = Date.now();
  const record = loginAttempts.get(key) || {
    count: 0,
    resetAt: now + 15 * 60 * 1000,
  };
  if (record.resetAt < now) {
    record.count = 0;
    record.resetAt = now + 15 * 60 * 1000;
  }
  record.count += 1;
  loginAttempts.set(key, record);
  if (record.count > 10)
    return next(
      new ApiError(429, "Too many login attempts. Try again after 15 minutes"),
    );
  next();
}

export function clearLoginAttempts(request) {
  const key = `${request.ip}:${String(request.body.companyKey || request.get("x-company-key") || "platform").toLowerCase()}:${String(request.body.userId || request.body.email || "").toLowerCase()}`;
  loginAttempts.delete(key);
}

export function publicFormRateLimit(request, _response, next) {
  const now = Date.now();
  const key = request.ip;
  const record = publicFormAttempts.get(key) || {
    count: 0,
    resetAt: now + 60 * 60 * 1000,
  };

  if (record.resetAt < now) {
    record.count = 0;
    record.resetAt = now + 60 * 60 * 1000;
  }

  record.count += 1;
  publicFormAttempts.set(key, record);

  if (record.count > 8) {
    return next(
      new ApiError(429, "Too many requests. Please try again after one hour"),
    );
  }

  next();
}
