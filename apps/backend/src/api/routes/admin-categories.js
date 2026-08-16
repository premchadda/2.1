import express from 'express';
import { dbHelpers, pool } from '../../infrastructure/database/postgres-helpers.js';
import { protect, admin, superAdmin } from '../../middleware/auth.middleware.js';
import logger from '../../infrastructure/logger/logger.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { responseCache } from '../../middleware/responseCache.middleware.js';

const router = express.Router();

router.use(protect)
router.use(admin)

// ===== TEST CATEGORIES MANAGEMENT (Hierarchical) =====
router.get('/test-categories', responseCache("admin-test-categories", 60), asyncHandler(async (req, res) => {
  const { parentId } = req.query;
  const query = { isActive: true };

  if (parentId !== undefined) {
    query.parentId = parentId === 'null' || parentId === '' ? null : parentId;
  }

  const categories = await dbHelpers.find('testCategories', query);

  if (categories.length > 0) {
    const ids = categories.map((c) => c._id || c.id);
    const catTable = dbHelpers.getTableName('testCategories');
    const countRes = await pool.query(
      `SELECT parent_id, COUNT(*) as count FROM "${catTable}" WHERE parent_id = ANY($1) AND is_active = true GROUP BY parent_id`,
      [ids],
    );

    const countsMap = {};
    countRes.rows.forEach((row) => {
      countsMap[row.parent_id] = parseInt(row.count);
    });

    const relationsRes = await pool.query(
      `SELECT test_category_id, test_series_id FROM test_category_series WHERE test_category_id = ANY($1)`,
      [ids]
    );

    const relationsMap = {};
    relationsRes.rows.forEach(row => {
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
}));

router.post('/test-categories', asyncHandler(async (req, res) => {
  const { parentId } = req.body;

  if (parentId) {
    const parent = await dbHelpers.findById('testCategories', parentId);
    if (!parent) {
      return res
        .status(400)
        .json({ success: false, message: 'Parent category not found' });
    }
  }

  const stageIds = Array.isArray(req.body.stageIds)
    ? req.body.stageIds
        .filter((id) => typeof id === 'number' || /^\d+$/.test(String(id)))
        .map(Number)
    : [];

  const allCategories = parentId
    ? await dbHelpers.find('testCategories')
    : [];
  const level = parentId
    ? (() => {
        const parent = allCategories.find(
          (c) => String(c._id || c.id) === String(parentId),
        );
        return parent ? (parent.level || 0) + 1 : 0;
      })()
    : 0;

  let testSeriesId = [];
  const testSeriesInput = req.body.testSeriesId ?? req.body.test_series_id ?? req.body.series_id;
  if (Array.isArray(testSeriesInput)) {
    testSeriesId = testSeriesInput.map(Number).filter(n => !isNaN(n) && n > 0);
  } else if (testSeriesInput !== null && testSeriesInput !== undefined && testSeriesInput !== '') {
    const numId = Number(testSeriesInput);
    if (!isNaN(numId) && numId > 0) {
      testSeriesId = [numId];
    }
  }

  const newCategory = await dbHelpers.insertOne('testCategories', {
    name: req.body.name,
    slug: req.body.slug,
    icon: req.body.icon || '',
    description: req.body.description || '',
    parentId: parentId || null,
    level,
    examCategoryId: req.body.examCategoryId || null,
    stageIds,
    displayOrder: req.body.displayOrder ?? 0,
    isActive: req.body.isActive !== undefined ? req.body.isActive : true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (testSeriesId.length > 0) {
    const categoryId = newCategory._id || newCategory.id;
    for (const seriesId of testSeriesId) {
      await pool.query(
        'INSERT INTO test_category_series (test_category_id, test_series_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [categoryId, seriesId]
      );
    }
  }

  res.status(201).json({ success: true, data: newCategory });
}));

router.put('/test-categories/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = { ...req.body, updatedAt: new Date().toISOString() };
  
  let testSeriesIdArray = null;
  const testSeriesInput = updateData.testSeriesId ?? updateData.test_series_id ?? updateData.series_id;
  
  if (Array.isArray(testSeriesInput)) {
    testSeriesIdArray = testSeriesInput.map(Number).filter(n => !isNaN(n) && n > 0);
  } else if (testSeriesInput !== undefined && testSeriesInput !== null && testSeriesInput !== '') {
    const numId = Number(testSeriesInput);
    if (!isNaN(numId) && numId > 0) {
      testSeriesIdArray = [numId];
    }
  }

  delete updateData.testSeriesId;
  delete updateData.test_series_id;
  delete updateData.series_id;

  const updated = await dbHelpers.updateById(
    'testCategories',
    id,
    updateData,
  );

  if (!updated) {
    return res
      .status(404)
      .json({ success: false, message: 'Category not found' });
  }

  if (testSeriesIdArray !== null) {
    await pool.query('DELETE FROM test_category_series WHERE test_category_id = $1', [id]);
    
    for (const seriesId of testSeriesIdArray) {
      await pool.query(
        'INSERT INTO test_category_series (test_category_id, test_series_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [id, seriesId]
      );
    }
  }

  res.json({ success: true, data: updated });
}));

router.delete('/test-categories/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id || null;

  const allCategories = await dbHelpers.find('testCategories');

  const collectDescendantIds = (parentId) => {
    const ids = [];
    const children = allCategories.filter(
      (cat) => String(cat.parentId) === String(parentId),
    );
    for (const child of children) {
      ids.push(child._id || child.id);
      ids.push(...collectDescendantIds(child._id || child.id));
    }
    return ids;
  };

  const descendantIds = collectDescendantIds(id);

  for (const childId of descendantIds) {
    await dbHelpers.softDelete('testCategories', childId, userId);
  }

  const deleted = await dbHelpers.softDelete('testCategories', id, userId);
  if (!deleted) {
    return res
      .status(404)
      .json({ success: false, message: 'Category not found' });
  }
  res.json({
    success: true,
    message: 'Category and children moved to trash',
  });
}));

router.get('/test-categories/:id/path', asyncHandler(async (req, res) => {
  const categories = await dbHelpers.find('testCategories');
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
}));

// ===== EXAM CATEGORIES =====
router.get('/exam-categories-list', asyncHandler(async (req, res) => {
  const categories = await dbHelpers.find('examCategories', {
    isActive: true,
  });
  const sortedCategories = categories.sort(
    (a, b) => (a.order || 0) - (b.order || 0),
  );
  res.json({ success: true, data: sortedCategories });
}));

router.get('/exam-categories', asyncHandler(async (req, res) => {
  const categories = await dbHelpers.find('examCategories', {
    isActive: true,
  });
  const exams = await dbHelpers.find('exams', { isActive: true });

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

  res.json({ success: true, data: categoriesWithExams });
}));

router.post('/exam-categories', asyncHandler(async (req, res) => {
  const newCategory = await dbHelpers.insertOne('examCategories', req.body);
  res.status(201).json({ success: true, data: newCategory });
}));

router.put('/exam-categories/:id', asyncHandler(async (req, res) => {
  const updated = await dbHelpers.updateById(
    'examCategories',
    req.params.id,
    req.body,
  );

  if (!updated) {
    return res
      .status(404)
      .json({ success: false, message: 'Category not found' });
  }
  res.json({ success: true, data: updated });
}));

router.delete('/exam-categories/:id', asyncHandler(async (req, res) => {
  const categoryId = req.params.id;
  
  try {
    const allSeries = await dbHelpers.find('testSeries', {
      category: categoryId,
      isActive: true,
    });
    if (allSeries.length > 0) {
      for (const series of allSeries) {
        await dbHelpers.updateById('testSeries', series.id, {
          _orphanedExamCategoryId: categoryId,
          _orphanedAt: new Date().toISOString(),
        });
      }
      logger.info(
        `[Cascade] Flagged ${allSeries.length} test series as orphaned from exam category ${categoryId}`,
      );
    }
  } catch (err) {
    logger.warn(
      `[Cascade] Warning: Could not flag orphaned test series for exam category ${categoryId}:`,
      err,
    );
  }

  const deleted = await dbHelpers.softDelete(
    'examCategories',
    req.params.id,
    req.user.id,
  );
  if (!deleted) {
    return res
      .status(404)
      .json({ success: false, message: 'Category not found' });
  }
  res.json({ success: true, message: 'Category moved to trash' });
}));

export default router;
