import express from "express";
import {
  dbHelpers,
  pool,
} from "../../infrastructure/database/postgres-helpers.js";
import { protect, admin } from "../../middleware/auth.middleware.js";
import logger from "../../infrastructure/logger/logger.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import {
  responseCache,
  invalidateResponseCache,
} from "../../middleware/responseCache.middleware.js";

const router = express.Router();

router.use(protect);
router.use(admin);

// ===== TEST CATEGORIES MANAGEMENT (Hierarchical) =====
router.get(
  "/test-categories",
  responseCache("admin-test-categories", 60),
  asyncHandler(async (req, res) => {
    const { parentId, includeInactive } = req.query;
    const query = {};

    const shouldIncludeInactive =
      includeInactive === "true" || includeInactive === true;

    if (shouldIncludeInactive) {
      query.includeInactive = true;
    } else {
      query.isActive = true;
    }

    if (parentId !== undefined) {
      query.parentId = parentId === "null" || parentId === "" ? null : parentId;
    }

    const categories = await dbHelpers.find("testCategories", query);

    if (categories.length > 0) {
      const ids = categories.map((c) => c._id || c.id);
      const catTable = dbHelpers.getTableName("testCategories");
      const [countRes, relationsRes] = await Promise.all([
        pool.query(
          `SELECT parent_id, COUNT(*) as count FROM "${catTable}" WHERE parent_id = ANY($1) AND is_active = true GROUP BY parent_id`,
          [ids],
        ),
        pool.query(
          `SELECT test_category_id, test_series_id FROM test_category_series WHERE test_category_id = ANY($1)`,
          [ids],
        ),
      ]);

      const countsMap = {};
      countRes.rows.forEach((row) => {
        countsMap[row.parent_id] = parseInt(row.count, 10);
      });

      const relationsMap = {};
      relationsRes.rows.forEach((row) => {
        const catId = row.test_category_id;
        if (!relationsMap[catId]) relationsMap[catId] = [];
        relationsMap[catId].push(row.test_series_id);
      });

      categories.forEach((cat) => {
        const catId = cat._id || cat.id;
        cat.childCount = countsMap[catId] || 0;
        cat.testSeriesId = relationsMap[catId] || [];
        cat.test_series_ids = cat.testSeriesId;
      });
    }

    res.json({ success: true, data: categories, count: categories.length });
  }),
);

router.post(
  "/test-categories",
  asyncHandler(async (req, res) => {
    const parentId =
      req.body.parentId !== undefined
        ? req.body.parentId
        : req.body.parent_id !== undefined
          ? req.body.parent_id
          : null;

    let parent = null;
    if (parentId) {
      parent = await dbHelpers.findById("testCategories", parentId);
      if (!parent) {
        return res
          .status(400)
          .json({ success: false, message: "Parent category not found" });
      }
    }

    const name = (req.body.name || req.body.label || "").trim();
    if (!name) {
      return res
        .status(400)
        .json({ success: false, message: "Category name is required" });
    }

    let slug = (req.body.slug || "").trim();
    if (!slug && name) {
      slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }

    if (slug) {
      const existingCat = await pool.query(
        "SELECT id, name, slug, is_deleted, is_active FROM test_categories WHERE slug = $1 LIMIT 1",
        [slug],
      );
      if (existingCat.rows.length > 0) {
        const existing = existingCat.rows[0];
        if (existing.is_deleted) {
          // Free up the slug from the soft-deleted record so it can be reused
          await pool.query(
            "UPDATE test_categories SET slug = $1 WHERE id = $2",
            [
              `${existing.slug}-deleted-${existing.id}-${Date.now()}`,
              existing.id,
            ],
          );
        } else {
          return res.status(409).json({
            success: false,
            message: `A category with the slug "${slug}" already exists (Name: "${existing.name}"). Please choose a different name or slug.`,
            error: {
              code: "DUPLICATE_SLUG",
              field: "slug",
              message: `Category slug "${slug}" already exists.`,
            },
          });
        }
      }
    }

    const rawStageIds = req.body.stageIds ?? req.body.stage_ids;
    const stageIds = Array.isArray(rawStageIds)
      ? rawStageIds
          .filter((id) => typeof id === "number" || /^\d+$/.test(String(id)))
          .map(Number)
      : [];

    const level = parent ? (parent.level || 0) + 1 : 0;

    let testSeriesId = [];
    const testSeriesInput =
      req.body.testSeriesId ?? req.body.test_series_id ?? req.body.series_id;
    if (Array.isArray(testSeriesInput)) {
      testSeriesId = testSeriesInput
        .map(Number)
        .filter((n) => !isNaN(n) && n > 0);
    } else if (
      testSeriesInput !== null &&
      testSeriesInput !== undefined &&
      testSeriesInput !== ""
    ) {
      const numId = Number(testSeriesInput);
      if (!isNaN(numId) && numId > 0) {
        testSeriesId = [numId];
      }
    }

    const rawExamCatId = req.body.examCategoryId ?? req.body.exam_category_id;
    const examCategoryId =
      rawExamCatId && String(rawExamCatId).trim() !== ""
        ? String(rawExamCatId).trim()
        : null;

    const rawDisplayOrder = req.body.displayOrder ?? req.body.display_order;
    const displayOrder =
      rawDisplayOrder != null && !isNaN(Number(rawDisplayOrder))
        ? Number(rawDisplayOrder)
        : 0;

    const rawIsActive = req.body.isActive ?? req.body.is_active;
    const isActive = rawIsActive !== undefined ? Boolean(rawIsActive) : true;

    const newCategory = await dbHelpers.insertOne("testCategories", {
      name,
      slug,
      icon: req.body.icon || "",
      description: req.body.description || "",
      parentId: parentId || null,
      level,
      examCategoryId,
      stageIds,
      displayOrder,
      isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (testSeriesId.length > 0) {
      const categoryId = newCategory._id || newCategory.id;
      // Batch the junction inserts into one statement (was N round-trips).
      const placeholders = testSeriesId
        .map((_, i) => `($1, $${i + 2})`)
        .join(", ");
      await pool.query(
        `INSERT INTO test_category_series (test_category_id, test_series_id)
         VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        [categoryId, ...testSeriesId],
      );
    }

    await invalidateResponseCache("admin-test-categories");
    await invalidateResponseCache("test-categories");
    await invalidateResponseCache("test-categories-tree");

    res.status(201).json({ success: true, data: newCategory });
  }),
);

router.put(
  "/test-categories/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };

    if (updateData.slug) {
      updateData.slug = String(updateData.slug).trim();
      const existingSlug = await pool.query(
        "SELECT id, name, is_deleted FROM test_categories WHERE slug = $1 AND id != $2 LIMIT 1",
        [updateData.slug, id],
      );
      if (existingSlug.rows.length > 0) {
        const existing = existingSlug.rows[0];
        if (existing.is_deleted) {
          await pool.query(
            "UPDATE test_categories SET slug = $1 WHERE id = $2",
            [
              `${existing.slug}-deleted-${existing.id}-${Date.now()}`,
              existing.id,
            ],
          );
        } else {
          return res.status(409).json({
            success: false,
            message: `A category with the slug "${updateData.slug}" already exists (Name: "${existing.name}"). Please choose a different slug.`,
            error: {
              code: "DUPLICATE_SLUG",
              field: "slug",
              message: `Category slug "${updateData.slug}" already exists.`,
            },
          });
        }
      }
    }

    // Server-side circular reference check & level recomputation
    const requestedParentId =
      updateData.parentId !== undefined
        ? updateData.parentId
        : updateData.parent_id !== undefined
          ? updateData.parent_id
          : undefined;

    if (requestedParentId !== undefined) {
      const cleanParentId =
        requestedParentId === null ||
        requestedParentId === "" ||
        requestedParentId === "null"
          ? null
          : requestedParentId;

      if (cleanParentId !== null) {
        if (String(cleanParentId) === String(id)) {
          return res.status(400).json({
            success: false,
            message: "Cannot set a category as its own parent",
          });
        }

        const allCategories = await dbHelpers.find("testCategories", {
          includeInactive: true,
        });
        const collectDescendantIds = (parentId, visited = new Set()) => {
          const ids = new Set();
          if (visited.has(String(parentId))) return ids;
          visited.add(String(parentId));
          const children = allCategories.filter(
            (c) => String(c.parentId || c.parent_id) === String(parentId),
          );
          for (const child of children) {
            const cid = String(child._id || child.id);
            if (!visited.has(cid)) {
              ids.add(cid);
              for (const descId of collectDescendantIds(cid, visited)) {
                ids.add(String(descId));
              }
            }
          }
          return ids;
        };

        const descendantIds = collectDescendantIds(id);
        if (descendantIds.has(String(cleanParentId))) {
          return res.status(400).json({
            success: false,
            message:
              "Cannot set a descendant category as parent (circular reference)",
          });
        }

        const parent = allCategories.find(
          (c) => String(c._id || c.id) === String(cleanParentId),
        );
        if (!parent) {
          return res.status(400).json({
            success: false,
            message: "Parent category not found",
          });
        }

        updateData.parentId = cleanParentId;
        updateData.parent_id = cleanParentId;
        updateData.level = (parent.level || 0) + 1;
      } else {
        updateData.parentId = null;
        updateData.parent_id = null;
        updateData.level = 0;
      }
    }

    const rawExamCatId =
      updateData.examCategoryId !== undefined
        ? updateData.examCategoryId
        : updateData.exam_category_id !== undefined
          ? updateData.exam_category_id
          : undefined;

    if (rawExamCatId !== undefined) {
      const cleanExamCatId =
        rawExamCatId && String(rawExamCatId).trim() !== ""
          ? String(rawExamCatId).trim()
          : null;
      updateData.examCategoryId = cleanExamCatId;
      updateData.exam_category_id = cleanExamCatId;
    }

    const rawStageIds =
      updateData.stageIds !== undefined
        ? updateData.stageIds
        : updateData.stage_ids !== undefined
          ? updateData.stage_ids
          : undefined;

    if (rawStageIds !== undefined) {
      const stageIds = Array.isArray(rawStageIds)
        ? rawStageIds
            .filter((id) => typeof id === "number" || /^\d+$/.test(String(id)))
            .map(Number)
        : [];
      updateData.stageIds = stageIds;
      updateData.stage_ids = stageIds;
    }

    const rawDisplayOrder =
      updateData.displayOrder !== undefined
        ? updateData.displayOrder
        : updateData.display_order !== undefined
          ? updateData.display_order
          : undefined;

    if (rawDisplayOrder !== undefined) {
      const displayOrder =
        rawDisplayOrder != null && !isNaN(Number(rawDisplayOrder))
          ? Number(rawDisplayOrder)
          : 0;
      updateData.displayOrder = displayOrder;
      updateData.display_order = displayOrder;
    }

    const rawIsActive =
      updateData.isActive !== undefined
        ? updateData.isActive
        : updateData.is_active !== undefined
          ? updateData.is_active
          : undefined;

    if (rawIsActive !== undefined) {
      const isActive = Boolean(rawIsActive);
      updateData.isActive = isActive;
      updateData.is_active = isActive;
    }

    let testSeriesIdArray = null;
    const testSeriesInput =
      updateData.testSeriesId ??
      updateData.test_series_id ??
      updateData.series_id;

    if (Array.isArray(testSeriesInput)) {
      testSeriesIdArray = testSeriesInput
        .map(Number)
        .filter((n) => !isNaN(n) && n > 0);
    } else if (
      testSeriesInput !== undefined &&
      testSeriesInput !== null &&
      testSeriesInput !== ""
    ) {
      const numId = Number(testSeriesInput);
      if (!isNaN(numId) && numId > 0) {
        testSeriesIdArray = [numId];
      }
    }

    delete updateData.testSeriesId;
    delete updateData.test_series_id;
    delete updateData.series_id;

    const updated = await dbHelpers.updateById(
      "testCategories",
      id,
      updateData,
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    if (testSeriesIdArray !== null) {
      await pool.query(
        "DELETE FROM test_category_series WHERE test_category_id = $1",
        [id],
      );

      for (const seriesId of testSeriesIdArray) {
        await pool.query(
          "INSERT INTO test_category_series (test_category_id, test_series_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [id, seriesId],
        );
      }
    }

    await invalidateResponseCache("admin-test-categories");
    await invalidateResponseCache("test-categories");
    await invalidateResponseCache("test-categories-tree");

    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/test-categories/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id || null;

    const allCategories = await dbHelpers.find("testCategories", {
      includeInactive: true,
    });

    const collectDescendantIds = (parentId, visited = new Set()) => {
      const ids = [];
      if (visited.has(String(parentId))) return ids;
      visited.add(String(parentId));
      const children = allCategories.filter(
        (cat) => String(cat.parentId || cat.parent_id) === String(parentId),
      );
      for (const child of children) {
        const cid = child._id || child.id;
        if (!visited.has(String(cid))) {
          ids.push(cid);
          ids.push(...collectDescendantIds(cid, visited));
        }
      }
      return ids;
    };

    const descendantIds = collectDescendantIds(id);
    const allIdsToDelete = [id, ...descendantIds].map((x) =>
      typeof x === "number" || /^\d+$/.test(String(x)) ? Number(x) : x,
    );

    // Clean up junction rows so soft delete does not leave orphaned relations
    await pool.query(
      `DELETE FROM test_category_series WHERE test_category_id = ANY($1)`,
      [allIdsToDelete],
    );

    for (const childId of descendantIds) {
      await dbHelpers.softDelete("testCategories", childId, userId);
    }

    const targetId =
      typeof id === "number" || /^\d+$/.test(String(id)) ? Number(id) : id;
    const deleted = await dbHelpers.softDelete(
      "testCategories",
      targetId,
      userId,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    await invalidateResponseCache("admin-test-categories");
    await invalidateResponseCache("test-categories");
    await invalidateResponseCache("test-categories-tree");

    res.json({
      success: true,
      message: "Category and children moved to trash",
    });
  }),
);

router.get(
  "/test-categories/:id/path",
  asyncHandler(async (req, res) => {
    const categories = await dbHelpers.find("testCategories");
    const path = [];
    const visited = new Set();
    const targetId = req.params.id;

    let current = categories.find(
      (c) => String(c._id || c.id) === String(targetId),
    );
    while (current && path.length < 20) {
      const id = String(current._id || current.id);
      if (visited.has(id)) break;
      visited.add(id);
      path.unshift(current);
      current = current.parentId
        ? categories.find(
            (c) => String(c._id || c.id) === String(current.parentId),
          )
        : null;
    }

    res.json({ success: true, data: path });
  }),
);

// ===== EXAM CATEGORIES =====
router.get(
  "/exam-categories-list",
  asyncHandler(async (req, res) => {
    const categories = await dbHelpers.find("examCategories", {
      isActive: true,
    });
    const sortedCategories = categories.sort(
      (a, b) =>
        (a.display_order ?? a.displayOrder ?? a.order ?? 0) -
        (b.display_order ?? b.displayOrder ?? b.order ?? 0),
    );
    res.json({ success: true, data: sortedCategories });
  }),
);

router.get(
  "/exam-categories",
  asyncHandler(async (req, res) => {
    const categories = await dbHelpers.find("examCategories", {
      isActive: true,
    });
    const exams = await dbHelpers.find("exams", { isActive: true });

    const sortedCategories = categories.sort(
      (a, b) =>
        (a.display_order ?? a.displayOrder ?? a.order ?? 0) -
        (b.display_order ?? b.displayOrder ?? b.order ?? 0),
    );

    const categoriesWithExams = sortedCategories.map((category) => ({
      ...category,
      displayOrder: category.displayOrder ?? category.display_order ?? 0,
      exams: exams
        .filter(
          (exam) =>
            exam.categoryId === category.id ||
            exam.categoryId === category.categoryId ||
            exam.categoryId === category.category_id ||
            exam.categoryId === category.slug,
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

    res.json({ success: true, data: categoriesWithExams });
  }),
);

router.post(
  "/exam-categories",
  asyncHandler(async (req, res) => {
    const label = (req.body.label || req.body.name || "").trim();
    if (!label) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Category label or name is required",
        });
    }

    let categoryId = String(
      req.body.category_id ?? req.body.categoryId ?? req.body.id ?? "",
    ).trim();

    let slug = String(req.body.slug || "").trim();
    if (!slug && categoryId) {
      slug = categoryId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }
    if (!slug && label) {
      slug = label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    }
    if (!categoryId && slug) {
      categoryId = slug;
    }

    const existingCheck = await pool.query(
      "SELECT id, label, slug, category_id, is_deleted FROM exam_categories WHERE (slug = $1 OR category_id = $2) AND (is_deleted = false OR is_deleted IS NULL) LIMIT 1",
      [slug, categoryId],
    );
    if (existingCheck.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `An exam category with slug "${slug}" or categoryId "${categoryId}" already exists.`,
        error: { code: "DUPLICATE_SLUG", field: "slug" },
      });
    }

    const rawDisplayOrder = req.body.display_order ?? req.body.displayOrder;
    const displayOrder =
      rawDisplayOrder != null && !isNaN(Number(rawDisplayOrder))
        ? Number(rawDisplayOrder)
        : 0;

    const rawIsActive = req.body.is_active ?? req.body.isActive;
    const isActive = rawIsActive !== undefined ? Boolean(rawIsActive) : true;

    const newCategory = await dbHelpers.insertOne("examCategories", {
      category_id: categoryId,
      categoryId,
      label,
      name: label,
      slug,
      icon: req.body.icon || "",
      description: req.body.description || "",
      display_order: displayOrder,
      displayOrder,
      order: displayOrder,
      is_active: isActive,
      isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await invalidateResponseCache("exam-categories");

    res.status(201).json({ success: true, data: newCategory });
  }),
);

router.put(
  "/exam-categories/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = { ...req.body, updatedAt: new Date().toISOString() };

    const label = (updateData.label || updateData.name || "").trim();
    if (label) {
      updateData.label = label;
      updateData.name = label;
    }

    if (updateData.slug || updateData.category_id || updateData.categoryId) {
      const slug = (updateData.slug || "").trim();
      const catId = (
        updateData.category_id ||
        updateData.categoryId ||
        ""
      ).trim();
      if (slug || catId) {
        const existingSlug = await pool.query(
          "SELECT id, label, slug, category_id, is_deleted FROM exam_categories WHERE (slug = $1 OR category_id = $2) AND id != $3 LIMIT 1",
          [slug || "", catId || "", id],
        );
        if (existingSlug.rows.length > 0) {
          return res.status(409).json({
            success: false,
            message:
              "An exam category with this slug or categoryId already exists.",
            error: { code: "DUPLICATE_SLUG", field: "slug" },
          });
        }
      }
    }

    const rawDisplayOrder = updateData.display_order ?? updateData.displayOrder;
    if (rawDisplayOrder !== undefined) {
      const displayOrder = Number(rawDisplayOrder) || 0;
      updateData.display_order = displayOrder;
      updateData.displayOrder = displayOrder;
      updateData.order = displayOrder;
    }

    const rawIsActive = updateData.is_active ?? updateData.isActive;
    if (rawIsActive !== undefined) {
      const isActive = Boolean(rawIsActive);
      updateData.is_active = isActive;
      updateData.isActive = isActive;
    }

    const updated = await dbHelpers.updateById(
      "examCategories",
      id,
      updateData,
    );

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    await invalidateResponseCache("exam-categories");

    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/exam-categories/:id",
  asyncHandler(async (req, res) => {
    const categoryId = req.params.id;

    try {
      const targetCat = await dbHelpers.findById("examCategories", categoryId);
      const catSlug =
        targetCat?.slug ||
        targetCat?.category_id ||
        targetCat?.categoryId ||
        categoryId;

      await pool.query(
        `UPDATE test_series SET _orphaned_exam_category_id = $1, _orphaned_at = NOW(), is_active = false
         WHERE (exam_category_id = $1 OR category = $2 OR category = $3) AND is_active = true`,
        [Number(categoryId) || 0, String(catSlug), String(categoryId)],
      );
      logger.info(
        `[Cascade] Flagged test series as orphaned from exam category ${categoryId}`,
      );
    } catch (err) {
      logger.warn(
        `[Cascade] Warning: Could not flag orphaned test series for exam category ${categoryId}:`,
        err,
      );
    }

    const deleted = await dbHelpers.softDelete(
      "examCategories",
      req.params.id,
      req.user?.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    await invalidateResponseCache("exam-categories");

    res.json({ success: true, message: "Category moved to trash" });
  }),
);

export default router;
