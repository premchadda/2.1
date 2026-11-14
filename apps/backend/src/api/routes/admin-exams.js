import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { protect, admin } from "../../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);
router.use(admin);

// NOTE: exam-categories CRUD used to be duplicated here. admin-categories.js
// registers the same paths earlier in admin.js, so those copies were unreachable
// and have been removed. exam-categories is owned by admin-categories.js —
// including the legacy `/exam-categories-list` alias, which only it serves.

// ===== EXAMS CRUD =====
router.post(
  "/exams",
  asyncHandler(async (req, res) => {
    const parentCategoryId =
      req.body.parentCategoryId ??
      req.body.parent_category_id ??
      req.body.categoryId ??
      req.body.category_id;
    const { name, slug, description, icon } = req.body;
    const displayOrder = req.body.displayOrder ?? req.body.display_order;
    const isActive = req.body.isActive ?? req.body.is_active;
    const stageIds = req.body.stageIds ?? req.body.stage_ids;

    if (!name || !slug || !parentCategoryId) {
      return res.status(400).json({
        success: false,
        message: "Name, slug, and parentCategoryId are required",
      });
    }

    const existing = await dbHelpers.findOne("exams", { examId: slug });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "An exam with this ID already exists",
      });
    }

    const newExam = await dbHelpers.insertOne("exams", {
      categoryId: parentCategoryId,
      examId: slug,
      title: name,
      fullName: name,
      description: description || "",
      isActive: isActive !== false,
      stageIds: stageIds || [],
      displayOrder: displayOrder || 0,
    });

    const categories = await dbHelpers.find("examCategories", {
      isActive: true,
    });
    const category = categories.find(
      (cat) =>
        String(cat.id) === String(parentCategoryId) ||
        String(cat.categoryId) === String(parentCategoryId),
    );

    res.json({
      success: true,
      data: {
        id: slug,
        _id: newExam.id,
        name: name,
        title: name,
        slug: slug,
        description: description || "",
        parentCategoryId: parentCategoryId,
        parentCategoryName: category?.label || "",
        parentCategoryIcon: icon || category?.icon || "📋",
        isActive: isActive !== false,
        displayOrder: displayOrder || 0,
        stageIds: stageIds || [],
      },
    });
  }),
);

router.put(
  "/exams/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const parentCategoryId =
      req.body.parentCategoryId ??
      req.body.parent_category_id ??
      req.body.categoryId ??
      req.body.category_id;
    const { name, slug, description, icon } = req.body;
    const displayOrder = req.body.displayOrder ?? req.body.display_order;
    const isActive = req.body.isActive ?? req.body.is_active;
    const stageIds = req.body.stageIds ?? req.body.stage_ids;

    // Find exam by examId (slug) OR numeric id — using sequential findOne calls
    // because dbHelpers.findOne does NOT support the $or operator (it silently
    // skips it and returns the first row in the table, updating/deleting the
    // WRONG record).
    let existingExam = await dbHelpers.findOne("exams", { examId: id });
    if (!existingExam) {
      const numericId = parseInt(id);
      if (!Number.isNaN(numericId)) {
        existingExam = await dbHelpers.findOne("exams", { id: numericId });
      }
    }

    if (!existingExam) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }

    const updateData = {};
    if (name) updateData.title = name;
    if (slug) updateData.examId = slug;
    if (description !== undefined) updateData.description = description;
    if (parentCategoryId) updateData.categoryId = parentCategoryId;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (stageIds) updateData.stageIds = stageIds;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;

    await dbHelpers.updateById("exams", existingExam.id, updateData);

    const updatedExam = await dbHelpers.findOne("exams", {
      id: existingExam.id,
    });
    const categories = await dbHelpers.find("examCategories", {
      isActive: true,
    });
    const category = categories.find(
      (cat) =>
        String(cat.id) === String(updatedExam.categoryId) ||
        String(cat.categoryId) === String(updatedExam.categoryId),
    );

    res.json({
      success: true,
      data: {
        id: updatedExam.examId || updatedExam.id,
        _id: updatedExam.id,
        name: updatedExam.title,
        title: updatedExam.title,
        slug: updatedExam.examId,
        description: updatedExam.description,
        parentCategoryId: updatedExam.categoryId,
        parentCategoryName: category?.label || "",
        parentCategoryIcon: icon || category?.icon || "📋",
        isActive: updatedExam.isActive,
        displayOrder: updatedExam.displayOrder || 0,
        stageIds: updatedExam.stageIds || [],
      },
    });
  }),
);

router.delete(
  "/exams/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Find exam by examId (slug) OR numeric id — sequential findOne calls
    // (dbHelpers.findOne does NOT support $or — it silently ignores it).
    let existingExam = await dbHelpers.findOne("exams", { examId: id });
    if (!existingExam) {
      const numericId = parseInt(id);
      if (!Number.isNaN(numericId)) {
        existingExam = await dbHelpers.findOne("exams", { id: numericId });
      }
    }

    if (!existingExam) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }

    await dbHelpers.updateById("exams", existingExam.id, { isActive: false });

    res.json({
      success: true,
      message: "Exam deleted successfully",
    });
  }),
);

// ===== EXAM INFO (Detailed exam information) =====
router.get(
  "/exam-info",
  asyncHandler(async (req, res) => {
    const exams = await dbHelpers.find("exams", { isActive: true });
    const categories = await dbHelpers.find("examCategories", {
      isActive: true,
    });

    const examInfoWithCategories = exams
      .sort(
        (a, b) =>
          (a.display_order ?? a.displayOrder ?? 0) -
          (b.display_order ?? b.displayOrder ?? 0),
      )
      .map((exam) => {
        const category = categories.find(
          (cat) =>
            String(cat.id) === String(exam.category_id) ||
            String(cat.categoryId) === String(exam.category_id),
        );
        return {
          _id: exam._id || exam.id,
          id: exam.id,
          examId: exam.exam_id || exam.examId || exam.id,
          title: exam.title,
          fullName: exam.full_name || exam.fullName,
          description: exam.description,
          categoryId: exam.category_id || exam.categoryId,
          notification: exam.notification,
          seriesId: exam.series_id || exam.seriesId,
          eligibility: exam.eligibility,
          ageLimit: exam.age_limit || exam.ageLimit,
          syllabus: exam.syllabus,
          isActive: exam.is_active !== false,
          displayOrder: exam.display_order ?? exam.displayOrder ?? 0,
          categoryLabel: category
            ? category.label
            : exam.category_id || "Uncategorized",
          categoryIcon: category ? category.icon : "📋",
        };
      });

    res.json({ success: true, data: examInfoWithCategories });
  }),
);

router.post(
  "/exam-info",
  asyncHandler(async (req, res) => {
    const body = req.body;

    let categoryId = null;
    const rawCategory = body.categoryId ?? body.category_id ?? body.category;
    if (
      rawCategory !== undefined &&
      rawCategory !== null &&
      rawCategory !== ""
    ) {
      categoryId = rawCategory;
    }

    const examData = {
      title: (body.title || body.fullName || "Untitled Exam").trim(),
      full_name: (body.fullName || body.full_name || body.title || "").trim(),
      slug: (
        body.slug ||
        body.examId ||
        (body.title || "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "")
      ).trim(),
      exam_id: (body.examId || body.exam_id || body.slug || "").trim(),
      description: body.description || null,
      notification: body.notification || null,
      series_id: body.seriesId
        ? parseInt(body.seriesId, 10)
        : body.series_id
          ? parseInt(body.series_id, 10)
          : null,
      eligibility: body.eligibility || null,
      age_limit: body.ageLimit ?? body.age_limit ?? null,
      syllabus: body.syllabus || null,
      display_order: Number(body.displayOrder ?? body.display_order) || 0,
      year: parseInt(body.year, 10) || new Date().getFullYear(),
      icon: body.icon || null,
      category_id: categoryId,
      is_active: body.isActive !== false && body.is_active !== false,
      created_at: new Date().toISOString(),
    };

    const newExam = await dbHelpers.insertOne("exams", examData);
    res.status(201).json({ success: true, data: newExam });
  }),
);

router.put(
  "/exam-info/:id",
  asyncHandler(async (req, res) => {
    const body = req.body;

    let categoryId = undefined;
    const rawCategory = body.categoryId ?? body.category_id ?? body.category;
    if (rawCategory !== undefined) {
      if (rawCategory === null || rawCategory === "") {
        categoryId = null;
      } else {
        categoryId = rawCategory;
      }
    }

    const examData = {};
    if (body.title !== undefined) {
      examData.title = String(body.title).trim();
    }
    if (body.fullName !== undefined || body.full_name !== undefined) {
      examData.full_name = String(body.fullName ?? body.full_name).trim();
    }
    if (
      body.slug !== undefined ||
      body.examId !== undefined ||
      body.exam_id !== undefined
    ) {
      const s = String(body.slug || body.examId || body.exam_id).trim();
      examData.slug = s;
      examData.exam_id = s;
    }
    if (body.description !== undefined) examData.description = body.description;
    if (body.notification !== undefined)
      examData.notification = body.notification;
    if (body.seriesId !== undefined || body.series_id !== undefined) {
      const rawSer = body.seriesId ?? body.series_id;
      examData.series_id = rawSer ? parseInt(rawSer, 10) : null;
    }
    if (body.eligibility !== undefined) examData.eligibility = body.eligibility;
    if (body.ageLimit !== undefined || body.age_limit !== undefined) {
      examData.age_limit = body.ageLimit ?? body.age_limit;
    }
    if (body.syllabus !== undefined) examData.syllabus = body.syllabus;
    if (body.displayOrder !== undefined || body.display_order !== undefined) {
      examData.display_order =
        Number(body.displayOrder ?? body.display_order) || 0;
    }
    if (body.year !== undefined) {
      examData.year = parseInt(body.year, 10) || null;
    }
    if (body.icon !== undefined) examData.icon = body.icon;
    if (categoryId !== undefined) examData.category_id = categoryId;
    if (body.isActive !== undefined || body.is_active !== undefined) {
      examData.is_active = Boolean(body.isActive ?? body.is_active);
    }
    examData.updated_at = new Date().toISOString();

    const updated = await dbHelpers.updateById(
      "exams",
      req.params.id,
      examData,
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }
    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/exam-info/:id",
  asyncHandler(async (req, res) => {
    const deleted = await dbHelpers.softDelete(
      "exams",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Exam info not found" });
    }
    res.json({ success: true, message: "Exam info moved to trash" });
  }),
);

// ===== EXAM SEASONS (Year-wise exam sessions) =====
router.get(
  "/exam-seasons",
  asyncHandler(async (req, res) => {
    const seasons = await dbHelpers.find("examSeasons", { isActive: true });
    const exams = await dbHelpers.find("exams", { isActive: true });

    const seasonsWithExams = seasons
      .sort(
        (a, b) =>
          (a.displayOrder ?? a.display_order ?? 0) -
          (b.displayOrder ?? b.display_order ?? 0),
      )
      .map((season) => {
        const exam = exams.find((e) => e.id === season.examId);
        return {
          ...season,
          examTitle: exam?.title || "Unknown",
          examSlug: exam?.examId || "",
        };
      });

    res.json({ success: true, data: seasonsWithExams });
  }),
);

router.post(
  "/exam-seasons",
  asyncHandler(async (req, res) => {
    const {
      examId,
      seasonSlug,
      year,
      title,
      notificationDate,
      applicationStartDate,
      applicationEndDate,
      examDate,
      resultDate,
      vacancyTotal,
      status,
    } = req.body;

    if (!examId || !seasonSlug || !year || !title) {
      return res.status(400).json({
        success: false,
        message: "examId, seasonSlug, year, and title are required",
      });
    }

    const existing = await dbHelpers.findOne("examSeasons", { seasonSlug });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A season with this slug already exists",
      });
    }

    const newSeason = await dbHelpers.insertOne("examSeasons", {
      examId: parseInt(examId),
      seasonSlug,
      year: parseInt(year),
      title,
      notificationDate: notificationDate || null,
      applicationStartDate: applicationStartDate || null,
      applicationEndDate: applicationEndDate || null,
      examDate: examDate || null,
      resultDate: resultDate || null,
      vacancyTotal: vacancyTotal || 0,
      status: status || "upcoming",
      isActive: true,
    });

    res.status(201).json({ success: true, data: newSeason });
  }),
);

router.put(
  "/exam-seasons/:id",
  asyncHandler(async (req, res) => {
    const updated = await dbHelpers.updateById(
      "examSeasons",
      req.params.id,
      req.body,
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Exam season not found" });
    }
    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/exam-seasons/:id",
  asyncHandler(async (req, res) => {
    const deleted = await dbHelpers.softDelete(
      "examSeasons",
      req.params.id,
      req.user?.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Exam season not found" });
    }
    res.json({ success: true, message: "Exam season deleted" });
  }),
);

export default router;
