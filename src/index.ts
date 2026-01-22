import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { ZodError } from "zod";
import { connectDb } from "./db";
import { config } from "./config";
import { authRoutes } from "./routes/authRoutes";
import { userRoutes } from "./routes/userRoutes";
import { createAuctionRoutes } from "./routes/auctionRoutes";
import { webhookRoutes } from "./routes/webhookRoutes";
import { adminRoutes } from "./routes/adminRoutes";
import { HttpError } from "./utils/errors";
import { AuctionHub } from "./ws/auctionHub";
import { attachWebSocket } from "./ws/server";
import { startAuctionScheduler } from "./services/auctionScheduler";
import { createBidWorker, setBidQueueHub } from "./services/bidQueue";
import { redis } from "./services/redis";
import { rateLimitMiddleware } from "./utils/rateLimitGlobal";

async function bootstrap() {
  await connectDb();

  const app = express();
  
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "https://telegram.org"],
        frameSrc: ["'self'", "https://oauth.telegram.org"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  const defaultOrigins = ['http://localhost', 'http://localhost:80', 'http://localhost:5173', 'http://localhost:8080'];
  const customOrigins = process.env.FRONTEND_URL 
    ? process.env.FRONTEND_URL.split(',').map(o => o.trim().replace(/\/$/, ''))
    : [];
  const allowedOrigins = [...new Set([...defaultOrigins, ...customOrigins])];
  
  app.use(cors({
    origin: (origin, callback) => {
      // Разрешаем запросы без origin (например, от того же домена через nginx)
      if (!origin) {
        callback(null, true);
        return;
      }
      // Проверяем точное совпадение origin
      const normalizedOrigin = origin.replace(/\/$/, '');
      if (allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Применяем express.raw() только к webhook пути ДО express.json()
  app.use("/api/webhook/cryptobot", express.raw({ type: "application/json", limit: "100kb" }));
  
  // Webhook роуты должны быть ДО express.json(), чтобы получить raw body для проверки подписи
  app.use("/api", webhookRoutes);

  app.use(express.json({ limit: "1mb" }));
  app.use(rateLimitMiddleware);

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.get("/api/config", (_req, res) => res.json({
    telegramBotUsername: config.telegramBotUsername || null,
  }));

  app.use("/api", authRoutes);
  app.use("/api", userRoutes);
  app.use("/api", adminRoutes);

  const hub = new AuctionHub();
  setBidQueueHub(hub);
  const bidWorker = createBidWorker();
  app.use("/api/auctions", createAuctionRoutes(hub));

  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      const issues = err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      console.error(`[ERROR] Validation error: ${issues}`, { path: req.path, method: req.method });
      return res.status(400).json({ error: `Validation error: ${issues}` });
    }
    if (err instanceof HttpError) {
      // Логируем ошибки 400 для диагностики webhook проблем
      if (err.status === 400) {
        console.error(`[ERROR] ${err.status} ${err.message}`, { 
          path: req.path, 
          method: req.method,
          headers: req.headers,
        });
      } else {
        console.error(`[ERROR] ${err.status} ${err.message}`, { path: req.path, method: req.method });
      }
      return res.status(err.status).json({ error: err.message });
    }
    if (err instanceof Error) {
      // Always log errors to stderr for debugging
      console.error(`[ERROR] ${err.message}`, err.stack?.split('\n').slice(0, 3).join('\n'));
      
      const isProduction = process.env.NODE_ENV === 'production';
      return res.status(500).json({ 
        error: isProduction ? "Internal server error" : err.message 
      });
    }
    console.error('[ERROR] Unknown error:', err);
    return res.status(500).json({ error: "Internal server error" });
  });

  const server = http.createServer(app);
  attachWebSocket(server, hub);
  startAuctionScheduler(hub);

  server.listen(config.port, () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Server listening on ${config.port}`);
    }
  });

  process.on("SIGTERM", async () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log("SIGTERM received, shutting down gracefully");
    }
    await bidWorker.close();
    await redis.quit();
    server.close(() => {
      process.exit(0);
    });
  });
}

bootstrap().catch((err) => {
  console.error("Failed to start:", err instanceof Error ? err.message : "Unknown error");
  process.exit(1);
});
