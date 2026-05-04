import { dbHelpers, pool } from '../../infrastructure/database/postgres-helpers.js'
import { addDays, idsMatch, safeNumber, nullIfEmpty } from './common.js'

const REVISION_SCHEDULE_DAYS = [1, 3, 7, 14]

const normalizeOption = (value) => {
  const cleanValue = nullIfEmpty(value)
  if (cleanValue === null) return null
  if (typeof cleanValue === 'number' && Number.isFinite(cleanValue)) return cleanValue
  if (typeof cleanValue === 'string' && /^-?[0-9]+$/.test(cleanValue.trim())) return Number(cleanValue)
  return cleanValue
}

const getCorrectOption = (question) =>
  normalizeOption(
    question?.correctAnswer ??
      question?.correctOption ??
      question?.correct_option ??
      question?.correct
  )

const getQuestionTopic = (question) =>
  question?.topic || question?.section || question?.subject || 'General'

const getQuestionSubject = (question) => question?.subject || question?.section || 'General'

const getQuestionId = (question) => question?.id || question?._id

const getQuestionMapForTest = async (testId) => {
  const result = await pool.query(
    `SELECT * FROM questions WHERE is_active = true AND (test_id = $1 OR "testId" = $1 OR test_id = $2 OR "testId" = $2)`,
    [Number(testId) || -1, String(testId)]
  )
  const filtered = result.rows.map(row => dbHelpers.toCamel(row))
  const questionMap = new Map()
  filtered.forEach((question) => {
    const id = getQuestionId(question)
    if (id !== undefined && id !== null) {
      questionMap.set(String(id), question)
    }
  })
  return questionMap
}

const evaluateAttemptAnswers = (attempt, questionMap) => {
  const answers = Array.isArray(attempt?.answers) ? attempt.answers : []
  const evaluated = []

  answers.forEach((entry) => {
    const questionId = entry?.questionId
    const question =
      questionMap.get(String(questionId)) ||
      Array.from(questionMap.values()).find((candidate, index) =>
        entry?.questionIndex !== undefined
          ? Number(entry.questionIndex) === index
          : idsMatch(getQuestionId(candidate), questionId)
      )

    if (!question) return

    const selectedOption = normalizeOption(entry?.selectedOption)
    const correctOption = getCorrectOption(question)
    const attempted = selectedOption !== null
    const isCorrect = attempted && selectedOption === correctOption

    evaluated.push({
      questionId: getQuestionId(question),
      testId: attempt?.testId || attempt?.test_id,
      topic: getQuestionTopic(question),
      subject: getQuestionSubject(question),
      attempted,
      isCorrect,
      isWrong: attempted && !isCorrect,
    })
  })

  return evaluated
}

const aggregateByTopic = (evaluatedRows) => {
  const map = new Map()
  evaluatedRows.forEach((row) => {
    const key = `${row.topic}::${row.subject}`
    const existing = map.get(key) || {
      topic: row.topic,
      subject: row.subject,
      attempts: 0,
      correct: 0,
      wrong: 0,
      unattempted: 0,
    }

    if (row.attempted) existing.attempts += 1
    if (row.isCorrect) existing.correct += 1
    if (row.isWrong) existing.wrong += 1
    if (!row.attempted) existing.unattempted += 1

    map.set(key, existing)
  })
  return Array.from(map.values())
}

const upsertUserTopicStats = async (userId, topicRows, submittedAt) => {
  for (const row of topicRows) {
    const totalAttempts = row.attempts + row.unattempted
    const accuracy = totalAttempts > 0 ? (row.correct / totalAttempts) * 100 : 0

    await pool.query(
      `
      INSERT INTO user_topic_stats
        (user_id, topic, subject, total_attempts, correct_answers, wrong_answers, unattempted_answers, total_time_spent_seconds, accuracy, last_attempted_at, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, NOW(), NOW())
      ON CONFLICT (user_id, topic)
      DO UPDATE SET
        subject = EXCLUDED.subject,
        total_attempts = user_topic_stats.total_attempts + EXCLUDED.total_attempts,
        correct_answers = user_topic_stats.correct_answers + EXCLUDED.correct_answers,
        wrong_answers = user_topic_stats.wrong_answers + EXCLUDED.wrong_answers,
        unattempted_answers = user_topic_stats.unattempted_answers + EXCLUDED.unattempted_answers,
        accuracy = ROUND(((user_topic_stats.correct_answers + EXCLUDED.correct_answers)::numeric /
          NULLIF((user_topic_stats.total_attempts + EXCLUDED.total_attempts), 0)::numeric) * 100, 2),
        last_attempted_at = EXCLUDED.last_attempted_at,
        updated_at = NOW()
      `,
      [userId, row.topic, row.subject, totalAttempts, row.correct, row.wrong, row.unattempted, accuracy, submittedAt]
    )
  }
}

const upsertTopicAnalytics = async (topicRows, submittedAt) => {
  const dateBucket = new Date(submittedAt || Date.now())
  dateBucket.setHours(0, 0, 0, 0)

  for (const row of topicRows) {
    const totalAttempts = row.attempts + row.unattempted
    const accuracy = totalAttempts > 0 ? (row.correct / totalAttempts) * 100 : 0

    await pool.query(
      `
      INSERT INTO topic_analytics
        (date_bucket, topic, subject, attempt_count, correct_count, wrong_count, unattempted_count, avg_accuracy, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (date_bucket, topic)
      DO UPDATE SET
        subject = EXCLUDED.subject,
        attempt_count = topic_analytics.attempt_count + EXCLUDED.attempt_count,
        correct_count = topic_analytics.correct_count + EXCLUDED.correct_count,
        wrong_count = topic_analytics.wrong_count + EXCLUDED.wrong_count,
        unattempted_count = topic_analytics.unattempted_count + EXCLUDED.unattempted_count,
        avg_accuracy = ROUND(((topic_analytics.correct_count + EXCLUDED.correct_count)::numeric /
          NULLIF((topic_analytics.attempt_count + topic_analytics.unattempted_count + EXCLUDED.attempt_count + EXCLUDED.unattempted_count), 0)::numeric) * 100, 2),
        updated_at = NOW()
      `,
      [dateBucket.toISOString().slice(0, 10), row.topic, row.subject, row.attempts, row.correct, row.wrong, row.unattempted, accuracy]
    )
  }
}

const upsertWrongQuestions = async (attempt, evaluatedRows, submittedAt) => {
  const wrongRows = evaluatedRows.filter((row) => row.isWrong)
  for (const row of wrongRows) {
    await pool.query(
      `
      INSERT INTO wrong_questions
        (user_id, test_id, question_id, source_attempt_id, wrong_count, last_seen_at, metadata, is_active, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, 1, $5, '{}'::jsonb, true, NOW(), NOW())
      ON CONFLICT (user_id, question_id)
      DO UPDATE SET
        test_id = EXCLUDED.test_id,
        source_attempt_id = EXCLUDED.source_attempt_id,
        wrong_count = wrong_questions.wrong_count + 1,
        last_seen_at = EXCLUDED.last_seen_at,
        is_active = true,
        updated_at = NOW()
      `,
      [
        attempt.userId,
        attempt.testId,
        row.questionId,
        attempt.id || attempt._id,
        submittedAt,
      ]
    )
  }
}

const enqueueRevisionRows = async (attempt, evaluatedRows, submittedAt) => {
  const wrongRows = evaluatedRows.filter((row) => row.isWrong)
  for (const row of wrongRows) {
    for (const day of REVISION_SCHEDULE_DAYS) {
      const dueAt = addDays(new Date(submittedAt || Date.now()), day)
      await pool.query(
        `
        INSERT INTO revision_queue
          (user_id, question_id, source_attempt_id, schedule_day, due_at, status, priority, metadata, created_at, updated_at)
        VALUES
          ($1, $2, $3, $4, $5, 'pending', $6, '{}'::jsonb, NOW(), NOW())
        ON CONFLICT (user_id, question_id, source_attempt_id, schedule_day)
        DO UPDATE SET
          due_at = EXCLUDED.due_at,
          status = 'pending',
          priority = EXCLUDED.priority,
          updated_at = NOW()
        `,
        [
          attempt.userId,
          row.questionId,
          attempt.id || attempt._id,
          day,
          dueAt.toISOString(),
          day <= 3 ? 2 : 1,
        ]
      )
    }
  }
}

const updateStudyStreak = async (userId, date = new Date()) => {
  const today = new Date(date)
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  const existing = await pool.query('SELECT * FROM study_streaks WHERE user_id = $1 LIMIT 1', [userId])
  const streak = existing.rows[0]

  if (!streak) {
    await pool.query(
      `
      INSERT INTO study_streaks (user_id, current_streak, best_streak, total_active_days, last_active_date, updated_at, created_at)
      VALUES ($1, 1, 1, 1, $2, NOW(), NOW())
      `,
      [userId, todayStr]
    )
    return { currentStreak: 1, bestStreak: 1, totalActiveDays: 1 }
  }

  const lastActive = streak.last_active_date ? new Date(streak.last_active_date) : null
  let currentStreak = safeNumber(streak.current_streak)
  let bestStreak = safeNumber(streak.best_streak)
  let totalActiveDays = safeNumber(streak.total_active_days)

  if (!lastActive) {
    currentStreak = 1
    totalActiveDays += 1
  } else {
    lastActive.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) {
      return {
        currentStreak: safeNumber(streak.current_streak),
        bestStreak: safeNumber(streak.best_streak),
        totalActiveDays: safeNumber(streak.total_active_days),
      }
    }
    if (diffDays === 1) {
      currentStreak += 1
    } else {
      currentStreak = 1
    }
    totalActiveDays += 1
  }

  bestStreak = Math.max(bestStreak, currentStreak)

  await pool.query(
    `
    UPDATE study_streaks
    SET current_streak = $2, best_streak = $3, total_active_days = $4, last_active_date = $5, updated_at = NOW()
    WHERE user_id = $1
    `,
    [userId, currentStreak, bestStreak, totalActiveDays, todayStr]
  )

  return { currentStreak, bestStreak, totalActiveDays }
}

const getCompletedAttempt = async ({ userId, testId, attemptId }) => {
  if (attemptId) {
    const byId = await dbHelpers.findById('attempts', attemptId)
    if (byId) return byId
  }

  const attempts = await dbHelpers.find('attempts', { userId })
  const completed = attempts
    .filter((attempt) => {
      const status = String(attempt.status || '').toLowerCase()
      return (
        (testId ? idsMatch(attempt.testId, testId) : true) &&
        (attempt.isCompleted === true || status === 'completed' || status === 'submitted')
      )
    })
    .sort((a, b) => new Date(b.submittedAt || b.updatedAt || b.createdAt || 0) - new Date(a.submittedAt || a.updatedAt || a.createdAt || 0))

  return completed[0] || null
}

export const processTestSubmissionAnalytics = async ({ userId, testId, attemptId }) => {
  const attempt = await getCompletedAttempt({ userId, testId, attemptId })
  if (!attempt) {
    return { processed: false, reason: 'attempt_not_found' }
  }

  const effectiveUserId = attempt.userId
  const effectiveTestId = attempt.testId
  const questionMap = await getQuestionMapForTest(effectiveTestId)
  const evaluated = evaluateAttemptAnswers(attempt, questionMap)
  const topicRows = aggregateByTopic(evaluated)
  const submittedAt = attempt.submittedAt || attempt.updatedAt || new Date().toISOString()

  await upsertUserTopicStats(effectiveUserId, topicRows, submittedAt)
  await upsertTopicAnalytics(topicRows, submittedAt)
  await upsertWrongQuestions(attempt, evaluated, submittedAt)
  await enqueueRevisionRows(attempt, evaluated, submittedAt)
  const streak = await updateStudyStreak(effectiveUserId, submittedAt)

  return {
    processed: true,
    userId: effectiveUserId,
    testId: effectiveTestId,
    topicsProcessed: topicRows.length,
    wrongQuestions: evaluated.filter((row) => row.isWrong).length,
    streak,
  }
}

export const getUserWeakTopics = async (userId, { minAttempts = 3, limit = 5 } = {}) => {
  const result = await pool.query(
    `
    SELECT topic, subject, total_attempts, correct_answers, wrong_answers, unattempted_answers, accuracy, last_attempted_at
    FROM user_topic_stats
    WHERE user_id = $1 AND total_attempts >= $2
    ORDER BY accuracy ASC, total_attempts DESC
    LIMIT $3
    `,
    [userId, minAttempts, limit]
  )

  return result.rows.map((row) => ({
    topic: row.topic,
    subject: row.subject,
    attempts: safeNumber(row.total_attempts),
    correct: safeNumber(row.correct_answers),
    wrong: safeNumber(row.wrong_answers),
    unattempted: safeNumber(row.unattempted_answers),
    accuracy: safeNumber(row.accuracy),
    weaknessScore: Math.max(0, 100 - safeNumber(row.accuracy)),
    lastAttemptedAt: row.last_attempted_at,
  }))
}

export const getUserPerformanceAnalytics = async (userId) => {
  const attempts = await dbHelpers.find('attempts', { userId })
  const completed = attempts
    .filter((attempt) => {
      const status = String(attempt.status || '').toLowerCase()
      return attempt.isCompleted === true || status === 'completed' || status === 'submitted'
    })
    .sort((a, b) => new Date(a.submittedAt || a.createdAt || 0) - new Date(b.submittedAt || b.createdAt || 0))

  const testCount = completed.length
  const totalQuestions = completed.reduce((sum, attempt) => sum + safeNumber(attempt.totalQuestions), 0)
  const totalCorrect = completed.reduce((sum, attempt) => sum + safeNumber(attempt.correct), 0)
  const totalWrong = completed.reduce((sum, attempt) => sum + safeNumber(attempt.wrong), 0)
  const totalAttempted = totalCorrect + totalWrong
  const totalTimeSpent = completed.reduce((sum, attempt) => sum + safeNumber(attempt.timeSpent), 0)
  const averageScore = testCount > 0 ? completed.reduce((sum, attempt) => sum + safeNumber(attempt.score), 0) / testCount : 0
  const overallAccuracy = totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0
  const speedPerQuestion = totalAttempted > 0 ? totalTimeSpent / totalAttempted : 0

  const performanceTrend = completed.map((attempt) => ({
    submittedAt: attempt.submittedAt || attempt.createdAt,
    score: safeNumber(attempt.score),
    accuracy: safeNumber(attempt.accuracy),
    speed: safeNumber(attempt.timeSpent) / Math.max(safeNumber(attempt.totalQuestions, 1), 1),
  }))

  const weakTopics = await getUserWeakTopics(userId, { minAttempts: 2, limit: 10 })

  return {
    summary: {
      testCount,
      averageScore: Number(averageScore.toFixed(2)),
      overallAccuracy: Number(overallAccuracy.toFixed(2)),
      speedPerQuestion: Number(speedPerQuestion.toFixed(2)),
      totalQuestions,
      totalAttempted,
    },
    trends: performanceTrend,
    weakTopics,
  }
}

export const getQuestionAnalytics = async ({ testId = null, subject = null, topic = null, limit = 500 } = {}) => {
  let queryStr = `SELECT * FROM questions WHERE is_active = true`
  const params = []
  if (testId) {
    params.push(String(testId), Number(testId) || -1)
    queryStr += ` AND (test_id = $1 OR "testId" = $1 OR test_id = $2 OR "testId" = $2)`
  }
  const result = await pool.query(queryStr, params)
  const questions = result.rows.map(r => dbHelpers.toCamel(r))
  
  const filteredQuestions = questions.filter((question) => {
    if (subject && String(question.subject || '').toLowerCase() !== String(subject).toLowerCase()) return false
    const derivedTopic = getQuestionTopic(question)
    if (topic && String(derivedTopic).toLowerCase() !== String(topic).toLowerCase()) return false
    return true
  })

  const attemptsResult = await pool.query(
    `SELECT * FROM attempts WHERE is_completed = true OR status ILIKE 'completed' OR status ILIKE 'submitted'`
  )
  const completed = attemptsResult.rows.map(r => dbHelpers.toCamel(r))

  const statsByQuestion = new Map()
  filteredQuestions.forEach((question) => {
    statsByQuestion.set(String(getQuestionId(question)), {
      questionId: getQuestionId(question),
      questionText: question.questionText || question.question_text || question.text || '',
      subject: question.subject || 'General',
      topic: getQuestionTopic(question),
      attemptCount: 0,
      correctCount: 0,
      wrongCount: 0,
    })
  })

  completed.forEach((attempt) => {
    const answers = Array.isArray(attempt.answers) ? attempt.answers : []
    answers.forEach((answer) => {
      const key = String(answer?.questionId)
      const stats = statsByQuestion.get(key)
      if (!stats) return

      const question = filteredQuestions.find((item) => idsMatch(getQuestionId(item), answer?.questionId))
      if (!question) return

      stats.attemptCount += 1
      const selected = normalizeOption(answer?.selectedOption)
      const correct = getCorrectOption(question)
      if (selected !== null && selected === correct) {
        stats.correctCount += 1
      } else if (selected !== null) {
        stats.wrongCount += 1
      }
    })
  })

  return Array.from(statsByQuestion.values())
    .map((item) => {
      const accuracy = item.attemptCount > 0 ? (item.correctCount / item.attemptCount) * 100 : 0
      return {
        ...item,
        accuracy: Number(accuracy.toFixed(2)),
        attemptRate: Number(item.attemptCount.toFixed(2)),
        difficultyScore: Number((100 - accuracy).toFixed(2)),
      }
    })
    .sort((a, b) => b.attemptCount - a.attemptCount)
    .slice(0, limit)
}

export const getStudyStreak = async (userId) => {
  const result = await pool.query(
    'SELECT user_id, current_streak, best_streak, total_active_days, last_active_date FROM study_streaks WHERE user_id = $1 LIMIT 1',
    [userId]
  )
  const row = result.rows[0]
  if (!row) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      totalActiveDays: 0,
      lastActiveDate: null,
    }
  }

  return {
    currentStreak: safeNumber(row.current_streak),
    bestStreak: safeNumber(row.best_streak),
    totalActiveDays: safeNumber(row.total_active_days),
    lastActiveDate: row.last_active_date,
  }
}

export const calculateUserRank = async (userId, userAvgScore) => {
  try {
    const result = await pool.query(`
      WITH UserAverages AS (
        SELECT user_id as uid, AVG(score::numeric) as avg_score
        FROM attempts
        WHERE is_completed = true OR status ILIKE 'completed' OR status ILIKE 'submitted'
        GROUP BY user_id
      ),
      RankedUsers AS (
        SELECT uid, avg_score, RANK() OVER (ORDER BY avg_score DESC) as rank
        FROM UserAverages
      )
      SELECT rank FROM RankedUsers WHERE uid::text = $1
    `, [String(userId)]);
    
    if (result.rows.length > 0) {
      return parseInt(result.rows[0].rank);
    }
    
    const countResult = await pool.query(`SELECT COUNT(DISTINCT user_id) as total FROM attempts`);
    return parseInt(countResult.rows[0].total) + 1;
  } catch (error) {
    console.error('Error calculating rank:', error)
    return 0
  }
}

export const getTopPerformers = async (limit = 10, filter = {}) => {
  try {
    let seriesFilter = '';
    const params = [];
    if (filter.seriesId) {
      seriesFilter = `AND series_id::text = $1`;
      params.push(String(filter.seriesId));
    }
    params.push(limit);
    const limitIndex = params.length;
    
    const result = await pool.query(`
      SELECT user_id as uid, COUNT(*) as tests_attempted, SUM(score::numeric) as total_score
      FROM attempts
      WHERE (is_completed = true OR status ILIKE 'completed' OR status ILIKE 'submitted')
      ${seriesFilter}
      GROUP BY user_id
      ORDER BY tests_attempted DESC, (SUM(score::numeric) / COUNT(*)) DESC
      LIMIT $${limitIndex}
    `, params);

    if (result.rows.length === 0) return [];
    
    const participantIds = result.rows.map(r => r.uid).filter(Boolean);
    const users = await dbHelpers.find('users', { id: { $in: participantIds } });
    const userMap = {};
    users.forEach(u => { userMap[String(u._id || u.id)] = u; });

    return result.rows.map(r => {
      const uid = String(r.uid);
      const user = userMap[uid];
      return {
        id: uid,
        name: user?.name || user?.email?.split('@')[0] || 'Anonymous',
        testsAttempted: parseInt(r.tests_attempted),
        avgScore: parseInt(r.tests_attempted) > 0 ? Math.round(parseFloat(r.total_score) / parseInt(r.tests_attempted)) : 0,
        avatar: user?.name?.charAt(0)?.toUpperCase() || 'A',
      }
    });
  } catch (error) {
    console.error('Error getting top performers:', error)
    return []
  }
}

export const analyticsService = {
  processTestSubmissionAnalytics,
  getUserWeakTopics,
  getUserPerformanceAnalytics,
  getQuestionAnalytics,
  getStudyStreak,
  updateStudyStreak,
  calculateUserRank,
  getTopPerformers,
}

export default analyticsService

