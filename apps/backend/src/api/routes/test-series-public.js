import express from 'express';
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js';
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';
import responseCache from '../../middleware/responseCache.js';
import { readQuery } from '../../../config/database-replicas.js';

const router = express.Router();

// @route   GET /api/test-series — paginated, cached, read-replica, projected fields
router.get('/', responseCache({ ttl: 60, prefix: 'res:public:test-series:' }), async (req, res) => {
  try {
    const { page = 1, limit = 50, isPro = 'false' } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (parsedPage - 1) * parsedLimit;
    const isProFilter = isPro === 'true';

    // Use read replica + projected columns + pagination (improved, backward compatible)
    const countRes = await readQuery('SELECT COUNT(*) as total FROM test_series WHERE is_pro = $1 AND is_deleted IS NOT TRUE', [isProFilter]);
    const total = parseInt(countRes.rows[0].total, 10) || 0;

    const seriesRes = await readQuery(
      `SELECT id, title, slug, description, is_pro, is_active, price, exam_category_id, created_at, updated_at, banner_asset_id, total_tests, total_questions
       FROM test_series WHERE is_pro = $1 AND is_deleted IS NOT TRUE
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [isProFilter, parsedLimit, offset]
    );
    const series = seriesRes.rows.map((row) => dbHelpers.toCamel(row));

    res.json({
      success: true,
      data: series,
      count: series.length,
      total,
      pagination: { page: parsedPage, limit: parsedLimit, total, totalPages: Math.ceil(total / parsedLimit) },
    });
  } catch (error) {
    console.error('Get test series error:', error);
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
