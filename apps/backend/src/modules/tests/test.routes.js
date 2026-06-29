
import express from 'express'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { protect, optionalAuth } from '../../middleware/auth.middleware.js'
import { checkAttemptLimit } from '../../shared/utils/attempt-limits.js'
import { emitDomainEvent } from '../../infrastructure/events/eventBus.js'
import { resolveAssetAccessUrl } from '../../infrastructure/storage/storageProvider.js'
import { nullIfEmpty } from '../../services/core/common.js'
import {
  analyticsService,
  leaderboardService,
  notificationService,
  recommendationService,
} from '../../services/core/index.js'
import { idsMatch, parseNumericId } from '../../shared/utils/db-utils.js'
import { findEntityByIdentifier, getInternalId } from '../../shared/utils/identifier-utils.js'
import { getPublicResponseId } from '../../shared/utils/public-id-response.js'
import { isProUser, isProRestrictedTest } from '../../shared/utils/user-utils.js'
import { findTestByIdentifier, filterQuestionsByTestId } from '../../shared/utils/test-utils.js'
import { isPypSlug } from '../../utils/slug-helpers.js'
import { readTestContent, readTestContentByPath } from '../../services/import/testContentStorage.js'

// Fetch questions for a specific test from DB directly (avoids full-table scan)
const fetchQuestionsByTestId = async (testId) => {
  const result = await dbHelpers.pool.query(
    'SELECT * FROM questions WHERE test_id = $1 AND is_active = true',
    [testId]
  )
  return result.rows.map(row => dbHelpers.toCamel(row))
}

// Fetch questions from JSON file (for json-file content source)
const fetchQuestionsFromJsonFile = async (test) => {
  const contentPath = test.contentPath || test.content_path
  if (!contentPath) {
    throw new Error('Test has content_source=json-file but no content_path set')
  }
  const content = await readTestContentByPath(contentPath)
  const questions = []
  for (const section of content.sections || []) {
    for (const q of section.questions || []) {
      questions.push({
        id: q.id,
        externalQuestionId: q.externalQuestionId,
        questionText: q.questionText,
        question_text: q.questionText,
        questionTextHi: q.questionTextHi,
        question_text_hi: q.questionTextHi,
        options: q.options,
        optionsHi: q.optionsHi,
        options_hi: q.optionsHi,
        correctOption: q.correctOption,
        correct_option: q.correctOption,
        correctAnswer: q.correctOption,
        explanation: q.explanation,
        explanationHi: q.explanationHi,
        explanation_hi: q.explanationHi,
        difficulty: q.difficulty,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        negative_marks: q.negativeMarks,
        type: q.type,
        section: section.name,
        subjectId: q.subjectId,
        subject_id: q.subjectId,
        chapterId: q.chapterId,
        chapter_id: q.chapterId,
        topicId: q.topicId,
        topic_id: q.topicId,
        subtopicId: q.subtopicId,
        subtopic_id: q.subtopicId,
        tags: q.tags || [],
        estimatedTime: q.estimatedTime,
        estimated_time: q.estimatedTime,
        questionNumber: q.questionNumber,
        question_number: q.questionNumber,
        testId: content.testId,
        test_id: content.testId,
        isActive: true,
        is_active: true,
      })
    }
  }
  return questions
}

// Unified question fetcher — picks DB or JSON based on test.content_source
const fetchTestQuestions = async (test) => {
  const source = test.contentSource || test.content_source
  if (source === 'json-file') {
    return fetchQuestionsFromJsonFile(test)
  }
  return fetchQuestionsByTestId(getInternalId(test))
}

const router = express.Router()

const findAttemptByIdentifier = (attemptId) =>
  findEntityByIdentifier(dbHelpers, 'attempts', attemptId)

const findSeriesByIdentifier = (seriesId) =>
  findEntityByIdentifier(dbHelpers, 'testSeries', seriesId, { slugFields: ['slug'] })

const findQuestionByIdentifier = (questionId) =>
  findEntityByIdentifier(dbHelpers, 'questions', questionId)

const getTestSeriesId = (source = {}) =>
  source.testSeriesId ?? source.test_series_id ?? source.seriesId ?? source.series_id ?? null

const normalizeSubmittedAnswers = async (answers) => {
  if (!Array.isArray(answers)) {
    return []
  }

  const cache = new Map()

  return Promise.all(
    answers.map(async (entry) => {
      if (!entry || typeof entry !== 'object') {
        return entry
      }

      const rawQuestionId = entry.questionId
      if (rawQuestionId === undefined || rawQuestionId === null) {
        return entry
      }

      const cacheKey = String(rawQuestionId)
      if (!cache.has(cacheKey)) {
        cache.set(cacheKey, findQuestionByIdentifier(rawQuestionId))
      }

      const question = await cache.get(cacheKey)
      return {
        ...entry,
        questionId: getInternalId(question) ?? rawQuestionId
      }
    })
  )
}

const sanitizeOptions = (options) => {
  return options.map((option) => {
    if (!option || typeof option !== 'object' || Array.isArray(option)) {
      return option
    }

    const { isCorrect, is_correct, correct, ...safeOption } = option
    return safeOption
  })
}

const publishEvent = async (eventName, payload) => {
  try {
    await emitDomainEvent(eventName, payload)
  } catch (error) {
    console.error(`[EventBus] Failed to publish "${eventName}":`, error.message)
  }
}

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

const enrichTestsWithBannerAssets = async (tests) => {
  if (!Array.isArray(tests) || tests.length === 0) return tests

  const bannerIds = tests
    .map((test) => test.bannerAssetId || test.banner_asset_id)
    .map(parseAssetId)
    .filter(Boolean)

  const assetMap = await buildAssetMap(bannerIds)

  return tests.map((test) => {
    const bannerAssetId = parseAssetId(test.bannerAssetId || test.banner_asset_id)
    const bannerUrl = bannerAssetId
      ? assetMap.get(bannerAssetId) || null
      : test.bannerUrl || test.banner_url || test.bannerImageUrl || test.banner_image_url || null

    return {
      ...test,
      testSeriesId: getTestSeriesId(test),
      bannerAssetId,
      bannerUrl
    }
  })
}

const enrichQuestionsWithImageAssets = async (questions) => {
  if (!Array.isArray(questions) || questions.length === 0) return questions

  const imageIds = questions
    .map((question) => question.imageAssetId || question.image_asset_id)
    .map(parseAssetId)
    .filter(Boolean)

  const assetMap = await buildAssetMap(imageIds)

  return questions.map((question) => {
    const imageAssetId = parseAssetId(question.imageAssetId || question.image_asset_id)
    const imageUrl = imageAssetId
      ? assetMap.get(imageAssetId) || null
      : question.imageUrl || question.image_url || question.questionImageUrl || question.question_image_url || question.image || null

    return {
      ...question,
      imageAssetId,
      imageUrl
    }
  })
}


const sanitizeQuestionForAttempt = (question) => {
  const {
    correctAnswer,
    correctOption,
    correct_option,
    correct,
    answer,
    isCorrect,
    is_correct,
    ...safeQuestion
  } = question

  return {
    ...safeQuestion,
    options: sanitizeOptions(safeQuestion.options),
    optionsHi: sanitizeOptions(safeQuestion.optionsHi),
    options_hi: sanitizeOptions(safeQuestion.options_hi)
  }
}

const normalizeOptionIndex = (value) => {
  const cleanValue = nullIfEmpty(value)
  if (cleanValue === null) return null
  if (typeof cleanValue === 'number' && Number.isFinite(cleanValue)) return cleanValue
  if (typeof cleanValue === 'string' && /^-?[0-9]+$/.test(cleanValue.trim())) {
    return Number(cleanValue)
  }
  return cleanValue
}

const getQuestionId = (question) => question?._id || question?.id

const getQuestionText = (question) => {
  return (
    question?.questionText ??
    question?.question_text ??
    question?.text ??
    ''
  )
}

const getQuestionOptions = (question) => {
  if (Array.isArray(question?.options)) return question.options
  if (question?.options && typeof question.options === 'object') {
    return question.options.en || []
  }
  return []
}

const getCorrectOption = (question) => {
  return question?.correctAnswer ?? question?.correctOption ?? question?.correct_option ?? question?.correct
}

const getUserAnswerForQuestion = (attempt, question, index) => {
  const answers = Array.isArray(attempt?.answers) ? attempt.answers : []
  const questionId = getQuestionId(question)

  const found = answers.find((answer) =>
    idsMatch(answer?.questionId, questionId) ||
    (answer?.questionIndex !== undefined && Number(answer.questionIndex) === index)
  )

  return found?.selectedOption ?? null
}


const getRankAndPercentile = async (testId, attempt) => {
  if (!attempt || !attempt.score) return { rank: 1, totalParticipants: 1, percentile: 100 }
  
  // Find all completing attempts for this test
  const allAttempts = await dbHelpers.find('attempts', { isCompleted: true })
  const testAttempts = allAttempts.filter(a => idsMatch(a.testId, testId) || idsMatch(a.test_id, testId))
  
  if (testAttempts.length === 0) {
    return { rank: 1, totalParticipants: 1, percentile: 100 }
  }

  // Get best attempt per user
  const userBestMap = new Map()
  testAttempts.forEach(a => {
    const userId = a.userId || a.user_id
    if (!userId) return
    const current = userBestMap.get(userId)
    if (!current) {
      userBestMap.set(userId, a)
    } else {
      // higher score or same score with less time
      if ((a.score || 0) > (current.score || 0)) {
        userBestMap.set(userId, a)
      } else if ((a.score || 0) === (current.score || 0) && (a.timeSpent || 0) < (current.timeSpent || 0)) {
        userBestMap.set(userId, a)
      }
    }
  })

  // include the current attempt in the calculation even if it's not the user's best
  const bestAttempts = Array.from(userBestMap.values())
  const hasCurrentAttempt = bestAttempts.some(a => idsMatch(a._id || a.id, attempt._id || attempt.id))
  if (!hasCurrentAttempt && attempt._id) {
    bestAttempts.push(attempt)
  }

  bestAttempts.sort((a, b) => {
    const scoreDiff = (b.score || 0) - (a.score || 0)
    if (scoreDiff !== 0) return scoreDiff
    return (a.timeSpent || 0) - (b.timeSpent || 0)
  })

  const totalParticipants = bestAttempts.length
  let rank = 1
  for (let i = 0; i < bestAttempts.length; i++) {
    if (idsMatch(bestAttempts[i]._id || bestAttempts[i].id, attempt._id || attempt.id)) {
      rank = i + 1
      break
    }
  }

  const percentile = totalParticipants > 1 ? ((totalParticipants - rank) / totalParticipants) * 100 : 100

  return {
    rank,
    totalParticipants,
    percentile: Math.max(0, Math.min(100, Number(percentile.toFixed(2))))
  }
}

const buildResultPayload = (test, attempt, questions, testIdFallback, rankData) => {
  const questionIdMap = new Map(
    questions.map((question) => [
      String(getQuestionId(question)),
      getPublicResponseId(dbHelpers, 'questions', question, getQuestionId(question))
    ])
  )

  const questionsWithAnswers = questions.map((q, idx) => {
    const userAnswer = getUserAnswerForQuestion(attempt, q, idx)

    return {
      id: getPublicResponseId(dbHelpers, 'questions', q, getQuestionId(q)),
      text: getQuestionText(q),
      questionText: getQuestionText(q),
      options: getQuestionOptions(q),
      correctAnswer: getCorrectOption(q),
      correct: q.correct,
      userAnswer,
      section: q.section || q.subject || 'General',
      subject: q.subject || q.section || 'General',
      difficulty: q.difficulty || 'Medium',
      explanation: q.explanation || '',
      isMarked: Array.isArray(attempt?.markedForReview) && attempt.markedForReview.includes(idx)
    }
  })

  const fallbackQuestionCount = questions.length > 0 ? questions.length : Number(test?.totalQuestions ?? 0)
  const totalQuestions = Number(attempt?.totalQuestions ?? fallbackQuestionCount)

  const correct = Number(attempt?.correct ?? attempt?.correctAnswers ?? 0)
  const wrong = Number(attempt?.wrong ?? attempt?.wrongAnswers ?? 0)
  const unattempted = Number(
    attempt?.unattempted ??
    attempt?.skippedQuestions ??
    Math.max(totalQuestions - correct - wrong, 0)
  )

  const computedAccuracy =
    correct + wrong > 0 ? (correct / (correct + wrong)) * 100 : 0
  const accuracy = Number(attempt?.accuracy ?? computedAccuracy)

  return {
    attemptId: getPublicResponseId(dbHelpers, 'attempts', attempt, attempt?._id || attempt?.id || null),
    testId: getPublicResponseId(dbHelpers, 'tests', test, attempt?.testId || test?._id || test?.id || testIdFallback),
    testSeriesId: getTestSeriesId(attempt) || getTestSeriesId(test),
    seriesId: getTestSeriesId(attempt) || getTestSeriesId(test),
    testTitle: attempt?.testTitle || test?.title || null,
    score: Number(attempt?.score ?? 0),
    totalMarks: Number(attempt?.totalMarks ?? test?.totalMarks ?? 0),
    totalQuestions,
    correct,
    wrong,
    unattempted,
    accuracy: Number.isFinite(accuracy) ? accuracy : 0,
    timeSpent: Number(attempt?.timeSpent ?? 0),
    totalTime: Number(test?.duration ?? attempt?.duration ?? 60) * 60,
    rank: rankData?.rank || attempt?.rank || null,
    totalParticipants: Number(rankData?.totalParticipants || attempt?.totalParticipants || 0),
    percentile: Number(rankData?.percentile || attempt?.percentile || 0),
    sectionTimers: attempt?.sectionTimers || {},
    currentSection: attempt?.currentSection || null,
    questions: questionsWithAnswers,
    answers: Array.isArray(attempt?.answers)
      ? attempt.answers.map((entry) => ({
          ...entry,
          questionId: questionIdMap.get(String(entry?.questionId)) ?? entry?.questionId
        }))
      : [],
    submittedAt: attempt?.submittedAt || attempt?.createdAt || null,
  }
}

// @route   GET /api/tests
// @desc    Get all active AND published tests
// @access  Public
router.get('/', async (req, res) => {
  try {
    const allTests = await dbHelpers.find('tests', { isActive: true })
    const publishedTests = allTests.filter(test => 
      test.status === 'published' || test.isActive === true
    )
    const testsWithBanners = await enrichTestsWithBannerAssets(publishedTests)
    res.json({
      success: true,
      count: testsWithBanners.length,
      data: testsWithBanners
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

// @route   GET /api/tests/series/:seriesId
// @desc    Get published tests by series ID
// @access  Public
router.get('/series/:seriesId', async (req, res) => {
  try {
    const { seriesId } = req.params
    const series = await findSeriesByIdentifier(seriesId)
    const resolvedSeriesId = getInternalId(series) ?? seriesId
    const allTests = await dbHelpers.find('tests', { isActive: true })

    const filteredTests = allTests.filter(test =>
      (idsMatch(test.seriesId, resolvedSeriesId) || idsMatch(test.series_id, resolvedSeriesId)) &&
      (test.status === 'published' || test.isActive === true)
    )

    const enrichedTests = await enrichTestsWithBannerAssets(filteredTests)

    res.json({
      success: true,
      count: enrichedTests.length,
      data: enrichedTests
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

// @route   GET /api/tests/tag/:tag
// @desc    Get tests by tag (live-tests, pyps, quizzes, practice)
// @access  Public
router.get('/tag/:tag', async (req, res) => {
  try {
    const { tag } = req.params

    if (tag === 'quizzes') {
      return res.json({
        success: true,
        count: 0,
        data: [],
        message: 'Use /api/quizzes endpoint for quiz content',
      })
    }

    let query = { isActive: true }

    if (isPypSlug(tag)) {
      query.category = 'PYPs'
    } else {
      switch (tag) {
        case 'live-tests':
          query.isLive = true
          break
        case 'practice':
          query.category = 'Practice'
          break
        default:
          query.tags = { $regex: tag, $options: 'i' }
      }
    }

    const allTests = await dbHelpers.find('tests', { isActive: true })
    let filteredTests = allTests

    if (isPypSlug(tag)) {
      filteredTests = allTests.filter((test) => test.category === 'PYPs')
    } else {
      switch (tag) {
        case 'live-tests':
          filteredTests = allTests.filter((test) => test.isLive === true)
          break
        case 'practice':
          filteredTests = allTests.filter((test) => test.category === 'Practice')
          break
        default:
          filteredTests = allTests.filter(
            (test) =>
              Array.isArray(test.tags) &&
              test.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
          )
      }
    }

    const testSeries = await dbHelpers.find('testSeries')
    const seriesMap = {}
    testSeries.forEach((series) => {
      const seriesKey = series._id || series.id
      seriesMap[seriesKey] = series
      if (series.id !== undefined) seriesMap[String(series.id)] = series
      if (series._id !== undefined) seriesMap[String(series._id)] = series
    })

    const testsWithSeries = filteredTests.map((test) => ({
      ...test,
      testSeriesId: getPublicResponseId(
        dbHelpers,
        'testSeries',
        seriesMap[getTestSeriesId(test)],
        getTestSeriesId(test)
      ),
      seriesId: getPublicResponseId(
        dbHelpers,
        'testSeries',
        seriesMap[getTestSeriesId(test)],
        getTestSeriesId(test)
      )
    }))

    const enrichedTests = await enrichTestsWithBannerAssets(testsWithSeries)

    res.json({
      success: true,
      count: enrichedTests.length,
      data: enrichedTests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

// @route   GET /api/tests/:testId
// @desc    Get test details
// @access  Public
router.get('/:testId', optionalAuth, async (req, res) => {
  try {
    const test = await findTestByIdentifier(req.params.testId, dbHelpers)

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found',
      })
    }

    let hasAccess = !isProRestrictedTest(test)
    if (req.user && isProUser(req.user)) {
      hasAccess = true
    }

    const series = await findSeriesByIdentifier(test.seriesId || test.series_id)

    const [enrichedTest] = await enrichTestsWithBannerAssets([test])

    res.json({
      success: true,
      data: {
        ...enrichedTest,
        testSeriesId: getPublicResponseId(dbHelpers, 'testSeries', series, getTestSeriesId(test)),
        seriesId: getPublicResponseId(dbHelpers, 'testSeries', series, getTestSeriesId(test)),
        hasAccess,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

// @route   GET /api/tests/:testId/questions
// @desc    Get test questions (for taking test)
// @access  Private
router.get('/:testId/questions', protect, async (req, res) => {
  try {
    const test = await findTestByIdentifier(req.params.testId, dbHelpers)

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found',
      })
    }

    if (isProRestrictedTest(test) && !isProUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Pro Pass required for this test',
      })
    }

    const rawQuestions = await fetchTestQuestions(test)
    const questions = rawQuestions
      .map(sanitizeQuestionForAttempt)
      .sort((a, b) => {
        const left = Number(a.questionNumber ?? a.question_number ?? 0)
        const right = Number(b.questionNumber ?? b.question_number ?? 0)
        return left - right
      })

    const questionsWithAssets = await enrichQuestionsWithImageAssets(questions)

    res.json({
      success: true,
      count: questionsWithAssets.length,
      data: questionsWithAssets,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

// @route   POST /api/tests/:testId/start
// @desc    Start a test attempt
// @access  Private
router.post('/:testId/start', protect, async (req, res) => {
  try {
    const test = await findTestByIdentifier(req.params.testId, dbHelpers)

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found',
      })
    }

    if (isProRestrictedTest(test) && !isProUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Pro Pass required for this test',
      })
    }

    const existingAttempts = await dbHelpers.find('attempts', {
      userId: req.user.id,
      isCompleted: false
    })
    
    // Find the in-progress attempt for this specific test
    let attempt = existingAttempts.find(a => 
      (idsMatch(a.testId, test._id || test.id) || idsMatch(a.test_id, test._id || test.id)) && 
      !a.isCompleted
    )

    if (!attempt) {
      // Check attempt limits for non-pro users
      const allUserAttempts = await dbHelpers.find('attempts', { userId: req.user.id })
      const limitCheck = checkAttemptLimit(req.user, allUserAttempts, test)
      
      if (limitCheck.hasReached) {
        return res.status(403).json({
          success: false,
          message: limitCheck.message,
          limitReached: true
        })
      }

      attempt = await dbHelpers.insertOne('attempts', {
        userId: req.user.id,
        testId: test._id || test.id,
        seriesId: test.seriesId || test.series_id,
        status: 'in_progress',
        startTime: new Date().toISOString(),
        duration: test.duration,
        answers: [],
        markedForReview: [],
        sectionTimers: {},
        currentSection: null,
        timeSpent: 0,
        isCompleted: false,
        createdAt: new Date().toISOString()
      })

      await publishEvent('test_started', {
        source: 'tests',
        userId: req.user.id,
        testId: test._id || test.id,
        attemptId: attempt._id || attempt.id
      })
    }

    res.json({
      success: true,
      data: {
        attemptId: getPublicResponseId(dbHelpers, 'attempts', attempt, attempt._id || attempt.id),
        testId: getPublicResponseId(dbHelpers, 'tests', test, test._id || test.id),
        startTime: attempt.startTime,
        duration: test.duration,
        timeSpent: attempt.timeSpent || 0,
        answers: attempt.answers || [],
        markedForReview: attempt.markedForReview || [],
        sectionTimers: attempt.sectionTimers || {},
        currentSection: attempt.currentSection || null,
        questions: test.totalQuestions,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})


// @route   PUT /api/tests/:testId/autosave
// @desc    Autosave test attempt
// @access  Private
router.put('/:testId/autosave', protect, async (req, res) => {
  try {
    const { attemptId, answers, timeSpent, markedForReview, sectionTimers, currentSection } = req.body
    if (!attemptId) {
      return res.status(400).json({ success: false, message: 'Attempt ID required' })
    }

    const attempt = await findAttemptByIdentifier(attemptId)
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' })
    }

    const internalAttemptId = getInternalId(attempt)

    if (!idsMatch(attempt.userId, req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' })
    }

    // Only update if not already completed
    if (attempt.isCompleted) {
      return res.status(400).json({ success: false, message: 'Test already submitted' })
    }

    const normalizedAnswers = await normalizeSubmittedAnswers(answers)

    const updated = await dbHelpers.updateById('attempts', internalAttemptId, {
      answers: normalizedAnswers,
      timeSpent: Number(timeSpent || 0),
      markedForReview: Array.isArray(markedForReview) ? markedForReview : [],
      sectionTimers: sectionTimers && typeof sectionTimers === 'object' ? sectionTimers : {},
      currentSection: typeof currentSection === 'string' ? currentSection : null,
      updatedAt: new Date().toISOString()
    })

    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   PUT /api/tests/:testId/submit
// @desc    Submit test answers
// @access  Private
router.put('/:testId/submit', protect, async (req, res) => {
  try {
    const { answers, timeSpent, attemptId, markedForReview, sectionTimers, currentSection } = req.body
    

    const test = await findTestByIdentifier(req.params.testId, dbHelpers)
    

    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found',
      })
    }

    if (isProRestrictedTest(test) && !isProUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Pro Pass required for this test',
      })
    }

    const questions = await fetchTestQuestions(test)
    const submittedAnswers = await normalizeSubmittedAnswers(answers)

    let correct = 0
    let wrong = 0
    let unattempted = 0

    const totalQuestions = Number(test.totalQuestions ?? questions.length ?? 0) || questions.length
    const totalMarks = Number(test.totalMarks ?? totalQuestions * 1)
    const marksPerQuestion = totalQuestions > 0 ? totalMarks / totalQuestions : 0
    const negativeMarks = Number(test.negativeMarking ?? test.negativeMarks ?? 0)

    questions.forEach((question) => {
      const answer = submittedAnswers.find((entry) => idsMatch(entry?.questionId, getQuestionId(question)))
      const selectedOption = normalizeOptionIndex(answer?.selectedOption)
      const correctOption = normalizeOptionIndex(getCorrectOption(question))

      if (selectedOption === null) {
        unattempted++
      } else if (selectedOption === correctOption) {
        correct++
      } else {
        wrong++
      }
    })

    const score = (correct * marksPerQuestion) - (wrong * negativeMarks)
    const accuracy = correct + wrong > 0 ? (correct / (correct + wrong)) * 100 : 0

    const attemptData = {
      userId: req.user.id,
      testId: test._id || test.id,
      testTitle: test.title || null,
      seriesId: test.seriesId || test.series_id,
      totalQuestions,
      score: Math.max(0, score),
      totalMarks,
      correct,
      wrong,
      unattempted,
      accuracy: Number(accuracy.toFixed(1)),
      timeSpent: Number(timeSpent ?? 0),
      answers: submittedAnswers,
      markedForReview: Array.isArray(markedForReview) ? markedForReview : [],
      sectionTimers: sectionTimers && typeof sectionTimers === 'object' ? sectionTimers : {},
      currentSection: typeof currentSection === 'string' ? currentSection : null,
      status: 'completed',
      isCompleted: true,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    let result

    if (attemptId) {
      const existingAttempt = await findAttemptByIdentifier(attemptId)
      if (!existingAttempt) {
        return res.status(404).json({
          success: false,
          message: 'Attempt not found',
        })
      }
      if (!idsMatch(existingAttempt.userId, req.user.id) && req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to submit this attempt',
        })
      }
      if (!idsMatch(existingAttempt.testId, test._id || test.id)) {
        return res.status(400).json({
          success: false,
          message: 'Attempt does not belong to this test',
        })
      }
      const existingSectionTimers = existingAttempt.sectionTimers || {}
      result = await dbHelpers.updateById('attempts', getInternalId(existingAttempt), {
        ...attemptData,
        sectionTimers: Object.keys(attemptData.sectionTimers).length > 0 ? attemptData.sectionTimers : existingSectionTimers
      })

    } else {
      result = await dbHelpers.insertOne('attempts', attemptData)

    }

    await publishEvent('test_submitted', {
      source: 'tests',
      userId: req.user.id,
      testId: test._id || test.id,
      attemptId: result?._id || result?.id || attemptId || null,
      score: attemptData.score,
      totalMarks: attemptData.totalMarks
    })

    // Synchronous fallback so analytics/learning/recommendations work even when queue is disabled.
    try {
      const resolvedAttemptId = result?._id || result?.id || attemptId || null
      await Promise.allSettled([
        analyticsService.processTestSubmissionAnalytics({
          userId: req.user.id,
          testId: test._id || test.id,
          attemptId: resolvedAttemptId,
        }),
        leaderboardService.recalculateLeaderboards({ testId: test._id || test.id }),
        recommendationService.refreshRecommendationsFromEvent({
          userId: req.user.id,
          testId: test._id || test.id,
        }),
        notificationService.dispatchNotification(req.user.id, {
          title: 'Test result available',
          message: `Your result for ${test.title || 'test'} is now available.`,
          type: 'result_declared',
          metadata: { testId: test._id || test.id, attemptId: resolvedAttemptId },
        }),
      ])
    } catch (backgroundError) {
      console.warn('[tests.submit] Background post-submit processing failed:', backgroundError.message)
    }

    res.json({
      success: true,
      data: {
        attemptId: getPublicResponseId(dbHelpers, 'attempts', result, attemptId || result?._id || result?.id || null),
        ...attemptData,
        rank: null
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

// @route   GET /api/tests/:testId/result/:attemptId
// @desc    Get test result by attempt ID
// @access  Private
router.get('/:testId/result/:attemptId', protect, async (req, res) => {
  try {
    const attempt = await findAttemptByIdentifier(req.params.attemptId)

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Attempt not found'
      })
    }

    if (!idsMatch(attempt.userId, req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this attempt'
      })
    }

    // Resolve the test from URL param (could be numeric ID, _id, or slug)
    const testFromUrl = await findTestByIdentifier(req.params.testId, dbHelpers)
    
    // Compare attempt's testId with the resolved test's ID
    // The attempt.testId is numeric, so we need to compare with test.id or test._id
    const resolvedTestId = testFromUrl ? (testFromUrl.id || testFromUrl._id) : req.params.testId
    
    if (!idsMatch(attempt.testId, resolvedTestId) && !idsMatch(attempt.testId, req.params.testId)) {
      // Also try direct comparison in case testFromUrl is null but IDs match directly
      return res.status(400).json({
        success: false,
        message: 'Attempt does not belong to this test'
      })
    }

    const test = testFromUrl || (await findTestByIdentifier(attempt.testId, dbHelpers))

    const questions = await fetchTestQuestions(test)

    const rankData = await getRankAndPercentile(resolvedTestId || test._id || test.id || req.params.testId, attempt)
    const result = buildResultPayload(test, attempt, questions, req.params.testId, rankData)
    const series = await findSeriesByIdentifier(test.seriesId || test.series_id)
    result.seriesId = getPublicResponseId(dbHelpers, 'testSeries', series, result.seriesId)

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

// @route   GET /api/tests/:testId/result
// @desc    Get latest test result for current user
// @access  Private
router.get('/:testId/result', protect, async (req, res) => {
  try {
    // Resolve the test from URL param (could be numeric ID, _id, or slug)
    const test = await findTestByIdentifier(req.params.testId, dbHelpers)
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found',
      })
    }

    // Get the numeric test ID for matching with attempts
    const numericTestId = test.id || test._id

    const resultRows = await dbHelpers.find('results', {
      userId: req.user.id,
      isCompleted: true
    })
    // Match against both the URL param and the resolved numeric ID
    const matchingResults = resultRows.filter((row) => 
      idsMatch(row.testId, req.params.testId) || idsMatch(row.testId, numericTestId)
    )

    const attemptRows = await dbHelpers.find('attempts', {
      userId: req.user.id,
      isCompleted: true
    })
    // Match against both the URL param and the resolved numeric ID
    const matchingAttempts = attemptRows.filter((row) => 
      idsMatch(row.testId, req.params.testId) || idsMatch(row.testId, numericTestId)
    )

    const combined = [...matchingResults, ...matchingAttempts].sort(
      (a, b) => new Date(b.submittedAt || b.createdAt || 0) - new Date(a.submittedAt || a.createdAt || 0)
    )
    const attempt = combined[0]

    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'No completed attempt found for this test'
      })
    }

    const questions = await fetchTestQuestions(test)
    const rankData = await getRankAndPercentile(numericTestId || test._id || test.id || req.params.testId, attempt)
    const result = buildResultPayload(test, attempt, questions, req.params.testId, rankData)
    const series = await findSeriesByIdentifier(test.seriesId || test.series_id)
    result.seriesId = getPublicResponseId(dbHelpers, 'testSeries', series, result.seriesId)

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

export default router

