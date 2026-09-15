export function corsOptions() {
  return {
    origin: process.env.CLIENT_URL?.split(",") || "http://localhost:5173",
    credentials: true,
  };
}
