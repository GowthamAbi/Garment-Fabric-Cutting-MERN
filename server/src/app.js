import express from "express";
import cors from "cors";
import morgan from "morgan";

import apiRoutes from "./routes/index.js";

import {
  errorHandler,
  notFoundHandler,
} from "./middleware/errorHandler.js";
import { securityHeaders } from "./middleware/securityMiddleware.js";

const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(securityHeaders);

// ==========================================
// CORS
// ==========================================

const allowedOrigins = [
  "http://localhost:5173",
  "https://store-inventory-app.netlify.app",

  ...(process.env.CLIENT_URL
    ? process.env.CLIENT_URL
        .split(",")
        .map((url) => url.trim().replace(/\/$/, ""))
    : []),
];

console.log("Allowed CORS origins:", allowedOrigins);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header
      // such as Postman / server-to-server requests.
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin =
        origin.replace(/\/$/, "");

      if (
        allowedOrigins.includes(
          normalizedOrigin
        )
      ) {
        return callback(null, true);
      }

      console.error(
        "CORS blocked origin:",
        origin
      );

      return callback(
        new Error(
          `CORS not allowed for origin: ${origin}`
        )
      );
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],

    credentials: true,
  })
);

// ==========================================
// BODY PARSER
// ==========================================

app.use(
  express.json({
    limit: "10mb",
    verify(request, _response, buffer) {
      if (request.originalUrl === "/api/webhooks/razorpay") request.rawBody = buffer.toString("utf8");
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

// ==========================================
// LOGGER
// ==========================================

app.use(morgan("dev"));

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message:
      "Store Inventory API is running",
  });
});

// ==========================================
// API ROUTES
// ==========================================

app.use("/api", apiRoutes);

// ==========================================
// 404
// ==========================================

app.use(notFoundHandler);

// ==========================================
// ERROR HANDLER
// ==========================================

app.use(errorHandler);

export default app;
