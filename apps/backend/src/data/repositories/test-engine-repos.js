// CRIT-02 FIX: Import shared pool instead of creating duplicate connection pool
// This ensures consistent connection management and SSL configuration
import { pool } from '../../infrastructure/database/postgres-helpers.js'

export const TestRepository = {
  async findAll() {
    const { rows } = await pool.query(`
      SELECT 
        t.*,
        ts.title as series_title,
        ts.slug as series_slug
      FROM tests t
      JOIN test_series ts ON t.series_id = ts.id
      WHERE t.is_active = true
      ORDER BY t.created_at DESC
    `)
    return rows
  },

  async findById(id) {
    const { rows } = await pool.query(`
      SELECT 
        t.*,
        ts.title as series_title,
        ts.slug as series_slug
      FROM tests t
      JOIN test_series ts ON t.series_id = ts.id
      WHERE t.id = $1
    `, [id])
    return rows[0]
  },

  async findBySeriesId(seriesId) {
    const { rows } = await pool.query(
      'SELECT * FROM tests WHERE series_id = $1 AND is_active = true ORDER BY created_at DESC',
      [seriesId]
    )
    return rows
  },

  async create(data) {
    const { series_id, title, slug, duration, total_marks } = data

    const { rows } = await pool.query(
      `INSERT INTO tests (series_id, title, slug, duration, total_marks)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [series_id, title, slug, duration, total_marks]
    )

    return rows[0]
  }
}

export const QuestionRepository = {
  async findByTestId(testId) {
    const { rows } = await pool.query(`
      SELECT 
        q.id,
        q.question_text,
        q.subject,
        q.difficulty,
        tq.marks,
        tq.negative_marks,
        tq.order_index,
        json_agg(
          json_build_object(
            'id', qo.id,
            'text', qo.text
          )
        ) as options
      FROM questions q
      JOIN test_questions tq ON q.id = tq.question_id
      JOIN question_options qo ON q.id = qo.question_id
      WHERE tq.test_id = $1
      GROUP BY q.id, tq.marks, tq.negative_marks, tq.order_index
      ORDER BY tq.order_index
    `, [testId])
    return rows
  },

  async create(questionData) {
    const { question, subject, difficulty } = questionData

    const { rows } = await pool.query(
      `INSERT INTO questions (question_text, subject, difficulty, options, correct_option, is_active)
       VALUES ($1, $2, $3, '[]'::jsonb, 0, true)
       RETURNING *`,
      [question, subject, difficulty]
    )

    return rows[0]
  }
}

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
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const { rows: attemptRows } = await client.query(
        `UPDATE attempts
         SET submitted_at = NOW(), score = $1, total_marks = $2, percentage = $3
         WHERE id = $4
         RETURNING *`,
        [score, totalMarks, percentage, attemptId]
      )

      if (answers.length > 0) {
        const cols = ['attempt_id', 'question_id', 'selected_option_id', 'selected_option', 'is_correct', 'time_spent', 'time_spent_seconds', 'is_unattempted', 'created_at']
        const valuePlaceholders = answers.map((_, i) => {
          const base = i * cols.length
          return `(${cols.map((_, j) => `$${base + j + 1}`).join(', ')}, NOW())`
        })
        const flatValues = answers.flatMap(a => [
          attemptId, a.questionId, a.selectedOptionId, a.selectedOptionId, a.isCorrect, a.timeSpent || 0, a.timeSpent || 0, false
        ])
        await client.query(
          `INSERT INTO attempt_answers (${cols.join(', ')})
           VALUES ${valuePlaceholders.join(', ')}`,
          flatValues
        )
      }

      await client.query('COMMIT')
      return attemptRows[0]
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('Test submission failed, transaction rolled back:', error)
      throw error
    } finally {
      client.release()
    }
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

export default pool
