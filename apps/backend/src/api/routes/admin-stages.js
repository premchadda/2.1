import express from 'express';
import { dbHelpers, pool } from '../../infrastructure/database/postgres-helpers.js';
import Stage from '../../data/models/Stage.js';
import { protect, admin, superAdmin } from '../../middleware/auth.middleware.js';
import { responseCache } from '../../middleware/responseCache.middleware.js';
import logger from '../../infrastructure/logger/logger.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';

const router = express.Router();

router.use(protect)
router.use(admin)

router.get('/stages', responseCache('admin-stages-list', 120), asyncHandler(async (req, res) => {
  const stages = await dbHelpers.find('stages');
  res.json({ success: true, data: stages });
}));

router.get('/stages/with-test-counts', responseCache('admin-stages-counts', 120), asyncHandler(async (req, res) => {
  const stages = await dbHelpers.find('stages');
  const categories = await dbHelpers.find('testCategories', {
    isActive: true,
  });
  const tests = await dbHelpers.find('tests', { isActive: true });
  const testSeries = await dbHelpers.find('testSeries', { isActive: true });

  const stagesWithCounts = stages.map((stage) => {
    const agg = Stage.getAggregatesForStage(stage, {
      categories,
      tests,
      testSeries,
    });
    return {
      ...stage,
      categoryCount: agg.categoryCount,
      seriesCount: agg.seriesCount,
      testCount: agg.testCount,
    };
  });

  res.json({ success: true, data: stagesWithCounts });
}));

router.get('/stages/:id/details', asyncHandler(async (req, res) => {
  const stage = await dbHelpers.findById('stages', req.params.id);
  if (!stage) {
    return res
      .status(404)
      .json({ success: false, message: 'Stage not found' });
  }

  const categories = await dbHelpers.find('testCategories', {
    isActive: true,
  });
  const tests = await dbHelpers.find('tests', { isActive: true });
  const testSeries = await dbHelpers.find('testSeries', { isActive: true });
  const exams = await dbHelpers.find('exams', { isActive: true });

  const agg = Stage.getAggregatesForStage(stage, {
    categories,
    tests,
    testSeries,
  });

  const examRefs = Stage.coerceIdArray(stage.examIds);
  const linkedExams = exams
    .filter((exam) =>
      examRefs.some(
        (ref) =>
          Stage.idEquals(ref, exam.id) || Stage.idEquals(ref, exam.examId),
      ),
    )
    .map((e) => ({ id: e._id || e.id, name: e.title || e.name }));

  const linkedCategories = agg.linkedCategories.map((c) => ({
    id: c._id || c.id,
    name: c.name,
  }));
  const linkedSeries = agg.linkedSeries.map((s) => ({
    id: s._id || s.id,
    name: s.title || s.name,
  }));

  const catNameMap = {};
  categories.forEach((c) => {
    const cid = c._id ?? c.id;
    if (cid != null) catNameMap[String(cid)] = c.name;
    if (c.slug) catNameMap[c.slug] = c.name;
  });

  const testsByCategory = agg.linkedTests.reduce((acc, test) => {
    const catId = test.categoryId ?? test.category;
    const catName =
      (catId && catNameMap[String(catId)]) || catId || 'Uncategorized';
    acc[catName] = (acc[catName] || 0) + 1;
    return acc;
  }, {});

  res.json({
    success: true,
    data: {
      stage,
      linkedExams,
      linkedCategories,
      linkedSeries,
      tests: {
        total: agg.testCount,
        byCategory: testsByCategory,
      },
    },
  });
}));

router.post('/stages', asyncHandler(async (req, res) => {
  const { name, slug, description, icon, order, examIds, categoryIds, isActive } =
    req.body;

  if (!name || !slug) {
    return res
      .status(400)
      .json({ success: false, message: 'Name and slug are required' });
  }

  const newStage = await dbHelpers.insertOne('stages', {
    name,
    slug,
    description: description || '',
    icon: icon || '',
    order: order || 0,
    examIds: examIds || [],
    categoryIds: categoryIds || [],
    isActive: isActive !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  res.status(201).json({ success: true, data: newStage });
}));

router.put('/stages/:id', asyncHandler(async (req, res) => {
  const updated = await dbHelpers.updateById('stages', req.params.id, {
    ...req.body,
    updatedAt: new Date().toISOString(),
  });

  if (!updated) {
    return res
      .status(404)
      .json({ success: false, message: 'Stage not found' });
  }

  res.json({ success: true, data: updated });
}));

router.delete('/stages/:id', asyncHandler(async (req, res) => {
  const stageId = req.params.id;
  const stage = await dbHelpers.findById('stages', stageId);
  const stageName = stage?.name;

  const testsByStage = await dbHelpers.find('tests', { stageId });
  if (testsByStage.length > 0) {
    return res.status(400).json({
      success: false,
      message: `${testsByStage.length} test(s) are linked to this stage by stageId. Please reassign or delete those tests first.`,
    });
  }

  if (stageName) {
    const testsByTier = await dbHelpers.find('tests', { tier: stageName });
    if (testsByTier.length > 0) {
      return res.status(400).json({
        success: false,
        message: `${testsByTier.length} test(s) are linked to this stage by legacy tier name "${stageName}". Please reassign or delete those tests first.`,
      });
    }
  }

  const deleted = await dbHelpers.softDelete('stages', stageId, req.user.id);
  if (!deleted) {
    return res
      .status(404)
      .json({ success: false, message: 'Stage not found' });
  }
  res.json({ success: true, message: 'Stage moved to trash' });
}));

router.put('/stages/:id/categories', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { categoryIds, operation = 'replace' } = req.body;

  const stage = await dbHelpers.findById('stages', id);
  if (!stage) {
    return res.status(404).json({ success: false, message: 'Stage not found' });
  }

  const existingCategoryIds = Array.isArray(stage.categoryIds) ? stage.categoryIds : [];

  let newCategoryIds;
  switch (operation) {
    case 'add':
      newCategoryIds = [...new Set([...existingCategoryIds, ...(categoryIds || [])])];
      break;
    case 'remove':
      newCategoryIds = existingCategoryIds.filter((c) => !(categoryIds || []).includes(c));
      break;
    case 'replace':
    default:
      newCategoryIds = categoryIds || [];
      break;
  }

  const updated = await dbHelpers.updateById('stages', id, {
    categoryIds: newCategoryIds,
    updatedAt: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: `Stage categories ${operation}ed`,
    data: { ...updated, categoryIds: newCategoryIds },
  });
}));

export default router;
