import pool from '../database/db.js'

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
            'text', qo.text,
            'is_correct', qo.is_correct
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