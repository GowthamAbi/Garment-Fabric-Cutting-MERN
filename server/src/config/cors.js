function normalizeOrigin(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

const configuredOrigins = String(process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map(normalizeOrigin)
  .filter(Boolean);

export const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const normalized = normalizeOrigin(origin);
    const localDevelopment = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(normalized);
    if (configuredOrigins.includes(normalized) || localDevelopment) return callback(null, true);
    return callback(Object.assign(new Error(`CORS blocked origin: ${origin}`), { statusCode: 403 }));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-company-id", "x-factory-id", "x-user-name", "x-user-role"],
  credentials: true,
  optionsSuccessStatus: 204,
};
