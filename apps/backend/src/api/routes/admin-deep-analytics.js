import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { protect, admin } from "../../middleware/auth.middleware.js";
import logger from "../../infrastructure/logger/logger.js";
import { isFeatureEnabled } from "../../services/SettingsService.js";

const router = express.Router();

router.use(protect);
router.use(admin);

const requireAnalyticsEnabled = async (req, res, next) => {
  try {
    if (!(await isFeatureEnabled("analytics"))) {
      return res.status(503).json({
        success: false,
        code: "ANALYTICS_DISABLED",
        message: "Analytics is disabled by admin settings",
      });
    }
  } catch {
    // intentionally empty - fail open if feature flag check errors
  }
  next();
};
router.use(requireAnalyticsEnabled);

// ============================================
// DEEP ANALYTICS - Cohort, Funnel, Engagement
// ============================================

// User Engagement Funnel
router.get("/funnel", async (req, res) => {
  try {
    const funnel = await dbHelpers.pool.query(`
      SELECT 
        'registered' as stage, COUNT(*) as users FROM users WHERE is_active = true
      UNION ALL
      SELECT 
        'enrolled' as stage, COUNT(DISTINCT user_id) as users FROM enrollments
      UNION ALL
      SELECT 
        'attempted_test' as stage, COUNT(DISTINCT user_id) as users FROM attempts
      UNION ALL
      SELECT 
        'completed_test' as stage, COUNT(DISTINCT user_id) as users FROM attempts WHERE status = 'completed' OR is_completed = true
      UNION ALL
      SELECT 
        'pro_subscriber' as stage, COUNT(*) as users FROM users u
        JOIN enrollments e ON u.id = e.user_id 
        WHERE e.status = 'active' AND u.is_active = true
    `);

    const funnelData = funnel.rows.reduce((acc, row) => {
      acc[row.stage] = parseInt(row.users);
      return acc;
    }, {});

    // Calculate conversion rates
    const total = funnelData.registered || 1;
    const conversionRates = {
      registered_to_enrolled: (
        ((funnelData.enrolled || 0) / total) *
        100
      ).toFixed(1),
      enrolled_to_attempted: (
        ((funnelData.attempted_test || 0) / Math.max(funnelData.enrolled, 1)) *
        100
      ).toFixed(1),
      attempted_to_completed: (
        ((funnelData.completed_test || 0) /
          Math.max(funnelData.attempted_test, 1)) *
        100
      ).toFixed(1),
      registered_to_pro: (
        ((funnelData.pro_subscriber || 0) / total) *
        100
      ).toFixed(1),
    };

    res.json({
      success: true,
      data: {
        funnel: funnelData,
        conversionRates,
        totalUsers: funnelData.registered || 0,
      },
    });
  } catch (error) {
    logger.error("Funnel analytics error:", error);
    res.json({
      success: true,
      data: { funnel: {}, conversionRates: {}, totalUsers: 0 },
    });
  }
});

// Cohort Analysis - User retention by registration month
router.get("/cohort", async (req, res) => {
  try {
    const cohortData = await dbHelpers.pool.query(`
      WITH user_cohorts AS (
        SELECT 
          u.id as user_id,
          TO_CHAR(u.created_at, 'YYYY-MM') as cohort_month,
          COALESCE(a.started_at, a.created_at) as activity_time,
          TO_CHAR(COALESCE(a.started_at, a.created_at), 'YYYY-MM') as activity_month
        FROM users u
        LEFT JOIN attempts a ON u.id = a.user_id
        WHERE u.is_active = true
      ),
      cohort_sizes AS (
        SELECT cohort_month, COUNT(DISTINCT user_id) as size
        FROM user_cohorts
        GROUP BY cohort_month
      )
      SELECT 
        uc.cohort_month,
        cs.size as cohort_size,
        uc.activity_month,
        COUNT(DISTINCT uc.user_id) as active_users,
        EXTRACT(MONTH FROM AGE(TO_DATE(uc.activity_month, 'YYYY-MM'), TO_DATE(uc.cohort_month, 'YYYY-MM'))) as month_number
      FROM user_cohorts uc
      JOIN cohort_sizes cs ON uc.cohort_month = cs.cohort_month
      WHERE uc.activity_month IS NOT NULL
      GROUP BY uc.cohort_month, cs.size, uc.activity_month
      ORDER BY uc.cohort_month, month_number
    `);

    // Format cohort data
    const cohorts = {};
    cohortData.rows.forEach((row) => {
      if (!cohorts[row.cohort_month]) {
        cohorts[row.cohort_month] = {
          cohortMonth: row.cohort_month,
          cohortSize: parseInt(row.cohort_size),
          retention: {},
        };
      }
      const monthNum = parseInt(row.month_number) || 0;
      cohorts[row.cohort_month].retention[`m${monthNum}`] = {
        activeUsers: parseInt(row.active_users),
        retentionRate: (
          (parseInt(row.active_users) / parseInt(row.cohort_size)) *
          100
        ).toFixed(1),
      };
    });

    res.json({
      success: true,
      data: {
        cohorts: Object.values(cohorts).slice(0, 12), // Last 12 cohorts
        totalCohorts: Object.keys(cohorts).length,
      },
    });
  } catch (error) {
    logger.error("Cohort analytics error:", error);
    res.json({ success: true, data: { cohorts: [], totalCohorts: 0 } });
  }
});

// User Engagement Score
router.get("/engagement", async (req, res) => {
  try {
    const engagement = await dbHelpers.pool.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        CASE WHEN EXISTS (SELECT 1 FROM enrollments e WHERE e.user_id = u.id AND e.status = 'active') THEN 'pro' ELSE 'free' END as subscription_status,
        COUNT(DISTINCT a.id) as tests_attempted,
        COUNT(DISTINCT CASE WHEN a.is_completed = true THEN a.id END) as tests_completed,
        AVG(a.score) as avg_score,
        GREATEST(MAX(a.submitted_at), MAX(a.created_at)) as last_activity,
        COUNT(DISTINCT b.id) as bookmarks,
        COUNT(DISTINCT e.id) as enrollments
      FROM users u
      LEFT JOIN attempts a ON u.id = a.user_id
      LEFT JOIN bookmarks b ON u.id = b.user_id
      LEFT JOIN enrollments e ON u.id = e.user_id
      WHERE u.is_active = true
      GROUP BY u.id
      ORDER BY tests_completed DESC
      LIMIT 100
    `);

    // Calculate engagement scores
    const users = engagement.rows.map((user) => {
      const testsCompleted = parseInt(user.tests_completed) || 0;
      const avgScore = parseFloat(user.avg_score) || 0;
      const bookmarks = parseInt(user.bookmarks) || 0;
      const enrollments = parseInt(user.enrollments) || 0;

      // Engagement score formula
      const score =
        testsCompleted * 10 + avgScore * 0.5 + bookmarks * 2 + enrollments * 5;

      let engagementLevel = "low";
      if (score > 100) engagementLevel = "highly_engaged";
      else if (score > 50) engagementLevel = "engaged";
      else if (score > 20) engagementLevel = "moderately_engaged";
      else if (score > 5) engagementLevel = "slightly_engaged";

      return {
        ...user,
        engagementScore: Math.round(score),
        engagementLevel,
        testsCompleted,
        avgScore: avgScore.toFixed(1),
      };
    });

    // Summary stats
    const summary = {
      total: users.length,
      highlyEngaged: users.filter((u) => u.engagementLevel === "highly_engaged")
        .length,
      engaged: users.filter((u) => u.engagementLevel === "engaged").length,
      moderatelyEngaged: users.filter(
        (u) => u.engagementLevel === "moderately_engaged",
      ).length,
      slightlyEngaged: users.filter(
        (u) => u.engagementLevel === "slightly_engaged",
      ).length,
      low: users.filter((u) => u.engagementLevel === "low").length,
    };

    res.json({
      success: true,
      data: {
        users: users.slice(0, 50),
        summary,
      },
    });
  } catch (error) {
    logger.error("Engagement analytics error:", error);
    res.json({ success: true, data: { users: [], summary: {} } });
  }
});

/**
 * Diagnostics & Deep System Analytics
 * Calculates difficulty balance, test reliability/dropout metrics, and Practice↔Mock score correlation.
 */
const handleGetDiagnostics = async (req, res) => {
  try {
    // 1. Difficulty balance from questions table
    const diffResult = await dbHelpers.pool.query(`
      SELECT 
        LOWER(COALESCE(difficulty, 'medium')) as diff_level,
        COUNT(*)::int as count
      FROM questions
      WHERE is_active = true
      GROUP BY LOWER(COALESCE(difficulty, 'medium'))
    `);

    let easyCount = 0;
    let medCount = 0;
    let hardCount = 0;
    diffResult.rows.forEach((r) => {
      const level = String(r.diff_level).toLowerCase();
      if (level === "easy") easyCount += r.count;
      else if (level === "hard") hardCount += r.count;
      else medCount += r.count;
    });

    const totalQuestions = easyCount + medCount + hardCount;
    const difficulty = {
      easy:
        totalQuestions > 0
          ? Math.round((easyCount / totalQuestions) * 1000) / 10
          : 33.3,
      medium:
        totalQuestions > 0
          ? Math.round((medCount / totalQuestions) * 1000) / 10
          : 33.4,
      hard:
        totalQuestions > 0
          ? Math.round((hardCount / totalQuestions) * 1000) / 10
          : 33.3,
    };

    // 2. Reliability from recent attempts (last 100 sessions)
    const attemptsResult = await dbHelpers.pool.query(`
      SELECT 
        id,
        status,
        is_completed,
        COALESCE(time_spent, 0)::int as time_spent,
        COALESCE(score, 0)::numeric as score
      FROM attempts
      ORDER BY created_at DESC
      LIMIT 100
    `);

    const recentSessions = attemptsResult.rows;
    const totalRecentSessions = recentSessions.length;
    const completedSessions = recentSessions.filter(
      (a) => a.status === "completed" || a.is_completed === true,
    );
    const anomalousDropouts = recentSessions.filter(
      (a) =>
        a.status !== "completed" &&
        !a.is_completed &&
        (a.time_spent < 60 || Number(a.score) === 0),
    ).length;

    const completionRate =
      totalRecentSessions > 0
        ? Math.round((completedSessions.length / totalRecentSessions) * 1000) /
          10
        : 100;

    const reliability = {
      completionRate,
      anomalousDropouts,
      totalRecentSessions,
    };

    // 3. Practice bridge: comparing attempts scores of users with vs without practice_sessions
    const bridgeResult = await dbHelpers.pool.query(`
      WITH user_practice AS (
        SELECT DISTINCT user_id FROM practice_sessions
      ),
      user_attempt_scores AS (
        SELECT 
          a.user_id,
          AVG(COALESCE(a.score, 0)) as avg_score,
          CASE WHEN up.user_id IS NOT NULL THEN true ELSE false END as has_practice
        FROM attempts a
        LEFT JOIN user_practice up ON a.user_id = up.user_id
        WHERE a.status = 'completed' OR a.is_completed = true
        GROUP BY a.user_id, (up.user_id IS NOT NULL)
      )
      SELECT 
        has_practice,
        AVG(avg_score)::numeric(5,2) as group_avg
      FROM user_attempt_scores
      GROUP BY has_practice
    `);

    let practiceActiveAvgScore = null;
    let mockOnlyAvgScore = null;

    bridgeResult.rows.forEach((r) => {
      if (r.has_practice) {
        practiceActiveAvgScore = parseFloat(r.group_avg);
      } else {
        mockOnlyAvgScore = parseFloat(r.group_avg);
      }
    });

    // Derive score defaults from real attempt data if one cohort is empty
    let overallAvg = 0;
    if (practiceActiveAvgScore === null || mockOnlyAvgScore === null) {
      try {
        const overallRes = await dbHelpers.pool.query(
          `SELECT AVG(COALESCE(score, 0)) as overall_avg FROM attempts WHERE status = 'completed' OR is_completed = true`,
        );
        overallAvg = parseFloat(overallRes.rows[0]?.overall_avg || 0);
      } catch {
        overallAvg = 0;
      }
    }

    const finalPracticeScore =
      practiceActiveAvgScore ??
      (overallAvg > 0 ? Math.round(overallAvg * 10) / 10 : 0);
    const finalMockScore =
      mockOnlyAvgScore ??
      (overallAvg > 0 ? Math.round(overallAvg * 10) / 10 : 0);
    const delta = Math.round((finalPracticeScore - finalMockScore) * 10) / 10;

    const practiceBridge = {
      practiceActiveAvgScore: finalPracticeScore,
      mockOnlyAvgScore: finalMockScore,
      delta,
    };

    res.json({
      success: true,
      data: {
        difficulty,
        reliability,
        practiceBridge,
      },
    });
  } catch (error) {
    logger.error("GET /diagnostics error:", error);
    res.status(500).json({
      success: false,
      message: error?.message || "Failed to calculate deep diagnostics",
    });
  }
};

router.get("/diagnostics", handleGetDiagnostics);
router.get("/deep/diagnostics", handleGetDiagnostics);

export default router;
