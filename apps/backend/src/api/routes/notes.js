/**
 * Question Notes API Routes
 * Authenticated CRUD endpoints for student question notes.
 *
 * Endpoints:
 *   GET    /api/notes                List notes for user (filtered by questionId, contextId)
 *   POST   /api/notes                Create a new note
 *   PUT    /api/notes/:id            Update an existing note's text
 *   DELETE /api/notes/:id            Delete a note
 */

import express from "express";
import rateLimit from "express-rate-limit";
import { pool } from "../../infrastructure/database/postgres-helpers.js";
import { protect } from "../../middleware/auth.middleware.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

const router = express.Router();

// Enforce authentication on all note routes
router.use(protect);

// Rate limiter for note operations (prevent spamming/scraping)
const notesLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // 150 requests per 15 minutes
  message: {
    success: false,
    message: "Too many note requests. Please slow down.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(notesLimiter);

// UUID format validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/notes
 * Returns notes for the authenticated user.
 * Optional query parameters:
 *   - questionId: filter notes for a specific question
 *   - contextId: filter notes for a specific context
 *   - limit: maximum results (default 50, max 100)
 *   - offset: pagination offset (default 0)
 */
router.get("/", async (req, res) => {
  try {
    const questionId = req.query.questionId || req.query.question_id;
    const contextId = req.query.contextId || req.query.context_id;
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 50, 1),
      100,
    );
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const params = [req.user.id];
    const whereClauses = ["user_id = $1"];

    if (questionId) {
      params.push(String(questionId).trim());
      whereClauses.push(`question_id = $${params.length}`);
    }

    if (contextId) {
      params.push(String(contextId).trim());
      whereClauses.push(`context_id = $${params.length}`);
    }

    const query = `
      SELECT
        id,
        question_id AS "questionId",
        context_id AS "contextId",
        note_text AS "noteText",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM question_notes
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error("GET /api/notes error:", error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

/**
 * POST /api/notes
 * Creates a new note for the authenticated user.
 * Request body: { questionId, contextId, noteText }
 */
router.post("/", async (req, res) => {
  try {
    const questionId = req.body.questionId || req.body.question_id;
    const contextId = req.body.contextId || req.body.context_id || null;
    const rawNoteText =
      req.body.noteText ?? req.body.note_text ?? req.body.text;

    if (
      !questionId ||
      (typeof questionId !== "string" && typeof questionId !== "number")
    ) {
      return res.status(400).json({
        success: false,
        message: "questionId is required",
      });
    }

    if (
      !rawNoteText ||
      typeof rawNoteText !== "string" ||
      !rawNoteText.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "noteText is required and cannot be empty",
      });
    }

    const trimmedNoteText = rawNoteText.trim();
    if (trimmedNoteText.length > 10000) {
      return res.status(400).json({
        success: false,
        message: "noteText exceeds maximum limit of 10,000 characters",
      });
    }

    const insertQuery = `
      INSERT INTO question_notes (user_id, question_id, context_id, note_text)
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        question_id AS "questionId",
        context_id AS "contextId",
        note_text AS "noteText",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;

    const result = await pool.query(insertQuery, [
      req.user.id,
      String(questionId).trim(),
      contextId ? String(contextId).trim() : null,
      trimmedNoteText,
    ]);

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: "Note created successfully",
    });
  } catch (error) {
    console.error("POST /api/notes error:", error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

/**
 * PUT /api/notes/:id
 * Updates an existing note belonging to the authenticated user.
 * Request body: { noteText }
 */
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid note ID format",
      });
    }

    const rawNoteText =
      req.body.noteText ?? req.body.note_text ?? req.body.text;
    if (
      !rawNoteText ||
      typeof rawNoteText !== "string" ||
      !rawNoteText.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "noteText is required and cannot be empty",
      });
    }

    const trimmedNoteText = rawNoteText.trim();
    if (trimmedNoteText.length > 10000) {
      return res.status(400).json({
        success: false,
        message: "noteText exceeds maximum limit of 10,000 characters",
      });
    }

    const updateQuery = `
      UPDATE question_notes
      SET note_text = $1, updated_at = NOW()
      WHERE id = $2 AND user_id = $3
      RETURNING
        id,
        question_id AS "questionId",
        context_id AS "contextId",
        note_text AS "noteText",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `;

    const result = await pool.query(updateQuery, [
      trimmedNoteText,
      id,
      req.user.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: "Note updated successfully",
    });
  } catch (error) {
    console.error("PUT /api/notes/:id error:", error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

/**
 * DELETE /api/notes/:id
 * Deletes a note belonging to the authenticated user.
 */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid note ID format",
      });
    }

    const deleteQuery = `
      DELETE FROM question_notes
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;

    const result = await pool.query(deleteQuery, [id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    res.json({
      success: true,
      message: "Note deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /api/notes/:id error:", error);
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    });
  }
});

export default router;
