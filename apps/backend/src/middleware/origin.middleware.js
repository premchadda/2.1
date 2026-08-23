import { URL } from "url";

// ============================================================
// FIX 2.8b: Origin validation — CSRF defense-in-depth
//
// httpOnly + SameSite=Lax cookies already prevent the browser from attaching
// the auth cookies to cross-site requests for most flows. This middleware adds
// an explicit Origin/Referer check on state-changing (non-GET) requests so that
// a cross-origin request carrying credentials is rejected outright, even if a
// future cookie/header change weakens the SameSite guarantee.
//
// Behaviour:
//  - GET/HEAD/OPTIONS: not state-changing → skipped.
//  - No Origin header: treated as same-origin (browser omits Origin for
//    same-origin navigations / same-origin fetch) → allowed.
//  - Origin host === request host: same-origin → allowed.
//  - Origin host is localhost/loopback (dev proxy, Vite :5173, etc.): allowed
//    in non-production to avoid breaking local development.
//  - Origin in ALLOWED_ORIGINS (comma-separated env): allowed (e.g. a trusted
//    admin SPA on another subdomain that shares the cookie domain).
//  - Otherwise: 403 (CSRF_ORIGIN).
//
// Webhook callbacks (Razorpay, etc.) are explicitly skipped — they legitimately
// arrive from external servers and are protected by signature verification, not
// cookies.
// ============================================================

const TRUSTED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  process.env.CORS_ORIGIN ||
  ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const WEBHOOK_PREFIXES = ["/api/payments/webhook", "/api/webhooks"];

// Explicit allowlist for vercel deployments — wildcard *.vercel.app removed (too permissive)
const VERCEL_ALLOWLIST = new Set([
  "https://trstprep.vercel.app",
  "https://trstprep-admin.vercel.app",
]);

// Strict IPv4 private ranges with octet 0-255 validation
const OCTET = "(?:25[0-5]|2[0-4]\\d|1?\\d{1,2})";
const PRIVATE_IPV4_REGEX = new RegExp(
  `^(?:10\\.${OCTET}\\.${OCTET}\\.${OCTET}|172\\.(?:1[6-9]|2\\d|3[0-1])\\.${OCTET}\\.${OCTET}|192\\.168\\.${OCTET}\\.${OCTET})$`,
);
// IPv6 ULA (fc00::/7), link-local (fe80::/10), and IPv4-mapped private
const PRIVATE_IPV6_PREFIXES = [
  "fc",
  "fd",
  "fe80",
  "::ffff:10.",
  "::ffff:172.",
  "::ffff:192.168.",
];

const isPrivateIP = (hostname) => {
  if (!hostname) return false;
  // Normalize IPv6 zone id (%eth0) and bracket
  const h = hostname
    .replace(/^\[(.*)\]$/, "$1")
    .split("%")[0]
    .toLowerCase();
  if (PRIVATE_IPV4_REGEX.test(h)) return true;
  // IPv6 ULA / link-local / mapped private
  if (h.includes(":")) {
    if (
      h.startsWith("fc") ||
      h.startsWith("fd") ||
      h.startsWith("fe80:") ||
      h.startsWith("fe80::")
    )
      return true;
    // Check IPv4-mapped: ::ffff:192.168.x.x etc
    for (const p of PRIVATE_IPV6_PREFIXES) {
      if (h.startsWith(p)) return true;
    }
    // Full fc00::/7 check via first byte: fc or fd
    if (/^f[c-d][0-9a-f]*:/.test(h)) return true;
  }
  return false;
};

const isLoopback = (hostname) => {
  if (!hostname) return false;
  const h = hostname
    .replace(/^\[(.*)\]$/, "$1")
    .split("%")[0]
    .toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "::ffff:127.0.0.1" ||
    h === "0.0.0.0" ||
    h === "::" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local")
  );
};

const sameOriginHost = (originHost, requestHost) => {
  if (!requestHost) return false;
  // Compare host with and without explicit port. Handle IPv6 bracketed hosts.
  const normalizeHost = (host) => {
    if (!host) return "";
    // Strip port unless it's IPv6 bracketed [::1]:3000
    if (host.startsWith("[")) {
      const close = host.indexOf("]");
      if (close !== -1) {
        const after = host.slice(close + 1);
        if (after.startsWith(":")) return host.slice(0, close + 1);
        return host;
      }
      return host;
    }
    return host.split(":")[0];
  };
  return (
    originHost === requestHost ||
    normalizeHost(originHost) === normalizeHost(requestHost) ||
    originHost === normalizeHost(requestHost)
  );
};

// Resolve origin with Referer fallback for browsers that suppress Origin on same-origin POST
const getRequestOrigin = (req) => {
  const origin = req.headers.origin;
  if (origin) return origin;
  const referer = req.headers.referer || req.headers.referrer;
  if (referer) {
    try {
      const u = new URL(referer);
      return u.origin;
    } catch {
      return referer;
    }
  }
  return null;
};

export const validateOrigin = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const path = req.path || req.originalUrl || "";
  if (WEBHOOK_PREFIXES.some((p) => path.startsWith(p))) return next();

  const origin = getRequestOrigin(req);
  // No Origin and no Referer → same-origin or non-browser client. Allow; CSRF tokens still gate mutations.
  if (!origin) return next();

  let originHost;
  let originHostname;
  try {
    const parsedOrigin = new URL(origin);
    originHost = parsedOrigin.host;
    originHostname = parsedOrigin.hostname;
  } catch {
    return res.status(403).json({
      success: false,
      code: "CSRF_ORIGIN",
      message: "Invalid Origin header",
    });
  }

  const requestHost =
    req.headers["x-forwarded-host"] || req.headers.host || null;

  if (sameOriginHost(originHost, requestHost)) return next();

  const envOrigins = (
    process.env.ALLOWED_ORIGINS ||
    process.env.CORS_ORIGIN ||
    ""
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const trustedOrigins = new Set(
    [
      ...envOrigins,
      ...(process.env.ALLOWED_LAN_HOSTS || "")
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean)
        .map((h) => (h.startsWith("http") ? h : `http://${h}`)),
      process.env.FRONTEND_URL,
      process.env.ADMIN_PANEL_URL,
      ...VERCEL_ALLOWLIST,
    ].filter(Boolean),
  );

  // Explicit allowlist only — wildcard *.vercel.app removed to avoid subdomain takeover
  if (trustedOrigins.has(origin) || VERCEL_ALLOWLIST.has(origin)) return next();

  // Development convenience: allow loopback and private LAN origins regardless of port
  if (
    process.env.NODE_ENV !== "production" &&
    (isLoopback(originHostname) || isPrivateIP(originHostname))
  )
    return next();

  console.warn(
    `[CSRF] Blocked cross-origin state-changing request from ${origin} to ${requestHost || path}`,
  );
  return res.status(403).json({
    success: false,
    code: "CSRF_ORIGIN",
    message: "Cross-origin request blocked",
  });
};

// ============================================================
// FIX: Admin route security layers (legacy exports retained for
// compatibility with admin.js / module controllers)
//
// The admin SPA previously sent an `X-Admin-API-Key` header, but that was
// removed during the security audit (VITE_ADMIN_API_KEY leaked the key in the
// client bundle). Admin authorization now relies exclusively on the httpOnly
// cookie + JWT (`protect`/`admin` middleware). These two middlewares preserve
// the original defense-in-depth layering without re-introducing the leaked key.
// ============================================================

const ADMIN_PANEL_URL = (process.env.ADMIN_PANEL_URL || "").trim();

// Layer 1: restrict admin state-changing requests to the admin panel origin.
//  - GET/HEAD/OPTIONS: not state-changing → skipped.
//  - No Origin header: same-origin / non-browser client → allowed.
//  - Origin host === request host: same-origin → allowed.
//  - Origin host === configured ADMIN_PANEL_URL: the trusted admin SPA → allowed.
//  - Origin is loopback: allowed in non-production (admin panel on :3002, etc.).
//  - Otherwise: 403.
export const restrictAdminOrigin = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const path = req.path || req.originalUrl || "";
  if (WEBHOOK_PREFIXES.some((p) => path.startsWith(p))) return next();

  const origin = getRequestOrigin(req);
  if (!origin) return next();

  let originHost;
  let originHostname;
  try {
    const parsedOrigin = new URL(origin);
    originHost = parsedOrigin.host;
    originHostname = parsedOrigin.hostname;
  } catch {
    return res.status(403).json({
      success: false,
      code: "ADMIN_ORIGIN",
      message: "Invalid Origin header",
    });
  }

  const requestHost =
    req.headers["x-forwarded-host"] || req.headers.host || null;

  if (sameOriginHost(originHost, requestHost)) return next();

  const envOrigins = (
    process.env.ALLOWED_ORIGINS ||
    process.env.CORS_ORIGIN ||
    ""
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const trustedOrigins = new Set(
    [
      ...envOrigins,
      ...(process.env.ALLOWED_LAN_HOSTS || "")
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean)
        .map((h) => (h.startsWith("http") ? h : `http://${h}`)),
      process.env.FRONTEND_URL,
      process.env.ADMIN_PANEL_URL,
      ...VERCEL_ALLOWLIST,
    ].filter(Boolean),
  );

  if (trustedOrigins.has(origin) || VERCEL_ALLOWLIST.has(origin)) return next();

  if (ADMIN_PANEL_URL) {
    try {
      if (new URL(ADMIN_PANEL_URL).host === originHost) return next();
    } catch {
      // malformed ADMIN_PANEL_URL → fall through to rejection
    }
  }

  if (
    process.env.NODE_ENV !== "production" &&
    (isLoopback(originHostname) || isPrivateIP(originHostname))
  )
    return next();

  console.warn(
    `[ADMIN] Blocked non-admin-origin state-changing request from ${origin}`,
  );
  return res.status(403).json({
    success: false,
    code: "ADMIN_ORIGIN",
    message: "Admin requests must originate from the admin panel",
  });
};

// Layer 2: API-key check — defense-in-depth for server-to-server / curl clients.
// If ADMIN_API_KEY is set server-side, require either a matching `X-Admin-API-Key`
// header OR a request originating from the verified admin panel origin.
export const validateAdminApiKey = (req, res, next) => {
  const configuredKey = process.env.ADMIN_API_KEY;
  if (!configuredKey) return next();

  const provided = req.headers["x-admin-api-key"];
  if (provided && provided === configuredKey) return next();

  // Allow verified browser requests originating from the admin panel to proceed to protect/admin checks
  const origin = req.headers.origin || req.headers.referer || "";
  if (origin) {
    try {
      const parsedOrigin = new URL(origin);
      const originHost = parsedOrigin.host;
      const originHostname = parsedOrigin.hostname;
      const requestHost =
        req.headers["x-forwarded-host"] || req.headers.host || null;

      if (sameOriginHost(originHost, requestHost)) return next();
      if (VERCEL_ALLOWLIST.has(origin)) return next();

      if (ADMIN_PANEL_URL) {
        try {
          if (new URL(ADMIN_PANEL_URL).host === originHost) return next();
        } catch {
          // ignore
        }
      }

      const envOrigins = (
        process.env.ALLOWED_ORIGINS ||
        process.env.CORS_ORIGIN ||
        ""
      )
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (envOrigins.includes(origin)) return next();

      const lanOrigins = (process.env.ALLOWED_LAN_HOSTS || "")
        .split(",")
        .map((h) => h.trim())
        .filter(Boolean)
        .map((h) => (h.startsWith("http") ? h : `http://${h}`));
      if (lanOrigins.includes(origin)) return next();

      if (
        process.env.NODE_ENV !== "production" &&
        (isLoopback(originHostname) || isPrivateIP(originHostname))
      ) {
        return next();
      }
    } catch {
      // ignore URL parse errors
    }
  }

  console.warn(
    `[ADMIN] Rejected state-changing request with invalid/missing admin API key from ${origin || "unknown origin"}`,
  );
  return res.status(403).json({
    success: false,
    code: "ADMIN_API_KEY",
    message: "Invalid or missing admin API key",
  });
};

export const isAdminEndpoint = (req) => {
  const path = req.path || req.originalUrl || "";
  return path.startsWith("/api/admin");
};

export default validateOrigin;
