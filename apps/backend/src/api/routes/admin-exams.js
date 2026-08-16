import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { parsePagination, paginateResponse } from "./admin-helpers.js";
import logger from "../../infrastructure/logger/logger.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { protect, admin, superAdmin } from '../../middleware/auth.middleware.js';

const router = express.Router();

router.use(protect)
router.use(admin)

// ===== EXAM CATEGORIES (SSC, Railway, Banking, UPSC) =====
router.get("/exam-categories-list", asyncHandler(async (req, res) => {
  const { limit, offset } = parsePagination(req.query);
  const categories = await dbHelpers.find("examCategories", {
    isActive: true,
  }, limit, offset);
  const sortedCategories = categories.sort(
    (a, b) => (a.order || 0) - (b.order || 0),
  );
  res.json({ success: true, ...paginateResponse(sortedCategories, limit, offset) });
}));

router.get("/exam-categories", asyncHandler(async (req, res) => {
  const { limit, offset } = parsePagination(req.query);
  const categories = await dbHelpers.find("examCategories", {
    isActive: true,
  }, limit, offset);
  const exams = await dbHelpers.find("exams", { isActive: true });

  const categoriesWithExams = categories.map((category) => ({
    ...category,
    exams: exams
      .filter(
        (exam) =>
          exam.categoryId === category.id ||
          exam.categoryId === category.categoryId,
      )
      .sort(
        (a, b) =>
          (a.displayOrder ?? a.display_order ?? 0) -
          (b.displayOrder ?? b.display_order ?? 0),
      )
      .map((exam) => ({
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
  }));

  res.json({ success: true, ...paginateResponse(categoriesWithExams, limit, offset) });
}));

router.post("/exam-categories", asyncHandler(async (req, res) => {
  const { label, name, slug, description, icon, displayOrder, display_order, isActive, is_active } = req.body;
  const categoryName = (name || label || "").trim();
  if (!categoryName) {
    return res.status(400).json({ success: false, message: "Category name is required" });
  }
  const categorySlug = (slug || categoryName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')).trim();
  const payload = {
    name: categoryName,
    slug: categorySlug,
    description: description || null,
    icon: icon || null,
    display_order: Number(displayOrder ?? display_order ?? 0),
    is_active: isActive ?? is_active ?? true,
    created_at: new Date().toISOString(),
  };
  const newCategory = await dbHelpers.insertOne("examCategories", payload);
  res.status(201).json({ success: true, data: newCategory });
}));

router.put("/exam-categories/:id", asyncHandler(async (req, res) => {
  const { label, name, slug, description, icon, displayOrder, display_order, isActive, is_active } = req.body;
  const payload = {};
  if (name !== undefined || label !== undefined) payload.name = (name || label || "").trim();
  if (slug !== undefined) payload.slug = slug.trim();
  if (description !== undefined) payload.description = description;
  if (icon !== undefined) payload.icon = icon;
  if (displayOrder !== undefined || display_order !== undefined) payload.display_order = Number(displayOrder ?? display_order ?? 0);
  if (isActive !== undefined || is_active !== undefined) payload.is_active = Boolean(isActive ?? is_active);
  payload.updated_at = new Date().toISOString();

  const updated = await dbHelpers.updateById(
    "examCategories",
    req.params.id,
    payload,
  );

  if (!updated) {
    return res
      .status(404)
      .json({ success: false, message: "Category not found" });
  }
  res.json({ success: true, data: updated });
}));

router.delete("/exam-categories/:id", asyncHandler(async (req, res) => {
  const categoryId = req.params.id;
  
  try {
    const allSeries = await dbHelpers.find("testSeries", { isActive: true });
    const matchingSeries = (allSeries || []).filter(s => 
      String(s.category || "") === String(categoryId) ||
      String(s.exam_category_id || "") === String(categoryId) ||
      String(s.examCategoryId || "") === String(categoryId)
    );
    if (matchingSeries.length > 0) {
      for (const series of matchingSeries) {
        await dbHelpers.updateById("testSeries", series.id, {
          _orphanedExamCategoryId: categoryId,
          _orphanedAt: new Date().toISOString(),
        });
      }
      logger.info(
        `[Cascade] Flagged ${matchingSeries.length} test series as orphaned from exam category ${categoryId}`,
      );
    }
  } catch (err) {
    logger.warn(
      `[Cascade] Warning: Could not flag orphaned test series for exam category ${categoryId}:`,
      err,
    );
  }

  const deleted = await dbHelpers.softDelete(
    "examCategories",
    req.params.id,
    req.user.id,
  );
  if (!deleted) {
    return res
      .status(404)
      .json({ success: false, message: "Category not found" });
  }
  res.json({ success: true, message: "Category moved to trash" });
}));

// ===== EXAMS CRUD (renamed from exam-subcategories) =====
router.post("/exams", asyncHandler(async (req, res) => {
  const {
    name,
    slug,
    description,
    parentCategoryId,
    icon,
    displayOrder,
    isActive,
    stageIds,
  } = req.body;

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
}));

router.put("/exams/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    slug,
    description,
    parentCategoryId,
    icon,
    displayOrder,
    isActive,
    stageIds,
  } = req.body;

  // Find exam by examId (slug) OR numeric id — using sequential findOne calls
  // because dbHelpers.findOne does NOT support the $or operator (it silently
  // skips it and returns the first row in the table, updating/deleting the
  // WRONG record).
  let existingExam = await dbHelpers.findOne("exams", { examId: id })
  if (!existingExam) {
    const numericId = parseInt(id)
    if (!Number.isNaN(numericId)) {
      existingExam = await dbHelpers.findOne("exams", { id: numericId })
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
}));

router.delete("/exams/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Find exam by examId (slug) OR numeric id — sequential findOne calls
  // (dbHelpers.findOne does NOT support $or — it silently ignores it).
  let existingExam = await dbHelpers.findOne("exams", { examId: id })
  if (!existingExam) {
    const numericId = parseInt(id)
    if (!Number.isNaN(numericId)) {
      existingExam = await dbHelpers.findOne("exams", { id: numericId })
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
    message: "Subcategory (exam) deleted successfully",
  });
}));

// ===== EXAM INFO (Detailed exam information) =====
router.get("/exam-info", asyncHandler(async (req, res) => {
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
}));

router.post("/exam-info", asyncHandler(async (req, res) => {
  const body = req.body;

  let categoryId = null;
  if (body.categoryId !== undefined && body.categoryId !== null && body.categoryId !== "") {
    const parsed = Number(body.categoryId);
    categoryId = Number.isNaN(parsed) ? null : parsed;
  }

  const examData = {
    title: (body.title || body.fullName || "Untitled Exam").trim(),
    slug: (body.slug || body.examId || (body.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")).trim(),
    description: body.description || null,
    icon: body.icon || null,
    exam_category_id: categoryId,
    is_active: body.isActive !== false,
    created_at: new Date().toISOString(),
  };

  const newExam = await dbHelpers.insertOne("exams", examData);
  res.status(201).json({ success: true, data: newExam });
}));

router.put("/exam-info/:id", asyncHandler(async (req, res) => {
  const body = req.body;

  let categoryId = undefined;
  if (body.categoryId !== undefined) {
    if (body.categoryId === null || body.categoryId === "") {
      categoryId = null;
    } else {
      const parsed = Number(body.categoryId);
      categoryId = Number.isNaN(parsed) ? null : parsed;
    }
  }

  const examData = {};
  if (body.title !== undefined || body.fullName !== undefined) {
    examData.title = (body.title || body.fullName || "").trim();
  }
  if (body.slug !== undefined || body.examId !== undefined) {
    examData.slug = (body.slug || body.examId || "").trim();
  }
  if (body.description !== undefined) examData.description = body.description;
  if (body.icon !== undefined) examData.icon = body.icon;
  if (categoryId !== undefined) examData.exam_category_id = categoryId;
  if (body.isActive !== undefined) examData.is_active = Boolean(body.isActive);
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
}));

router.delete("/exam-info/:id", asyncHandler(async (req, res) => {
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
}));

// ===== EXAM SEASONS (Year-wise exam sessions) =====
router.get("/exam-seasons", asyncHandler(async (req, res) => {
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
}));

router.post("/exam-seasons", asyncHandler(async (req, res) => {
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
}));

router.put("/exam-seasons/:id", asyncHandler(async (req, res) => {
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
}));

router.delete("/exam-seasons/:id", asyncHandler(async (req, res) => {
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
}));

export default router;
