/**
 * Practice Lab Routes — Phase 1
 * Full spec: docs/specifications/PRACTICE_LAB_PRD.md
 *
 * Phase 1 endpoints (all require auth):
 *   GET    /api/practice/tree                  Curriculum tree pruned to practice questions
 *   GET    /api/practice/topics/:topicId/stats Question count, difficulty split, user mastery
 *   POST   /api/practice/sessions              Start a new practice session
 *   GET    /api/practice/sessions/active       User's active (uncompleted) session
 *   GET    /api/practice/sessions/:id          Full session state
 *   PATCH  /api/practice/sessions/:id          Update current_index (autosave)
 *   POST   /api/practice/sessions/:id/complete Mark session complete; update streak + mastery
 *   GET    /api/practice/sessions/:id/questions/:idx   Fetch full question at index
 *   POST   /api/practice/sessions/:id/questions/:idx/check   Submit answer, log to practice_answers
 *   POST   /api/practice/sessions/:id/questions/:idx/skip   Mark as skipped, move on
 *   GET    /api/practice/bookmarks             User's bookmarked questions
 *   GET    /api/practice/bookmarks/count       Count
 *   POST   /api/practice/bookmarks/:questionId Add bookmark
 *   DELETE /api/practice/bookmarks/:questionId Remove bookmark
 *   GET    /api/practice/mistakes              User's wrong questions
 *   GET    /api/practice/mistakes/count        Count
 *   GET    /api/practice/dashboard             Aggregated entry-screen payload
 *
 * Legacy endpoints preserved for backwards compatibility (now auth-required,
 * answer keys stripped — see security fix):
 *   GET    /api/practice/questions
 *   GET    /api/practice/questions/:id
 */

import express from "express";
import {
  pool,
  dbHelpers,
} from "../../infrastructure/database/postgres-helpers.js";
import { readQuery } from "../../../config/database-replicas.js";
import { protect, admin } from "../../middleware/auth.middleware.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";
import { createRateLimiter } from "../../middleware/rateLimiterFactory.js";
import { recordPracticeAnalytics } from "../../services/core/analyticsService.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";
import { getUnifiedBookmarkedQuestionIds } from "./bookmarks.js";

const router = express.Router();
const practiceSubmissionLimiter = createRateLimiter("moderate");

// PII guard for admin list endpoints: mask emails (detail-by-id keeps full email)
const maskEmail = () => "***@***";
const maskPiiRow = (row) => {
  const safe = { ...row };
  if (safe.user_email) safe.user_email = maskEmail();
  if (safe.userEmail) safe.userEmail = maskEmail();
  if (safe.email) safe.email = maskEmail();
  return safe;
};

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

const PRACTICE_Q_WHERE = `
  (q.is_deleted = false OR q.is_deleted IS NULL)
  AND (q.is_active = true OR q.is_active IS NULL)
`;

/**
 * Get count of practice questions matching a WHERE fragment.
 */
async function countPracticeQuestions(extraWhere = "", params = []) {
  const where = PRACTICE_Q_WHERE + (extraWhere ? ` AND ${extraWhere}` : "");
  const r = await pool.query(
    `SELECT COUNT(*)::int AS c FROM questions q WHERE ${where}`,
    params,
  );
  return r.rows[0]?.c || 0;
}

/**
 * Resolves slug or string identifiers for exams, subjects, chapters, and topics into integer primary keys.
 */
async function resolvePracticeFilters({
  examId,
  subjectId,
  chapterId,
  topicId,
} = {}) {
  // The four slug->id lookups are independent of each other, so they run
  // concurrently via Promise.all (previously four serial round-trips).
  // Numeric fast-paths resolve synchronously; only non-numeric provided
  // values hit the database. Absent/empty values resolve to null as before.
  const hasValue = (v) => v !== undefined && v !== null && v !== "";
  const asNumber = (v) => (hasValue(v) && !isNaN(Number(v)) ? Number(v) : null);
  const needsLookup = (v) => hasValue(v) && isNaN(Number(v));
  const norm = (v) => String(v).trim();

  const lookupSubject = async () => {
    if (!needsLookup(subjectId)) return asNumber(subjectId);
    try {
      const sRes = await pool.query(
        `SELECT id FROM subjects WHERE slug = $1 OR LOWER(name) = LOWER($1) LIMIT 1`,
        [norm(subjectId)],
      );
      if (sRes.rows.length) return sRes.rows[0].id;
    } catch (err) {
      console.warn(
        "[resolvePracticeFilters] Subject resolve failed:",
        err.message,
      );
    }
    return null;
  };

  const lookupChapter = async () => {
    if (!needsLookup(chapterId)) return asNumber(chapterId);
    try {
      const cRes = await pool.query(
        `SELECT id FROM subject_chapters
           WHERE slug = $1
              OR public_id = $1
              OR LOWER(title) = LOWER($1)
              OR LOWER(REPLACE(title, ' ', '-')) = LOWER($1)
           LIMIT 1`,
        [norm(chapterId)],
      );
      if (cRes.rows.length) return cRes.rows[0].id;
    } catch (err) {
      console.warn(
        "[resolvePracticeFilters] Chapter resolve failed:",
        err.message,
      );
    }
    return null;
  };

  const lookupTopic = async () => {
    if (!needsLookup(topicId)) return asNumber(topicId);
    try {
      const tRes = await pool.query(
        `SELECT id FROM subject_topics
           WHERE slug = $1
              OR LOWER(name) = LOWER($1)
              OR LOWER(REPLACE(name, ' ', '-')) = LOWER($1)
           LIMIT 1`,
        [norm(topicId)],
      );
      if (tRes.rows.length) return tRes.rows[0].id;
    } catch (err) {
      console.warn(
        "[resolvePracticeFilters] Topic resolve failed:",
        err.message,
      );
    }
    return null;
  };

  const lookupExam = async () => {
    if (!needsLookup(examId)) return asNumber(examId);
    try {
      const eRes = await pool.query(
        `SELECT id FROM exams WHERE slug = $1 OR code = $1 OR LOWER(title) = LOWER($1) LIMIT 1`,
        [norm(examId)],
      );
      if (eRes.rows.length) return eRes.rows[0].id;
    } catch (err) {
      console.warn(
        "[resolvePracticeFilters] Exam resolve failed:",
        err.message,
      );
    }
    return null;
  };

  const [
    resolvedSubjectId,
    resolvedChapterId,
    resolvedTopicId,
    resolvedExamId,
  ] = await Promise.all([
    lookupSubject(),
    lookupChapter(),
    lookupTopic(),
    lookupExam(),
  ]);

  return {
    examId: resolvedExamId,
    subjectId: resolvedSubjectId,
    chapterId: resolvedChapterId,
    topicId: resolvedTopicId,
  };
}

/**
 * Pick N random practice question IDs matching filters.
 */
async function pickPracticeQuestionIds({
  subjectId,
  chapterId,
  topicId,
  subtopicId,
  difficulty,
  mode,
  count,
  userId,
  testId,
  questionId,
  resolvedFilters = null,
}) {
  const resolved =
    resolvedFilters ||
    (await resolvePracticeFilters({
      subjectId,
      chapterId,
      topicId,
    }));
  let finalSubjectId = resolved.subjectId;
  let finalChapterId = resolved.chapterId;
  let finalTopicId = resolved.topicId;

  const conditions = [PRACTICE_Q_WHERE];
  const params = [];
  let idx = 1;

  // "similar" deep link: seed the filters from the referenced question's own
  // topic/chapter/subject so the drill matches the question the user came from.
  if (mode === "similar" && questionId) {
    const seedId = Number(questionId);
    if (Number.isInteger(seedId) && seedId > 0) {
      try {
        const seed = await pool.query(
          `SELECT topic_id, chapter_id, subject_id, difficulty FROM questions WHERE id = $1 LIMIT 1`,
          [seedId],
        );
        const seedRow = seed.rows[0];
        if (seedRow) {
          if (!finalTopicId && seedRow.topic_id)
            finalTopicId = seedRow.topic_id;
          if (!finalChapterId && seedRow.chapter_id)
            finalChapterId = seedRow.chapter_id;
          if (!finalSubjectId && seedRow.subject_id)
            finalSubjectId = seedRow.subject_id;
          conditions.push(`q.id <> $${idx}`);
          params.push(seedId);
          idx++;
        }
      } catch (seedErr) {
        console.warn("[Practice similar seed]", seedErr.message);
      }
    }
  }

  if (subtopicId) {
    const sId = Number(subtopicId);
    if (!isNaN(sId) && sId > 0) {
      conditions.push(`q.subtopic_id = $${idx}`);
      params.push(sId);
      idx++;
    }
  }

  if (finalTopicId) {
    conditions.push(`q.topic_id = $${idx}`);
    params.push(finalTopicId);
    idx++;
  }
  if (finalChapterId) {
    // Questions linked to chapter_id directly OR topics under this chapter
    conditions.push(`(
      q.chapter_id = $${idx}
      OR q.topic_id IN (SELECT id FROM subject_topics WHERE chapter_id = $${idx})
    )`);
    params.push(finalChapterId);
    idx++;
  }
  if (finalSubjectId) {
    conditions.push(`(
      q.subject_id = $${idx}
      OR q.chapter_id IN (SELECT id FROM subject_chapters WHERE subject_id = $${idx} OR study_material_id = $${idx})
      OR q.topic_id IN (
        SELECT t.id FROM subject_topics t
        JOIN subject_chapters c ON t.chapter_id = c.id
        WHERE (c.study_material_id = $${idx} OR c.subject_id = $${idx})
      )
    )`);
    params.push(finalSubjectId);
    idx++;
  }
  if (difficulty && difficulty !== "mixed") {
    conditions.push(`LOWER(q.difficulty) = LOWER($${idx})`);
    params.push(difficulty);
    idx++;
  }

  // Mode-specific filters
  if (mode === "mistakes") {
    if (testId && !isNaN(Number(testId))) {
      conditions.push(`(
        q.id IN (
          SELECT question_id FROM wrong_questions
          WHERE user_id = $${idx} AND (test_id = $${idx + 1} OR source_attempt_id = $${idx + 1}) AND (is_active = true OR is_active IS NULL)
        )
        OR q.id IN (
          SELECT question_id FROM practice_answers
          WHERE user_id = $${idx} AND is_correct = false
        )
      )`);
      params.push(userId, Number(testId));
      idx += 2;
    } else {
      conditions.push(`(
        q.id IN (
          SELECT question_id FROM wrong_questions
          WHERE user_id = $${idx} AND (is_active = true OR is_active IS NULL)
        )
        OR q.id IN (
          SELECT question_id FROM practice_answers
          WHERE user_id = $${idx} AND is_correct = false
        )
      )`);
      params.push(userId);
      idx++;
    }
  } else if (mode === "weak_topic") {
    // Smart Practice: reinforce the user's weakest topics (accuracy < 70%
    // across recent practice answers — input capped to the latest 5000 rows
    // so heavy users don't aggregate their entire answer history per start).
    // Falls back to the generic random selection below when the user has no
    // answer history yet, or if the detection query fails for any reason.
    let weakTopicIds = [];
    try {
      const weak = await pool.query(
        `
        SELECT q2.topic_id
        FROM (
          SELECT question_id, is_correct FROM practice_answers
          WHERE user_id = $1
          ORDER BY id DESC
          LIMIT 5000
        ) pa
        JOIN questions q2 ON q2.id = pa.question_id
        WHERE q2.topic_id IS NOT NULL
        GROUP BY q2.topic_id
        HAVING (COUNT(*) FILTER (WHERE pa.is_correct))::numeric
                 / NULLIF(COUNT(*), 0) < 0.7
        ORDER BY (COUNT(*) FILTER (WHERE pa.is_correct))::numeric
                 / NULLIF(COUNT(*), 0) ASC
        LIMIT 5
      `,
        [userId],
      );
      weakTopicIds = weak.rows.map((r) => r.topic_id);
    } catch (weakErr) {
      console.warn("[Practice weak_topic detection]", weakErr.message);
    }
    if (weakTopicIds.length) {
      conditions.push(`q.topic_id = ANY($${idx}::int[])`);
      params.push(weakTopicIds);
      idx++;
    }
  } else if (mode === "bookmark") {
    // Unified bookmark reads (practice ↔ generic store bridge, best-effort):
    // helper unions legacy question_bookmarks + generic bookmarks
    // (item_type='question'). Empty set → return [] early (no query).
    // Fail-soft: helper throws → legacy question_bookmarks-only subquery.
    let unifiedBookmarkIds = null;
    try {
      unifiedBookmarkIds = await getUnifiedBookmarkedQuestionIds(userId);
    } catch {
      unifiedBookmarkIds = null;
    }
    if (Array.isArray(unifiedBookmarkIds)) {
      if (!unifiedBookmarkIds.length) return [];
      conditions.push(`q.id = ANY($${idx}::int[])`);
      params.push(unifiedBookmarkIds);
      idx++;
    } else {
      conditions.push(
        `q.id IN (SELECT question_id FROM question_bookmarks WHERE user_id = $${idx})`,
      );
      params.push(userId);
      idx++;
    }
  } else if (mode === "pyq") {
    conditions.push(`q.tags @> ARRAY['pyq']::text[]`);
  }

  // Adaptive: order by difficulty asc (Easy first), we'll adjust on the fly
  const orderBy =
    mode === "adaptive"
      ? `CASE LOWER(COALESCE(q.difficulty,'medium')) WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, RANDOM()`
      : `RANDOM()`;

  const limit = Math.min(Math.max(Number(count) || 20, 1), 200);

  // Fast random path: TABLESAMPLE BERNOULLI pre-filters to ~20% of the
  // matching rows before ORDER BY RANDOM() sorts, so large question banks
  // avoid a full-table sort. Not all table layouts support TABLESAMPLE
  // (e.g. some foreign tables / RLS edge cases) — fall back to the plain
  // ORDER BY RANDOM() LIMIT variant on any error, and to random_sort if a
  // LIMIT pushdown helper exists. Either path returns the same shape.
  const whereSql = conditions.join(" AND ");
  const sampledSql = `
    SELECT q.id FROM questions q TABLESAMPLE BERNOULLI(20)
    WHERE ${whereSql}
    ORDER BY ${orderBy}
    LIMIT $${idx}
  `;
  const fallbackSql = `
    SELECT q.id FROM questions q
    WHERE ${whereSql}
    ORDER BY ${orderBy}
    LIMIT $${idx}
  `;
  const sampleParams = [...params, limit];
  try {
    const r = await pool.query(sampledSql, sampleParams);
    // BERNOULLI is probabilistic — an unlucky sample can return fewer rows
    // than LIMIT even when matches exist. Top up with the exact fallback
    // excluding already-picked ids so callers always get a full page.
    if (r.rows.length >= limit) return r.rows.map((row) => row.id);
    const picked = r.rows.map((row) => row.id);
    if (!picked.length) throw new Error("empty sample — use fallback");
    const topUp = await pool.query(
      `
      SELECT q.id FROM questions q
      WHERE ${whereSql} AND q.id <> ALL($${idx + 1}::int[])
      ORDER BY ${orderBy}
      LIMIT $${idx + 2}
      `,
      [...params, picked, limit - picked.length],
    );
    return [...picked, ...topUp.rows.map((row) => row.id)];
  } catch {
    // TABLESAMPLE unavailable for this table/layout — exact fallback.
    const r = await pool.query(fallbackSql, sampleParams);
    return r.rows.map((row) => row.id);
  }
}

/**
 * Get a question for the user, stripping the correct answer.
 */
async function getSafeQuestion(questionId) {
  const r = await pool.query(
    `
    SELECT q.id, q.test_id, q.question_text, q.options, q.explanation, q.subject, q.topic,
           q.difficulty, q.language, q.topic_id,
           q.subject_id,
           q.question_text_hi, q.options_hi, q.explanation_hi,
           q.source_config, q.tags, q.source,
           t.title AS test_title
    FROM questions q
    LEFT JOIN tests t ON q.test_id = t.id
    WHERE q.id = $1 AND (q.is_active = true OR q.is_active IS NULL)
  `,
    [questionId],
  );
  if (!r.rows.length) return null;
  return toSafeQuestion(r.rows[0]);
}

function toSafeQuestion(rawRow) {
  const row = dbHelpers.toCamel(rawRow);
  // Strip answer fields
  const {
    correctAnswer,
    correct_option,
    correctOption,
    correct,
    answer,
    isCorrect,
    is_correct,
    ...safe
  } = row;
  if (rawRow.test_title && !safe.testTitle) {
    safe.testTitle = rawRow.test_title;
  }
  if (safe.testTitle && !safe.test_title) {
    safe.test_title = safe.testTitle;
  }
  return safe;
}

/**
 * Hydrate a session's questions in one query while preserving the selected order.
 */
async function getSafeQuestions(questionIds = []) {
  const ids = questionIds.filter((id) => id !== undefined && id !== null);
  if (!ids.length) return [];

  const r = await pool.query(
    `
    SELECT q.id, q.test_id, q.question_text, q.options, q.explanation, q.subject, q.topic,
           q.difficulty, q.language, q.topic_id, q.subject_id,
           q.question_text_hi, q.options_hi, q.explanation_hi,
           q.source_config, q.tags, q.source,
           t.title AS test_title
    FROM questions q
    LEFT JOIN tests t ON q.test_id = t.id
    WHERE q.id = ANY($1::int[])
      AND (q.is_active = true OR q.is_active IS NULL)
    `,
    [ids],
  );
  const byId = new Map(
    r.rows.map((row) => [String(row.id), toSafeQuestion(row)]),
  );
  return ids.map((id) => byId.get(String(id))).filter(Boolean);
}

function parsePositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function toNullableInt(value) {
  if (
    value === undefined ||
    value === null ||
    value === "undefined" ||
    value === "null" ||
    value === ""
  ) {
    return null;
  }
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeOptionIndex(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  const numeric = Number(raw);
  if (Number.isInteger(numeric) && numeric >= 0) return numeric;
  const letter = String(raw).trim().toUpperCase();
  return /^[A-Z]$/.test(letter) ? letter.charCodeAt(0) - 65 : null;
}

/**
 * Get the correct option index for a question (handles multiple field names).
 */
async function getCorrectOption(questionId) {
  const r = await pool.query(
    `
    SELECT correct_option, correct_answer, options
    FROM questions WHERE id = $1
  `,
    [questionId],
  );
  if (!r.rows.length) return null;
  const row = dbHelpers.toCamel(r.rows[0]);
  const raw = row.correctOption ?? row.correctAnswer;
  if (raw !== undefined && raw !== null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && Number.isInteger(n)) return n;
    const s = String(raw).trim().toUpperCase();
    if (/^[A-D]$/.test(s)) return s.charCodeAt(0) - 65;
  }
  const opts = Array.isArray(row.options) ? row.options : [];
  if (opts.length > 0) {
    const idx = opts.findIndex((o) => {
      if (typeof o === "object" && o !== null) {
        if (o.isCorrect || o.is_correct) return true;
        if (raw && (o.text === raw || o.id === raw)) return true;
      }
      return o === raw;
    });
    if (idx !== -1) return idx;
  }
  return null;
}

/**
 * Recompute mastery % for a user+topic from practice_answers + question_attempts.
 * Written to user_topic_performance (if table exists) or returned directly.
 */
async function computeTopicMastery(userId, topicId, queryRunner = pool) {
  // Pull practice answers for this topic, capped to the latest 5000 rows
  // (mirrors the weak_topic detection cap in pickPracticeQuestionIds) so
  // heavy users don't aggregate their entire answer history per call.
  const runner = queryRunner || pool;
  const r = await runner.query(
    `
    SELECT pa.is_correct, q.difficulty
    FROM practice_answers pa
    JOIN questions q ON pa.question_id = q.id
    WHERE pa.user_id = $1 AND q.topic_id = $2
    ORDER BY pa.created_at DESC
    LIMIT 5000
  `,
    [userId, topicId],
  );
  if (!r.rows.length) return { mastery: 0, attempts: 0 };
  let weighted = 0,
    total = 0;
  for (const row of r.rows) {
    const diff = (row.difficulty || "medium").toLowerCase();
    const weight = diff === "hard" ? 1.5 : diff === "medium" ? 1.2 : 1.0;
    total++;
    if (row.is_correct) weighted += weight;
  }
  const mastery = Math.min(100, Math.round((weighted / total) * 100));
  return { mastery, attempts: total, mastered: total >= 20 && mastery >= 80 };
}

/**
 * Update streak row after a completed session.
 *
 * Single atomic INSERT ... ON CONFLICT (user_id) upsert — user_id is the
 * PRIMARY KEY of practice_streaks (migration 065), so concurrent completes
 * for the same user serialize on the row lock instead of racing a
 * SELECT-then-INSERT/UPDATE pair (duplicate-key errors / lost increments).
 *
 * Pass the caller's transaction client as `queryRunner` to run inside the
 * complete transaction; falls back to `pool` for standalone callers.
 * `totals` folds the post-complete total_questions/total_correct bump into
 * the same statement so no second UPDATE is needed.
 */
async function bumpStreak(
  userId,
  queryRunner = pool,
  totals = { questions: 0, correct: 0 },
) {
  const runner = queryRunner || pool;
  const today = new Date().toISOString().slice(0, 10);
  const totalQuestions = Number(totals?.questions || 0);
  const totalCorrect = Number(totals?.correct || 0);
  const r = await runner.query(
    `
    INSERT INTO practice_streaks (user_id, current_streak, longest_streak, last_practice_date, total_sessions, total_questions, total_correct)
    VALUES ($1, 1, 1, $2, 1, $3, $4)
    ON CONFLICT (user_id) DO UPDATE SET
      current_streak = CASE
        WHEN practice_streaks.last_practice_date = EXCLUDED.last_practice_date THEN practice_streaks.current_streak
        WHEN practice_streaks.last_practice_date = (EXCLUDED.last_practice_date - INTERVAL '1 day')::date THEN practice_streaks.current_streak + 1
        ELSE 1
      END,
      longest_streak = GREATEST(practice_streaks.longest_streak, CASE
        WHEN practice_streaks.last_practice_date = EXCLUDED.last_practice_date THEN practice_streaks.current_streak
        WHEN practice_streaks.last_practice_date = (EXCLUDED.last_practice_date - INTERVAL '1 day')::date THEN practice_streaks.current_streak + 1
        ELSE 1
      END),
      last_practice_date = CASE
        WHEN practice_streaks.last_practice_date = EXCLUDED.last_practice_date THEN practice_streaks.last_practice_date
        ELSE EXCLUDED.last_practice_date
      END,
      total_sessions = practice_streaks.total_sessions + 1,
      total_questions = practice_streaks.total_questions + EXCLUDED.total_questions,
      total_correct = practice_streaks.total_correct + EXCLUDED.total_correct
    RETURNING current_streak, longest_streak
  `,
    [userId, today, totalQuestions, totalCorrect],
  );
  const row = r.rows[0] || {};
  return {
    current: Number(row.current_streak ?? 1),
    longest: Number(row.longest_streak ?? 1),
  };
}

// ═══════════════════════════════════════════════════
// TREE & METADATA
// ═══════════════════════════════════════════════════

/**
 * GET /api/practice/tree
 * Returns a pruned curriculum tree: exam → subject → chapter → topic,
 * only branches that contain at least one practice question.
 */
let _practiceTreeCache = null;
let _practiceTreeCacheExpires = 0;

router.get(
  "/tree",
  protect,
  responseCache("practice-tree", 300, { userScoped: false }),
  async (req, res) => {
    try {
      if (_practiceTreeCache && Date.now() < _practiceTreeCacheExpires) {
        return res.json({
          success: true,
          data: { subjects: _practiceTreeCache },
        });
      }

      // Practice question counts per topic_id
      // Curriculum metadata is independent of the question aggregate, so run
      // both reads together. The old implementation did four serial queries.
      const [qCounts, curriculum] = await Promise.all([
        pool.query(`
        SELECT q.topic_id AS topic_id, COUNT(*)::int AS c,
               SUM(CASE WHEN LOWER(q.difficulty)='easy' THEN 1 ELSE 0 END)::int AS easy,
               SUM(CASE WHEN LOWER(q.difficulty)='medium' THEN 1 ELSE 0 END)::int AS medium,
               SUM(CASE WHEN LOWER(q.difficulty)='hard' THEN 1 ELSE 0 END)::int AS hard
        FROM questions q
        WHERE q.is_active = true
          AND (q.is_deleted = false OR q.is_deleted IS NULL)
          AND q.topic_id IS NOT NULL
        GROUP BY q.topic_id
      `),
        pool.query(`
        SELECT s.id AS subject_id, s.name AS subject_title, s.slug AS subject_slug, s.color,
               c.id AS chapter_id, c.title AS chapter_title, c.slug AS chapter_slug,
               t.id AS topic_id, t.name AS topic_name, t.slug AS topic_slug
        FROM subjects s
        JOIN subject_chapters c
          ON (c.subject_id = s.id OR (c.subject_id IS NULL AND c.study_material_id = s.id))
         AND c.is_active = true
         AND (c.is_deleted = false OR c.is_deleted IS NULL)
        JOIN subject_topics t
          ON t.chapter_id = c.id
         AND t.is_active = true
         AND (t.is_deleted = false OR t.is_deleted IS NULL)
        WHERE s.is_active = true
          AND (s.is_deleted = false OR s.is_deleted IS NULL)
        ORDER BY s.sort_order, s.name, c.order_index, c.title, t.order_index, t.name
      `),
      ]);
      const topicMap = {};
      for (const r of qCounts.rows) {
        topicMap[r.topic_id] = {
          count: r.c,
          easy: r.easy,
          medium: r.medium,
          hard: r.hard,
        };
      }

      if (!Object.keys(topicMap).length) {
        return res.json({ success: true, data: { subjects: [] } });
      }

      // Build nested tree
      const subjectsById = {};
      const chaptersBySubject = {};
      const topicsByChapter = {};
      for (const row of curriculum.rows) {
        if (!topicMap[row.topic_id]) continue;
        if (!subjectsById[row.subject_id]) {
          subjectsById[row.subject_id] = {
            id: row.subject_id,
            title: row.subject_title,
            slug: row.subject_slug,
            color: row.color,
          };
        }
        if (!chaptersBySubject[row.subject_id])
          chaptersBySubject[row.subject_id] = {};
        if (!chaptersBySubject[row.subject_id][row.chapter_id]) {
          chaptersBySubject[row.subject_id][row.chapter_id] = {
            id: row.chapter_id,
            title: row.chapter_title,
            slug: row.chapter_slug,
          };
        }
        if (!topicsByChapter[row.chapter_id])
          topicsByChapter[row.chapter_id] = [];
        topicsByChapter[row.chapter_id].push({
          id: row.topic_id,
          name: row.topic_name,
          slug: row.topic_slug,
        });
      }

      const tree = Object.values(subjectsById)
        .map((s) => ({
          id: s.id,
          name: s.title,
          slug: s.slug,
          color: s.color,
          chapters: Object.values(chaptersBySubject[s.id] || {})
            .map((c) => ({
              id: c.id,
              name: c.title,
              slug: c.slug,
              topics: (topicsByChapter[c.id] || [])
                .map((t) => ({
                  id: t.id,
                  name: t.name,
                  slug: t.slug,
                  questionCount: topicMap[t.id]?.count || 0,
                  easy: topicMap[t.id]?.easy || 0,
                  medium: topicMap[t.id]?.medium || 0,
                  hard: topicMap[t.id]?.hard || 0,
                }))
                .filter((t) => t.questionCount > 0),
            }))
            .filter((c) => c.topics.length > 0),
        }))
        .filter((s) => s.chapters.length > 0);

      _practiceTreeCache = tree;
      _practiceTreeCacheExpires = Date.now() + 5 * 60 * 1000;

      res.json({ success: true, data: { subjects: tree } });
    } catch (err) {
      console.error("GET /api/practice/tree error:", err);
      res
        .status(500)
        .json({ success: false, error: sanitizeErrorMessage(err) });
    }
  },
);

/**
 * GET /api/practice/subjects
 * Returns all active subjects from database with chapters and question counts
 */
router.get("/subjects", protect, async (req, res) => {
  try {
    // Both old queries scanned questions independently. Materialise the
    // active question projection once and derive subject/chapter totals from
    // it in one read-pool round trip.
    const catalogRes = await readQuery(`
      WITH active_questions AS MATERIALIZED (
        SELECT subject_id, chapter_id, topic_id
        FROM questions
        WHERE is_active = true
          AND (is_deleted = false OR is_deleted IS NULL)
      ),
      subject_counts AS (
        SELECT subject_id, COUNT(*)::int AS cnt
        FROM active_questions
        WHERE subject_id IS NOT NULL
        GROUP BY subject_id
      ),
      chapter_counts AS (
        SELECT chapter_id, COUNT(*)::int AS cnt
        FROM active_questions
        WHERE chapter_id IS NOT NULL
        GROUP BY chapter_id
      ),
      topic_chapter_counts AS (
        SELECT st.chapter_id, COUNT(*)::int AS cnt
        FROM active_questions aq
        JOIN subject_topics st ON st.id = aq.topic_id
        WHERE aq.topic_id IS NOT NULL
          AND (aq.chapter_id IS NULL OR aq.chapter_id <> st.chapter_id)
        GROUP BY st.chapter_id
      )
      SELECT 'subject' AS row_type, s.id, s.name AS title, s.slug,
             s.icon, s.color, NULL::int AS subject_id,
             COALESCE(sc.cnt, 0)::int AS question_count,
             s.sort_order, NULL::int AS order_index
      FROM subjects s
      LEFT JOIN subject_counts sc ON sc.subject_id = s.id
      WHERE s.is_active = true AND (s.is_deleted IS NOT TRUE)

      UNION ALL

      SELECT 'chapter' AS row_type, c.id, c.title, c.slug,
             NULL::text AS icon, NULL::text AS color,
             COALESCE(c.subject_id, c.study_material_id) AS subject_id,
             (COALESCE(cc.cnt, 0) + COALESCE(tc.cnt, 0))::int AS question_count,
             NULL::int AS sort_order, c.order_index
      FROM subject_chapters c
      LEFT JOIN chapter_counts cc ON cc.chapter_id = c.id
      LEFT JOIN topic_chapter_counts tc ON tc.chapter_id = c.id
      WHERE c.is_active = true

      ORDER BY row_type, sort_order NULLS LAST, order_index NULLS LAST, title
    `);

    const chaptersBySubject = {};
    const subjectsRes = [];
    for (const row of catalogRes.rows) {
      if (row.row_type === "subject") {
        subjectsRes.push(row);
        continue;
      }
      const c = row;
      const key = c.subject_id;
      if (!chaptersBySubject[key]) chaptersBySubject[key] = [];
      chaptersBySubject[key].push({
        id: c.id,
        title: c.title,
        slug: c.slug,
        count: c.question_count || 0,
        badge: (c.question_count || 0) > 30 ? "High Yield" : "Core Concept",
        tag: (c.question_count || 0) > 50 ? "Most Asked" : "Essential",
      });
    }

    const subjects = subjectsRes.map((s) => ({
      id: s.id,
      title: s.title,
      label: s.title,
      slug: s.slug,
      icon: s.icon || "📚",
      color: s.color || "indigo",
      questionCount: s.question_count || 0,
      chapters: chaptersBySubject[s.id] || [],
    }));

    res.json({ success: true, data: { subjects } });
  } catch (err) {
    console.error("GET /api/practice/subjects error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * GET /api/practice/chapters/:chapterId/topics
 * Returns all topics for a chapter with question counts, difficulty splits,
 * and pre-built practice set definitions for the right-side panel.
 */
router.get("/chapters/:chapterId/topics", protect, async (req, res) => {
  try {
    const { chapterId } = req.params;
    const userId = req.user.id;

    // Non-empty guard (slug-compatible: callers may send slugs, so no
    // numeric-only check here). Missing params are a 400, unknown chapters
    // are a 404 — never a 500 via the catch below.
    if (
      chapterId === undefined ||
      chapterId === null ||
      String(chapterId).trim() === "" ||
      chapterId === "undefined" ||
      chapterId === "null"
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid chapter ID" });
    }

    // 1+2. Chapter existence + chapter topics are independent (both keyed
    // only by the :chapterId param), so they run together in one group.
    const [chapterRes, topicsRes] = await Promise.all([
      pool.query(
        `
      SELECT c.id, c.title, c.slug, COALESCE(c.subject_id, c.study_material_id) AS subject_id
      FROM subject_chapters c
      WHERE (c.id::text = $1 OR c.slug = $1) AND c.is_active = true AND (c.is_deleted IS NOT TRUE)
    `,
        [chapterId],
      ),
      pool.query(
        `
      SELECT t.id, t.name, t.slug, t.description, t.order_index,
             COUNT(q.id)::int AS question_count,
             SUM(CASE WHEN LOWER(q.difficulty)='easy' THEN 1 ELSE 0 END)::int AS easy_count,
             SUM(CASE WHEN LOWER(q.difficulty)='medium' THEN 1 ELSE 0 END)::int AS medium_count,
             SUM(CASE WHEN LOWER(q.difficulty)='hard' THEN 1 ELSE 0 END)::int AS hard_count
      FROM subject_topics t
      LEFT JOIN questions q ON q.topic_id = t.id
        AND (q.is_active = true OR q.is_active IS NULL)
        AND (q.is_deleted = false OR q.is_deleted IS NULL)
      WHERE t.chapter_id IN (
        SELECT c.id FROM subject_chapters c
        WHERE c.id::text = $1 OR c.slug = $1
      ) AND t.is_active = true AND (t.is_deleted IS NOT TRUE)
      GROUP BY t.id, t.name, t.slug, t.description, t.order_index
      ORDER BY t.order_index NULLS LAST, t.name
    `,
        [chapterId],
      ),
    ]);

    if (!chapterRes.rows.length) {
      return res
        .status(404)
        .json({ success: false, error: "Chapter not found" });
    }
    const chapter = chapterRes.rows[0];

    // 3. Topic mastery + subtopic list both derive only from topicIds, so
    // they run together in a second group. Subtopic mastery stays chained
    // after (it needs subtopic ids from the subtopic list).
    const topicIds = topicsRes.rows.map((t) => t.id);
    let masteryMap = {};
    let subtopicsByTopic = {};
    if (topicIds.length > 0) {
      const [masteryRes, subtopicsRes] = await Promise.all([
        pool.query(
          `
        SELECT q.topic_id,
               ROUND(AVG(CASE WHEN pa.is_correct THEN 100.0 ELSE 0 END))::int AS accuracy,
               COUNT(pa.id)::int AS attempts
        FROM practice_answers pa
        JOIN questions q ON pa.question_id = q.id
        WHERE pa.user_id = $1 AND q.topic_id = ANY($2::int[])
        GROUP BY q.topic_id
      `,
          [userId, topicIds],
        ),
        pool.query(
          `
        SELECT st.id, st.name, st.slug, st.topic_id, st.order_index,
               COUNT(q.id)::int AS question_count,
               SUM(CASE WHEN LOWER(q.difficulty)='easy' THEN 1 ELSE 0 END)::int AS easy_count,
               SUM(CASE WHEN LOWER(q.difficulty)='medium' THEN 1 ELSE 0 END)::int AS medium_count,
               SUM(CASE WHEN LOWER(q.difficulty)='hard' THEN 1 ELSE 0 END)::int AS hard_count
        FROM subject_subtopics st
        LEFT JOIN questions q ON q.subtopic_id = st.id
          AND (q.is_active = true OR q.is_active IS NULL)
          AND (q.is_deleted = false OR q.is_deleted IS NULL)
        WHERE st.topic_id = ANY($1::int[]) AND st.is_active = true AND (st.is_deleted IS NOT TRUE)
        GROUP BY st.id, st.name, st.slug, st.topic_id, st.order_index
        ORDER BY st.order_index NULLS LAST, st.name
      `,
          [topicIds],
        ),
      ]);
      for (const r of masteryRes.rows) {
        masteryMap[r.topic_id] = { accuracy: r.accuracy, attempts: r.attempts };
      }

      // 3b. Subtopic mastery for topics in this chapter (chained: needs ids above)
      const subtopicIds = subtopicsRes.rows.map((s) => s.id);
      let subtopicMasteryMap = {};
      if (subtopicIds.length > 0) {
        const subMasteryRes = await pool.query(
          `
          SELECT q.subtopic_id,
                 ROUND(AVG(CASE WHEN pa.is_correct THEN 100.0 ELSE 0 END))::int AS accuracy,
                 COUNT(pa.id)::int AS attempts
          FROM practice_answers pa
          JOIN questions q ON pa.question_id = q.id
          WHERE pa.user_id = $1 AND q.subtopic_id = ANY($2::int[])
          GROUP BY q.subtopic_id
        `,
          [userId, subtopicIds],
        );
        for (const r of subMasteryRes.rows) {
          subtopicMasteryMap[r.subtopic_id] = {
            accuracy: r.accuracy,
            attempts: r.attempts,
          };
        }
      }

      for (const st of subtopicsRes.rows) {
        if (!subtopicsByTopic[st.topic_id]) subtopicsByTopic[st.topic_id] = [];
        subtopicsByTopic[st.topic_id].push({
          id: st.id,
          subtopicId: st.id,
          topicId: st.topic_id,
          name: st.name.replace(/^Subtopic\s*\d+\s*:\s*/i, "").trim(),
          fullName: st.name,
          slug: st.slug,
          questionCount: st.question_count || 0,
          easyCount: st.easy_count || 0,
          mediumCount: st.medium_count || 0,
          hardCount: st.hard_count || 0,
          accuracy: subtopicMasteryMap[st.id]?.accuracy ?? null,
          attempts: subtopicMasteryMap[st.id]?.attempts ?? 0,
        });
      }
    }

    // Build chapter-wide topic types (collection of question types across this chapter)
    const chapterTopicTypes = topicsRes.rows
      .filter((t) => (t.question_count || 0) > 0)
      .map((t) => {
        const cleanName = t.name.replace(/^Topic\s*\d+\s*:\s*/i, "").trim();
        return {
          id: `topictype-${t.id}`,
          topicId: t.id,
          name: cleanName,
          fullName: t.name,
          slug: t.slug,
          questionCount: t.question_count,
          easyCount: t.easy_count,
          mediumCount: t.medium_count,
          hardCount: t.hard_count,
          accuracy: masteryMap[t.id]?.accuracy ?? null,
          attempts: masteryMap[t.id]?.attempts ?? 0,
          description: t.description || `Practice all ${cleanName} questions`,
        };
      });

    // 4. Build topics with practice sets
    const PRACTICE_SETS = [
      {
        id: "quick",
        label: "Quick Practice",
        description: "10 questions · Mixed",
        count: 10,
        difficulty: "mixed",
        icon: "⚡",
      },
      {
        id: "easy",
        label: "Easy Set",
        description: "15 easy questions",
        count: 15,
        difficulty: "easy",
        icon: "🟢",
      },
      {
        id: "medium",
        label: "Medium Set",
        description: "15 medium questions",
        count: 15,
        difficulty: "medium",
        icon: "🟡",
      },
      {
        id: "hard",
        label: "Hard Set",
        description: "10 hard questions",
        count: 10,
        difficulty: "hard",
        icon: "🔴",
      },
      {
        id: "full",
        label: "Full Practice",
        description: "All questions · All levels",
        count: null, // null = use all available questions for the topic
        difficulty: "mixed",
        icon: "🎯",
      },
    ];

    const cleanChapterTitle = chapter.title
      .replace(/^Chapter\s*\d+\s*:\s*/i, "")
      .toLowerCase()
      .trim();

    const topics = topicsRes.rows
      .map((t) => {
        const questionCount = t.question_count || 0;
        const easyCount = t.easy_count || 0;
        const mediumCount = t.medium_count || 0;
        const hardCount = t.hard_count || 0;

        const directSubtopics = (subtopicsByTopic[t.id] || []).filter(
          (st) => st.questionCount > 0,
        );

        const cleanTopicName = t.name
          .replace(/^Topic\s*\d+\s*:\s*/i, "")
          .toLowerCase()
          .trim();
        const isUmbrella =
          cleanTopicName.includes(cleanChapterTitle) ||
          cleanChapterTitle.includes(cleanTopicName);

        const topicTypes = isUmbrella
          ? chapterTopicTypes.filter((ct) => ct.topicId !== t.id)
          : [];

        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          description: t.description,
          questionCount,
          easyCount,
          mediumCount,
          hardCount,
          accuracy: masteryMap[t.id]?.accuracy ?? null,
          attempts: masteryMap[t.id]?.attempts ?? 0,
          subtopics: directSubtopics,
          topicTypes,
          allTypes: [...directSubtopics, ...topicTypes],
          // These are set types, while count is capped to the questions that
          // actually exist for this topic and difficulty.
          practiceSets: PRACTICE_SETS.map((ps) => {
            const available =
              ps.difficulty === "easy"
                ? easyCount
                : ps.difficulty === "medium"
                  ? mediumCount
                  : ps.difficulty === "hard"
                    ? hardCount
                    : questionCount;
            return {
              ...ps,
              count:
                ps.count === null ? available : Math.min(ps.count, available),
            };
          }).filter((ps) => ps.count > 0),
        };
      })
      .filter((topic) => topic.questionCount > 0);

    res.json({
      success: true,
      data: {
        chapter: { id: chapter.id, title: chapter.title, slug: chapter.slug },
        topics,
        chapterTopicTypes,
        totalTopics: topics.length,
        totalQuestions: topics.reduce((s, t) => s + t.questionCount, 0),
      },
    });
  } catch (err) {
    console.error("GET /api/practice/chapters/:chapterId/topics error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * GET /api/practice/topics/:topicId/stats
 */
router.get("/topics/:topicId/stats", protect, async (req, res) => {
  try {
    const { topicId } = req.params;
    const userId = req.user.id;

    // Non-empty guard (slug-compatible: callers may send slugs, so no
    // numeric-only check here). Unknown topics are a 404 — never a 500
    // via the catch below.
    if (
      topicId === undefined ||
      topicId === null ||
      String(topicId).trim() === "" ||
      topicId === "undefined" ||
      topicId === "null"
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid topic ID" });
    }
    const topicRes = await pool.query(
      `SELECT id FROM subject_topics WHERE id::text = $1 OR slug = $1 LIMIT 1`,
      [topicId],
    );
    if (!topicRes.rows.length) {
      return res.status(404).json({ success: false, error: "Topic not found" });
    }
    const numericTopicId = topicRes.rows[0].id;

    // The three reads are independent (count, difficulty split, mastery),
    // so they run together in one group instead of three serial round-trips.
    const [total, diffSplit, mastery] = await Promise.all([
      countPracticeQuestions(`q.topic_id = $1`, [numericTopicId]),
      pool.query(
        `
      SELECT
        SUM(CASE WHEN LOWER(q.difficulty)='easy' THEN 1 ELSE 0 END)::int AS easy,
        SUM(CASE WHEN LOWER(q.difficulty)='medium' THEN 1 ELSE 0 END)::int AS medium,
        SUM(CASE WHEN LOWER(q.difficulty)='hard' THEN 1 ELSE 0 END)::int AS hard
      FROM questions q WHERE ${PRACTICE_Q_WHERE} AND q.topic_id = $1
    `,
        [numericTopicId],
      ),
      computeTopicMastery(userId, numericTopicId),
    ]);

    res.json({
      success: true,
      data: {
        total,
        easy: diffSplit.rows[0]?.easy || 0,
        medium: diffSplit.rows[0]?.medium || 0,
        hard: diffSplit.rows[0]?.hard || 0,
        mastery: mastery.mastery,
        attempts: mastery.attempts,
      },
    });
  } catch (err) {
    console.error("GET /api/practice/topics/:topicId/stats error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

// ═══════════════════════════════════════════════════
// SESSIONS
// ═══════════════════════════════════════════════════

/**
 * POST /api/practice/sessions
 * Body: { examId?, subjectId?, chapterId?, topicId?, mode, difficulty?, targetCount?, timeLimitSec? }
 * Returns: { sessionId, questions: [...] }  (questions are full safe objects for Phase 1 simplicity)
 */
router.post("/sessions", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      examId,
      subjectId,
      chapterId,
      topicId,
      subtopicId,
      mode = "learn",
      difficulty = "mixed",
      targetCount = 20,
      timeLimitSec,
      testId,
      questionId,
    } = req.body;

    // Explicit-but-malformed IDs are a 400 (previously silently ignored by
    // the picker). Absent params keep their old behavior (no filter).
    const isProvided = (v) => v !== undefined && v !== null && v !== "";
    if (isProvided(subtopicId)) {
      const sId = Number(subtopicId);
      if (!Number.isInteger(sId) || sId <= 0) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid subtopicId" });
      }
    }
    if (isProvided(testId)) {
      const tId = Number(testId);
      if (!Number.isFinite(tId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid testId" });
      }
    }
    if (isProvided(difficulty) && typeof difficulty !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Invalid difficulty" });
    }
    // Normalize deep-link modes to the modes the picker actually understands.
    // Frontend entry points use a few historical aliases; map them so "Practice
    // Saved" and "Practice Similar" deep links behave identically everywhere.
    const MODE_ALIASES = { bookmarks: "bookmark", saved: "bookmark" };
    const normalizedMode = MODE_ALIASES[mode] || mode;

    // Cap targetCount (default 20, max 200 for latency)
    const count = Math.min(Math.max(parseInt(targetCount, 10) || 20, 1), 200);

    // Perf guard: large ORDER BY RANDOM() payloads are slow — log a hint
    // (userId + count only, no PII) so slow session creates are traceable.
    if (count > 50) {
      console.warn(
        `[practice] large session request: userId=${userId} count=${count}`,
      );
    }

    // Numeric guard (mirror test submit): non-numeric time limits are a 400,
    // valid values are clamped to [30s, 6h] so a stale client can't create
    // unbounded sessions.
    let safeTimeLimitSec = null;
    if (
      timeLimitSec !== undefined &&
      timeLimitSec !== null &&
      timeLimitSec !== ""
    ) {
      const parsed = Number(timeLimitSec);
      if (!Number.isFinite(parsed)) {
        return res.status(400).json({
          success: false,
          error: "timeLimitSec must be a number of seconds",
        });
      }
      safeTimeLimitSec = Math.min(Math.max(Math.floor(parsed), 30), 21600);
    }

    // Single resolvePracticeFilters call — resolved once here and passed through
    // to the picker so slug->id lookups are not executed twice per session.
    const resolvedFilters = await resolvePracticeFilters({
      examId,
      subjectId,
      chapterId,
      topicId,
    });

    const questionIds = await pickPracticeQuestionIds({
      subjectId,
      chapterId,
      topicId,
      subtopicId,
      difficulty,
      mode: normalizedMode,
      count,
      userId,
      testId,
      questionId,
      resolvedFilters,
    });

    if (!questionIds.length) {
      return res.status(400).json({
        success: false,
        error:
          "No practice questions match these filters. Try a different topic, difficulty, or mode.",
      });
    }

    const safeExamId = resolvedFilters.examId;
    const safeSubjectId = resolvedFilters.subjectId;
    const safeChapterId = resolvedFilters.chapterId;
    const safeTopicId = resolvedFilters.topicId;

    // ── Session hygiene + insert (one transaction) ──────────────────────
    // 1. Expire abandoned sessions: anything active but untouched for 7+ days
    //    is closed so the active-session lookup stays meaningful and rows
    //    don't accumulate forever (sessions had no TTL before this).
    // 2. Deactivate any other still-active session for this user so each user
    //    has at most one live practice session (mirrors the
    //    user_recommendations one-active-row pattern).
    // The whole sequence runs in a single transaction so two concurrent POSTs
    // serialize on the user's rows (last-writer-wins) instead of both passing
    // hygiene and inserting duplicate active rows.
    const client = await pool.connect();
    let ins;
    try {
      await client.query("BEGIN");
      // Serialize concurrent POSTs for this user: lock their active session
      // rows FOR UPDATE so two simultaneous creates can't both pass hygiene
      // and insert duplicate live rows (last-writer-wins, never duplicates).
      await client.query(
        `SELECT id FROM practice_sessions
         WHERE user_id = $1 AND is_active = true AND completed_at IS NULL
         FOR UPDATE`,
        [userId],
      );
      await client.query(
        `
        UPDATE practice_sessions
        SET is_active = false, completed_at = COALESCE(completed_at, NOW()), last_active_at = NOW()
        WHERE user_id = $1 AND is_active = true
          AND completed_at IS NULL
          AND last_active_at < NOW() - INTERVAL '7 days'
      `,
        [userId],
      );
      await client.query(
        `
        UPDATE practice_sessions
        SET is_active = false
        WHERE user_id = $1 AND is_active = true AND completed_at IS NULL
      `,
        [userId],
      );

      // Create session
      ins = await client.query(
        `
        INSERT INTO practice_sessions
          (user_id, exam_id, subject_id, chapter_id, topic_id, mode, difficulty, target_count, time_limit_sec, questions_json, current_index)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)
        RETURNING id
      `,
        [
          userId,
          safeExamId,
          safeSubjectId,
          safeChapterId,
          safeTopicId,
          normalizedMode,
          difficulty,
          count,
          safeTimeLimitSec,
          JSON.stringify(questionIds),
        ],
      );
      await client.query("COMMIT");
    } catch (txnErr) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // rollback best-effort; original error is what matters
      }
      throw txnErr;
    } finally {
      client.release();
    }

    const sessionId = ins.rows[0].id;

    // For Phase 1: return full question objects (safe) so the frontend has everything in one round-trip
    const questions = await getSafeQuestions(questionIds);

    res.json({
      success: true,
      data: {
        id: sessionId,
        sessionId,
        questions,
        total: questions.length,
        totalQuestions: questions.length,
        currentIndex: 0,
      },
    });
  } catch (err) {
    console.error("POST /api/practice/sessions error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * GET /api/practice/sessions/active
 */
router.get("/sessions/active", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const r = await pool.query(
      `
      SELECT id, user_id, exam_id, subject_id, chapter_id, topic_id, mode, difficulty, target_count, time_limit_sec, questions_json, current_index, correct_count, wrong_count, skipped_count, started_at, last_active_at, completed_at, is_active, is_deleted, deleted_at, deleted_by FROM practice_sessions
      WHERE user_id = $1 AND is_active = true AND completed_at IS NULL
      ORDER BY started_at DESC LIMIT 1
    `,
      [userId],
    );
    if (!r.rows.length) return res.json({ success: true, data: null });
    const session = dbHelpers.toCamel(r.rows[0]);

    // Hydrate questions — NULL/malformed questions_json is a client-visible 400, not an empty session
    if (!Array.isArray(session.questionsJson))
      return res
        .status(400)
        .json({ success: false, error: "Session has no questions" });
    const ids = session.questionsJson;
    const questions = await getSafeQuestions(ids);
    session.questions = questions;
    delete session.questionsJson;

    // Attach user answers history for this session
    await attachSessionAnswers(session, ids, userId);

    res.json({ success: true, data: session });
  } catch (err) {
    console.error("GET /api/practice/sessions/active error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * Helper: Fetch all answers attempted in a practice session and attach to session object
 */
async function attachSessionAnswers(session, ids, userId) {
  if (!session?.id || !Array.isArray(ids) || ids.length === 0) return session;
  try {
    const ansRes = await pool.query(
      `SELECT pa.question_id, pa.selected_option, pa.is_correct, pa.is_skipped,
              pa.time_taken_sec, q.correct_option, q.correct_answer, q.explanation, q.explanation_hi
       FROM practice_answers pa
       LEFT JOIN questions q ON q.id = pa.question_id
       WHERE pa.session_id = $1 AND pa.user_id = $2`,
      [session.id, userId],
    );

    const questionIndexMap = {};
    ids.forEach((qId, i) => {
      questionIndexMap[qId] = i;
    });

    const answersList = [];
    const answersMap = {};
    for (const a of ansRes.rows) {
      const qIdx = questionIndexMap[a.question_id];
      if (qIdx !== undefined) {
        const item = {
          index: qIdx,
          questionId: a.question_id,
          selectedOption: a.selected_option,
          isCorrect: a.is_correct,
          isSkipped: a.is_skipped,
          correctOption: a.correct_option ?? a.correct_answer,
          explanation: a.explanation,
          explanationHi: a.explanation_hi,
        };
        answersList.push(item);
        answersMap[qIdx] = item;
      }
    }

    session.answers = answersList;
    session.answersMap = answersMap;
  } catch (err) {
    console.warn("[practice] Failed to attach session answers:", err.message);
    session.answers = [];
    session.answersMap = {};
  }
  return session;
}

/**
 * GET /api/practice/sessions/:id
 */
router.get("/sessions/:id", protect, async (req, res) => {
  try {
    const sessionId = parsePositiveInt(req.params.id);
    if (!sessionId) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid practice session ID" });
    }

    const r = await pool.query(
      `SELECT id, user_id, exam_id, subject_id, chapter_id, topic_id, mode, difficulty, target_count, time_limit_sec, questions_json, current_index, correct_count, wrong_count, skipped_count, started_at, last_active_at, completed_at, is_active, is_deleted, deleted_at, deleted_by FROM practice_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, req.user.id],
    );
    if (!r.rows.length)
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    const session = dbHelpers.toCamel(r.rows[0]);
    if (!Array.isArray(session.questionsJson))
      return res
        .status(400)
        .json({ success: false, error: "Session has no questions" });
    const ids = session.questionsJson;
    const questions = await getSafeQuestions(ids);
    session.questions = questions;
    delete session.questionsJson;

    // Attach user answers history for this session
    await attachSessionAnswers(session, ids, req.user.id);

    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * PATCH /api/practice/sessions/:id
 * Body: { currentIndex }
 * Autosave of progress position. Answer counters are owned by the server
 * (see /check and /skip), so client-supplied counters are never trusted here.
 */
router.patch("/sessions/:id", protect, async (req, res) => {
  try {
    const sessionId = parsePositiveInt(req.params.id);
    if (!sessionId) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid practice session ID" });
    }
    const { currentIndex } = req.body;
    const safeIndex =
      Number.isInteger(currentIndex) && currentIndex >= 0 ? currentIndex : null;
    if (currentIndex !== undefined && safeIndex === null) {
      return res.status(400).json({
        success: false,
        error: "currentIndex must be an integer >= 0",
      });
    }
    // Clamp to the session's question range so a stale client can't push the
    // cursor past the end (counter-delta logic in /check assumes in-range).
    const sess = await pool.query(
      `SELECT questions_json FROM practice_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, req.user.id],
    );
    if (!sess.rows.length) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }
    const ids = sess.rows[0].questions_json;
    const maxIndex = Array.isArray(ids) ? ids.length : 0;
    const clamped =
      safeIndex === null ? null : Math.min(safeIndex, Math.max(maxIndex, 0));
    const upd = await pool.query(
      `
      UPDATE practice_sessions SET
        current_index = COALESCE($2, current_index),
        last_active_at = NOW()
      WHERE id = $1 AND user_id = $3
    `,
      [sessionId, clamped, req.user.id],
    );
    if (!upd.rowCount) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * POST /api/practice/sessions/:id/complete
 * Mark complete, update streak, return summary.
 */
router.post("/sessions/:id/complete", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = parsePositiveInt(req.params.id);
    if (!sessionId) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid practice session ID" });
    }

    // Authoritative counters — derived from logged answers, never from the client.
    // Atomic complete: session row locked FOR UPDATE so a concurrent
    // check/skip racing the complete button can't move counters after the
    // snapshot is taken. The streak upsert runs in the SAME transaction
    // (atomic INSERT ... ON CONFLICT) so a concurrent complete for this user
    // serializes on the streak row instead of racing.
    const completeClient = await pool.connect();
    let r;
    let streak = { current: 1, longest: 1 };
    try {
      await completeClient.query("BEGIN");
      const lockedComplete = await completeClient.query(
        `SELECT id FROM practice_sessions WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [sessionId, userId],
      );
      if (!lockedComplete.rows.length) {
        await completeClient.query("ROLLBACK");
        return res
          .status(404)
          .json({ success: false, error: "Session not found" });
      }
      const counts = await completeClient.query(
        `
        SELECT
          COUNT(*) FILTER (WHERE is_correct)::int AS correct_count,
          COUNT(*) FILTER (WHERE NOT is_correct AND NOT is_skipped)::int AS wrong_count,
          COUNT(*) FILTER (WHERE is_skipped)::int AS skipped_count
        FROM practice_answers WHERE user_id = $1 AND session_id = $2
      `,
        [userId, sessionId],
      );
      const countRow = counts.rows[0] || {};
      const correctCount = Number(countRow.correct_count || 0);
      const wrongCount = Number(countRow.wrong_count || 0);
      const skippedCount = Number(countRow.skipped_count || 0);

      r = await completeClient.query(
        `
        UPDATE practice_sessions
        SET completed_at = NOW(), is_active = false,
            correct_count = $2,
            wrong_count = $3,
            skipped_count = $4,
            last_active_at = NOW()
        WHERE id = $1 AND user_id = $5 AND completed_at IS NULL
        RETURNING *
      `,
        [sessionId, correctCount, wrongCount, skippedCount, userId],
      );
      if (!r.rows.length) {
        await completeClient.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          error: "Session not found or already completed",
        });
      }

      // Streak + totals in-transaction: the totals deltas ride along in the
      // same atomic upsert, so no separate post-commit UPDATE is needed.
      // A failure here rolls back the whole complete (pre-commit 500 is
      // retry-safe; the session is NOT marked complete).
      streak = await bumpStreak(userId, completeClient, {
        questions: correctCount + wrongCount + skippedCount,
        correct: correctCount,
      });
      await completeClient.query("COMMIT");
    } catch (completeTxnErr) {
      try {
        await completeClient.query("ROLLBACK");
      } catch {
        // rollback best-effort; original error is what matters
      }
      throw completeTxnErr;
    } finally {
      completeClient.release();
    }
    const session = dbHelpers.toCamel(r.rows[0]);

    // Bridge practice results into the analytics pipeline (streaks, weak-area
    // detection, recommendations, spaced-repetition queue). See analyticsService.recordPracticeAnalytics.
    // Post-commit by design (the service owns its own pool queries) and
    // best-effort: the session is already complete, so analytics/mastery
    // failures must NEVER turn this into a 500.
    if (session.topicId) {
      try {
        await recordPracticeAnalytics(userId, session.id, {
          topic: session.topicId,
          subject: session.subjectId,
        });
      } catch (analyticsErr) {
        console.warn(
          "[Practice complete analytics] non-fatal:",
          analyticsErr.message,
        );
      }
    }

    // Recompute mastery if topic was set (best-effort post-commit read;
    // bounded to the latest 5000 rows inside computeTopicMastery).
    let mastery = null;
    if (session.topicId) {
      try {
        mastery = await computeTopicMastery(userId, session.topicId);
      } catch (masteryErr) {
        console.warn(
          "[Practice complete mastery] non-fatal:",
          masteryErr.message,
        );
        mastery = null;
      }
    }

    res.json({
      success: true,
      data: {
        session,
        streak,
        mastery,
      },
    });
  } catch (err) {
    console.error("POST /api/practice/sessions/:id/complete error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

// ═══════════════════════════════════════════════════
// QUESTIONS WITHIN A SESSION
// ═══════════════════════════════════════════════════

/**
 * GET /api/practice/sessions/:id/questions/:idx
 * Returns the full question object (without correct answer) at the given index.
 */
router.get("/sessions/:id/questions/:idx", protect, async (req, res) => {
  try {
    const sessionId = parsePositiveInt(req.params.id);
    const idx = Number(req.params.idx);
    if (!sessionId || !Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid practice session or question index",
      });
    }

    const sess = await pool.query(
      `SELECT questions_json FROM practice_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, req.user.id],
    );
    if (!sess.rows.length)
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    const ids = sess.rows[0].questions_json;
    if (!Array.isArray(ids))
      return res
        .status(400)
        .json({ success: false, error: "Session has no questions" });
    if (idx < 0 || idx >= ids.length)
      return res
        .status(400)
        .json({ success: false, error: "Index out of range" });
    const q = await getSafeQuestion(ids[idx]);
    if (!q)
      return res
        .status(404)
        .json({ success: false, error: "Question missing" });

    // Check if this question was already attempted/answered in this session
    try {
      const ansRes = await pool.query(
        `SELECT pa.selected_option, pa.is_correct, pa.is_skipped, q.correct_answer, q.correct_option, q.explanation, q.explanation_hi
         FROM practice_answers pa
         JOIN questions q ON q.id = pa.question_id
         WHERE pa.session_id = $1 AND pa.question_id = $2 AND pa.user_id = $3
         ORDER BY pa.id DESC LIMIT 1`,
        [sessionId, ids[idx], req.user.id],
      );
      if (ansRes.rows.length > 0) {
        const a = ansRes.rows[0];
        q.userAnswer = {
          selectedOption: a.selected_option,
          isCorrect: a.is_correct,
          isSkipped: a.is_skipped,
          correctOption: a.correct_option ?? a.correct_answer,
          explanation: a.explanation,
          explanationHi: a.explanation_hi,
        };
      }
    } catch (ansErr) {
      console.warn(
        "[practice] Failed to attach userAnswer to question:",
        ansErr.message,
      );
    }

    res.json({ success: true, data: q });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * POST /api/practice/sessions/:id/questions/:idx/check
 * Body: { selectedOption }
 * Logs to practice_answers; returns { isCorrect, correctOption, explanation }.
 */
router.post("/sessions/:id/questions/:idx/check", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = parsePositiveInt(req.params.id);
    if (!sessionId) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid practice session ID" });
    }
    const sess = await pool.query(
      `SELECT questions_json, mode FROM practice_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );
    if (!sess.rows.length)
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    const ids = sess.rows[0].questions_json;
    if (!Array.isArray(ids))
      return res
        .status(400)
        .json({ success: false, error: "Session has no questions" });
    const mode = sess.rows[0].mode;
    const idx = Number(req.params.idx);
    if (!Number.isInteger(idx) || idx < 0 || idx >= ids.length)
      return res
        .status(400)
        .json({ success: false, error: "Index out of range" });
    const questionId = ids[idx];
    const selectedOption = normalizeOptionIndex(req.body.selectedOption);

    if (selectedOption === null) {
      return res
        .status(400)
        .json({ success: false, error: "No option selected" });
    }

    // Numeric guard (mirror test submit): non-numeric timeTakenSec is a 400;
    // valid values are clamped to [0s, 1h] per question.
    let safeTimeTakenSec = null;
    if (
      req.body.timeTakenSec !== undefined &&
      req.body.timeTakenSec !== null &&
      req.body.timeTakenSec !== ""
    ) {
      const parsedTaken = Number(req.body.timeTakenSec);
      if (!Number.isFinite(parsedTaken)) {
        return res
          .status(400)
          .json({ success: false, error: "timeTakenSec must be a number" });
      }
      safeTimeTakenSec = Math.min(Math.max(parsedTaken, 0), 3600);
    }

    // Folded single read: correct-option fields + explanations + topic_id in
    // ONE SELECT (previously getCorrectOption + explanation + topic queries).
    const qRow = await pool.query(
      `
      SELECT correct_option, correct_answer, options,
             explanation, explanation_hi, topic_id
      FROM questions WHERE id = $1
    `,
      [questionId],
    );
    if (!qRow.rows.length) {
      return res
        .status(404)
        .json({ success: false, error: "Question missing" });
    }
    const qCamel = dbHelpers.toCamel(qRow.rows[0]);
    const rawCorrect = qCamel.correctOption ?? qCamel.correctAnswer;
    let correctOption = null;
    if (rawCorrect !== undefined && rawCorrect !== null && rawCorrect !== "") {
      const n = Number(rawCorrect);
      if (Number.isFinite(n) && Number.isInteger(n)) correctOption = n;
      else {
        const s = String(rawCorrect).trim().toUpperCase();
        if (/^[A-D]$/.test(s)) correctOption = s.charCodeAt(0) - 65;
      }
    }
    if (correctOption === null) {
      const opts = Array.isArray(qCamel.options) ? qCamel.options : [];
      if (opts.length > 0) {
        const foundIdx = opts.findIndex((o) => {
          if (typeof o === "object" && o !== null) {
            if (o.isCorrect || o.is_correct) return true;
            if (rawCorrect && (o.text === rawCorrect || o.id === rawCorrect))
              return true;
          }
          return o === rawCorrect;
        });
        if (foundIdx !== -1) correctOption = foundIdx;
      }
    }
    const isCorrect = selectedOption === correctOption;

    // Get explanation for the response (including Hindi)
    const explanation = qRow.rows[0]?.explanation || "";
    const explanationHi = qRow.rows[0]?.explanation_hi || "";
    const foldedTopicId = Number(qRow.rows[0]?.topic_id);

    // Atomic answer commit: session row locked FOR UPDATE so concurrent
    // check/skip retries serialize on counters instead of double-counting.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        `SELECT id FROM practice_sessions WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [sessionId, userId],
      );
      if (!locked.rows.length) {
        await client.query("ROLLBACK");
        return res
          .status(404)
          .json({ success: false, error: "Session not found" });
      }

      // Prior state — used to adjust counters by delta (never double-count re-answers)
      const prev = await client.query(
        `SELECT is_correct, is_skipped FROM practice_answers
         WHERE user_id = $1 AND question_id = $2 AND session_id = $3`,
        [userId, questionId, sessionId],
      );

      // Log to practice_answers (upsert per session+question)
      await client.query(
        `
        INSERT INTO practice_answers (user_id, session_id, question_id, selected_option, is_correct, is_skipped, time_taken_sec, mode)
        VALUES ($1, $2, $3, $4, $5, false, $6, $7)
        ON CONFLICT (user_id, question_id, session_id) DO UPDATE
          SET selected_option = EXCLUDED.selected_option,
              is_correct = EXCLUDED.is_correct,
              is_skipped = false
      `,
        [
          userId,
          sessionId,
          questionId,
          selectedOption,
          isCorrect,
          safeTimeTakenSec,
          mode,
        ],
      );

      // Update session counters by delta
      let correctDelta = 0,
        wrongDelta = 0,
        skippedDelta = 0;
      const had = prev.rows[0];
      if (!had) {
        if (isCorrect) correctDelta = 1;
        else wrongDelta = 1;
      } else if (had.is_skipped) {
        skippedDelta = -1;
        if (isCorrect) correctDelta = 1;
        else wrongDelta = 1;
      } else if (had.is_correct !== isCorrect) {
        correctDelta = isCorrect ? 1 : -1;
        wrongDelta = isCorrect ? -1 : 1;
      }
      await client.query(
        `
        UPDATE practice_sessions SET
          correct_count = GREATEST(0, correct_count + $2),
          wrong_count = GREATEST(0, wrong_count + $3),
          skipped_count = GREATEST(0, skipped_count + $4),
          current_index = GREATEST(current_index, $5 + 1),
          last_active_at = NOW()
        WHERE id = $1
      `,
        [sessionId, correctDelta, wrongDelta, skippedDelta, idx],
      );

      // If answered correctly during practice/mistake drill, update mastery in wrong_questions and revision_queue
      if (isCorrect) {
        try {
          await client.query(
            `UPDATE wrong_questions
             SET wrong_count = GREATEST(0, wrong_count - 1),
                 is_active = (wrong_count - 1 > 0),
                 updated_at = NOW()
             WHERE user_id = $1 AND question_id = $2`,
            [userId, questionId],
          );
          await client.query(
            `UPDATE revision_queue
             SET status = 'completed', completed_at = NOW(), updated_at = NOW()
             WHERE user_id = $1 AND question_id = $2 AND status = 'pending'`,
            [userId, questionId],
          );
        } catch (err) {
          console.warn("[Practice Mastery Update]", err.message);
        }
      } else {
        // Wrong path: upsert wrong_questions + revision_queue
        // (best-effort — queue/stats outage must never fail the answer flow).
        //
        // source_attempt_id stays NULL for practice rows: it is an INTEGER FK
        // to attempts(id), and practice sessions create no attempts row. The
        // 'practice:<sessionId>' sentinel previously written here always failed
        // (22P02 cast error) — silently, via the catch below.
        //
        // user_topic_stats is intentionally NOT written per-answer:
        // session completion (recordPracticeAnalytics) aggregates the whole
        // session from practice_answers once, including correct/skipped —
        // per-answer upserts here double-counted every wrong answer.
        try {
          await client.query(
            `INSERT INTO wrong_questions
               (user_id, question_id, source_attempt_id, wrong_count, last_seen_at, metadata, is_active, created_at, updated_at)
             VALUES ($1, $2, NULL, 1, NOW(), '{}'::jsonb, true, NOW(), NOW())
             ON CONFLICT (user_id, question_id)
             DO UPDATE SET
               wrong_count = wrong_questions.wrong_count + 1,
               last_seen_at = EXCLUDED.last_seen_at,
               is_active = true,
               updated_at = NOW()`,
            [userId, questionId],
          );
          // Single multi-row insert (one round-trip, not N=4). Due dates are
          // server-computed ISO strings — interval literals, not parameters.
          const revisionRows = [];
          for (const day of [1, 3, 7, 14]) {
            const dueAt = new Date(Date.now() + day * 86400000).toISOString();
            revisionRows.push(
              `($1, $2, NULL, ${day}, '${dueAt}', 'pending', ${day <= 3 ? 2 : 1}, '{}'::jsonb, NOW(), NOW())`,
            );
          }
          // Single multi-row insert (one round-trip, not N=4).
          await client.query(
            `INSERT INTO revision_queue
               (user_id, question_id, source_attempt_id, schedule_day, due_at, status, priority, metadata, created_at, updated_at)
             VALUES ${revisionRows.join(", ")}
              ON CONFLICT (user_id, question_id, schedule_day) WHERE source_attempt_id IS NULL
              DO UPDATE SET due_at = EXCLUDED.due_at, status = 'pending', priority = EXCLUDED.priority, updated_at = NOW()
              WHERE revision_queue.status <> 'completed'`,
            [userId, questionId],
          );
        } catch (bridgeErr) {
          console.warn(
            "[Practice Wrong-Path Bridge] non-fatal:",
            bridgeErr.message,
          );
        }
      }
      await client.query("COMMIT");
    } catch (txnErr) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // rollback best-effort; original error is what matters
      }
      throw txnErr;
    } finally {
      client.release();
    }

    // Engine signals (best-effort, batched): NodeEngine spaced-repetition state
    // + adaptive-difficulty EMA. Failures are swallowed so analytics never
    // blocks answer submission.
    try {
      const { nodeEngineService } =
        await import("../../services/core/NodeEngineService.js");
      const { default: adaptiveDifficultyService } =
        await import("../../modules/ai/adaptiveDifficulty.js");
      // Reuses the folded topic_id from the single question SELECT above —
      // no extra question read.
      const topicId = foldedTopicId;
      const timeSpent = safeTimeTakenSec ?? 0;
      const engineJobs = [];
      // Only real numeric topic ids feed the engine — passing the question id
      // as a node id (the old fallback) creates orphan user_node_skill rows.
      if (Number.isInteger(topicId) && topicId > 0) {
        engineJobs.push(
          nodeEngineService
            .recordAttempt(userId, topicId, isCorrect, timeSpent || 45)
            .catch((e) => console.warn("[Practice NodeEngine]", e.message)),
          adaptiveDifficultyService
            .updatePerformance(userId, topicId, isCorrect, timeSpent)
            .catch((e) =>
              console.warn("[Practice AdaptiveDifficulty]", e.message),
            ),
        );
      }
      await Promise.all(engineJobs);
    } catch (engineErr) {
      console.warn("[Practice Engine Bridge] non-fatal:", engineErr.message);
    }

    res.json({
      success: true,
      data: {
        isCorrect,
        correctOption,
        explanation,
        explanationHi,
        explanation_hi: explanationHi,
      },
    });
  } catch (err) {
    console.error(
      "POST /api/practice/sessions/:id/questions/:idx/check error:",
      err,
    );
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * POST /api/practice/sessions/:id/questions/:idx/skip
 */
router.post("/sessions/:id/questions/:idx/skip", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = parsePositiveInt(req.params.id);
    if (!sessionId) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid practice session ID" });
    }
    const sess = await pool.query(
      `SELECT questions_json, mode FROM practice_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId],
    );
    if (!sess.rows.length)
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    const ids = sess.rows[0].questions_json;
    if (!Array.isArray(ids))
      return res
        .status(400)
        .json({ success: false, error: "Session has no questions" });
    const mode = sess.rows[0].mode;
    const idx = Number(req.params.idx);
    if (!Number.isInteger(idx) || idx < 0 || idx >= ids.length)
      return res
        .status(400)
        .json({ success: false, error: "Index out of range" });
    const questionId = ids[idx];

    // Atomic skip commit: session row locked FOR UPDATE so concurrent
    // check/skip retries serialize on counters instead of double-counting.
    const skipClient = await pool.connect();
    try {
      await skipClient.query("BEGIN");
      const lockedSkip = await skipClient.query(
        `SELECT id FROM practice_sessions WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [sessionId, userId],
      );
      if (!lockedSkip.rows.length) {
        await skipClient.query("ROLLBACK");
        return res
          .status(404)
          .json({ success: false, error: "Session not found" });
      }

      const prev = await skipClient.query(
        `SELECT is_correct, is_skipped FROM practice_answers
         WHERE user_id = $1 AND question_id = $2 AND session_id = $3`,
        [userId, questionId, sessionId],
      );

      await skipClient.query(
        `
        INSERT INTO practice_answers (user_id, session_id, question_id, selected_option, is_correct, is_skipped, mode)
        VALUES ($1, $2, $3, NULL, false, true, $4)
        ON CONFLICT (user_id, question_id, session_id) DO UPDATE
          SET is_skipped = true, selected_option = NULL, is_correct = false
      `,
        [userId, sessionId, questionId, mode],
      );

      // Adjust counters by delta — skipping an answered question moves it, never double-counts
      let correctDelta = 0,
        wrongDelta = 0,
        skippedDelta = 1;
      const had = prev.rows[0];
      if (had) {
        if (had.is_skipped) {
          skippedDelta = 0;
        } else if (had.is_correct) {
          correctDelta = -1;
        } else {
          wrongDelta = -1;
        }
      }
      await skipClient.query(
        `
        UPDATE practice_sessions SET
          correct_count = GREATEST(0, correct_count + $2),
          wrong_count = GREATEST(0, wrong_count + $3),
          skipped_count = GREATEST(0, skipped_count + $4),
          current_index = GREATEST(current_index, $5 + 1),
          last_active_at = NOW()
        WHERE id = $1
      `,
        [sessionId, correctDelta, wrongDelta, skippedDelta, idx],
      );
      await skipClient.query("COMMIT");
    } catch (skipTxnErr) {
      try {
        await skipClient.query("ROLLBACK");
      } catch {
        // rollback best-effort; original error is what matters
      }
      throw skipTxnErr;
    } finally {
      skipClient.release();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

// ═══════════════════════════════════════════════════
// BOOKMARKS
// ═══════════════════════════════════════════════════

/**
 * GET /api/practice/bookmarks
 * ?page=1&limit=20
 */
router.get("/bookmarks", protect, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      100,
    );
    const offset = (page - 1) * limit;

    const r = await pool.query(
      `
      SELECT q.* FROM question_bookmarks qb
      JOIN questions q ON qb.question_id = q.id
      WHERE qb.user_id = $1 AND q.is_active = true
      ORDER BY qb.created_at DESC
      LIMIT $2 OFFSET $3
    `,
      [req.user.id, limit, offset],
    );
    const safe = r.rows.map((row) => {
      const q = dbHelpers.toCamel(row);
      const {
        correctAnswer,
        correct_option,
        correctOption,
        correct,
        answer,
        isCorrect,
        is_correct,
        ...rest
      } = q;
      return rest;
    });
    const total = await pool.query(
      `SELECT COUNT(*)::int AS c FROM question_bookmarks WHERE user_id = $1`,
      [req.user.id],
    );
    // Unified bookmark reads (practice ↔ generic store bridge, best-effort):
    // union generic-store ids into the result. Legacy ids ⊆ helper set
    // (barring races), so deduped union size == helper ids length.
    // Fail-soft: helper throws → keep legacy rows/total above.
    let unifiedTotal = null;
    try {
      const unifiedIds = await getUnifiedBookmarkedQuestionIds(req.user.id);
      if (Array.isArray(unifiedIds)) {
        const seen = new Set(r.rows.map((row) => Number(row.id)));
        const allLegacy = await pool.query(
          `SELECT question_id FROM question_bookmarks WHERE user_id = $1`,
          [req.user.id],
        );
        for (const row of allLegacy.rows) seen.add(Number(row.question_id));
        const missing = unifiedIds.filter((id) => !seen.has(Number(id)));
        if (missing.length) {
          const extra = await pool.query(
            `SELECT q.* FROM questions q
             WHERE q.id = ANY($1::int[]) AND q.is_active = true`,
            [missing],
          );
          for (const row of extra.rows) {
            const q = dbHelpers.toCamel(row);
            const {
              correctAnswer,
              correct_option,
              correctOption,
              correct,
              answer,
              isCorrect,
              is_correct,
              ...rest
            } = q;
            safe.push(rest);
          }
        }
        unifiedTotal = unifiedIds.length;
      }
    } catch {
      // fail-soft: keep legacy rows/total
    }
    res.json({
      success: true,
      data: safe,
      total: unifiedTotal ?? total.rows[0].c,
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * GET /api/practice/bookmarks/count
 */
router.get("/bookmarks/count", protect, async (req, res) => {
  try {
    // Unified count = deduped union size == helper ids length
    // (legacy ids ⊆ helper set barring races). Fail-soft → legacy COUNT.
    try {
      const unifiedIds = await getUnifiedBookmarkedQuestionIds(req.user.id);
      if (Array.isArray(unifiedIds)) {
        return res.json({ success: true, data: { count: unifiedIds.length } });
      }
    } catch {
      // fall through to legacy count below
    }
    const r = await pool.query(
      `SELECT COUNT(*)::int AS c FROM question_bookmarks WHERE user_id = $1`,
      [req.user.id],
    );
    res.json({ success: true, data: { count: r.rows[0].c } });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * POST /api/practice/bookmarks/:questionId
 */
router.post("/bookmarks/:questionId", protect, async (req, res) => {
  try {
    const questionId = parsePositiveInt(req.params.questionId);
    if (!questionId) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid question ID" });
    }
    await pool.query(
      `
      INSERT INTO question_bookmarks (user_id, question_id) VALUES ($1, $2)
      ON CONFLICT (user_id, question_id) DO NOTHING
    `,
      [req.user.id, questionId],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * DELETE /api/practice/bookmarks/:questionId
 */
router.delete("/bookmarks/:questionId", protect, async (req, res) => {
  try {
    const questionId = parsePositiveInt(req.params.questionId);
    if (!questionId) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid question ID" });
    }
    await pool.query(
      `DELETE FROM question_bookmarks WHERE user_id = $1 AND question_id = $2`,
      [req.user.id, questionId],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

// ═══════════════════════════════════════════════════
// MISTAKES NOTEBOOK
// ═══════════════════════════════════════════════════

/**
 * GET /api/practice/mistakes
 * ?page=1&limit=20&subjectId=&topicId=
 */
router.get("/mistakes", protect, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      100,
    );
    const offset = (page - 1) * limit;

    // Unified mistakes across both practice_answers and wrong_questions
    const r = await pool.query(
      `
      WITH unified_mistakes AS (
        SELECT question_id, created_at FROM practice_answers WHERE user_id = $1 AND is_correct = false
        UNION
        SELECT question_id, COALESCE(last_seen_at, updated_at, created_at) AS created_at
        FROM wrong_questions WHERE user_id = $1 AND (is_active = true OR is_active IS NULL)
      ),
      deduped AS (
        SELECT DISTINCT ON (question_id) question_id, created_at
        FROM unified_mistakes
        ORDER BY question_id, created_at DESC
      )
      SELECT d.question_id, d.created_at, q.*
      FROM deduped d
      JOIN questions q ON d.question_id = q.id
      WHERE q.is_active = true
      ORDER BY d.created_at DESC
      LIMIT $2 OFFSET $3
    `,
      [req.user.id, limit, offset],
    );

    const safe = r.rows.map((row) => {
      const q = dbHelpers.toCamel(row);
      const {
        correctAnswer,
        correct_option,
        correctOption,
        correct,
        answer,
        isCorrect,
        is_correct,
        ...rest
      } = q;
      return rest;
    });

    const total = await pool.query(
      `
      WITH unified_mistakes AS (
        SELECT question_id FROM practice_answers WHERE user_id = $1 AND is_correct = false
        UNION
        SELECT question_id FROM wrong_questions WHERE user_id = $1 AND (is_active = true OR is_active IS NULL)
      )
      SELECT COUNT(DISTINCT question_id)::int AS c FROM unified_mistakes
    `,
      [req.user.id],
    );

    res.json({
      success: true,
      data: safe,
      total: total.rows[0]?.c || 0,
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * GET /api/practice/mistakes/count
 */
router.get(
  "/mistakes/count",
  protect,
  responseCache("practice-mistakes-count", 60),
  async (req, res) => {
    try {
      const r = await pool.query(
        `
      WITH unified_mistakes AS (
        SELECT question_id FROM practice_answers WHERE user_id = $1 AND is_correct = false
        UNION
        SELECT question_id FROM wrong_questions WHERE user_id = $1 AND (is_active = true OR is_active IS NULL)
      )
      SELECT COUNT(DISTINCT question_id)::int AS c FROM unified_mistakes
    `,
        [req.user.id],
      );
      res.json({ success: true, data: { count: r.rows[0]?.c || 0 } });
    } catch (err) {
      res
        .status(500)
        .json({ success: false, error: sanitizeErrorMessage(err) });
    }
  },
);

// ═══════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════

/**
 * GET /api/practice/dashboard
 * Aggregated payload for the entry screen (one round-trip).
 */
router.get(
  "/dashboard",
  protect,
  responseCache("practice-dashboard", 60),
  async (req, res) => {
    try {
      const userId = req.user.id;

      // Run all independent queries in parallel
      const todayStr = new Date().toISOString().slice(0, 10);
      const [streakR, todayR, activeR, mistakesR, bookmarksR, masteryR, weakR] =
        await Promise.all([
          pool.query(
            `SELECT user_id, current_streak, longest_streak, last_practice_date, total_sessions, total_questions, total_correct FROM practice_streaks WHERE user_id = $1`,
            [userId],
          ),
          pool.query(
            `
        SELECT COUNT(*)::int AS c,
               SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::int AS correct
        FROM practice_answers WHERE user_id = $1 AND created_at >= $2::date AND created_at < ($2::date + interval '1 day')
      `,
            [userId, todayStr],
          ),
          pool.query(
            `
        SELECT id, user_id, exam_id, subject_id, chapter_id, topic_id, mode, difficulty, target_count, time_limit_sec, questions_json, current_index, correct_count, wrong_count, skipped_count, started_at, last_active_at, completed_at, is_active, is_deleted, deleted_at, deleted_by FROM practice_sessions
        WHERE user_id = $1 AND is_active = true AND completed_at IS NULL
        ORDER BY started_at DESC LIMIT 1
      `,
            [userId],
          ),
          pool.query(
            `SELECT COUNT(DISTINCT question_id)::int AS c FROM practice_answers WHERE user_id = $1 AND is_correct = false`,
            [userId],
          ),
          pool.query(
            `SELECT COUNT(*)::int AS c FROM question_bookmarks WHERE user_id = $1`,
            [userId],
          ),
          pool.query(
            `
        SELECT s.id AS subject_id, s.name AS subject_name, s.color,
               COUNT(pa.id)::int AS attempts,
               SUM(CASE WHEN pa.is_correct THEN 1 ELSE 0 END)::int AS correct
        FROM practice_answers pa
        JOIN questions q ON pa.question_id = q.id
        LEFT JOIN subjects s ON q.subject_id = s.id
        WHERE pa.user_id = $1
        GROUP BY s.id, s.name, s.color
        ORDER BY s.name
      `,
            [userId],
          ),
          pool.query(
            `
        SELECT t.id AS topic_id, t.name AS topic_name,
               COUNT(pa.id)::int AS attempts,
               SUM(CASE WHEN pa.is_correct THEN 1 ELSE 0 END)::int AS correct
        FROM practice_answers pa
        JOIN questions q ON pa.question_id = q.id
        JOIN subject_topics t ON q.topic_id = t.id
        WHERE pa.user_id = $1
        GROUP BY t.id, t.name
        HAVING COUNT(pa.id) >= 3 AND SUM(CASE WHEN pa.is_correct THEN 1 ELSE 0 END)::float / COUNT(pa.id) < 0.6
        ORDER BY (SUM(CASE WHEN pa.is_correct THEN 1 ELSE 0 END)::float / COUNT(pa.id)) ASC
        LIMIT 5
      `,
            [userId],
          ),
        ]);

      const streak = streakR.rows[0]
        ? dbHelpers.toCamel(streakR.rows[0])
        : {
            currentStreak: 0,
            longestStreak: 0,
            totalSessions: 0,
            totalQuestions: 0,
            totalCorrect: 0,
          };

      const todaysGoal = {
        done: todayR.rows[0].c || 0,
        correct: todayR.rows[0].correct || 0,
        target: 50,
      };

      let activeSession = null;
      if (activeR.rows.length) {
        activeSession = dbHelpers.toCamel(activeR.rows[0]);
        delete activeSession.questionsJson;
      }

      const mastery = masteryR.rows
        .map((r) => {
          const attempts = r.attempts || 0;
          const correct = r.correct || 0;
          return {
            subjectId: r.subject_id,
            subjectName: r.subject_name || "General",
            color: r.color,
            attempts,
            accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
          };
        })
        .filter((m) => m.subjectId);

      const weakTopics = weakR.rows.map((r) => ({
        topicId: r.topic_id,
        topicName: r.topic_name,
        attempts: r.attempts,
        accuracy: Math.round((r.correct / r.attempts) * 100),
      }));

      res.json({
        success: true,
        data: {
          streak,
          todaysGoal,
          activeSession,
          counts: {
            mistakes: mistakesR.rows[0].c,
            bookmarks: bookmarksR.rows[0].c,
          },
          mastery,
          weakTopics,
        },
      });
    } catch (err) {
      console.error("GET /api/practice/dashboard error:", err);
      res
        .status(500)
        .json({ success: false, error: sanitizeErrorMessage(err) });
    }
  },
);

// ═══════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════

/**
 * POST /api/practice/questions/:id/report
 * Body: { reason, notes }
 */
router.post("/questions/:id/report", protect, async (req, res) => {
  try {
    const questionId = parsePositiveInt(req.params.id);
    if (!questionId) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid question ID" });
    }
    const reason = req.body.reason || "Incorrect answer/solution";
    const notes = req.body.notes || req.body.comment || null;

    await pool.query(
      `
      INSERT INTO question_reports (user_id, question_id, reason, notes, status, created_at)
      VALUES ($1, $2, $3, $4, 'pending', NOW())
    `,
      [req.user.id, String(questionId), reason, notes],
    );

    res.json({ success: true, message: "Question reported successfully" });
  } catch (err) {
    console.error("POST /questions/:id/report error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * GET /api/practice/reports/my
 * User gets ONLY questions reported by themselves ("only by him").
 */
router.get("/reports/my", protect, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 50, 1),
      100,
    );
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `
      SELECT qr.id, qr.question_id, qr.reason, qr.notes, qr.status, qr.created_at,
             COALESCE(q.question_text, 'Question ID: ' || qr.question_id) AS question_text,
             q.options, q.explanation, q.subject, q.topic
      FROM question_reports qr
      LEFT JOIN questions q ON q.id::text = qr.question_id::text
      WHERE qr.user_id = $1
      ORDER BY qr.created_at DESC
      LIMIT $2 OFFSET $3
    `,
      [req.user.id, limit, offset],
    );

    const countRes = await pool.query(
      `
      SELECT COUNT(*)::int AS total FROM question_reports WHERE user_id = $1
    `,
      [req.user.id],
    );

    res.json({
      success: true,
      data: result.rows.map((r) => dbHelpers.toCamel(r)),
      total: countRes.rows[0]?.total || 0,
      page,
      limit,
    });
  } catch (err) {
    console.error("GET /reports/my error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * GET /api/practice/reports/my
 * User gets ONLY questions reported by themselves ("only by him").
 */

/**
 * GET /api/practice/reports/admin/all
 * Admin gets ALL reported questions across all users.
 */
router.get("/reports/admin/all", protect, admin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 50, 1),
      100,
    );
    const offset = (page - 1) * limit;
    const statusFilter = req.query.status;

    let queryText = `
      SELECT qr.id, qr.question_id, qr.reason, qr.notes, qr.status, qr.created_at,
             u.id AS user_id, u.name AS user_name, u.email AS user_email,
             COALESCE(q.question_text, 'Question ID: ' || qr.question_id) AS question_text,
             q.options, q.explanation, q.subject, q.topic
      FROM question_reports qr
      LEFT JOIN users u ON u.id = qr.user_id
      LEFT JOIN questions q ON q.id::text = qr.question_id::text
    `;
    const queryParams = [];

    if (statusFilter && statusFilter !== "all") {
      queryParams.push(statusFilter);
      queryText += ` WHERE qr.status = $${queryParams.length}`;
    }

    queryText += ` ORDER BY qr.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const result = await pool.query(queryText, queryParams);

    let countQueryText = `SELECT COUNT(*)::int AS total FROM question_reports qr`;
    const countQueryParams = [];
    if (statusFilter && statusFilter !== "all") {
      countQueryParams.push(statusFilter);
      countQueryText += ` WHERE qr.status = $1`;
    }
    const countRes = await pool.query(countQueryText, countQueryParams);

    res.json({
      success: true,
      // PII: mask user_email on admin list endpoint
      data: result.rows.map((r) => maskPiiRow(dbHelpers.toCamel(r))),
      total: countRes.rows[0]?.total || 0,
      page,
      limit,
    });
  } catch (err) {
    console.error("GET /reports/admin/all error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * PUT /api/practice/reports/admin/:id/status
 * Admin updates status of reported question.
 */
router.put("/reports/admin/:id/status", protect, admin, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const reportId = parsePositiveInt(req.params.id);
    if (!reportId) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid report ID" });
    }
    const safeStatus = status || "resolved";
    const VALID_REPORT_STATUSES = ["pending", "resolved", "rejected"];
    if (!VALID_REPORT_STATUSES.includes(safeStatus)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }

    const result = await pool.query(
      `
      UPDATE question_reports
      SET status = $1, notes = COALESCE($2, notes)
      WHERE id = $3
      RETURNING *
    `,
      [safeStatus, notes || null, reportId],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Report not found" });
    }

    res.json({ success: true, data: dbHelpers.toCamel(result.rows[0]) });
  } catch (err) {
    console.error("PUT /reports/admin/:id/status error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * GET /api/practice/bookmarks/admin/all
 * Admin gets ALL saved questions/items across all users with full metadata.
 */
router.get("/bookmarks/admin/all", protect, admin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 50, 1),
      100,
    );
    const offset = (page - 1) * limit;
    const itemType = req.query.itemType;

    let queryText = `
      SELECT b.id, b.item_type, b.item_id, b.title, b.metadata, b.created_at,
             u.id AS user_id, u.name AS user_name, u.email AS user_email,
             q.question_text, q.subject, q.topic, q.chapter, q.difficulty, q.options, q.explanation
      FROM bookmarks b
      LEFT JOIN users u ON u.id = b.user_id
      LEFT JOIN questions q ON (b.item_type = 'question' AND q.id::text = b.item_id::text)
    `;
    const queryParams = [];

    if (itemType && itemType !== "all") {
      queryParams.push(itemType);
      queryText += ` WHERE b.item_type = $${queryParams.length}`;
    }

    queryText += ` ORDER BY b.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const result = await pool.query(queryText, queryParams);

    let countQueryText = `SELECT COUNT(*)::int AS total FROM bookmarks b`;
    const countQueryParams = [];
    if (itemType && itemType !== "all") {
      countQueryParams.push(itemType);
      countQueryText += ` WHERE b.item_type = $1`;
    }
    const countRes = await pool.query(countQueryText, countQueryParams);

    res.json({
      success: true,
      // PII: mask user_email on admin list endpoint
      data: result.rows.map((r) => maskPiiRow(dbHelpers.toCamel(r))),
      total: countRes.rows[0]?.total || 0,
      page,
      limit,
    });
  } catch (err) {
    console.error("GET /bookmarks/admin/all error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

// ═══════════════════════════════════════════════════
// LEGACY (kept for backwards compatibility — old page)
// ═══════════════════════════════════════════════════

/**
 * GET /api/practice/questions
 * Auth required; answer keys are never exposed (correct_option stripped).
 */
router.get("/questions", protect, async (req, res) => {
  try {
    const { subject, topic, difficulty, page = 1, limit = 20 } = req.query;
    const filters = { is_practice: true, subject, topic, difficulty };
    const allowedFields = ["is_practice", "subject", "topic", "difficulty"];
    const { executePaginatedQuery } =
      await import("../../utils/queryBuilder.js");
    const result = await executePaginatedQuery(
      dbHelpers,
      "questions",
      [
        "id",
        "question_text",
        "options",
        "explanation",
        "subject",
        "topic",
        "difficulty",
        "language",
      ],
      filters,
      allowedFields,
      { page, limit },
    );
    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error) });
  }
});

router.get("/questions/:id", protect, async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid question ID" });
    }
    const result = await pool.query(
      `SELECT id, question_text, options, explanation, subject, topic, difficulty, language
       FROM questions WHERE id = $1 AND is_practice = true AND is_active = true`,
      [id],
    );
    if (!result.rows.length)
      return res
        .status(404)
        .json({ success: false, error: "Question not found" });
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error) });
  }
});

// ═══════════════════════════════════════════════════
// PRACTICE ENGINE REDESIGN ENDPOINTS
// ═══════════════════════════════════════════════════

/**
 * GET /api/practice/fundamentals/categories
 * Returns fundamental calculation categories and user mastery status.
 */
router.get("/fundamentals/categories", protect, async (req, res) => {
  try {
    const userMasteryR = await pool.query(
      `
      SELECT category, level, score, best_speed_ms, total_attempts, last_practiced_at
      FROM user_fundamental_mastery
      WHERE user_id = $1
    `,
      [req.user.id],
    );

    const masteryMap = {};
    userMasteryR.rows.forEach((r) => {
      masteryMap[r.category] = dbHelpers.toCamel(r);
    });

    const categories = [
      {
        id: "tables",
        title: "Tables (1–30)",
        description: "Master multiplication speed and mental calculation",
        icon: "🔢",
      },
      {
        id: "squares",
        title: "Squares (1–50)",
        description: "Fast recall of square values",
        icon: "²",
      },
      {
        id: "cubes",
        title: "Cubes (1–30)",
        description: "Fast recall of cube values",
        icon: "³",
      },
      {
        id: "roots",
        title: "Square & Cube Roots",
        description: "Recognize perfect roots & estimations",
        icon: "√",
      },
      {
        id: "fractions",
        title: "Fractions ↔ % ↔ Decimals",
        description: "Convert common fraction primitives",
        icon: "½",
      },
      {
        id: "ratios",
        title: "Ratio Primitives (a:b:c)",
        description: "Equivalent ratios and quick scaling",
        icon: "⚖️",
      },
      {
        id: "triplets",
        title: "Mathematical Triplets",
        description: "Pythagorean & common algebraic triplets",
        icon: "🔺",
      },
      {
        id: "mental_math",
        title: "Mental Shortcuts (×5, ×11, ÷25)",
        description: "Speed calculation techniques",
        icon: "⚡",
      },
    ].map((cat) => ({
      ...cat,
      mastery: masteryMap[cat.id] || {
        level: 1,
        score: 0,
        bestSpeedMs: 0,
        totalAttempts: 0,
      },
    }));

    res.json({ success: true, data: categories });
  } catch (err) {
    console.error("GET /fundamentals/categories error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * GET /api/practice/fundamentals/drill
 * Query: { category, count }
 */
router.get("/fundamentals/drill", protect, async (req, res) => {
  try {
    const { category = "tables", count = 10 } = req.query;
    // Clamp per-batch drill length (1–50). The UI picks its own round length
    // and endless mode simply requests more batches — nothing is persisted.
    const batchCount = Math.min(Math.max(parseInt(count, 10) || 10, 1), 50);
    const questions = [];

    for (let i = 0; i < batchCount; i++) {
      if (category === "tables") {
        const a = Math.floor(Math.random() * 20) + 11;
        const b = Math.floor(Math.random() * 12) + 2;
        questions.push({
          id: `tb_${i}`,
          prompt: `${a} × ${b} = ?`,
          answer: String(a * b),
          options: [
            String(a * b),
            String(a * b + b),
            String(a * b - a),
            String((a + 1) * b),
          ],
        });
      } else if (category === "squares") {
        const n = Math.floor(Math.random() * 40) + 11;
        questions.push({
          id: `sq_${i}`,
          prompt: `${n}² = ?`,
          answer: String(n * n),
          options: [
            String(n * n),
            String((n + 1) * (n + 1)),
            String(n * n - 10),
            String((n - 1) * (n - 1)),
          ],
        });
      } else if (category === "cubes") {
        const n = Math.floor(Math.random() * 20) + 5;
        questions.push({
          id: `cb_${i}`,
          prompt: `${n}³ = ?`,
          answer: String(n * n * n),
          options: [
            String(n * n * n),
            String((n + 1) * (n + 1) * (n + 1)),
            String(n * n * n - 20),
          ],
        });
      } else if (category === "roots") {
        const n = Math.floor(Math.random() * 30) + 5;
        const sq = n * n;
        questions.push({
          id: `rt_${i}`,
          prompt: `√${sq} = ?`,
          answer: String(n),
          options: [String(n), String(n + 2), String(n - 1), String(n + 5)],
        });
      } else if (category === "fractions") {
        const pairs = [
          { f: "1/2", p: "50%" },
          { f: "1/3", p: "33.33%" },
          { f: "1/4", p: "25%" },
          { f: "1/5", p: "20%" },
          { f: "1/6", p: "16.66%" },
          { f: "1/8", p: "12.5%" },
          { f: "1/10", p: "10%" },
          { f: "3/8", p: "37.5%" },
          { f: "5/8", p: "62.5%" },
        ];
        const choice = pairs[Math.floor(Math.random() * pairs.length)];
        questions.push({
          id: `fr_${i}`,
          prompt: `Convert ${choice.f} to Percentage`,
          answer: choice.p,
          options: [choice.p, "40%", "15%", "30%"],
        });
      } else {
        const a = Math.floor(Math.random() * 15) + 3;
        const b = Math.floor(Math.random() * 10) + 2;
        questions.push({
          id: `gen_${i}`,
          prompt: `${a} + ${b} × 5 = ?`,
          answer: String(a + b * 5),
          options: [String(a + b * 5), String((a + b) * 5), String(a * 5 + b)],
        });
      }
    }

    res.json({ success: true, data: { category, questions } });
  } catch (err) {
    console.error("GET /fundamentals/drill error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * POST /api/practice/fundamentals/submit
 * Body: { category, score, totalQuestions, durationMs }
 */
router.post(
  "/fundamentals/submit",
  protect,
  practiceSubmissionLimiter,
  async (req, res) => {
    try {
      const { category, score, totalQuestions, durationMs } = req.body;
      // Numeric guards (mirror test submit): non-numeric drill metrics are a
      // 400; valid values are clamped so a stale client can't poison mastery.
      for (const [label, val] of [
        ["score", score],
        ["totalQuestions", totalQuestions],
        ["durationMs", durationMs],
      ]) {
        if (val !== undefined && val !== null && val !== "") {
          const n = Number(val);
          if (!Number.isFinite(n)) {
            return res
              .status(400)
              .json({ success: false, error: `${label} must be a number` });
          }
        }
      }
      const safeScore = Math.min(Math.max(Number(score) || 0, 0), 10000);
      const safeTotal = Math.min(
        Math.max(Number(totalQuestions) || 0, 0),
        10000,
      );
      const safeDurationMs = Math.min(
        Math.max(Number(durationMs) || 0, 0),
        24 * 3600 * 1000,
      );
      const accuracy = safeTotal > 0 ? (safeScore / safeTotal) * 100 : 0;
      const avgSpeedMs =
        safeTotal > 0 ? Math.round(safeDurationMs / safeTotal) : 0;

      const level = accuracy >= 80 ? 5 : accuracy >= 60 ? 3 : 1;

      await pool.query(
        `
      INSERT INTO user_fundamental_mastery (user_id, category, level, score, best_speed_ms, total_attempts, last_practiced_at)
      VALUES ($1, $2, $3, $4, $5, 1, NOW())
      ON CONFLICT (user_id, category) DO UPDATE SET
        level = GREATEST(user_fundamental_mastery.level, EXCLUDED.level),
        score = GREATEST(user_fundamental_mastery.score, EXCLUDED.score),
        best_speed_ms = CASE WHEN user_fundamental_mastery.best_speed_ms = 0 THEN EXCLUDED.best_speed_ms ELSE LEAST(user_fundamental_mastery.best_speed_ms, EXCLUDED.best_speed_ms) END,
        total_attempts = user_fundamental_mastery.total_attempts + 1,
        last_practiced_at = NOW()
    `,
        [req.user.id, category, level, Math.round(accuracy), avgSpeedMs],
      );

      res.json({
        success: true,
        message: "Fundamental drill recorded",
        level,
        accuracy,
      });
    } catch (err) {
      console.error("POST /fundamentals/submit error:", err);
      res
        .status(500)
        .json({ success: false, error: sanitizeErrorMessage(err) });
    }
  },
);

/**
 * GET /api/practice/questions/:id/explanations
 * Returns structured multi-tab explanation (Text, Visual, Video, Formula).
 */
router.get("/questions/:id/explanations", protect, async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid question ID" });
    }
    const qR = await pool.query(
      `SELECT id, question_text, question_text_hi, explanation, explanation_hi, options, options_hi, correct_option FROM questions WHERE id = $1`,
      [id],
    );
    if (!qR.rows.length)
      return res
        .status(404)
        .json({ success: false, error: "Question not found" });

    const q = qR.rows[0];

    const v2R = await pool.query(
      `SELECT explanation_text, explanation_visual, explanation_video, explanation_formula FROM question_explanations_v2 WHERE question_id = $1`,
      [id],
    );
    const v2 = v2R.rows[0] || {};

    const textExplanation = v2.explanation_text || {
      concept: "Key Concept & Definition",
      stepByStep:
        q.explanation ||
        "Step 1: Identify given variables. Step 2: Apply main identity or formula. Step 3: Calculate final answer.",
      stepByStepHi: q.explanation_hi || null,
      shortcut:
        "Exam Shortcut: Use option elimination or percentage ratio scaling to save 30 seconds.",
      commonMistake:
        "Common Mistake: Forgetting to adjust for percentage change direction.",
    };

    const visualExplanation = v2.explanation_visual || {
      diagramUrl: null,
      svgContent:
        '<svg width="200" height="100"><rect width="200" height="100" fill="#f3f4f6"/><text x="20" y="55" font-family="sans-serif" font-size="14" fill="#374151">Visual Diagram Schema</text></svg>',
      animationSteps: [
        "Initial state representation",
        "Transformation step",
        "Final state",
      ],
    };

    const videoExplanation = v2.explanation_video || {
      videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      durationSeconds: 180,
      timestamps: [
        { time: "0:30", title: "Problem Setup" },
        { time: "1:15", title: "Shortcut Trick" },
      ],
      transcript:
        "In this question we look at successive percentage change using standard ratio method...",
    };

    const formulaExplanation = v2.explanation_formula || [
      {
        name: "Percentage Change",
        formulaLatex:
          "\\text{Change}\\% = \\frac{\\text{Final} - \\text{Initial}}{\\text{Initial}} \\times 100",
        description: "Standard formula for percentage increase or decrease",
      },
      {
        name: "Successive Change",
        formulaLatex: "a + b + \\frac{ab}{100}",
        description: "Quick formula for two consecutive percentage changes",
      },
    ];

    res.json({
      success: true,
      data: {
        text: textExplanation,
        visual: visualExplanation,
        video: videoExplanation,
        formula: formulaExplanation,
      },
    });
  } catch (err) {
    console.error("GET /questions/:id/explanations error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * GET /api/practice/questions/:id/approaches
 */
router.get("/questions/:id/approaches", protect, async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid question ID" });
    }
    const r = await pool.query(
      `
      SELECT id, user_id, author_name, approach_type, title, content, time_complexity, upvotes, is_approved, is_community_best, created_at
      FROM question_approaches
      WHERE question_id = $1 AND is_approved = true
      ORDER BY is_community_best DESC, upvotes DESC, created_at DESC
    `,
      [id],
    );

    const approaches = r.rows.map((row) => dbHelpers.toCamel(row));
    res.json({ success: true, data: approaches });
  } catch (err) {
    console.error("GET /questions/:id/approaches error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * POST /api/practice/questions/:id/approaches
 */
router.post("/questions/:id/approaches", protect, async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid question ID" });
    }
    const {
      approachType = "fastest",
      title,
      content,
      timeComplexity,
    } = req.body;

    const userR = await pool.query(`SELECT name FROM users WHERE id = $1`, [
      req.user.id,
    ]);
    const authorName = userR.rows[0]?.name || "Student";

    const r = await pool.query(
      `
      INSERT INTO question_approaches (question_id, user_id, author_name, approach_type, title, content, time_complexity, upvotes, is_approved)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 1, true)
      RETURNING *
    `,
      [
        id,
        req.user.id,
        authorName,
        approachType,
        title || "Community Solution",
        content,
        timeComplexity || "Standard",
      ],
    );

    res.json({ success: true, data: dbHelpers.toCamel(r.rows[0]) });
  } catch (err) {
    console.error("POST /questions/:id/approaches error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * POST /api/practice/questions/:id/approaches/:approachId/upvote
 */
router.post(
  "/questions/:id/approaches/:approachId/upvote",
  protect,
  async (req, res) => {
    try {
      const questionId = parsePositiveInt(req.params.id);
      if (!questionId) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid question ID" });
      }
      const approachId = parsePositiveInt(req.params.approachId);
      if (!approachId) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid approach ID" });
      }
      const r = await pool.query(
        `
      UPDATE question_approaches SET upvotes = upvotes + 1 WHERE id = $1 AND question_id = $2 RETURNING upvotes
    `,
        [approachId, questionId],
      );
      if (!r.rows.length) {
        return res
          .status(404)
          .json({ success: false, error: "Approach not found" });
      }
      res.json({ success: true, upvotes: r.rows[0].upvotes });
    } catch (err) {
      res
        .status(500)
        .json({ success: false, error: sanitizeErrorMessage(err) });
    }
  },
);

/**
 * GET /api/practice/questions/:id/similar
 */
router.get("/questions/:id/similar", protect, async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid question ID" });
    }
    const qR = await pool.query(
      `SELECT subject_id, topic_id, difficulty FROM questions WHERE id = $1`,
      [id],
    );
    const q = qR.rows[0] || {};

    // Fast random path first (TABLESAMPLE BERNOULLI pre-filter), exact
    // ORDER BY RANDOM() fallback — same try/catch pattern as the picker.
    const similarWhere = `WHERE (topic_id = $1 OR subject_id = $2) AND id != $3 AND is_practice = true AND is_active = true`;
    const similarParams = [q.topic_id || 0, q.subject_id || 0, id];
    let simR;
    try {
      simR = await pool.query(
        `
      SELECT id, question_text, difficulty, options
      FROM questions TABLESAMPLE BERNOULLI(20)
      ${similarWhere}
      ORDER BY RANDOM()
      LIMIT 5
    `,
        similarParams,
      );
      if (!simR.rows.length) throw new Error("empty sample — use fallback");
    } catch {
      simR = await pool.query(
        `
      SELECT id, question_text, difficulty, options
      FROM questions
      ${similarWhere}
      ORDER BY RANDOM()
      LIMIT 5
    `,
        similarParams,
      );
    }

    res.json({
      success: true,
      data: simR.rows.map((row) => dbHelpers.toCamel(row)),
    });
  } catch (err) {
    console.error("GET /questions/:id/similar error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * POST /api/practice/vault/save
 */
router.post("/vault/save", protect, async (req, res) => {
  try {
    const {
      questionId: rawQuestionId,
      saveReason = "needs_revision",
      collectionName = "Default",
      userNotes,
    } = req.body;
    const questionId = parsePositiveInt(rawQuestionId);
    if (!questionId) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid question ID" });
    }

    const r = await pool.query(
      `
      INSERT INTO knowledge_vault_items (user_id, question_id, save_reason, collection_name, user_notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
      [req.user.id, questionId, saveReason, collectionName, userNotes || null],
    );

    res.json({ success: true, data: dbHelpers.toCamel(r.rows[0]) });
  } catch (err) {
    console.error("POST /vault/save error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * GET /api/practice/vault/items
 */
router.get("/vault/items", protect, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      100,
    );
    const offset = (page - 1) * limit;
    const r = await pool.query(
      `
      SELECT kv.id, kv.save_reason, kv.collection_name, kv.user_notes, kv.created_at,
             q.id AS question_id, q.question_text, q.subject, q.topic, q.difficulty
      FROM knowledge_vault_items kv
      JOIN questions q ON q.id = kv.question_id
      WHERE kv.user_id = $1
      ORDER BY kv.created_at DESC
      LIMIT $2 OFFSET $3
    `,
      [req.user.id, limit, offset],
    );

    res.json({
      success: true,
      data: r.rows.map((row) => dbHelpers.toCamel(row)),
      page,
      limit,
    });
  } catch (err) {
    console.error("GET /vault/items error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * POST /api/practice/ai/tutor
 *
 * Keyless "search connect" tutor: no LLM key needed. The answer is composed
 * from the question's own DB context (explanation, approved approaches,
 * similar questions) plus keyless web search, via buildSearchGroundedAnswer.
 * Static strings below are the last-resort fallback only.
 */
router.post("/ai/tutor", protect, async (req, res) => {
  try {
    const {
      questionId,
      promptType = "hint",
      userAnswer,
      language = "en",
      studentAttempt = "",
    } = req.body || {};
    if (
      questionId !== undefined &&
      questionId !== null &&
      questionId !== "" &&
      !parsePositiveInt(questionId)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid question ID" });
    }

    // Only look up the question when a numeric questionId was supplied;
    // when absent, skip the query entirely (no behavior change otherwise).
    let q = null;
    let dbContext = String(studentAttempt || "").slice(0, 400);
    let similarTitles = [];
    if (questionId !== undefined && questionId !== null && questionId !== "") {
      const qR = await pool.query(
        `SELECT id, question_text, explanation, options, correct_option, topic_id, subject_id FROM questions WHERE id = $1`,
        [questionId],
      );
      q = qR.rows[0] || null;
      if (q) {
        try {
          const ctxR = await pool.query(
            `SELECT content FROM question_explanations_v2 WHERE question_id = $1 ORDER BY created_at DESC LIMIT 1`,
            [q.id],
          );
          if (ctxR.rows[0]?.content)
            dbContext =
              `${dbContext}\n${String(ctxR.rows[0].content).slice(0, 400)}`.trim();
        } catch {
          /* explanations table optional */
        }
        try {
          const simR = await pool.query(
            `SELECT id, question_text FROM questions
              WHERE id <> $1 AND (topic_id = $2 OR subject_id = $3)
                AND (is_deleted = false OR is_deleted IS NULL)
              ORDER BY id DESC LIMIT 3`,
            [q.id, q.topic_id, q.subject_id],
          );
          similarTitles = simR.rows.map((r) => ({
            title: `Practice Q${r.id}: ${String(r.question_text || "").slice(0, 90)}`,
            url: `/practice?mode=similar&questionId=${r.id}`,
            snippet: "",
          }));
        } catch {
          /* similar lookup optional */
        }
      }
    }

    // Keyless web search (fail-soft): enrich with external sources, never gate.
    let webHits = [];
    try {
      const { freeWebSearch } = await import("../../modules/ai/aiClient.js");
      const queryText =
        q?.question_text ||
        req.body?.doubt ||
        req.body?.topic ||
        "competitive exam concept explanation";
      webHits = await freeWebSearch(queryText, { limit: 3 });
    } catch {
      webHits = [];
    }

    let opts = [];
    try {
      const raw = q?.options;
      opts = Array.isArray(raw) ? raw : JSON.parse(raw || "[]");
    } catch {
      opts = [];
    }

    let responseText = "";
    let provider = "static";
    try {
      const { buildSearchGroundedAnswer } =
        await import("../../modules/ai/aiClient.js");
      const grounded = buildSearchGroundedAnswer({
        kind: "tutor",
        promptType,
        questionText: q?.question_text || "",
        options: opts,
        correctOption: q?.correct_option ?? null,
        explanation: q?.explanation || "",
        dbContext,
        webHits: [...similarTitles, ...webHits],
        language,
      });
      // Use grounded answer whenever we had any real context; otherwise fall
      // through to the static last-resort strings.
      if (q || webHits.length > 0 || dbContext) {
        responseText = grounded;
        provider = "search";
      }
    } catch {
      /* fall through to static */
    }
    if (!responseText) {
      if (promptType === "hint") {
        responseText =
          "💡 **Hint**: Look at the relation between initial and final values. Express the successive change as a single ratio.";
      } else if (promptType === "explain_simply") {
        responseText =
          "🧒 **Simple Explanation**: Imagine you have ₹100. If you increase it by 10%, it becomes ₹110. If you then decrease it by 10%, 10% of 110 is ₹11, so it becomes ₹99! That is a net loss of 1%.";
      } else if (promptType === "another_method") {
        responseText =
          "⚡ **Alternative Method**: Use the formula $a + b + \\frac{ab}{100}$. Here $a = +10$, $b = -10$, so $10 - 10 - \\frac{100}{100} = -1\\%$.";
      } else {
        responseText = `🔍 **Error Diagnosis**: Option ${userAnswer} assumes simple subtraction instead of applying percentage to the updated base value.`;
      }
    }

    res.json({
      success: true,
      data: {
        promptType,
        response: responseText,
        provider,
        sources: [...similarTitles, ...webHits].slice(0, 5),
      },
    });
  } catch (err) {
    console.error("POST /ai/tutor error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * POST /api/practice/adaptive-diagnostic
 * Dynamically synthesizes an adaptive diagnostic mock test customized
 * to the candidate's critical weak and developing topics.
 */
router.post("/adaptive-diagnostic", protect, async (req, res) => {
  try {
    const { questionCount, durationMinutes, title } = req.body || {};
    // Numeric guards: present-but-NaN is a 400; valid values are clamped
    // (questionCount 1–200, durationMinutes 1–360). Absent values pass
    // through as undefined so the service defaults apply.
    const isProvided = (v) => v !== undefined && v !== null && v !== "";
    let safeQuestionCount;
    if (isProvided(questionCount)) {
      const n = Number(questionCount);
      if (!Number.isFinite(n)) {
        return res
          .status(400)
          .json({ success: false, error: "questionCount must be a number" });
      }
      safeQuestionCount = Math.min(Math.max(Math.floor(n), 1), 200);
    }
    let safeDurationMinutes;
    if (isProvided(durationMinutes)) {
      const n = Number(durationMinutes);
      if (!Number.isFinite(n)) {
        return res
          .status(400)
          .json({ success: false, error: "durationMinutes must be a number" });
      }
      safeDurationMinutes = Math.min(Math.max(Math.floor(n), 1), 360);
    }
    const { generateAdaptiveDiagnosticTest } =
      await import("../../services/core/adaptiveDiagnosticService.js");
    const result = await generateAdaptiveDiagnosticTest(req.user.id, {
      questionCount: safeQuestionCount,
      durationMinutes: safeDurationMinutes,
      title,
    });
    res.json(result);
  } catch (err) {
    console.error("POST /adaptive-diagnostic error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

export default router;
