import express from 'express';
import { pool, dbHelpers } from '../../infrastructure/database/postgres-helpers.js';

const router = express.Router();

// @route   GET /api/exams/:examId/year/:year
router.get('/:examId/year/:year', async (req, res) => {
  try {
    const { examId, year } = req.params;
    const yearlyData = await dbHelpers.findOne('examYearlyData', {
      examId: parseInt(examId),
      year: parseInt(year),
      isActive: true,
    });

    if (!yearlyData) {
      return res.status(404).json({ success: false, message: 'Yearly data not found for this exam and year' });
    }
    res.json({ success: true, data: yearlyData });
  } catch (error) {
    console.error('Get yearly data error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/exams/:examId/years
router.get('/:examId/years', async (req, res) => {
  try {
    const { examId } = req.params;
    const yearlyData = await dbHelpers.find('examYearlyData', {
      examId: parseInt(examId),
      isActive: true,
    });
    const years = yearlyData.map((data) => data.year).sort((a, b) => b - a);
    res.json({ success: true, data: years, count: years.length });
  } catch (error) {
    console.error('Get years error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/exams/:examId/updates
router.get('/:examId/updates', async (req, res) => {
  try {
    const { examId } = req.params;
    const { limit = 10, page = 1, type } = req.query;
    const parsedLimit = parseInt(limit, 10) || 10;
    const offset = ((parseInt(page, 10) || 1) - 1) * parsedLimit;

    // Push filter + sort + pagination to SQL
    const conditions = ['exam_id = $1', 'is_active = true'];
    const params = [parseInt(examId, 10)];
    let paramIndex = 2;

    if (type) {
      conditions.push(`update_type = $${paramIndex}`);
      params.push(type);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countRes = await pool.query(
      `SELECT COUNT(*) as total FROM exam_updates WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countRes.rows[0].total, 10) || 0;

    // Fetch paginated results sorted by created_at descending
    const updatesRes = await pool.query(
      `SELECT * FROM exam_updates WHERE ${whereClause}
       ORDER BY created_at DESC NULLS LAST
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parsedLimit, offset],
    );

    const updates = updatesRes.rows.map((row) => dbHelpers.toCamel(row));

    res.json({
      success: true,
      data: updates,
      count: updates.length,
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    console.error('Get updates error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/exams/:examId/compare
router.get('/:examId/compare', async (req, res) => {
  try {
    const { examId } = req.params;
    const { years } = req.query;
    const yearArray = years ? years.split(',').map(Number) : [];

    const comparisonData = await dbHelpers.find('examYearlyData', {
      examId: parseInt(examId),
      year: { $in: yearArray },
      isActive: true,
    });

    const formatted = comparisonData
      .sort((a, b) => b.year - a.year)
      .map((data) => ({
        year: data.year,
        vacancies: data.vacancies,
        notificationDate: data.notificationDate,
        applicationStart: data.applicationStart,
        examDateStart: data.examDateStart,
        resultDate: data.resultDate,
      }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Get comparison error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
