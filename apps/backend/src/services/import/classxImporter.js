/**
 * ClassX JSON Importer Service
 *
 * Maps ClassX question bank JSON format → TrstPrep V3 questions table.
 *
 * ClassX JSON format:
 * {
 *   "id": "102806",
 *   "test_id": "4653",
 *   "question": "...",
 *   "option_1": "...",
 *   "option_2": "...",
 *   "option_3": "...",
 *   "option_4": "...",
 *   "answer": "2",
 *   "solution_text": "..."
 * }
 *
 * Maps to TrstPrep:
 *   ClassX.id            → questions.external_question_id
 *   ClassX.test_id       → tests.source_test_id (or resolved test_id)
 *   ClassX.question       → questions.question_text
 *   ClassX.option_1..4   → questions.options JSONB array
 *   ClassX.answer        → questions.correct_option (1-indexed → 0-indexed)
 *   ClassX.solution_text → questions.explanation
 */

import { pool } from '../../infrastructure/database/postgres-helpers.js'

const SOURCE_NAME = 'classx'

/**
 * Map a single ClassX JSON row to a TrstPrep question payload.
 * Returns null if the row is invalid (missing question text).
 */
export function mapClassXToQuestion(row, config = {}) {
  if (!row || typeof row !== 'object') return null

  const questionText = (row.question || row.question_text || '').trim()
  if (!questionText) return null

  // Build options array from individual columns
  const options = []
  for (let i = 1; i <= 5; i++) {
    const val = row[`option_${i}`]
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      options.push(String(val).trim())
    }
  }

  // ClassX uses 1-based answer index, TrstPrep uses 0-based
  const rawAnswer = parseInt(row.answer || row.correct_option || '0', 10)
  const correctOption = rawAnswer > 0 ? rawAnswer - 1 : 0

  return {
    externalQuestionId: String(row.id || '').trim() || null,
    questionText,
    options,
    correctOption,
    explanation: (row.solution_text || row.explanation || '').trim() || null,
    marks: parseFloat(row.marks) || config.marks || 1,
    negativeMarks: parseFloat(row.negative_marks) || config.negativeMarks || 0.25,
    difficulty: (row.difficulty || config.difficulty || 'medium').toLowerCase(),
    questionType: row.question_type || config.questionType || 'mcq',
    language: row.language || config.language || 'en',
    imageUrl: row.image_url || row.question_image || null,
    solutionImageUrl: row.solution_image_url || row.solution_image || null,
    source: row.source || config.source || null,
    importedFrom: SOURCE_NAME,
    // Test linking
    sourceTestId: String(row.test_id || '').trim() || null,
    testId: config.testId || null,
    sectionId: config.sectionId || null,
    topicId: config.topicId || null,
  }
}

/**
 * Check if a question with the same external_question_id + source already exists.
 */
async function findExistingQuestion(externalId) {
  if (!externalId) return null
  const result = await pool.query(
    `SELECT id FROM questions
     WHERE external_question_id = $1 AND imported_from = $2
     LIMIT 1`,
    [externalId, SOURCE_NAME]
  )
  return result.rows[0] || null
}

/**
 * Import a batch of ClassX questions into the database.
 *
 * @param {Array} rows - Array of ClassX JSON question objects
 * @param {Object} config - Import configuration
 * @param {number} config.testId - Target test ID to link questions to
 * @param {number} config.sectionId - Target section ID
 * @param {number} config.topicId - Target topic ID
 * @param {number} config.marks - Default marks per question
 * @param {number} config.negativeMarks - Default negative marks
 * @param {string} config.difficulty - Default difficulty
 * @param {boolean} config.skipDuplicates - Skip questions with matching external_question_id (default: true)
 * @param {boolean} config.dryRun - Preview only, don't commit (default: false)
 * @param {number} config.userId - User performing the import
 * @returns {Object} Import results summary
 */
export async function importClassXQuestions(rows, config = {}) {
  const skipDuplicates = config.skipDuplicates !== false
  const dryRun = config.dryRun === true

  const results = {
    total: rows.length,
    imported: 0,
    skipped: 0,
    failed: 0,
    duplicates: 0,
    errors: [],
    questions: [],
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    results.errors.push({ index: -1, message: 'No rows to import' })
    return results
  }

  const client = await pool.connect()

  try {
    if (!dryRun) {
      await client.query('BEGIN')
    }

    for (let i = 0; i < rows.length; i++) {
      try {
        const mapped = mapClassXToQuestion(rows[i], config)

        if (!mapped) {
          results.skipped++
          results.errors.push({
            index: i,
            externalId: rows[i]?.id || null,
            message: 'Invalid or missing question text',
          })
          continue
        }

        // Check for duplicates
        if (skipDuplicates && mapped.externalQuestionId) {
          const existing = await findExistingQuestion(mapped.externalQuestionId)
          if (existing) {
            results.duplicates++
            results.skipped++
            continue
          }
        }

        if (dryRun) {
          results.imported++
          results.questions.push({
            index: i,
            externalId: mapped.externalQuestionId,
            questionText: mapped.questionText.substring(0, 100),
            optionCount: mapped.options.length,
            correctOption: mapped.correctOption,
          })
          continue
        }

        // Insert the question
        const insertResult = await client.query(
          `INSERT INTO questions (
            question_text, options, correct_option, explanation,
            marks, negative_marks, difficulty, question_type, language,
            image_url, solution_image_url, source, imported_from,
            external_question_id, topic_id, section_id, test_id,
            is_active, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8, $9,
            $10, $11, $12, $13,
            $14, $15, $16, $17,
            true, NOW(), NOW()
          ) RETURNING id`,
          [
            mapped.questionText,
            JSON.stringify(mapped.options),
            mapped.correctOption,
            mapped.explanation,
            mapped.marks,
            mapped.negativeMarks,
            mapped.difficulty,
            mapped.questionType,
            mapped.language,
            mapped.imageUrl,
            mapped.solutionImageUrl,
            mapped.source,
            mapped.importedFrom,
            mapped.externalQuestionId,
            mapped.topicId,
            mapped.sectionId,
            mapped.testId,
          ]
        )

        const questionId = insertResult.rows[0].id

        // Link to test via test_questions junction table if testId provided
        if (mapped.testId) {
          await client.query(
            `INSERT INTO test_questions (test_id, question_id, question_number)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [mapped.testId, questionId, i + 1]
          )
        }

        results.imported++
        results.questions.push({
          id: questionId,
          index: i,
          externalId: mapped.externalQuestionId,
        })
      } catch (err) {
        results.failed++
        results.errors.push({
          index: i,
          externalId: rows[i]?.id || null,
          message: err.message,
        })
      }
    }

    if (!dryRun) {
      // Update test question count if we imported to a specific test
      if (config.testId && results.imported > 0) {
        await client.query(
          `UPDATE tests SET
            total_questions = (SELECT COUNT(*) FROM test_questions WHERE test_id = $1),
            updated_at = NOW()
           WHERE id = $1`,
          [config.testId]
        )
      }

      // Log the import
      await client.query(
        `INSERT INTO import_logs (source, file_name, total_records, imported, skipped, failed, errors, imported_by, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          SOURCE_NAME,
          config.fileName || null,
          results.total,
          results.imported,
          results.skipped,
          results.failed,
          JSON.stringify(results.errors.slice(0, 100)), // Cap errors at 100
          config.userId || null,
          JSON.stringify({
            testId: config.testId,
            sectionId: config.sectionId,
            topicId: config.topicId,
            duplicates: results.duplicates,
          }),
        ]
      )

      await client.query('COMMIT')
    }
  } catch (err) {
    if (!dryRun) {
      await client.query('ROLLBACK')
    }
    results.errors.push({ index: -1, message: `Transaction failed: ${err.message}` })
    throw err
  } finally {
    client.release()
  }

  return results
}

/**
 * Import ClassX tests (creates test records + their questions).
 *
 * @param {Object} data - ClassX export data
 * @param {Array} data.tests - Array of test objects with title, duration, etc.
 * @param {Array} data.questions - Array of question objects referencing test_id
 * @param {Object} config - Import configuration
 * @returns {Object} Import results
 */
export async function importClassXTestsWithQuestions(data, config = {}) {
  const { tests = [], questions = [] } = data
  const results = {
    tests: { total: tests.length, imported: 0, skipped: 0, errors: [] },
    questions: { total: questions.length, imported: 0, skipped: 0, failed: 0, errors: [] },
    testIdMap: {}, // Maps ClassX test_id → TrstPrep test.id
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Phase 1: Import tests
    for (const testRow of tests) {
      try {
        const title = (testRow.title || testRow.name || '').trim()
        if (!title) {
          results.tests.skipped++
          continue
        }

        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

        const insertResult = await client.query(
          `INSERT INTO tests (
            title, slug, duration, total_questions, total_marks,
            negative_marking, difficulty, is_pro, is_active, status,
            imported_from, source_test_id, series_id,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, true, 'draft',
            $9, $10, $11,
            NOW(), NOW()
          ) RETURNING id`,
          [
            title,
            `${slug}-${Date.now()}`,
            parseInt(testRow.duration) || config.duration || 60,
            parseInt(testRow.total_questions) || 0,
            parseInt(testRow.total_marks) || 0,
            parseFloat(testRow.negative_marking) || 0.25,
            testRow.difficulty || 'Medium',
            testRow.is_pro === true || testRow.is_pro === 'true',
            SOURCE_NAME,
            String(testRow.id || testRow.test_id || ''),
            config.seriesId || null,
          ]
        )

        const newTestId = insertResult.rows[0].id
        const sourceTestId = String(testRow.id || testRow.test_id || '')
        results.testIdMap[sourceTestId] = newTestId
        results.tests.imported++
      } catch (err) {
        results.tests.errors.push({ testId: testRow.id, message: err.message })
        results.tests.skipped++
      }
    }

    // Phase 2: Import questions linked to their tests
    for (let i = 0; i < questions.length; i++) {
      try {
        const row = questions[i]
        const mapped = mapClassXToQuestion(row, config)
        if (!mapped) {
          results.questions.skipped++
          continue
        }

        // Resolve test_id from the map
        const resolvedTestId = mapped.sourceTestId
          ? results.testIdMap[mapped.sourceTestId] || config.testId || null
          : config.testId || null

        const insertResult = await client.query(
          `INSERT INTO questions (
            question_text, options, correct_option, explanation,
            marks, negative_marks, difficulty, question_type, language,
            image_url, solution_image_url, source, imported_from,
            external_question_id, topic_id, section_id, test_id,
            is_active, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8, $9,
            $10, $11, $12, $13,
            $14, $15, $16, $17,
            true, NOW(), NOW()
          ) RETURNING id`,
          [
            mapped.questionText,
            JSON.stringify(mapped.options),
            mapped.correctOption,
            mapped.explanation,
            mapped.marks,
            mapped.negativeMarks,
            mapped.difficulty,
            mapped.questionType,
            mapped.language,
            mapped.imageUrl,
            mapped.solutionImageUrl,
            mapped.source,
            mapped.importedFrom,
            mapped.externalQuestionId,
            mapped.topicId,
            mapped.sectionId,
            resolvedTestId,
          ]
        )

        const questionId = insertResult.rows[0].id

        // Link via junction table
        if (resolvedTestId) {
          await client.query(
            `INSERT INTO test_questions (test_id, question_id, question_number)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [resolvedTestId, questionId, i + 1]
          )
        }

        results.questions.imported++
      } catch (err) {
        results.questions.failed++
        results.questions.errors.push({ index: i, message: err.message })
      }
    }

    // Update test question counts
    for (const testId of Object.values(results.testIdMap)) {
      await client.query(
        `UPDATE tests SET
          total_questions = (SELECT COUNT(*) FROM test_questions WHERE test_id = $1),
          updated_at = NOW()
         WHERE id = $1`,
        [testId]
      )
    }

    // Log the import
    await client.query(
      `INSERT INTO import_logs (source, file_name, total_records, imported, skipped, failed, errors, imported_by, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        SOURCE_NAME,
        config.fileName || null,
        questions.length + tests.length,
        results.tests.imported + results.questions.imported,
        results.tests.skipped + results.questions.skipped,
        results.questions.failed,
        JSON.stringify([...results.tests.errors, ...results.questions.errors].slice(0, 100)),
        config.userId || null,
        JSON.stringify({ testIdMap: results.testIdMap }),
      ]
    )

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  return results
}
