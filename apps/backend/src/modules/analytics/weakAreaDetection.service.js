/**
 * Weak Area Detection Service
 *
 * Analyzes user performance to identify weak areas:
 * - Topic-wise accuracy analysis
 * - Subject-wise performance
 * - Difficulty-wise performance
 * - Time-based performance trends
 * - Comparative analysis with peers
 */

import { pool } from '../../infrastructure/database/postgres-helpers.js'

const weakAreaDetectionService = {
  /**
   * Get weak topics for a user.
   */
  async getWeakTopics(userId, options = {}) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const limit = options.limit || 10
      const minAttempts = options.minAttempts || 5

      const result = await client.query(`
        SELECT
          t.id as topic_id,
          t.name as topic_name,
          s.name as subject_name,
          uts.total_attempts,
          uts.correct_answers,
          uts.wrong_answers,
          uts.accuracy,
          uts.total_time_spent_seconds,
          CASE
            WHEN uts.total_attempts > 0
            THEN uts.total_time_spent_seconds / uts.total_attempts
            ELSE 0
          END as avg_time_per_question
        FROM user_topic_stats uts
        JOIN topics t ON (t.id = uts.topic_id OR (uts.topic_id IS NULL AND LOWER(t.name) = LOWER(uts.topic)))
        LEFT JOIN subjects s ON s.id = t.subject_id
        WHERE uts.user_id = $1
          AND uts.total_attempts >= $2
        ORDER BY uts.accuracy ASC, uts.total_attempts DESC
        LIMIT $3
      `, [userId, minAttempts, limit])

      return result.rows.map(row => ({
        topicId: row.topic_id,
        topicName: row.topic_name,
        subjectName: row.subject_name,
        totalAttempts: row.total_attempts,
        correctAnswers: row.correct_answers,
        wrongAnswers: row.wrong_answers,
        accuracy: parseFloat(row.accuracy),
        avgTimePerQuestion: Math.round(row.avg_time_per_question),
        strength: this.classifyStrength(row.accuracy),
      }))
    } finally {
      client.release()
    }
  },

  /**
   * Get weak subjects for a user.
   */
  async getWeakSubjects(userId, options = {}) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT
          s.id as subject_id,
          s.name as subject_name,
          COUNT(DISTINCT t.id) as topic_count,
          SUM(uts.total_attempts) as total_attempts,
          SUM(uts.correct_answers) as correct_answers,
          SUM(uts.wrong_answers) as wrong_answers,
          CASE
            WHEN SUM(uts.total_attempts) > 0
            THEN ROUND(SUM(uts.correct_answers)::numeric / SUM(uts.total_attempts) * 100, 2)
            ELSE 0
          END as accuracy
        FROM user_topic_stats uts
        JOIN topics t ON (t.id = uts.topic_id OR (uts.topic_id IS NULL AND LOWER(t.name) = LOWER(uts.topic)))
        JOIN subjects s ON s.id = t.subject_id
        WHERE uts.user_id = $1
        GROUP BY s.id, s.name
        ORDER BY accuracy ASC
      `, [userId])

      return result.rows.map(row => ({
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        topicCount: row.topic_count,
        totalAttempts: parseInt(row.total_attempts),
        correctAnswers: parseInt(row.correct_answers),
        wrongAnswers: parseInt(row.wrong_answers),
        accuracy: parseFloat(row.accuracy),
        strength: this.classifyStrength(row.accuracy),
      }))
    } finally {
      client.release()
    }
  },

  /**
   * Get performance by difficulty level.
   */
  async getPerformanceByDifficulty(userId) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const result = await client.query(`
        SELECT
          q.difficulty,
          COUNT(*) as total_questions,
          SUM(CASE WHEN q.correct_option = qa.selected_option THEN 1 ELSE 0 END) as correct,
          SUM(CASE WHEN q.correct_option != qa.selected_option AND qa.selected_option IS NOT NULL THEN 1 ELSE 0 END) as wrong,
          CASE
            WHEN COUNT(*) > 0
            THEN ROUND(SUM(CASE WHEN q.correct_option = qa.selected_option THEN 1 ELSE 0 END)::numeric / COUNT(*) * 100, 2)
            ELSE 0
          END as accuracy,
          AVG(qa.time_spent_seconds) as avg_time
        FROM question_attempts qa
        JOIN questions q ON q.id = qa.question_id
        JOIN attempts a ON a.id = qa.attempt_id
        WHERE a.user_id = $1
        GROUP BY q.difficulty
        ORDER BY
          CASE q.difficulty
            WHEN 'easy' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'hard' THEN 3
            WHEN 'very_hard' THEN 4
            ELSE 5
          END
      `, [userId])

      return result.rows.map(row => ({
        difficulty: row.difficulty,
        totalQuestions: parseInt(row.total_questions),
        correct: parseInt(row.correct),
        wrong: parseInt(row.wrong),
        accuracy: parseFloat(row.accuracy),
        avgTime: Math.round(row.avg_time || 0),
      }))
    } finally {
      client.release()
    }
  },

  /**
   * Get time-based performance trends.
   */
  async getPerformanceTrends(userId, options = {}) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const days = options.days || 30

      const result = await client.query(`
        SELECT
          DATE(a.completed_at) as date,
          COUNT(*) as tests_attempted,
          AVG(a.score / NULLIF(a.total_marks, 0) * 100) as avg_percentage,
          SUM(a.correct_count) as total_correct,
          SUM(a.wrong_count) as total_wrong,
          AVG(a.time_spent) as avg_time_spent
        FROM attempts a
        WHERE a.user_id = $1
          AND a.is_completed = true
          AND a.completed_at >= NOW() - ($2 * INTERVAL '1 day')
        GROUP BY DATE(a.completed_at)
        ORDER BY date
      `, [userId, days])

      return result.rows.map(row => ({
        date: row.date,
        testsAttempted: parseInt(row.tests_attempted),
        avgPercentage: parseFloat(row.avg_percentage),
        totalCorrect: parseInt(row.total_correct),
        totalWrong: parseInt(row.total_wrong),
        avgTimeSpent: Math.round(row.avg_time_spent),
      }))
    } finally {
      client.release()
    }
  },

  /**
   * Get comprehensive weak area analysis.
   */
  async getFullAnalysis(userId) {
    const [weakTopics, weakSubjects, difficultyPerformance, trends] = await Promise.all([
      this.getWeakTopics(userId, { limit: 15 }),
      this.getWeakSubjects(userId),
      this.getPerformanceByDifficulty(userId),
      this.getPerformanceTrends(userId, { days: 30 }),
    ])

    // Calculate overall stats
    const totalAttempts = weakTopics.reduce((sum, t) => sum + t.totalAttempts, 0)
    const totalCorrect = weakTopics.reduce((sum, t) => sum + t.correctAnswers, 0)
    const overallAccuracy = totalAttempts > 0 ? (totalCorrect / totalAttempts * 100) : 0

    // Identify critical weak areas (accuracy < 40%)
    const criticalWeakAreas = weakTopics.filter(t => t.accuracy < 40)

    // Identify improving areas (accuracy 40-60%)
    const improvingAreas = weakTopics.filter(t => t.accuracy >= 40 && t.accuracy < 60)

    return {
      overallAccuracy: Math.round(overallAccuracy * 100) / 100,
      totalQuestionsAttempted: totalAttempts,
      weakTopics,
      weakSubjects,
      difficultyPerformance,
      trends,
      criticalWeakAreas,
      improvingAreas,
      recommendations: this.generateRecommendations(weakTopics, weakSubjects, difficultyPerformance),
    }
  },

  /**
   * Get comparison with peer average.
   */
  async getPeerComparison(userId, topicId = null) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      let sql
      let params

      if (topicId) {
        sql = `
          SELECT
            'peer' as type,
            AVG(uts.accuracy) as avg_accuracy,
            AVG(uts.total_time_spent_seconds / NULLIF(uts.total_attempts, 0)) as avg_time
          FROM user_topic_stats uts
          WHERE (uts.topic_id = $1 OR (uts.topic_id IS NULL AND LOWER(uts.topic) = (SELECT LOWER(name) FROM topics WHERE id = $1)))
            AND uts.user_id != $2
            AND uts.total_attempts >= 5

          UNION ALL

          SELECT
            'you' as type,
            uts.accuracy as avg_accuracy,
            uts.total_time_spent_seconds / NULLIF(uts.total_attempts, 0) as avg_time
          FROM user_topic_stats uts
          WHERE (uts.topic_id = $1 OR (uts.topic_id IS NULL AND LOWER(uts.topic) = (SELECT LOWER(name) FROM topics WHERE id = $1)))
            AND uts.user_id = $2
        `
        params = [topicId, userId]
      } else {
        sql = `
          SELECT
            'peer' as type,
            AVG(uts.accuracy) as avg_accuracy,
            AVG(uts.total_time_spent_seconds / NULLIF(uts.total_attempts, 0)) as avg_time
          FROM user_topic_stats uts
          WHERE uts.user_id != $1
            AND uts.total_attempts >= 5

          UNION ALL

          SELECT
            'you' as type,
            AVG(uts.accuracy) as avg_accuracy,
            AVG(uts.total_time_spent_seconds / NULLIF(uts.total_attempts, 0)) as avg_time
          FROM user_topic_stats uts
          WHERE uts.user_id = $1
        `
        params = [userId]
      }

      const result = await client.query(sql, params)

      const peer = result.rows.find(r => r.type === 'peer')
      const user = result.rows.find(r => r.type === 'you')

      return {
        peerAccuracy: parseFloat(peer?.avg_accuracy || 0),
        peerAvgTime: Math.round(peer?.avg_time || 0),
        userAccuracy: parseFloat(user?.avg_accuracy || 0),
        userAvgTime: Math.round(user?.avg_time || 0),
        accuracyDiff: parseFloat(user?.avg_accuracy || 0) - parseFloat(peer?.avg_accuracy || 0),
        timeDiff: Math.round(user?.avg_time || 0) - Math.round(peer?.avg_time || 0),
      }
    } finally {
      client.release()
    }
  },

  /**
   * Classify accuracy into strength categories.
   */
  classifyStrength(accuracy) {
    if (accuracy >= 80) return 'strong'
    if (accuracy >= 60) return 'moderate'
    if (accuracy >= 40) return 'weak'
    return 'critical'
  },

  /**
   * Generate recommendations based on analysis.
   */
  generateRecommendations(weakTopics, weakSubjects, difficultyPerformance) {
    const recommendations = []

    // Topic-based recommendations
    const criticalTopics = weakTopics.filter(t => t.accuracy < 40)
    if (criticalTopics.length > 0) {
      recommendations.push({
        type: 'focus_topics',
        priority: 'high',
        message: `Focus on these topics: ${criticalTopics.map(t => t.topicName).join(', ')}`,
        topics: criticalTopics.map(t => t.topicId),
      })
    }

    // Subject-based recommendations
    const criticalSubjects = weakSubjects.filter(s => s.accuracy < 50)
    if (criticalSubjects.length > 0) {
      recommendations.push({
        type: 'focus_subjects',
        priority: 'high',
        message: `Improve in subjects: ${criticalSubjects.map(s => s.subjectName).join(', ')}`,
        subjects: criticalSubjects.map(s => s.subjectId),
      })
    }

    // Difficulty-based recommendations
    const hardPerformance = difficultyPerformance.find(d => d.difficulty === 'hard')
    if (hardPerformance && hardPerformance.accuracy < 30) {
      recommendations.push({
        type: 'difficulty_practice',
        priority: 'medium',
        message: 'Practice more hard difficulty questions',
      })
    }

    // Time-based recommendations
    const slowTopics = weakTopics.filter(t => t.avgTimePerQuestion > 120)
    if (slowTopics.length > 0) {
      recommendations.push({
        type: 'speed_improvement',
        priority: 'medium',
        message: 'Work on speed for: ' + slowTopics.map(t => t.topicName).join(', '),
      })
    }

    return recommendations
  },
}

export default weakAreaDetectionService
