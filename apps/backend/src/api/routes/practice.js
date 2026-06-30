/**
 * Practice Lab Routes — Phase 1
 * Full spec: docs/PRACTICE_LAB_PRD.md
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
 * Legacy endpoints preserved for backwards compatibility:
 *   GET    /api/practice/questions             (kept — no auth — used by old page until migration)
 *   GET    /api/practice/questions/:id
 */

import express from 'express'
import { pool, dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { protect } from '../../middleware/auth.middleware.js'

const router = express.Router()

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════

const PRACTICE_Q_WHERE = `
  (q.is_practice = true OR q.tags @> ARRAY['practice']::text[] OR q.category = 'Practice')
  AND q.is_active = true
`

/**
 * Get count of practice questions matching a WHERE fragment.
 */
async function countPracticeQuestions(extraWhere = '', params = []) {
  const where = PRACTICE_Q_WHERE + (extraWhere ? ` AND ${extraWhere}` : '')
  const r = await pool.query(`SELECT COUNT(*)::int AS c FROM questions q WHERE ${where}`, params)
  return r.rows[0]?.c || 0
}

/**
 * Pick N random practice question IDs matching filters.
 */
async function pickPracticeQuestionIds({ subjectId, chapterId, topicId, difficulty, mode, count, userId }) {
  const conditions = [PRACTICE_Q_WHERE]
  const params = []
  let idx = 1

  if (topicId) {
    conditions.push(`q.topic_id = $${idx}`)
    params.push(topicId)
    idx++
  }
  if (chapterId) {
    // Questions linked to any topic under this chapter
    conditions.push(`q.topic_id IN (SELECT id FROM topics WHERE chapter_id = $${idx})`)
    params.push(chapterId)
    idx++
  }
  if (subjectId) {
    // Questions whose subject (string) matches subject slug/title, OR whose topic belongs to subject's chapters
    conditions.push(`(
      q.subject_id = $${idx}
      OR q.topic_id IN (
        SELECT t.id FROM topics t
        JOIN chapters c ON t.chapter_id = c.id
        WHERE c.study_material_id = $${idx}
      )
    )`)
    params.push(subjectId)
    idx++
  }
  if (difficulty && difficulty !== 'mixed') {
    conditions.push(`LOWER(q.difficulty) = LOWER($${idx})`)
    params.push(difficulty)
    idx++
  }

  // Mode-specific filters
  if (mode === 'mistakes') {
    conditions.push(`q.id IN (SELECT question_id FROM practice_answers WHERE user_id = $${idx} AND is_correct = false)`)
    params.push(userId)
    idx++
  } else if (mode === 'bookmark') {
    conditions.push(`q.id IN (SELECT question_id FROM question_bookmarks WHERE user_id = $${idx})`)
    params.push(userId)
    idx++
  } else if (mode === 'pyq') {
    conditions.push(`(q.is_pyq = true OR q.tags @> ARRAY['pyq']::text[])`)
  }

  // Adaptive: order by difficulty asc (Easy first), we'll adjust on the fly
  const orderBy = mode === 'adaptive'
    ? `CASE LOWER(COALESCE(q.difficulty,'medium')) WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, RANDOM()`
    : `RANDOM()`

  const sql = `
    SELECT q.id FROM questions q
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${orderBy}
    LIMIT $${idx}
  `
  params.push(count)
  const r = await pool.query(sql, params)
  return r.rows.map(row => row.id)
}

/**
 * Get a question for the user, stripping the correct answer.
 */
async function getSafeQuestion(questionId) {
  const r = await pool.query(`
    SELECT q.id, q.question_text, q.options, q.explanation, q.subject, q.topic,
           q.difficulty, q.language, q.topic_id, q.is_pyq,
           q.subject_id
    FROM questions q
    WHERE q.id = $1 AND q.is_active = true
  `, [questionId])
  if (!r.rows.length) return null
  const row = dbHelpers.toCamel(r.rows[0])
  // Strip answer fields
  const { correctAnswer, correct_option, correctOption, correct, answer, isCorrect, is_correct, ...safe } = row
  return safe
}

/**
 * Get the correct option index for a question (handles multiple field names).
 */
async function getCorrectOption(questionId) {
  const r = await pool.query(`
    SELECT correct_option, correct_option_index, correct_answer, correct
    FROM questions WHERE id = $1
  `, [questionId])
  if (!r.rows.length) return null
  const row = dbHelpers.toCamel(r.rows[0])
  return row.correctOption ?? row.correctOptionIndex ?? row.correctAnswer ?? row.correct
}

/**
 * Recompute mastery % for a user+topic from practice_answers + question_attempts.
 * Written to user_topic_performance (if table exists) or returned directly.
 */
async function computeTopicMastery(userId, topicId) {
  // Pull practice answers for this topic
  const r = await pool.query(`
    SELECT pa.is_correct, q.difficulty
    FROM practice_answers pa
    JOIN questions q ON pa.question_id = q.id
    WHERE pa.user_id = $1 AND q.topic_id = $2
    ORDER BY pa.created_at DESC
  `, [userId, topicId])
  if (!r.rows.length) return { mastery: 0, attempts: 0 }
  let weighted = 0, total = 0
  for (const row of r.rows) {
    const diff = (row.difficulty || 'medium').toLowerCase()
    const weight = diff === 'hard' ? 1.5 : diff === 'medium' ? 1.2 : 1.0
    total++
    if (row.is_correct) weighted += weight
  }
  const mastery = total >= 20
    ? Math.min(100, Math.round((weighted / total) * 100))
    : Math.min(100, Math.round((weighted / total) * 100)) // before 20 attempts, show progress but no "mastered" status
  return { mastery, attempts: total }
}

/**
 * Update streak row after a completed session.
 */
async function bumpStreak(userId) {
  const today = new Date().toISOString().slice(0, 10)
  const r = await pool.query(`SELECT * FROM practice_streaks WHERE user_id = $1`, [userId])
  const existing = r.rows[0]
  if (!existing) {
    await pool.query(`
      INSERT INTO practice_streaks (user_id, current_streak, longest_streak, last_practice_date, total_sessions, total_questions, total_correct)
      VALUES ($1, 1, 1, $2, 1, 0, 0)
    `, [userId, today])
    return { current: 1, longest: 1 }
  }
  let current = existing.current_streak
  if (existing.last_practice_date?.toISOString().slice(0, 10) === today) {
    // already counted today — keep streak, just bump session count
  } else {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    if (existing.last_practice_date?.toISOString().slice(0, 10) === yesterday) {
      current += 1
    } else {
      current = 1
    }
  }
  const longest = Math.max(existing.longest_streak, current)
  await pool.query(`
    UPDATE practice_streaks
    SET current_streak = $2, longest_streak = $3, last_practice_date = $4,
        total_sessions = total_sessions + 1
    WHERE user_id = $1
  `, [userId, current, longest, today])
  return { current, longest }
}

// ═══════════════════════════════════════════════════
// TREE & METADATA
// ═══════════════════════════════════════════════════

/**
 * GET /api/practice/tree
 * Returns a pruned curriculum tree: exam → subject → chapter → topic,
 * only branches that contain at least one practice question.
 */
router.get('/tree', protect, async (req, res) => {
  try {
    const userId = req.user.id

    // Practice question counts per topic_id
    const qCounts = await pool.query(`
      SELECT q.topic_id AS topic_id, COUNT(*)::int AS c,
             SUM(CASE WHEN LOWER(q.difficulty)='easy' THEN 1 ELSE 0 END)::int AS easy,
             SUM(CASE WHEN LOWER(q.difficulty)='medium' THEN 1 ELSE 0 END)::int AS medium,
             SUM(CASE WHEN LOWER(q.difficulty)='hard' THEN 1 ELSE 0 END)::int AS hard
      FROM questions q
      WHERE ${PRACTICE_Q_WHERE} AND q.topic_id IS NOT NULL
      GROUP BY q.topic_id
    `)
    const topicMap = {}
    for (const r of qCounts.rows) {
      topicMap[r.topic_id] = { count: r.c, easy: r.easy, medium: r.medium, hard: r.hard }
    }

    // All topics that have practice questions
    const topicIds = Object.keys(topicMap).map(Number)
    if (!topicIds.length) {
      return res.json({ success: true, data: { exams: [] } })
    }

    // Pull topics → chapters → subjects (via study_material_id) → subjects → exam categories
    const topics = await pool.query(`
      SELECT t.id, t.name, t.slug, t.chapter_id
      FROM topics t WHERE t.id = ANY($1::int[]) AND t.is_active = true
      ORDER BY t.order_index, t.name
    `, [topicIds])
    const chapterIds = [...new Set(topics.rows.map(t => t.chapter_id).filter(Boolean))]

    const chapters = await pool.query(`
      SELECT c.id, c.title, c.slug, c.study_material_id
      FROM chapters c WHERE c.id = ANY($1::int[]) AND c.is_active = true
      ORDER BY c.order_index, c.title
    `, [chapterIds])
    const subjectIds = [...new Set(chapters.rows.map(c => c.study_material_id).filter(Boolean))]

    const subjects = await pool.query(`
      SELECT s.id, s.title, s.slug, s.color
      FROM subjects s WHERE s.id = ANY($1::int[]) AND s.is_active = true
      ORDER BY s.order, s.title
    `, [subjectIds])

    // Build nested tree
    const chaptersBySubject = {}
    for (const c of chapters.rows) {
      const key = c.study_material_id
      if (!chaptersBySubject[key]) chaptersBySubject[key] = []
      chaptersBySubject[key].push(c)
    }
    const topicsByChapter = {}
    for (const t of topics.rows) {
      const key = t.chapter_id
      if (!topicsByChapter[key]) topicsByChapter[key] = []
      topicsByChapter[key].push(t)
    }

    const tree = subjects.rows.map(s => ({
      id: s.id,
      name: s.title,
      slug: s.slug,
      color: s.color,
      chapters: (chaptersBySubject[s.id] || []).map(c => ({
        id: c.id,
        name: c.title,
        slug: c.slug,
        topics: (topicsByChapter[c.id] || []).map(t => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          questionCount: topicMap[t.id]?.count || 0,
          easy: topicMap[t.id]?.easy || 0,
          medium: topicMap[t.id]?.medium || 0,
          hard: topicMap[t.id]?.hard || 0,
        })).filter(t => t.questionCount > 0),
      })).filter(c => c.topics.length > 0),
    })).filter(s => s.chapters.length > 0)

    res.json({ success: true, data: { subjects: tree } })
  } catch (err) {
    console.error('GET /api/practice/tree error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/practice/topics/:topicId/stats
 */
router.get('/topics/:topicId/stats', protect, async (req, res) => {
  try {
    const { topicId } = req.params
    const userId = req.user.id

    const total = await countPracticeQuestions(`q.topic_id = $1`, [topicId])
    const diffSplit = await pool.query(`
      SELECT
        SUM(CASE WHEN LOWER(q.difficulty)='easy' THEN 1 ELSE 0 END)::int AS easy,
        SUM(CASE WHEN LOWER(q.difficulty)='medium' THEN 1 ELSE 0 END)::int AS medium,
        SUM(CASE WHEN LOWER(q.difficulty)='hard' THEN 1 ELSE 0 END)::int AS hard
      FROM questions q WHERE ${PRACTICE_Q_WHERE} AND q.topic_id = $1
    `, [topicId])

    const mastery = await computeTopicMastery(userId, topicId)

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
    })
  } catch (err) {
    console.error('GET /api/practice/topics/:topicId/stats error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ═══════════════════════════════════════════════════
// SESSIONS
// ═══════════════════════════════════════════════════

/**
 * POST /api/practice/sessions
 * Body: { examId?, subjectId?, chapterId?, topicId?, mode, difficulty?, targetCount?, timeLimitSec? }
 * Returns: { sessionId, questions: [...] }  (questions are full safe objects for Phase 1 simplicity)
 */
router.post('/sessions', protect, async (req, res) => {
  try {
    const userId = req.user.id
    const { examId, subjectId, chapterId, topicId, mode = 'learn', difficulty = 'mixed', targetCount = 20, timeLimitSec } = req.body

    // Cap targetCount
    const count = Math.min(Math.max(parseInt(targetCount, 10) || 20, 1), 200)

    const questionIds = await pickPracticeQuestionIds({
      subjectId, chapterId, topicId, difficulty, mode, count, userId,
    })

    if (!questionIds.length) {
      return res.status(400).json({
        success: false,
        error: 'No practice questions match these filters. Try a different topic, difficulty, or mode.',
      })
    }

    // Create session
    const ins = await pool.query(`
      INSERT INTO practice_sessions
        (user_id, exam_id, subject_id, chapter_id, topic_id, mode, difficulty, target_count, time_limit_sec, questions_json, current_index)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)
      RETURNING id
    `, [userId, examId || null, subjectId || null, chapterId || null, topicId || null, mode, difficulty, count, timeLimitSec || null, JSON.stringify(questionIds)])

    const sessionId = ins.rows[0].id

    // For Phase 1: return full question objects (safe) so the frontend has everything in one round-trip
    const questions = []
    for (const qid of questionIds) {
      const q = await getSafeQuestion(qid)
      if (q) questions.push(q)
    }

    res.json({ success: true, data: { sessionId, questions, total: questions.length } })
  } catch (err) {
    console.error('POST /api/practice/sessions error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/practice/sessions/active
 */
router.get('/sessions/active', protect, async (req, res) => {
  try {
    const userId = req.user.id
    const r = await pool.query(`
      SELECT * FROM practice_sessions
      WHERE user_id = $1 AND is_active = true AND completed_at IS NULL
      ORDER BY started_at DESC LIMIT 1
    `, [userId])
    if (!r.rows.length) return res.json({ success: true, data: null })
    const session = dbHelpers.toCamel(r.rows[0])

    // Hydrate questions
    const ids = session.questionsJson || []
    const questions = []
    for (const qid of ids) {
      const q = await getSafeQuestion(qid)
      if (q) questions.push(q)
    }
    session.questions = questions
    delete session.questionsJson

    res.json({ success: true, data: session })
  } catch (err) {
    console.error('GET /api/practice/sessions/active error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/practice/sessions/:id
 */
router.get('/sessions/:id', protect, async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM practice_sessions WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id])
    if (!r.rows.length) return res.status(404).json({ success: false, error: 'Session not found' })
    const session = dbHelpers.toCamel(r.rows[0])
    const ids = session.questionsJson || []
    const questions = []
    for (const qid of ids) {
      const q = await getSafeQuestion(qid)
      if (q) questions.push(q)
    }
    session.questions = questions
    delete session.questionsJson
    res.json({ success: true, data: session })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * PATCH /api/practice/sessions/:id
 * Body: { currentIndex, correctCount?, wrongCount?, skippedCount? }
 */
router.patch('/sessions/:id', protect, async (req, res) => {
  try {
    const { currentIndex, correctCount, wrongCount, skippedCount } = req.body
    await pool.query(`
      UPDATE practice_sessions SET
        current_index = COALESCE($2, current_index),
        correct_count = COALESCE($3, correct_count),
        wrong_count = COALESCE($4, wrong_count),
        skipped_count = COALESCE($5, skipped_count),
        last_active_at = NOW()
      WHERE id = $1 AND user_id = $6
    `, [req.params.id, currentIndex, correctCount, wrongCount, skippedCount, req.user.id])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/practice/sessions/:id/complete
 * Mark complete, update streak, return summary.
 */
router.post('/sessions/:id/complete', protect, async (req, res) => {
  try {
    const userId = req.user.id
    const r = await pool.query(`
      UPDATE practice_sessions
      SET completed_at = NOW(), is_active = false,
          correct_count = COALESCE($2, correct_count),
          wrong_count = COALESCE($3, wrong_count),
          skipped_count = COALESCE($4, skipped_count),
          last_active_at = NOW()
      WHERE id = $1 AND user_id = $5 AND completed_at IS NULL
      RETURNING *
    `, [req.params.id, req.body.correctCount, req.body.wrongCount, req.body.skippedCount, userId])
    if (!r.rows.length) return res.status(404).json({ success: false, error: 'Session not found or already completed' })
    const session = dbHelpers.toCamel(r.rows[0])

    // Update streak
    const streak = await bumpStreak(userId)

    // Update totals on streak row
    await pool.query(`
      UPDATE practice_streaks SET
        total_questions = total_questions + $2,
        total_correct = total_correct + $3
      WHERE user_id = $1
    `, [userId, session.correctCount + session.wrongCount + session.skippedCount, session.correctCount])

    // Recompute mastery if topic was set
    let mastery = null
    if (session.topicId) {
      mastery = await computeTopicMastery(userId, session.topicId)
    }

    res.json({
      success: true,
      data: {
        session,
        streak,
        mastery,
      },
    })
  } catch (err) {
    console.error('POST /api/practice/sessions/:id/complete error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ═══════════════════════════════════════════════════
// QUESTIONS WITHIN A SESSION
// ═══════════════════════════════════════════════════

/**
 * GET /api/practice/sessions/:id/questions/:idx
 * Returns the full question object (without correct answer) at the given index.
 */
router.get('/sessions/:id/questions/:idx', protect, async (req, res) => {
  try {
    const sess = await pool.query(`SELECT questions_json FROM practice_sessions WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id])
    if (!sess.rows.length) return res.status(404).json({ success: false, error: 'Session not found' })
    const ids = sess.rows[0].questions_json
    const idx = parseInt(req.params.idx, 10)
    if (idx < 0 || idx >= ids.length) return res.status(400).json({ success: false, error: 'Index out of range' })
    const q = await getSafeQuestion(ids[idx])
    if (!q) return res.status(404).json({ success: false, error: 'Question missing' })
    res.json({ success: true, data: q })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/practice/sessions/:id/questions/:idx/check
 * Body: { selectedOption }
 * Logs to practice_answers; returns { isCorrect, correctOption, explanation }.
 */
router.post('/sessions/:id/questions/:idx/check', protect, async (req, res) => {
  try {
    const userId = req.user.id
    const sess = await pool.query(`SELECT questions_json, mode FROM practice_sessions WHERE id = $1 AND user_id = $2`, [req.params.id, userId])
    if (!sess.rows.length) return res.status(404).json({ success: false, error: 'Session not found' })
    const ids = sess.rows[0].questions_json
    const mode = sess.rows[0].mode
    const idx = parseInt(req.params.idx, 10)
    if (idx < 0 || idx >= ids.length) return res.status(400).json({ success: false, error: 'Index out of range' })
    const questionId = ids[idx]
    const selectedOption = req.body.selectedOption

    if (selectedOption === null || selectedOption === undefined) {
      return res.status(400).json({ success: false, error: 'No option selected' })
    }

    const correctOption = await getCorrectOption(questionId)
    const isCorrect = selectedOption === correctOption

    // Get explanation for the response
    const qInfo = await pool.query(`SELECT explanation FROM questions WHERE id = $1`, [questionId])
    const explanation = qInfo.rows[0]?.explanation || ''

    // Log to practice_answers (upsert per session+question)
    await pool.query(`
      INSERT INTO practice_answers (user_id, session_id, question_id, selected_option, is_correct, is_skipped, time_taken_sec, mode)
      VALUES ($1, $2, $3, $4, $5, false, $6, $7)
      ON CONFLICT (user_id, question_id, session_id) DO UPDATE
        SET selected_option = EXCLUDED.selected_option,
            is_correct = EXCLUDED.is_correct,
            is_skipped = false
    `, [userId, req.params.id, questionId, selectedOption, isCorrect, req.body.timeTakenSec || null, mode])

    // Update session counters
    if (isCorrect) {
      await pool.query(`UPDATE practice_sessions SET correct_count = correct_count + 1, current_index = GREATEST(current_index, $2 + 1), last_active_at = NOW() WHERE id = $1`, [req.params.id, idx])
    } else {
      await pool.query(`UPDATE practice_sessions SET wrong_count = wrong_count + 1, current_index = GREATEST(current_index, $2 + 1), last_active_at = NOW() WHERE id = $1`, [req.params.id, idx])
    }

    res.json({
      success: true,
      data: { isCorrect, correctOption, explanation },
    })
  } catch (err) {
    console.error('POST /api/practice/sessions/:id/questions/:idx/check error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/practice/sessions/:id/questions/:idx/skip
 */
router.post('/sessions/:id/questions/:idx/skip', protect, async (req, res) => {
  try {
    const userId = req.user.id
    const sess = await pool.query(`SELECT questions_json, mode FROM practice_sessions WHERE id = $1 AND user_id = $2`, [req.params.id, userId])
    if (!sess.rows.length) return res.status(404).json({ success: false, error: 'Session not found' })
    const ids = sess.rows[0].questions_json
    const mode = sess.rows[0].mode
    const idx = parseInt(req.params.idx, 10)
    if (idx < 0 || idx >= ids.length) return res.status(400).json({ success: false, error: 'Index out of range' })
    const questionId = ids[idx]

    await pool.query(`
      INSERT INTO practice_answers (user_id, session_id, question_id, selected_option, is_correct, is_skipped, mode)
      VALUES ($1, $2, $3, NULL, false, true, $4)
      ON CONFLICT (user_id, question_id, session_id) DO UPDATE
        SET is_skipped = true, selected_option = NULL
    `, [userId, req.params.id, questionId, mode])

    await pool.query(`UPDATE practice_sessions SET skipped_count = skipped_count + 1, current_index = GREATEST(current_index, $2 + 1), last_active_at = NOW() WHERE id = $1`, [req.params.id, idx])

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ═══════════════════════════════════════════════════
// BOOKMARKS
// ═══════════════════════════════════════════════════

/**
 * GET /api/practice/bookmarks
 * ?page=1&limit=20
 */
router.get('/bookmarks', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100)
    const offset = (page - 1) * limit

    const r = await pool.query(`
      SELECT q.* FROM question_bookmarks qb
      JOIN questions q ON qb.question_id = q.id
      WHERE qb.user_id = $1 AND q.is_active = true
      ORDER BY qb.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user.id, limit, offset])
    const safe = r.rows.map(row => {
      const q = dbHelpers.toCamel(row)
      const { correctAnswer, correct_option, correctOption, correct, answer, isCorrect, is_correct, ...rest } = q
      return rest
    })
    const total = await pool.query(`SELECT COUNT(*)::int AS c FROM question_bookmarks WHERE user_id = $1`, [req.user.id])
    res.json({ success: true, data: safe, total: total.rows[0].c, page, limit })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/practice/bookmarks/count
 */
router.get('/bookmarks/count', protect, async (req, res) => {
  try {
    const r = await pool.query(`SELECT COUNT(*)::int AS c FROM question_bookmarks WHERE user_id = $1`, [req.user.id])
    res.json({ success: true, data: { count: r.rows[0].c } })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * POST /api/practice/bookmarks/:questionId
 */
router.post('/bookmarks/:questionId', protect, async (req, res) => {
  try {
    await pool.query(`
      INSERT INTO question_bookmarks (user_id, question_id) VALUES ($1, $2)
      ON CONFLICT (user_id, question_id) DO NOTHING
    `, [req.user.id, req.params.questionId])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * DELETE /api/practice/bookmarks/:questionId
 */
router.delete('/bookmarks/:questionId', protect, async (req, res) => {
  try {
    await pool.query(`DELETE FROM question_bookmarks WHERE user_id = $1 AND question_id = $2`, [req.user.id, req.params.questionId])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ═══════════════════════════════════════════════════
// MISTAKES NOTEBOOK
// ═══════════════════════════════════════════════════

/**
 * GET /api/practice/mistakes
 * ?page=1&limit=20&subjectId=&topicId=
 */
router.get('/mistakes', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100)
    const offset = (page - 1) * limit

    // Latest wrong answer per question for this user
    const r = await pool.query(`
      SELECT DISTINCT ON (pa.question_id) pa.question_id, pa.created_at, q.*
      FROM practice_answers pa
      JOIN questions q ON pa.question_id = q.id
      WHERE pa.user_id = $1 AND pa.is_correct = false AND q.is_active = true
      ORDER BY pa.question_id, pa.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user.id, limit, offset])
    const safe = r.rows.map(row => {
      const q = dbHelpers.toCamel(row)
      const { correctAnswer, correct_option, correctOption, correct, answer, isCorrect, is_correct, ...rest } = q
      return rest
    })
    const total = await pool.query(`
      SELECT COUNT(DISTINCT question_id)::int AS c
      FROM practice_answers WHERE user_id = $1 AND is_correct = false
    `, [req.user.id])
    res.json({ success: true, data: safe, total: total.rows[0].c, page, limit })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

/**
 * GET /api/practice/mistakes/count
 */
router.get('/mistakes/count', protect, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT COUNT(DISTINCT question_id)::int AS c
      FROM practice_answers WHERE user_id = $1 AND is_correct = false
    `, [req.user.id])
    res.json({ success: true, data: { count: r.rows[0].c } })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ═══════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════

/**
 * GET /api/practice/dashboard
 * Aggregated payload for the entry screen (one round-trip).
 */
router.get('/dashboard', protect, async (req, res) => {
  try {
    const userId = req.user.id

    // Streak
    const streakR = await pool.query(`SELECT * FROM practice_streaks WHERE user_id = $1`, [userId])
    const streak = streakR.rows[0] ? dbHelpers.toCamel(streakR.rows[0]) : { currentStreak: 0, longestStreak: 0, totalSessions: 0, totalQuestions: 0, totalCorrect: 0 }

    // Today's progress (questions answered today)
    const today = new Date().toISOString().slice(0, 10)
    const todayR = await pool.query(`
      SELECT COUNT(*)::int AS c,
             SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::int AS correct
      FROM practice_answers WHERE user_id = $1 AND created_at::date = $2
    `, [userId, today])
    const todaysGoal = {
      done: todayR.rows[0].c || 0,
      correct: todayR.rows[0].correct || 0,
      target: 50,
    }

    // Active session
    const activeR = await pool.query(`
      SELECT * FROM practice_sessions
      WHERE user_id = $1 AND is_active = true AND completed_at IS NULL
      ORDER BY started_at DESC LIMIT 1
    `, [userId])
    let activeSession = null
    if (activeR.rows.length) {
      activeSession = dbHelpers.toCamel(activeR.rows[0])
      // Don't hydrate all questions for dashboard — just summary
      delete activeSession.questionsJson
    }

    // Counts
    const mistakesR = await pool.query(`SELECT COUNT(DISTINCT question_id)::int AS c FROM practice_answers WHERE user_id = $1 AND is_correct = false`, [userId])
    const bookmarksR = await pool.query(`SELECT COUNT(*)::int AS c FROM question_bookmarks WHERE user_id = $1`, [userId])

    // Mastery per subject (compute from practice_answers grouped by subject)
    const masteryR = await pool.query(`
      SELECT s.id AS subject_id, s.name AS subject_name, s.color,
             COUNT(pa.id)::int AS attempts,
             SUM(CASE WHEN pa.is_correct THEN 1 ELSE 0 END)::int AS correct
      FROM practice_answers pa
      JOIN questions q ON pa.question_id = q.id
      LEFT JOIN subjects s ON q.subject_id = s.id
      WHERE pa.user_id = $1
      GROUP BY s.id, s.name, s.color
      ORDER BY s.name
    `, [userId])
    const mastery = masteryR.rows.map(r => {
      const attempts = r.attempts || 0
      const correct = r.correct || 0
      return {
        subjectId: r.subject_id,
        subjectName: r.subject_name || 'General',
        color: r.color,
        attempts,
        accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
      }
    }).filter(m => m.subjectId)

    // Weak topics (accuracy < 60%, at least 3 attempts)
    const weakR = await pool.query(`
      SELECT t.id AS topic_id, t.name AS topic_name,
             COUNT(pa.id)::int AS attempts,
             SUM(CASE WHEN pa.is_correct THEN 1 ELSE 0 END)::int AS correct
      FROM practice_answers pa
      JOIN questions q ON pa.question_id = q.id
      JOIN topics t ON q.topic_id = t.id
      WHERE pa.user_id = $1
      GROUP BY t.id, t.name
      HAVING COUNT(pa.id) >= 3 AND SUM(CASE WHEN pa.is_correct THEN 1 ELSE 0 END)::float / COUNT(pa.id) < 0.6
      ORDER BY (SUM(CASE WHEN pa.is_correct THEN 1 ELSE 0 END)::float / COUNT(pa.id)) ASC
      LIMIT 5
    `, [userId])
    const weakTopics = weakR.rows.map(r => ({
      topicId: r.topic_id,
      topicName: r.topic_name,
      attempts: r.attempts,
      accuracy: Math.round((r.correct / r.attempts) * 100),
    }))

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
    })
  } catch (err) {
    console.error('GET /api/practice/dashboard error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ═══════════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════════

/**
 * POST /api/practice/questions/:id/report
 * Body: { reason, notes }
 */
router.post('/questions/:id/report', protect, async (req, res) => {
  try {
    await pool.query(`
      INSERT INTO question_reports (user_id, question_id, reason, notes)
      VALUES ($1, $2, $3, $4)
    `, [req.user.id, req.params.id, req.body.reason || 'other', req.body.notes || null])
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// ═══════════════════════════════════════════════════
// LEGACY (kept for backwards compatibility — old page)
// ═══════════════════════════════════════════════════

/**
 * GET /api/practice/questions
 * Legacy: no auth, simple paginated list.
 */
router.get('/questions', async (req, res) => {
  try {
    const { subject, topic, difficulty, page = 1, limit = 20 } = req.query
    const filters = { is_practice: true, subject, topic, difficulty }
    const allowedFields = ['is_practice', 'subject', 'topic', 'difficulty']
    const { executePaginatedQuery } = await import('../../utils/queryBuilder.js')
    const result = await executePaginatedQuery(dbHelpers, 'questions',
      ['id', 'question_text', 'options', 'correct_option', 'explanation', 'subject', 'topic', 'difficulty', 'language'],
      filters, allowedFields, { page, limit })
    res.json({ success: true, data: result.data, pagination: result.pagination })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/questions/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, question_text, options, correct_option, explanation, subject, topic, difficulty, language
       FROM questions WHERE id = $1 AND is_practice = true AND is_active = true`,
      [req.params.id]
    )
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Question not found' })
    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router