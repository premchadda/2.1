import express from "express";
import ExamCategory from "../../data/models/exam/ExamCategory.js";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { findEntityByIdentifier } from "../../shared/utils/identifier-utils.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

const router = express.Router();

// @route   GET /api/exam-categories
// @desc    Get all exam categories with associated exams
// @access  Public
router.get("/", responseCache("exam-categories", 120), async (req, res) => {
  try {
    // Fetch categories and exams concurrently
    let [categories, exams] = await Promise.all([
      ExamCategory.find({ isActive: true }),
      dbHelpers.find("exams", { isActive: true }),
    ]);

    if (!categories) categories = [];
    if (!exams) exams = [];

    // Sort by display_order field (column is display_order, not order)
    const sortedCategories = categories.sort(
      (a, b) =>
        (a.displayOrder ?? a.display_order ?? 0) -
        (b.displayOrder ?? b.display_order ?? 0),
    );

    // Attach exams to each category
    // Build category -> exams mapping in a deterministic way
    const categoriesWithExams = sortedCategories.map((category) => {
      // Normalize category identifiers
      const categoryId = category.id || category.categoryId || category.slug;
      const categorySlug = category.slug;

      // Simple, robust matching: attach exams whose categoryId matches the
      // category's id/slug values. This avoids brittle ad-hoc mappings.
      const matchedExams = exams
        .filter((exam) => {
          const examCatId = exam.categoryId;
          return (
            examCatId === categoryId ||
            examCatId === categorySlug ||
            examCatId === String(categoryId) ||
            examCatId === String(categorySlug)
          );
        })
        .sort(
          (a, b) =>
            (a.displayOrder ?? a.display_order ?? 0) -
            (b.displayOrder ?? b.display_order ?? 0),
        );

      return {
        ...category,
        exams: matchedExams.map((exam) => ({
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
      };
    });

    res.json({
      success: true,
      count: categoriesWithExams.length,
      data: categoriesWithExams,
    });
  } catch (error) {
    console.error("Error fetching exam categories:", error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/exam-categories/exams
// @desc    Get all exams
// @access  Public
router.get("/exams/all", async (req, res) => {
  try {
    let exams = await dbHelpers.find("exams", { isActive: true });

    if (!exams) exams = [];

    const sortedExams = exams.sort(
      (a, b) =>
        (a.displayOrder ?? a.display_order ?? 0) -
        (b.displayOrder ?? b.display_order ?? 0),
    );

    res.json({
      success: true,
      count: sortedExams.length,
      data: sortedExams,
    });
  } catch (error) {
    console.error("Error fetching exams:", error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/exam-categories/:id
// @desc    Get exam category by identifier (slug, public_id, or numeric ID)
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Use unified identifier resolver (supports slug, public_id, and numeric ID)
    let category = await findEntityByIdentifier(
      dbHelpers,
      "examCategories",
      id,
      {
        slugFields: ["slug"],
      },
    );

    if (!category || !category.isActive) {
      return res.status(404).json({
        success: false,
        message: "Exam category not found",
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/exam-categories/slug/:slug
// @desc    Get exam category by slug
// @access  Public
router.get("/slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    let categories = await ExamCategory.find({ isActive: true });
    let category = categories.find((c) => c.slug === slug);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Exam category not found",
      });
    }

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/exam-categories/:id/exams
// @desc    Get exams for a specific exam category
// @access  Public
router.get("/:id/exams", async (req, res) => {
  try {
    const category = await ExamCategory.findById(req.params.id);

    if (!category || !category.isActive) {
      return res.status(404).json({
        success: false,
        message: "Exam category not found",
      });
    }

    // Get exams for this category
    let exams = await dbHelpers.find("exams", {
      categoryId: req.params.id,
      isActive: true,
    });

    if (!exams) exams = [];

    // Sort by display_order field
    const sortedExams = exams.sort(
      (a, b) => (a.display_order || 0) - (b.display_order || 0),
    );

    res.json({
      success: true,
      data: sortedExams,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

export default router;
