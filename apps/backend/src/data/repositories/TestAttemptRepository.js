import pool from '../database/db.js'

export const TestAttemptRepository = {
  async create(userId, testId) {
    const { rows } = await pool.query(
      `INSERT INTO attempts (user_id, test_id, started_at)
       VALUES ($1, $2, NOW())
       RETURNING *`,
      [userId, testId]
    )
    return rows[0]
  },

  async submit(attemptId, answers, score, totalMarks) {
    const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0
    
    // Update attempt
    const { rows: attemptRows } = await pool.query(
      `UPDATE attempts
       SET submitted_at = NOW(), score = $1, total_marks = $2, percentage = $3
       WHERE id = $4
       RETURNING *`,
      [score, totalMarks, percentage, attemptId]
    )
    
    // Insert answers
    for (const answer of answers) {
      await pool.query(
        `INSERT INTO attempt_answers (attempt_id, question_id, selected_option_id, is_correct, time_spent)
         VALUES ($1, $2, $3, $4, $5)`,
        [attemptId, answer.questionId, answer.selectedOptionId, answer.isCorrect, answer.timeSpent || 0]
      )
    }
    
    return attemptRows[0]
  },

  async findByUserId(userId) {
    const { rows } = await pool.query(
      `SELECT 
        ta.*,
        t.title as test_title,
        ts.title as series_title
      FROM attempts ta
      JOIN tests t ON ta.test_id = t.id
      JOIN test_series ts ON t.series_id = ts.id
      WHERE ta.user_id = $1
      ORDER BY ta.started_at DESC`,
      [userId]
    )
    return rows
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT * FROM attempts WHERE id = $1`,
      [id]
    )
    return rows[0]
  }
}