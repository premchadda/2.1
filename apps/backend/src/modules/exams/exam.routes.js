import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { findEntityByIdentifier } from "../../shared/utils/identifier-utils.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";

const router = express.Router();

// @route   GET /api/exams
// @desc    Get all exams
// @access  Public
router.get("/", responseCache("exams-list", 120), async (req, res) => {
  try {
    const exams = await dbHelpers.find("exams", { isActive: true });

    // Manually sort by createdAt if needed, Postgres might default to insertion order but better to sort
    exams.sort(
      (a, b) =>
        (a.displayOrder ?? a.display_order ?? 0) -
        (b.displayOrder ?? b.display_order ?? 0),
    );

    res.json({
      success: true,
      count: exams.length,
      data: exams,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/exams/slug/:slug
// @desc    Get exam by slug
// @access  Public
router.get(
  "/slug/:slug",
  responseCache("exams-by-slug", 120),
  async (req, res) => {
    try {
      const { slug } = req.params;

      // Query by slug with WHERE clause instead of fetching all exams
      const exams = await dbHelpers.find("exams", { slug, isActive: true });
      const exam = exams[0];

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: "Exam not found",
        });
      }

      res.json({
        success: true,
        data: exam,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: sanitizeErrorMessage(error),
      });
    }
  },
);

// @route   GET /api/exams/:slug
// @desc    Get exam by identifier (slug, public_id, or numeric ID)
// @access  Public
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    // Use unified identifier resolver (supports slug, public_id, and numeric ID)
    const exam = await findEntityByIdentifier(dbHelpers, "exams", slug, {
      slugFields: ["slug"],
    });

    if (!exam || !exam.isActive) {
      return res.status(404).json({
        success: false,
        message: "Exam not found",
      });
    }

    res.json({
      success: true,
      data: exam,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/exams/category/:categoryId
// @desc    Get category with exams by category ID
// @access  Public
router.get("/category/:categoryId", async (req, res) => {
  try {
    const categoryId = req.params.categoryId;
    const categories = await dbHelpers.find("examCategories", {
      id: categoryId,
      isActive: true,
    });

    if (categories.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    const category = categories[0];
    const exams = await dbHelpers.find("exams", {
      categoryId,
      isActive: true,
    });

    exams.sort(
      (a, b) =>
        (a.displayOrder ?? a.display_order ?? 0) -
        (b.displayOrder ?? b.display_order ?? 0),
    );

    res.json({
      success: true,
      data: {
        ...category,
        exams: exams.map((exam) => ({
          id: exam.examId,
          examId: exam.examId,
          title: exam.title,
          fullName: exam.fullName,
          description: exam.description,
          desc: exam.description,
          notification: exam.notification,
          eligibility: exam.eligibility,
          ageLimit: exam.ageLimit,
          syllabus: exam.syllabus,
          seriesId: exam.seriesId,
          isActive: exam.isActive,
        })),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// @route   GET /api/exams/:slug/compare
// @desc    Get exam comparison data across multiple years
// @access  Public
router.get(
  "/:slug/compare",
  responseCache("exams-compare", 120),
  async (req, res) => {
    try {
      const { slug } = req.params;
      const years = req.query.years
        ? req.query.years.split(",")
        : ["2026", "2025", "2024"];

      // Primary lookup: query by slug directly
      const exams = await dbHelpers.find("exams", { slug, isActive: true });
      let exam = exams[0];

      // Fallback: try numeric ID lookup for backwards compatibility
      if (!exam) {
        exam = await dbHelpers.findById("exams", slug);
      }

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: "Exam not found",
        });
      }

      // Get exam info for comparison across years
      const examInfos = await dbHelpers.find("examInfo", {
        examId: exam.id || exam._id,
        isActive: true,
      });

      // Build comparison data
      const yearData = years.map((year) => {
        const info = examInfos.find(
          (ei) => ei.year === year || ei.year === parseInt(year),
        );
        return {
          year,
          notification: info?.notification || `June ${parseInt(year) - 1}`,
          applicationStart:
            info?.applicationStart || `${parseInt(year) - 1}-07-01`,
          applicationEnd: info?.applicationEnd || `${parseInt(year) - 1}-07-25`,
          examDate: info?.examDate || `${parseInt(year) - 1}-09-15`,
          vacancy: info?.vacancy ?? null,
          eligibility: info?.eligibility || "Bachelor's degree",
          ageLimit: info?.ageLimit || "18-32 years",
          papers: info?.papers || 2,
          totalMarks: info?.totalMarks || 400,
        };
      });

      res.json({
        success: true,
        data: {
          examName: exam.title || exam.name,
          examId: exam.slug || exam.id || exam._id,
          years: yearData,
          comparisonFields: [
            { label: "Notification Date", key: "notification" },
            {
              label: "Application Start",
              key: "applicationStart",
              isDate: true,
            },
            { label: "Application End", key: "applicationEnd", isDate: true },
            { label: "Exam Date", key: "examDate", isDate: true },
            { label: "Total Vacancy", key: "vacancy", isNumber: true },
            { label: "Eligibility", key: "eligibility" },
            { label: "Age Limit", key: "ageLimit" },
            { label: "Number of Papers", key: "papers", isNumber: true },
            { label: "Total Marks", key: "totalMarks", isNumber: true },
          ],
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: sanitizeErrorMessage(error),
      });
    }
  },
);

// @route   GET /api/exams/:slug/year
// @desc    Get exam details for a specific year
// @access  Public
router.get(
  "/:slug/year",
  responseCache("exams-year", 120),
  async (req, res) => {
    try {
      const { slug } = req.params;
      const { year } = req.query;

      // Primary lookup: query by slug directly
      const exams = await dbHelpers.find("exams", { slug, isActive: true });
      let exam = exams[0];

      // Fallback: try numeric ID lookup for backwards compatibility
      if (!exam) {
        exam = await dbHelpers.findById("exams", slug);
      }

      if (!exam) {
        return res.status(404).json({
          success: false,
          message: "Exam not found",
        });
      }

      // Get exam info for specific year
      const examInfos = await dbHelpers.find("examInfo", {
        examId: exam.id || exam._id,
        isActive: true,
      });

      const info = examInfos.find(
        (ei) => ei.year === year || ei.year === parseInt(year),
      );
      const yearInt = parseInt(year);

      // Get previous year papers
      const tests = await dbHelpers.find("tests", {
        examId: exam.id || exam._id,
        year: yearInt,
        isActive: true,
      });

      const previousYearPapers = tests.slice(0, 5).map((test, idx) => ({
        id: test._id || test.id,
        title: `${year} ${test.title || `Shift ${idx + 1}`}`,
        date: test.date || `${year}-12-0${idx + 1}`,
        questions: test.totalQuestions || 100,
      }));

      res.json({
        success: true,
        data: {
          examId: exam.slug || exam.id || exam._id,
          examName: exam.title || exam.name,
          year: yearInt,
          notification: info?.notification || `June ${yearInt - 1}`,
          applicationStart: info?.applicationStart || `${yearInt - 1}-07-01`,
          applicationEnd: info?.applicationEnd || `${yearInt - 1}-07-25`,
          tier1ExamDate: info?.tier1ExamDate || `${yearInt - 1}-09-15`,
          tier2ExamDate: info?.tier2ExamDate || `${yearInt - 1}-12-01`,
          vacancy: info?.vacancy ?? null,
          description:
            info?.description ||
            `Complete information about ${exam.title || exam.name} ${year} examination including important dates, syllabus, and preparation strategy.`,
          eligibility:
            info?.eligibility || "Bachelor's degree in any discipline",
          ageLimit: info?.ageLimit || "18-32 years",
          patternChanges:
            info?.patternChanges || "No major changes from previous year",
          syllabusChanges:
            info?.syllabusChanges ||
            "Some topics added to General Awareness section",
          previousYearPapers:
            previousYearPapers.length > 0
              ? previousYearPapers
              : [
                  {
                    id: 1,
                    title: `${year} Shift 1`,
                    date: `${year}-12-01`,
                    questions: 100,
                  },
                  {
                    id: 2,
                    title: `${year} Shift 2`,
                    date: `${year}-12-02`,
                    questions: 100,
                  },
                  {
                    id: 3,
                    title: `${year} Shift 3`,
                    date: `${year}-12-03`,
                    questions: 100,
                  },
                ],
          importantTopics: info?.importantTopics || [
            "Quantitative Aptitude",
            "English Comprehension",
            "General Intelligence & Reasoning",
            "General Awareness",
          ],
          preparationStrategy: info?.preparationStrategy || [
            "Start with basics and fundamentals",
            "Practice previous year questions",
            "Take regular mock tests",
            "Focus on time management",
            "Revise regularly",
          ],
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: sanitizeErrorMessage(error),
      });
    }
  },
);

export default router;
