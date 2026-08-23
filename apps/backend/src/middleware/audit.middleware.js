import { pool } from "../infrastructure/database/postgres-helpers.js";

export const AUDIT_ACTIONS = {
  CREATE: "create",
  READ: "read",
  UPDATE: "update",
  DELETE: "delete",
  LOGIN: "login",
  LOGOUT: "logout",
  LOGIN_FAILED: "login_failed",
  ROLE_CHANGE: "role_change",
  PRIVILEGE_ESCALATION: "privilege_escalation",
  ACCESS_DENIED: "access_denied",
  SETTINGS_CHANGE: "settings_change",
  BULK_OPERATION: "bulk_operation",
  ENROLLMENT: "enrollment",
  UNENROLLMENT: "unenrollment",
  SUBSCRIPTION: "subscription",
};

export const AUDIT_RESOURCES = {
  USERS: "users",
  TEST_SERIES: "test_series",
  TESTS: "tests",
  QUESTIONS: "questions",
  ENROLLMENTS: "enrollments",
  SUBSCRIPTIONS: "subscriptions",
  SETTINGS: "settings",
  NAVIGATION: "navigation",
  ASSETS: "assets",
  EXAMS: "exams",
  CATEGORIES: "categories",
  STAGES: "stages",
  NOTIFICATIONS: "notifications",
  COUPONS: "coupons",
  STUDY_MATERIALS: "study_materials",
  CHAPTERS: "chapters",
  VIDEOS: "videos",
  PDFS: "pdfs",
  FAQS: "faqs",
  BANNERS: "banners",
};

const getClientIp = (req) => {
  if (req?.ip) {
    let ip = String(req.ip).trim();
    if (ip.startsWith("::ffff:")) ip = ip.slice(7);
    if (ip === "::1") return "127.0.0.1";
    if (ip) return ip;
  }
  const forwardedFor = req.headers?.["x-forwarded-for"];
  if (forwardedFor) {
    const first = String(forwardedFor).split(",")[0].trim();
    if (first.startsWith("::ffff:")) return first.slice(7);
    return first;
  }
  const sock = req.socket?.remoteAddress || req.connection?.remoteAddress;
  if (sock) {
    if (sock.startsWith("::ffff:")) return sock.slice(7);
    if (sock === "::1") return "127.0.0.1";
    return sock;
  }
  return "unknown";
};

const getUserAgent = (req) => {
  return req.headers["user-agent"] || "unknown";
};

/**
 * Keys considered sensitive when capturing request bodies/queries into the
 * audit trail. Matches any key containing secret/password/token/api-key,
 * jwt, pass/pwd, otp, private/access key or credential (case insensitive),
 * e.g. smtpPassword, razorpayKeySecret, googleClientSecret, apiKey,
 * api_key, refreshToken, jwtSecret, otpCode, accessKey, clientCredential.
 */
const SENSITIVE_KEY_PATTERN =
  /secret|password|token|api[_-]?key|jwt|pass|pwd|otp|private[_-]?key|access[_-]?key|credential/i;

/**
 * Deep-redact sensitive values inside a captured request body, replacing them
 * with '[REDACTED]'. Never mutates the original body — returns a new object.
 */
function redactSensitiveValues(value) {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValues(item));
  }
  if (value && typeof value === "object") {
    const redacted = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      redacted[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? "[REDACTED]"
        : redactSensitiveValues(nestedValue);
    }
    return redacted;
  }
  return value;
}

const determineAction = (method) => {
  if (method === "GET") return AUDIT_ACTIONS.READ;
  if (method === "POST") return AUDIT_ACTIONS.CREATE;
  if (["PUT", "PATCH"].includes(method)) return AUDIT_ACTIONS.UPDATE;
  if (method === "DELETE") return AUDIT_ACTIONS.DELETE;
  return AUDIT_ACTIONS.READ;
};

const determineResource = (path) => {
  const segments = path.split("/").filter(Boolean);
  if (segments.includes("admin")) {
    const adminIndex = segments.indexOf("admin");
    if (segments[adminIndex + 1]) {
      return segments[adminIndex + 1];
    }
  }
  return "unknown";
};

/**
 * Write a single audit event directly to the audit_logs table using pool.query.
 * Falls back silently on error so it never disrupts the main request flow.
 * Writes audit event to the audit_logs table.
 * Falls back silently on error so it never disrupts the main request flow.
 * RE-ENABLED: Migration 008 added old_values/new_values columns.
 */
export const logAuditEvent = async ({
  action,
  resource,
  resourceId = null,
  adminId = null,
  adminEmail = null,
  adminName = null,
  ipAddress = "unknown",
  userAgent = "unknown",
  details = {},
  status = "success",
  requestMethod = "UNKNOWN",
  requestPath = "unknown",
  responseStatusCode = null,
  description = null,
  entityType = null,
  entityId = null,
  oldValues = null,
  newValues = null,
}) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (
         user_id, action, entity_type, resource, resource_id,
         ip_address, user_agent, description, status,
         request_method, request_path, response_status_code,
         admin_email, admin_name, details,
         entity_id, old_values, new_values
       ) VALUES (
         $1,$2,$3,$4,$5,
         $6,$7,$8,$9,
         $10,$11,$12,
         $13,$14,$15,
         $16,$17,$18
       )`,
      [
        adminId || null,
        action,
        entityType || resource || "unknown",
        resource || null,
        resourceId || null,
        ipAddress,
        userAgent,
        description || null,
        status,
        requestMethod,
        requestPath,
        responseStatusCode,
        adminEmail || null,
        adminName || null,
        details ? JSON.stringify(details) : null,
        entityId || null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
      ],
    );
  } catch (error) {
    // Silent failure — audit logging must never disrupt request flow
    console.error("[AUDIT] Failed to write audit log:", error.message);
  }
};

export const auditMiddleware = (options = {}) => {
  const {
    skipPaths = [],
    includeBody = false,
    resourceResolver,
    actionResolver,
  } = options;

  const defaultSkipPaths = [
    "/api/admin/stats",
    "/api/admin/exams",
    "/api/admin/navigation",
    "/api/admin/audit-logs", // don't audit the audit viewer itself
  ];

  const allSkipPaths = [...defaultSkipPaths, ...skipPaths];

  return async (req, res, next) => {
    const shouldSkip = allSkipPaths.some(
      (path) => req.path.startsWith(path) || req.originalUrl.startsWith(path),
    );

    if (shouldSkip) {
      return next();
    }

    const originalEnd = res.end;
    res.end = function (chunk, encoding) {
      res.end = originalEnd;
      res.end(chunk, encoding);
    };

    res.on("finish", async () => {
      try {
        const action =
          actionResolver?.(req, res) || determineAction(req.method);
        const resource =
          (
            resourceResolver?.(req) || determineResource(req.originalUrl)
          )?.slice(0, 100) || null;

        let resourceId = null;
        const pathParts = req.path.split("/").filter(Boolean);
        if (pathParts.length > 0) {
          const lastPart = pathParts[pathParts.length - 1];
          const RESERVED = [
            "admin",
            "create",
            "bulk",
            "list",
            "stats",
            "search",
          ];
          if (!RESERVED.includes(lastPart)) {
            // Match both integer IDs and UUID v4 format
            const isIntId = /^\d+$/.test(lastPart);
            const isUuidId =
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                lastPart,
              );
            if (isIntId || isUuidId) {
              resourceId = lastPart;
            }
          }
        }

        const details = {
          method: req.method,
          path: req.originalUrl,
          query: redactSensitiveValues(req.query),
        };

        if (includeBody && req.body && Object.keys(req.body).length > 0) {
          details.body = redactSensitiveValues(req.body);
        }

        await logAuditEvent({
          action,
          resource,
          resourceId,
          adminId: req.user?.id,
          adminEmail: req.user?.email,
          adminName: req.user?.name,
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
          details,
          status: res.statusCode >= 400 ? "failure" : "success",
          requestMethod: req.method,
          requestPath: req.originalUrl,
          responseStatusCode: res.statusCode,
        });
      } catch (error) {
        console.error("[AUDIT] Middleware error:", error.message);
      }
    });

    next();
  };
};

export const createAuditLog = async (
  req,
  {
    action,
    resource,
    resourceId,
    details = {},
    status = "success",
    entityType = null,
    entityId = null,
    oldValues = null,
    newValues = null,
  },
) => {
  return logAuditEvent({
    action,
    resource,
    resourceId,
    adminId: req.user?.id,
    adminEmail: req.user?.email,
    adminName: req.user?.name,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
    details,
    status,
    requestMethod: req.method,
    requestPath: req.originalUrl,
    entityType,
    entityId,
    oldValues,
    newValues,
  });
};

export default {
  AUDIT_ACTIONS,
  AUDIT_RESOURCES,
  auditMiddleware,
  logAuditEvent,
  createAuditLog,
};
