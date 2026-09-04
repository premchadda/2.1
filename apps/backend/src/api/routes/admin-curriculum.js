import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import {
  protect,
  admin,
  superAdmin,
} from "../../middleware/auth.middleware.js";
import logger from "../../infrastructure/logger/logger.js";

const router = express.Router();

router.use(protect);
router.use(admin);

let curriculumSchemaEnsured = false;
const ensureCurriculumSchema = async (req, res, next) => {
  if (curriculumSchemaEnsured) return next();
  try {
    await dbHelpers.pool
      .query(
        `
      CREATE TABLE IF NOT EXISTS subject_parts (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        slug VARCHAR(200),
        description TEXT,
        icon VARCHAR(100),
        subject_id INTEGER REFERENCES study_materials(id) ON DELETE SET NULL,
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `,
      )
      .catch(() => {});
    curriculumSchemaEnsured = true;
    next();
  } catch (error) {
    logger.error("[Curriculum] Schema ensure error:", error);
    next();
  }
};
router.use(ensureCurriculumSchema);

// ===== CURRICULUM ORPHAN DETECTION (ISSUE CU-03) =====
router.get(
  "/curriculum/orphans",
  asyncHandler(async (req, res) => {
    const [subjects, parts, units, chapters, topics, subtopics] =
      await Promise.all([
        dbHelpers.find("studyMaterials", { isActive: true }),
        dbHelpers.find("subjectParts", { isActive: true }),
        dbHelpers.find("units", { isActive: true }),
        dbHelpers.find("chapters", { isActive: true }),
        dbHelpers.find("topics", { isActive: true }),
        dbHelpers.find("subtopics", { isActive: true }),
      ]);

    const subjectIds = new Set(subjects.map((s) => String(s.id || s._id)));
    const partIds = new Set(parts.map((p) => String(p.id || p._id)));
    const unitIds = new Set(units.map((u) => String(u.id || u._id)));
    const chapterIds = new Set(chapters.map((c) => String(c.id || c._id)));
    const topicIds = new Set(topics.map((t) => String(t.id || t._id)));

    const orphans = {
      parts: [],
      units: [],
      chapters: [],
      topics: [],
      subtopics: [],
    };

    // Orphaned parts: subjectId doesn't exist
    parts.forEach((part) => {
      const subjectId = String(part.subjectId || part.subject_id || "");
      if (subjectId && !subjectIds.has(subjectId)) {
        orphans.parts.push({
          id: part.id || part._id,
          name: part.name || part.title,
          orphanedReason: `Parent subject (ID: ${subjectId}) not found`,
          subjectId,
        });
      }
    });

    // Orphaned units: partId doesn't exist
    units.forEach((unit) => {
      const partId = String(unit.partId || unit.part_id || "");
      if (partId && !partIds.has(partId)) {
        orphans.units.push({
          id: unit.id || unit._id,
          name: unit.name || unit.title,
          orphanedReason: `Parent part (ID: ${partId}) not found`,
          partId,
        });
      }
    });

    // Orphaned chapters: studyMaterialId or unitId doesn't exist
    chapters.forEach((chapter) => {
      const studyMaterialId = String(
        chapter.studyMaterialId || chapter.study_material_id || "",
      );
      const unitId = String(chapter.unitId || chapter.unit_id || "");
      let orphanedReason = null;

      if (studyMaterialId && !subjectIds.has(studyMaterialId)) {
        orphanedReason = `Parent subject/studyMaterial (ID: ${studyMaterialId}) not found`;
      } else if (unitId && !unitIds.has(unitId)) {
        orphanedReason = `Parent unit (ID: ${unitId}) not found`;
      }

      if (orphanedReason) {
        orphans.chapters.push({
          id: chapter.id || chapter._id,
          title: chapter.title || chapter.name,
          orphanedReason,
          studyMaterialId,
          unitId,
        });
      }
    });

    // Orphaned topics: chapterId doesn't exist
    topics.forEach((topic) => {
      const chapterId = String(topic.chapterId || topic.chapter_id || "");
      if (chapterId && !chapterIds.has(chapterId)) {
        orphans.topics.push({
          id: topic.id || topic._id,
          name: topic.name || topic.title,
          orphanedReason: `Parent chapter (ID: ${chapterId}) not found`,
          chapterId,
        });
      }
    });

    // Orphaned subtopics: topicId doesn't exist
    subtopics.forEach((subtopic) => {
      const topicId = String(subtopic.topicId || subtopic.topic_id || "");
      if (topicId && !topicIds.has(topicId)) {
        orphans.subtopics.push({
          id: subtopic.id || subtopic._id,
          name: subtopic.name || subtopic.title,
          orphanedReason: `Parent topic (ID: ${topicId}) not found`,
          topicId,
        });
      }
    });

    const totalOrphans = Object.values(orphans).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );

    res.json({
      success: true,
      data: {
        orphans,
        summary: {
          totalOrphans,
          orphanedParts: orphans.parts.length,
          orphanedUnits: orphans.units.length,
          orphanedChapters: orphans.chapters.length,
          orphanedTopics: orphans.topics.length,
          orphanedSubtopics: orphans.subtopics.length,
        },
      },
    });
  }),
);

// ===== TOPICS MANAGEMENT =====
router.post(
  "/topics",
  asyncHandler(async (req, res) => {
    const {
      name,
      title,
      slug,
      chapterId,
      chapter_id,
      orderIndex,
      order,
      isActive,
      is_active,
    } = req.body;
    const topicName = (name || title || "").trim();
    if (!topicName) {
      return res
        .status(400)
        .json({ success: false, message: "Topic name is required" });
    }
    const chId = chapterId || chapter_id;
    const topicSlug = (
      slug ||
      topicName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    ).trim();
    const payload = {
      name: topicName,
      slug: topicSlug,
      chapter_id: chId ? Number(chId) || chId : null,
      order_index: Number(orderIndex ?? order ?? 0),
      is_active: isActive ?? is_active ?? true,
      created_at: new Date().toISOString(),
    };
    const newTopic = await dbHelpers.insertOne("topics", payload);
    res.status(201).json({ success: true, data: newTopic });
  }),
);

router.put(
  "/topics/:id",
  asyncHandler(async (req, res) => {
    const {
      name,
      title,
      slug,
      chapterId,
      chapter_id,
      orderIndex,
      order,
      isActive,
      is_active,
    } = req.body;
    const payload = {};
    if (name !== undefined || title !== undefined)
      payload.name = (name || title || "").trim();
    if (slug !== undefined) payload.slug = slug.trim();
    if (chapterId !== undefined || chapter_id !== undefined) {
      const chId = chapterId || chapter_id;
      payload.chapter_id = chId ? Number(chId) || chId : null;
    }
    if (orderIndex !== undefined || order !== undefined)
      payload.order_index = Number(orderIndex ?? order ?? 0);
    if (isActive !== undefined || is_active !== undefined)
      payload.is_active = Boolean(isActive ?? is_active);
    payload.updated_at = new Date().toISOString();

    const updated = await dbHelpers.updateById(
      "topics",
      req.params.id,
      payload,
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Topic not found" });
    }
    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/topics/:id",
  asyncHandler(async (req, res) => {
    const deleted = await dbHelpers.softDelete(
      "topics",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Topic not found" });
    }
    res.json({ success: true, message: "Topic moved to trash" });
  }),
);

// ===== SUBJECTS MANAGEMENT =====
router.get(
  "/subjects",
  asyncHandler(async (req, res) => {
    const subjects = await dbHelpers.find("subjects", { isActive: true });
    res.json({ success: true, data: subjects });
  }),
);

router.post(
  "/subjects",
  asyncHandler(async (req, res) => {
    const newSubject = await dbHelpers.insertOne("subjects", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newSubject });
  }),
);

router.put(
  "/subjects/:id",
  asyncHandler(async (req, res) => {
    const updated = await dbHelpers.updateById("subjects", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/subjects/:id",
  asyncHandler(async (req, res) => {
    const deleted = await dbHelpers.softDelete(
      "subjects",
      req.params.id,
      req.user.id,
    );
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    res.json({ success: true, message: "Subject moved to trash" });
  }),
);

// ===== SUBJECT PARTS MANAGEMENT =====
router.get(
  "/subject-parts",
  asyncHandler(async (req, res) => {
    try {
      const parts = await dbHelpers.find("subjectParts", { isActive: true });
      res.json({ success: true, data: parts || [] });
    } catch (err) {
      logger.warn(
        "[Curriculum] subject_parts table query failed, returning empty list:",
        err.message,
      );
      res.json({ success: true, data: [] });
    }
  }),
);

router.post(
  "/subject-parts",
  asyncHandler(async (req, res) => {
    try {
      const newPart = await dbHelpers.insertOne("subjectParts", {
        ...req.body,
        createdAt: new Date().toISOString(),
      });
      res.status(201).json({ success: true, data: newPart });
    } catch (err) {
      logger.error("[Curriculum] Error creating subject part:", err.message);
      res
        .status(500)
        .json({ success: false, message: "Subject parts storage unavailable" });
    }
  }),
);

router.put(
  "/subject-parts/:id",
  asyncHandler(async (req, res) => {
    try {
      const updated = await dbHelpers.updateById(
        "subjectParts",
        req.params.id,
        {
          ...req.body,
          updatedAt: new Date().toISOString(),
        },
      );
      if (!updated)
        return res
          .status(404)
          .json({ success: false, message: "Part not found" });
      res.json({ success: true, data: updated });
    } catch (err) {
      logger.error("[Curriculum] Error updating subject part:", err.message);
      res
        .status(500)
        .json({ success: false, message: "Subject parts storage unavailable" });
    }
  }),
);

router.delete(
  "/subject-parts/:id",
  asyncHandler(async (req, res) => {
    try {
      const deleted = await dbHelpers.softDelete(
        "subjectParts",
        req.params.id,
        req.user.id,
      );
      if (!deleted)
        return res
          .status(404)
          .json({ success: false, message: "Part not found" });
      res.json({ success: true, message: "Part moved to trash" });
    } catch (err) {
      logger.error("[Curriculum] Error deleting subject part:", err.message);
      res
        .status(500)
        .json({ success: false, message: "Subject parts storage unavailable" });
    }
  }),
);

// ===== UNITS MANAGEMENT =====
router.get(
  "/units",
  asyncHandler(async (req, res) => {
    const units = await dbHelpers.find("units", { isActive: true });
    res.json({ success: true, data: units });
  }),
);

router.post(
  "/units",
  asyncHandler(async (req, res) => {
    const newUnit = await dbHelpers.insertOne("units", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newUnit });
  }),
);

router.put(
  "/units/:id",
  asyncHandler(async (req, res) => {
    const updated = await dbHelpers.updateById("units", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Unit not found" });
    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/units/:id",
  asyncHandler(async (req, res) => {
    const deleted = await dbHelpers.softDelete(
      "units",
      req.params.id,
      req.user.id,
    );
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Unit not found" });
    res.json({ success: true, message: "Unit moved to trash" });
  }),
);

// ===== SUBTOPICS MANAGEMENT =====
router.get(
  "/subtopics",
  asyncHandler(async (req, res) => {
    const subtopics = await dbHelpers.find("subtopics", { isActive: true });
    res.json({ success: true, data: subtopics });
  }),
);

router.post(
  "/subtopics",
  asyncHandler(async (req, res) => {
    const newSubtopic = await dbHelpers.insertOne("subtopics", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newSubtopic });
  }),
);

router.put(
  "/subtopics/:id",
  asyncHandler(async (req, res) => {
    const updated = await dbHelpers.updateById("subtopics", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated)
      return res
        .status(404)
        .json({ success: false, message: "Subtopic not found" });
    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/subtopics/:id",
  asyncHandler(async (req, res) => {
    const deleted = await dbHelpers.softDelete(
      "subtopics",
      req.params.id,
      req.user.id,
    );
    if (!deleted)
      return res
        .status(404)
        .json({ success: false, message: "Subtopic not found" });
    res.json({ success: true, message: "Subtopic moved to trash" });
  }),
);

// ===== PASSAGES MANAGEMENT =====
router.get(
  "/passages",
  asyncHandler(async (req, res) => {
    try {
      const limit = Math.min(
        Math.max(parseInt(req.query.limit, 10) || 100, 1),
        500,
      );
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
      const passages = await dbHelpers.find("passages", {}, limit, offset);
      res.json({ success: true, data: passages || [] });
    } catch (err) {
      res.json({ success: true, data: [] });
    }
  }),
);

export default router;
