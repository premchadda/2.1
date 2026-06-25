import pool from '../database/db.js'

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