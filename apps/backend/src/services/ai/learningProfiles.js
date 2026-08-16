import { pool } from '../../infrastructure/database/postgres-helpers.js'

const getQuestionId = (ans) => ans?.questionId ?? ans?.question_id ?? null
const getSelectedOption = (ans) => ans?.selectedOption ?? ans?.selected_option ?? null

const extractAnswers = (attempt) => {
  if (Array.isArray(attempt.answers)) return attempt.answers
  try {
    const parsed = typeof attempt.answers === 'string' ? JSON.parse(attempt.answers) : attempt.answers
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

export const generateProfile = async (userId) => {
  const attemptRows = await pool.query(`
    SELECT a.id, a.test_id, a.score, a.total_marks, a.correct, a.wrong, a.unattempted,
           a.accuracy, a.time_spent, a.submitted_at, a.answers
    FROM attempts a
    WHERE a.user_id = $1 AND a.is_completed = true
    ORDER BY a.submitted_at DESC
  `, [userId])

  if (attemptRows.rows.length === 0) return null

  const allAnswers = []
  const testIds = new Set()
  for (const attempt of attemptRows.rows) {
    testIds.add(attempt.test_id)
    const answers = extractAnswers(attempt)
    for (const ans of answers) {
      const qid = getQuestionId(ans)
      if (qid != null) allAnswers.push({ ...ans, attemptId: attempt.id, testId: attempt.test_id })
    }
  }

  const topicAccuracy = new Map()
  const topicCounts = new Map()
  const subjectAccuracy = new Map()
  const subjectCounts = new Map()

  if (allAnswers.length > 0) {
    const qIds = [...new Set(allAnswers.map(a => getQuestionId(a)).filter(Boolean))]
    if (qIds.length > 0) {
      const pl = qIds.map((_, i) => `$${i + 1}`).join(",")
      const qRows = await pool.query(`
        SELECT q.id, q.correct_option, q.difficulty, q.topic_id, q.subject,
               t.name as topic_name, s.name as subject_name
        FROM questions q
        LEFT JOIN subject_topics t ON q.topic_id = t.id
        LEFT JOIN subjects s ON q.subject = s.id
        WHERE q.id IN (${pl})
      `, qIds)

      const qMap = new Map()
      qRows.rows.forEach(q => qMap.set(String(q.id), q))

      for (const ans of allAnswers) {
        const q = qMap.get(String(getQuestionId(ans)))
        if (!q) continue
        const selected = getSelectedOption(ans)
        const correct = Number(q.correct_option)
        const isCorrect = selected != null && Number(selected) === correct

        const topic = q.topic_name || 'General'
        const subject = q.subject_name || q.subject || 'General'

        topicAccuracy.set(topic, (topicAccuracy.get(topic) || 0) + (isCorrect ? 1 : 0))
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1)

        subjectAccuracy.set(subject, (subjectAccuracy.get(subject) || 0) + (isCorrect ? 1 : 0))
        subjectCounts.set(subject, (subjectCounts.get(subject) || 0) + 1)
      }
    }
  }

  const strengths = []
  const weaknesses = []
  for (const [topic, correct] of topicAccuracy) {
    const total = topicCounts.get(topic) || 1
    const acc = Math.round((correct / total) * 100)
    if (acc >= 70) strengths.push({ topic, accuracy: acc, totalQuestions: total })
    else if (acc < 40) weaknesses.push({ topic, accuracy: acc, totalQuestions: total })
  }

  const subjectScores = []
  for (const [subject, correct] of subjectAccuracy) {
    const total = subjectCounts.get(subject) || 1
    subjectScores.push({ subject, accuracy: Math.round((correct / total) * 100), totalQuestions: total })
  }

  const recentAttempts = attemptRows.rows.slice(0, 10)
  const accuracyTrend = recentAttempts.map(a => ({
    attemptId: a.id,
    score: Number(a.score || 0),
    totalMarks: Number(a.total_marks || 0),
    accuracy: Number(a.accuracy || 0),
    submittedAt: a.submitted_at,
  }))

  const totalCorrect = attemptRows.rows.reduce((s, a) => s + Number(a.correct || 0), 0)
  const totalAttempted = attemptRows.rows.reduce((s, a) => s + Number(a.correct || 0) + Number(a.wrong || 0), 0)
  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0

  const learningSpeed = overallAccuracy >= 75 ? 'fast' : overallAccuracy >= 50 ? 'moderate' : 'slow'

  const avgTime = attemptRows.rows.reduce((s, a) => s + Number(a.time_spent || 0), 0) / attemptRows.rows.length || 0
  const preferredSubjects = subjectScores
    .filter(s => s.totalQuestions >= 5)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 3)
    .map(s => s.subject)

  await pool.query(`
    INSERT INTO user_learning_profiles
      (user_id, strengths, weaknesses, attention_pattern, preferred_subjects, learning_speed,
       accuracy_trend, topic_mastery, study_habits, recommendations,
       confidence_score, revision_retention, time_of_day_performance, generated_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      strengths = EXCLUDED.strengths,
      weaknesses = EXCLUDED.weaknesses,
      attention_pattern = EXCLUDED.attention_pattern,
      preferred_subjects = EXCLUDED.preferred_subjects,
      learning_speed = EXCLUDED.learning_speed,
      accuracy_trend = EXCLUDED.accuracy_trend,
      topic_mastery = EXCLUDED.topic_mastery,
      study_habits = EXCLUDED.study_habits,
      recommendations = EXCLUDED.recommendations,
      confidence_score = EXCLUDED.confidence_score,
      revision_retention = EXCLUDED.revision_retention,
      time_of_day_performance = EXCLUDED.time_of_day_performance,
      updated_at = NOW()
  `, [
    userId,
    JSON.stringify(strengths),
    JSON.stringify(weaknesses),
    JSON.stringify({ overallAccuracy, avgTimePerQuestion: Math.round(avgTime / Math.max(1, totalAttempted)), totalAttempts: attemptRows.rows.length }),
    preferredSubjects,
    learningSpeed,
    JSON.stringify(accuracyTrend),
    JSON.stringify(Object.fromEntries([...topicAccuracy.keys()].map(t => [t, { accuracy: Math.round((topicAccuracy.get(t) / Math.max(1, topicCounts.get(t))) * 100), totalQuestions: topicCounts.get(t) }]))),
    JSON.stringify({ avgSessionTime: Math.round(avgTime), preferredTime: 'any' }),
    JSON.stringify([]),
    overallAccuracy,
    JSON.stringify([]),
    JSON.stringify({}),
  ])

  return {
    strengths,
    weaknesses,
    overallAccuracy,
    learningSpeed,
    preferredSubjects,
    subjectScores,
    accuracyTrend,
  }
}

export const getProfile = async (userId) => {
  const result = await pool.query(
    "SELECT user_id, strengths, weaknesses, attention_pattern, preferred_subjects, learning_speed, accuracy_trend, topic_mastery, study_habits, recommendations, confidence_score, revision_retention, time_of_day_performance, generated_at, updated_at FROM user_learning_profiles WHERE user_id = $1",
    [userId]
  )
  return result.rows[0] || null
}
