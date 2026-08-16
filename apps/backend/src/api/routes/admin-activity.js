import express from "express";
import { dbHelpers, pool } from "../../infrastructure/database/postgres-helpers.js";
import { parsePagination, paginateResponse } from "./admin-helpers.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { protect, admin, superAdmin } from '../../middleware/auth.middleware.js';
import { responseCache } from '../../middleware/responseCache.middleware.js';
import logger from "../../infrastructure/logger/logger.js";

const router = express.Router();

router.use(protect)
router.use(admin)

// ===== RECENT ACTIVITY =====
// PERF: cache for 30s so repeated dashboard loads are instant.
router.get("/recent-activity", responseCache("admin-recent-activity", 30), asyncHandler(async (req, res) => {
  // FIX PERF-1: Previously loaded every row of users (twice), attempts, tests,
  // and assets into Node memory then sorted/sliced in JS — O(n) full-table scans
  // that became catastrophic at scale (100k users = multi-second response, ~50MB RAM).
  // Now: three tiny SQL queries with ORDER BY + LIMIT + JOINs push all work to PG.
  const recentActivity = [];

  const formatTimeAgo = (ts) => {
    const timeDiff = Date.now() - new Date(ts).getTime();
    const minutes = Math.floor(timeDiff / (1000 * 60));
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    return minutes < 60
      ? `${minutes} minute${minutes !== 1 ? "s" : ""} ago`
      : hours < 24
        ? `${hours} hour${hours !== 1 ? "s" : ""} ago`
        : `${Math.floor(hours / 24)} day${Math.floor(hours / 24) !== 1 ? "s" : ""} ago`;
  };

  // Execute the 3 small activity queries concurrently
  const [recentUsersResult, recentCompletionsResult, recentMediaResult] = await Promise.all([
    // Recent user registrations (top 3 by created_at)
    pool.query(
      `SELECT id, name, email, created_at
         FROM users
        WHERE created_at IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 3`,
    ),
    // Recent test completions (top 3 by submitted_at)
    pool.query(
      `SELECT a.user_id, a.submitted_at, u.name AS user_name, t.title AS test_title
         FROM attempts a
         LEFT JOIN users u ON a.user_id = u.id
         LEFT JOIN tests t ON a.test_id  = t.id
        WHERE a.is_completed = true
          AND COALESCE(a.submitted_at, a.created_at) IS NOT NULL
        ORDER BY a.submitted_at DESC NULLS LAST
        LIMIT 3`,
    ),
    // Recent media uploads (top 2 by created_at)
    pool.query(
      `SELECT name, file_type, mime_type, uploaded_by, created_at
          FROM assets
         WHERE created_at IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 2`,
    ),
  ]);

  for (const u of recentUsersResult.rows) {
    recentActivity.push({
      type: "user_registration",
      title: "New user registered",
      description: `${u.name || u.email} joined the platform`,
      time: formatTimeAgo(u.created_at),
      userId: u.id,
      icon: "users",
      color: "text-blue-600",
      _sortTs: new Date(u.created_at).getTime(),
    });
  }

  for (const r of recentCompletionsResult.rows) {
    recentActivity.push({
      type: "test_completed",
      title: "Test completed",
      description: `${r.user_name || "A user"} completed ${r.test_title || "a test"}`,
      time: formatTimeAgo(r.submitted_at),
      userId: r.user_id,
      icon: "test",
      color: "text-green-600",
      _sortTs: new Date(r.submitted_at).getTime(),
    });
  }

  for (const m of recentMediaResult.rows) {
    const isVideo =
      (m.file_type || "").toLowerCase() === "video" ||
      (m.mime_type || "").startsWith("video/");
    const description = m.name || "New file uploaded";
    recentActivity.push({
      type: isVideo ? "media_uploaded" : "content_uploaded",
      title: isVideo ? "Video content uploaded" : "Study material uploaded",
      description,
      time: formatTimeAgo(m.created_at),
      userId: m.uploaded_by,
      icon: isVideo ? "video" : "book",
      color: isVideo ? "text-indigo-600" : "text-purple-600",
      _sortTs: new Date(m.created_at).getTime(),
    });
  }

  // Sort by actual timestamp (most recent first) and limit to 8 items
  recentActivity.sort((a, b) => (b._sortTs || 0) - (a._sortTs || 0));
  const cleaned = recentActivity.slice(0, 8).map(item => {
    const result = { ...item };
    delete result._sortTs;
    return result;
  });

  res.json({ success: true, data: cleaned });
}));

// ===== ACTIVITY ORDER REPORT =====
router.get("/activity-order", asyncHandler(async (req, res) => {
  // Get recent user activities ordered by timestamp
  const activities = [];

  // Get recent user registrations
  const recentUsers = await dbHelpers.pool.query(
    `SELECT id, name, email, created_at, 'user_registration' as activity_type 
     FROM users ORDER BY created_at DESC LIMIT 50`,
  );
  recentUsers.rows.forEach((u) => {
    activities.push({
      id: u.id,
      type: u.activity_type,
      description: `${u.name || u.email} registered`,
      timestamp: u.created_at,
    });
  });

  // Get recent test attempts
  const recentAttempts = await dbHelpers.pool.query(
    `SELECT a.id, a.user_id, a.test_id, a.score, a.created_at, 
            u.name as user_name, t.title as test_title
     FROM attempts a
     LEFT JOIN users u ON a.user_id = u.id
     LEFT JOIN tests t ON a.test_id = t.id
     ORDER BY a.created_at DESC LIMIT 50`,
  );
  recentAttempts.rows.forEach((a) => {
    activities.push({
      id: a.id,
      type: "test_attempt",
      description: `${a.user_name || "User"} attempted ${a.test_title || "test"} (Score: ${a.score || 0})`,
      timestamp: a.created_at,
    });
  });

  // Sort all activities by timestamp and limit
  activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  res.json({
    success: true,
    data: activities.slice(0, 100),
    count: activities.length,
  });
}));

// ===== ACTIVITY LOGS =====
router.get("/activity-logs", asyncHandler(async (req, res) => {
  const { userId, action } = req.query;
  const { limit, offset } = parsePagination(req.query);

  let logs = await dbHelpers.find("activityLogs", {}, limit, offset);

  // Filter by user if specified
  if (userId) {
    logs = logs.filter((log) => log.userId === userId);
  }

  // Filter by action if specified
  if (action) {
    logs = logs.filter((log) => log.action === action);
  }

  // Sort by most recent (already paginated at the DB layer)
  logs = logs
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ success: true, ...paginateResponse(logs, limit, offset), count: logs.length });
}));

router.post("/activity-logs", asyncHandler(async (req, res) => {
  const { userId, action, description, metadata } = req.body;

  const log = await dbHelpers.insertOne("activityLogs", {
    userId,
    action,
    description,
    metadata: metadata || {},
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ success: true, data: log });
}));

export default router;
