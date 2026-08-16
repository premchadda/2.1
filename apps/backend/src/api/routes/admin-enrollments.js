import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { protect, admin, superAdmin } from '../../middleware/auth.middleware.js';
import logger from "../../infrastructure/logger/logger.js";
import { sanitizeUser } from "../../shared/utils/user-utils.js";

const router = express.Router();

router.use(protect)
router.use(admin)

// Centralized sanitization helper to avoid PII leakage (SEC-12)

// List users with pagination
// List enrollments — one row per user with aggregated enrollment details
// CRIT-06 FIX: Sanitize user data to prevent PII leakage (SEC-12)
router.get("/enrollments", async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const isExport = req.query.export === "true";
    // export=true → single 5000-row page, no pagination slicing
    let limitNum = isExport ? 5000 : parseInt(limit, 10) || 50;
    limitNum = Math.min(Math.max(limitNum, 1), 5000);
    const pageNum = isExport ? 1 : Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    // Get total count of distinct users with enrollments
    const countResult = await dbHelpers.pool.query(
      `SELECT COUNT(DISTINCT user_id) as count 
       FROM enrollments 
       WHERE is_active = true`
    );
    const total = parseInt(countResult.rows[0]?.count || 0, 10);

    // Get distinct users who have active enrollments, paginated
    const usersResult = await dbHelpers.pool.query(
      `SELECT DISTINCT u.id, u.name, u.email, u.is_active as "isActive", u.is_active, u.created_at as "createdAt", 
              u.pass_type as "passType", u.pass_type, u.pro_pass_expiry as "passExpiry", u.pro_pass_expiry, 
              u.is_pro_user as "isProUser", u.is_pro_user
       FROM users u
       JOIN enrollments e ON e.user_id = u.id
       WHERE e.is_active = true
       ORDER BY u.id DESC
       LIMIT $1 OFFSET $2`,
      [limitNum, offset]
    );
    
    const paginatedUsers = usersResult.rows;

    if (paginatedUsers.length === 0) {
      return res.json({
        success: true,
        data: [],
        total,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    }

    const userIds = paginatedUsers.map((u) => u.id);

    // Fetch details for only the paginated users' enrollments, plus other catalog definitions
    const [
      enrollmentsResult,
      allSeries,
      allStudyMaterials,
      allExams,
      allPlans,
    ] = await Promise.all([
      dbHelpers.pool.query(
        `SELECT id, user_id, series_id, enrolled_at, expires_at, status, progress, exam_id, study_material_id, is_paid, payment_id, amount, is_active, updated_at, created_at, is_deleted, deleted_at, deleted_by FROM enrollments 
         WHERE is_active = true AND user_id = ANY($1)`,
        [userIds]
      ),
      dbHelpers.find("testSeries"),
      dbHelpers.find("studyMaterials"),
      dbHelpers.find("exams"),
      dbHelpers.find("subscriptionPlans"),
    ]);

    const allEnrollments = enrollmentsResult.rows;

    const seriesMap = {};
    for (const s of allSeries) seriesMap[s.id || s._id] = s;

    const materialMap = {};
    for (const m of allStudyMaterials) materialMap[m.id || m._id] = m;

    const examMap = {};
    for (const e of allExams) examMap[e.id || e._id] = e;

    const planMap = {};
    for (const p of allPlans) planMap[p.plan_id || p.planId] = p;

    const records = [];

    for (const user of paginatedUsers) {
      const safeUser = sanitizeUser(user);
      const userId = safeUser.id;

      // Collect all enrollments for this user
      const userEnrollments = allEnrollments.filter(
        (e) => String(e.userId || e.user_id) === String(userId),
      );

      const enrolledSeries = [];
      const enrolledMaterials = [];
      const enrolledExams = [];

      for (const enrollment of userEnrollments) {
        if (enrollment.seriesId || enrollment.series_id) {
          const sid = enrollment.seriesId || enrollment.series_id;
          const series = seriesMap[sid];
          if (series) {
            enrolledSeries.push({
              id: sid,
              name: series.title || series.name || `Series #${sid}`,
              status: enrollment.status || "active",
              progress: enrollment.progress || 0,
              enrolledAt:
                enrollment.enrolledAt || enrollment.enrolled_at || null,
            });
          }
        }

        if (enrollment.studyMaterialId || enrollment.study_material_id) {
          const mid =
            enrollment.studyMaterialId || enrollment.study_material_id;
          const material = materialMap[mid];
          if (material) {
            enrolledMaterials.push({
              id: mid,
              name: material.title || material.name || `Material #${mid}`,
              status: enrollment.status || "active",
              progress: enrollment.progress || 0,
              enrolledAt:
                enrollment.enrolledAt || enrollment.enrolled_at || null,
            });
          }
        }

        if (enrollment.examId || enrollment.exam_id) {
          const eid = enrollment.examId || enrollment.exam_id;
          const exam = examMap[eid];
          if (exam) {
            enrolledExams.push({
              id: eid,
              name: exam.title || exam.name || `Exam #${eid}`,
              status: enrollment.status || "active",
              enrolledAt:
                enrollment.enrolledAt || enrollment.enrolled_at || null,
            });
          }
        }
      }

      // Skip users with no enrollments on this slice (highly unlikely due to query structure, but safe to keep)
      if (
        enrolledSeries.length === 0 &&
        enrolledMaterials.length === 0 &&
        enrolledExams.length === 0
      )
        continue;

      // Determine pass type label from users.pass_type field
      const rawPassType = safeUser.passType || safeUser.pass_type || "free";
      const plan = planMap[rawPassType];
      const passLabel = safeUser.isProUser || safeUser.is_pro_user
        ? plan
          ? `${plan.name} (${plan.period})`
          : "Pro Pass"
        : "Free";
      const passBadge = safeUser.isProUser || safeUser.is_pro_user
        ? plan?.period === "yearly"
          ? "Pro Yearly"
          : plan?.period === "monthly"
            ? "Pro Monthly"
            : "Pro Pass"
        : "Free";

      // Find earliest enrollment date
      const allDates = [
        ...enrolledSeries.map((e) => e.enrolledAt),
        ...enrolledMaterials.map((e) => e.enrolledAt),
        ...enrolledExams.map((e) => e.enrolledAt),
      ].filter(Boolean);
      const enrolledAt =
        allDates.length > 0
          ? allDates.sort((a, b) => new Date(a) - new Date(b))[0]
          : safeUser.createdAt || null;

      records.push({
        userId: safeUser.id,
        userName: safeUser.name || "Unknown",
        userEmail: safeUser.email || "",
        isActive: safeUser.isActive !== false,
        isProUser: !!(safeUser.isProUser || safeUser.is_pro_user),
        proPassExpiry:
          safeUser.proPassExpiry ||
          safeUser.proExpiry ||
          safeUser.pro_expiry ||
          null,
        passType: passLabel,
        passBadge,
        passPeriod: plan?.period || null,
        planId: rawPassType,
        series: enrolledSeries,
        seriesCount: enrolledSeries.length,
        studyMaterials: enrolledMaterials,
        studyMaterialCount: enrolledMaterials.length,
        exams: enrolledExams,
        examCount: enrolledExams.length,
        totalEnrollments:
          enrolledSeries.length +
          enrolledMaterials.length +
          enrolledExams.length,
        enrolledAt,
      });
    }

    records.sort(
      (a, b) => new Date(b.enrolledAt || 0) - new Date(a.enrolledAt || 0),
    );

    res.json({
      success: true,
      data: records,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    logger.error('Failed to fetch enrollments list with pagination', err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// List results - FIX B10: Use SQL pagination instead of loading ALL attempts into memory
router.get("/results", async (req, res) => {
  try {
    const { limit = 100, page = 1 } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 100, 500); // Cap at 500
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (pageNum - 1) * limitNum;

    // Get total count first
    const countResult = await dbHelpers.pool.query(
      "SELECT COUNT(*) FROM attempts",
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get paginated results with user names via SQL JOIN
    const resultsResult = await dbHelpers.pool.query(
      `SELECT 
         a.id, a.user_id, a.test_id,
         a.score, a.time_spent,
         a.submitted_at, a.created_at,
         t.title as test_title, t.total_marks as test_total_marks,
         u.name as user_name, u.email as user_email
       FROM attempts a
       LEFT JOIN tests t ON a.test_id = t.id
       LEFT JOIN users u ON a.user_id = u.id
       ORDER BY COALESCE(a.submitted_at, a.created_at) DESC
       LIMIT $1 OFFSET $2`,
      [limitNum, offset],
    );

    const data = resultsResult.rows.map((a) => {
      const score = parseFloat(a.score) || 0;
      const totalMarks = parseFloat(a.test_total_marks) || 100;
      return {
        _id: a.id,
        id: a.id,
        userName:
          a.user_name || a.user_email || "User " + a.user_id,
        testName: a.test_title || "Mock Test",
        score,
        totalMarks,
        percentage: totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0,
        rank: a.rank || 0,
        timeTaken:
          Math.round((parseFloat(a.time_spent) || 0) / 60) || 1,
        attemptedAt:
          a.submitted_at || a.created_at,
      };
    });

    res.json({
      success: true,
      data,
      total,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Failed to fetch results', error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

export default router;
