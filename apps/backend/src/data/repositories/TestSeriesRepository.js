import pool from '../database/db.js'

export const TestSeriesRepository = {
  async findAll() {
    const { rows } = await pool.query(`
      SELECT 
        ts.id,
        ts.title,
        ts.slug,
        ts.description,
        ts.is_pro,
        e.name as exam_name,
        e.slug as exam_slug,
        ec.name as category_name,
        ec.slug as category_slug
      FROM test_series ts
      JOIN exams e ON ts.exam_id = e.id
      JOIN exam_categories ec ON e.category_id = ec.id
      WHERE ts.is_pro = false
      ORDER BY ts.created_at DESC
    `)
    return rows
  },

  async findBySlug(slug) {
    const { rows } = await pool.query(`
      SELECT 
        ts.*,
        e.name as exam_name,
        e.slug as exam_slug,
        ec.name as category_name,
        ec.slug as category_slug
      FROM test_series ts
      JOIN exams e ON ts.exam_id = e.id
      JOIN exam_categories ec ON e.category_id = ec.id
      WHERE ts.slug = $1
    `, [slug])
    return rows[0]
  },

  async findByExamId(examId) {
    const { rows } = await pool.query(
      'SELECT * FROM test_series WHERE exam_id = $1 ORDER BY created_at DESC',
      [examId]
    )
    return rows
  },

  async create(data) {
    const { title, slug, exam_id, description, is_pro = false } = data

    const { rows } = await pool.query(
      `INSERT INTO test_series (title, slug, exam_id, description, is_pro)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, slug, exam_id, description, is_pro]
    )

    return rows[0]
  },

  async update(id, data) {
    const { title, description, is_pro } = data
    const { rows } = await pool.query(
      `UPDATE test_series 
       SET title = $1, description = $2, is_pro = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [title, description, is_pro, id]
    )
    return rows[0]
  },

  async delete(id) {
    const { rowCount } = await pool.query(
      'UPDATE test_series SET is_active = false, is_deleted = true, deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND is_deleted IS NOT DISTINCT FROM false',
      [id]
    )
    return rowCount > 0
  }
}