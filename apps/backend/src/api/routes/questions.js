import express from 'express'
import { protect, optionalAuth, admin } from '../../middleware/auth.middleware.js'
import { resolveAssetAccessUrl } from '../../infrastructure/storage/storageProvider.js'
import { nullIfEmpty } from '../../services/core/common.js'
import { findEntityByIdentifier, getInternalId } from '../../shared/utils/identifier-utils.js'
import { getPublicResponseId } from '../../shared/utils/public-id-response.js'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router()

const parseAssetId = (value) => {
  const cleanValue = nullIfEmpty(value)
  if (cleanValue === null) return null
  const numeric = Number.parseInt(cleanValue, 10)
  return Number.isNaN(numeric) ? null : numeric
}

const buildAssetMap = async (assetIds) => {
  const uniqueIds = Array.from(new Set(assetIds.map(parseAssetId).filter(Boolean)))
  if (uniqueIds.length === 0) return new Map()

  const assets = await dbHelpers.find('assets', {
    id: { $in: uniqueIds },
    isActive: true
  })

  const map = new Map()
  assets.forEach((asset) => {
    const id = parseAssetId(asset.id || asset._id)
    if (id) {
      map.set(id, resolveAssetAccessUrl(asset) || asset.url || null)
    }
  })

  return map
}

// IMPORTANT: Route order matters! More specific routes must come before parameterized routes

// @route   GET /api/questions/test/:testId
// @desc    Get questions for a specific test
// @access  Free tests: public (no auth required). PRO tests: requires auth + Pro Pass.
//          Uses optionalAuth so unauthenticated users can still load free test questions.
router.get('/test/:testId', optionalAuth, async (req, res) => {
  try {
    const { testId } = req.params

    const test = await findEntityByIdentifier(dbHelpers, 'tests', testId, { slugFields: ['slug'] })
    if (!test || test.isActive === false) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      })
    }

    // Access control: only block on isPro boolean.
    // NOTE: test.type is a CATEGORY field (e.g. 'Pro', 'mock-tests', 'pyp'),
    // NOT an access control field. Many free PYP tests have type:'Pro' but
    // isPro:false — using type here incorrectly blocks 14+ free tests.
    const isPro = test.isPro === true

    if (isPro) {
      // PRO tests always require a logged-in user with an active subscription
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Please login to access this test',
          requiresAuth: true
        })
      }
      if (!req.user.isProUser && !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Pro Pass required for this test',
          requiresPro: true
        })
      }
    }
    
    // Find questions by test_id - handle both numeric and string IDs
    const internalTestId = test.id || test._id;
    
    const result = await dbHelpers.pool.query(
      `SELECT id, test_id, question_number, question_text, question_text_hi, options, options_hi, correct_option, marks, negative_marks, section, explanation, difficulty, image, is_active, created_at, updated_at, subject, chapter_id, topic, image_asset_id, series_id, category_id, sub_category_id, study_material_id, topic_id, quiz_id, public_id_uuid, public_id, category, type, status, tags, passage_id, chapter, is_practice, is_deleted, deleted_by, deleted_at, _orphaned, orphaned_at, _deleted_test_id, moderation_status, reviewed_by, reviewed_at, review_notes, submitted_for_review_at, submitted_by, external_question_id, language, solution_image_url, source, imported_from, section_id, subtopic_id, subject_id, estimated_time, explanation_hi, source_config, exam_category_ids, exam_ids, question_stage_ids, concept_ids, skill_ids, ai_generated, _deleted_series_id, created_by, correct_answer, question_type FROM questions WHERE test_id = $1 AND is_active = true`,
      [internalTestId]
    )
    
    const filteredQuestions = result.rows.map(row => dbHelpers.toCamel(row))
    
    // Sort by question number
    const sortedQuestions = filteredQuestions.sort((a, b) => 
      (a.questionNumber || 0) - (b.questionNumber || 0)
    )

    const sanitizeOptions = (options) => {
      if (!Array.isArray(options)) return options
      return options.map(option => {
        if (!option || typeof option !== 'object') return option
        const { isCorrect, is_correct, correct, ...safeOption } = option
        return safeOption
      })
    }
    
    const assetMap = await buildAssetMap(
      sortedQuestions.map((question) => question.imageAssetId)
    )

    // SECURITY: Remove correct answers from public response
    // Only send what the frontend needs to display questions
    const sanitizedQuestions = sortedQuestions.map(q => ({
      imageAssetId: parseAssetId(q.imageAssetId),
      imageUrl: parseAssetId(q.imageAssetId)
        ? assetMap.get(parseAssetId(q.imageAssetId)) || null
        : q.imageUrl || null,
      id: getPublicResponseId(dbHelpers, 'questions', q, q.id || q._id),
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      questionTextHi: q.questionTextHi,
      options: sanitizeOptions(q.options),
      optionsHi: q.optionsHi,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      section: q.section,
      subject: q.subject,
      testId: getPublicResponseId(dbHelpers, 'tests', test, q.testId),
      difficulty: q.difficulty,
      // DO NOT include correctOption/correct_option - that's only for result calculation
    }))
    
    res.json({
      success: true,
      count: sanitizedQuestions.length,
      data: sanitizedQuestions
    })
  } catch (error) {
    console.error('[Questions Test] Error:', error.message)
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})


// @route   GET /api/questions/:questionId/comments
// @desc    Get comments/discussions for a specific question
// @access  Public (optionalAuth)
router.get('/:questionId/comments', optionalAuth, async (req, res) => {
  try {
    const { questionId } = req.params
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100)

    const question = await findEntityByIdentifier(dbHelpers, 'questions', questionId)
    if (!question) {
      return res.json({ success: true, count: 0, data: [], comments: [] })
    }

    const internalId = question.id || question._id
    const result = await dbHelpers.pool.query(
      `SELECT d.id, d.public_id, d.content, d.content as text, d.user_id, 
              COALESCE(u.name, d.user_name, 'Student') as user_name,
              COALESCE(u.avatar, d.user_avatar) as user_avatar,
              d.upvotes, d.like_count, d.created_at, d.updated_at
       FROM discussions d
       LEFT JOIN users u ON d.user_id = u.id
       WHERE d.reference_type = 'question' 
         AND d.reference_id = $1 
         AND d.is_active = true 
         AND (d.is_deleted = false OR d.is_deleted IS NULL)
       ORDER BY d.created_at DESC
       LIMIT $2`,
      [internalId, limit]
    )

    const comments = result.rows.map(row => ({
      id: row.id,
      text: row.content || row.text,
      content: row.content || row.text,
      userId: row.user_id,
      userName: row.user_name,
      userAvatar: row.user_avatar,
      upvotes: row.upvotes || row.like_count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    res.json({
      success: true,
      count: comments.length,
      data: comments,
      comments,
    })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// @route   POST /api/questions/:questionId/comments
// @desc    Post a comment/discussion on a question
// @access  Private
router.post('/:questionId/comments', protect, async (req, res) => {
  try {
    const { questionId } = req.params
    const text = String(req.body?.text || req.body?.content || '').trim()
    if (!text) {
      return res.status(400).json({ success: false, message: 'Comment text is required' })
    }

    const question = await findEntityByIdentifier(dbHelpers, 'questions', questionId)
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' })
    }

    const internalId = question.id || question._id
    const result = await dbHelpers.pool.query(
      `INSERT INTO discussions (
        reference_type, reference_id, user_id, user_name, user_avatar, content, upvotes, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 0, true, NOW(), NOW())
      RETURNING id, content, content as text, user_id, user_name, user_avatar, created_at, updated_at`,
      [
        'question',
        internalId,
        req.user.id,
        req.user.name || 'Student',
        req.user.avatar || null,
        text,
      ]
    )

    const row = result.rows[0]
    const newComment = {
      id: row.id,
      text: row.content || row.text,
      content: row.content || row.text,
      userId: row.user_id,
      userName: row.user_name,
      userAvatar: row.user_avatar,
      upvotes: 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }

    res.status(201).json({
      success: true,
      message: 'Comment posted',
      data: newComment,
      comment: newComment,
    })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// @route   PUT /api/questions/:questionId/comments/:commentId
// @desc    Edit a question comment
// @access  Private
router.put('/:questionId/comments/:commentId', protect, async (req, res) => {
  try {
    const { commentId } = req.params
    const text = String(req.body?.text || req.body?.content || '').trim()
    if (!text) {
      return res.status(400).json({ success: false, message: 'Comment text is required' })
    }

    const result = await dbHelpers.pool.query(
      `UPDATE discussions 
       SET content = $1, is_edited = true, updated_at = NOW() 
       WHERE id = $2 AND (user_id = $3 OR $4 = true) AND is_active = true
       RETURNING id, content, content as text, user_id, user_name, user_avatar, updated_at`,
      [text, parseInt(commentId, 10), req.user.id, req.user.isAdmin || false]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found or unauthorized' })
    }

    res.json({
      success: true,
      message: 'Comment updated',
      data: result.rows[0],
    })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// @route   DELETE /api/questions/:questionId/comments/:commentId
// @desc    Delete a question comment
// @access  Private
router.delete('/:questionId/comments/:commentId', protect, async (req, res) => {
  try {
    const { commentId } = req.params

    const result = await dbHelpers.pool.query(
      `UPDATE discussions 
       SET is_active = false, is_deleted = true, deleted_at = NOW(), deleted_by = $1
       WHERE id = $2 AND (user_id = $1 OR $3 = true)
       RETURNING id`,
      [req.user.id, parseInt(commentId, 10), req.user.isAdmin || false]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Comment not found or unauthorized' })
    }

    res.json({
      success: true,
      message: 'Comment deleted',
    })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// @route   GET /api/questions/:questionId
// @desc    Get a single question by ID (admin only - for editing)
// @access  Private - Admin only
router.get('/:questionId', protect, admin, async (req, res) => {
  try {
    const { questionId } = req.params
    
    const question = await findEntityByIdentifier(dbHelpers, 'questions', questionId)
    
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      })
    }
    
    res.json({
      success: true,
      data: question
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: sanitizeErrorMessage(error),
    })
  }
})

export default router
