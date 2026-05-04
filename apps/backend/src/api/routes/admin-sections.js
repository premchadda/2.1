import express from 'express'
import { pool, ensureTestSectionsSchema } from '../../infrastructure/database/postgres-helpers.js'
import { protect, admin } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.use(async (_req, res, next) => {
  try {
    await ensureTestSectionsSchema()

    // Add new columns if not exist
    const newColumns = [
      'ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS test_id INTEGER REFERENCES tests(id) ON DELETE SET NULL',
      'ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS marks_per_question NUMERIC(5,2) DEFAULT 2',
      'ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS negative_marks NUMERIC(5,2) DEFAULT 0.5',
      'ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS time_limit INTEGER DEFAULT 900',
      'ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false',
      'ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS instructions TEXT',
      'ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) DEFAULT \'medium\'',
      'ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT false',
      'ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS shuffle_options BOOLEAN DEFAULT false',
      'ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS expected_questions INTEGER DEFAULT 0',
      'ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS total_marks NUMERIC(7,2) DEFAULT 0',
      'ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS exam_stage VARCHAR(50)',
      'ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS paper VARCHAR(100)',
      'ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS session VARCHAR(100)',
      'ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS section_code VARCHAR(50)',
      'ALTER TABLE test_sections ADD COLUMN IF NOT EXISTS is_qualifying BOOLEAN DEFAULT false'
    ]

    for (const sql of newColumns) {
      await pool.query(sql).catch(() => { })
    }

    next()
  } catch (error) {
    console.error('[Sections] Schema ensure error:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/', async (req, res) => {
  try {
    const { testId } = req.query

    let query = `
      SELECT ts.*, 
             tc.name as category_name,
             tc.slug as category_slug,
             t.title as test_title,
             (
               SELECT COUNT(*)::int 
               FROM questions q 
               WHERE (q.section::text = CAST(ts.id AS text) OR q.section = ts.name)
                 AND q.is_active = true
                 ${testId ? 'AND q.test_id = $1' : ''}
             ) as question_count
      FROM test_sections ts
      LEFT JOIN test_categories tc ON ts.category_id = tc.id
      LEFT JOIN tests t ON ts.test_id = t.id
    `

    const params = []
    if (testId) {
      params.push(testId)
      query += ` WHERE ts.test_id = $1 OR ts.test_id IS NULL`
    }

    query += ` ORDER BY ts.display_order, ts.id`

    const { rows } = await pool.query(query, params)
    res.json({ success: true, data: rows })
  } catch (error) {
    console.error('[Sections] Get error:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { rows } = await pool.query(`
      SELECT ts.*, 
             tc.name as category_name,
             tc.slug as category_slug
      FROM test_sections ts
      LEFT JOIN test_categories tc ON ts.category_id = tc.id
      WHERE ts.id = $1
    `, [id])

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Section not found' })
    }

    res.json({ success: true, data: rows[0] })
  } catch (error) {
    console.error('[Sections] Get by ID error:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/', protect, admin, async (req, res) => {
  try {
    const {
      name, category_id, test_id, description,
      duration, passing_marks, is_active, display_order,
      marks_per_question, negative_marks, time_limit, is_locked,
      instructions, difficulty, shuffle_questions, shuffle_options,
      expected_questions, total_marks, exam_stage, paper, session,
      section_code, is_qualifying
    } = req.body

    const { rows } = await pool.query(`
      INSERT INTO test_sections (
        name, category_id, test_id, description, duration, passing_marks, 
        is_active, display_order, marks_per_question, negative_marks, 
        time_limit, is_locked, instructions, difficulty, 
        shuffle_questions, shuffle_options, expected_questions, total_marks,
        exam_stage, paper, session, section_code, is_qualifying
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *
    `, [
      name, category_id, test_id, description, duration, passing_marks,
      is_active !== false, display_order || 0,
      marks_per_question ?? 2, negative_marks ?? 0.5, time_limit ?? 900,
      is_locked || false, instructions || '', difficulty || 'medium',
      shuffle_questions || false, shuffle_options || false,
      expected_questions ?? 0, total_marks ?? 0, exam_stage || null,
      paper || null, session || null, section_code || null,
      is_qualifying || false
    ])

    res.status(201).json({ success: true, data: rows[0] })
  } catch (error) {
    console.error('[Sections] Create error:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
})

router.put('/:id', protect, admin, async (req, res) => {
  try {
    const { id } = req.params
    const {
      name, category_id, test_id, description, duration, passing_marks,
      is_active, display_order, marks_per_question, negative_marks,
      time_limit, is_locked, instructions, difficulty,
      shuffle_questions, shuffle_options, expected_questions, total_marks,
      exam_stage, paper, session, section_code, is_qualifying
    } = req.body

    const { rows } = await pool.query(`
      UPDATE test_sections 
      SET name = COALESCE($1, name),
          category_id = COALESCE($2, category_id),
          test_id = COALESCE($3, test_id),
          description = COALESCE($4, description),
          duration = COALESCE($5, duration),
          passing_marks = COALESCE($6, passing_marks),
          is_active = COALESCE($7, is_active),
          display_order = COALESCE($8, display_order),
          marks_per_question = COALESCE($9, marks_per_question),
          negative_marks = COALESCE($10, negative_marks),
          time_limit = COALESCE($11, time_limit),
          is_locked = COALESCE($12, is_locked),
          instructions = COALESCE($13, instructions),
          difficulty = COALESCE($14, difficulty),
          shuffle_questions = COALESCE($15, shuffle_questions),
          shuffle_options = COALESCE($16, shuffle_options),
          expected_questions = COALESCE($17, expected_questions),
          total_marks = COALESCE($18, total_marks),
          exam_stage = COALESCE($19, exam_stage),
          paper = COALESCE($20, paper),
          session = COALESCE($21, session),
          section_code = COALESCE($22, section_code),
          is_qualifying = COALESCE($23, is_qualifying),
          updated_at = NOW()
      WHERE id = $24
      RETURNING *
    `, [
      name, category_id, test_id, description, duration, passing_marks,
      is_active, display_order, marks_per_question, negative_marks,
      time_limit, is_locked, instructions, difficulty,
      shuffle_questions, shuffle_options, expected_questions, total_marks,
      exam_stage, paper, session, section_code, is_qualifying, id
    ])

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Section not found' })
    }

    res.json({ success: true, data: rows[0] })
  } catch (error) {
    console.error('[Sections] Update error:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
})

router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const { id } = req.params

    await pool.query('DELETE FROM test_sections WHERE id = $1', [id])

    res.json({ success: true, message: 'Section deleted' })
  } catch (error) {
    console.error('[Sections] Delete error:', error.message)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
