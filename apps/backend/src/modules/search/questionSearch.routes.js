import express from "express";
import { protect, admin } from "../../middleware/auth.middleware.js";
import { aiRateLimiter } from "../../middleware/aiRateLimiter.js";
import questionSearchService from "./questionSearch.service.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

const router = express.Router();

router.get("/search", protect, aiRateLimiter, async (req, res) => {
  try {
    const {
      q,
      difficulty,
      topicId,
      subject,
      language,
      limit = 20,
      offset = 0,
    } = req.query;
    if (!q) {
      return res
        .status(400)
        .json({ success: false, message: "Search query (q) is required" });
    }
    const results = await questionSearchService.searchByText(q, {
      difficulty,
      topicId,
      subject,
      language,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    res.json({ success: true, data: results });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/search/embedding", protect, aiRateLimiter, async (req, res) => {
  try {
    const {
      embedding,
      difficulty,
      topicId,
      subject,
      language,
      limit = 20,
      threshold = 0.8,
    } = req.body;
    if (!embedding) {
      return res
        .status(400)
        .json({ success: false, message: "Embedding is required" });
    }
    const results = await questionSearchService.searchByEmbedding(embedding, {
      difficulty,
      topicId,
      subject,
      language,
      limit: parseInt(limit),
      threshold: parseFloat(threshold),
    });
    res.json({ success: true, data: results });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post("/search/keywords", protect, aiRateLimiter, async (req, res) => {
  try {
    const { keywords, difficulty, topicId, limit = 20 } = req.body;
    if (!keywords || !Array.isArray(keywords)) {
      return res
        .status(400)
        .json({ success: false, message: "Keywords array is required" });
    }
    const results = await questionSearchService.searchByKeywords(keywords, {
      difficulty,
      topicId,
      limit: parseInt(limit),
    });
    res.json({ success: true, data: results });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.get("/stats", protect, admin, aiRateLimiter, async (req, res) => {
  try {
    const stats = await questionSearchService.getIndexStats();
    const unindexed = await questionSearchService.getUnindexedCount();
    res.json({ success: true, data: { ...stats, unindexed_count: unindexed } });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.post(
  "/index/:questionId",
  protect,
  admin,
  aiRateLimiter,
  async (req, res, next) => {
    // Registered before POST /index/bulk: forward the literal so the bulk
    // endpoint is not parsed as a question id (it was unreachable).
    if (req.params.questionId === "bulk") return next();
    try {
      const entry = await questionSearchService.indexQuestion(
        req.params.questionId,
      );
      res.json({ success: true, data: entry });
    } catch (error) {
      res
        .status(400)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

router.post("/index/bulk", protect, admin, aiRateLimiter, async (req, res) => {
  try {
    // Cursor passthrough (15): afterId/maxPages forwarded to the service
    // (bulkIndex caps at 50 ids per call); truncated flag (18) when sliced.
    const requested = parseInt(req.body.limit) || 50;
    const limit = Math.min(requested, 50);
    const truncated = requested > 50;
    const afterId = req.body.afterId ?? req.body.afterCursor ?? null;
    const maxPages = parseInt(req.body.maxPages) || 1;
    const indexed = await questionSearchService.bulkIndex(
      limit,
      afterId,
      maxPages,
    );
    res.json({ success: true, data: { indexed, truncated } });
  } catch (error) {
    res
      .status(400)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

router.delete(
  "/index/:questionId",
  protect,
  admin,
  aiRateLimiter,
  async (req, res) => {
    try {
      await questionSearchService.removeFromIndex(req.params.questionId);
      res.json({ success: true, message: "Removed from search index" });
    } catch (error) {
      res
        .status(400)
        .json({ success: false, message: sanitizeErrorMessage(error) });
    }
  },
);

router.get("/:id", protect, aiRateLimiter, async (req, res) => {
  try {
    const entry = await questionSearchService.getById(req.params.id);
    if (!entry) {
      return res
        .status(404)
        .json({ success: false, message: "Entry not found" });
    }
    res.json({ success: true, data: entry });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
