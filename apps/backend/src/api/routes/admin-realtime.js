import express from "express";
import { dbHelpers, pool } from "../../infrastructure/database/postgres-helpers.js";
import { getProPassPrice } from "./admin-helpers.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { protect, admin, superAdmin } from '../../middleware/auth.middleware.js';
import logger from "../../infrastructure/logger/logger.js";
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router();

router.use(protect)
router.use(admin)

// Simple rolling request counter for requests-per-minute in system health.
// Updated by a middleware that runs on every admin route hit.
let _reqTimestamps = [];
const _cleanupReqTimestamps = () => {
  const cutoff = Date.now() - 60_000;
  _reqTimestamps = _reqTimestamps.filter(t => t > cutoff);
};
setInterval(_cleanupReqTimestamps, 30_000).unref?.();
Object.defineProperty(router, 'reqCountLastMinute', {
  get() { _cleanupReqTimestamps(); return _reqTimestamps.length; }
});
// Middleware: stamp every admin request for the rolling counter
router.use((req, res, next) => {
  _reqTimestamps.push(Date.now());
  next();
});
const reqCountLastMinute = () => { _cleanupReqTimestamps(); return _reqTimestamps.length; };

// Real-time active users and sessions
router.get("/realtime/active-users", asyncHandler(async (req, res) => {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // FIX PERF-2: Previously loaded every user + every attempt into JS and
  // filtered in memory. Now: one COUNT(*) for users, and one pass of
  // COUNT(DISTINCT) FILTER (..) aggregations for attempts — both O(log n) via indexes.
  const totalRegisteredResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM users WHERE is_active = true`,
  );
  const totalRegistered = totalRegisteredResult.rows[0]?.total || 0;

  // Active users within each window — single scan of last-24h attempts
  const activeResult = await pool.query(
    `SELECT
       COUNT(DISTINCT CASE WHEN COALESCE(updated_at, created_at) >= $1 THEN user_id END)::int AS active_5min,
       COUNT(DISTINCT CASE WHEN COALESCE(updated_at, created_at) >= $2 THEN user_id END)::int AS active_30min,
       COUNT(DISTINCT CASE WHEN COALESCE(updated_at, created_at) >= $3 THEN user_id END)::int AS active_hour
     FROM attempts
     WHERE COALESCE(updated_at, created_at) >= $4`,
    [fiveMinutesAgo, thirtyMinutesAgo, oneHourAgo, oneDayAgo],
  );
  const activeRow = activeResult.rows[0] || {};
  const activeLast5Min = activeRow.active_5min || 0;
  const activeLast30Min = activeRow.active_30min || 0;
  const activeLastHour = activeRow.active_hour || 0;

  // Users taking tests right now (started, not completed, within 30min)
  const activeTestsResult = await pool.query(
    `SELECT COUNT(*)::int AS active_tests
     FROM attempts
     WHERE is_completed = false
       AND COALESCE(started_at, created_at) >= $1`,
    [thirtyMinutesAgo],
  );
  const activeTestsNow = activeTestsResult.rows[0]?.active_tests || 0;

  // Hourly activity histogram for the last 24 hours — one GROUP BY instead of 24 JS passes
  const hourlyResult = await pool.query(
    `SELECT
       EXTRACT(HOUR FROM created_at)::int AS hour,
       COUNT(DISTINCT user_id)::int       AS users,
       COUNT(*)::int                       AS tests
     FROM attempts
     WHERE created_at >= $1
     GROUP BY EXTRACT(HOUR FROM created_at)`,
    [oneDayAgo],
  );
  const hourMap = new Map();
  for (const row of hourlyResult.rows) {
    hourMap.set(row.hour, { users: row.users, tests: row.tests });
  }
  const hourlyData = [];
  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(now.getTime() - (i + 1) * 60 * 60 * 1000);
    const hour = hourStart.getHours();
    const bucket = hourMap.get(hour) || { users: 0, tests: 0 };
    hourlyData.push({
      hour,
      label: `${hour}:00`,
      users: bucket.users,
      tests: bucket.tests,
    });
  }

  res.json({
    success: true,
    data: {
      onlineNow: activeLast5Min,
      takingTests: activeTestsNow,
      totalRegistered,
      activeLast5Min,
      activeLast30Min,
      activeLastHour,
      hourlyActivity: hourlyData,
      timestamp: now.toISOString(),
    },
  });
}));

// Real-time test activity
router.get("/realtime/test-activity", asyncHandler(async (req, res) => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // FIX PERF-3: Previously loaded every attempt + every test into JS and
  // filtered in memory. Now: one SQL COUNT(*) for active tests, one JOIN for
  // popular active tests, and one AVG + completion-rate aggregation.
  const activeTestsResult = await pool.query(
    `SELECT COUNT(*)::int AS active_tests
     FROM attempts
     WHERE is_completed = false
       AND COALESCE(started_at, created_at) >= $1`,
    [oneDayAgo],
  );
  const activeTestsNow = activeTestsResult.rows[0]?.active_tests || 0;

  // Most popular tests being taken right now — JOIN replaces in-memory lookup
  const popularResult = await pool.query(
    `SELECT
        a.test_id,
        t.title AS test_name,
        COUNT(*)::int AS active_users
     FROM attempts a
     LEFT JOIN tests t ON a.test_id = t.id
     WHERE a.is_completed = false
       AND COALESCE(a.started_at, a.created_at) >= $1
     GROUP BY a.test_id, t.title
     ORDER BY active_users DESC
     LIMIT 10`,
    [oneDayAgo],
  );
  const popularActiveTests = popularResult.rows.map((r) => ({
    testId: r.test_id,
    testName: r.test_name || "Unknown Test",
    activeUsers: r.active_users,
  }));

  // Completed in last hour + completion rate + avg score — single pass
  const hourAggResult = await pool.query(
    `SELECT
       COUNT(*)::int                                       AS hour_attempts,
       COUNT(*) FILTER (WHERE is_completed = true)::int     AS hour_completed,
       AVG(score) FILTER (WHERE is_completed = true)::float AS avg_score
     FROM attempts
     WHERE COALESCE(submitted_at, updated_at, created_at) >= $1`,
    [oneHourAgo],
  );
  const hourAgg = hourAggResult.rows[0] || {};
  const hourAttempts = hourAgg.hour_attempts || 0;
  const hourCompleted = hourAgg.hour_completed || 0;
  const completionRate =
    hourAttempts > 0 ? Math.round((hourCompleted / hourAttempts) * 100) : 0;
  const avgScoreLastHour = hourAgg.avg_score
    ? Math.round(parseFloat(hourAgg.avg_score))
    : 0;

  res.json({
    success: true,
    data: {
      activeTestsNow,
      completedLastHour: hourCompleted,
      completionRateLastHour: completionRate,
      avgScoreLastHour,
      popularActiveTests,
      timestamp: now.toISOString(),
    },
  });
}));

// Real-time revenue and enrollments
router.get("/realtime/revenue", asyncHandler(async (req, res) => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // FIX PERF-4: Previously loaded every user + every test_series into JS and
  // counted/filtered in memory. Now: one COUNT(*) FILTER (..) aggregation query
  // for all pro / enrollment counts, plus one unnest+JOIN for top enrolled series.
  const userAggResult = await pool.query(
    `SELECT
       COUNT(*)::int                                                       AS total_users,
       COUNT(*) FILTER (WHERE is_pro_user = true)::int                     AS pro_users,
       COUNT(*) FILTER (WHERE is_pro_user = true AND is_active <> false)::int AS active_pro_users,
       COUNT(*) FILTER (WHERE is_pro_user = true
                          AND COALESCE(updated_at, created_at) >= $1)::int   AS new_pro_last_hour,
       COUNT(*) FILTER (WHERE is_pro_user = true
                          AND COALESCE(updated_at, created_at) >= $2)::int   AS new_pro_today,
       COUNT(*) FILTER (WHERE array_length(enrolled_series, 1) > 0
                          AND COALESCE(updated_at, created_at) >= $1)::int   AS enrollments_last_hour,
       COUNT(*) FILTER (WHERE array_length(enrolled_series, 1) > 0
                          AND COALESCE(updated_at, created_at) >= $2)::int   AS enrollments_today,
       COUNT(*) FILTER (WHERE array_length(enrolled_series, 1) > 0
                          AND COALESCE(updated_at, created_at) >= $3)::int   AS enrollments_this_week
     FROM users`,
    [oneHourAgo, oneDayAgo, oneWeekAgo],
  );
  const agg = userAggResult.rows[0] || {};
  const proUsersCount = agg.pro_users || 0;
  const activeProUsersCount = agg.active_pro_users || 0;
  const newProLastHour = agg.new_pro_last_hour || 0;
  const newProToday = agg.new_pro_today || 0;
  const enrollmentsLastHour = agg.enrollments_last_hour || 0;
  const enrollmentsToday = agg.enrollments_today || 0;
  const enrollmentsThisWeek = agg.enrollments_this_week || 0;

  // Calculate revenue using actual Pro Pass price from DB
  const proPassPrice = await getProPassPrice();
  const totalRevenue = proUsersCount * proPassPrice;

  // Top enrolled series — unnest the array column and JOIN to test_series.
  // NULLIF guards against empty arrays producing NULL series_id rows.
  const topSeriesResult = await pool.query(
    `WITH exploded AS (
       SELECT UNNEST(enrolled_series) AS series_id
         FROM users
        WHERE array_length(enrolled_series, 1) > 0
     )
     SELECT
        e.series_id,
        COALESCE(ts.title, 'Unknown') AS series_name,
        COUNT(*)::int AS enrollments
      FROM exploded e
      LEFT JOIN test_series ts ON ts.id = e.series_id
      WHERE e.series_id IS NOT NULL
      GROUP BY e.series_id, ts.title
     ORDER BY enrollments DESC
     LIMIT 5`,
  );
  const topEnrolledSeries = topSeriesResult.rows.map((r) => ({
    seriesId: r.series_id,
    seriesName: r.series_name || "Unknown",
    enrollments: r.enrollments,
  }));

  res.json({
    success: true,
    data: {
      totalRevenue,
      revenueLastHour: newProLastHour * proPassPrice,
      revenueToday: newProToday * proPassPrice,
      totalProUsers: proUsersCount,
      activeProUsers: activeProUsersCount,
      newProLastHour,
      newProToday,
      enrollmentsLastHour,
      enrollmentsToday,
      enrollmentsThisWeek,
      topEnrolledSeries,
      proPassPrice,
      timestamp: now.toISOString(),
    },
  });
}));

// Real-time system health with detailed metrics
router.get("/realtime/system-health", async (req, res) => {
  try {
    const now = new Date();
    const startTime = process.hrtime();

    // Database health check
    let dbLatency = 0;
    let dbStatus = "connected";
    try {
      const dbStart = process.hrtime();
      await dbHelpers.pool.query("SELECT 1");
      const dbEnd = process.hrtime(dbStart);
      dbLatency = Math.round(dbEnd[0] * 1000 + dbEnd[1] / 1000000);
    } catch {
      dbStatus = "disconnected";
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    const totalMemMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const usedMemMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memPercent = Math.round(
      (memUsage.heapUsed / memUsage.heapTotal) * 100,
    );

    // CPU usage (simplified)
    // Uptime
    const uptimeSeconds = process.uptime();
    const uptimeDays = Math.floor(uptimeSeconds / 86400);
    const uptimeHours = Math.floor((uptimeSeconds % 86400) / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);

    // Response time
    const end = process.hrtime(startTime);
    const responseTime = Math.round(end[0] * 1000 + end[1] / 1000000);

    // Count active connections — use SQL COUNT instead of loading all rows
    const recentCountResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM attempts
       WHERE COALESCE(updated_at, created_at) >= NOW() - INTERVAL '5 minutes'`
    );
    const recentAttemptCount = recentCountResult.rows[0]?.count || 0;

    res.json({
      success: true,
      data: {
        status: dbStatus === "connected" ? "healthy" : "degraded",
        database: {
          status: dbStatus,
          latency: `${dbLatency}ms`,
        },
        server: {
          uptime: `${uptimeDays}d ${uptimeHours}h ${uptimeMinutes}m`,
          uptimeSeconds: Math.round(uptimeSeconds),
          nodeVersion: process.version,
          platform: process.platform,
          pid: process.pid,
        },
        memory: {
          total: `${totalMemMB}MB`,
          used: `${usedMemMB}MB`,
          percent: memPercent,
          rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        },
        performance: {
          responseTime: `${responseTime}ms`,
          activeConnections: recentAttemptCount,
        },
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// Real-time live feed (combined activity stream)
router.get("/realtime/live-feed", async (req, res) => {
  try {
    const now = new Date();
    const feed = [];

    // Recent test completions (JOIN instead of three full-table scans)
    const completionsResult = await pool.query(
      `SELECT a.score, COALESCE(a.submitted_at, a.updated_at) AS completed_at,
              u.name AS user_name, t.title AS test_title
       FROM attempts a
       JOIN users u ON u.id = a.user_id
       JOIN tests t ON t.id = a.test_id
       WHERE a.is_completed = true
         AND COALESCE(a.submitted_at, a.updated_at) >= NOW() - INTERVAL '15 minutes'
       ORDER BY COALESCE(a.submitted_at, a.updated_at) DESC
       LIMIT 5`
    );

    for (const row of completionsResult.rows) {
      const timeDiff = Math.round((now - new Date(row.completed_at)) / 60000);
      feed.push({
        type: "test_completed",
        icon: "CheckCircle",
        color: "green",
        title: "Test Completed",
        description: `${row.user_name || "User"} completed ${row.test_title || "a test"}`,
        score: row.score,
        timeAgo: `${timeDiff}m ago`,
        timestamp: row.completed_at,
      });
    }

    // Recent registrations
    const recentUsersResult = await pool.query(
      `SELECT name, email, created_at FROM users
       WHERE created_at >= NOW() - INTERVAL '15 minutes'
       ORDER BY created_at DESC
       LIMIT 3`
    );

    for (const u of recentUsersResult.rows) {
      const timeDiff = Math.round((now - new Date(u.created_at)) / 60000);
      feed.push({
        type: "user_registered",
        icon: "UserPlus",
        color: "blue",
        title: "New User",
        description: `${u.name || u.email} joined`,
        timeAgo: `${timeDiff}m ago`,
        timestamp: u.created_at,
      });
    }

    // Recent pro upgrades
    const recentProResult = await pool.query(
      `SELECT name, COALESCE(updated_at, created_at) AS upgraded_at FROM users
       WHERE is_pro_user = true
         AND COALESCE(updated_at, created_at) >= NOW() - INTERVAL '15 minutes'
       ORDER BY COALESCE(updated_at, created_at) DESC
       LIMIT 3`
    );

    for (const u of recentProResult.rows) {
      const timeDiff = Math.round((now - new Date(u.upgraded_at)) / 60000);
      feed.push({
        type: "pro_upgrade",
        icon: "Crown",
        color: "yellow",
        title: "Pro Upgrade",
        description: `${u.name || "User"} upgraded to Pro`,
        timeAgo: `${timeDiff}m ago`,
        timestamp: u.upgraded_at,
      });
    }

    // Sort by timestamp
    feed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      success: true,
      data: {
        feed: feed.slice(0, 15),
        totalEvents: feed.length,
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// ===== SYSTEM HEALTH =====
const getSystemHealth = async (req, res) => {
  try {
    const dbStart = Date.now();
    const dbStatus = await dbHelpers.pool.query("SELECT 1");
    const dbLatency = Date.now() - dbStart;

    const mem = process.memoryUsage();
    const memoryUsagePercent = mem.rss > 0 ? Math.min(100, Math.round((mem.heapUsed / mem.heapTotal) * 100)) : 0;

    // CPU usage (approximate — load average on Linux, 0 on Windows)
    let cpuUsage = 0;
    try {
      if (typeof require === 'function') {
        const os = require('os');
        const cpus = os.cpus();
        if (cpus && cpus.length > 0) {
          // Calculate idle vs total across all cores
          let totalIdle = 0, totalTick = 0;
          for (const cpu of cpus) {
            for (const type in cpu.times) totalTick += cpu.times[type];
            totalIdle += cpu.times.idle;
          }
          cpuUsage = totalTick > 0 ? Math.round((1 - totalIdle / totalTick) * 100) : 0;
        }
      }
    } catch (_) { /* non-fatal — CPU % just shows 0 if unavailable */ }

    // Disk usage (best-effort — uses fs.statSync on the root partition)
    let diskUsage = 0;
    let disk = { total: 0, used: 0, free: 0 };
    try {
      if (typeof require === 'function') {
        const fs = require('fs');
        const os = require('os');
        const homedir = os.homedir ? os.homedir() : process.cwd();
        // fs.statfs is available in Node 18.15+ (Linux/macOS only)
        if (fs.statfsSync) {
          const stats = fs.statfsSync(homedir);
          const total = stats.blocks * stats.bsize;
          const free = stats.bavail * stats.bsize;
          disk = { total, used: total - free, free };
          diskUsage = total > 0 ? Math.round(((total - free) / total) * 100) : 0;
        }
      }
    } catch (_) { /* non-fatal */ }

    const health = {
      status: "healthy",
      database: dbStatus.rows.length > 0 ? "connected" : "disconnected",
      databaseResponseTime: dbLatency,
      uptime: process.uptime(),
      memory: mem,
      memoryUsagePercent,
      cpu: { usage: cpuUsage },
      disk: { usage: diskUsage, ...disk },
      requestsPerMin: reqCountLastMinute(),
      timestamp: new Date().toISOString(),
    };

    res.json({ success: true, data: health });
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
};

router.get("/system-health", getSystemHealth);
router.get("/health", getSystemHealth);

export default router;
