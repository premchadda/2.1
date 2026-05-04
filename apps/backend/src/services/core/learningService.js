import { dbHelpers, pool } from '../../infrastructure/database/postgres-helpers.js'
import analyticsService from './analyticsService.js'
import { idsMatch, safeNumber } from './common.js'

const normalizeOption = (value) => {
  if (value === undefined || value === null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && /^-?[0-9]+$/.test(value.trim())) return Number(value)
  return value
}

const getCorrectOption = (question) =>
  normalizeOption(
    question?.correctAnswer ??
      question?.correctOption ??
      question?.correct_option ??
      question?.correct
  )

const buildQuestionMap = async () => {
  const questions = await dbHelpers.find('questions', { isActive: true })
  const map = new Map()
  questions.forEach((question) => {
    const id = question.id || question._id
    if (id !== undefined && id !== null) map.set(String(id), question)
  })
  return map
}

export const getWrongQuestionBank = async (userId, { testId = null, limit = 200 } = {}) => {
  const wrongRows = await dbHelpers.find('wrongQuestions', { userId, isActive: true })
  const filtered = wrongRows
    .filter((row) => (testId ? idsMatch(row.testId || row.test_id, testId) : true))
    .sort((a, b) => new Date(b.lastSeenAt || b.updatedAt || b.createdAt || 0) - new Date(a.lastSeenAt || a.updatedAt || a.createdAt || 0))
    .slice(0, limit)

  const questionMap = await buildQuestionMap()
  return filtered.map((row) => {
    const question = questionMap.get(String(row.questionId || row.question_id))
    return {
      id: row.id || row._id,
      wrongCount: safeNumber(row.wrongCount || row.wrong_count, 1),
      lastSeenAt: row.lastSeenAt || row.last_seen_at,
      question,
    }
  })
}

export const getRevisionQueue = async (userId, { dueOnly = false, limit = 200 } = {}) => {
  const queueRows = await dbHelpers.find('revisionQueue', { userId })
  const now = Date.now()
  const filtered = queueRows
    .filter((row) => {
      const status = String(row.status || 'pending').toLowerCase()
      if (status !== 'pending') return false
      if (!dueOnly) return true
      return new Date(row.dueAt || row.due_at || 0).getTime() <= now
    })
    .sort((a, b) => new Date(a.dueAt || a.due_at || 0) - new Date(b.dueAt || b.due_at || 0))
    .slice(0, limit)

  const questionMap = await buildQuestionMap()
  return filtered.map((row) => ({
    id: row.id || row._id,
    dueAt: row.dueAt || row.due_at,
    scheduleDay: safeNumber(row.scheduleDay || row.schedule_day),
    priority: safeNumber(row.priority),
    sourceAttemptId: row.sourceAttemptId || row.source_attempt_id,
    question: questionMap.get(String(row.questionId || row.question_id)) || null,
  }))
}

export const completeRevisionItem = async (userId, revisionId, { isCorrect = true } = {}) => {
  const revisionRow = await dbHelpers.findById('revisionQueue', revisionId)
  if (!revisionRow) {
    return { success: false, reason: 'not_found' }
  }
  if (!idsMatch(revisionRow.userId || revisionRow.user_id, userId)) {
    return { success: false, reason: 'unauthorized' }
  }

  const completedAt = new Date().toISOString()
  const updated = await dbHelpers.updateById('revisionQueue', revisionId, {
    status: 'completed',
    completedAt,
    updatedAt: completedAt,
  })

  // If still wrong during revision, create a follow-up 3-day reminder.
  if (!isCorrect) {
    const followUpDueAt = new Date()
    followUpDueAt.setDate(followUpDueAt.getDate() + 3)

    await pool.query(
      `
      INSERT INTO revision_queue
        (user_id, question_id, source_attempt_id, schedule_day, due_at, status, priority, metadata, created_at, updated_at)
      VALUES
        ($1, $2, $3, 3, $4, 'pending', 2, '{"source":"follow_up"}'::jsonb, NOW(), NOW())
      ON CONFLICT (user_id, question_id, source_attempt_id, schedule_day)
      DO UPDATE SET
        due_at = EXCLUDED.due_at,
        status = 'pending',
        priority = 2,
        updated_at = NOW()
      `,
      [
        revisionRow.userId || revisionRow.user_id,
        revisionRow.questionId || revisionRow.question_id,
        revisionRow.sourceAttemptId || revisionRow.source_attempt_id,
        followUpDueAt.toISOString(),
      ]
    )
  }

  await analyticsService.updateStudyStreak(userId)

  return { success: true, item: updated }
}

const getOrCreateDailyQuiz = async (date = new Date()) => {
  const dateStr = date.toISOString().slice(0, 10)
  const existing = await pool.query('SELECT * FROM daily_quizzes WHERE quiz_date = $1 LIMIT 1', [dateStr])
  if (existing.rows[0]) {
    return existing.rows[0]
  }

  const allQuestions = await dbHelpers.find('questions', { isActive: true })
  const shuffled = [...allQuestions].sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, 10)

  const inserted = await pool.query(
    `
    INSERT INTO daily_quizzes (quiz_date, title, total_questions, metadata, is_active, created_at)
    VALUES ($1, $2, $3, '{}'::jsonb, true, NOW())
    RETURNING *
    `,
    [dateStr, `Daily Quiz - ${dateStr}`, selected.length]
  )
  const quiz = inserted.rows[0]

  let position = 1
  for (const question of selected) {
    await pool.query(
      `
      INSERT INTO daily_quiz_questions (quiz_id, question_id, position, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (quiz_id, question_id) DO NOTHING
      `,
      [quiz.id, question.id || question._id, position]
    )
    position += 1
  }

  return quiz
}

export const getDailyQuizForUser = async (userId, date = new Date()) => {
  const quiz = await getOrCreateDailyQuiz(date)
  const questionsResult = await pool.query(
    `
    SELECT dq.question_id, dq.position
    FROM daily_quiz_questions dq
    WHERE dq.quiz_id = $1
    ORDER BY dq.position ASC
    `,
    [quiz.id]
  )

  const questionMap = await buildQuestionMap()
  const questions = questionsResult.rows
    .map((row) => questionMap.get(String(row.question_id)))
    .filter(Boolean)
    .map((question) => ({
      id: question.id || question._id,
      questionText: question.questionText || question.question_text || question.text || '',
      options: question.options || [],
      section: question.section || question.subject || 'General',
      subject: question.subject || 'General',
    }))

  const existingAttempt = await pool.query(
    'SELECT id, score, accuracy, submitted_at FROM daily_quiz_attempts WHERE quiz_id = $1 AND user_id = $2 LIMIT 1',
    [quiz.id, userId]
  )

  return {
    quiz: {
      id: quiz.id,
      date: quiz.quiz_date,
      title: quiz.title,
      totalQuestions: safeNumber(quiz.total_questions),
      alreadySubmitted: Boolean(existingAttempt.rows[0]),
      previousResult: existingAttempt.rows[0] || null,
    },
    questions,
  }
}

export const submitDailyQuiz = async (userId, quizId, answers = []) => {
  const quizQuestions = await pool.query(
    'SELECT question_id FROM daily_quiz_questions WHERE quiz_id = $1',
    [quizId]
  )
  const questionIds = quizQuestions.rows.map((row) => row.question_id)
  if (questionIds.length === 0) {
    return { success: false, reason: 'quiz_not_found' }
  }

  const questionMap = await buildQuestionMap()
  let correct = 0
  let attempted = 0

  const normalizedAnswers = Array.isArray(answers) ? answers : []
  normalizedAnswers.forEach((entry) => {
    const question = questionMap.get(String(entry?.questionId))
    if (!question) return
    const selectedOption = normalizeOption(entry?.selectedOption)
    if (selectedOption === null) return
    attempted += 1
    if (selectedOption === getCorrectOption(question)) {
      correct += 1
    }
  })

  const totalQuestions = questionIds.length
  const accuracy = totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0
  const score = correct

  const upsert = await pool.query(
    `
    INSERT INTO daily_quiz_attempts
      (quiz_id, user_id, answers, score, accuracy, submitted_at, created_at, updated_at)
    VALUES
      ($1, $2, $3::jsonb, $4, $5, NOW(), NOW(), NOW())
    ON CONFLICT (quiz_id, user_id)
    DO UPDATE SET
      answers = EXCLUDED.answers,
      score = EXCLUDED.score,
      accuracy = EXCLUDED.accuracy,
      submitted_at = NOW(),
      updated_at = NOW()
    RETURNING *
    `,
    [quizId, userId, JSON.stringify(normalizedAnswers), score, accuracy]
  )

  const streak = await analyticsService.updateStudyStreak(userId)

  return {
    success: true,
    result: {
      ...upsert.rows[0],
      totalQuestions,
      correct,
      attempted,
      streak,
    },
  }
}

export const learningService = {
  getWrongQuestionBank,
  getRevisionQueue,
  completeRevisionItem,
  getDailyQuizForUser,
  submitDailyQuiz,
}

export default learningService

