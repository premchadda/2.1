import helmet from "helmet";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";

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

export const helmetMiddleware = helmet(helmetOptions);

// Rate limiting - prevent abuse
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  skip: (req) => {
    if (process.env.NODE_ENV === "development") return true;
    if (req.path === "/health") return true;
    return false;
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit auth attempts (login, register, forgot-password)
  message: {
    success: false,
    message: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (process.env.NODE_ENV === "development") return true;
    // Don't rate limit health checks
    if (req.path === "/health") return true;
    // Don't rate limit session checks (GET /me) or CSRF fetches — these are
    // called on every page load and are safe read-only operations.
    if (req.method === "GET" && (req.path === "/me" || req.path === "/csrf"))
      return true;
    return false;
  },
});

// Admin rate limiter - higher limits for admin bulk operations
export const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Higher limit for admin bulk operations
  message: {
    success: false,
    message: "Too many admin requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "development",
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
    return req.ip;
  },
});
