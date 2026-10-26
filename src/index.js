import express from "express";
import cors from "cors";
import helmet from "helmet";
import { serve } from "inngest/express";
import { config } from "./config/env.js";
import { inngest, functions } from "./inngest/index.js";
import indexRoutes from "./routes/index.routes.js";
import chatRoutes from "./routes/chat.routes.js";

const app = express();

// Security and standard middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Inngest background job handler
app.use("/api/inngest", serve({ client: inngest, functions }));

// Health check endpoints
const healthHandler = (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
};

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// Root informational endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    name: "git-wiki-repo-chat",
    version: "1.0.0",
    status: "online",
    endpoints: {
      health: "GET /health",
      inngest: "ANY /api/inngest",
      indexRepo: "POST /api/index",
      chatAsync: "POST /api/chat",
      chatSync: "POST /api/chat/query",
    },
  });
});

// API Routes
app.use("/api/index", indexRoutes);
app.use("/api/chat", chatRoutes);

// 404 Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handling Middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled API error:", err);
  const status = err.status || err.statusCode || 500;
  const message = config.nodeEnv === "production" && status === 500
    ? "Internal server error"
    : err.message || "An unexpected error occurred.";

  res.status(status).json({
    success: false,
    error: message,
  });
});

const server = app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port} [${config.nodeEnv}]`);
});

// Graceful shutdown handling
function gracefulShutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forceful shutdown after timeout.");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;