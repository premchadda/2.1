import cors from "cors";
import os from "os";

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

// Allowed origins for CORS - production-safe allowlist (no localhost/dev ports).
// Dev-only origins (localhost / LAN IPs) are merged in below when NODE_ENV
// is not 'production' (MED-12). This prevents accidentally shipping a
// development allowlist to production.
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.ADMIN_PANEL_URL, // Admin panel origin for security
].filter(Boolean);

const devOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:3001",
  "http://localhost:3002",
  ...localIPs.map((ip) => `http://${ip}:3000`),
  ...localIPs.map((ip) => `http://${ip}:5173`),
];

if (process.env.NODE_ENV !== "production") {
  allowedOrigins.push(...devOrigins);
}

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

export const corsMiddleware = cors({
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
});
