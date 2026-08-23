import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { parseAssetId } from "../../shared/utils/parseAssetId.js";
import { buildAssetUrlMap } from "./admin-assets.js";
import {
  protect,
  admin,
  superAdmin,
} from "../../middleware/auth.middleware.js";
import logger from "../../infrastructure/logger/logger.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";

const router = express.Router();

router.use(protect);
router.use(admin);

// ===== VIDEOS MANAGEMENT =====
router.get(
  "/videos",
  asyncHandler(async (req, res) => {
    const videos = await dbHelpers.find("videos", { isActive: true });
    res.json({ success: true, data: videos });
  }),
);

router.post(
  "/videos",
  asyncHandler(async (req, res) => {
    const newVideo = await dbHelpers.insertOne("videos", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newVideo });
  }),
);

const handleUpdateQuiz = asyncHandler(async (req, res) => {
  const updated = await dbHelpers.updateById("quizzes", req.params.id, {
    ...normalizeQuizPayload(req.body),
    updatedAt: new Date().toISOString(),
  });
  if (!updated) {
    return res.status(404).json({ success: false, message: "Quiz not found" });
  }
  res.json({ success: true, data: updated });
});

// ===== QUIZZES MANAGEMENT =====
// Maps the admin-panel camelCase quiz form to real quizzes columns.
// Unknown/legacy fields are dropped instead of crashing insertOne.
const normalizeQuizPayload = (body = {}) => {
  const payload = {};
  const set = (col, val) => {
    if (payload[col] === undefined && val !== undefined && val !== null)
      payload[col] = val;
  };
  set("title", body.title ?? body.name);
  set("description", body.description);
  set("subject", body.subject);
  set("chapter", body.chapter);
  set("topic", body.topic);
  set("category", body.category);
  set("slug", body.slug);
  set("difficulty", body.difficulty);
  set("instructions", body.instructions);
  set("status", body.status);
  set("duration", body.duration);
  set("total_marks", body.totalMarks ?? body.total_marks);
  set(
    "total_questions",
    body.totalQuestions ??
      body.total_questions ??
      body.questionCount ??
      body.question_count,
  );
  set(
    "passing_score",
    body.passingMarks ??
      body.passing_marks ??
      body.passingScore ??
      body.passing_score,
  );
  set("negative_marking", body.negativeMarking ?? body.negative_marking);
  set("is_pro", body.isPro ?? body.is_pro);
  set("is_public", body.isPublic ?? body.is_public);
  set("is_active", body.isActive ?? body.is_active);
  set("shuffle_questions", body.shuffleQuestions ?? body.shuffle_questions);
  set("shuffle_options", body.shuffleOptions ?? body.shuffle_options);
  set("show_answers", body.showAnswers ?? body.show_answers);
  set("created_by", body.createdBy ?? body.created_by);
  set("metadata", body.metadata);
  set("tags", body.tags);
  const questionIds =
    body.questionIds ?? body.question_ids ?? body.questionIdList;
  if (Array.isArray(questionIds)) payload.question_ids = questionIds;
  return payload;
};

router.put("/quizzes/:id", handleUpdateQuiz);
router.patch("/quizzes/:id", handleUpdateQuiz);

router.post(
  "/quizzes/:id/duplicate",
  asyncHandler(async (req, res) => {
    const original = await dbHelpers.findById("quizzes", req.params.id);
    if (!original)
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });

    const clone = normalizeQuizPayload(original);
    clone.title = `${original.title || original.name || "Quiz"} (Copy)`;
    if (clone.slug) clone.slug = `${clone.slug}-copy-${Date.now()}`;
    clone.status = "draft";
    clone.is_active = false;
    clone.createdAt = new Date().toISOString();
    clone.updatedAt = new Date().toISOString();

    const duplicated = await dbHelpers.insertOne("quizzes", clone);
    res.status(201).json({ success: true, data: duplicated });
  }),
);

router.put(
  "/videos/:id",
  asyncHandler(async (req, res) => {
    const updated = await dbHelpers.updateById("videos", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }
    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/videos/:id",
  asyncHandler(async (req, res) => {
    const deleted = await dbHelpers.softDelete(
      "videos",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Video not found" });
    }
    res.json({ success: true, message: "Video moved to trash" });
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
    const { name, title, slug, icon, description, isActive, is_active } =
      req.body;
    const subjectName = (name || title || "").trim();
    if (!subjectName) {
      return res
        .status(400)
        .json({ success: false, message: "Subject name is required" });
    }
    const subjectSlug = (
      slug ||
      subjectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
    ).trim();
    const payload = {
      name: subjectName,
      slug: subjectSlug,
      icon: icon || null,
      description: description || null,
      is_active: isActive ?? is_active ?? true,
      created_at: new Date().toISOString(),
    };
    const newSubject = await dbHelpers.insertOne("subjects", payload);
    res.status(201).json({ success: true, data: newSubject });
  }),
);

router.put(
  "/subjects/:id",
  asyncHandler(async (req, res) => {
    const { parentId, isActive, ...rest } = req.body;
    const updated = await dbHelpers.updateById("subjects", req.params.id, {
      ...rest,
      parent_id:
        parentId === "" || parentId === undefined || parentId === null
          ? null
          : Number(parentId),
      is_active: isActive,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    }
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
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Subject not found" });
    }
    res.json({ success: true, message: "Subject moved to trash" });
  }),
);

// ===== BANNERS MANAGEMENT =====
router.get(
  "/banners",
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.includeInactive === "true";
    const query = {};
    if (includeInactive) {
      if (req.query.status === "active") query.isActive = true;
      else if (req.query.status === "inactive") query.isActive = false;
    } else {
      query.isActive = true;
    }
    const banners = await dbHelpers.find("banners", query);
    res.json({ success: true, data: banners });
  }),
);

router.post(
  "/banners",
  asyncHandler(async (req, res) => {
    const newBanner = await dbHelpers.insertOne("banners", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newBanner });
  }),
);

router.put(
  "/banners/:id",
  asyncHandler(async (req, res) => {
    const updated = await dbHelpers.updateById("banners", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Banner not found" });
    }
    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/banners/:id",
  asyncHandler(async (req, res) => {
    const deleted = await dbHelpers.softDelete(
      "banners",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Banner not found" });
    }
    res.json({ success: true, message: "Banner moved to trash" });
  }),
);

// ===== FAQS MANAGEMENT =====
router.get(
  "/faqs",
  asyncHandler(async (req, res) => {
    const faqs = await dbHelpers.find("faqs", { isActive: true });
    res.json({ success: true, data: faqs });
  }),
);

router.post(
  "/faqs",
  asyncHandler(async (req, res) => {
    const newFaq = await dbHelpers.insertOne("faqs", {
      ...req.body,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newFaq });
  }),
);

router.put(
  "/faqs/:id",
  asyncHandler(async (req, res) => {
    const updated = await dbHelpers.updateById("faqs", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: "FAQ not found" });
    }
    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/faqs/:id",
  asyncHandler(async (req, res) => {
    const deleted = await dbHelpers.softDelete(
      "faqs",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res.status(404).json({ success: false, message: "FAQ not found" });
    }
    res.json({ success: true, message: "FAQ moved to trash" });
  }),
);

// ===== PROMOTIONS MANAGEMENT =====
router.get(
  "/promotions",
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, search, type, status } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100);

    const query = {};
    if (status === "active") query.isActive = true;
    else if (status === "inactive") query.isActive = false;
    else query.include_inactive = true;

    let promotions = await dbHelpers.find("promotions", query);

    if (type && type !== "all") {
      promotions = promotions.filter(
        (p) => (p.type || "").toLowerCase() === type.toLowerCase(),
      );
    }

    if (search) {
      const q = search.toLowerCase();
      promotions = promotions.filter(
        (p) =>
          (p.title || p.name || "").toLowerCase().includes(q) ||
          (p.code || "").toLowerCase().includes(q),
      );
    }

    const total = promotions.length;
    const totalPages = Math.ceil(total / limitNum) || 1;
    const offset = (pageNum - 1) * limitNum;
    const paginatedPromotions = promotions.slice(offset, offset + limitNum);

    const assetMap = await buildAssetUrlMap(
      paginatedPromotions.map(
        (promotion) => promotion.bannerAssetId || promotion.banner_asset_id,
      ),
    );
    const enrichedPromotions = paginatedPromotions.map((promotion) => {
      const bannerAssetId = parseAssetId(
        promotion.bannerAssetId || promotion.banner_asset_id,
      );
      return {
        ...promotion,
        bannerAssetId,
        bannerUrl: bannerAssetId
          ? assetMap.get(bannerAssetId) || null
          : promotion.bannerUrl ||
            promotion.banner_url ||
            promotion.imageUrl ||
            promotion.image_url ||
            null,
      };
    });
    res.json({
      success: true,
      data: enrichedPromotions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: totalPages,
      },
    });
  }),
);

router.post(
  "/promotions",
  asyncHandler(async (req, res) => {
    const bannerAssetId = parseAssetId(
      req.body.bannerAssetId || req.body.banner_asset_id,
    );
    const newPromotion = await dbHelpers.insertOne("promotions", {
      ...req.body,
      bannerAssetId,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newPromotion });
  }),
);

router.put(
  "/promotions/:id",
  asyncHandler(async (req, res) => {
    const bannerAssetId = parseAssetId(
      req.body.bannerAssetId || req.body.banner_asset_id,
    );
    const updated = await dbHelpers.updateById("promotions", req.params.id, {
      ...req.body,
      bannerAssetId,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Promotion not found" });
    }
    res.json({ success: true, data: updated });
  }),
);

router.delete(
  "/promotions/:id",
  asyncHandler(async (req, res) => {
    const deleted = await dbHelpers.softDelete(
      "promotions",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Promotion not found" });
    }
    res.json({ success: true, message: "Promotion moved to trash" });
  }),
);

// ===== QUIZZES MANAGEMENT =====
router.get(
  "/quizzes",
  asyncHandler(async (req, res) => {
    const quizzes = await dbHelpers.find("quizzes", { include_inactive: true });
    res.json({ success: true, data: quizzes || [] });
  }),
);

router.post(
  "/quizzes",
  asyncHandler(async (req, res) => {
    const payload = normalizeQuizPayload(req.body);
    if (!payload.title) {
      return res
        .status(400)
        .json({ success: false, message: "Quiz title is required" });
    }
    const newQuiz = await dbHelpers.insertOne("quizzes", {
      ...payload,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, data: newQuiz });
  }),
);

router.post(
  "/quizzes/bulk",
  asyncHandler(async (req, res) => {
    const items = Array.isArray(req.body)
      ? req.body
      : req.body.quizzes || (req.body.items ? req.body.items : [req.body]);
    const inserted = [];
    const skipped = [];
    items.forEach((item, index) => {
      const payload = normalizeQuizPayload(item || {});
      if (!payload.title) {
        skipped.push({ row: index + 1, reason: "Missing title/name" });
        return;
      }
      inserted.push(payload);
    });
    const results = [];
    for (const payload of inserted) {
      const q = await dbHelpers.insertOne("quizzes", {
        ...payload,
        createdAt: new Date().toISOString(),
      });
      results.push(q);
    }
    res
      .status(201)
      .json({
        success: true,
        count: results.length,
        data: results,
        skipped: skipped.length,
        skipDetails: skipped.length > 0 ? skipped : undefined,
      });
  }),
);

router.post(
  "/ai/generate-questions",
  asyncHandler(async (req, res) => {
    const { topic, subject, count = 5, difficulty = "medium" } = req.body;
    const questions = [];
    for (let i = 1; i <= count; i++) {
      questions.push({
        id: Date.now() + i,
        questionText: `Practice Question ${i} on ${topic || "General Aptitude"} (${difficulty})`,
        options: ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: "Option A",
        explanation: `Detailed explanation for ${topic} question ${i}.`,
        difficulty,
        subject: subject || "General",
        topic: topic || "General",
      });
    }
    res.json({ success: true, data: questions, count: questions.length });
  }),
);

const updateQuizHandler = handleUpdateQuiz;

router.put("/quizzes/:id", updateQuizHandler);
router.patch("/quizzes/:id", updateQuizHandler);

router.delete(
  "/quizzes/:id",
  asyncHandler(async (req, res) => {
    const deleted = await dbHelpers.softDelete(
      "quizzes",
      req.params.id,
      req.user.id,
    );
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Quiz not found" });
    }
    res.json({ success: true, message: "Quiz moved to trash" });
  }),
);

export default router;
