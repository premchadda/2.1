/**
 * Enhanced Import Service
 *
 * Supports multiple import formats:
 * - ClassX JSON (existing)
 * - Excel/CSV (new)
 * - Custom JSON formats (new)
 *
 * Features:
 * - Progress tracking for large imports
 * - Validation with detailed error reporting
 * - Hindi question support
 * - Batch processing with configurable chunk sizes
 */

import { pool } from '../../infrastructure/database/postgres-helpers.js'
import { importClassXQuestions, importClassXTestsWithQuestions, mapClassXToQuestion } from './classxImporter.js'

const SOURCE_NAMES = {
  classx: 'classx',
  excel: 'excel',
  csv: 'csv',
  custom: 'custom',
}

/**
 * Validate a question payload before import.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateQuestion(question, index = 0) {
  const errors = []

  if (!question.questionText && !question.question_text && !question.question) {
    errors.push(`Q${index + 1}: Missing question text`)
  }

  const options = question.options || []
  if (options.length < 2) {
    errors.push(`Q${index + 1}: At least 2 options required`)
  }

  if (question.correctOption === undefined && question.correct_option === undefined && question.answer === undefined) {
    errors.push(`Q${index + 1}: Missing correct answer`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Parse Excel buffer into question objects.
 * Expects columns: question, option_1, option_2, option_3, option_4, answer, explanation
 */
export async function parseExcelData(buffer, filename) {
  const XLSX = await import('xlsx-js-style')
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(sheet)

  return data.map((row, i) => ({
    id: String(i + 1),
    question: row.question || row.Question || row.question_text || '',
    option_1: row.option_1 || row.Option1 || row.option_a || row.A || '',
    option_2: row.option_2 || row.Option2 || row.option_b || row.B || '',
    option_3: row.option_3 || row.Option3 || row.option_c || row.C || '',
    option_4: row.option_4 || row.Option4 || row.option_d || row.D || '',
    answer: row.answer || row.Answer || row.correct || '',
    solution_text: row.explanation || row.solution || row.solution_text || '',
    difficulty: row.difficulty || row.Difficulty || 'medium',
    marks: row.marks || row.Marks || 1,
    negative_marks: row.negative_marks || row.negativeMarks || 0.25,
  }))
}

/**
 * Parse CSV string into question objects.
 */
export function parseCSVData(csvString) {
  const lines = csvString.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const questions = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const row = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ''
    })

    questions.push({
      id: String(i),
      question: row.question || row.question_text || '',
      option_1: row.option_1 || row.option_a || '',
      option_2: row.option_2 || row.option_b || '',
      option_3: row.option_3 || row.option_c || '',
      option_4: row.option_4 || row.option_d || '',
      answer: row.answer || row.correct || '',
      solution_text: row.explanation || row.solution || '',
      difficulty: row.difficulty || 'medium',
      marks: parseFloat(row.marks) || 1,
      negative_marks: parseFloat(row.negative_marks) || 0.25,
    })
  }

  return questions
}

/**
 * Detect import format from file extension or content.
 */
export function detectFormat(filename, data) {
  const ext = filename?.toLowerCase().split('.').pop()

  if (ext === 'json') {
    // Check if it's ClassX format
    if (Array.isArray(data) && data[0]?.question && data[0]?.option_1) {
      return 'classx'
    }
    return 'custom'
  }

  if (ext === 'xlsx' || ext === 'xls') return 'excel'
  if (ext === 'csv') return 'csv'

  // Try to detect from content
  if (typeof data === 'string') {
    if (data.includes(',') && data.includes('\n')) return 'csv'
  }

  return 'custom'
}

/**
 * Normalize any format to ClassX format for import.
 */
export function normalizeToClassX(data, format) {
  switch (format) {
    case 'classx':
      return Array.isArray(data) ? data : data.questions || []
    case 'excel':
    case 'csv':
      return Array.isArray(data) ? data : []
    case 'custom':
      // Try to normalize custom JSON
      if (Array.isArray(data)) return data
      if (data.questions) return data.questions
      if (data.data) return Array.isArray(data.data) ? data.data : []
      return []
    default:
      return []
  }
}

/**
 * Batch import with progress tracking.
 *
 * @param {Array} rows - Question rows
 * @param {Object} config - Import config
 * @param {Function} onProgress - Progress callback (currentIndex, total)
 * @returns {Object} Import results
 */
export async function batchImport(rows, config = {}, onProgress = null) {
  const BATCH_SIZE = config.batchSize || 100
  const results = {
    total: rows.length,
    imported: 0,
    skipped: 0,
    failed: 0,
    duplicates: 0,
    errors: [],
    questions: [],
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE)

      for (let j = 0; j < batch.length; j++) {
        const globalIndex = i + j
        try {
          const row = batch[j]
          const mapped = mapClassXToQuestion(row, config)

          if (!mapped) {
            results.skipped++
            continue
          }

          // Check duplicates
          if (config.skipDuplicates !== false && mapped.externalQuestionId) {
            const existing = await client.query(
              `SELECT id FROM questions WHERE external_question_id = $1 AND imported_from = $2 LIMIT 1`,
              [mapped.externalQuestionId, config.source || 'classx']
            )
            if (existing.rows.length > 0) {
              results.duplicates++
              results.skipped++
              continue
            }
          }

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

          // Link to test
          if (mapped.testId) {
            await client.query(
              `INSERT INTO test_questions (test_id, question_id, question_number)
               VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
              [mapped.testId, questionId, globalIndex + 1]
            )
          }

          results.imported++
          results.questions.push({
            id: questionId,
            index: globalIndex,
            externalId: mapped.externalQuestionId,
          })
        } catch (err) {
          results.failed++
          results.errors.push({
            index: globalIndex,
            message: err.message,
          })
        }
      }

      // Report progress
      if (onProgress) {
        onProgress(Math.min(i + BATCH_SIZE, rows.length), rows.length)
      }
    }

    // Update test stats
    if (config.testId && results.imported > 0) {
      await client.query(
        `UPDATE tests SET
          total_questions = (SELECT COUNT(*) FROM test_questions WHERE test_id = $1),
          updated_at = NOW()
         WHERE id = $1`,
        [config.testId]
      )
    }

    // Log import
    await client.query(
      `INSERT INTO import_logs (source, file_name, total_records, imported, skipped, failed, errors, imported_by, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        config.source || 'batch',
        config.fileName || null,
        results.total,
        results.imported,
        results.skipped,
        results.failed,
        JSON.stringify(results.errors.slice(0, 100)),
        config.userId || null,
        JSON.stringify({
          testId: config.testId,
          format: config.format,
          batchSize: BATCH_SIZE,
        }),
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

/**
 * Unified import endpoint that handles any format.
 */
export async function universalImport(fileBuffer, filename, config = {}) {
  let data
  let format

  if (filename.endsWith('.json')) {
    data = JSON.parse(fileBuffer.toString('utf-8'))
    format = detectFormat(filename, data)
  } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
    data = await parseExcelData(fileBuffer, filename)
    format = 'excel'
  } else if (filename.endsWith('.csv')) {
    data = parseCSVData(fileBuffer.toString('utf-8'))
    format = 'csv'
  } else {
    throw new Error('Unsupported file format. Use JSON, Excel, or CSV.')
  }

  const rows = normalizeToClassX(data, format)

  if (rows.length === 0) {
    throw new Error('No questions found in the file')
  }

  return batchImport(rows, { ...config, source: format, format }, config.onProgress)
}
