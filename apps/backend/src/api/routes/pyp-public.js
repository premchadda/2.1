import express from "express";
import {
  pool,
  dbHelpers,
} from "../../infrastructure/database/postgres-helpers.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import responseCache from "../../middleware/responseCache.js";
import { readQuery } from "../../../config/database-replicas.js";

const router = express.Router();

// PERF-02: SQL-level filtering + read replica + cache + projected fields
// @route   GET /api/previous-year-papers
router.get(
  "/",
  responseCache({ ttl: 60, prefix: "res:public:pyp:" }),
  async (req, res) => {
    try {
      const { exam, year, limit = 20, page = 1 } = req.query;
      const parsedLimit = parseInt(limit, 10) || 20;
      const offset = ((parseInt(page, 10) || 1) - 1) * parsedLimit;

      // Build WHERE clause dynamically
      const conditions = [
        "is_active = true",
        "('pyp' = ANY(tags) OR 'previous-year' = ANY(tags) OR category = 'PYPs' OR type = 'Previous Year Papers')",
      ];
      const params = [];
      let paramIndex = 1;

      if (exam) {
        conditions.push(
          `(LOWER(exam_type) = LOWER($${paramIndex}) OR LOWER(exam_category) = LOWER($${paramIndex}))`,
        );
        params.push(exam);
        paramIndex++;
      }

      if (year) {
        conditions.push(`year = $${paramIndex}`);
        params.push(parseInt(year, 10));
        paramIndex++;
      }

      const whereClause = conditions.join(" AND ");

      // Get total count — read replica
      const countRes = await readQuery(
        `SELECT COUNT(*) as total FROM tests WHERE ${whereClause}`,
        params,
      );
      const total = parseInt(countRes.rows[0].total, 10) || 0;

      // Fetch paginated results — projected fields (18 cols) via read replica
      const testsRes = await readQuery(
        `SELECT id, series_id, slug, title, category, type, total_questions, total_marks, duration, difficulty, year, pyq_year, is_pyq, exam_category_id, tags, is_active, is_pro, created_at, updated_at, exam_id, is_coming_soon
       FROM tests WHERE ${whereClause}
        ORDER BY year DESC NULLS LAST
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, parsedLimit, offset],
      );

      const pypTests = testsRes.rows.map((row) => dbHelpers.toCamel(row));

      // Fetch available years — read replica, lightweight
      const yearsRes = await readQuery(
        `SELECT DISTINCT year FROM tests
        WHERE is_active = true AND ('pyp' = ANY(tags) OR 'previous-year' = ANY(tags) OR category = 'PYPs')
          AND year IS NOT NULL
        ORDER BY year DESC`,
      );
      const availableYears = yearsRes.rows.map((r) => r.year);

      res.json({
        success: true,
        data: pypTests,
        count: pypTests.length,
        total,
        availableYears,
        pagination: {
          page: parseInt(page, 10) || 1,
          limit: parsedLimit,
          total,
          totalPages: Math.ceil(total / parsedLimit),
        },
      });
    } catch (error) {
      console.error("Get previous year papers error:", error);
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

export default router;
