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
import { protect, admin } from "../../middleware/auth.middleware.js";
import { responseCache } from "../../middleware/responseCache.middleware.js";
import { recordPracticeAnalytics } from "../../services/core/analyticsService.js";
import { sanitizeErrorMessage } from "../../utils/sanitizeError.js";

const router = express.Router();

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
 * Pick N random practice question IDs matching filters.
 */
async function pickPracticeQuestionIds({
  subjectId,
  chapterId,
  topicId,
  difficulty,
  mode,
  count,
  userId,
  testId,
}) {
  const conditions = [PRACTICE_Q_WHERE];
  const params = [];
  let idx = 1;

  if (topicId && !isNaN(Number(topicId))) {
    conditions.push(`q.topic_id = $${idx}`);
    params.push(Number(topicId));
    idx++;
  }
  if (chapterId && !isNaN(Number(chapterId))) {
    // Questions linked to chapter_id directly OR topics under this chapter
    conditions.push(`(
      q.chapter_id = $${idx}
      OR q.topic_id IN (SELECT id FROM subject_topics WHERE chapter_id = $${idx})
    )`);
    params.push(Number(chapterId));
    idx++;
  }
  if (subjectId && !isNaN(Number(subjectId))) {
    conditions.push(`(
      q.subject_id = $${idx}
      OR q.chapter_id IN (SELECT id FROM subject_chapters WHERE subject_id = $${idx} OR study_material_id = $${idx})
      OR q.topic_id IN (
        SELECT t.id FROM subject_topics t
        JOIN subject_chapters c ON t.chapter_id = c.id
        WHERE (c.study_material_id = $${idx} OR c.subject_id = $${idx})
      )
    )`);
    params.push(Number(subjectId));
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
  } else if (mode === "bookmark") {
    conditions.push(
      `q.id IN (SELECT question_id FROM question_bookmarks WHERE user_id = $${idx})`,
    );
    params.push(userId);
    idx++;
  } else if (mode === "pyq") {
    conditions.push(`q.tags @> ARRAY['pyq']::text[]`);
  }

  // Adaptive: order by difficulty asc (Easy first), we'll adjust on the fly
  const orderBy =
    mode === "adaptive"
      ? `CASE LOWER(COALESCE(q.difficulty,'medium')) WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, RANDOM()`
      : `RANDOM()`;

  const sql = `
    SELECT q.id FROM questions q
    WHERE ${conditions.join(" AND ")}
    ORDER BY ${orderBy}
    LIMIT $${idx}
  `;
  params.push(count || 20);
  let r = await pool.query(sql, params);

  // Fallback: if no questions found for specific topic (only for general modes, not for mistakes)
  if (r.rows.length === 0 && mode !== "mistakes") {
    const fallbackSql = `
      SELECT q.id FROM questions q
      WHERE ${PRACTICE_Q_WHERE}
      ORDER BY RANDOM()
      LIMIT $1
    `;
    r = await pool.query(fallbackSql, [count || 20]);
  }

  return r.rows.map((row) => row.id);
}

/**
 * Get a question for the user, stripping the correct answer.
 */
async function getSafeQuestion(questionId) {
  const r = await pool.query(
    `
    SELECT q.id, q.question_text, q.options, q.explanation, q.subject, q.topic,
           q.difficulty, q.language, q.topic_id,
           q.subject_id
    FROM questions q
    WHERE q.id = $1 AND (q.is_active = true OR q.is_active IS NULL)
  `,
    [questionId],
  );
  if (!r.rows.length) return null;
  const row = dbHelpers.toCamel(r.rows[0]);
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
  return safe;
}

/**
 * Get the correct option index for a question (handles multiple field names).
 */
async function getCorrectOption(questionId) {
  const r = await pool.query(
    `
    SELECT correct_option, correct_option_index, correct_answer, correct
    FROM questions WHERE id = $1
  `,
    [questionId],
  );
  if (!r.rows.length) return null;
  const row = dbHelpers.toCamel(r.rows[0]);
  const raw =
    row.correctOption ??
    row.correctOptionIndex ??
    row.correctAnswer ??
    row.correct;
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  if (Number.isFinite(n)) return n;
  // BUGFIX: letter-stored answers ("A".."D") previously broke strict ===
  // against numeric selections; map them deterministically instead.
  const s = String(raw).trim().toUpperCase();
  return /^[A-D]$/.test(s) ? s.charCodeAt(0) - 65 : raw;
}

/**
 * Recompute mastery % for a user+topic from practice_answers + question_attempts.
 * Written to user_topic_performance (if table exists) or returned directly.
 */
async function computeTopicMastery(userId, topicId) {
  // Pull practice answers for this topic
  const r = await pool.query(
    `
    SELECT pa.is_correct, q.difficulty
    FROM practice_answers pa
    JOIN questions q ON pa.question_id = q.id
    WHERE pa.user_id = $1 AND q.topic_id = $2
    ORDER BY pa.created_at DESC
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
 */
async function bumpStreak(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const r = await pool.query(
    `SELECT user_id, current_streak, longest_streak, last_practice_date, total_sessions, total_questions, total_correct FROM practice_streaks WHERE user_id = $1`,
    [userId],
  );
  const existing = r.rows[0];
  if (!existing) {
    await pool.query(
      `
      INSERT INTO practice_streaks (user_id, current_streak, longest_streak, last_practice_date, total_sessions, total_questions, total_correct)
      VALUES ($1, 1, 1, $2, 1, 0, 0)
    `,
      [userId, today],
    );
    return { current: 1, longest: 1 };
  }
  let current = existing.current_streak;
  if (existing.last_practice_date?.toISOString().slice(0, 10) === today) {
    // already counted today — keep streak, just bump session count
  } else {
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);
    if (existing.last_practice_date?.toISOString().slice(0, 10) === yesterday) {
      current += 1;
    } else {
      current = 1;
    }
  }
  const longest = Math.max(existing.longest_streak, current);
  await pool.query(
    `
    UPDATE practice_streaks
    SET current_streak = $2, longest_streak = $3, last_practice_date = $4,
        total_sessions = total_sessions + 1
    WHERE user_id = $1
  `,
    [userId, current, longest, today],
  );
  return { current, longest };
}

// ═══════════════════════════════════════════════════
// TREE & METADATA
// ═══════════════════════════════════════════════════

/**
 * GET /api/practice/tree
 * Returns a pruned curriculum tree: exam → subject → chapter → topic,
 * only branches that contain at least one practice question.
 */
router.get("/tree", protect, async (req, res) => {
  try {
    const userId = req.user.id;

    // Practice question counts per topic_id
    const qCounts = await pool.query(`
      SELECT q.topic_id AS topic_id, COUNT(*)::int AS c,
             SUM(CASE WHEN LOWER(q.difficulty)='easy' THEN 1 ELSE 0 END)::int AS easy,
             SUM(CASE WHEN LOWER(q.difficulty)='medium' THEN 1 ELSE 0 END)::int AS medium,
             SUM(CASE WHEN LOWER(q.difficulty)='hard' THEN 1 ELSE 0 END)::int AS hard
      FROM questions q
      WHERE ${PRACTICE_Q_WHERE} AND q.topic_id IS NOT NULL
      GROUP BY q.topic_id
    `);
    const topicMap = {};
    for (const r of qCounts.rows) {
      topicMap[r.topic_id] = {
        count: r.c,
        easy: r.easy,
        medium: r.medium,
        hard: r.hard,
      };
    }

    // All topics that have practice questions
    const topicIds = Object.keys(topicMap).map(Number);
    if (!topicIds.length) {
      return res.json({ success: true, data: { exams: [] } });
    }

    // Pull topics → chapters → subjects (via study_material_id) → subjects → exam categories
    const topics = await pool.query(
      `
      SELECT t.id, t.name, t.slug, t.chapter_id
      FROM subject_topics t WHERE t.id = ANY($1::int[]) AND t.is_active = true
      ORDER BY t.order_index, t.name
    `,
      [topicIds],
    );
    const chapterIds = [
      ...new Set(topics.rows.map((t) => t.chapter_id).filter(Boolean)),
    ];

    const chapters = await pool.query(
      `
      SELECT c.id, c.title, c.slug, COALESCE(c.subject_id, c.study_material_id) as study_material_id
      FROM subject_chapters c WHERE c.id = ANY($1::int[]) AND c.is_active = true
      ORDER BY c.order_index, c.title
    `,
      [chapterIds],
    );
    const subjectIds = [
      ...new Set(chapters.rows.map((c) => c.study_material_id).filter(Boolean)),
    ];

    const subjects = await pool.query(
      `
      SELECT s.id, s.name AS title, s.slug, s.color
      FROM subjects s WHERE s.id = ANY($1::int[]) AND s.is_active = true
      ORDER BY s.sort_order, s.name
    `,
      [subjectIds],
    );

    // Build nested tree
    const chaptersBySubject = {};
    for (const c of chapters.rows) {
      const key = c.study_material_id;
      if (!chaptersBySubject[key]) chaptersBySubject[key] = [];
      chaptersBySubject[key].push(c);
    }
    const topicsByChapter = {};
    for (const t of topics.rows) {
      const key = t.chapter_id;
      if (!topicsByChapter[key]) topicsByChapter[key] = [];
      topicsByChapter[key].push(t);
    }

    const tree = subjects.rows
      .map((s) => ({
        id: s.id,
        name: s.title,
        slug: s.slug,
        color: s.color,
        chapters: (chaptersBySubject[s.id] || [])
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

    res.json({ success: true, data: { subjects: tree } });
  } catch (err) {
    console.error("GET /api/practice/tree error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * GET /api/practice/subjects
 * Returns all active subjects from database with chapters and question counts
 */
router.get("/subjects", protect, async (req, res) => {
  try {
    const subjectsRes = await pool.query(`
      SELECT s.id, s.name AS title, s.slug, s.color, s.icon,
             (
               SELECT COUNT(*)::int FROM questions q
               WHERE q.subject_id = s.id
                 AND q.is_active = true
             ) AS question_count
      FROM subjects s
      WHERE s.is_active = true AND (s.is_deleted IS NOT TRUE)
      ORDER BY s.sort_order, s.name
    `);

    // Fetch chapters per subject from DB
    const chaptersRes = await pool.query(`
      SELECT c.id, c.title, c.slug, COALESCE(c.subject_id, c.study_material_id) AS subject_id,
             (
               SELECT COUNT(*)::int FROM questions q
               WHERE (q.chapter_id = c.id OR q.topic_id IN (SELECT id FROM subject_topics WHERE chapter_id = c.id))
                 AND (q.is_deleted = false OR q.is_deleted IS NULL)
                 AND (q.is_active = true OR q.is_active IS NULL)
             ) AS question_count
      FROM subject_chapters c
      WHERE c.is_active = true
      ORDER BY c.order_index, c.title
    `);

    const chaptersBySubject = {};
    for (const c of chaptersRes.rows) {
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

    const subjects = subjectsRes.rows.map((s) => ({
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

    // 1. Verify chapter exists
    const chapterRes = await pool.query(
      `
      SELECT c.id, c.title, c.slug, COALESCE(c.subject_id, c.study_material_id) AS subject_id
      FROM subject_chapters c
      WHERE c.id = $1 AND c.is_active = true AND (c.is_deleted IS NOT TRUE)
    `,
      [chapterId],
    );

    if (!chapterRes.rows.length) {
      return res
        .status(404)
        .json({ success: false, error: "Chapter not found" });
    }
    const chapter = chapterRes.rows[0];

    // 2. Get all topics for this chapter
    const topicsRes = await pool.query(
      `
      SELECT t.id, t.name, t.slug, t.description, t.order_index,
             COUNT(q.id)::int AS question_count,
             SUM(CASE WHEN LOWER(q.difficulty)='easy' THEN 1 ELSE 0 END)::int AS easy_count,
             SUM(CASE WHEN LOWER(q.difficulty)='medium' THEN 1 ELSE 0 END)::int AS medium_count,
             SUM(CASE WHEN LOWER(q.difficulty)='hard' THEN 1 ELSE 0 END)::int AS hard_count
      FROM subject_topics t
      LEFT JOIN questions q ON q.topic_id = t.id AND q.is_active = true
      WHERE t.chapter_id = $1 AND t.is_active = true AND (t.is_deleted IS NOT TRUE)
      GROUP BY t.id, t.name, t.slug, t.description, t.order_index
      ORDER BY t.order_index NULLS LAST, t.name
    `,
      [chapterId],
    );

    // 3. For each topic, get user's mastery (last attempt accuracy)
    const topicIds = topicsRes.rows.map((t) => t.id);
    let masteryMap = {};
    if (topicIds.length > 0) {
      const masteryRes = await pool.query(
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
      );
      for (const r of masteryRes.rows) {
        masteryMap[r.topic_id] = { accuracy: r.accuracy, attempts: r.attempts };
      }
    }

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
        description: "25 questions · All levels",
        count: 25,
        difficulty: "mixed",
        icon: "🎯",
      },
    ];

    const topics = topicsRes.rows.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description,
      questionCount: t.question_count || 0,
      easyCount: t.easy_count || 0,
      mediumCount: t.medium_count || 0,
      hardCount: t.hard_count || 0,
      accuracy: masteryMap[t.id]?.accuracy ?? null,
      attempts: masteryMap[t.id]?.attempts ?? 0,
      practiceSets: PRACTICE_SETS.filter((ps) => {
        if (ps.difficulty === "easy") return (t.easy_count || 0) > 0;
        if (ps.difficulty === "medium") return (t.medium_count || 0) > 0;
        if (ps.difficulty === "hard") return (t.hard_count || 0) > 0;
        return (t.question_count || 0) > 0;
      }),
    }));

    res.json({
      success: true,
      data: {
        chapter: { id: chapter.id, title: chapter.title, slug: chapter.slug },
        topics,
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

    const total = await countPracticeQuestions(`q.topic_id = $1`, [topicId]);
    const diffSplit = await pool.query(
      `
      SELECT
        SUM(CASE WHEN LOWER(q.difficulty)='easy' THEN 1 ELSE 0 END)::int AS easy,
        SUM(CASE WHEN LOWER(q.difficulty)='medium' THEN 1 ELSE 0 END)::int AS medium,
        SUM(CASE WHEN LOWER(q.difficulty)='hard' THEN 1 ELSE 0 END)::int AS hard
      FROM questions q WHERE ${PRACTICE_Q_WHERE} AND q.topic_id = $1
    `,
      [topicId],
    );

    const mastery = await computeTopicMastery(userId, topicId);

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
      mode = "learn",
      difficulty = "mixed",
      targetCount = 20,
      timeLimitSec,
      testId,
    } = req.body;

    // Cap targetCount
    const count = Math.min(Math.max(parseInt(targetCount, 10) || 20, 1), 200);

    const questionIds = await pickPracticeQuestionIds({
      subjectId,
      chapterId,
      topicId,
      difficulty,
      mode,
      count,
      userId,
      testId,
    });

    if (!questionIds.length) {
      return res.status(400).json({
        success: false,
        error:
          "No practice questions match these filters. Try a different topic, difficulty, or mode.",
      });
    }

    // Create session
    const ins = await pool.query(
      `
      INSERT INTO practice_sessions
        (user_id, exam_id, subject_id, chapter_id, topic_id, mode, difficulty, target_count, time_limit_sec, questions_json, current_index)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)
      RETURNING id
    `,
      [
        userId,
        examId || null,
        subjectId || null,
        chapterId || null,
        topicId || null,
        mode,
        difficulty,
        count,
        timeLimitSec || null,
        JSON.stringify(questionIds),
      ],
    );

    const sessionId = ins.rows[0].id;

    // For Phase 1: return full question objects (safe) so the frontend has everything in one round-trip
    const questions = [];
    for (const qid of questionIds) {
      const q = await getSafeQuestion(qid);
      if (q) questions.push(q);
    }

    res.json({
      success: true,
      data: { sessionId, questions, total: questions.length },
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

    // Hydrate questions
    const ids = session.questionsJson || [];
    const questions = [];
    for (const qid of ids) {
      const q = await getSafeQuestion(qid);
      if (q) questions.push(q);
    }
    session.questions = questions;
    delete session.questionsJson;

    res.json({ success: true, data: session });
  } catch (err) {
    console.error("GET /api/practice/sessions/active error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * GET /api/practice/sessions/:id
 */
router.get("/sessions/:id", protect, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, user_id, exam_id, subject_id, chapter_id, topic_id, mode, difficulty, target_count, time_limit_sec, questions_json, current_index, correct_count, wrong_count, skipped_count, started_at, last_active_at, completed_at, is_active, is_deleted, deleted_at, deleted_by FROM practice_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!r.rows.length)
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    const session = dbHelpers.toCamel(r.rows[0]);
    const ids = session.questionsJson || [];
    const questions = [];
    for (const qid of ids) {
      const q = await getSafeQuestion(qid);
      if (q) questions.push(q);
    }
    session.questions = questions;
    delete session.questionsJson;
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
    const { currentIndex } = req.body;
    await pool.query(
      `
      UPDATE practice_sessions SET
        current_index = COALESCE($2, current_index),
        last_active_at = NOW()
      WHERE id = $1 AND user_id = $3
    `,
      [req.params.id, currentIndex, req.user.id],
    );
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

    // Authoritative counters — derived from logged answers, never from the client
    const counts = await pool.query(
      `
      SELECT
        COUNT(*) FILTER (WHERE is_correct)::int AS correct_count,
        COUNT(*) FILTER (WHERE NOT is_correct AND NOT is_skipped)::int AS wrong_count,
        COUNT(*) FILTER (WHERE is_skipped)::int AS skipped_count
      FROM practice_answers WHERE user_id = $1 AND session_id = $2
    `,
      [userId, req.params.id],
    );
    const { correctCount, wrongCount, skippedCount } = counts.rows[0];

    const r = await pool.query(
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
      [req.params.id, correctCount, wrongCount, skippedCount, userId],
    );
    if (!r.rows.length)
      return res
        .status(404)
        .json({
          success: false,
          error: "Session not found or already completed",
        });
    const session = dbHelpers.toCamel(r.rows[0]);

    // Update streak
    const streak = await bumpStreak(userId);

    // Update totals on streak row
    await pool.query(
      `
      UPDATE practice_streaks SET
        total_questions = total_questions + $2,
        total_correct = total_correct + $3
      WHERE user_id = $1
    `,
      [userId, correctCount + wrongCount + skippedCount, correctCount],
    );

    // Bridge practice results into the analytics pipeline (streaks, weak-area
    // detection, recommendations, spaced-repetition queue). See analyticsService.recordPracticeAnalytics.
    if (session.topicId) {
      await recordPracticeAnalytics(userId, session.id, {
        topic: session.topicId,
        subject: session.subjectId,
      });
    }

    // Recompute mastery if topic was set
    let mastery = null;
    if (session.topicId) {
      mastery = await computeTopicMastery(userId, session.topicId);
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
    const sess = await pool.query(
      `SELECT questions_json FROM practice_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );
    if (!sess.rows.length)
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    const ids = sess.rows[0].questions_json;
    const idx = parseInt(req.params.idx, 10);
    if (idx < 0 || idx >= ids.length)
      return res
        .status(400)
        .json({ success: false, error: "Index out of range" });
    const q = await getSafeQuestion(ids[idx]);
    if (!q)
      return res
        .status(404)
        .json({ success: false, error: "Question missing" });
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
    const sess = await pool.query(
      `SELECT questions_json, mode FROM practice_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId],
    );
    if (!sess.rows.length)
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    const ids = sess.rows[0].questions_json;
    const mode = sess.rows[0].mode;
    const idx = parseInt(req.params.idx, 10);
    if (idx < 0 || idx >= ids.length)
      return res
        .status(400)
        .json({ success: false, error: "Index out of range" });
    const questionId = ids[idx];
    const selectedOption = req.body.selectedOption;

    if (selectedOption === null || selectedOption === undefined) {
      return res
        .status(400)
        .json({ success: false, error: "No option selected" });
    }

    const correctOption = await getCorrectOption(questionId);
    const isCorrect = selectedOption === correctOption;

    // Get explanation for the response
    const qInfo = await pool.query(
      `SELECT explanation FROM questions WHERE id = $1`,
      [questionId],
    );
    const explanation = qInfo.rows[0]?.explanation || "";

    // Prior state — used to adjust counters by delta (never double-count re-answers)
    const prev = await pool.query(
      `SELECT is_correct, is_skipped FROM practice_answers
       WHERE user_id = $1 AND question_id = $2 AND session_id = $3`,
      [userId, questionId, req.params.id],
    );

    // Log to practice_answers (upsert per session+question)
    await pool.query(
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
        req.params.id,
        questionId,
        selectedOption,
        isCorrect,
        req.body.timeTakenSec || null,
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
    await pool.query(
      `
      UPDATE practice_sessions SET
        correct_count = GREATEST(0, correct_count + $2),
        wrong_count = GREATEST(0, wrong_count + $3),
        skipped_count = GREATEST(0, skipped_count + $4),
        current_index = GREATEST(current_index, $5 + 1),
        last_active_at = NOW()
      WHERE id = $1
    `,
      [req.params.id, correctDelta, wrongDelta, skippedDelta, idx],
    );

    // If answered correctly during practice/mistake drill, update mastery in wrong_questions and revision_queue
    if (isCorrect) {
      try {
        await pool.query(
          `UPDATE wrong_questions
           SET wrong_count = GREATEST(0, wrong_count - 1),
               is_active = (wrong_count - 1 > 0),
               updated_at = NOW()
           WHERE user_id = $1 AND question_id = $2`,
          [userId, questionId],
        );
        await pool.query(
          `UPDATE revision_queue
           SET status = 'completed', completed_at = NOW(), updated_at = NOW()
           WHERE user_id = $1 AND question_id = $2 AND status = 'pending'`,
          [userId, questionId],
        );
      } catch (err) {
        console.warn("[Practice Mastery Update]", err.message);
      }
    }

    res.json({
      success: true,
      data: { isCorrect, correctOption, explanation },
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
    const sess = await pool.query(
      `SELECT questions_json, mode FROM practice_sessions WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId],
    );
    if (!sess.rows.length)
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    const ids = sess.rows[0].questions_json;
    const mode = sess.rows[0].mode;
    const idx = parseInt(req.params.idx, 10);
    if (idx < 0 || idx >= ids.length)
      return res
        .status(400)
        .json({ success: false, error: "Index out of range" });
    const questionId = ids[idx];

    const prev = await pool.query(
      `SELECT is_correct, is_skipped FROM practice_answers
       WHERE user_id = $1 AND question_id = $2 AND session_id = $3`,
      [userId, questionId, req.params.id],
    );

    await pool.query(
      `
      INSERT INTO practice_answers (user_id, session_id, question_id, selected_option, is_correct, is_skipped, mode)
      VALUES ($1, $2, $3, NULL, false, true, $4)
      ON CONFLICT (user_id, question_id, session_id) DO UPDATE
        SET is_skipped = true, selected_option = NULL, is_correct = false
    `,
      [userId, req.params.id, questionId, mode],
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
    await pool.query(
      `
      UPDATE practice_sessions SET
        correct_count = GREATEST(0, correct_count + $2),
        wrong_count = GREATEST(0, wrong_count + $3),
        skipped_count = GREATEST(0, skipped_count + $4),
        current_index = GREATEST(current_index, $5 + 1),
        last_active_at = NOW()
      WHERE id = $1
    `,
      [req.params.id, correctDelta, wrongDelta, skippedDelta, idx],
    );

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
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
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
    res.json({
      success: true,
      data: safe,
      total: total.rows[0].c,
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
    await pool.query(
      `
      INSERT INTO question_bookmarks (user_id, question_id) VALUES ($1, $2)
      ON CONFLICT (user_id, question_id) DO NOTHING
    `,
      [req.user.id, req.params.questionId],
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
    await pool.query(
      `DELETE FROM question_bookmarks WHERE user_id = $1 AND question_id = $2`,
      [req.user.id, req.params.questionId],
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
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
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
router.get("/mistakes/count", protect, async (req, res) => {
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
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

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
    const questionId = req.params.id;
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
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
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
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
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
      data: result.rows.map((r) => dbHelpers.toCamel(r)),
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
    const reportId = req.params.id;

    const result = await pool.query(
      `
      UPDATE question_reports
      SET status = $1, notes = COALESCE($2, notes)
      WHERE id = $3
      RETURNING *
    `,
      [status || "resolved", notes || null, reportId],
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
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
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
      data: result.rows.map((r) => dbHelpers.toCamel(r)),
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
    const result = await pool.query(
      `SELECT id, question_text, options, explanation, subject, topic, difficulty, language
       FROM questions WHERE id = $1 AND is_practice = true AND is_active = true`,
      [req.params.id],
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
 * POST /api/practice/fundamentals/submit
 * Body: { category, score, totalQuestions, durationMs }
 */
router.get("/fundamentals/drill", protect, async (req, res) => {
  try {
    const { category = "tables", count = 10 } = req.query;
    const questions = [];

    for (let i = 0; i < parseInt(count, 10); i++) {
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

router.post("/fundamentals/submit", protect, async (req, res) => {
  try {
    const { category, score, totalQuestions, durationMs } = req.body;
    const accuracy = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
    const avgSpeedMs =
      totalQuestions > 0 ? Math.round(durationMs / totalQuestions) : 0;

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
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * GET /api/practice/questions/:id/explanations
 * Returns structured multi-tab explanation (Text, Visual, Video, Formula).
 */
router.get("/questions/:id/explanations", protect, async (req, res) => {
  try {
    const { id } = req.params;
    const qR = await pool.query(
      `SELECT id, question_text, explanation, options, correct_option FROM questions WHERE id = $1`,
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
    const { id } = req.params;
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
    const { id } = req.params;
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
      const { approachId } = req.params;
      const r = await pool.query(
        `
      UPDATE question_approaches SET upvotes = upvotes + 1 WHERE id = $1 RETURNING upvotes
    `,
        [approachId],
      );
      res.json({ success: true, upvotes: r.rows[0]?.upvotes || 0 });
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
    const { id } = req.params;
    const qR = await pool.query(
      `SELECT subject_id, topic_id, difficulty FROM questions WHERE id = $1`,
      [id],
    );
    const q = qR.rows[0] || {};

    const simR = await pool.query(
      `
      SELECT id, question_text, difficulty, options
      FROM questions
      WHERE (topic_id = $1 OR subject_id = $2) AND id != $3 AND is_practice = true AND is_active = true
      ORDER BY RANDOM()
      LIMIT 5
    `,
      [q.topic_id || 0, q.subject_id || 0, id],
    );

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
      questionId,
      saveReason = "needs_revision",
      collectionName = "Default",
      userNotes,
    } = req.body;

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
    const r = await pool.query(
      `
      SELECT kv.id, kv.save_reason, kv.collection_name, kv.user_notes, kv.created_at,
             q.id AS question_id, q.question_text, q.subject, q.topic, q.difficulty
      FROM knowledge_vault_items kv
      JOIN questions q ON q.id = kv.question_id
      WHERE kv.user_id = $1
      ORDER BY kv.created_at DESC
    `,
      [req.user.id],
    );

    res.json({
      success: true,
      data: r.rows.map((row) => dbHelpers.toCamel(row)),
    });
  } catch (err) {
    console.error("GET /vault/items error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

/**
 * POST /api/practice/ai/tutor
 */
router.post("/ai/tutor", protect, async (req, res) => {
  try {
    const { questionId, promptType = "hint", userAnswer } = req.body;

    const qR = await pool.query(
      `SELECT question_text, explanation, options FROM questions WHERE id = $1`,
      [questionId],
    );
    const q = qR.rows[0];

    let responseText = "";
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

    res.json({ success: true, data: { promptType, response: responseText } });
  } catch (err) {
    console.error("POST /ai/tutor error:", err);
    res.status(500).json({ success: false, error: sanitizeErrorMessage(err) });
  }
});

export default router;
