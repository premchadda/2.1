/**
 * Admin Question Builder Service
 *
 * Provides CRUD operations for building questions through the admin panel.
 * Supports:
 * - Single question creation with validation
 * - Bulk question creation
 * - Question cloning
 * - Question versioning
 * - Image/asset attachment
 * - Hindi language support
 */

import { pool } from '../../infrastructure/database/postgres-helpers.js'
import Question from '../../data/models/question/Question.js'

const questionBuilderService = {
  /**
   * Create a single question with full validation.
   */
  async create(data) {
    const validation = this.validate(data)
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
    }

    const questionData = {
      questionText: data.questionText || data.question_text,
      questionTextHi: data.questionTextHi || data.question_text_hi || null,
      options: data.options || [],
      optionsHi: data.optionsHi || data.options_hi || null,
      correctOption: data.correctOption ?? data.correct_option ?? 0,
      explanation: data.explanation || null,
      marks: data.marks || 1,
      negativeMarks: data.negativeMarks || data.negative_marks || 0.25,
      difficulty: data.difficulty || 'medium',
      questionType: data.questionType || data.question_type || 'mcq',
      section: data.section || null,
      subject: data.subject || null,
      chapter: data.chapter || null,
      topicId: data.topicId || data.topic_id || null,
      subtopicId: data.subtopicId || data.subtopic_id || null,
      chapterId: data.chapterId || data.chapter_id || null,
      testId: data.testId || data.test_id || null,
      sectionId: data.sectionId || data.section_id || null,
      seriesId: data.seriesId || data.series_id || null,
      categoryId: data.categoryId || data.category_id || null,
      imageUrl: data.imageUrl || data.image_url || null,
      solutionImageUrl: data.solutionImageUrl || data.solution_image_url || null,
      language: data.language || 'en',
      source: data.source || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
    }

    return Question.create(questionData)
  },

  /**
   * Create multiple questions in batch.
   */
  async bulkCreate(questions, config = {}) {
    const results = {
      total: questions.length,
      created: 0,
      failed: 0,
      errors: [],
      questionIds: [],
    }

    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      for (let i = 0; i < questions.length; i++) {
        try {
          const question = questions[i]
          const validation = this.validate(question)

          if (!validation.valid) {
            results.failed++
            results.errors.push({
              index: i,
              message: validation.errors.join(', '),
            })
            continue
          }

          const result = await client.query(
            `INSERT INTO questions (
              question_text, question_text_hi, options, options_hi,
              correct_option, explanation, marks, negative_marks,
              difficulty, question_type, section, subject, chapter,
              topic_id, subtopic_id, chapter_id, test_id, section_id,
              series_id, category_id, image_url, solution_image_url,
              language, source, is_active, created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4,
              $5, $6, $7, $8,
              $9, $10, $11, $12, $13,
              $14, $15, $16, $17, $18,
              $19, $20, $21, $22,
              $23, $24, $25, NOW(), NOW()
            ) RETURNING id`,
            [
              question.questionText || question.question_text,
              question.questionTextHi || question.question_text_hi || null,
              JSON.stringify(question.options || []),
              JSON.stringify(question.optionsHi || question.options_hi || null),
              question.correctOption ?? question.correct_option ?? 0,
              question.explanation || null,
              question.marks || 1,
              question.negativeMarks || question.negative_marks || 0.25,
              question.difficulty || 'medium',
              question.questionType || question.question_type || 'mcq',
              question.section || null,
              question.subject || null,
              question.chapter || null,
              question.topicId || question.topic_id || null,
              question.subtopicId || question.subtopic_id || null,
              question.chapterId || question.chapter_id || null,
              question.testId || question.test_id || null,
              question.sectionId || question.section_id || null,
              question.seriesId || question.series_id || null,
              question.categoryId || question.category_id || null,
              question.imageUrl || question.image_url || null,
              question.solutionImageUrl || question.solution_image_url || null,
              question.language || 'en',
              question.source || null,
              true,
            ]
          )

          const questionId = result.rows[0].id

          // Link to test if provided
          if (question.testId || question.test_id || config.testId) {
            const testId = question.testId || question.test_id || config.testId
            await client.query(
              `INSERT INTO test_questions (test_id, question_id, question_number)
               VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
              [testId, questionId, i + 1]
            )
          }

          results.created++
          results.questionIds.push(questionId)
        } catch (err) {
          results.failed++
          results.errors.push({
            index: i,
            message: err.message,
          })
        }
      }

      // Update test stats if linking to a test
      if (config.testId && results.created > 0) {
        await client.query(
          `UPDATE tests SET
            total_questions = (SELECT COUNT(*) FROM test_questions WHERE test_id = $1),
            total_marks = (SELECT COALESCE(SUM(q.marks), 0) FROM test_questions tq JOIN questions q ON q.id = tq.question_id WHERE tq.test_id = $1),
            updated_at = NOW()
           WHERE id = $1`,
          [config.testId]
        )
      }

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    return results
  },

  /**
   * Clone a question with optional modifications.
   */
  async clone(questionId, modifications = {}) {
    const original = await Question.findById(questionId)
    if (!original) throw new Error('Question not found')

    const cloneData = {
      ...original,
      ...modifications,
      id: undefined,
      publicId: undefined,
      publicIdUuid: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    }

    return this.create(cloneData)
  },

  /**
   * Update a question with versioning.
   */
  async update(questionId, data, userId = null) {
    const existing = await Question.findById(questionId)
    if (!existing) throw new Error('Question not found')

    // Create a version snapshot before updating
    await this.createVersion(questionId, existing, userId)

    // Update the question
    return Question.updateById(questionId, {
      ...data,
      updatedAt: new Date(),
    })
  },

  /**
   * Create a version snapshot of a question.
   */
  async createVersion(questionId, questionData, userId = null) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      // Get the next version number
      const versionResult = await client.query(
        `SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
         FROM question_versions WHERE question_id = $1`,
        [questionId]
      )
      const nextVersion = versionResult.rows[0].next_version

      await client.query(
        `INSERT INTO question_versions (
          question_id, version_number, text, options, correct_answer,
          explanation, marks, negative_marks, difficulty, question_type,
          is_current, snapshot_type, changed_by, created_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          true, 'admin_edit', $11, NOW()
        )`,
        [
          questionId,
          nextVersion,
          questionData.questionText || questionData.question_text || questionData.text,
          JSON.stringify(questionData.options || []),
          questionData.correctOption ?? questionData.correct_option ?? questionData.correctAnswer,
          questionData.explanation,
          questionData.marks || 1,
          questionData.negativeMarks || questionData.negative_marks || 0.25,
          questionData.difficulty || 'medium',
          questionData.questionType || questionData.question_type || 'mcq',
          userId,
        ]
      )

      // Mark previous versions as not current
      await client.query(
        `UPDATE question_versions
         SET is_current = false
         WHERE question_id = $1 AND version_number < $2`,
        [questionId, nextVersion]
      )

      return nextVersion
    } finally {
      client.release()
    }
  },

  /**
   * Get question with all versions.
   */
  async getWithVersions(questionId) {
    const question = await Question.findById(questionId)
    if (!question) throw new Error('Question not found')

    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      const versions = await client.query(
        `SELECT qv.*, u.name as changed_by_name
         FROM question_versions qv
         LEFT JOIN users u ON qv.changed_by = u.id
         WHERE qv.question_id = $1
         ORDER BY qv.version_number DESC`,
        [questionId]
      )

      return {
        ...question,
        versions: versions.rows,
      }
    } finally {
      client.release()
    }
  },

  /**
   * Get questions with filters for admin.
   */
  async listForAdmin(filters = {}) {
    const { pool } = await import('../../infrastructure/database/postgres-helpers.js')
    const client = await pool.connect()

    try {
      let sql = `
        SELECT q.*,
               t.name as topic_name,
               s.name as subject_name,
               ts.name as test_name
        FROM questions q
        LEFT JOIN topics t ON t.id = q.topic_id
        LEFT JOIN subjects s ON s.id = t.subject_id
        LEFT JOIN tests ts ON ts.id = q.test_id
        WHERE 1=1
      `
      const params = []
      let paramIndex = 1

      if (filters.difficulty) {
        sql += ` AND q.difficulty = $${paramIndex}`
        params.push(filters.difficulty)
        paramIndex++
      }
      if (filters.topicId) {
        sql += ` AND q.topic_id = $${paramIndex}`
        params.push(filters.topicId)
        paramIndex++
      }
      if (filters.subject) {
        sql += ` AND s.name ILIKE $${paramIndex}`
        params.push(`%${filters.subject}%`)
        paramIndex++
      }
      if (filters.testId) {
        sql += ` AND q.test_id = $${paramIndex}`
        params.push(filters.testId)
        paramIndex++
      }
      if (filters.importedFrom) {
        sql += ` AND q.imported_from = $${paramIndex}`
        params.push(filters.importedFrom)
        paramIndex++
      }
      if (filters.search) {
        sql += ` AND (q.question_text ILIKE $${paramIndex} OR q.explanation ILIKE $${paramIndex})`
        params.push(`%${filters.search}%`)
        paramIndex++
      }
      if (filters.isActive !== undefined) {
        sql += ` AND q.is_active = $${paramIndex}`
        params.push(filters.isActive)
        paramIndex++
      }

      sql += ` ORDER BY q.id DESC`

      if (filters.limit) {
        sql += ` LIMIT $${paramIndex}`
        params.push(filters.limit)
        paramIndex++
      }
      if (filters.offset) {
        sql += ` OFFSET $${paramIndex}`
        params.push(filters.offset)
        paramIndex++
      }

      const result = await client.query(sql, params)
      return result.rows
    } finally {
      client.release()
    }
  },

  /**
   * Validate question data.
   */
  validate(data) {
    const errors = []

    if (!data.questionText && !data.question_text) {
      errors.push('Question text is required')
    }

    const options = data.options || []
    if (options.length < 2) {
      errors.push('At least 2 options are required')
    }
    if (options.length > 6) {
      errors.push('Maximum 6 options allowed')
    }

    if (data.correctOption === undefined && data.correct_option === undefined) {
      errors.push('Correct answer is required')
    } else {
      const correct = data.correctOption ?? data.correct_option
      if (correct < 0 || correct >= options.length) {
        errors.push('Correct answer index is out of range')
      }
    }

    if (data.marks !== undefined && (data.marks < 0 || data.marks > 100)) {
      errors.push('Marks must be between 0 and 100')
    }

    if (data.negativeMarks !== undefined && data.negativeMarks < 0) {
      errors.push('Negative marks cannot be negative')
    }

    const validDifficulties = ['easy', 'medium', 'hard', 'very_hard']
    if (data.difficulty && !validDifficulties.includes(data.difficulty.toLowerCase())) {
      errors.push(`Difficulty must be one of: ${validDifficulties.join(', ')}`)
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  },
}

export default questionBuilderService
