import express from 'express'
import { protect, optionalAuth, admin } from '../../middleware/auth.middleware.js'
import { resolveAssetAccessUrl } from '../../infrastructure/storage/storageProvider.js'
import { nullIfEmpty } from '../../services/core/common.js'
import { findEntityByIdentifier, getInternalId } from '../../shared/utils/identifier-utils.js'
import { getPublicResponseId } from '../../shared/utils/public-id-response.js'

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

  const assets = await global.dbHelpers.find('assets', {
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
// @desc    Get questions for a specific test (requires authentication for security)
// @access  Private - requires auth to prevent answer leakage
router.get('/test/:testId', protect, async (req, res) => {
  try {
    const { testId } = req.params

    const test = await findEntityByIdentifier(global.dbHelpers, 'tests', testId, { slugFields: ['slug'] })
    if (!test || test.isActive === false) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      })
    }

    if ((test.isPro === true || test.type === 'Pro') && !req.user?.isProUser) {
      return res.status(403).json({
        success: false,
        message: 'Pro Pass required for this test'
      })
    }
    
    // Find questions by test_id - handle both numeric and string IDs
    const internalTestId = test.id || test._id;
    
    const result = await global.dbHelpers.pool.query(
      `SELECT * FROM questions WHERE test_id = $1 AND is_active = true`,
      [internalTestId]
    )
    
    const filteredQuestions = result.rows.map(row => global.dbHelpers.toCamel(row))
    
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
      id: getPublicResponseId(global.dbHelpers, 'questions', q, q.id || q._id),
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      questionTextHi: q.questionTextHi,
      options: sanitizeOptions(q.options),
      optionsHi: q.optionsHi,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      section: q.section,
      subject: q.subject,
      testId: getPublicResponseId(global.dbHelpers, 'tests', test, q.testId),
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
      message: error.message,
    })
  }
})

// @route   GET /api/questions/:questionId
// @desc    Get a single question by ID (admin only - for editing)
// @access  Private - Admin only
router.get('/:questionId', protect, admin, async (req, res) => {
  try {
    const { questionId } = req.params
    
    const question = await findEntityByIdentifier(global.dbHelpers, 'questions', questionId)
    
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
      message: error.message,
    })
  }
})

export default router
