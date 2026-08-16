import express from "express";
import { dbHelpers, pool } from "../../infrastructure/database/postgres-helpers.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import logger from "../../infrastructure/logger/logger.js";
import { protect, admin, superAdmin } from '../../middleware/auth.middleware.js';
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';
import { responseCache } from '../../middleware/responseCache.middleware.js';
import { clearCache } from '../../infrastructure/cache/cacheService.js';

const router = express.Router();

router.use(protect)
router.use(admin)

// FIELD-WHITELIST: Prevent mass-assignment / prototype pollution
// NOTE: `orderIndex` is accepted as an alias for `order` because the GET
// endpoint returns `order_index as "orderIndex"` and the frontend sends
// `orderIndex` back on reorder. Without this alias, the field is silently
// stripped and reordering silently fails.
const ALLOWED_FIELDS = {
  studyMaterials: ['title', 'description', 'icon', 'slug', 'isActive', 'order', 'orderIndex', 'name', 'nameHi', 'descriptionHi', 'color', 'examCategory'],
  subjects: ['name', 'slug', 'icon', 'color', 'description', 'parentId', 'subjectGroup', 'isActive', 'order', 'orderIndex', 'sortOrder'],
  units: ['name', 'subjectId', 'order', 'orderIndex', 'isActive'],
  chapters: ['title', 'description', 'icon', 'studyMaterialId', 'unitId', 'order', 'orderIndex', 'isActive', 'name', 'nameHi', 'descriptionHi'],
  topics: ['name', 'description', 'icon', 'chapterId', 'order', 'orderIndex', 'isActive', 'nameHi', 'descriptionHi'],
  subtopics: ['name', 'topicId', 'order', 'orderIndex', 'isActive'],
};

// Alias map: frontend field name → DB column name
const FIELD_ALIASES = {
  orderIndex: 'order',
  sortOrder: 'sort_order',
};

// Query-param filters honored by the generic GET handler
// (camelCase request param → DB column name)
const COLLECTION_FILTERS = {
  studyMaterials: { examCategory: 'exam_category' },
  subjects: { examCategory: 'exam_category' },
  units: { subjectId: 'subject_id' },
  chapters: { studyMaterialId: 'study_material_id', unitId: 'unit_id', subjectId: 'subject_id' },
  topics: { chapterId: 'chapter_id', subjectId: 'subject_id' },
  subtopics: { topicId: 'topic_id' },
};

// Stable ordering per collection (order column must exist on the live table)
const COLLECTION_ORDER = {
  studyMaterials: '"order" ASC, id ASC',
  subjects: '"order" ASC, id ASC',
  units: 'order_index ASC, id ASC',
  chapters: 'order_index ASC, id ASC',
  topics: 'order_index ASC, id ASC',
  subtopics: 'order_index ASC, id ASC',
};

function sanitizeBody(body, allowedFields) {
  const sanitized = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      let val = body[field];
      const isFkField = field === 'subjectId' || field === 'unitId' || field === 'chapterId' || field === 'topicId' || field === 'parentId';
      if (isFkField && val !== null) {
        if (val === '' || (typeof val === 'string' && (val.startsWith('subj_') || val.startsWith('unit_')))) {
          val = null;
        } else if (!isNaN(val)) {
          val = parseInt(val, 10);
        }
      }
      // Map aliased fields to their DB column name
      const dbField = FIELD_ALIASES[field] || field;
      sanitized[dbField] = val;
    }
  }
  return sanitized;
}

// ==========================================
// Curriculum Hierarchy Admin CRUD Generate
// ==========================================
const curriculumCrudRoutes = [
  { path: "subjects", collection: "subjects" },
  { path: "units", collection: "units" },
  { path: "chapters", collection: "chapters" },
  { path: "topics", collection: "topics" },
  { path: "subtopics", collection: "subtopics" },
];

curriculumCrudRoutes.forEach(({ path, collection }) => {
  router.get(`/${path}`, responseCache("curriculum", 60), async (req, res) => {
    try {
      const table = dbHelpers.tableMap[collection] || collection;

      // Dynamic column selection to avoid 10MB+ payload transfers and V8 CPU stalling
      // We map the exact DB columns to camelCase aliases matching the frontend components
      // Also map public_id to 'id' if it exists to match dbHelpers.toApi() formatting perfectly
      let cols = 'slug, is_active as "isActive"';
      switch (collection) {
        case "studyMaterials":
          cols +=
            ', public_id as "id", id as "_id", title, description, icon, "order" as "orderIndex"';
          break;
        case "subjects":
          cols +=
            ', id, id as "_id", name, name as "title", icon, color, description, parent_id as "parentId", subject_group as "subjectGroup", sort_order as "sortOrder", "order" as "order", "order" as "orderIndex"';
          break;
        case "subjectParts":
          cols +=
            ', id, id as "_id", name, subject_id as "subjectId", order_index as "orderIndex"';
          break;
        case "units":
          cols +=
            ', id, id as "_id", name, subject_id as "subjectId", order_index as "orderIndex"';
          break;
        case "chapters":
          cols +=
            ', public_id as "id", id as "_id", title, description, icon, study_material_id as "studyMaterialId", unit_id as "unitId", subject_id as "subjectId", order_index as "orderIndex"';
          break;
        case "topics":
          cols +=
            ', public_id as "id", id as "_id", name, description, icon, chapter_id as "chapterId", subject_id as "subjectId", order_index as "orderIndex"';
          break;
        case "subtopics":
          cols +=
            ', public_id as "id", id as "_id", name, topic_id as "topicId", order_index as "orderIndex"';
          break;
      }

      const filterMap = COLLECTION_FILTERS[collection] || {};
      const conditions = ['(is_deleted = false OR is_deleted IS NULL)'];
      const params = [];
      for (const [paramKey, snakeCol] of Object.entries(filterMap)) {
        const raw = req.query[paramKey];
        if (raw === undefined || raw === null || raw === '') continue;
        // Column may be absent on some schemas (e.g. exam_category) — degrade
        // to an unfiltered query instead of 500ing
        if (!(await dbHelpers.columnExists(table, snakeCol))) continue;
        if (snakeCol.endsWith('_id')) {
          if (isNaN(raw)) continue;
          params.push(parseInt(raw, 10));
        } else {
          params.push(raw);
        }
        conditions.push(`"${snakeCol}" = $${params.length}`);
      }

      const orderBy = COLLECTION_ORDER[collection] || 'id ASC';
      const sql = `SELECT ${cols} FROM ${table} WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy}`;
      const result = await pool.query(sql, params);
      res.json({ success: true, count: result.rows.length, data: result.rows });
    } catch (error) {
      // Safe Fallback
      logger.error(`Error in Curriculum fast GET for ${path}:`, error.message);
      try {
        const fallbackItems = await dbHelpers.find(collection, {
          isActive: true,
        });
        res.json({
          success: true,
          count: fallbackItems.length,
          data: fallbackItems,
        });
      } catch (err) {
        res.status(500).json({ success: false, message: sanitizeErrorMessage(err) });
      }
    }
  });

  router.post(`/${path}`, asyncHandler(async (req, res) => {
    const allowed = ALLOWED_FIELDS[collection];
    const sanitized = allowed ? sanitizeBody(req.body, allowed) : req.body;
    const item = await dbHelpers.insertOne(collection, sanitized);
    await clearCache("curriculum").catch(() => {});
    res.status(201).json({ success: true, data: item });
  }));

  router.put(`/${path}/:id`, asyncHandler(async (req, res) => {
    const allowed = ALLOWED_FIELDS[collection];
    const sanitized = allowed ? sanitizeBody(req.body, allowed) : req.body;
    const item = await dbHelpers.updateById(
      collection,
      req.params.id,
      sanitized,
    );
    if (!item)
      return res.status(404).json({ success: false, message: "Not found" });
    await clearCache("curriculum").catch(() => {});
    res.json({ success: true, data: item });
  }));

  router.delete(`/${path}/:id`, asyncHandler(async (req, res) => {
    const deleted = await dbHelpers.softDelete(
      collection,
      req.params.id,
      req.user.id,
    );
    if (!deleted)
      return res.status(404).json({ success: false, message: "Not found" });
    await clearCache("curriculum").catch(() => {});
    res.json({ success: true, message: "Deleted" });
  }));
});

export default router;
