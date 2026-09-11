import express from "express";
import {
  pool,
  dbHelpers,
} from "../../infrastructure/database/postgres-helpers.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

const router = express.Router();

// @route   GET /api/public-stats
router.get("/", responseCache("public-stats", 120), async (req, res) => {
  try {
    const [
      userCount,
      testSeriesCount,
      testCount,
      questionCount,
      examCatCount,
      attemptRes,
      settingsList,
    ] = await Promise.all([
      dbHelpers.count("users"),
      dbHelpers.count("testSeries"),
      dbHelpers.count("tests"),
      dbHelpers.count("questions"),
      dbHelpers.count("examCategories"),
      pool.query(
        "SELECT COALESCE(SUM(total_attempts), 0) as count, COALESCE(SUM(total_tests), 0) as series_tests FROM test_series WHERE is_active = true AND is_deleted = false",
      ),
      dbHelpers.find("appSettings"),
    ]);

    const totalAttempts = parseInt(attemptRes.rows[0]?.count) || 0;
    const seriesTests = parseInt(attemptRes.rows[0]?.series_tests) || 0;

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

    // Import validation utility
    const { validateStats } =
      await import("../../shared/utils/stats-validation.js");

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
