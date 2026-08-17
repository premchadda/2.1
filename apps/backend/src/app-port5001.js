import express from "express"; // trigger-reload-v3
import dns from "dns";
// Force IPv4-first DNS resolution (Supabase IPv6 often fails to resolve locally)
dns.setDefaultResultOrder("ipv4first");
import * as Sentry from "@sentry/node";
import { createServer } from "http";
import os from "os";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import compressionMiddleware from "./middleware/compression.js";
import { drainEmailQueue } from "./infrastructure/email/emailService.js";
import responseCache from "./middleware/responseCache.js";
import requestDedup from "./middleware/requestDedup.js";
import imageOptimization from "./middleware/imageOptimization.js";
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
import { runMigrations } from "./infrastructure/database/migrationRunner.js";
import { warmPools } from "../config/database-replicas.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";
import { protect, admin, requireImageAuth } from "./middleware/auth.middleware.js";
import { validateCsrfToken } from "./middleware/csrf.middleware.js";
import { validateOrigin } from "./middleware/origin.middleware.js";
import { publicIdResponseMiddleware } from "./middleware/public-id-response.middleware.js";
import cacheControlMiddleware from "./middleware/cacheControl.js";
import { traceMiddleware } from "./middleware/trace.middleware.js";
import adminRoutes from "./api/routes/admin.js";
import { mountExtractedRoutes } from "./api/routes/public-routes-index.js";
import logger from "./infrastructure/logger/logger.js";

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
import subscriptionService from "./services/SubscriptionService.js";
import certificateService from "./services/certificateService.js";
import subscriptionRoutes from "./api/routes/subscriptions.js";
import subscriptionAdminRoutes from "./api/routes/subscriptions-admin.js";
import sessionController from "./modules/sessions/session.controller.js";
import mathRoutes from "./modules/ai/math.routes.js";
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
import { mountAdminRoutes } from "./api/routes/admin-routes-index.js";
import { adminIpAllowlist } from "./middleware/adminIpAllowlist.middleware.js";
import { setupSwagger } from "./api/docs/swagger.js";
import fortskyRoutes from "./api/routes/fortspy.js";
import importRoutes from "./modules/import/bulkImport.routes.js";
import adaptiveTestRoutes from "./modules/adaptive/adaptiveTest.routes.js";
import aiMentorRoutes from "./modules/ai/aiMentor.routes.js";
import aiExplanationRoutes from "./modules/ai/aiExplanation.routes.js";
import aiGenerationLogRoutes from "./modules/ai/aiGenerationLog.routes.js";
import embeddingRoutes from "./modules/ai/embedding.routes.js";
import nodeEngineRoutes from "./modules/nodeEngine/nodeEngine.routes.js";
import adaptiveDifficultyRoutes from "./modules/ai/adaptiveDifficulty.routes.js";
import topicAnalyticsRoutes from "./modules/analytics/topicAnalytics.routes.js";
import weakAreaDetectionRoutes from "./modules/analytics/weakAreaDetection.routes.js";
import liveMockRoutes from "./modules/live/liveMock.routes.js";
import liveTestsPublicRoutes from "./api/routes/live-tests-public.js";
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
import { messageBroker } from './infrastructure/events/messageBroker.js'
import { registerUserEventSubscribers } from './modules/users/userEventSubscribers.js'
import { startScheduler, stopScheduler } from "./services/core/testScheduler.js";
import {
  startOutboxPoller,
  stopOutboxPoller,
  startAttemptCleaner,
  stopAttemptCleaner,
} from "./infrastructure/queue/outboxPoller.js";

import { unlinkSync, existsSync } from "fs";
import { writeFile } from "fs/promises";
import { sanitizeErrorMessage } from './utils/sanitizeError.js';

const READY_FILE = path.join(process.cwd(), ".backend-ready");

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Provide defaults for optional URLs
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "https://trstprep.vercel.app";
process.env.ADMIN_PANEL_URL = process.env.ADMIN_PANEL_URL || "https://trstprep-admin.vercel.app";

// If JWT_REFRESH_SECRET is missing but JWT_SECRET is provided, derive a secure cryptographic fallback
if (!process.env.JWT_REFRESH_SECRET && process.env.JWT_SECRET) {
  process.env.JWT_REFRESH_SECRET = crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update("trstprep-refresh-key-salt")
    .digest("hex");
  console.warn("⚠️ JWT_REFRESH_SECRET not explicitly set. Derived secure HMAC fallback from JWT_SECRET.");
}

const requiredEnvVars = ["DATABASE_URL", "JWT_SECRET"];
const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingEnvVars.length > 0) {
  const errMsg = `❌ Missing required environment variable(s): ${missingEnvVars.join(", ")}. Please set them in your deployment dashboard.`;
  console.error(errMsg);
  logger.error(errMsg);
  process.exit(1);
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32 || !/[A-Z]/.test(jwtSecret) || !/[a-z]/.test(jwtSecret) || !/[0-9]/.test(jwtSecret) || !/[^a-zA-Z0-9]/.test(jwtSecret)) {
  throw new Error("❌ JWT_SECRET must be at least 32 chars with mixed case, numbers, and special characters.");
}

// A02 Cryptographic Failures — Block known-compromised secrets that were leaked in git history.
// SHA-256 hashes of the leaked secrets; we compare hashes to avoid re-embedding the plaintext.
const hashSecret = (s) => crypto.createHash("sha256").update(s).digest("hex");
const COMPROMISED_SECRET_HASHES = new Set([
  "c3ac812763de696d1f1fbf8ab3f69e01d4e0211eb82a7381ba417e1202aceacc", // leaked JWT_SECRET
  "26d9fb6b2ab8af744a319970f172277d77a4065dec221286d10a4d24c891172b", // leaked JWT_REFRESH_SECRET
]);
const jwtSecretHash = hashSecret(jwtSecret);
const refreshSecretHash = hashSecret(process.env.JWT_REFRESH_SECRET || "");
if (COMPROMISED_SECRET_HASHES.has(jwtSecretHash) || COMPROMISED_SECRET_HASHES.has(refreshSecretHash)) {
  throw new Error(
    "❌ SECURITY: JWT_SECRET or JWT_REFRESH_SECRET matches a known-compromised value that was leaked in git history. " +
    "Rotate IMMEDIATELY: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" — " +
    "See docs/SECURITY.md for the full rotation runbook."
  );
}

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || "production" });
}

const app = express();
const PORT = process.env.PORT || 5001;

app.use(compressionMiddleware);

// FIX #14: Enable strong ETags for JSON API responses (static mounts already set etag).
app.set('etag', 'strong');
// Trust proxy so req.ip reflects the real client IP when behind nginx/load balancer.
// 1 = trust one hop (the nginx proxy directly in front of us). Increase if there's
// a CDN in front (e.g., 2 for Cloudflare -> nginx -> Express).
app.set('trust proxy', 1);

const helmetOptions = {
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
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
      scriptSrc: ["'self'", "https://checkout.razorpay.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: [
        "'self'",
        process.env.FRONTEND_URL,
        process.env.ADMIN_PANEL_URL,
        "https://trstprep.vercel.app",
        "https://trstprep-admin.vercel.app",
        "https://trstprep.com",
        "https://www.trstprep.com",
        "https://api.razorpay.com",
        "https://*.supabase.co",
        "wss:",
        "ws:",
      ].filter(Boolean),
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", "https://api.razorpay.com"],
    },
  };
} else {
  helmetOptions.contentSecurityPolicy = {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://checkout.razorpay.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || "http://localhost:3000", "ws:", "wss:", "http:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", "https://api.razorpay.com"],
    },
  };
}
// HTTPS redirection middleware in production (Issue: Add HTTPS enforcement)
if (process.env.NODE_ENV === "production" && process.env.ENFORCE_HTTPS === "true") {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] !== "https") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
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
  process.env.CLIENT_URL,
  "https://trstprep.vercel.app",
  "https://trstprep-admin.vercel.app",
  "https://trstprep.com",
  "https://www.trstprep.com",
  ...(process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
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
  // In development, allow localhost/loopback and private IPv4 LAN addresses (e.g. 10.x.x.x, 192.168.x.x, 172.16-31.x.x).
  if (isDevelopment) {
    try {
      const hostname = new URL(origin).hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "0.0.0.0") return true;
      if (localIPs.includes(hostname) || PRIVATE_IP_REGEX.test(hostname)) return true;
    } catch { return false; }
  }
  return false;
};


const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10);
const GENERAL_RATE_LIMIT_MAX = parseInt(process.env.GENERAL_RATE_LIMIT_MAX || "1000", 10);
const generalLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: GENERAL_RATE_LIMIT_MAX,
  message: { success: false, message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown',
  // AUDIT-2026-07-01: removed isAdminPanelRequest(req) skip — admin panel
  // requests are subject to the general limiter. /api/admin/* is separately
  // governed by adminLimiter. Bypassing rate limits for any localhost origin
  // is unsafe if admin auth ever breaks.
  skip: (req) => req.path === "/health" || (process.env.NODE_ENV !== "production" && req.headers["x-load-test"] === "true"),
});

// DX-05 / NEW-03: All rate-limiter values env-var driven for ops tuning.
const AUTH_RATE_LIMIT_WINDOW_MS = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || "900000", 10);
const AUTH_RATE_LIMIT_MAX = parseInt(process.env.AUTH_RATE_LIMIT_MAX || "20", 10);
const ADMIN_RATE_LIMIT_WINDOW_MS = parseInt(process.env.ADMIN_RATE_LIMIT_WINDOW_MS || "900000", 10);
const ADMIN_RATE_LIMIT_MAX = parseInt(process.env.ADMIN_RATE_LIMIT_MAX || "500", 10);

const authLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  message: { success: false, message: "Too many authentication attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === "/health" || (req.method === "GET" && (req.path === "/me" || req.path === "/csrf")),
});

  const isDev = process.env.NODE_ENV === 'development';
  const adminLimiter = rateLimit({
    windowMs: ADMIN_RATE_LIMIT_WINDOW_MS,
    max: isDev ? ADMIN_RATE_LIMIT_MAX * 100 : ADMIN_RATE_LIMIT_MAX,
    message: { success: false, message: "Too many admin requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `admin-ip-${req.ip || req.headers['x-forwarded-for'] || 'unknown'}`,
  });

// OBS-03: Reduced global body limit from 10MB to 1MB; upload routes override to 10MB.
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
// Sanitize URL to avoid leaking PII in query logs (Issue #164)
morgan.token("url-sanitize", (req) => {
  const urlStr = req.originalUrl || req.url || "";
  try {
    const [path, query] = urlStr.split("?");
    if (!query) return urlStr;
    const searchParams = new URLSearchParams(query);
    const sensitive = ["token", "email", "phone", "otp", "password", "key", "refresh_token", "code", "secret"];
    let changed = false;
    for (const key of sensitive) {
      if (searchParams.has(key)) {
        searchParams.set(key, "[MASKED]");
        changed = true;
      }
    }
    return changed ? `${path}?${searchParams.toString()}` : urlStr;
  } catch {
    return urlStr;
  }
});

const morganFormat = process.env.NODE_ENV === "production"
  ? ":method :url-sanitize :status :response-time ms"
  : "dev";
app.use(morgan(morganFormat));
app.use(monitoringMiddleware);
app.use(publicIdResponseMiddleware);
app.use(traceMiddleware);

app.get("/favicon.ico", (req, res) => res.status(204).end());

app.get("/", (req, res) => {
  res.json({ success: true, message: "Welcome to Trstprep API", version: "2.1.0", status: "online", health: `${req.protocol}://${req.get("host")}/api/health` });
});

app.get('/health', async (req, res) => {
  const health = { status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() };
  try {
    await pool.query('SELECT 1');
    health.db = 'connected';
  } catch (e) {
    health.db = 'disconnected';
    health.status = 'degraded';
  }
  // Check Redis if available
  if (global.redis) {
    try {
      await global.redis.ping();
      health.redis = 'connected';
    } catch (e) {
      health.redis = 'disconnected';
    }
  }
  if (process.env.NODE_ENV === 'production') {
    return res.status(health.status === 'ok' ? 200 : 503).json({
      status: health.status,
      timestamp: health.timestamp,
    });
  }
  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
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
    // M1: localhost/loopback origins are only permitted in development. A
    // misconfigured NODE_ENV (e.g. unset, "staging") will NOT fall through to
    // this dev allowlist.
    if (isDevelopment) {
      try {
        const hostname = new URL(origin).hostname;
        const devOrigins = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]", ...localIPs];
        const devPorts = ["3000", "3001", "3002", "5001", "5173"];
        const url = new URL(origin);
        const isDevHost = devOrigins.includes(hostname) || PRIVATE_IP_REGEX.test(hostname);
        if (isDevHost && (devPorts.includes(url.port) || !url.port)) {
          logger.debug(`[CORS] Allowed Dev Origin: ${origin}`);
          return callback(null, true);
        }
        if (isDevHost) {
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
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Admin-API-Key"],
  exposedHeaders: ["X-CSRF-Token"],
  maxAge: 86400,
}));

// Origin validation — CSRF defense-in-depth for state-changing requests.
// Applied globally so it also covers /api/auth/refresh (which CSRF token
// validation intentionally skips). GET/HEAD/OPTIONS and webhook callbacks are
// exempt inside the middleware itself.
app.use(validateOrigin);

app.use("/api", generalLimiter);
app.use(requestDedup);
app.use(responseCache({
  ttl: parseInt(process.env.RESPONSE_CACHE_TTL || "300", 10),
  excludePaths: ['/api/auth', '/api/users', '/api/me', '/api/sessions', '/api/admin']
}));
app.use(cacheControlMiddleware);
app.use("/api/auth", authLimiter, authRoutes);

const UPLOAD_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const UPLOAD_RATE_LIMIT_MAX = parseInt(process.env.UPLOAD_RATE_LIMIT_MAX || "10", 10);
const MAX_UPLOAD_FILE_SIZE = parseInt(process.env.MAX_UPLOAD_FILE_SIZE || String(50 * 1024 * 1024), 10);

const uploadLimiter = rateLimit({
  windowMs: UPLOAD_RATE_LIMIT_WINDOW_MS,
  max: UPLOAD_RATE_LIMIT_MAX,
  message: { success: false, message: "Too many uploads from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const fileUpload = multer({
  limits: { fileSize: MAX_UPLOAD_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "video/mp4", "video/webm", "video/avi"];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Invalid file type. Only images, PDFs, and videos are allowed."), false);
  },
});

app.use("/api/admin/assets/upload", uploadLimiter);

// QUESTION ENGINE FIX #5 (HIGH): question/answer/solution images under
// /uploads and /storage must not be publicly fetchable. Guard image requests
// with requireImageAuth (valid session required). Non-image files keep flowing
// publicly for backward compatibility (study-material PDFs, etc.), and the
// public avatar/banner route below is intentionally left unguarded.
const IMAGE_EXT_RE = /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i

app.use("/uploads", (req, res, next) => {
  if (IMAGE_EXT_RE.test(req.path)) return requireImageAuth(req, res, next);
  next();
}, (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
}, express.static(path.join(__dirname, "uploads"), { maxAge: "7d", etag: true }));

// Avatars/banners are public profile assets — left unauthenticated by design.
app.use("/assets/avatar", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.join(__dirname, "..", "uploads", "avatars"), {
  // Avatar/banner filenames are timestamped and never mutated in place, so
  // they can be cached aggressively and treated as immutable by the browser.
  maxAge: "30d",
  immutable: true,
  etag: true,
}));

app.use("/storage", (req, res, next) => {
  if (IMAGE_EXT_RE.test(req.path)) return requireImageAuth(req, res, next);
  next();
}, (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(path.join(__dirname, "..", "storage"), { maxAge: "7d", etag: true }));

app.use("/uploads", imageOptimization);

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
        dbHealth: isProd ? { healthy: false } : cleanDbHealth,
        redis: isProd ? { enabled: cleanRedisHealth.enabled } : cleanRedisHealth,
        queues: isProd ? { enabled: cleanQueueHealth.enabled } : cleanQueueHealth,
        timestamp: new Date().toISOString()
      });
    }

    const degraded = cleanRedisHealth.enabled && !cleanRedisHealth.connected;
    res.status(degraded ? 206 : 200).json({
      status: degraded ? "degraded" : "ok",
      message: degraded ? "API is running, but Redis/queue services are degraded" : "Trstprep API is running with PostgreSQL + Redis queue foundations",
      database: "PostgreSQL",
      dbHealth: isProd ? { healthy: cleanDbHealth.healthy, latencyMs: cleanDbHealth.latencyMs } : cleanDbHealth,
      redis: isProd ? { enabled: cleanRedisHealth.enabled, connected: cleanRedisHealth.connected } : cleanRedisHealth,
      queues: isProd ? { enabled: cleanQueueHealth.enabled } : cleanQueueHealth,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      message: "Health check failed",
      error: process.env.NODE_ENV === "development" ? sanitizeErrorMessage(error) : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================================
// FIX 2.5: /metrics endpoint requires authentication
// Set METRICS_AUTH_TOKEN env var. Prometheus config must include:
//   authorization:
//     credentials: <your-token>
// In development, unauthenticated access is allowed with a warning.
// ============================================================
app.get("/metrics", (req, res, next) => {
  const metricsToken = process.env.METRICS_AUTH_TOKEN;
  if (metricsToken) {
    const authHeader = req.headers.authorization || '';
    const provided = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;
    if (provided !== metricsToken) {
      return res.status(401).send("Unauthorized: invalid or missing METRICS_AUTH_TOKEN");
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('[SECURITY] /metrics endpoint blocked: no METRICS_AUTH_TOKEN configured in production!');
    return res.status(401).send("Unauthorized: METRICS_AUTH_TOKEN is not configured");
  }
  next();
}, async (req, res) => {
  try {
    const memory = process.memoryUsage();
    const uptime = process.uptime();
    const freeMem = os.freemem();
    const totalMem = os.totalmem();

    let dbLatency = 0;
    let dbStatus = 1;
    try {
      const start = Date.now();
      await pool.query("SELECT 1");
      dbLatency = Date.now() - start;
    } catch {
      dbStatus = 0;
    }

    res.set("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.send(`# HELP process_uptime_seconds Uptime of the Node.js process in seconds.
# TYPE process_uptime_seconds gauge
process_uptime_seconds ${uptime}

# HELP process_resident_memory_bytes Resident memory size in bytes.
# TYPE process_resident_memory_bytes gauge
process_resident_memory_bytes ${memory.rss}

# HELP process_heap_total_bytes Total size of the allocated heap in bytes.
# TYPE process_heap_total_bytes gauge
process_heap_total_bytes ${memory.heapTotal}

# HELP process_heap_used_bytes Memory used by heap in bytes.
# TYPE process_heap_used_bytes gauge
process_heap_used_bytes ${memory.heapUsed}

# HELP system_free_memory_bytes Free system memory in bytes.
# TYPE system_free_memory_bytes gauge
system_free_memory_bytes ${freeMem}

# HELP system_total_memory_bytes Total system memory in bytes.
# TYPE system_total_memory_bytes gauge
system_total_memory_bytes ${totalMem}

# HELP db_status Status of connection to PostgreSQL (1 = up, 0 = down).
# TYPE db_status gauge
db_status ${dbStatus}

# HELP db_query_latency_ms Database simple query response latency in milliseconds.
# TYPE db_query_latency_ms gauge
db_query_latency_ms ${dbLatency}
`);
  } catch (error) {
    res.status(500).send("Error generating metrics");
  }
});

app.get("/api/metrics", protect, admin, (req, res) => metricsHandler(req, res));

// ── Canonical route mounts (/api/* only) ──────────────────────────────
// Previously routes were mounted at both /api/v1/* and /api/* (triple-mounted
// in some cases). Consolidated to /api/* as single canonical path. The frontend
// and admin panel both use /api/* prefix.

app.use(adminIpAllowlist);
mountAdminRoutes(app, adminLimiter);
app.use("/api/admin", adminLimiter, adminRoutes);

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
app.use("/api/auth/phone", authLimiter, phoneAuthRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/admin/subscriptions", validateCsrfToken, subscriptionAdminRoutes);
app.use("/api/intelligence", validateCsrfToken, intelligenceRoutes);
app.use("/api/discussions", validateCsrfToken, discussionsRoutes);
app.use("/api/promotions", promotionsRoutes);
app.use("/api/tag-configs", tagConfigRoutes);
app.use("/api/pyps", pypHierarchyRoutes);
app.use("/api/admin/leaderboards", adminLimiter, leaderboardAdminRoutes);
// Compatibility alias — same router, chain-complete. LeaderboardResultsUnified.jsx
// (out of scope) still calls /leaderboards/admin/list + /stats; remove this mount
// once that page migrates to /admin/leaderboards/*.
app.use("/api/leaderboards/admin", adminLimiter, leaderboardAdminRoutes);
app.use("/api/enrollments", validateCsrfToken, enrollmentsAdminRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/analytics", validateCsrfToken, analyticsRoutes);
app.use("/api/admin/audit-logs", adminLimiter, validateCsrfToken, auditRoutes);
app.use("/api/fortspy", fortskyRoutes);
app.use("/api/import", adminLimiter, importRoutes);
app.use("/api/embeddings", embeddingRoutes);
app.use("/api/node-engine", validateCsrfToken, nodeEngineRoutes);

// AI & adaptive routes (previously only at /api/v1/*)
app.use("/api/math", mathRoutes);
app.use("/api/adaptive", adaptiveTestRoutes);
app.use("/api/ai/mentor", aiMentorRoutes);
app.use("/api/ai/explanation", aiExplanationRoutes);
app.use("/api/ai/logs", aiGenerationLogRoutes);
app.use("/api/adaptive-difficulty", adaptiveDifficultyRoutes);
app.use("/api/topic-analytics", topicAnalyticsRoutes);
app.use("/api/weak-areas", weakAreaDetectionRoutes);
app.use("/api/live-mock", liveMockRoutes);
app.use("/api/live-tests", liveTestsPublicRoutes);
app.use("/api/ranking", rankingRoutes);
app.use("/api/smart-revision", smartRevisionRoutes);
app.use("/api/revision", smartRevisionRoutes);
app.use("/api/search/questions", questionSearchRoutes);
app.use("/api/search/vector", vectorSearchRoutes);
app.use("/api/test-templates", testTemplateRoutes);
app.use("/api/question-builder", questionBuilderRoutes);
app.use("/api/test-builder", testBuilderRoutes);
app.use("/api/sections", sectionRoutes);
app.use("/api/study-materials", studyRoutes);

// Certificate Generation & Verification Engine
app.get("/api/certificates/:attemptId", protect, async (req, res) => {
  try {
    const result = await certificateService.generateCertificate(req.params.attemptId, req.user.id);
    if (!result.success) return res.status(result.statusCode || 400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(err) });
  }
});
app.get("/api/certificates/verify/:hash", async (req, res) => {
  try {
    const result = await certificateService.verifyCertificate(req.params.hash);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(err) });
  }
});

const sessionRouter = express.Router();
sessionRouter.get('/', protect, sessionController.getMySessions);
sessionRouter.delete('/:sessionId', protect, validateCsrfToken, sessionController.revokeSession);
sessionRouter.delete('/', protect, validateCsrfToken, sessionController.revokeAllSessions);
app.use("/api/sessions", sessionRouter);

mountExtractedRoutes(app);

if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}
setupSwagger(app);
app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  try {
    if (!isDevelopment && existsSync(READY_FILE)) unlinkSync(READY_FILE);
    const connected = await testConnection(5, 3000);
    if (!connected) { logger.error("Failed to connect to database after multiple attempts"); process.exit(1); }
    logger.info("Verifying and applying database migrations...");
    await runMigrations(pool, { afterMigrations: () => dbHelpers.clearColumnExistsCache() });

    logger.info("Warming database connection pools...");
    try {
      const { writeWarmed, readWarmed } = await warmPools();
      logger.info(`Connection pools warmed (write: ${writeWarmed}, read: ${readWarmed}).`);
    } catch (e) {
      logger.warn(`Pool warming failed (non-fatal): ${e.message}`);
    }

    logger.info("Initializing Redis and background queues...");
    await initRedis();
    // Store Redis client reference for phone auth OTP store
    const redisClient = getRedisClient();
    if (redisClient) global.redis = redisClient;
    initQueues();
    
    logger.info("Initializing Event-Driven Message Broker...");
    await messageBroker.init();
    registerUserEventSubscribers();

    logger.info("Initializing WebSocket server...");
    const server = createServer(app);
    await initWebSocket(server);

    // FIX #11: Per-request timeout to bound runaway/abandoned connections.
    server.setTimeout(30000);
    server.headersTimeout = 31000;

    logger.info("Starting server listener...");
    server.listen(PORT, "0.0.0.0", async () => {
      const localIPs = getLocalNetworkIPs();
      const primaryIP = localIPs[0] || "localhost";
      logger.info(`Server running on http://localhost:${PORT}`);
      localIPs.forEach((ip) => logger.info(`Network access: http://${ip}:${PORT}`));
      logger.info(`Frontend (port 3000) is configured to proxy requests here.`);
      logger.info(`WebSocket enabled: ws://${primaryIP}:${PORT}`);
      logger.info(`API Health: http://${primaryIP}:${PORT}/api/health`);
      if (!isDevelopment) {
        try {
          writeFile(READY_FILE, String(Date.now())).catch((e) =>
            logger.warn(`Failed to write readiness signal: ${e.message}`)
          );
          logger.info(`Readiness signal written to ${READY_FILE}`);
        } catch (e) { logger.warn(`Failed to write readiness signal: ${e.message}`); }
      }
      
      if (isQueueEnabled()) {
        // Reliability fix: schedule a BullMQ repeatable job instead of a raw
        // setInterval. BullMQ retries failures with exponential backoff
        // (DEFAULT_JOB_OPTIONS) and survives process restarts. Keep the job
        // payload stable so restarts don't register duplicate repeatables.
        try {
          await addJob(
            QUEUE_NAMES.NOTIFICATIONS,
            "notifications.scheduled-reminders",
            {
              name: "scheduled_reminder",
              payload: { inactivityHours: 24 },
            },
            { repeat: { every: 6 * 60 * 60 * 1000 } }
          );
          logger.info("Scheduled repeating reminder job (every 6h, with retry).");
        } catch (e) {
          logger.warn(`Failed to schedule reminder job: ${e.message}`);
        }
      }
      
      logger.info(`[Redis] ${getRedisStatus().message}`);
      logger.info(`[Queue] ${isQueueEnabled() ? "Enabled" : "Disabled"}`);
      logger.info(`Background initialization complete.`);
      try {
        startScheduler();
        startOutboxPoller();
        startAttemptCleaner();
        subscriptionService.processExpiredSubscriptions().catch((e) => logger.warn(`[SubscriptionExpiry] Startup run failed: ${e.message}`));
        setInterval(() => {
          subscriptionService.processExpiredSubscriptions().catch((e) => logger.warn(`[SubscriptionExpiry] Interval run failed: ${e.message}`));
        }, 60 * 60 * 1000);
        logger.info("Schedulers, subscription expiry worker, and background cleaners started successfully.");
      } catch (err) {
        logger.error(`Failed to start schedulers: ${err.message}`);
      }
      logger.info(`Available endpoints: /api/auth/*, /api/admin/*, /api/tests/*, /api/study/*`);
    });
  } catch (error) { logger.error(`Server startup error: ${error.message}`); process.exit(1); }
};

const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  try { if (existsSync(READY_FILE)) unlinkSync(READY_FILE); } catch { /* ignore */ }
  try {
    stopScheduler();
    stopOutboxPoller();
    stopAttemptCleaner();
    logger.info("Schedulers and background cleaners stopped.");
  } catch (err) {
    logger.warn(`Failed to stop schedulers gracefully: ${err.message}`);
  }
  try {
    await drainEmailQueue();
    await closeQueueResources();
    await closeRedis();
    await dbHelpers.close();
    logger.info("Database connections closed");
    process.exit(0);
  } catch (error) {
    logger.error(`Error during shutdown: ${error.message}`);
    process.exit(1);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// M12: an uncaught exception / unhandled rejection is fatal, but killing the
// process without releasing DB/Redis/scheduler resources risks corruption and
// leaves a restart to chance. Route both through gracefulShutdown (which closes
// connections and lets the process manager — systemd/PM2/Docker — restart the
// service). `gracefulShutdown` is guarded against double-invocation below.
let isShuttingDown = false
const fatalShutdown = (label, err) => {
  if (isShuttingDown) return
  isShuttingDown = true
  console.error(`[Fatal Error] ${label}:`, err)
  logger.error({ err }, label)
  gracefulShutdown(label).finally(() => process.exit(1))
}
process.on("uncaughtException", (error) => fatalShutdown("Uncaught Exception", error));
process.on("unhandledRejection", (reason) => fatalShutdown("Unhandled Rejection", reason));

startServer();
export default app;
