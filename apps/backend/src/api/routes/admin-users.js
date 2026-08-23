import express from "express";
import {
  dbHelpers,
  pool,
  withTransaction,
} from "../../infrastructure/database/postgres-helpers.js";
import { findEntityByIdentifier } from "../../shared/utils/identifier-utils.js";
import { invalidateSession } from "../../services/SessionCaptureService.js";
import {
  protect,
  admin,
  superAdmin,
  invalidateUserCache,
} from "../../middleware/auth.middleware.js";
import logger from "../../infrastructure/logger/logger.js";
import { sanitizeUser } from "../../shared/utils/user-utils.js";

const router = express.Router();

router.use(protect);
router.use(admin);

// List users with pagination and filters
router.get("/users", async (req, res) => {
  try {
    const rawPage = parseInt(req.query.page) || 1;
    const rawLimit = parseInt(req.query.limit) || 20;
    const page = Math.max(1, rawPage);
    const limit = Math.min(Math.max(1, rawLimit), 100); // Max 100 per page
    const offset = (page - 1) * limit;
    const search = req.query.search?.toLowerCase();
    const statusFilter = req.query.status; // 'active' | 'inactive'
    const includeInactive = req.query.includeInactive === "true";
    const roleFilter = req.query.role; // 'admin' | 'user' | 'super_admin'
    const proFilter = req.query.pro === "true";

    // Build query: by default only active users. If includeInactive or status=inactive,
    // include all users so the filter can show inactive ones.
    const query =
      statusFilter === "inactive" || includeInactive ? {} : { isActive: true };

    let allUsers = await dbHelpers.find("users", query);
    let filteredUsers = allUsers;

    // Apply search filter
    if (search) {
      filteredUsers = filteredUsers.filter(
        (u) =>
          u.name?.toLowerCase().includes(search) ||
          u.email?.toLowerCase().includes(search) ||
          u.phone?.toLowerCase().includes(search),
      );
    }

    // Apply role filter
    if (roleFilter) {
      filteredUsers = filteredUsers.filter((u) => u.role === roleFilter);
    }

    // Apply pro filter
    if (proFilter) {
      filteredUsers = filteredUsers.filter((u) => u.isProUser === true);
    }

    // Apply status filter (active vs inactive) when includeInactive is not set
    if (statusFilter && !includeInactive) {
      if (statusFilter === "active") {
        filteredUsers = filteredUsers.filter((u) => u.isActive !== false);
      } else if (statusFilter === "inactive") {
        filteredUsers = filteredUsers.filter((u) => u.isActive === false);
      }
    }

    // Sort by created date descending
    filteredUsers.sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    );

    const total = filteredUsers.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedUsers = filteredUsers.slice(offset, offset + limit);
    const sanitized = paginatedUsers.map(sanitizeUser);

    res.json({
      success: true,
      count: sanitized.length,
      total,
      page,
      limit,
      totalPages,
      data: sanitized,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.put("/users/:id/pro-pass", superAdmin, async (req, res) => {
  try {
    const { isProUser, proPassExpiry, passType } = req.body;
    const user = await dbHelpers.findById("users", req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const expiry = isProUser
      ? proPassExpiry ||
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const updated = await dbHelpers.updateById("users", req.params.id, {
      isProUser: !!isProUser,
      proPassExpiry: expiry,
      pass_type: isProUser ? passType || "pro_yearly" : "free",
    });
    res.json({ success: true, data: sanitizeUser(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// 2FA overview for admin — list users with 2FA status (for user, not admin personal)
// Moved to serve "Two-Factor for user not for admin" — admin can see which students have 2FA enabled
router.get("/users/2fa-overview", async (req, res) => {
  try {
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 50), 100);
    const search = (req.query.search || "").toLowerCase().trim();
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active,
              t.enabled AS twofa_enabled,
              t.enrolled_at AS twofa_enrolled_at,
              COALESCE(jsonb_array_length(t.backup_codes), 0) AS backup_codes_count
       FROM users u
       LEFT JOIN two_factor_secrets t ON t.user_id = u.id::text
       WHERE u.is_deleted IS NOT TRUE
       ORDER BY t.enabled DESC NULLS LAST, u.created_at DESC
       LIMIT $1`,
      [limit],
    );
    let rows = result.rows;
    if (search) {
      rows = rows.filter(
        (r) =>
          (r.name && r.name.toLowerCase().includes(search)) ||
          (r.email && r.email.toLowerCase().includes(search)),
      );
    }
    const data = rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      isActive: r.is_active,
      twoFactorEnabled: Boolean(r.twofa_enabled),
      twoFactorEnrolledAt: r.twofa_enrolled_at,
      backupCodesCount: Number(r.backup_codes_count) || 0,
    }));
    const enabledCount = data.filter((d) => d.twoFactorEnabled).length;
    res.json({
      success: true,
      data,
      meta: {
        total: data.length,
        enabledCount,
        disabledCount: data.length - enabledCount,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch 2FA overview", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to load 2FA overview" });
  }
});

// Admin force-disable a user's 2FA (for user, not admin personal)
router.post("/users/:id/2fa/disable", async (req, res) => {
  try {
    const userId = String(req.params.id);
    const user = await dbHelpers.findById("users", req.params.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    if (String(userId) === String(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "Use personal Disable 2FA for your own account",
      });
    }
    const del = await pool.query(
      "DELETE FROM two_factor_secrets WHERE user_id = $1",
      [userId],
    );
    // Also try numeric variant
    await pool
      .query("DELETE FROM two_factor_secrets WHERE user_id = $1", [
        String(parseInt(userId) || userId),
      ])
      .catch(() => {});
    logger.info(
      `[Admin] ${req.user.email} disabled 2FA for user ${user.email} (${userId})`,
    );
    res.json({ success: true, message: `2FA disabled for ${user.email}` });
  } catch (error) {
    logger.error("Failed to disable user 2FA", error);
    res.status(500).json({ success: false, message: "Failed to disable 2FA" });
  }
});

// Per-user enrollments — returns enriched enrollment rows with related names
router.get("/enrollments/user/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await dbHelpers.findById("users", userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const hasPlanId = await dbHelpers.columnExists("enrollments", "plan_id");

    let enrollmentRecords = [];
    try {
      const planCols = hasPlanId ? ", e.plan_id" : "";
      const planJoin = hasPlanId
        ? " LEFT JOIN subscription_plans sp ON sp.id = e.plan_id"
        : "";
      const planSelect = hasPlanId
        ? ", sp.name AS plan_name"
        : ", NULL AS plan_name";
      const result = await pool.query(
        `SELECT e.id, e.user_id, e.series_id, e.study_material_id, e.exam_id${planCols},
                e.status, e.progress, e.enrolled_at, e.is_active, e.created_at,
                ts.title AS series_name,
                sm.title AS study_material_name${planSelect}
         FROM enrollments e
         LEFT JOIN test_series ts ON ts.id = e.series_id
         LEFT JOIN study_materials sm ON sm.id = e.study_material_id${planJoin}
         WHERE e.user_id = $1 AND (e.is_deleted IS NOT TRUE)
         ORDER BY COALESCE(e.enrolled_at, e.created_at) DESC`,
        [userId],
      );
      enrollmentRecords = result.rows;
    } catch (_) {
      /* enrollments table may not exist — non-fatal */
    }

    const coveredSeriesIds = new Set();
    const coveredMaterialIds = new Set();
    const coveredExamIds = new Set();

    const data = enrollmentRecords.map((row) => {
      if (row.series_id != null) coveredSeriesIds.add(row.series_id);
      if (row.study_material_id != null)
        coveredMaterialIds.add(row.study_material_id);
      if (row.exam_id != null) coveredExamIds.add(row.exam_id);
      const isPassPurchase = !!(
        row.isPassPurchase ??
        row.is_pass_purchase ??
        row.pro_pass ??
        row.plan_name
      );
      return {
        id: row.id,
        _id: row.id,
        userId: row.user_id,
        seriesId: row.series_id ?? null,
        studyMaterialId: row.study_material_id ?? null,
        examId: row.exam_id ?? null,
        planId: row.plan_id ?? null,
        seriesName: row.series_name ?? null,
        studyMaterialName: row.study_material_name ?? null,
        planName: row.plan_name ?? null,
        isPassPurchase,
        passType: isPassPurchase ? "pro_pass" : "subscription",
        status: row.status ?? "active",
        progress: row.progress ?? 0,
        isActive: row.is_active !== false,
        enrolledAt: row.enrolled_at || row.created_at || null,
      };
    });

    // Append legacy user-record arrays (users.enrolled_*) as synthetic rows
    const enrolledExams = user.enrolledExams || [];
    const enrolledSeries = user.enrolledSeries || [];
    const enrolledStudyMaterials = user.enrolledStudyMaterials || [];

    const missingSeriesIds = enrolledSeries
      .map((s) => (typeof s === "object" ? (s.id ?? s._id) : s))
      .filter((id) => id != null && !coveredSeriesIds.has(id));
    const missingMaterialIds = enrolledStudyMaterials
      .map((m) => (typeof m === "object" ? (m.id ?? m._id) : m))
      .filter((id) => id != null && !coveredMaterialIds.has(id));
    const missingExamIds = enrolledExams
      .map((x) => (typeof x === "object" ? (x.id ?? x._id) : x))
      .filter((id) => id != null && !coveredExamIds.has(id));

    const [seriesRows, materialRows, examRows] = await Promise.all([
      missingSeriesIds.length
        ? pool
            .query(
              "SELECT id, title, name FROM test_series WHERE id = ANY($1::int[])",
              [missingSeriesIds],
            )
            .catch(() => ({ rows: [] }))
        : { rows: [] },
      missingMaterialIds.length
        ? pool
            .query(
              "SELECT id, title, name FROM study_materials WHERE id = ANY($1::int[])",
              [missingMaterialIds],
            )
            .catch(() => ({ rows: [] }))
        : { rows: [] },
      missingExamIds.length
        ? pool
            .query("SELECT id, name FROM exams WHERE id = ANY($1::int[])", [
              missingExamIds,
            ])
            .catch(() => ({ rows: [] }))
        : { rows: [] },
    ]);

    for (const s of seriesRows.rows) {
      data.push({
        id: `series-${s.id}`,
        seriesId: s.id,
        seriesName: s.title || s.name || `Series #${s.id}`,
        studyMaterialName: null,
        planName: null,
        isPassPurchase: false,
        passType: "subscription",
        status: "active",
        progress: 0,
        enrolledAt: user.createdAt || null,
      });
    }
    for (const m of materialRows.rows) {
      data.push({
        id: `material-${m.id}`,
        studyMaterialId: m.id,
        seriesName: null,
        studyMaterialName: m.title || m.name || `Material #${m.id}`,
        planName: null,
        isPassPurchase: false,
        passType: "subscription",
        status: "active",
        progress: 0,
        enrolledAt: user.createdAt || null,
      });
    }
    for (const x of examRows.rows) {
      data.push({
        id: `exam-${x.id}`,
        examId: x.id,
        seriesName: null,
        studyMaterialName: null,
        planName: null,
        isPassPurchase: false,
        passType: "subscription",
        status: "active",
        progress: 0,
        enrolledAt: user.createdAt || null,
      });
    }

    res.json({
      success: true,
      data,
      proPass: {
        isProUser: user.isProUser || false,
        proPassExpiry: user.proPassExpiry || user.proExpiry || null,
        passType: user.pass_type || (user.isProUser ? "pro_yearly" : "free"),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update user status (active/inactive)
router.put("/users/:id/status", superAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== "boolean") {
      return res
        .status(400)
        .json({ success: false, message: "isActive must be a boolean value" });
    }
    const user = await dbHelpers.findById("users", req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const updated = await dbHelpers.updateById("users", req.params.id, {
      isActive,
      updatedAt: new Date().toISOString(),
    });
    res.json({ success: true, data: sanitizeUser(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update user role - admin is the highest role
router.put("/users/:id/role", superAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !["admin", "user"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Valid role required (admin or user)",
      });
    }
    const user = await dbHelpers.findById("users", req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const previousRole = user.role;
    const isPromotingToAdmin = role === "admin" && previousRole === "user";
    const isDemotingFromAdmin = role === "user" && previousRole === "admin";

    // Prevent self-demotion
    if (String(req.user.id) === String(req.params.id) && role === "user") {
      return res.status(400).json({
        success: false,
        message: "You cannot remove your own admin role",
      });
    }

    // Prevent demoting a super_admin
    if (role === "user" && user.role === "super_admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot demote a super admin",
      });
    }

    // SECURITY: Role changes involving admin role require admin privileges
    const isPrivilegeChange = isPromotingToAdmin || isDemotingFromAdmin;

    if (isPrivilegeChange) {
      if (!req.user.isAdmin) {
        logger.warn(
          `[SECURITY] Privilege escalation blocked: User ${req.user.id} (${req.user.email}, role: ${req.user.role}) ` +
            `attempted to change role of user ${user.id} (${user.email}) from ${previousRole} to ${role}`,
        );

        await dbHelpers.insertOne("audit_logs", {
          action: "privilege_escalation_attempt",
          resource: "users",
          entity_type: "users",
          resourceId: user.id,
          adminId: req.user.id,
          adminEmail: req.user.email,
          adminName: req.user.name,
          ipAddress:
            req.headers["x-forwarded-for"]?.split(",")[0] ||
            req.socket?.remoteAddress,
          userAgent: req.headers["user-agent"],
          details: {
            targetUserId: user.id,
            targetUserEmail: user.email,
            previousRole,
            newRole: role,
            blocked: true,
            reason: "Requires admin role",
          },
          status: "failure",
          requestMethod: req.method,
          requestPath: req.originalUrl,
          created_at: new Date().toISOString(),
        });

        return res.status(403).json({
          success: false,
          message: "Role changes for users require admin privileges",
        });
      }
    }

    // Audit log for role change
    const auditEntry = {
      action: isPrivilegeChange ? "role_change" : "update",
      resource: "users",
      entity_type: "users",
      resourceId: user.id,
      adminId: req.user.id,
      adminEmail: req.user.email,
      adminName: req.user.name,
      ipAddress:
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
      details: {
        targetUserId: user.id,
        targetUserEmail: user.email,
        previousRole,
        newRole: role,
        isPrivilegeChange,
      },
      status: "success",
      requestMethod: req.method,
      requestPath: req.originalUrl,
      created_at: new Date().toISOString(),
    };

    // Wrap the privilege change and its audit record in a single transaction
    // (A01). A failure writing the audit log must roll back the role change so
    // the two writes can never diverge.
    const updated = await withTransaction(async (client) => {
      const result = await dbHelpers.updateById(
        "users",
        req.params.id,
        { role, updatedAt: new Date().toISOString() },
        client,
      );
      auditEntry.details.successful = true;
      await dbHelpers.insertOne("audit_logs", auditEntry, client);
      return result;
    });

    // M39: bust the in-memory user cache so the role change takes effect
    // immediately (within 1 request) rather than after the 60s TTL.
    invalidateUserCache(Number(req.params.id));

    res.json({ success: true, data: sanitizeUser(updated) });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Delete user (soft delete)
router.delete("/users/:id", async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }
    const user = await dbHelpers.findById("users", req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const deleted = await dbHelpers.softDelete(
      "users",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    // M39: bust cache so soft-deleted user is rejected immediately by protect()
    invalidateUserCache(Number(req.params.id));
    res.json({ success: true, message: "User moved to trash" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Get user's sessions (admin view)
router.get("/users/:id/sessions", async (req, res) => {
  try {
    const userIdParam = req.params.id;

    // Try to get internal ID from public_id
    let userId;
    const user = await findEntityByIdentifier(dbHelpers, "users", userIdParam);
    if (user) {
      userId = user.id || user._id;
    } else {
      // Fall back to numeric ID
      userId = parseInt(userIdParam);
    }

    if (!userId || isNaN(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    const sessions = await dbHelpers.find("user_sessions", { user_id: userId });
    const formattedSessions = (sessions || []).map((s) => ({
      id: s.id,
      sessionId: s.session_id,
      device: s.device_type,
      ip: s.ip_address,
      location:
        s.city && s.country
          ? `${s.city}, ${s.country}`
          : s.country || s.city || "Unknown",
      lastActive: s.last_active,
      isCurrent: s.is_active,
      browser: s.browser,
      os: s.os,
      createdAt: s.created_at,
    }));

    formattedSessions.sort(
      (a, b) => new Date(b.lastActive) - new Date(a.lastActive),
    );

    res.json({ success: true, data: formattedSessions });
  } catch (error) {
    logger.error("Failed to fetch user sessions", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Revoke user session (admin)
router.delete("/users/:userId/sessions/:sessionId", async (req, res) => {
  try {
    const { userId: userIdParam, sessionId } = req.params;

    // Resolve userId to internal ID
    let userId;
    const user = await findEntityByIdentifier(dbHelpers, "users", userIdParam);
    if (user) {
      userId = user.id || user._id;
    } else {
      userId = parseInt(userIdParam);
    }

    const session = await dbHelpers.findById("user_sessions", sessionId);
    if (!session) {
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }

    if (String(session.user_id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: "Session does not belong to this user",
      });
    }

    // Use service to invalidate and emit WebSocket event
    await invalidateSession(sessionId, {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
    });

    res.json({ success: true, message: "Session revoked" });
  } catch (error) {
    logger.error("Failed to revoke user session", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update session limit for a user (admin)
router.put("/users/:userId/session-limit", async (req, res) => {
  try {
    const { userId: userIdParam } = req.params;
    let userId;
    const user = await findEntityByIdentifier(dbHelpers, "users", userIdParam);
    if (user) {
      userId = user.id || user._id;
    } else {
      userId = parseInt(userIdParam, 10);
    }

    if (!userId || isNaN(userId)) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const { sessionLimit, session_limit } = req.body;
    const rawLimit = sessionLimit !== undefined ? sessionLimit : session_limit;
    const limit =
      rawLimit !== undefined && rawLimit !== null && rawLimit !== ""
        ? parseInt(rawLimit, 10)
        : null;

    await pool.query(`UPDATE users SET session_limit = $1 WHERE id = $2`, [
      limit,
      userId,
    ]);

    invalidateUserCache(Number(userId));

    res.json({
      success: true,
      message: "Session limit updated",
      data: { sessionLimit: limit },
    });
  } catch (error) {
    logger.error("Failed to update session limit", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
