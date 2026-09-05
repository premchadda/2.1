import express from "express";
import {
  dbHelpers,
  pool,
} from "../../infrastructure/database/postgres-helpers.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import liveMockService from "../../modules/live/liveMock.service.js";
import {
  getLiveTestCandidates,
  executeProctorIntervention,
} from "../../services/core/liveProctoringConsoleService.js";

const router = express.Router();

// GET /api/admin/live-tests - List all live test sessions
router.get("/", async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * parsedLimit;

    const query = `
      SELECT 
        lt.id, lt.test_id, lt.start_time, lt.end_time, lt.result_time,
        lt.is_active, lt.registration_open, lt.max_participants,
        lt.chat_enabled, lt.is_all_india_mock, lt.created_at, lt.updated_at,
        t.title as test_title, t.slug as test_slug, t.duration, t.total_marks,
        t.passing_marks, t.exam_id, t.series_id,
        (SELECT COUNT(*)::int FROM attempts a WHERE a.test_id = lt.test_id) as participants_count
      FROM live_tests lt
      LEFT JOIN tests t ON t.id = lt.test_id
      ORDER BY lt.start_time DESC NULLS LAST
      LIMIT $1 OFFSET $2
    `;

    const countRes = await pool.query(
      "SELECT COUNT(*)::int as total FROM live_tests",
    );
    const total = countRes.rows[0]?.total || 0;

    const result = await pool.query(query, [parsedLimit, offset]);
    const liveTests = result.rows.map((r) => dbHelpers.toCamel(r));

    res.json({
      success: true,
      data: liveTests,
      total,
      pagination: {
        page: parseInt(page, 10) || 1,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// POST /api/admin/live-tests - Create a live test session
router.post("/", async (req, res) => {
  try {
    const session = await liveMockService.createSession(req.body);
    res.status(201).json({
      success: true,
      data: dbHelpers.toCamel(session),
      message: "Live test created successfully",
    });
  } catch (error) {
    res
      .status(400)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// POST /api/admin/live-tests/bulk - Bulk create live tests
router.post("/bulk", async (req, res) => {
  try {
    const { items = [] } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Array of live tests is required" });
    }

    const created = [];
    for (const item of items) {
      try {
        const session = await liveMockService.createSession(item);
        created.push(dbHelpers.toCamel(session));
      } catch (err) {
        console.warn("[AdminLiveTests] Bulk item error:", err.message);
      }
    }

    res.status(201).json({
      success: true,
      data: created,
      count: created.length,
      message: `Created ${created.length} of ${items.length} live tests`,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// GET /api/admin/live-tests/:id - Get live test by ID
router.get("/:id", async (req, res) => {
  try {
    const test = await liveMockService.getById(req.params.id);
    if (!test) {
      return res
        .status(404)
        .json({ success: false, message: "Live test not found" });
    }
    res.json({ success: true, data: dbHelpers.toCamel(test) });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// PUT /api/admin/live-tests/:id - Update live test
router.put("/:id", async (req, res) => {
  try {
    const updated = await dbHelpers.updateById("liveTests", req.params.id, {
      ...req.body,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Live test not found" });
    }
    res.json({ success: true, data: updated, message: "Live test updated" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// DELETE /api/admin/live-tests/:id - Delete live test
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await dbHelpers.deleteById("liveTests", req.params.id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Live test not found" });
    }
    res.json({ success: true, message: "Live test deleted" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// GET /api/admin/live-tests/:id/proctoring/candidates - Live candidate integrity monitoring
router.get("/:id/proctoring/candidates", async (req, res) => {
  try {
    const { minRiskScore = 0 } = req.query;
    const data = await getLiveTestCandidates(req.params.id, { minRiskScore });
    res.json({ success: true, data });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

// POST /api/admin/live-tests/:id/proctoring/intervene - Real-time proctor intervention command
router.post("/:id/proctoring/intervene", async (req, res) => {
  try {
    const { attemptId, action, reason } = req.body || {};
    if (!attemptId || !action) {
      return res
        .status(400)
        .json({ success: false, message: "attemptId and action are required" });
    }
    const proctorId = req.user?.id || "admin";
    const result = await executeProctorIntervention(req.params.id, attemptId, {
      action,
      reason,
      proctorId,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    const status = error.statusCode || 500;
    res
      .status(status)
      .json({ success: false, message: sanitizeErrorMessage(error) });
  }
});

export default router;
