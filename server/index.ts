import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startScheduler } from "./services/scheduler";
import { setupAuth } from "./replitAuth";

const app = express();

// 🧩 Extend request type
declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// 🔹 Body parsers
app.use(express.json({
  verify: (req, _res, buf) => {
    (req as any).rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// 🔹 Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine.slice(0, 80));
    }
  });

  next();
});

// 🚀 MAIN SERVER START
(async () => {
  // 🔐 Auth FIRST
  await setupAuth(app);

  // 🔗 Routes
  const server = await registerRoutes(app);

  // ❗ Error handler AFTER routes
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });

  // ⚡ Frontend
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ⏰ Scheduler
  startScheduler();

  // ✅ SINGLE SERVER START
  const port = parseInt(process.env.PORT || '5001', 10);

  server.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  });
})();