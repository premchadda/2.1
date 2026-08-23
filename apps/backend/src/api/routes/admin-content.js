import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { parsePagination, paginateResponse } from "./admin-helpers.js";
import logger from "../../infrastructure/logger/logger.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import {
  protect,
  admin,
  superAdmin,
} from "../../middleware/auth.middleware.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";

const router = express.Router();

router.use(protect);
router.use(admin);

async function calculateStudyMaterialCounts(materialId) {
  try {
    const chapters = await dbHelpers.find("chapters", {
      studyMaterialId: materialId,
      isActive: true,
    });

    const videos = await dbHelpers.find("subjectVideos", {
      studyMaterialId: materialId,
      isActive: true,
    });

    const pdfs = await dbHelpers.find("subjectPdfs", {
      studyMaterialId: materialId,
      isActive: true,
    });

    const topicTests = await dbHelpers.find("topicTests", {
      studyMaterialId: materialId,
      isActive: true,
    });
    const directTests = await dbHelpers.pool.query(
      "SELECT COUNT(*) FROM tests WHERE subject_id = $1 AND is_active = true",
      [materialId],
    );

    return {
      topics: chapters.length,
      videos: videos.length,
      pdf: pdfs.length,
      tests: topicTests.length + parseInt(directTests.rows[0]?.count || 0),
    };
  } catch (error) {
    logger.error("Error calculating counts:", error);
    return { topics: 0, videos: 0, pdf: 0, tests: 0 };
  }
}

// ===== FAST SUBJECTS LIST (for dropdowns — no count calculation) =====
router.get(
  "/subjects-list",
  asyncHandler(async (req, res) => {
    // For dropdowns: if no explicit pagination, return ALL (sorted) to avoid "only 4" truncation
    const hasPagination =
      req.query.limit !== undefined || req.query.offset !== undefined;
    if (!hasPagination) {
      const materials = await dbHelpers.find("studyMaterials", {
        isActive: true,
      });
      materials.sort((a, b) =>
        (a.title || a.name || "").localeCompare(b.title || b.name || ""),
      );
      return res.json({ success: true, data: materials });
    }
    const { limit, offset } = parsePagination(req.query);
    const materials = await dbHelpers.find(
      "studyMaterials",
      { isActive: true },
      limit,
      offset,
    );
    res.json({ success: true, ...paginateResponse(materials, limit, offset) });
  }),
);

router.get(
  "/study-materials",
  asyncHandler(async (req, res) => {
    const materials = await dbHelpers.find("studyMaterials", {
      isActive: true,
    });

    const materialsWithCounts = await Promise.all(
      materials.map(async (material) => {
        try {
          const counts = await calculateStudyMaterialCounts(
            material._id || material.id,
          );
          return {
            ...material,
            topics: counts.topics,
            videos: counts.videos,
            pdf: counts.pdf,
            tests: counts.tests,
          };
        } catch {
          return { ...material, topics: 0, videos: 0, pdf: 0, tests: 0 };
        }
      }),
    );

    res.json({ success: true, data: materialsWithCounts });
  }),
);

router.post(
  "/study-materials",
  asyncHandler(async (req, res) => {
    const {
      title,
      name,
      slug,
      description,
      order,
      display_order,
      displayOrder,
      isActive,
      is_active,
    } = req.body;
    const materialTitle = (title || name || "").trim();
    if (!materialTitle) {
      return res
        .status(400)
        .json({ success: false, message: "Title or name is required" });
    }
    const materialSlug = (
      slug ||
      materialTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    ).trim();

    const payload = {
      title: materialTitle,
      slug: materialSlug,
      description: description || null,
      display_order: Number(order ?? displayOrder ?? display_order ?? 0),
      is_active: isActive ?? is_active ?? true,
      created_at: new Date().toISOString(),
    };

    const newMaterial = await dbHelpers.insertOne("studyMaterials", payload);
    res.status(201).json({ success: true, data: newMaterial });
  }),
);

router.put(
  "/study-materials/:id",
  asyncHandler(async (req, res) => {
    const { topics, videos, pdf, tests, ...restData } = req.body;

    let updated = null;
    const material = await dbHelpers.findById("studyMaterials", req.params.id);
    if (material && typeof restData.order !== "undefined") {
      const newOrder = Number(restData.order);
      const oldOrder = material.order ?? 0;

      if (newOrder !== oldOrder) {
        const allMaterials = await dbHelpers.find("studyMaterials", {
          isActive: true,
        });
        if (newOrder > oldOrder) {
          for (const m of allMaterials) {
            if (
              m.id !== material.id &&
              (m.order ?? 0) > oldOrder &&
              (m.order ?? 0) <= newOrder
            ) {
              await dbHelpers.updateById("studyMaterials", m.id, {
                order: (m.order ?? 0) - 1,
              });
            }
          }
        } else if (newOrder < oldOrder) {
          for (const m of allMaterials) {
            if (
              m.id !== material.id &&
              (m.order ?? 0) >= newOrder &&
              (m.order ?? 0) < oldOrder
            ) {
              await dbHelpers.updateById("studyMaterials", m.id, {
                order: (m.order ?? 0) + 1,
              });
            }
          }
        }
        await dbHelpers.updateById("studyMaterials", material.id, {
          order: newOrder,
        });
        updated = await dbHelpers.findById("studyMaterials", material.id);
      } else {
        updated = await dbHelpers.updateById(
          "studyMaterials",
          req.params.id,
          restData,
        );
      }
    } else {
      updated = await dbHelpers.updateById(
        "studyMaterials",
        req.params.id,
        restData,
      );
    }

    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Material not found" });
    }

    const counts = await calculateStudyMaterialCounts(req.params.id);
    res.json({
      success: true,
      data: { ...updated, ...counts },
    });
  }),
);

router.delete(
  "/study-materials/:id",
  asyncHandler(async (req, res) => {
    const deleted = await dbHelpers.softDelete(
      "studyMaterials",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Material not found" });
    }
    res.json({ success: true, message: "Material moved to trash" });
  }),
);

router.put(
  "/study-materials/:id/restore",
  asyncHandler(async (req, res) => {
    const restored = await dbHelpers.restoreFromTrash(req.params.id);
    if (!restored) {
      return res
        .status(404)
        .json({ success: false, message: "Material not found in trash" });
    }
    res.json({
      success: true,
      message: "Material restored successfully",
      data: restored,
    });
  }),
);

router.get(
  "/study-materials/:id",
  asyncHandler(async (req, res) => {
    const material = await dbHelpers.findById("studyMaterials", req.params.id);
    if (!material) {
      return res
        .status(404)
        .json({ success: false, message: "Material not found" });
    }

    const counts = await calculateStudyMaterialCounts(req.params.id);
    res.json({ success: true, data: { ...material, ...counts } });
  }),
);

// ===== CHAPTERS MANAGEMENT =====
router.get(
  "/chapters",
  asyncHandler(async (req, res) => {
    const smId =
      req.query.studyMaterialId ||
      req.query.study_material_id ||
      req.query.subjectId ||
      req.query.subject_id;
    const query = { isActive: true };
    if (smId) {
      query.subject_id = Number(smId) || smId;
    }
    const chapters = await dbHelpers.find("chapters", query);
    res.json({ success: true, data: chapters });
  }),
);

// ===== TOPICS LOOKUP (for Content Manager dropdowns) =====
router.get(
  "/topics",
  responseCache("admin-topics", 60),
  asyncHandler(async (req, res) => {
    const chId = req.query.chapterId || req.query.chapter_id;
    const query = { isActive: true };
    if (chId) query.chapter_id = Number(chId) || chId;
    const topics = await dbHelpers.find("topics", query);
    topics.sort(
      (a, b) =>
        (a.orderIndex || a.order_index || a.order || 0) -
        (b.orderIndex || b.order_index || b.order || 0),
    );
    res.json({ success: true, data: topics });
  }),
);

router.post(
  "/chapters",
  asyncHandler(async (req, res) => {
    const {
      studyMaterialId,
      study_material_id,
      subjectId,
      subject_id,
      title,
      name,
      slug,
      orderIndex,
      order,
    } = req.body;
    const smId =
      studyMaterialId || study_material_id || subjectId || subject_id;
    const chapterName = (name || title || "").trim();

    if (!smId || !chapterName || !slug) {
      return res.status(400).json({
        success: false,
        message:
          "studyMaterialId (or subjectId), title (or name), and slug are required",
      });
    }

    const payload = {
      subject_id: Number(smId) || smId,
      name: chapterName,
      slug: slug.trim(),
      order_index: Number(orderIndex ?? order ?? 0),
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const newChapter = await dbHelpers.insertOne("chapters", payload);

    try {
      await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
        Number(smId) || smId,
      ]);
    } catch (err) {
      // Optional procedure
    }

    res.status(201).json({ success: true, data: newChapter });
  }),
);

router.put(
  "/chapters/:id",
  asyncHandler(async (req, res) => {
    const updated = await dbHelpers.updateById(
      "chapters",
      req.params.id,
      req.body,
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Chapter not found" });
    }

    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      updated.studyMaterialId,
    ]);

    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/chapters/:id",
  asyncHandler(async (req, res) => {
    const chapter = await dbHelpers.findById("chapters", req.params.id);
    if (!chapter) {
      return res
        .status(404)
        .json({ success: false, message: "Chapter not found" });
    }

    const deleted = await dbHelpers.softDelete(
      "chapters",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Chapter not found" });
    }

    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      chapter.studyMaterialId,
    ]);

    res.json({ success: true, message: "Chapter moved to trash" });
  }),
);

// ===== SUBJECT VIDEOS MANAGEMENT =====
router.get(
  "/subject-videos",
  asyncHandler(async (req, res) => {
    const { studyMaterialId, chapterId } = req.query;
    const query = { isActive: true };
    if (studyMaterialId) query.studyMaterialId = studyMaterialId;
    if (chapterId) query.chapterId = chapterId;

    const videos = await dbHelpers.find("subjectVideos", query);
    videos.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    res.json({ success: true, data: videos });
  }),
);

router.post(
  "/subject-videos",
  asyncHandler(async (req, res) => {
    const body = req.body;
    const studyMaterialId = body.studyMaterialId || body.study_material_id;
    const chapterId = body.chapterId || body.chapter_id || null;
    const topicId = body.topicId || body.topic_id || null;
    const title = body.title;
    const slug = body.slug;
    const videoUrl = body.videoUrl || body.video_url;

    if (!studyMaterialId || !title || !slug || !videoUrl) {
      return res.status(400).json({
        success: false,
        message: "studyMaterialId, title, slug, and videoUrl are required",
      });
    }

    const newVideo = await dbHelpers.insertOne("subjectVideos", {
      studyMaterialId,
      chapterId: chapterId || null,
      topicId: topicId || null,
      title,
      slug,
      description: body.description || "",
      videoUrl,
      thumbnail: body.thumbnail || body.thumbnail_url || "",
      duration: Number(body.duration) || 0,
      isPro: body.isPro ?? body.is_pro ?? false,
      isActive: true,
    });

    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      studyMaterialId,
    ]);

    res.status(201).json({ success: true, data: newVideo });
  }),
);

router.put(
  "/subject-videos/:id",
  asyncHandler(async (req, res) => {
    const updated = await dbHelpers.updateById(
      "subjectVideos",
      req.params.id,
      req.body,
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }

    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      updated.studyMaterialId,
    ]);

    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/subject-videos/:id",
  asyncHandler(async (req, res) => {
    const video = await dbHelpers.findById("subjectVideos", req.params.id);
    if (!video) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }

    const deleted = await dbHelpers.softDelete(
      "subjectVideos",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }

    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      video.studyMaterialId,
    ]);

    res.json({ success: true, message: "Video moved to trash" });
  }),
);

router.put(
  "/subject-videos/:id/reorder",
  asyncHandler(async (req, res) => {
    const { order } = req.body;
    const updated = await dbHelpers.updateById("subjectVideos", req.params.id, {
      displayOrder: order,
    });
    res.json({ success: true, data: updated });
  }),
);

// ===== SUBJECT PDFS MANAGEMENT =====
router.get(
  "/subject-pdfs",
  asyncHandler(async (req, res) => {
    const { studyMaterialId, chapterId } = req.query;
    const query = { isActive: true };
    if (studyMaterialId) query.studyMaterialId = studyMaterialId;
    if (chapterId) query.chapterId = chapterId;

    const pdfs = await dbHelpers.find("subjectPdfs", query);
    pdfs.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    res.json({ success: true, data: pdfs });
  }),
);

router.post(
  "/subject-pdfs",
  asyncHandler(async (req, res) => {
    const body = req.body;
    const studyMaterialId = body.studyMaterialId || body.study_material_id;
    const chapterId = body.chapterId || body.chapter_id || null;
    const topicId = body.topicId || body.topic_id || null;
    const title = body.title;
    const slug = body.slug;
    const pdfUrl = body.pdfUrl || body.pdf_url;

    if (!studyMaterialId || !title || !slug || !pdfUrl) {
      return res.status(400).json({
        success: false,
        message: "studyMaterialId, title, slug, and pdfUrl are required",
      });
    }

    const newPdf = await dbHelpers.insertOne("subjectPdfs", {
      studyMaterialId,
      chapterId: chapterId || null,
      topicId: topicId || null,
      title,
      slug,
      description: body.description || "",
      pdfUrl,
      fileSize: Number(body.fileSize ?? body.file_size ?? 0) || 0,
      pages: Number(body.pages) || 0,
      isPro: body.isPro ?? body.is_pro ?? false,
      isActive: true,
    });

    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      studyMaterialId,
    ]);

    res.status(201).json({ success: true, data: newPdf });
  }),
);

router.put(
  "/subject-pdfs/:id",
  asyncHandler(async (req, res) => {
    const updated = await dbHelpers.updateById(
      "subjectPdfs",
      req.params.id,
      req.body,
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "PDF not found" });
    }

    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      updated.studyMaterialId,
    ]);

    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/subject-pdfs/:id",
  asyncHandler(async (req, res) => {
    const pdf = await dbHelpers.findById("subjectPdfs", req.params.id);
    if (!pdf) {
      return res.status(404).json({ success: false, message: "PDF not found" });
    }

    const deleted = await dbHelpers.softDelete(
      "subjectPdfs",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res.status(404).json({ success: false, message: "PDF not found" });
    }

    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      pdf.studyMaterialId,
    ]);

    res.json({ success: true, message: "PDF moved to trash" });
  }),
);

router.put(
  "/subject-pdfs/:id/reorder",
  asyncHandler(async (req, res) => {
    const { order } = req.body;
    const updated = await dbHelpers.updateById("subjectPdfs", req.params.id, {
      displayOrder: order,
    });
    res.json({ success: true, data: updated });
  }),
);

// ===== TOPIC TESTS MANAGEMENT =====
router.get(
  "/topic-tests",
  asyncHandler(async (req, res) => {
    const { studyMaterialId, chapterId } = req.query;
    const query = { isActive: true };
    if (studyMaterialId) query.studyMaterialId = studyMaterialId;
    if (chapterId) query.chapterId = chapterId;

    const topicTests = await dbHelpers.find("topicTests", query);
    topicTests.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    res.json({ success: true, data: topicTests });
  }),
);

router.post(
  "/topic-tests",
  asyncHandler(async (req, res) => {
    const body = req.body;
    const studyMaterialId = body.studyMaterialId || body.study_material_id;
    const testId = body.testId || body.test_id;

    if (!studyMaterialId || !testId) {
      return res.status(400).json({
        success: false,
        message: "studyMaterialId and testId are required",
      });
    }

    const newTopicTest = await dbHelpers.insertOne("topicTests", {
      studyMaterialId,
      chapterId: body.chapterId || body.chapter_id || null,
      topicId: body.topicId || body.topic_id || null,
      testId,
      testType: body.testType || body.test_type || "practice",
      isActive: true,
    });

    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      studyMaterialId,
    ]);

    res.status(201).json({ success: true, data: newTopicTest });
  }),
);

router.put(
  "/topic-tests/:id",
  asyncHandler(async (req, res) => {
    const updated = await dbHelpers.updateById("topicTests", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Topic test not found" });
    }
    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/topic-tests/:id",
  asyncHandler(async (req, res) => {
    const topicTest = await dbHelpers.findById("topicTests", req.params.id);
    if (!topicTest) {
      return res
        .status(404)
        .json({ success: false, message: "Topic test not found" });
    }

    const deleted = await dbHelpers.softDelete(
      "topicTests",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Topic test not found" });
    }

    await dbHelpers.pool.query("SELECT update_study_material_counts($1)", [
      topicTest.studyMaterialId,
    ]);

    res.json({ success: true, message: "Topic test moved to trash" });
  }),
);

router.put(
  "/topic-tests/:id/reorder",
  asyncHandler(async (req, res) => {
    const { order } = req.body;
    const updated = await dbHelpers.updateById("topicTests", req.params.id, {
      displayOrder: order,
    });
    res.json({ success: true, data: updated });
  }),
);

export default router;
