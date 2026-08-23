import crypto from "crypto";
import logBuffer from "../infrastructure/logger/logBuffer.js";

const ID_MAX_LENGTH = 64;

// SEC: Reject attacker-controlled `x-request-id` values that contain
// characters usable for log/header injection. Anything unsafe is ignored
// and a server-generated id is used instead.
const sanitizeRequestId = (raw) => {
  if (typeof raw !== "string") return null;
  if (raw.length > ID_MAX_LENGTH || raw.length === 0) return null;
  return /^[A-Za-z0-9._:/=+-]+$/.test(raw) ? raw : null;
};

// OBS-01: Correlation ID middleware for distributed tracing.
// Use a sanitized x-request-id if present, else generate UUIDv4.
export const traceMiddleware = (req, res, next) => {
  const incoming = sanitizeRequestId(req.headers["x-request-id"]);
  const id = incoming || crypto.randomUUID();
  req.id = id;
  req.traceId = id;
  res.setHeader("X-Request-Id", id);
  req.startTime = Date.now();

  // Capture HTTP completion in logBuffer (exclude log stream to prevent self-loop)
  res.on("finish", () => {
    try {
      const url = req.originalUrl || req.url;
      if (url.includes("/api/admin/logs/stream")) return;

      const duration = Date.now() - req.startTime;
      const status = res.statusCode;
      let level = "info";
      if (status >= 500) level = "error";
      else if (status >= 400) level = "warn";

      logBuffer.push({
        level,
        source: "http",
        message: `${req.method} ${url} ${status} - ${duration}ms`,
        meta: {
          method: req.method,
          url,
          status,
          durationMs: duration,
          ip:
            req.ip ||
            req.headers["x-forwarded-for"] ||
            req.socket.remoteAddress,
          requestId: id,
          userId: req.user?.id || null,
        },
      });
    } catch {
      // intentionally empty - log buffer failure should not break request
    }
  });

  next();
};
