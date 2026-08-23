import { pool } from "../infrastructure/database/postgres-helpers.js";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const resourceForPath = (path = "") => {
  const segments = path.split("?")[0].split("/").filter(Boolean);
  const resource = segments[0] || "content";
  // Don't allow .. in path
  if (resource.includes("..")) {
    return null;
  }
  if (
    ["users", "enrollments", "sessions", "roles", "permissions"].includes(
      resource,
    )
  )
    return "users";
  if (
    [
      "tests",
      "test-series",
      "questions",
      "quizzes",
      "sections",
      "stages",
      "exam-categories",
      "exam-info",
      "exams",
    ].includes(resource)
  )
    return "tests";
  if (
    [
      "settings",
      "system-settings",
      "system",
      "backups",
      "navigation",
      "two-factor",
    ].includes(resource)
  )
    return "settings";
  if (
    [
      "payments",
      "subscription-plans",
      "plans",
      "coupons",
      "promotions",
    ].includes(resource)
  )
    return "monetization";
  if (
    ["banners", "faqs", "notifications", "email-templates"].includes(resource)
  )
    return "communications";
  if (["moderation"].includes(resource)) return "moderation";
  if (["audit", "audit-trail", "results"].includes(resource)) return "audit";
  if (["analytics", "deep-analytics", "leaderboards"].includes(resource))
    return "analytics";
  return "content";
};

const actionForMethod = (method) => {
  if (READ_METHODS.has(method)) return "view";
  if (method === "POST") return "create";
  if (method === "DELETE") return "delete";
  return "edit";
};

/**
 * Default permissions granted to any user with `role = admin` who has not yet
 * been assigned an explicit RBAC role (`user_roles`). This preserves the
 * hardening performed in audit fix H6 (no more wildcard `*` permissions for
 * every admin) while preventing existing admins from being locked out by
 * missing permission tables. Once an admin is granted a role in
 * `user_roles`, their granular permissions take over.
 *
 * SECURITY: This list ONLY activates if and only if:
 *   1. The user is authenticated (`req.user` exists)
 *   2. The user has `isAdmin === true`
 *   3. The user has zero matching rows in `role_permissions`
 */
const DEFAULT_ADMIN_TIER_PERMISSIONS = Object.freeze([
  "users:view",
  "users:create",
  "users:edit",
  "users:delete",
  "tests:view",
  "tests:create",
  "tests:edit",
  "tests:delete",
  "content:view",
  "content:create",
  "content:edit",
  "content:delete",
  "settings:view",
  "settings:create",
  "settings:edit",
  "settings:delete",
  "monetization:view",
  "monetization:create",
  "monetization:edit",
  "monetization:delete",
  "communications:view",
  "communications:create",
  "communications:edit",
  "communications:delete",
  "moderation:view",
  "moderation:create",
  "moderation:edit",
  "moderation:delete",
  "audit:view",
  "audit:create",
  "audit:edit",
  "audit:delete",
  "analytics:view",
  "analytics:create",
  "analytics:edit",
  "analytics:delete",
]);

const permissionsCache = new Map();
const PERMISSIONS_CACHE_TTL_MS = 60_000;

export const invalidateAdminPermissionsCache = (userId) => {
  if (userId) permissionsCache.delete(String(userId));
  else permissionsCache.clear();
};

export const loadAdminPermissions = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    if (req.user) req.user.permissions = [];
    return next();
  }

  const userIdStr = String(req.user.id);
  const cached = permissionsCache.get(userIdStr);
  if (cached && Date.now() < cached.expiresAt) {
    req.user.permissions = cached.permissions;
    req.user.permissionSource = cached.permissionSource;
    return next();
  }

  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT p.name
       FROM user_roles ur
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN permissions p ON p.id = rp.permission_id
       WHERE ur.user_id = $1`,
      [req.user.id],
    );

    // SECURITY FIX (H6): Admin users MUST have explicit role_permissions entries.
    // Previously, admins with no role_permissions were auto-granted ['*'],
    // bypassing RBAC entirely. Now, missing permissions = 403.
    //
    // BACKWARD-COMPATIBILITY: For admins with no explicit role assignment,
    // fall back to the default admin tier permission set so they can still
    // access the panel. The moment a role is assigned, the explicit
    // permissions take precedence.
    if (rows.length === 0 && req.user?.isAdmin) {
      req.user.permissions = [...DEFAULT_ADMIN_TIER_PERMISSIONS];
      req.user.permissionSource = "default-admin-tier";
      permissionsCache.set(userIdStr, {
        permissions: req.user.permissions,
        permissionSource: req.user.permissionSource,
        expiresAt: Date.now() + PERMISSIONS_CACHE_TTL_MS,
      });
      return next();
    }

    req.user.permissions = rows.map((row) => row.name);
    req.user.permissionSource = "rbac";
    permissionsCache.set(userIdStr, {
      permissions: req.user.permissions,
      permissionSource: req.user.permissionSource,
      expiresAt: Date.now() + PERMISSIONS_CACHE_TTL_MS,
    });
    next();
  } catch (error) {
    console.error(
      "[RBAC] Error loading permissions for user",
      req.user?.id,
      ":",
      error.message,
    );
    // FAIL-CLOSED: on permission load error, deny access to prevent potential security bypass
    return res.status(403).json({
      success: false,
      message:
        "Access denied: Unable to verify permissions due to a system error",
      code: "RBAC_VERIFICATION_ERROR",
    });
  }
};

export const requireAdminPermission = (req, res, next) => {
  const permissions = req.user?.permissions || [];
  if (permissions.includes("*") || req.user?.role === "super_admin")
    return next();

  const segments = (req.path || "").split("?")[0].split("/").filter(Boolean);
  const rawResource = segments[0] || "content";
  if (rawResource.includes("..")) {
    return res.status(400).json({ error: "Invalid path" });
  }

  const resource = resourceForPath(req.path);
  if (resource === null) {
    return res.status(400).json({ error: "Invalid path" });
  }
  const action = actionForMethod(req.method);
  const required = `${resource}:${action}`;

  // Action aliases: view <-> read, create/edit <-> write/update
  const actionsToCheck = new Set([action]);
  if (action === "view") actionsToCheck.add("read");
  if (action === "read") actionsToCheck.add("view");
  if (action === "edit") {
    actionsToCheck.add("write");
    actionsToCheck.add("update");
  }
  if (action === "create") actionsToCheck.add("write");
  if (action === "write") {
    actionsToCheck.add("create");
    actionsToCheck.add("edit");
    actionsToCheck.add("update");
  }

  // Resources to check: grouped canonical resource and raw segment resource
  const resourcesToCheck = Array.from(
    new Set([resource, rawResource, rawResource.replace(/-/g, "_")]),
  );

  for (const resName of resourcesToCheck) {
    if (permissions.includes(`${resName}:*`)) return next();
    for (const act of actionsToCheck) {
      if (permissions.includes(`${resName}:${act}`)) return next();
    }
  }

  // Content fallback for general content resources
  if (
    resource === "content" &&
    (permissions.includes("content:read") ||
      permissions.includes("content:view"))
  ) {
    return next();
  }

  console.error(
    "[RBAC] DENIED:",
    required,
    "- path:",
    req.path,
    "- method:",
    req.method,
    "- permissions:",
    permissions,
    "- user:",
    req.user?.id,
  );
  return res.status(403).json({
    success: false,
    message: "You do not have permission to perform this admin operation",
    requiredPermission: required,
  });
};
