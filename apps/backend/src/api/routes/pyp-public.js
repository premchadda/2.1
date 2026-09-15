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
          `(
            exam_id IN (
              SELECT id FROM exams
              WHERE id::text = $${paramIndex}::text
                 OR slug = $${paramIndex}::text
                 OR public_id = $${paramIndex}::text
                 OR LOWER(REPLACE(title, ' ', '-')) = LOWER($${paramIndex}::text)
            )
            OR exam_category_id IN (
              SELECT id FROM exam_categories
              WHERE id::text = $${paramIndex}::text
                 OR slug = $${paramIndex}::text
            )
            OR LOWER(slug) LIKE '%' || LOWER($${paramIndex}::text) || '%'
            OR LOWER(title) LIKE '%' || LOWER($${paramIndex}::text) || '%'
            OR $${paramIndex}::text = ANY(tags)
          )`,
        );
        params.push(exam.trim());
        paramIndex++;
      }

      if (year && year !== "all") {
        const parsedYear = parseInt(year, 10);
        if (!isNaN(parsedYear)) {
          conditions.push(
            `(year = $${paramIndex} OR pyq_year = $${paramIndex})`,
          );
          params.push(parsedYear);
          paramIndex++;
        }
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
        ORDER BY COALESCE(pyq_year, year) DESC NULLS LAST, id DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, parsedLimit, offset],
      );

      const pypTests = testsRes.rows.map((row) => dbHelpers.toCamel(row));

      // Fetch available years — read replica, lightweight
      const yearsRes = await readQuery(
        `SELECT DISTINCT COALESCE(pyq_year, year) as year FROM tests
        WHERE is_active = true AND ('pyp' = ANY(tags) OR 'previous-year' = ANY(tags) OR category = 'PYPs' OR type = 'Previous Year Papers')
          AND (year IS NOT NULL OR pyq_year IS NOT NULL)
        ORDER BY year DESC`,
      );
      const availableYears = yearsRes.rows
        .map((r) => r.year)
        .filter((y) => typeof y === "number");

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
