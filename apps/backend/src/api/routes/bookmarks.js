import express from "express";
import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";
import { protect } from "../../middleware/auth.middleware.js";
import rateLimit from "express-rate-limit";
import { idsMatch } from "../../services/core/common.js";
import { parseNumericId } from "../../shared/utils/db-utils.js";
import {
  findEntityByIdentifier,
  getInternalId,
} from "../../shared/utils/identifier-utils.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";
import { deleteCacheByPrefix } from "../../infrastructure/cache/cacheService.js";

const router = express.Router();

// Rate limiting for bookmark operations (Issue #36)
const bookmarkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Max 50 bookmark operations per 15 minutes
  message: {
    success: false,
    message: "Too many bookmark requests. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Looser bucket for read-only list/count/check traffic: scraping protection
// that never starves the mutation budget above.
const bookmarkListLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    success: false,
    message: "Too many bookmark requests. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Allowed item types for bookmarks (Issue #38)
const ALLOWED_ITEM_TYPES = [
  "test",
  "question",
  "study-material",
  "chapter",
  "video",
];

const validateItemType = (itemType) => {
  if (!itemType) return { valid: false, error: "itemType is required" };
  if (!ALLOWED_ITEM_TYPES.includes(itemType)) {
    return {
      valid: false,
      error: `Invalid itemType. Allowed types: ${ALLOWED_ITEM_TYPES.join(", ")}`,
    };
  }
  return { valid: true };
};

// Sanitize input
const sanitizeInput = (input) => {
  if (typeof input !== "string") return input;
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
};

// Decode a single layer of entity-escaping (inverse of sanitizeInput).
// Stored rows were written sanitized, so READ paths decode once to avoid
// double-encoded output (e.g. "&amp;amp;"). Named entities are decoded
// before &amp; so one pass never decodes twice. Write paths are unchanged
// (POST keeps sanitize-only for back-compat; PUT decodes-then-sanitizes
// to avoid re-encoding an already-encoded value).
const decodeOnce = (input) => {
  if (typeof input !== "string") return input;
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
};

// Strip answer keys from enriched question rows (mirrors practice.js
// toSafeQuestion). Options/explanation are kept for review display.
const stripAnswerKeys = (row) => {
  if (!row || typeof row !== "object") return row;
  const {
    correctAnswer,
    correct_answer,
    correctOption,
    correct_option,
    correct,
    answer,
    isCorrect,
    is_correct,
    ...safe
  } = row;
  return safe;
};

const resolveBookmarkEntity = async (itemType, itemId) => {
  if (!itemId) return null;
  switch (itemType) {
    case "test":
      return findEntityByIdentifier(dbHelpers, "tests", itemId, {
        slugFields: ["slug"],
      });
    case "question": {
      const found = await findEntityByIdentifier(
        dbHelpers,
        "questions",
        itemId,
      );
      if (found) return stripAnswerKeys(found);
      try {
        const qRes = await dbHelpers.pool.query(
          `SELECT id, question_text, options, correct_answer, explanation, subject, topic, chapter, difficulty, marks, negative_marks, tags FROM questions WHERE id::text = $1 OR public_id = $1 LIMIT 1`,
          [String(itemId)],
        );
        if (qRes.rows.length > 0)
          return stripAnswerKeys(dbHelpers.toCamel(qRes.rows[0]));
      } catch (e) {
        console.warn("Direct question lookup failed:", e.message);
      }
      return null;
    }
    case "study-material":
    case "chapter":
      return findEntityByIdentifier(dbHelpers, "studyMaterials", itemId);
    case "video":
      return (
        (await findEntityByIdentifier(dbHelpers, "videos", itemId)) ||
        (await findEntityByIdentifier(dbHelpers, "studyMaterials", itemId))
      );
    default:
      return null;
  }
};

const batchResolveBookmarkEntities = async (bookmarks = []) => {
  if (!bookmarks.length) return new Map();

  const byType = new Map();
  for (const b of bookmarks) {
    if (!b.itemType || !b.itemId) continue;
    if (!byType.has(b.itemType)) byType.set(b.itemType, new Set());
    byType.get(b.itemType).add(String(b.itemId));
  }

  const resultMap = new Map();

  await Promise.all(
    Array.from(byType.entries()).map(async ([itemType, idSet]) => {
      const ids = Array.from(idSet);
      if (!ids.length) return;

      try {
        if (itemType === "question") {
          const numericIds = ids
            .map(Number)
            .filter((n) => Number.isInteger(n) && n > 0);
          const stringIds = ids;
          const cleanUuids = ids
            .map((id) => id.replace(/^qst_/, ""))
            .filter(Boolean);
          const allStringLookups = [...new Set([...stringIds, ...cleanUuids])];

          const qRes = await dbHelpers.pool.query(
            `SELECT id, public_id, question_text, question_text_hi, options, options_hi, correct_answer, explanation, explanation_hi,
                    subject, topic, chapter, difficulty, marks, negative_marks, tags
             FROM questions
             WHERE (id = ANY($1::int[]) OR public_id = ANY($2::text[]))
               AND (is_deleted = false OR is_deleted IS NULL)`,
            [numericIds.length ? numericIds : [-1], allStringLookups],
          );

          for (const row of qRes.rows) {
            const camel = stripAnswerKeys(dbHelpers.toCamel(row));
            resultMap.set(`question:${row.id}`, camel);
            resultMap.set(`question:${String(row.id)}`, camel);
            if (row.public_id) {
              resultMap.set(`question:${row.public_id}`, camel);
              resultMap.set(
                `question:qst_${row.public_id.replace(/^qst_/, "")}`,
                camel,
              );
              resultMap.set(
                `question:${row.public_id.replace(/^qst_/, "")}`,
                camel,
              );
            }
          }
        } else if (itemType === "test") {
          const numericIds = ids
            .map(Number)
            .filter((n) => Number.isInteger(n) && n > 0);
          const tRes = await dbHelpers.pool.query(
            `SELECT id, public_id, slug, title, description, status, is_active, created_at FROM tests
              WHERE (id = ANY($1::int[]) OR slug = ANY($2::text[]) OR id::text = ANY($2::text[]))
                AND (is_deleted = false OR is_deleted IS NULL)`,
            [numericIds.length ? numericIds : [-1], ids],
          );
          for (const row of tRes.rows) {
            const camel = dbHelpers.toCamel(row);
            resultMap.set(`test:${row.id}`, camel);
            resultMap.set(`test:${String(row.id)}`, camel);
            if (row.slug) resultMap.set(`test:${row.slug}`, camel);
          }
        } else if (itemType === "study-material" || itemType === "chapter") {
          const numericIds = ids
            .map(Number)
            .filter((n) => Number.isInteger(n) && n > 0);
          const smRes = await dbHelpers.pool.query(
            `SELECT id, slug, title, description, subject_id, chapter_id, status, created_at FROM study_materials
             WHERE (id = ANY($1::int[]) OR slug = ANY($2::text[]) OR id::text = ANY($2::text[]))
               AND (is_deleted = false OR is_deleted IS NULL)`,
            [numericIds.length ? numericIds : [-1], ids],
          );
          for (const row of smRes.rows) {
            const camel = dbHelpers.toCamel(row);
            resultMap.set(`${itemType}:${row.id}`, camel);
            resultMap.set(`${itemType}:${String(row.id)}`, camel);
            if (row.slug) resultMap.set(`${itemType}:${row.slug}`, camel);
          }
        } else if (itemType === "video") {
          const numericIds = ids
            .map(Number)
            .filter((n) => Number.isInteger(n) && n > 0);
          const vRes = await dbHelpers.pool.query(
            `SELECT id, slug, title, description, subject_id, chapter_id, video_url, duration_sec, created_at FROM subject_videos
             WHERE (id = ANY($1::int[]) OR slug = ANY($2::text[]) OR id::text = ANY($2::text[]))
               AND (is_deleted = false OR is_deleted IS NULL)`,
            [numericIds.length ? numericIds : [-1], ids],
          );
          for (const row of vRes.rows) {
            const camel = dbHelpers.toCamel(row);
            resultMap.set(`video:${row.id}`, camel);
            resultMap.set(`video:${String(row.id)}`, camel);
            if (row.slug) resultMap.set(`video:${row.slug}`, camel);
          }
        }
      } catch (err) {
        console.warn(
          `[Bookmarks Batch Enrichment] failed for ${itemType}:`,
          err.message,
        );
      }
    }),
  );

  return resultMap;
};

// Practice bridge (read-only): unified bookmarked question ids for a user.
// Unions legacy `question_bookmarks` rows with generic `bookmarks` rows
// (item_type='question', question_id mapped from the canonical int form of
// item_id), deduped by question_id. Write paths are untouched.
// NOTE: wiring this into practice.js mode=bookmark / /bookmarks read paths
// lives outside this file's territory — see return notes for the patch.
export const getUnifiedBookmarkedQuestionIds = async (userId) => {
  const ids = new Set();
  try {
    const r1 = await dbHelpers.pool.query(
      `SELECT question_id FROM question_bookmarks WHERE user_id = $1`,
      [userId],
    );
    for (const r of r1.rows) {
      const n = Number(r.question_id);
      if (Number.isInteger(n) && n > 0) ids.add(n);
    }
  } catch (e) {
    console.warn(
      "[Bookmarks bridge] question_bookmarks read failed:",
      e.message,
    );
  }
  try {
    const r2 = await dbHelpers.pool.query(
      `SELECT item_id FROM bookmarks
        WHERE user_id = $1 AND item_type = 'question' AND is_active = true`,
      [userId],
    );
    for (const r of r2.rows) {
      const raw = String(r.item_id ?? "").replace(/^qst_/, "");
      const n = parseNumericId(raw) ?? Number(raw);
      if (Number.isInteger(n) && n > 0) ids.add(n);
    }
  } catch (e) {
    console.warn("[Bookmarks bridge] bookmarks read failed:", e.message);
  }
  return [...ids];
};

// All bookmark routes require authentication
router.use(protect);

// @route   GET /api/bookmarks/count
// @desc    Get total count of active bookmarks for logged in user
// @access  Private
router.get("/count", bookmarkListLimiter, async (req, res) => {
  try {
    const count = await dbHelpers.count("bookmarks", {
      userId: req.user.id,
      isActive: true,
    });
    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error("Get bookmarks count error:", error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/bookmarks
// @desc    Get paginated bookmarks for logged in user
// @access  Private
router.get(
  "/",
  bookmarkListLimiter,
  responseCache("bookmarks-list", 30, { userScoped: true }),
  async (req, res) => {
    try {
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const limit = Math.min(
        Math.max(parseInt(req.query.limit, 10) || 20, 1),
        100,
      );
      const offset = (page - 1) * limit;
      // Default lightweight when paginating wide: includeDetails=false when
      // limit>20 unless explicitly requested (avoids expensive JOINs).
      const rawInclude = req.query.includeDetails;
      const includeDetails =
        rawInclude === undefined ? limit <= 20 : rawInclude !== "false";

      // Deterministic newest-first pagination: dbHelpers.find() takes no ORDER
      // BY, so an explicit query keeps pages stable (created_at DESC, id DESC
      // tiebreak) instead of relying on heap order.
      // Enriched (includeDetails) path is capped at 20 rows: each row fans out
      // to entity batch resolution, so unbounded enriched pages are the slow
      // path observed in production (5s+ at limit=100). Paginate wide with
      // includeDetails=false; fetch details per page instead.
      const effectiveLimit = includeDetails ? Math.min(limit, 20) : limit;
      const listRes = await dbHelpers.pool.query(
        `SELECT id, user_id, item_id, item_type, title, notes, is_active, created_at, updated_at
       FROM bookmarks
       WHERE user_id = $1 AND is_active = true
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
        [req.user.id, effectiveLimit, offset],
      );
      const bookmarks = listRes.rows.map((r) => {
        const b = dbHelpers.toCamel(r);
        // Stored title/notes were written sanitized: decode once on READ so
        // clients never see double-encoded entities. Write shape unchanged.
        if (typeof b.title === "string") b.title = decodeOnce(b.title);
        if (typeof b.notes === "string") b.notes = decodeOnce(b.notes);
        return b;
      });

      // Test interfaces only need item IDs to paint saved-state controls. Avoid
      // one entity lookup per bookmark when callers explicitly opt out of details.
      if (!includeDetails) {
        return res.json({
          success: true,
          data: bookmarks,
          count: bookmarks.length,
          page,
          limit,
        });
      }

      // Batch enrich bookmark data with actual item details in 1-2 queries total
      const resultMap = await batchResolveBookmarkEntities(bookmarks);

      const enrichedBookmarks = bookmarks.map((bookmark) => ({
        ...bookmark,
        item:
          resultMap.get(`${bookmark.itemType}:${bookmark.itemId}`) ||
          resultMap.get(`${bookmark.itemType}:${String(bookmark.itemId)}`) ||
          null,
      }));

      const total = await dbHelpers.count("bookmarks", {
        userId: req.user.id,
        isActive: true,
      });

      res.json({
        success: true,
        data: enrichedBookmarks,
        count: enrichedBookmarks.length,
        page,
        limit: effectiveLimit,
        total,
      });
    } catch (error) {
      console.error("Get bookmarks error:", error);
      res.status(500).json({
        success: false,
        message: sanitizeErrorMessage(error),
      });
    }
  },
);

// @route   POST /api/bookmarks
// @desc    Create a new bookmark
// @access  Private
router.post("/", bookmarkLimiter, async (req, res) => {
  try {
    const { itemId, itemType, title, notes } = req.body;

    if (!itemId || !itemType) {
      return res.status(400).json({
        success: false,
        message: "itemId and itemType are required",
      });
    }

    // Validate itemType (Issue #38)
    const typeValidation = validateItemType(itemType);
    if (!typeValidation.valid) {
      return res.status(400).json({
        success: false,
        message: typeValidation.error,
      });
    }

    const resolvedEntity = await resolveBookmarkEntity(itemType, itemId);
    const canonicalItemId =
      getInternalId(resolvedEntity) ?? parseNumericId(itemId);

    if (canonicalItemId === null) {
      return res.status(404).json({
        success: false,
        message: "Bookmark item not found",
      });
    }

    // Duplicate check: single indexed existence probe (no full-table scan)
    const dupCheck = await dbHelpers.pool.query(
      `SELECT 1 FROM bookmarks WHERE user_id = $1 AND item_type = $2 AND item_id::text = $3::text AND is_active = true LIMIT 1`,
      [req.user.id, itemType, String(canonicalItemId)],
    );

    if (dupCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Item already bookmarked",
      });
    }

    // Sanitize input
    const sanitizedTitle = title
      ? sanitizeInput(String(title).substring(0, 200))
      : "";
    const sanitizedNotes = notes
      ? sanitizeInput(String(notes).substring(0, 1000))
      : "";

    const bookmark = await dbHelpers.insertOne("bookmarks", {
      userId: req.user.id,
      itemId: canonicalItemId,
      itemType,
      title: sanitizedTitle,
      notes: sanitizedNotes,
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    await deleteCacheByPrefix(
      "bookmarks-list",
      "",
      `bookmarks-list:u:${req.user.id}`,
    );

    res.status(201).json({
      success: true,
      data: bookmark,
      message: "Bookmark created successfully",
    });
  } catch (error) {
    console.error("Create bookmark error:", error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   PUT /api/bookmarks/:id
// @desc    Update bookmark (notes, etc.)
// @access  Private
router.put("/:id", bookmarkLimiter, async (req, res) => {
  try {
    const { notes, title } = req.body;

    // Verify bookmark belongs to user
    const bookmark = await findEntityByIdentifier(
      dbHelpers,
      "bookmarks",
      req.params.id,
    );
    if (!bookmark || !idsMatch(bookmark.userId, req.user.id)) {
      return res.status(404).json({
        success: false,
        message: "Bookmark not found",
      });
    }

    // Decode-then-sanitize: stored values are already encoded, so decoding
    // first prevents double-encoding on update. POST keeps sanitize-only
    // for back-compat with existing rows.
    const updated = await dbHelpers.updateById(
      "bookmarks",
      getInternalId(bookmark),
      {
        notes:
          notes !== undefined
            ? sanitizeInput(decodeOnce(String(notes).substring(0, 1000)))
            : bookmark.notes,
        title:
          title !== undefined
            ? sanitizeInput(decodeOnce(String(title).substring(0, 200)))
            : bookmark.title,
        updatedAt: new Date().toISOString(),
      },
    );

    await deleteCacheByPrefix(
      "bookmarks-list",
      "",
      `bookmarks-list:u:${req.user.id}`,
    );

    res.json({
      success: true,
      data: updated,
      message: "Bookmark updated successfully",
    });
  } catch (error) {
    console.error("Update bookmark error:", error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   DELETE /api/bookmarks/:id
// @desc    Delete bookmark (soft delete)
// @access  Private
router.delete("/:id", bookmarkLimiter, async (req, res) => {
  try {
    // Verify bookmark belongs to user
    const bookmark = await findEntityByIdentifier(
      dbHelpers,
      "bookmarks",
      req.params.id,
    );
    if (!bookmark || !idsMatch(bookmark.userId, req.user.id)) {
      return res.status(404).json({
        success: false,
        message: "Bookmark not found",
      });
    }

    await dbHelpers.updateById("bookmarks", getInternalId(bookmark), {
      isActive: false,
      deletedAt: new Date().toISOString(),
    });

    await deleteCacheByPrefix(
      "bookmarks-list",
      "",
      `bookmarks-list:u:${req.user.id}`,
    );

    res.json({
      success: true,
      message: "Bookmark removed successfully",
    });
  } catch (error) {
    console.error("Delete bookmark error:", error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

// @route   GET /api/bookmarks/check/:itemType/:itemId
// @desc    Check if item is bookmarked by user
// @access  Private
router.get(
  "/check/:itemType/:itemId",
  bookmarkListLimiter,
  async (req, res) => {
    try {
      const { itemType, itemId } = req.params;

      // Targeted existence probe (no full-table scan): canonicalize first so
      // slug / numeric / prefixed forms all match the stored canonical id.
      const resolved = await resolveBookmarkEntity(itemType, itemId);
      const canonical = getInternalId(resolved) ?? parseNumericId(itemId);
      let bookmark = null;
      if (canonical !== null && canonical !== undefined) {
        const probe = await dbHelpers.pool.query(
          `SELECT id FROM bookmarks WHERE user_id = $1 AND item_type = $2 AND item_id::text = $3::text AND is_active = true LIMIT 1`,
          [req.user.id, itemType, String(canonical)],
        );
        if (probe.rows.length) bookmark = { _id: probe.rows[0].id };
      }

      res.json({
        success: true,
        isBookmarked: !!bookmark,
        bookmarkId: bookmark?._id || null,
      });
    } catch (error) {
      console.error("Check bookmark error:", error);
      res.status(500).json({
        success: false,
        message: sanitizeErrorMessage(error),
      });
    }
  },
);

// @route   POST /api/bookmarks/toggle
// @desc    Toggle bookmark (add if not exists, remove if exists)
// @access  Private
router.post("/toggle", bookmarkLimiter, async (req, res) => {
  try {
    const { itemId, itemType, title } = req.body;

    if (!itemId || !itemType) {
      return res.status(400).json({
        success: false,
        message: "itemId and itemType are required",
      });
    }

    // Validate itemType (Issue #38)
    const typeValidation = validateItemType(itemType);
    if (!typeValidation.valid) {
      return res.status(400).json({
        success: false,
        message: typeValidation.error,
      });
    }

    // Canonicalize through the same resolver as POST so slug / numeric /
    // prefixed id forms never create duplicate rows for the same entity.
    const resolvedEntity = await resolveBookmarkEntity(itemType, itemId);
    const canonicalItemId =
      getInternalId(resolvedEntity) ?? parseNumericId(itemId);
    if (canonicalItemId === null || canonicalItemId === undefined) {
      return res.status(404).json({
        success: false,
        message: "Bookmark item not found",
      });
    }

    // Targeted existence probe (no full-table scan).
    const existingProbe = await dbHelpers.pool.query(
      `SELECT id FROM bookmarks WHERE user_id = $1 AND item_type = $2 AND item_id::text = $3::text AND is_active = true LIMIT 1`,
      [req.user.id, itemType, String(canonicalItemId)],
    );

    if (existingProbe.rows.length) {
      // Remove bookmark
      const existingId = existingProbe.rows[0].id;
      await dbHelpers.updateById("bookmarks", existingId, {
        isActive: false,
        deletedAt: new Date().toISOString(),
      });

      await deleteCacheByPrefix(
        "bookmarks-list",
        "",
        `bookmarks-list:u:${req.user.id}`,
      );

      res.json({
        success: true,
        isBookmarked: false,
        message: "Bookmark removed",
      });
    } else {
      // Sanitize input
      const sanitizedTitle = title
        ? sanitizeInput(String(title).substring(0, 200))
        : "";

      // Add bookmark (canonical id — same form POST stores)
      const bookmark = await dbHelpers.insertOne("bookmarks", {
        userId: req.user.id,
        itemId: canonicalItemId,
        itemType,
        title: sanitizedTitle,
        notes: "",
        isActive: true,
        createdAt: new Date().toISOString(),
      });

      await deleteCacheByPrefix(
        "bookmarks-list",
        "",
        `bookmarks-list:u:${req.user.id}`,
      );

      res.status(201).json({
        success: true,
        isBookmarked: true,
        bookmarkId: bookmark._id || bookmark.id,
        message: "Bookmark added",
      });
    }
  } catch (error) {
    console.error("Toggle bookmark error:", error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

export default router;
