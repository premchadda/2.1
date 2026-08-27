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
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/'/g, "&#x27;")
    .trim();
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
      if (found) return found;
      try {
        const qRes = await dbHelpers.pool.query(
          `SELECT id, question_text, options, correct_answer, explanation, subject, topic, chapter, difficulty, marks, negative_marks, tags FROM questions WHERE id::text = $1 OR public_id = $1 LIMIT 1`,
          [String(itemId)],
        );
        if (qRes.rows.length > 0) return dbHelpers.toCamel(qRes.rows[0]);
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

// All bookmark routes require authentication
router.use(protect);

// @route   GET /api/bookmarks/count
// @desc    Get total count of active bookmarks for logged in user
// @access  Private
router.get("/count", async (req, res) => {
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
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      100,
    );
    const offset = (page - 1) * limit;
    const includeDetails = req.query.includeDetails !== "false";

    const bookmarks = await dbHelpers.find(
      "bookmarks",
      {
        userId: req.user.id,
        isActive: true,
      },
      limit,
      offset,
    );

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

    // Enrich bookmark data with actual item details
    const enrichedBookmarks = await Promise.all(
      bookmarks.map(async (bookmark) => {
        let itemDetails = null;

        try {
          // Fetch details based on item type
          itemDetails = await resolveBookmarkEntity(
            bookmark.itemType,
            bookmark.itemId,
          );
        } catch (error) {
          console.warn(
            `Failed to enrich bookmark ${bookmark._id}:`,
            error.message,
          );
        }

        return {
          ...bookmark,
          item: itemDetails,
        };
      }),
    );

    res.json({
      success: true,
      data: enrichedBookmarks,
      count: enrichedBookmarks.length,
    });
  } catch (error) {
    console.error("Get bookmarks error:", error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

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

    // Check if already bookmarked
    const existing = (
      await dbHelpers.find("bookmarks", {
        userId: req.user.id,
        itemType,
        isActive: true,
      })
    ).find((bookmark) => idsMatch(bookmark.itemId, canonicalItemId));

    if (existing) {
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
router.put("/:id", async (req, res) => {
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

    const updated = await dbHelpers.updateById(
      "bookmarks",
      getInternalId(bookmark),
      {
        notes: notes !== undefined ? notes : bookmark.notes,
        title: title !== undefined ? title : bookmark.title,
        updatedAt: new Date().toISOString(),
      },
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
router.delete("/:id", async (req, res) => {
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
router.get("/check/:itemType/:itemId", async (req, res) => {
  try {
    const { itemType, itemId } = req.params;

    const bookmark = (
      await dbHelpers.find("bookmarks", {
        userId: req.user.id,
        itemType,
        isActive: true,
      })
    ).find((entry) => idsMatch(entry.itemId, itemId));

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
});

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

    // Check if already bookmarked
    const existing = (
      await dbHelpers.find("bookmarks", {
        userId: req.user.id,
        itemType,
        isActive: true,
      })
    ).find((bookmark) => idsMatch(bookmark.itemId, itemId));

    if (existing) {
      // Remove bookmark
      await dbHelpers.updateById("bookmarks", existing._id || existing.id, {
        isActive: false,
        deletedAt: new Date().toISOString(),
      });

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

      // Add bookmark
      const bookmark = await dbHelpers.insertOne("bookmarks", {
        userId: req.user.id,
        itemId: String(itemId),
        itemType,
        title: sanitizedTitle,
        notes: "",
        isActive: true,
        createdAt: new Date().toISOString(),
      });

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
