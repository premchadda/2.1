import express from "express";
import { createServer } from "http";
import os from "os";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { initWebSocket } from "./infrastructure/websocket/websocketManager.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
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
import adminRoutes from "./api/routes/admin.js";
import testsRoutes from "./modules/tests/test.routes.js";
import testsEngineRoutes from './modules/tests/test.engine.routes.js'
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
import leaderboardAdminRoutes from "./api/routes/leaderboards-admin.js";
import enrollmentsAdminRoutes from "./api/routes/enrollments-admin.js";
import communityRoutes from "./api/routes/community.js";
import analyticsRoutes from "./api/routes/analytics.js";
import auditRoutes from "./api/routes/admin-audit.js";
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

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== ENVIRONMENT VARIABLE VALIDATION (Issue #9) =====
const requiredEnvVars = ["DATABASE_URL", "JWT_SECRET", "FRONTEND_URL"];
const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName],
);

if (missingEnvVars.length > 0) {
  console.error("❌ Missing required environment variables:");
  missingEnvVars.forEach((varName) => console.error(`   - ${varName}`));
  console.error("Please set these variables in your .env file or environment.");
  process.exit(1);
}

// CRIT-04 FIX: Enforce JWT_SECRET minimum length AND complexity - fail hard in ALL environments
// JWT secrets shorter than 32 characters are vulnerable to brute-force attacks
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error(
    "❌ JWT_SECRET must be at least 32 characters long. Generate a secure secret using: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  );
}

// CRIT-04 FIX: JWT_SECRET complexity check now FAILS HARD (not just warning)
const hasLowercase = /[a-z]/.test(jwtSecret);
const hasUppercase = /[A-Z]/.test(jwtSecret);
const hasNumber = /[0-9]/.test(jwtSecret);
const hasSpecial = /[^a-zA-Z0-9]/.test(jwtSecret);
const complexityScore = [
  hasLowercase,
  hasUppercase,
  hasNumber,
  hasSpecial,
].filter(Boolean).length;

if (complexityScore < 3) {
  throw new Error(
    "❌ JWT_SECRET has insufficient complexity. Generate a secure secret using:\n" +
      "   node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"\n" +
      "   The secret must include at least 3 of: lowercase, uppercase, numbers, special characters.",
  );
}

const app = express();
const PORT = process.env.PORT || 5001;

// ===== MAKE DB HELPERS AVAILABLE GLOBALLY =====
global.dbHelpers = dbHelpers;

// ===== SECURITY MIDDLEWARE WITH ENHANCED HELMET (Issue #15) =====
// In development, disable CSP to allow local network testing
// In production, use strict CSP
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

// Only enable CSP in production - it causes issues with local network development
if (process.env.NODE_ENV === "production") {
   helmetOptions.contentSecurityPolicy = {
     directives: {
       defaultSrc: ["'self'"],
       scriptSrc: ["'self'"], // No unsafe-inline for scripts (React uses external JS)
       styleSrc: ["'self'", "'unsafe-inline'"], // Keep for React inline styles
       imgSrc: ["'self'", "data:", "https:"],
       connectSrc: [
         "'self'",
         process.env.FRONTEND_URL || "http://localhost:3000",
       ],
       fontSrc: ["'self'", "https://fonts.gstatic.com"],
       objectSrc: ["'none'"],
       mediaSrc: ["'self'"],
       frameSrc: ["'none'"],
     },
   };
} else {
  // In development, use a relaxed CSP that allows hot-reload scripts (eval) and WebSocket connections
  helmetOptions.contentSecurityPolicy = {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // unsafe-eval for Vite HMR
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: [
        "'self'",
        process.env.FRONTEND_URL || "http://localhost:3000",
        "ws:",
        "wss:",
        "http:",
        "https:",
      ], // WebSocket
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
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    for (const iface of networkInterfaces[interfaceName]) {
      if ((iface.family === "IPv4" || iface.family === 4) && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
};

const localIPs = getLocalNetworkIPs();
// Allowed origins for CORS - includes both user frontend and admin panel
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_PANEL_URL, // Admin panel origin for security
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:3001",
  "http://localhost:3002",
  ...localIPs.map((ip) => `http://${ip}:3000`),
  ...localIPs.map((ip) => `http://${ip}:5173`),
].filter(Boolean);

// Helper to check if origin is a local network IP (for development)
const isLocalNetworkOrigin = (origin) => {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    // Allow localhost
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;

    // Allow private network IPs (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
    const privateIpRegex =
      /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/;
    if (privateIpRegex.test(hostname)) return true;

    // Also allow any hostname if it's in the machine's own network interfaces
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
      for (const iface of networkInterfaces[interfaceName]) {
        if (iface.address === hostname) return true;
      }
    }

    return false;
  } catch {
    return false;
  }
};

// Check if we're in development mode (default to development if NODE_ENV not set)
const isDevelopment = process.env.NODE_ENV !== "production";

app.use(
  cors({
    origin: (origin, callback) => {
      // Log all incoming origins in development for debugging
      // Skip OPTIONS preflight requests to avoid duplicate log entries
      if (isDevelopment && origin && process.env.REQUEST_METHOD !== "OPTIONS") {
        console.log(`[CORS Check] Origin: ${origin}`);
      }

      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // SECURITY FIX (Audit Fix #HIGH-01): Tightened CORS in development mode
      // No longer allows ANY origin - uses explicit allowlist only
      if (isDevelopment) {
        if (isLocalNetworkOrigin(origin)) {
          console.log(`✅ [CORS] Allowed LAN: ${origin}`);
          return callback(null, true);
        }

        // Be restrictive even in development - only allow known dev origins
        try {
          const url = new URL(origin);
          const hostname = url.hostname;

          // Known development origins only (strict allowlist)
          const devOrigins = [
            "localhost",
            "127.0.0.1",
            "0.0.0.0",
            "[::1]", // IPv6 localhost
          ];

          // Private network ranges (strict)
          const privateIpRegex =
            /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/;

          if (devOrigins.includes(hostname) || privateIpRegex.test(hostname)) {
            console.log(`✅ [CORS] Allowed Dev Host: ${origin}`);
            return callback(null, true);
          }
        } catch (e) {
          console.warn(`[CORS] Invalid origin URL: ${origin}`);
        }

        // SECURITY FIX: No longer allowing ANY origin - reject unknown origins even in development
        console.warn(`❌ [CORS] Blocked unknown origin: ${origin}`);
        return callback(
          new Error(`Origin ${origin} not in development allowlist`),
        );
      }

      console.warn(`❌ [CORS] Blocked origin: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
    exposedHeaders: ["X-CSRF-Token"],
    maxAge: 86400, // 24 hours
  }),
);

// Helper to check if request is from admin user
const isAdminRequest = (req) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return false;

    const token = authHeader.split(" ")[1];
    if (!token) return false;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded && decoded.role === "admin";
  } catch {
    return false;
  }
};

// Helper to check if request is from admin panel origin
const isAdminPanelRequest = (req) => {
  const origin = req.headers.origin;
  const adminPanelUrls = [
    process.env.ADMIN_PANEL_URL,
    "http://localhost:3002",
    "http://localhost:3001",
  ].filter(Boolean);
  return adminPanelUrls.includes(origin);
};

// Rate limiting - prevent abuse
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use different key for admin users (effectively no limit per-admin)
    if (isAdminRequest(req)) {
      return `admin-${req.ip}`;
    }
    return req.ip;
  },
  skip: (req) => {
    if (req.path === "/health") return true;
    if (isAdminRequest(req)) return true;
    if (isAdminPanelRequest(req)) return true; // Skip rate limiting for admin panel
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit auth attempts (login, register, forgot-password)
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Don't rate limit health checks
    if (req.path === "/health") return true;
    // Don't rate limit admin panel requests
    if (isAdminPanelRequest(req)) return true;
    // Allow admins to bypass auth rate limiting
    if (isAdminRequest(req)) return true;
    // Don't rate limit session checks (GET /me) or CSRF fetches — these are
    // called on every page load and are safe read-only operations.
    if (req.method === "GET" && (req.path === "/me" || req.path === "/csrf"))
      return true;
    return false;
  },
});

// Admin rate limiter - higher limits for admin bulk operations
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Higher limit for admin bulk operations
  message: {
    success: false,
    message: "Too many admin requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by admin user ID if available, else by IP
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && decoded.id) {
          return `admin-${decoded.id}`;
        }
      }
    } catch (err) {
      // Rate limit check failed, fall through to IP-based
    }
  },
});

// Rate limiters initialized above

// ===== CORE REQUEST MIDDLEWARE (must be before ALL routes) =====
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
// Use standard 'dev' format for concise logging in development instead of verbose custom logging
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(monitoringMiddleware); // Add request monitoring
app.use(publicIdResponseMiddleware);

// Handle favicon early to minimize log noise
app.get("/favicon.ico", (req, res) => res.status(204).end());

// Welcome route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Welcome to Trstprep API",
    version: "2.0.0",
    status: "online",
    health: `${req.protocol}://${req.get("host")}/api/health`,
  });
});

// Apply rate limiting to all API routes
app.use("/api", generalLimiter);
app.use(cacheControlMiddleware);
app.use("/api/auth", authLimiter, authRoutes);

// ===== FILE UPLOAD LIMITS (Issue #1) =====
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 uploads per windowMs
  message: {
    success: false,
    message: "Too many uploads from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Configure multer with file size limits
const fileUpload = multer({
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Basic file type validation
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "video/mp4",
      "video/webm",
      "video/avi",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only images, PDFs, and videos are allowed.",
        ),
        false,
      );
    }
  },
});

// CRIT-05 FIX: Consolidate upload endpoints to single canonical path
// Redirect deprecated endpoints to canonical /api/admin/assets/upload
app.use("/api/admin/upload", uploadLimiter, (req, res) => {
  res.status(301).json({
    success: true,
    message:
      "This endpoint is deprecated. Use /api/admin/assets/upload instead.",
    redirect: "/api/admin/assets/upload",
  });
});
app.use("/api/admin/media/upload", uploadLimiter, (req, res) => {
  res.status(301).json({
    success: true,
    message:
      "This endpoint is deprecated. Use /api/admin/assets/upload instead.",
    redirect: "/api/admin/assets/upload",
  });
});
// Canonical upload endpoint with rate limiting
app.use("/api/admin/assets/upload", uploadLimiter);

// Serve uploaded files from backend uploads directory
// Override CORP header for uploaded files so they can be embedded cross-origin
// (the global helmet sets same-origin, but uploads must be accessible from the frontend)
app.use("/uploads", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
}, express.static(path.join(__dirname, "uploads")));

// Serve avatar files from backend uploads (moved from frontend for proper isolation)
app.use(
  "/assets/avatar",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "..", "uploads", "avatars")),
);

// Health check - with database connectivity test
app.get("/api/health", async (req, res) => {
  try {
    const dbHealth =
      typeof dbHelpers.healthCheck === "function"
        ? await dbHelpers.healthCheck()
        : await (async () => {
            const startedAt = Date.now();
            await pool.query("SELECT 1");
            return {
              healthy: true,
              latencyMs: Date.now() - startedAt,
              provider: "postgres",
            };
          })();
    const redisHealth = getRedisStatus();
    const queueHealth = await getQueueStatus();

    if (!dbHealth.healthy) {
      return res.status(503).json({
        status: "degraded",
        message: "Database connection issues",
        database: "PostgreSQL",
        dbHealth,
        redis: redisHealth,
        queues: queueHealth,
        timestamp: new Date().toISOString(),
      });
    }

    const degraded = redisHealth.enabled && !redisHealth.connected;

    res.status(degraded ? 206 : 200).json({
      status: degraded ? "degraded" : "ok",
      message: degraded
        ? "API is running, but Redis/queue services are degraded"
        : "Trstprep API is running with PostgreSQL + Redis queue foundations",
      database: "PostgreSQL",
      dbHealth,
      redis: redisHealth,
      queues: queueHealth,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      message: "Health check failed",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// @route   GET /api/metrics
// @desc    Get API metrics (for monitoring)
// @access  Private (Admin only)
app.get("/api/metrics", protect, admin, (req, res) => {
  metricsHandler(req, res);
});

// === Mount Routes ===
app.use("/api/admin", adminLimiter, validateCsrfToken, adminRoutes);
app.use("/api/tests", testsRoutes);
app.use('/api/tests-engine', validateCsrfToken, testsEngineRoutes)
app.use("/api/questions", questionsRoutes);
app.use("/api/study", studyRoutes);
app.use("/api/users", validateCsrfToken, usersRoutes); // Protected - profile updates
app.use("/api/users", validateCsrfToken, examEnrollmentRoutes); // Protected - exam enrollment
app.use("/api/users", validateCsrfToken, studyMaterialEnrollmentRoutes); // Protected - study material enrollment
app.use("/api/exams", examRoutes);
app.use("/api/exam-yearly", examYearlyRoutes);
app.use("/api/exam-seasons", examSeasonsRoutes);
app.use("/api/series", seriesRoutes);
app.use("/api/exam-info", examInfoRoutes);
app.use("/api/test-categories", testCategoryRoutes);
app.use("/api/exam-categories", examCategoryRoutes);
app.use("/api/bookmarks", validateCsrfToken, bookmarksRoutes); // Protected - content modification
app.use("/api/notifications", validateCsrfToken, notificationsRoutes); // Protected - content modification
app.use("/api/achievements", achievementsRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/referrals", validateCsrfToken, referralsRoutes);
app.use("/api/doubts", validateCsrfToken, doubtsRoutes); // Protected - content modification
app.use("/api/study-groups", validateCsrfToken, studyGroupsRoutes); // Protected - content modification
app.use("/api/stages", stageRoutes); // Stage routes for test categorization
app.use("/api/payments", validateCsrfToken, paymentRoutes);
app.use("/api/current-affairs", validateCsrfToken, currentAffairsRoutes); // Current Affairs
app.use("/api/attempt", protect, attemptRoutes); // Test attempt management (pause/resume)
app.use("/api/practice", validateCsrfToken, practiceRoutes); // Practice Questions
app.use("/api/notifications-pref", validateCsrfToken, notificationsPrefRoutes); // Notification preferences
app.use("/api/auth/phone", phoneAuthRoutes); // Phone OTP authentication
app.use("/api/subscriptions", subscriptionRoutes); // Subscription & Pro Pass
app.use("/api/admin/subscriptions", validateCsrfToken, subscriptionAdminRoutes); // Admin subscription management (CSRF protected)
app.use("/api/intelligence", validateCsrfToken, intelligenceRoutes); // Analytics + learning + recommendations
app.use("/api/discussions", validateCsrfToken, discussionsRoutes); // Question discussion threads/replies/upvotes
app.use("/api/promotions", promotionsRoutes); // Public active promotions/limited-time offers
app.use("/api/tag-configs", tagConfigRoutes); // Tag configurations
app.use("/api/leaderboards", validateCsrfToken, leaderboardAdminRoutes); // Leaderboard admin management (CSRF protected)
app.use("/api/enrollments", validateCsrfToken, enrollmentsAdminRoutes); // Enrollments admin management (CSRF protected)
app.use("/api/community", communityRoutes); // Community module (groups, posts, comments, voting)
app.use("/api/analytics", validateCsrfToken, analyticsRoutes); // Analytics module (CSRF protected)
app.use("/api/admin/audit-logs", adminLimiter, validateCsrfToken, auditRoutes); // Admin audit trail

// User-facing session management (view own sessions, revoke own sessions)
import sessionController from "./modules/sessions/session.controller.js";
const sessionRouter = express.Router();
sessionRouter.get('/', protect, sessionController.getMySessions);
sessionRouter.delete('/:sessionId', protect, validateCsrfToken, sessionController.revokeSession);
sessionRouter.delete('/', protect, validateCsrfToken, sessionController.revokeAllSessions);
app.use("/api/sessions", sessionRouter);

// @route   GET /api/search
app.get("/api/search", async (req, res) => {
  try {
    const { q, type, limit = 20, page = 1 } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const searchTerm = q.toLowerCase().trim();
    const parsedLimit = parseInt(limit, 10) || 20;
    const offset = (parseInt(page, 10) - 1 || 0) * parsedLimit;
    const searchPattern = `%${searchTerm}%`;

    const results = {
      tests: [],
      series: [],
      exams: [],
      studyMaterials: [],
      total: 0,
    };

    // Search tests
    if (!type || type === "tests" || type === "all") {
      const testsRes = await pool.query(`
        SELECT * FROM tests 
        WHERE is_active = true 
        AND (title ILIKE $1 OR description ILIKE $1 OR array_to_string(tags, ' ') ILIKE $1)
        ORDER BY id DESC
        LIMIT $2 OFFSET $3
      `, [searchPattern, parsedLimit, offset]);
      results.tests = testsRes.rows.map(row => dbHelpers.toCamel(row));
    }

    // Search test series
    if (!type || type === "series" || type === "all") {
      const seriesRes = await pool.query(`
        SELECT * FROM test_series 
        WHERE is_active = true 
        AND (name ILIKE $1 OR description ILIKE $1)
        ORDER BY id DESC
        LIMIT $2 OFFSET $3
      `, [searchPattern, parsedLimit, offset]);
      results.series = seriesRes.rows.map(row => dbHelpers.toCamel(row));
    }

    // Search exams
    if (!type || type === "exams" || type === "all") {
      const examsRes = await pool.query(`
        SELECT * FROM exam_info 
        WHERE is_active = true 
        AND (title ILIKE $1 OR full_name ILIKE $1 OR description ILIKE $1)
        ORDER BY id DESC
        LIMIT $2 OFFSET $3
      `, [searchPattern, parsedLimit, offset]);
      results.exams = examsRes.rows.map(row => dbHelpers.toCamel(row));
    }

    // Search study materials
    if (!type || type === "study" || type === "all") {
      const materialsRes = await pool.query(`
        SELECT * FROM study_materials 
        WHERE is_active = true 
        AND (title ILIKE $1 OR description ILIKE $1)
        ORDER BY id DESC
        LIMIT $2 OFFSET $3
      `, [searchPattern, parsedLimit, offset]);
      results.studyMaterials = materialsRes.rows.map(row => dbHelpers.toCamel(row));
    }

    results.total =
      results.tests.length +
      results.series.length +
      results.exams.length +
      results.studyMaterials.length;

    res.json({
      success: true,
      data: results,
      query: q,
      total: results.total,
    });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({
      success: false,
      message: "Search failed",
    });
  }
});

// @route   GET /api/exams/:examId/year/:year
app.get("/api/exams/:examId/year/:year", async (req, res) => {
  try {
    const { examId, year } = req.params;

    const yearlyData = await dbHelpers.findOne("examYearlyData", {
      examId: parseInt(examId),
      year: parseInt(year),
      isActive: true,
    });

    if (!yearlyData) {
      return res.status(404).json({
        success: false,
        message: "Yearly data not found for this exam and year",
      });
    }

    res.json({
      success: true,
      data: yearlyData,
    });
  } catch (error) {
    console.error("Get yearly data error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/exams/:examId/years
app.get("/api/exams/:examId/years", async (req, res) => {
  try {
    const { examId } = req.params;

    const yearlyData = await dbHelpers.find("examYearlyData", {
      examId: parseInt(examId),
      isActive: true,
    });

    const years = yearlyData.map((data) => data.year).sort((a, b) => b - a);

    res.json({
      success: true,
      data: years,
      count: years.length,
    });
  } catch (error) {
    console.error("Get years error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/exams/:examId/updates
app.get("/api/exams/:examId/updates", async (req, res) => {
  try {
    const { examId } = req.params;
    const { limit = 10, page = 1, type } = req.query;

    let query = {
      examId: parseInt(examId),
      isActive: true,
    };

    if (type) {
      query.updateType = type;
    }

    const updates = await dbHelpers.find("examUpdates", query);

    // Sort by date (newest first) and paginate
    const sortedUpdates = updates
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice((page - 1) * limit, page * limit);

    res.json({
      success: true,
      data: sortedUpdates,
      count: sortedUpdates.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: updates.length,
      },
    });
  } catch (error) {
    console.error("Get updates error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/exams/:examId/compare
app.get("/api/exams/:examId/compare", async (req, res) => {
  try {
    const { examId } = req.params;
    const { years } = req.query;

    const yearArray = years ? years.split(",").map(Number) : [];

    const comparisonData = await dbHelpers.find("examYearlyData", {
      examId: parseInt(examId),
      year: { $in: yearArray },
      isActive: true,
    });

    // Format for comparison table
    const formatted = comparisonData
      .sort((a, b) => b.year - a.year)
      .map((data) => ({
        year: data.year,
        vacancies: data.vacancies,
        notificationDate: data.notificationDate,
        applicationStart: data.applicationStart,
        examDateStart: data.examDateStart,
        resultDate: data.resultDate,
      }));

    res.json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    console.error("Get comparison error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/videos
app.get("/api/videos", async (req, res) => {
  try {
    let videos = await dbHelpers.find("videos", { isActive: true });
    if (!videos || videos.length === 0) {
      videos = await dbHelpers.find("studyMaterials", {
        isActive: true,
        type: "video",
      });
    }

    res.json({
      success: true,
      data: videos,
      count: videos.length,
    });
  } catch (error) {
    console.error("Get videos error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/subscription-plans
app.get("/api/subscription-plans", async (req, res) => {
  try {
    const plans = await dbHelpers.find("subscriptionPlans", { isActive: true });
    res.json({
      success: true,
      data: plans,
      count: plans.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/videos/:id
app.get("/api/videos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let video = await dbHelpers.findById("videos", id);
    if (!video) {
      video = await dbHelpers.findById("studyMaterials", id);
    }

    const isVideoType =
      video?.type === "video" || video?.videoUrl || video?.url;
    if (!video || !video.isActive || !isVideoType) {
      return res.status(404).json({
        success: false,
        message: "Video not found",
      });
    }

    res.json({
      success: true,
      data: video,
    });
  } catch (error) {
    console.error("Get video error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// SEC-08: Public leaderboards endpoint - anonymize user data to prevent PII exposure
// @route   GET /api/leaderboards
app.get("/api/leaderboards", async (req, res) => {
  try {
    const { testId, seriesId, examId, limit = 50 } = req.query;
    let query = { isActive: true };

    if (testId) query.testId = testId;
    if (seriesId) query.seriesId = seriesId;
    if (examId) query.examId = examId;

    const leaderboards = await dbHelpers.find("leaderboards", query);

    // If no leaderboards found, generate from results
    if (!leaderboards || leaderboards.length === 0) {
      // Fetch results for this series/test
      const resultsQuery = { isCompleted: true };
      if (seriesId) resultsQuery.seriesId = seriesId;
      if (testId) resultsQuery.testId = testId;

      const results = await dbHelpers.find("results", resultsQuery);

      if (!results || results.length === 0) {
        return res.json({
          success: true,
          data: [],
          count: 0,
          source: "empty",
        });
      }

      // Sort by score (descending) and then by time taken (ascending for tie-breaking)
      const sortedResults = results
        .sort((a, b) => {
          const scoreA = parseFloat(a.score) || 0;
          const scoreB = parseFloat(b.score) || 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          const timeA = parseFloat(a.timeTaken || a.timeSpent) || Infinity;
          const timeB = parseFloat(b.timeTaken || b.timeSpent) || Infinity;
          return timeA - timeB;
        })
        .slice(0, limit);

      // SEC-08: Anonymize user data - use rank-based pseudonyms instead of real names
      const totalParticipants = results.length;
      const rankings = await Promise.all(sortedResults.map(async (result, index) => {
        const participantsBelow = totalParticipants - (index + 1);
        const realPercentile =
          totalParticipants > 1
            ? ((participantsBelow / totalParticipants) * 100).toFixed(1)
            : "100.0";

        // Return only pseudonymous display name and rank, no PII
        let isProUser = false;
        try {
          const user = await dbHelpers.findById("users", result.userId);
          isProUser = user?.isProUser || user?.isPro || false;
        } catch (e) {
          // User lookup failed, default to false
        }

        return {
          rank: index + 1,
          // SEC-08: Pseudonymous display - no real names or user IDs exposed publicly
          name: `Student #${index + 1}`,
          score: parseFloat(result.score || 0).toFixed(2),
          percentile: realPercentile,
          testsCompleted: result.testsCompleted || result.tests_completed || 1,
          accuracy: result.accuracy ?? 0,
          isPro: isProUser,
        };
      }));

      return res.json({
        success: true,
        data: rankings,
        count: rankings.length,
        totalParticipants,
        source: "calculated",
      });
    }

    // SEC-08: Anonymize leaderboard rankings for public access
    const populatedLeaderboards = await Promise.all(
      leaderboards.map(async (lb) => {
        const rankings = lb.rankings || [];
        const anonymizedRankings = rankings
          .sort((a, b) => a.rank - b.rank)
          .slice(0, limit)
          .map((r) => ({
            rank: r.rank,
            // SEC-08: No userId or real names exposed in public endpoint
            name: r.name ? `Student #${r.rank}` : `Student #${r.rank}`,
            score: r.score,
            percentile: r.percentile,
            testsCompleted: r.testsCompleted,
            accuracy: r.accuracy,
            isPro: r.isPro,
          }));

        return {
          ...lb,
          rankings: anonymizedRankings,
        };
      }),
    );

    res.json({
      success: true,
      data: populatedLeaderboards,
      count: populatedLeaderboards.length,
    });
  } catch (error) {
    console.error("Get leaderboards error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// @route   GET /api/leaderboards/:id
app.get("/api/leaderboards/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const leaderboard = await dbHelpers.findById("leaderboards", id);

    if (!leaderboard || !leaderboard.isActive) {
      return res.status(404).json({
        success: false,
        message: "Leaderboard not found",
      });
    }

    // Paginate rankings
    const rankings = leaderboard.rankings || [];
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedRankings = rankings
      .sort((a, b) => a.rank - b.rank)
      .slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        ...leaderboard,
        rankings: paginatedRankings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: rankings.length,
          totalPages: Math.ceil(rankings.length / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/test-series
app.get("/api/test-series", async (req, res) => {
  try {
    // Determine query for finding non-pro test series
    // dbHelpers.find('testSeries', { isPro: false })
    // This is safer than raw SQL injection risk in previous file
    const series = await dbHelpers.find("testSeries", { isPro: false });

    res.json({
      success: true,
      data: series,
      count: series.length,
    });
  } catch (error) {
    console.error("Get test series error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/live-tests
app.get("/api/live-tests", async (req, res) => {
  try {
    const { limit = 20, page = 1 } = req.query;

    // Get tests tagged as live tests
    const allTests = await dbHelpers.find("tests", { isActive: true });
    const liveTests = allTests.filter(
      (test) => test.isLive === true || test.tags?.includes("live-tests"),
    );

    // Sort by date (newest first)
    liveTests.sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    );

    // Paginate
    const startIndex = (page - 1) * limit;
    const paginatedTests = liveTests.slice(
      startIndex,
      startIndex + parseInt(limit),
    );

    res.json({
      success: true,
      data: paginatedTests,
      count: paginatedTests.length,
      total: liveTests.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: liveTests.length,
        totalPages: Math.ceil(liveTests.length / limit),
      },
    });
  } catch (error) {
    console.error("Get live tests error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/current-affairs
app.get("/api/current-affairs", async (req, res) => {
  try {
    const { date, month, year, limit = 20, page = 1, category } = req.query;

    // Get study materials tagged as current-affairs
    let query = { isActive: true };
    if (category) query.category = category;

    const allMaterials = await dbHelpers.find("studyMaterials", query);
    let articles = allMaterials.filter(
      (m) =>
        m.tags?.includes("current-affairs") || m.type === "current-affairs",
    );

    // Filter by date if provided
    if (date) {
      const targetDate = new Date(date).toDateString();
      articles = articles.filter(
        (a) => new Date(a.date || a.createdAt).toDateString() === targetDate,
      );
    }

    // Filter by month/year if provided
    if (month && year) {
      articles = articles.filter((a) => {
        const aDate = new Date(a.date || a.createdAt);
        return (
          aDate.getMonth() + 1 === parseInt(month) &&
          aDate.getFullYear() === parseInt(year)
        );
      });
    }

    // Sort by date (newest first)
    articles.sort(
      (a, b) =>
        new Date(b.date || b.createdAt || 0) -
        new Date(a.date || a.createdAt || 0),
    );

    // Paginate
    const startIndex = (page - 1) * limit;
    const paginatedArticles = articles.slice(
      startIndex,
      startIndex + parseInt(limit),
    );

    res.json({
      success: true,
      data: paginatedArticles,
      count: paginatedArticles.length,
      total: articles.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: articles.length,
        totalPages: Math.ceil(articles.length / limit),
      },
    });
  } catch (error) {
    console.error("Get current affairs error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/previous-year-papers
app.get("/api/previous-year-papers", async (req, res) => {
  try {
    const { exam, year, limit = 20, page = 1 } = req.query;

    // Get tests tagged as PYPs
    let allTests = await dbHelpers.find("tests", { isActive: true });
    let pypTests = allTests.filter(
      (test) =>
        test.tags?.includes("pyp") ||
        test.tags?.includes("previous-year") ||
        test.category === "PYPs" ||
        test.type === "Previous Year Papers",
    );

    // Filter by exam category if provided
    if (exam) {
      pypTests = pypTests.filter(
        (t) =>
          t.examType?.toLowerCase() === exam.toLowerCase() ||
          t.examCategory?.toLowerCase() === exam.toLowerCase(),
      );
    }

    // Filter by year if provided
    if (year) {
      pypTests = pypTests.filter((t) => t.year === parseInt(year));
    }

    // Sort by year (newest first)
    pypTests.sort((a, b) => (b.year || 0) - (a.year || 0));

    // Paginate
    const startIndex = (page - 1) * limit;
    const paginatedPapers = pypTests.slice(
      startIndex,
      startIndex + parseInt(limit),
    );

    // Extract unique years for filter
    const availableYears = [
      ...new Set(
        allTests
          .filter(
            (t) =>
              t.tags?.includes("pyp") ||
              t.tags?.includes("previous-year") ||
              t.category === "PYPs",
          )
          .map((t) => t.year)
          .filter(Boolean),
      ),
    ].sort((a, b) => b - a);

    res.json({
      success: true,
      data: paginatedPapers,
      count: paginatedPapers.length,
      total: pypTests.length,
      availableYears,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: pypTests.length,
        totalPages: Math.ceil(pypTests.length / limit),
      },
    });
  } catch (error) {
    console.error("Get previous year papers error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/public-stats
app.get("/api/public-stats", async (req, res) => {
  try {
    const userCount = await dbHelpers.count("users");
    const testSeriesCount = await dbHelpers.count("testSeries");
    const testCount = await dbHelpers.count("tests");
    const questionCount = await dbHelpers.count("questions");
    const examCatCount = await dbHelpers.count("examCategories");

    // Get real total attempts from test_series
    const attemptRes = await pool.query(
      "SELECT SUM(total_attempts) as count FROM test_series",
    );
    const totalAttempts = parseInt(attemptRes.rows[0].count) || 0;

    // Calculate real stats (no hardcoded minimums)
    const activeLearners = userCount + totalAttempts;
    const successStories = Math.floor(activeLearners / 50);

    // Import validation utility
    const { validateStats } =
      await import("./shared/utils/stats-validation.js");

    // Validate stats before returning
    const validatedStats = validateStats({
      users: userCount,
      testSeries: testSeriesCount,
      tests: testCount,
      questions: questionCount,
      examCategories: examCatCount,
      activeLearners: activeLearners || 0,
      mockTests: testCount || 0,
      practiceQuestions: questionCount || 0,
      successStories: successStories || 0,
      examsCovered: examCatCount || 0,
      satisfaction: null,
    });

    res.json({
      success: true,
      data: {
        ...validatedStats,
        // Keep original counts for admin use
        users: userCount,
        testSeries: testSeriesCount,
        tests: testCount,
        questions: questionCount,
        examCategories: examCatCount,
      },
    });
  } catch (error) {
    console.error("Get public stats error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// @route   GET /api/testimonials
app.get("/api/testimonials", async (req, res) => {
  try {
    // TODO: Testimonials table needs to be created and populated via admin panel
    // For now, return empty array - no hardcoded fallback data
    const testimonials = await dbHelpers.find("testimonials", {
      isActive: true,
    });

    res.json({
      success: true,
      data: testimonials || [],
    });
  } catch (error) {
    // Return empty array if table doesn't exist yet
    res.json({
      success: true,
      data: [],
      message: "Testimonials feature coming soon",
    });
  }
});

// @route   GET /api/practice-questions
app.get("/api/practice-questions", async (req, res) => {
  try {
    const { category, subject, topic, limit = 50, page = 1 } = req.query;

    // Get questions tagged for practice
    let allQuestions = await dbHelpers.find("questions", { isActive: true });
    let practiceQuestions = allQuestions.filter(
      (q) =>
        q.tags?.includes("practice") ||
        q.isPractice === true ||
        q.category === "Practice",
    );

    // Filter by category if provided
    if (category) {
      practiceQuestions = practiceQuestions.filter(
        (q) => q.category?.toLowerCase() === category.toLowerCase(),
      );
    }

    // Filter by subject if provided
    if (subject) {
      practiceQuestions = practiceQuestions.filter(
        (q) => q.subject?.toLowerCase() === subject.toLowerCase(),
      );
    }

    // Filter by topic if provided
    if (topic) {
      practiceQuestions = practiceQuestions.filter(
        (q) => q.topic?.toLowerCase() === topic.toLowerCase(),
      );
    }

    // Sort randomly for practice variety
    practiceQuestions.sort(() => Math.random() - 0.5);

    // Paginate
    const startIndex = (page - 1) * limit;
    const paginatedQuestions = practiceQuestions.slice(
      startIndex,
      startIndex + parseInt(limit),
    );

    // Remove all answer-key aliases for practice mode
    const sanitizedQuestions = paginatedQuestions.map((q) => {
      const {
        correctAnswer,
        correct_option,
        correctOption,
        correct,
        answer,
        isCorrect,
        is_correct,
        explanation,
        ...safeQuestion
      } = q;

      return safeQuestion;
    });

    res.json({
      success: true,
      data: sanitizedQuestions,
      count: sanitizedQuestions.length,
      total: practiceQuestions.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: practiceQuestions.length,
        totalPages: Math.ceil(practiceQuestions.length / limit),
      },
    });
  } catch (error) {
    console.error("Get practice questions error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// 404 handler - use centralized notFoundHandler
app.use(notFoundHandler);

// ===== CENTRALIZED ERROR HANDLING (Issue #30) =====
// Use centralized error handler middleware - MUST be last
app.use(errorHandler);

// Server start
const startServer = async () => {
  try {
    // Test database connection with retry logic (for Supabase cold starts)
    const connected = await testConnection(5, 3000); // 5 attempts, 3 second initial delay

    if (!connected) {
      console.error("❌ Failed to connect to database after multiple attempts");
      console.error("   This could be due to:");
      console.error(
        "   1. Supabase project is paused (free tier pauses after 7 days)",
      );
      console.error("   2. Invalid DATABASE_URL");
      console.error("   3. Network/firewall issues");
      console.error("");
      console.error(
        "   Please check your Supabase dashboard at https://supabase.com",
      );
      process.exit(1);
    }

    // Start server WITH WebSocket support
    console.log("🔌 Initializing WebSocket server...");
    const server = createServer(app);
    initWebSocket(server);

    console.log("👂 Starting server listener...");
    server.listen(PORT, "0.0.0.0", async () => {
      // Find local network IP to show a helpful Link (like Vite)
      const localIPs = getLocalNetworkIPs();
      const primaryIP = localIPs[0] || "localhost";

      console.log(`🚀 Server running on http://localhost:${PORT}`);
      localIPs.forEach((ip) => {
        console.log(`🌐 Network access: http://${ip}:${PORT}`);
      });
      console.log(
        `💡 TIP: Frontend (port 3000) is configured to proxy requests here.`,
      );
      console.log(`🔌 WebSocket enabled: ws://${primaryIP}:${PORT}`);
      console.log(`📝 API Health: http://${primaryIP}:${PORT}/api/health`);
      console.log(
        `🗄️  Database: PostgreSQL (${process.env.DATABASE_URL?.includes("supabase") ? "Supabase" : "Remote"}) via PostgresHelpers`,
      );

      // Run database initialization in the background
      try {
        console.log("🏗️  Running background database initialization...");
        await dbHelpers.initTables();

        // Initialize Redis (optional in API mode) and background queues
        console.log("📡 Initializing Redis and background queues...");
        await initRedis();
        global.redis = getRedisClient();
        initQueues();

        // Schedule periodic reminder jobs (every 6 hours) when queue is available.
        if (isQueueEnabled()) {
          setInterval(
            async () => {
              try {
                await addJob(
                  QUEUE_NAMES.NOTIFICATIONS,
                  "notifications.scheduled-reminders",
                  {
                    name: "scheduled_reminder",
                    payload: { inactivityHours: 24 },
                    emittedAt: new Date().toISOString(),
                  },
                );
              } catch (error) {
                console.warn(
                  "[Queue] Failed to enqueue scheduled reminder job:",
                  error.message,
                );
              }
            },
            6 * 60 * 60 * 1000,
          );
        }

        console.log(`[Redis] ${getRedisStatus().message}`);
        console.log(`[Queue] ${isQueueEnabled() ? "Enabled" : "Disabled"}`);
        console.log(`✅ Background initialization complete.`);
      } catch (error) {
        console.error(`❌ Background initialization error: ${error.message}`);
      }

      console.log(
        `🔐 Available endpoints: /api/auth/*, /api/admin/*, /api/tests/*, /api/study/*`,
      );
    });
  } catch (error) {
    console.error(`❌ Server startup error: ${error.message}`);
    console.error(
      `   DATABASE_URL: ${process.env.DATABASE_URL ? "Set" : "NOT SET"}`,
    );
    console.error(`   Full error:`, error);
    process.exit(1);
  }
};

startServer();

// ===== GRACEFUL SHUTDOWN HANDLERS =====
// Handle shutdown signals to close database connections properly
const gracefulShutdown = async (signal) => {
  console.log(`\n📤 ${signal} received. Shutting down gracefully...`);

  try {
    await closeQueueResources();
    await closeRedis();
    await dbHelpers.close();
    console.log("✅ Database connections closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error.message);
    process.exit(1);
  }
};

// Listen for termination signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions - log but don't crash
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error.message);
  if (process.env.NODE_ENV === "development") {
    console.error("Stack:", error.stack);
  }
  // Don't exit - let the app continue running if possible
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  // Don't exit - let the app continue running if possible
});

export default app;
