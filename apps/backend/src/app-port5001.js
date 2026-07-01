import express from "express";
import { createServer } from "http";
import os from "os";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { initWebSocket } from "./infrastructure/websocket/websocketManager.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import cookieParser from "cookie-parser";
import multer from "multer";
import {
  pool,
  dbHelpers,
  testConnection,
} from "./infrastructure/database/postgres-helpers.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";
import { protect, admin } from "./middleware/auth.middleware.js";
import { validateCsrfToken } from "./middleware/csrf.middleware.js";
import { publicIdResponseMiddleware } from "./middleware/public-id-response.middleware.js";
import cacheControlMiddleware from "./middleware/cacheControl.js";
import { traceMiddleware } from "./middleware/trace.middleware.js";
import adminRoutes from "./api/routes/admin.js";

import testsRoutes from "./modules/tests/test.routes.js";
import questionsRoutes from "./api/routes/questions.js";
import studyRoutes from "./api/routes/study.js";
import usersRoutes from "./modules/users/user.routes.js";
import examEnrollmentRoutes from "./modules/users/exam-enrollment.routes.js";
import studyMaterialEnrollmentRoutes from "./modules/users/study-material-enrollment.routes.js";
import examRoutes from "./modules/exams/exam.routes.js";
import seriesRoutes from "./api/routes/series.js";
import examInfoRoutes from "./modules/exams/examInfo.routes.js";
import testCategoryRoutes from "./api/routes/testCategories.js";
import examCategoryRoutes from "./modules/exams/examCategory.routes.js";
import examYearlyRoutes from "./modules/exams/examYearly.routes.js";
import examSeasonsRoutes from "./modules/exams/exam-seasons.routes.js";
import bookmarksRoutes from "./api/routes/bookmarks.js";
import notificationsRoutes from "./api/routes/notifications.js";
import achievementsRoutes from "./api/routes/achievements.js";
import blogRoutes from "./api/routes/blog.js";
import referralsRoutes from "./api/routes/referrals.js";
import doubtsRoutes from "./api/routes/doubts.js";
import studyGroupsRoutes from "./api/routes/studyGroups.js";
import stageRoutes from "./api/routes/stages.js";
import paymentRoutes from "./api/routes/payments.js";
import currentAffairsRoutes from "./api/routes/currentAffairs.js";
import practiceRoutes from "./api/routes/practice.js";
import notificationsPrefRoutes from "./api/routes/notificationsPref.js";
import phoneAuthRoutes from "./api/routes/phoneAuth.js";
import attemptRoutes from "./modules/attempts/attempt.routes.js";
import authRoutes from "./modules/auth/auth.routes.js";
import subscriptionRoutes from "./api/routes/subscriptions.js";
import subscriptionAdminRoutes from "./api/routes/subscriptions-admin.js";
import intelligenceRoutes from "./api/routes/intelligence.js";
import discussionsRoutes from "./api/routes/discussions.js";
import promotionsRoutes from "./api/routes/promotions.js";
import tagConfigRoutes from "./api/routes/tagConfigs.js";
import pypHierarchyRoutes from "./api/routes/pyp-hierarchy.js";
import leaderboardAdminRoutes from "./api/routes/leaderboards-admin.js";
import enrollmentsAdminRoutes from "./api/routes/enrollments-admin.js";
import communityRoutes from "./api/routes/community.js";
import analyticsRoutes from "./api/routes/analytics.js";
import auditRoutes from "./api/routes/admin-audit.js";
import fortskyRoutes from "./api/routes/fortspy.js";
import importRoutes from "./modules/import/bulkImport.routes.js";
import adaptiveTestRoutes from "./modules/adaptive/adaptiveTest.routes.js";
import aiMentorRoutes from "./modules/ai/aiMentor.routes.js";
import aiExplanationRoutes from "./modules/ai/aiExplanation.routes.js";
import aiGenerationLogRoutes from "./modules/ai/aiGenerationLog.routes.js";
import topicAnalyticsRoutes from "./modules/analytics/topicAnalytics.routes.js";
import weakAreaDetectionRoutes from "./modules/analytics/weakAreaDetection.routes.js";
import liveMockRoutes from "./modules/live/liveMock.routes.js";
import rankingRoutes from "./modules/ranking/ranking.routes.js";
import smartRevisionRoutes from "./modules/revision/smartRevision.routes.js";
import questionSearchRoutes from "./modules/search/questionSearch.routes.js";
import vectorSearchRoutes from "./modules/search/vectorSearch.routes.js";
import testTemplateRoutes from "./modules/templates/testTemplate.routes.js";
import questionBuilderRoutes from "./modules/questions/questionBuilder.routes.js";
import testBuilderRoutes from "./modules/tests/testBuilder.routes.js";
import sectionRoutes from "./modules/sections/section.routes.js";
import {
  closeRedis,
  getRedisClient,
  getRedisStatus,
  initRedis,
} from "./infrastructure/cache/redisClient.js";
import {
  addJob,
  closeQueueResources,
  getQueueStatus,
  initQueues,
  isQueueEnabled,
  QUEUE_NAMES,
} from "./infrastructure/queue/queueManager.js";
import {
  monitoringMiddleware,
  metricsHandler,
  errorTrackingMiddleware,
} from "./middleware/monitoring.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const requiredEnvVars = ["DATABASE_URL", "JWT_SECRET", "FRONTEND_URL"];
const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingEnvVars.length > 0) {
  logger.error("Missing required environment variables", { missing: missingEnvVars });
  process.exit(1);
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32 || !/[A-Z]/.test(jwtSecret) || !/[a-z]/.test(jwtSecret) || !/[0-9]/.test(jwtSecret) || !/[^a-zA-Z0-9]/.test(jwtSecret)) {
  throw new Error("❌ JWT_SECRET must be at least 32 chars with mixed case, numbers, and special characters.");
}

const app = express();
const PORT = process.env.PORT || 5001;

const helmetOptions = {
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
};
if (process.env.NODE_ENV === "production") {
  helmetOptions.contentSecurityPolicy = {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || "http://localhost:3000"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  };
} else {
  helmetOptions.contentSecurityPolicy = {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || "http://localhost:3000", "ws:", "wss:", "http:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  };
}
app.use(helmet(helmetOptions));

const getLocalNetworkIPs = () => {
  const ips = [];
  for (const name in os.networkInterfaces()) {
    for (const iface of os.networkInterfaces()[name]) {
      if ((iface.family === "IPv4" || iface.family === 4) && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
};
const localIPs = getLocalNetworkIPs();
const PRIVATE_IP_REGEX = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/;
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_PANEL_URL,
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:3001",
  "http://localhost:3002",
].filter(Boolean);
const isDevelopment = process.env.NODE_ENV !== "production";

// Explicit LAN host allowlist (comma-separated host[:port] entries via env).
// Never wildcard-match private IP ranges — only explicitly-listed hosts are trusted.
const ALLOWED_LAN_HOSTS = (process.env.ALLOWED_LAN_HOSTS || "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean);
const allowedLanOrigins = new Set(
  ALLOWED_LAN_HOSTS.map((host) => host.startsWith("http") ? host : `http://${host}`),
);

const isLocalNetworkOrigin = (origin) => {
  if (!origin) return false;
  // Only allow origins explicitly listed in ALLOWED_LAN_HOSTS env var.
  if (allowedLanOrigins.has(origin)) return true;
  try {
    const hostname = new URL(origin).hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    return false;
  } catch { return false; }
};

const isAdminRequest = (req) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return false;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded && decoded.role === "admin";
  } catch { return false; }
};

const isAdminPanelRequest = (req) => {
  const origin = req.headers.origin;
  return [process.env.ADMIN_PANEL_URL, "http://localhost:3002", "http://localhost:3001"].filter(Boolean).includes(origin);
};

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10);
const GENERAL_RATE_LIMIT_MAX = parseInt(process.env.GENERAL_RATE_LIMIT_MAX || "1000", 10);
const generalLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: GENERAL_RATE_LIMIT_MAX,
  message: { success: false, message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => isAdminRequest(req) ? `admin-${req.ip}` : req.ip,
  // AUDIT-2026-07-01: removed isAdminPanelRequest(req) skip — admin panel
  // requests are subject to the general limiter. /api/admin/* is separately
  // governed by adminLimiter. Bypassing rate limits for any localhost origin
  // is unsafe if admin auth ever breaks.
  skip: (req) => req.path === "/health" || isAdminRequest(req),
});

// DX-05 / NEW-03: All rate-limiter values env-var driven for ops tuning.
const AUTH_RATE_LIMIT_WINDOW_MS = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || "900000", 10);
const AUTH_RATE_LIMIT_MAX = parseInt(process.env.AUTH_RATE_LIMIT_MAX || "20", 10);
const ADMIN_RATE_LIMIT_WINDOW_MS = parseInt(process.env.ADMIN_RATE_LIMIT_WINDOW_MS || "900000", 10);
const ADMIN_RATE_LIMIT_MAX = parseInt(process.env.ADMIN_RATE_LIMIT_MAX || "5000", 10);

const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  message: { success: false, message: "Too many authentication attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health" || isAdminRequest(req) || (req.method === "GET" && (req.path === "/me" || req.path === "/csrf")),
});

const adminLimiter = rateLimit({
  windowMs: ADMIN_RATE_LIMIT_WINDOW_MS,
  max: ADMIN_RATE_LIMIT_MAX,
  message: { success: false, message: "Too many admin requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];
      const decoded = token ? jwt.verify(token, process.env.JWT_SECRET) : null;
      return decoded?.id ? `admin-${decoded.id}` : `admin-ip-${req.ip}`;
    } catch { return `admin-ip-${req.ip}`; }
  },
});

// OBS-03: Reduced global body limit from 10MB to 1MB; upload routes override to 10MB.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(monitoringMiddleware);
app.use(publicIdResponseMiddleware);
app.use(traceMiddleware);

app.get("/favicon.ico", (req, res) => res.status(204).end());

app.get("/", (req, res) => {
  res.json({ success: true, message: "Welcome to Trstprep API", version: "2.1.0", status: "online", health: `${req.protocol}://${req.get("host")}/api/health` });
});

app.use(cors({
  origin: (origin, callback) => {
    if (isDevelopment && origin && process.env.REQUEST_METHOD !== "OPTIONS") logger.debug(`[CORS Check] Origin: ${origin}`);
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (isLocalNetworkOrigin(origin)) {
      logger.debug(`[CORS] Allowed LAN: ${origin}`);
      return callback(null, true);
    }
    if (isDevelopment) {
      try {
        const hostname = new URL(origin).hostname;
        const devOrigins = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];
        if (devOrigins.includes(hostname)) {
          logger.debug(`[CORS] Allowed Dev Host: ${origin}`);
          return callback(null, true);
        }
      } catch { /* ignore */ }
      logger.warn(`[CORS] Blocked unknown origin: ${origin}`);
      return callback(new Error(`Origin ${origin} not in development allowlist`));
    }
    logger.warn(`[CORS] Blocked origin: ${origin}`);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  exposedHeaders: ["X-CSRF-Token"],
  maxAge: 86400,
}));

app.use("/api", generalLimiter);
app.use(cacheControlMiddleware);
app.use("/api/auth", authLimiter, authRoutes);

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many uploads from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const fileUpload = multer({
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "video/mp4", "video/webm", "video/avi"];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type. Only images, PDFs, and videos are allowed."), false);
  },
});

app.use("/api/admin/upload", uploadLimiter, (req, res) => res.status(301).json({ success: true, message: "Deprecated. Use /api/admin/assets/upload", redirect: "/api/admin/assets/upload" }));
app.use("/api/admin/media/upload", uploadLimiter, (req, res) => res.status(301).json({ success: true, message: "Deprecated. Use /api/admin/assets/upload", redirect: "/api/admin/assets/upload" }));
app.use("/api/admin/assets/upload", uploadLimiter);

app.use("/uploads", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
}, express.static(path.join(__dirname, "uploads")));

app.use("/assets/avatar", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.join(__dirname, "..", "uploads", "avatars")));

app.use("/storage", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.join(__dirname, "..", "storage")));

app.get("/api/health", async (req, res) => {
  try {
    const dbHealth = typeof dbHelpers.healthCheck === "function" ? await dbHelpers.healthCheck() : await (async () => {
      const startedAt = Date.now();
      try {
        await pool.query("SELECT 1");
        return { healthy: true, latencyMs: Date.now() - startedAt, provider: "postgres" };
      } catch (err) {
        return { healthy: false, error: err.message, provider: "postgres" };
      }
    })();
    const redisHealth = getRedisStatus();
    const queueHealth = await getQueueStatus();

    const isProd = process.env.NODE_ENV === "production";

    // Sanitize dbHealth to prevent info leakage
    const cleanDbHealth = {
      healthy: dbHealth.healthy,
      latencyMs: dbHealth.latencyMs,
      provider: dbHealth.provider
    };
    if (!isProd && dbHealth.error) {
      cleanDbHealth.error = dbHealth.error;
    }

    // Sanitize redisHealth to prevent info leakage
    const cleanRedisHealth = {
      enabled: redisHealth?.enabled,
      connected: redisHealth?.connected,
      status: redisHealth?.status
    };
    if (!isProd && redisHealth?.error) {
      cleanRedisHealth.error = redisHealth.error;
    }

    // Sanitize queueHealth to prevent info leakage
    const cleanQueueHealth = {
      enabled: queueHealth?.enabled,
      status: queueHealth?.status
    };
    if (!isProd && queueHealth?.error) {
      cleanQueueHealth.error = queueHealth.error;
    }

    if (!cleanDbHealth.healthy) {
      return res.status(503).json({
        status: "degraded",
        message: "Database connection issues",
        database: "PostgreSQL",
        dbHealth: cleanDbHealth,
        redis: cleanRedisHealth,
        queues: cleanQueueHealth,
        timestamp: new Date().toISOString()
      });
    }

    const degraded = cleanRedisHealth.enabled && !cleanRedisHealth.connected;
    res.status(degraded ? 206 : 200).json({
      status: degraded ? "degraded" : "ok",
      message: degraded ? "API is running, but Redis/queue services are degraded" : "Trstprep API is running with PostgreSQL + Redis queue foundations",
      database: "PostgreSQL",
      dbHealth: cleanDbHealth,
      redis: cleanRedisHealth,
      queues: cleanQueueHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      message: "Health check failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

app.get("/api/metrics", protect, admin, (req, res) => metricsHandler(req, res));

app.use("/api/admin", adminLimiter, validateCsrfToken, adminRoutes);

app.use("/api/tests", testsRoutes);
app.use("/api/questions", questionsRoutes);
app.use("/api/study", studyRoutes);
app.use("/api/users", validateCsrfToken, usersRoutes);
app.use("/api/users", validateCsrfToken, examEnrollmentRoutes);
app.use("/api/users", validateCsrfToken, studyMaterialEnrollmentRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/exam-yearly", examYearlyRoutes);
app.use("/api/exam-seasons", examSeasonsRoutes);
app.use("/api/series", seriesRoutes);
app.use("/api/exam-info", examInfoRoutes);
app.use("/api/test-categories", testCategoryRoutes);
app.use("/api/exam-categories", examCategoryRoutes);
app.use("/api/bookmarks", validateCsrfToken, bookmarksRoutes);
app.use("/api/notifications", validateCsrfToken, notificationsRoutes);
app.use("/api/achievements", achievementsRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/referrals", validateCsrfToken, referralsRoutes);
app.use("/api/doubts", validateCsrfToken, doubtsRoutes);
app.use("/api/study-groups", validateCsrfToken, studyGroupsRoutes);
app.use("/api/stages", stageRoutes);
app.use("/api/payments", validateCsrfToken, paymentRoutes);
app.use("/api/current-affairs", validateCsrfToken, currentAffairsRoutes);
app.use("/api/attempt", protect, attemptRoutes);
app.use("/api/practice", validateCsrfToken, practiceRoutes);
app.use("/api/notifications-pref", validateCsrfToken, notificationsPrefRoutes);
app.use("/api/auth/phone", phoneAuthRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/admin/subscriptions", validateCsrfToken, subscriptionAdminRoutes);
app.use("/api/intelligence", validateCsrfToken, intelligenceRoutes);
app.use("/api/discussions", validateCsrfToken, discussionsRoutes);
app.use("/api/promotions", promotionsRoutes);
app.use("/api/tag-configs", tagConfigRoutes);
app.use("/api/pyps", pypHierarchyRoutes);
app.use("/api/leaderboards", validateCsrfToken, leaderboardAdminRoutes);
app.use("/api/enrollments", validateCsrfToken, enrollmentsAdminRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/analytics", validateCsrfToken, analyticsRoutes);
app.use("/api/admin/audit-logs", adminLimiter, validateCsrfToken, auditRoutes);
app.use("/api/fortspy", fortskyRoutes);
app.use("/api/import", importRoutes);

import sessionController from "./modules/sessions/session.controller.js";
const sessionRouter = express.Router();
sessionRouter.get('/', protect, sessionController.getMySessions);
sessionRouter.delete('/:sessionId', protect, validateCsrfToken, sessionController.revokeSession);
sessionRouter.delete('/', protect, validateCsrfToken, sessionController.revokeAllSessions);
app.use("/api/sessions", sessionRouter);

// MAINT-03 / NEW-01: Mount extracted public routes (formerly inline above).
// These modules live in api/routes/*-public.js with SQL-level filtering (PERF-02).
import { mountExtractedRoutes } from "./api/routes/public-routes-index.js";
import logger from "./infrastructure/logger/logger.js";
mountExtractedRoutes(app);

app.use("/api/adaptive", adaptiveTestRoutes);
app.use("/api/ai/mentor", aiMentorRoutes);
app.use("/api/ai/explanation", aiExplanationRoutes);
app.use("/api/ai/logs", aiGenerationLogRoutes);
app.use("/api/topic-analytics", topicAnalyticsRoutes);
app.use("/api/weak-areas", weakAreaDetectionRoutes);
app.use("/api/live-mock", liveMockRoutes);
app.use("/api/ranking", rankingRoutes);
app.use("/api/smart-revision", smartRevisionRoutes);
app.use("/api/search/questions", questionSearchRoutes);
app.use("/api/search/vector", vectorSearchRoutes);
app.use("/api/test-templates", testTemplateRoutes);
app.use("/api/question-builder", questionBuilderRoutes);
app.use("/api/test-builder", testBuilderRoutes);
app.use("/api/sections", sectionRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  try {
    const connected = await testConnection(5, 3000);
    if (!connected) { logger.error("Failed to connect to database after multiple attempts"); process.exit(1); }
    logger.info("Initializing WebSocket server...");
    const server = createServer(app);
    initWebSocket(server);
    logger.info("Starting server listener...");
    server.listen(PORT, "0.0.0.0", async () => {
      const localIPs = getLocalNetworkIPs();
      const primaryIP = localIPs[0] || "localhost";
      logger.info(`Server running on http://localhost:${PORT}`);
      localIPs.forEach((ip) => logger.info(`Network access: http://${ip}:${PORT}`));
      logger.info(`Frontend (port 3000) is configured to proxy requests here.`);
      logger.info(`WebSocket enabled: ws://${primaryIP}:${PORT}`);
      logger.info(`API Health: http://${primaryIP}:${PORT}/api/health`);
      try {
        logger.info("Running background database initialization...");
        await dbHelpers.initTables();
        logger.info("Initializing Redis and background queues...");
        await initRedis();
        global.redis = getRedisClient();
        initQueues();
        if (isQueueEnabled()) setInterval(async () => { try { await addJob(QUEUE_NAMES.NOTIFICATIONS, "notifications.scheduled-reminders", { name: "scheduled_reminder", payload: { inactivityHours: 24 }, emittedAt: new Date().toISOString() }); } catch { /* non-fatal */ } }, 6 * 60 * 60 * 1000);
        logger.info(`[Redis] ${getRedisStatus().message}`);
        logger.info(`[Queue] ${isQueueEnabled() ? "Enabled" : "Disabled"}`);
        logger.info(`Background initialization complete.`);
      } catch (error) { logger.error(`Background initialization error: ${error.message}`); }
      logger.info(`Available endpoints: /api/auth/*, /api/admin/*, /api/tests/*, /api/study/*`);
    });
  } catch (error) { logger.error(`Server startup error: ${error.message}`); process.exit(1); }
};

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  try { await closeQueueResources(); await closeRedis(); await dbHelpers.close(); logger.info("Database connections closed"); process.exit(0); } catch (error) { logger.error(`Error during shutdown: ${error.message}`); process.exit(1); }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (error) => { logger.error("Uncaught Exception", { message: error.message, stack: error.stack }); if (process.env.NODE_ENV === "production") process.exit(1); });
process.on("unhandledRejection", (reason, promise) => { logger.error("Unhandled Rejection", { reason: reason?.message || String(reason) }); if (process.env.NODE_ENV === "production") process.exit(1); });

startServer();
export default app;