import express from 'express';
import { pool, dbHelpers } from '../../infrastructure/database/postgres-helpers.js';

const router = express.Router();

// @route   GET /api/public-stats
router.get('/', async (req, res) => {
  try {
    const userCount = await dbHelpers.count('users');
    const testSeriesCount = await dbHelpers.count('testSeries');
    const testCount = await dbHelpers.count('tests');
    const questionCount = await dbHelpers.count('questions');
    const examCatCount = await dbHelpers.count('examCategories');

    // Get real total attempts from test_series
    const attemptRes = await pool.query(
      'SELECT SUM(total_attempts) as count FROM test_series',
    );
    const totalAttempts = parseInt(attemptRes.rows[0].count) || 0;

    const activeLearners = userCount + totalAttempts;
    const successStories = Math.floor(activeLearners / 50);

    // Fetch overrides from appSettings
    const settingsList = await dbHelpers.find('appSettings');
    const appSettings = settingsList[0] || {};
    const statsOverride = appSettings.stats || {};

    const finalActiveLearners = Number(statsOverride.activeLearners) || activeLearners;
    const finalMockTests = Number(statsOverride.mockTests) || testCount;
    const finalPracticeQuestions = Number(statsOverride.practiceQuestions) || questionCount;
    const finalSuccessStories = Number(statsOverride.successStories) || successStories;
    const finalExamsCovered = Number(statsOverride.examsCovered) || examCatCount;
    const finalSatisfaction = statsOverride.satisfaction !== undefined ? Number(statsOverride.satisfaction) : null;

    // Import validation utility
    const { validateStats } = await import('../../shared/utils/stats-validation.js');

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
    console.error('Get public stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
