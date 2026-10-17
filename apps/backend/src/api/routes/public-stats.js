import express from "express";
import {
  pool,
  dbHelpers,
} from "../../infrastructure/database/postgres-helpers.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import { validateStats } from "../../shared/utils/stats-validation.js";

const router = express.Router();

// @route   GET /api/public-stats
router.get("/", responseCache("public-stats", 600), async (req, res) => {
  try {
    const [countsRes, settingsList] = await Promise.all([
      pool.query(
        `SELECT
           (SELECT COUNT(*)::int FROM users) AS users,
           (SELECT COUNT(*)::int FROM test_series) AS test_series,
           (SELECT COUNT(*)::int FROM tests) AS tests,
           (SELECT COUNT(*)::int FROM questions) AS questions,
           (SELECT COUNT(*)::int FROM exam_categories) AS exam_categories,
           (SELECT COALESCE(SUM(total_attempts), 0)::bigint FROM test_series WHERE is_active = true AND is_deleted = false) AS total_attempts,
           (SELECT COALESCE(SUM(total_tests), 0)::bigint FROM test_series WHERE is_active = true AND is_deleted = false) AS series_tests`,
      ),
      dbHelpers.find("appSettings"),
    ]);

    const counts = countsRes.rows[0] || {};
    const userCount = Number(counts.users) || 0;
    const testSeriesCount = Number(counts.test_series) || 0;
    const testCount = Number(counts.tests) || 0;
    const questionCount = Number(counts.questions) || 0;
    const examCatCount = Number(counts.exam_categories) || 0;

    const totalAttempts = Number(counts.total_attempts) || 0;
    const seriesTests = Number(counts.series_tests) || 0;

    const activeLearners = userCount + totalAttempts;
    const successStories = Math.floor(activeLearners / 50);

    const appSettings = settingsList[0] || {};
    const statsOverride = appSettings.stats || {};
    const totalAvailableTests = testCount || seriesTests || 0;
    const finalActiveLearners =
      Number(statsOverride.activeLearners) || activeLearners || 0;
    const finalMockTests =
      Number(statsOverride.mockTests) || totalAvailableTests;
    const finalPracticeQuestions =
      Number(statsOverride.practiceQuestions) || questionCount || 0;
    const finalSuccessStories =
      Number(statsOverride.successStories) || successStories;
    const finalExamsCovered =
      Number(statsOverride.examsCovered) || examCatCount || 0;
    const finalSatisfaction =
      statsOverride.satisfaction !== undefined
        ? Number(statsOverride.satisfaction)
        : null;

    // Import validation utility (statically imported at top)

    const validatedStats = validateStats({
      users: userCount,
      testSeries: testSeriesCount,
      tests: testCount,
      questions: questionCount,
      examCategories: examCatCount,
      activeLearners: finalActiveLearners || 0,
      mockTests: finalMockTests || 0,
      practiceQuestions: finalPracticeQuestions || 0,
      successStories: finalSuccessStories || 0,
      examsCovered: finalExamsCovered || 0,
      satisfaction: finalSatisfaction,
    });

    res.json({
      success: true,
      data: {
        ...validatedStats,
        users: userCount,
        testSeries: testSeriesCount,
        tests: testCount,
        questions: questionCount,
        examCategories: examCatCount,
      },
    });
  } catch (error) {
    console.error("Get public stats error:", error);
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
