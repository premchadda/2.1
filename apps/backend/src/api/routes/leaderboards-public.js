import express from 'express';
import { pool, dbHelpers } from '../../infrastructure/database/postgres-helpers.js';
import { optionalAuth } from '../../middleware/auth.middleware.js';

const router = express.Router();

// SEC-08: Public leaderboards endpoint - anonymize user data to prevent PII exposure
// @route   GET /api/leaderboards
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { testId, seriesId, examId, limit = 50 } = req.query;
    let query = { isActive: true };

    if (testId) query.testId = testId;
    if (seriesId) query.seriesId = seriesId;
    if (examId) query.examId = examId;

    const leaderboards = await dbHelpers.find('leaderboards', query);

    // If no leaderboards found, generate from results
    if (!leaderboards || leaderboards.length === 0) {
      const resultsQuery = { isCompleted: true };
      if (seriesId) resultsQuery.seriesId = seriesId;
      if (testId) resultsQuery.testId = testId;

      const results = await dbHelpers.find('results', resultsQuery);

      if (!results || results.length === 0) {
        return res.json({ success: true, data: [], count: 0, source: 'empty' });
      }

      const sortedResults = results
        .sort((a, b) => {
          const scoreA = parseFloat(a.score) || 0;
          const scoreB = parseFloat(b.score) || 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          const timeA = parseFloat(a.timeSpent ?? a.timeTaken) || Infinity;
          const timeB = parseFloat(b.timeSpent ?? b.timeTaken) || Infinity;
          return timeA - timeB;
        })
        .slice(0, limit);

      const totalParticipants = results.length;
      const rankings = await Promise.all(sortedResults.map(async (result, index) => {
        const participantsBelow = totalParticipants - (index + 1);
        const realPercentile =
          totalParticipants > 1
            ? ((participantsBelow / totalParticipants) * 100).toFixed(1)
            : '100.0';

        let isProUser = false;
        let displayName = `Student #${index + 1}`;
        try {
          const user = await dbHelpers.findById('users', result.userId);
          isProUser = user?.isProUser || user?.isPro || false;
          if (req.user && String(result.userId) === String(req.user.id)) {
            displayName = user?.name || displayName;
          }
        } catch (e) {
          // User lookup failed, default to false
        }

        return {
          rank: index + 1,
          name: displayName,
          score: parseFloat(result.score || 0).toFixed(2),
          percentile: realPercentile,
          testsCompleted: result.testsCompleted || result.tests_completed || 1,
          accuracy: result.accuracy ?? 0,
          isPro: isProUser,
        };
      }));

      return res.json({
        success: true,
        data: rankings,
        count: rankings.length,
        totalParticipants,
        source: 'calculated',
      });
    }

    // SEC-08: Anonymize leaderboard rankings for public access
    const currentUserId = req.user ? String(req.user.id) : null;
    const populatedLeaderboards = await Promise.all(
      leaderboards.map(async (lb) => {
        const rankings = lb.rankings || [];
        const anonymizedRankings = rankings
          .sort((a, b) => a.rank - b.rank)
          .slice(0, limit)
          .map((r) => {
            const isCurrentUser = currentUserId && String(r.userId) === currentUserId;
            return {
              rank: r.rank,
              name: isCurrentUser && r.name ? r.name : `Student #${r.rank}`,
              score: r.score,
              percentile: r.percentile,
              testsCompleted: r.testsCompleted,
              accuracy: r.accuracy,
              isPro: r.isPro,
            };
          });

        return { ...lb, rankings: anonymizedRankings };
      }),
    );

    res.json({ success: true, data: populatedLeaderboards, count: populatedLeaderboards.length });
  } catch (error) {
    console.error('Get leaderboards error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// @route   GET /api/leaderboards/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const leaderboard = await dbHelpers.findById('leaderboards', id);

    if (!leaderboard || !leaderboard.isActive) {
      return res.status(404).json({ success: false, message: 'Leaderboard not found' });
    }

    const rankings = leaderboard.rankings || [];
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedRankings = rankings
      .sort((a, b) => a.rank - b.rank)
      .slice(startIndex, endIndex);

    res.json({
      success: true,
      data: {
        ...leaderboard,
        rankings: paginatedRankings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: rankings.length,
          totalPages: Math.ceil(rankings.length / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
