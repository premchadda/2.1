import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import responseCache from "../../middleware/responseCache.js";
import { readQuery } from "../../../config/database-replicas.js";

const router = express.Router();

// @route   GET /api/exams/:examId/year/:year — cached, read replica
router.get(
  "/:examId/year/:year",
  responseCache({
    ttl: 60,
    prefix: "res:public:exams:year:",
    userScoped: false,
  }),
  async (req, res) => {
    try {
      const { examId, year } = req.params;
      let targetExamId = parseInt(examId, 10);
      if (Number.isNaN(targetExamId)) {
        const exam = await dbHelpers.findOne("exams", { slug: examId });
        targetExamId = exam ? exam.id : null;
      }
      if (!targetExamId) {
        return res.status(404).json({
          success: false,
          message: "Exam not found",
        });
      }
      const yearlyData = await dbHelpers.findOne("examYearlyData", {
        examId: targetExamId,
        year: parseInt(year, 10),
        isActive: true,
      });

      if (!yearlyData) {
        return res.status(404).json({
          success: false,
          message: "Yearly data not found for this exam and year",
        });
      }
      res.json({ success: true, data: yearlyData });
    } catch (error) {
      console.error("Get yearly data error:", error);
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

// @route   GET /api/exams/:examId/years — cached, read replica
router.get(
  "/:examId/years",
  responseCache({
    ttl: 60,
    prefix: "res:public:exams:years:",
    userScoped: false,
  }),
  async (req, res) => {
    try {
      const { examId } = req.params;
      let targetExamId = parseInt(examId, 10);
      if (Number.isNaN(targetExamId)) {
        const exam = await dbHelpers.findOne("exams", { slug: examId });
        targetExamId = exam ? exam.id : null;
      }
      if (!targetExamId) {
        return res.status(404).json({
          success: false,
          message: "Exam not found",
        });
      }
      const yearlyData = await dbHelpers.find("examYearlyData", {
        examId: targetExamId,
        isActive: true,
      });
      const years = yearlyData.map((data) => data.year).sort((a, b) => b - a);
      res.json({ success: true, data: years, count: years.length });
    } catch (error) {
      console.error("Get years error:", error);
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

// @route   GET /api/exams/:examId/updates — cached, read replica, paginated
router.get(
  "/:examId/updates",
  responseCache({
    ttl: 30,
    prefix: "res:public:exams:updates:",
    userScoped: false,
  }),
  async (req, res) => {
    try {
      const { examId } = req.params;
      const { limit = 10, page = 1, type } = req.query;
      const parsedLimit = parseInt(limit, 10) || 10;
      const offset = ((parseInt(page, 10) || 1) - 1) * parsedLimit;

      // Guard parseInt(req.params.examId, 10): if isNaN, query by slug, otherwise query by numeric id
      let targetExamId = parseInt(examId, 10);
      if (Number.isNaN(targetExamId)) {
        const exam = await dbHelpers.findOne("exams", { slug: examId });
        if (!exam) {
          return res.status(404).json({
            success: false,
            message: "Exam not found",
          });
        }
        targetExamId = exam.id;
      }

      // Push filter + sort + pagination to SQL
      const conditions = ["exam_id = $1", "is_active = true"];
      const params = [targetExamId];
      let paramIndex = 2;

      if (type) {
        conditions.push(`update_type = $${paramIndex}`);
        params.push(type);
        paramIndex++;
      }

      const whereClause = conditions.join(" AND ");

      // Get total count — read replica
      const countRes = await readQuery(
        `SELECT COUNT(*) as total FROM exam_updates WHERE ${whereClause}`,
        params,
      );
      const total = parseInt(countRes.rows[0].total, 10) || 0;

      // Fetch paginated results — read replica
      const updatesRes = await readQuery(
        `SELECT id, type, title, description, priority, update_date, is_active, created_at, exam_id, updated_at, is_deleted, deleted_at, deleted_by FROM exam_updates WHERE ${whereClause}
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
      console.error("Get updates error:", error);
      res
        .status(500)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

export default router;
