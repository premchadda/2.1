import express from "express";
import multer from "multer";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { parseAssetId } from "../../shared/utils/parseAssetId.js";
import { buildAssetUrlMap } from "./admin-assets.js";
import { protect, admin } from "../../middleware/auth.middleware.js";
import logger from "../../infrastructure/logger/logger.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { aiRateLimiter } from "../../middleware/aiRateLimiter.js";
import { callAIWithFallback } from "../../modules/ai/aiClient.js";
import { sanitizeForPrompt } from "../../modules/ai/aiMentor.service.js";
import {
  parseCSVBuffer,
  parseJSONBuffer,
  parseSpreadsheetBuffer,
} from "../../services/import/enhancedImporter.js";

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
  // Case-insensitive header lookup for CSV/Excel imports where column names
  // vary (e.g. "Question", "Quiz Title", "Option A", "Correct Option").
  const lowerMap = {};
  for (const k of Object.keys(body))
    lowerMap[String(k).toLowerCase().trim()] = body[k];
  const pick = (...keys) => {
    for (const k of keys) {
      if (body[k] !== undefined && body[k] !== null && body[k] !== "")
        return body[k];
      const lk = String(k).toLowerCase();
      if (
        lowerMap[lk] !== undefined &&
        lowerMap[lk] !== null &&
        lowerMap[lk] !== ""
      )
        return lowerMap[lk];
    }
    return undefined;
  };
  set(
    "title",
    pick(
      "title",
      "name",
      "question",
      "q",
      "quiz title",
      "quiz_title",
      "quizTitle",
      "quiz name",
      "quiz_name",
    ),
  );
  set(
    "description",
    pick("description", "details", "detail", "desc", "explanation"),
  );
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
  // Options array from common header variants: Option(s) A-D, Option 1-4,
  // choiceA-D / choice_1-4 (case/space/underscore-insensitive).
  let quizOptions = body.options ?? lowerMap["options"];
  if (!Array.isArray(quizOptions)) {
    const buckets = [];
    for (const [rawKey, val] of Object.entries(body)) {
      if (val === undefined || val === null || String(val).trim() === "")
        continue;
      const nk = String(rawKey)
        .toLowerCase()
        .trim()
        .replace(/[\s_-]+/g, "");
      const m = nk.match(/^(options?|choice)([a-d1-4])$/);
      if (m) {
        const suffix = m[2];
        const idx = /[1-4]/.test(suffix)
          ? parseInt(suffix, 10) - 1
          : suffix.charCodeAt(0) - 97;
        buckets[idx] = val;
      }
    }
    if (buckets.filter((v) => v !== undefined).length >= 2) {
      quizOptions = buckets.filter((v) => v !== undefined);
    } else if (typeof quizOptions === "string" && quizOptions.trim() !== "") {
      const parts = String(quizOptions)
        .split(/\s*[|\n;]+\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length >= 2) quizOptions = parts;
    }
  }
  if (Array.isArray(quizOptions)) payload.options = quizOptions;
  set(
    "correct_answer",
    pick(
      "correct_answer",
      "correctAnswer",
      "answer",
      "correct",
      "correct option",
      "correct_option",
      "correctoption",
      "correct answer",
      "correctanswer",
      "ans",
      "key",
    ),
  );
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

// Multer for POST /quizzes/bulk: accepts an optional multipart file alongside
// the legacy JSON body (mirrors the admin-questions bulk upload pattern).
// The extension is validated in the handler — not in fileFilter — so that
// unsupported types return a clean 400 JSON error instead of a multer error.
const quizBulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});

router.post(
  "/quizzes/bulk",
  quizBulkUpload.single("file"),
  asyncHandler(async (req, res) => {
    // Accept BOTH legacy JSON bodies and multipart FormData file uploads.
    // JSON callers are unaffected: multer passes non-multipart requests through
    // untouched, and the no-file branch preserves the original body handling.
    let items;
    if (req.file?.buffer) {
      const filename = (req.file.originalname || "").toLowerCase();
      const ext = filename.slice(filename.lastIndexOf("."));
      if (ext === ".json") {
        const parsed = parseJSONBuffer(req.file.buffer);
        items = Array.isArray(parsed)
          ? parsed
          : (parsed?.quizzes ?? parsed?.items ?? parsed?.data ?? []);
        if (!Array.isArray(items)) items = items ? [items] : [];
      } else if (ext === ".csv") {
        items = parseCSVBuffer(req.file.buffer);
      } else if (ext === ".xlsx" || ext === ".xls") {
        try {
          items = await parseSpreadsheetBuffer(req.file.buffer);
        } catch (parseErr) {
          return res.status(400).json({
            success: false,
            message: `Could not parse spreadsheet upload: ${parseErr.message}`,
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: `Unsupported bulk upload type "${ext || "unknown"}". Upload .json, .csv, .xlsx/.xls, or send a JSON body.`,
        });
      }
    } else if (Array.isArray(req.body)) {
      items = req.body;
    } else {
      // Legacy JSON shapes, plus multipart text fields (FormData stringifies
      // arrays, so a "quizzes" JSON string is parsed back here).
      const raw = req.body?.quizzes ?? req.body?.items ?? req.body;
      if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw);
          items = Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return res.status(400).json({
            success: false,
            message: "Invalid JSON in 'quizzes' field",
          });
        }
      } else if (Array.isArray(raw)) {
        items = raw;
      } else if (raw && typeof raw === "object") {
        items = [raw];
      } else {
        items = [];
      }
    }
    const inserted = [];
    const skipped = [];
    items.forEach((item, index) => {
      const payload = normalizeQuizPayload(item || {});
      if (!payload.title) {
        skipped.push({
          row: index + 1,
          reason: `Missing title/name (received: ${Object.keys(item || {}).join(", ")})`,
        });
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
    res.status(201).json({
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
  aiRateLimiter,
  asyncHandler(async (req, res) => {
    const {
      topic,
      subject,
      count = 5,
      difficulty = "medium",
      isPractice = false,
    } = req.body;
    const questionCount = Math.min(Math.max(parseInt(count, 10) || 3, 1), 15);
    const sub = subject || "General";
    const top = topic || "General Aptitude";
    const diff = ["easy", "medium", "hard"].includes(
      String(difficulty).toLowerCase(),
    )
      ? String(difficulty).toLowerCase()
      : "medium";

    let generatedQuestions = [];

    if (process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY) {
      try {
        const prompt = `You are an expert exam question creator. Generate exactly ${questionCount} multiple-choice questions for the subject "${sanitizeForPrompt(sub)}" on topic "${sanitizeForPrompt(top)}" at ${diff} difficulty level.
Return ONLY a valid JSON array of objects. Each object must have:
- "questionText": string
- "options": array of 4 distinct string choices
- "correctAnswer": string (must exactly match one of the options)
- "explanation": string (clear educational reasoning)
- "difficulty": "${sanitizeForPrompt(diff)}"
- "subject": "${sanitizeForPrompt(sub)}"
- "topic": "${sanitizeForPrompt(top)}"
Do not include markdown codeblocks or other commentary.`;

        const response = await callAIWithFallback(
          [
            {
              role: "system",
              content:
                "You are an expert educational assessment system that outputs raw JSON arrays only.",
            },
            { role: "user", content: prompt },
          ],
          { temperature: 0.6 },
        );

        if (response?.text) {
          let cleaned = response.text.trim();
          if (cleaned.startsWith("```json")) {
            cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
          } else if (cleaned.startsWith("```")) {
            cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
          }
          const parsed = JSON.parse(cleaned);
          if (Array.isArray(parsed) && parsed.length > 0) {
            generatedQuestions = parsed.map((q, idx) => {
              // Placeholder stand-ins must never be persisted as real options:
              // a missing/short options array is an invalid AI answer, not a
              // cue to fabricate choices.
              if (!Array.isArray(q.options) || q.options.length < 2) {
                const placeholderErr = new Error(
                  `AI answer invalid: question ${idx + 1} returned unusable options`,
                );
                placeholderErr.status = 400;
                placeholderErr.code = "INVALID_AI_ANSWER";
                throw placeholderErr;
              }
              const opts = q.options;
              // The answer MUST reference an existing option — an LLM
              // paraphrase that matches nothing breaks scoring silently, so a
              // miss is a 400, never a silent pick of opts[0].
              const rawAns = q.correctAnswer ?? q.correct_answer;
              const trimmedOptions = opts.map((o) => String(o).trim());
              const matched = trimmedOptions.find(
                (o) =>
                  o.toLowerCase() ===
                  String(rawAns ?? "")
                    .trim()
                    .toLowerCase(),
              );
              if (!matched) {
                const answerErr = new Error(
                  `AI answer invalid: question ${idx + 1} correctAnswer matches no option`,
                );
                answerErr.status = 400;
                answerErr.code = "INVALID_AI_ANSWER";
                throw answerErr;
              }
              return {
                questionText:
                  q.questionText || q.question || `Question ${idx + 1}`,
                question_text:
                  q.questionText || q.question || `Question ${idx + 1}`,
                options: opts,
                correctAnswer: matched,
                correct_answer: matched,
                explanation: q.explanation || "No explanation provided.",
                difficulty: q.difficulty || diff,
                subject: q.subject || sub,
                topic: q.topic || top,
                is_practice: Boolean(isPractice),
                status: "active",
                // AI-path quarantine flags (symmetric with the
                // template-fallback flags below): attributable + reviewable.
                generated_by: "ai",
                generatedBy: "ai",
                is_active: true,
                isActive: true,
              };
            });
          }
        }
      } catch (aiErr) {
        // Moderation refusals must never be masked by the template fallback
        // nor persisted — rethrow to surface 500/451.
        if (/moderation/i.test(aiErr?.message || "")) {
          throw aiErr;
        }
        // Invalid-AI-answer throws from validation below must bypass the
        // fallback so the client gets a 400 instead of persisted rows.
        if (aiErr?.code === "INVALID_AI_ANSWER" || aiErr?.status === 400) {
          throw aiErr;
        }
        logger.warn(
          `[AI] Question generation error: ${aiErr.message}. Falling back to structured generator.`,
        );
      }
    }

    let isTemplateFallback = false;
    if (!generatedQuestions || generatedQuestions.length === 0) {
      isTemplateFallback = true;
      for (let i = 1; i <= questionCount; i++) {
        const sampleOptions = [
          `Fundamental principle of ${top} (Concept ${i})`,
          `Secondary application of ${sub}`,
          `Alternative formulation of ${top}`,
          `Theoretical boundary of ${sub}`,
        ];
        generatedQuestions.push({
          questionText: `Which of the following best characterizes ${top} in the context of ${sub}? (Question ${i})`,
          question_text: `Which of the following best characterizes ${top} in the context of ${sub}? (Question ${i})`,
          options: sampleOptions,
          correctAnswer: sampleOptions[0],
          correct_answer: sampleOptions[0],
          explanation: `In ${sub}, understanding ${top} is essential because ${sampleOptions[0].toLowerCase()} forms the basis of standard problem solving.`,
          difficulty: diff,
          subject: sub,
          topic: top,
          is_practice: Boolean(isPractice),
          status: "active",
          // Template fallback rows are quarantined: inactive until reviewed
          generated_by: "template_fallback",
          generatedBy: "template_fallback",
          is_active: false,
          isActive: false,
        });
      }
    }

    // Persist: only real DB rows are returned as usable questions — a
    // fabricated Date.now() "id" would become a dangling questionId
    // reference when admins attach generated questions to quizzes.
    const results = [];
    const failed = [];
    for (let i = 0; i < generatedQuestions.length; i++) {
      const q = generatedQuestions[i];
      try {
        const inserted = await dbHelpers.insertOne("questions", {
          ...q,
          question_number: i + 1,
          createdAt: new Date().toISOString(),
          created_at: new Date().toISOString(),
        });
        if (inserted?.id || inserted?._id) {
          results.push(inserted);
        } else {
          failed.push({
            questionText: q.questionText,
            error: "insert returned no id",
          });
        }
      } catch (insertErr) {
        logger.error(
          `[AI] Generated question insert failed: ${insertErr.message}`,
        );
        failed.push({
          questionText: q.questionText,
          error: insertErr.message,
        });
      }
    }

    res.status(results.length > 0 ? 201 : 500).json({
      success: results.length > 0,
      count: results.length,
      data: results,
      generatedBy: isTemplateFallback ? "template_fallback" : "ai",
      ...(failed.length > 0 ? { failedCount: failed.length, failed } : {}),
    });
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
