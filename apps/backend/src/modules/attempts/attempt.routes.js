import express from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { findEntityByIdentifier, getInternalId } from '../../shared/utils/identifier-utils.js'
import { buildPublicIdLookup, getPublicResponseId, mapLookupId } from '../../shared/utils/public-id-response.js'

const router = express.Router()

const ATTEMPT_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  PAUSED: 'PAUSED',
  SUBMITTED: 'SUBMITTED',
  EXPIRED: 'EXPIRED'
}

const EVENT_TYPES = {
  START: 'start',
  PAUSE: 'pause',
  RESUME: 'resume',
  QUESTION_CHANGE: 'question_change',
  ANSWER_SELECT: 'answer_select',
  SAVE_PROGRESS: 'save_progress',
  SUBMIT: 'submit',
  TAB_SWITCH: 'tab_switch',
  WINDOW_BLUR: 'window_blur',
  REFRESH: 'refresh',
  INACTIVITY: 'inactivity'
}

// Helper to log attempt event
async function logAttemptEvent(attemptId, eventType, questionId = null, eventData = {}) {
  try {
    await global.dbHelpers.insertOne('attemptEvents', {
      attemptId,
      eventType,
      questionId,
      eventData: JSON.stringify(eventData),
      eventTimestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Attempt Events] Failed to log event:', error.message)
  }
}

const findAttemptByIdentifier = (attemptId) =>
  findEntityByIdentifier(global.dbHelpers, 'attempts', attemptId)

const findTestRecordByIdentifier = (testId) =>
  findEntityByIdentifier(global.dbHelpers, 'tests', testId, { slugFields: ['slug'] })

const findSeriesByIdentifier = (seriesId) =>
  findEntityByIdentifier(global.dbHelpers, 'testSeries', seriesId, { slugFields: ['slug'] })

const findQuestionByIdentifier = (questionId) =>
  findEntityByIdentifier(global.dbHelpers, 'questions', questionId)

const normalizeAttemptAnswers = async (answers) => {
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

const normalizeQuestionTimers = async (questionTimers) => {
  if (!Array.isArray(questionTimers)) {
    return []
  }

  const cache = new Map()

  return Promise.all(
    questionTimers.map(async (entry) => {
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

// @route   POST /api/attempt/start
// @desc    Start a new test attempt
// @access  Private
router.post('/start', protect, async (req, res) => {
  try {
    const { testId } = req.body
    const seriesId = req.body.testSeriesId || req.body.test_series_id || req.body.seriesId || req.body.series_id
    const userId = req.user.id

    if (!testId) {
      return res.status(400).json({ success: false, message: 'Test ID is required' })
    }

    const test = await findTestRecordByIdentifier(testId)
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' })
    }

    const internalTestId = getInternalId(test)
    const series = seriesId ? await findSeriesByIdentifier(seriesId) : null
    const internalSeriesId = getInternalId(series) ?? test.seriesId ?? test.series_id

    // Check for existing in-progress or paused attempt
    const existingAttempts = await global.dbHelpers.find('attempts', {
      userId,
      testId: internalTestId
    })

    const activeAttempt = existingAttempts.find(a => 
      a.status === ATTEMPT_STATUS.IN_PROGRESS || a.status === ATTEMPT_STATUS.PAUSED
    )

    if (activeAttempt) {
      // Return existing attempt
      return res.json({
        success: true,
        data: {
          attemptId: getPublicResponseId(global.dbHelpers, 'attempts', activeAttempt, activeAttempt.id),
          status: activeAttempt.status,
          remainingTime: activeAttempt.remainingTimeSeconds || activeAttempt.duration * 60,
          lastQuestionIndex: activeAttempt.lastQuestionIndex || 0
        },
        message: 'Resuming existing attempt'
      })
    }

    // Create new attempt
    const duration = test.duration || 60
    const attempt = await global.dbHelpers.insertOne('attempts', {
      userId,
      testId: internalTestId,
      seriesId: internalSeriesId,
      status: ATTEMPT_STATUS.IN_PROGRESS,
      startTime: new Date().toISOString(),
      remainingTimeSeconds: duration * 60,
      totalTimeSpent: 0,
      isCompleted: false,
      totalQuestions: test.questions || 0,
      lastActivityAt: new Date().toISOString()
    })

    // Log event
    await logAttemptEvent(attempt.id, EVENT_TYPES.START)

    res.json({
      success: true,
      data: {
        attemptId: getPublicResponseId(global.dbHelpers, 'attempts', attempt, attempt.id),
        status: ATTEMPT_STATUS.IN_PROGRESS,
        remainingTime: attempt.remainingTimeSeconds,
        totalTime: duration * 60
      }
    })
  } catch (error) {
    console.error('[Attempt Start] Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/attempt/pause
// @desc    Pause an active test attempt
// @access  Private
router.post('/pause', protect, async (req, res) => {
  try {
    const { attemptId, remainingTime, currentQuestionIndex, questionTimers } = req.body
    const userId = req.user.id

    if (!attemptId) {
      return res.status(400).json({ success: false, message: 'Attempt ID is required' })
    }

    // Verify ownership
    const attempt = await findAttemptByIdentifier(attemptId)
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' })
    }

    const internalAttemptId = getInternalId(attempt)

    if (String(attempt.userId) !== String(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' })
    }

    // Update attempt with paused state
    const updated = await global.dbHelpers.updateById('attempts', internalAttemptId, {
      status: ATTEMPT_STATUS.PAUSED,
      pausedAt: new Date().toISOString(),
      remainingTimeSeconds: remainingTime,
      lastActivityAt: new Date().toISOString()
    })

    // Save question attempts with current timers
    const normalizedQuestionTimers = await normalizeQuestionTimers(questionTimers)

    if (normalizedQuestionTimers.length > 0) {
      for (const qt of normalizedQuestionTimers) {
        await global.dbHelpers.insertOne('questionAttempts', {
          attemptId: internalAttemptId,
          questionId: qt.questionId,
          timeSpentSeconds: qt.timeSpent || 0,
          visitsCount: qt.visits || 1,
          lastViewedAt: new Date().toISOString()
        }, true) // upsert
      }
    }

    // Log pause event
    await logAttemptEvent(internalAttemptId, EVENT_TYPES.PAUSE, currentQuestionIndex, { remainingTime })

    res.json({
      success: true,
      data: {
        attemptId: getPublicResponseId(global.dbHelpers, 'attempts', updated, updated.id),
        status: ATTEMPT_STATUS.PAUSED,
        pausedAt: updated.pausedAt
      }
    })
  } catch (error) {
    console.error('[Attempt Pause] Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/attempt/resume
// @desc    Resume a paused test attempt
// @access  Private
router.post('/resume', protect, async (req, res) => {
  try {
    const { attemptId } = req.body
    const userId = req.user.id

    if (!attemptId) {
      return res.status(400).json({ success: false, message: 'Attempt ID is required' })
    }

    // Verify ownership
    const attempt = await findAttemptByIdentifier(attemptId)
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' })
    }

    const internalAttemptId = getInternalId(attempt)

    if (String(attempt.userId) !== String(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' })
    }

    if (attempt.status !== ATTEMPT_STATUS.PAUSED) {
      return res.status(400).json({ success: false, message: 'Attempt is not paused' })
    }

    // Calculate additional time spent during pause
    const pauseDuration = attempt.pausedAt ? 
      Math.floor((new Date() - new Date(attempt.pausedAt)) / 1000) : 0

    // Update attempt with resumed state
    const updated = await global.dbHelpers.updateById('attempts', internalAttemptId, {
      status: ATTEMPT_STATUS.IN_PROGRESS,
      resumedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    })

    // Get question attempts for this attempt
    const questionAttempts = await global.dbHelpers.find('questionAttempts', { attemptId: internalAttemptId })
    const questionIdLookup = await buildPublicIdLookup(
      global.dbHelpers,
      'questions',
      questionAttempts.map((entry) => entry.questionId)
    )
    const serializedQuestionAttempts = questionAttempts.map((entry) => ({
      ...entry,
      questionId: mapLookupId(entry.questionId, questionIdLookup, entry.questionId)
    }))
    const parsedAnswers = attempt.answers ? JSON.parse(attempt.answers) : []
    const serializedAnswers = Array.isArray(parsedAnswers)
      ? parsedAnswers.map((entry) => ({
          ...entry,
          questionId: mapLookupId(entry?.questionId, questionIdLookup, entry?.questionId)
        }))
      : []

    // Log resume event
    await logAttemptEvent(internalAttemptId, EVENT_TYPES.RESUME, null, {
      pauseDuration,
      questionCount: questionAttempts.length 
    })

    res.json({
      success: true,
      data: {
        attemptId: getPublicResponseId(global.dbHelpers, 'attempts', updated, updated.id),
        status: ATTEMPT_STATUS.IN_PROGRESS,
        remainingTime: updated.remainingTimeSeconds,
        questionAttempts: serializedQuestionAttempts
      }
    })
  } catch (error) {
    console.error('[Attempt Resume] Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/attempt/save-progress
// @desc    Save attempt progress (auto-save or manual)
// @access  Private
router.post('/save-progress', protect, async (req, res) => {
  try {
    const { 
      attemptId, 
      answers, 
      remainingTime, 
      currentQuestionIndex,
      questionTimers,
      markedForReview 
    } = req.body
    const userId = req.user.id

    if (!attemptId) {
      return res.status(400).json({ success: false, message: 'Attempt ID is required' })
    }

    // Verify ownership
    const attempt = await findAttemptByIdentifier(attemptId)
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' })
    }

    const internalAttemptId = getInternalId(attempt)

    if (String(attempt.userId) !== String(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' })
    }

    // Calculate total time spent
    const previousTimeSpent = attempt.totalTimeSpent || 0
    const timeSinceLastActivity = attempt.lastActivityAt ?
      Math.floor((new Date() - new Date(attempt.lastActivityAt)) / 1000) : 0

    // Update attempt
    const normalizedAnswers = await normalizeAttemptAnswers(answers)
    const normalizedQuestionTimers = await normalizeQuestionTimers(questionTimers)

    const updateData = {
      answers: JSON.stringify(normalizedAnswers),
      remainingTimeSeconds: remainingTime,
      totalTimeSpent: previousTimeSpent + timeSinceLastActivity,
      markedForReview: JSON.stringify(markedForReview || []),
      lastActivityAt: new Date().toISOString()
    }

    const updated = await global.dbHelpers.updateById('attempts', internalAttemptId, updateData)

    // Save question-level time tracking
    if (normalizedQuestionTimers.length > 0) {
      for (const qt of normalizedQuestionTimers) {
        const existing = await global.dbHelpers.find('questionAttempts', { 
          attemptId: internalAttemptId,
          questionId: qt.questionId 
        })

        if (existing.length > 0) {
          // Update existing
          const qa = existing[0]
          await global.dbHelpers.updateById('questionAttempts', qa.id, {
            selectedOption: qt.selectedOption,
            isMarkedForReview: qt.isMarked || false,
            timeSpentSeconds: (qa.timeSpentSeconds || 0) + (qt.timeSpentDelta || 0),
            visitsCount: (qa.visitsCount || 0) + (qt.newVisit ? 1 : 0),
            lastViewedAt: new Date().toISOString()
          })
        } else {
          // Insert new
          await global.dbHelpers.insertOne('questionAttempts', {
            attemptId: internalAttemptId,
            questionId: qt.questionId,
            selectedOption: qt.selectedOption,
            isMarkedForReview: qt.isMarked || false,
            timeSpentSeconds: qt.timeSpent || 0,
            visitsCount: 1,
            lastViewedAt: new Date().toISOString()
          })
        }
      }
    }

    // Log save event (less verbose)
    await logAttemptEvent(internalAttemptId, EVENT_TYPES.SAVE_PROGRESS, currentQuestionIndex, {
      answersCount: answers?.length || 0,
      remainingTime
    })

    res.json({
      success: true,
      data: {
        attemptId: getPublicResponseId(global.dbHelpers, 'attempts', updated, updated.id),
        savedAt: updated.lastActivityAt,
        remainingTime: updated.remainingTimeSeconds
      }
    })
  } catch (error) {
    console.error('[Attempt Save Progress] Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/attempt/:attemptId/state
// @desc    Get current attempt state for restoration
// @access  Private
router.get('/:attemptId/state', protect, async (req, res) => {
  try {
    const { attemptId } = req.params
    const userId = req.user.id

    // Verify ownership
    const attempt = await findAttemptByIdentifier(attemptId)
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' })
    }

    const internalAttemptId = getInternalId(attempt)

    if (String(attempt.userId) !== String(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' })
    }

    if (attempt.status === ATTEMPT_STATUS.SUBMITTED) {
      return res.status(400).json({ success: false, message: 'Attempt already submitted' })
    }

    // Get question attempts
    const questionAttempts = await global.dbHelpers.find('questionAttempts', { attemptId: internalAttemptId })
    const questionIdLookup = await buildPublicIdLookup(
      global.dbHelpers,
      'questions',
      questionAttempts.map((entry) => entry.questionId)
    )
    const serializedQuestionAttempts = questionAttempts.map((entry) => ({
      ...entry,
      questionId: mapLookupId(entry.questionId, questionIdLookup, entry.questionId)
    }))

    const serializedAnswers = questionAttempts.reduce((acc, entry) => {
      if (entry.selectedOption) {
        acc[entry.questionId] = entry.selectedOption
      }
      return acc
    }, {})

    // Get test details
    const test = await global.dbHelpers.findById('tests', attempt.testId)

    // Get recent events for anti-cheat
    const recentEvents = await global.dbHelpers.find('attempt_events', { attemptId: internalAttemptId })
    const suspiciousEvents = recentEvents.filter(e => 
      e.eventType === EVENT_TYPES.TAB_SWITCH || 
      e.eventType === EVENT_TYPES.WINDOW_BLUR
    )

    res.json({
      success: true,
      data: {
        attemptId: getPublicResponseId(global.dbHelpers, 'attempts', attempt, attempt.id),
        status: attempt.status,
        testId: getPublicResponseId(global.dbHelpers, 'tests', test, attempt.testId),
        testTitle: test?.title,
        remainingTime: attempt.remainingTimeSeconds,
        totalTimeSpent: attempt.totalTimeSpent,
        answers: serializedAnswers,
        markedForReview: attempt.markedForReview ? JSON.parse(attempt.markedForReview) : [],
        questionAttempts: serializedQuestionAttempts,
        startedAt: attempt.startTime,
        pausedAt: attempt.pausedAt,
        lastActivityAt: attempt.lastActivityAt,
        suspiciousActivity: suspiciousEvents.length > 5,
        tabSwitchCount: suspiciousEvents.length
      }
    })
  } catch (error) {
    console.error('[Attempt Get State] Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/attempt/:attemptId/event
// @desc    Log an anti-cheat event
// @access  Private
router.post('/:attemptId/event', protect, async (req, res) => {
  try {
    const { attemptId } = req.params
    const { eventType, questionId, eventData } = req.body

    const userId = req.user.id

    // Verify ownership
    const attempt = await findAttemptByIdentifier(attemptId)
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' })
    }

    const internalAttemptId = getInternalId(attempt)

    if (String(attempt.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Not authorized' })
    }

    // Validate event type
    const validEvents = Object.values(EVENT_TYPES)
    if (!validEvents.includes(eventType)) {
      return res.status(400).json({ success: false, message: 'Invalid event type' })
    }

    // Log the event
    const question = questionId ? await findQuestionByIdentifier(questionId) : null
    await logAttemptEvent(internalAttemptId, eventType, getInternalId(question) ?? questionId, eventData)

    // Update last activity
    await global.dbHelpers.updateById('attempts', internalAttemptId, {
      lastActivityAt: new Date().toISOString()
    })

    res.json({ success: true })
  } catch (error) {
    console.error('[Attempt Event] Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/attempt/:attemptId/analytics
// @desc    Get question-level analytics for an attempt
// @access  Private
router.get('/:attemptId/analytics', protect, async (req, res) => {
  try {
    const { attemptId } = req.params

    // Get attempt details
    const attempt = await findAttemptByIdentifier(attemptId)
    if (!attempt) {
      return res.status(404).json({ success: false, message: 'Attempt not found' })
    }

    const internalAttemptId = getInternalId(attempt)

    // Get question attempts
    const questionAttempts = await global.dbHelpers.find('questionAttempts', { attemptId: internalAttemptId })
    const questionIdLookup = await buildPublicIdLookup(
      global.dbHelpers,
      'questions',
      questionAttempts.map((entry) => entry.questionId)
    )
    const serializedQuestionAttempts = questionAttempts.map((entry) => ({
      ...entry,
      questionId: mapLookupId(entry.questionId, questionIdLookup, entry.questionId)
    }))

    // Calculate analytics
    const totalTime = questionAttempts.reduce((sum, qa) => sum + (qa.timeSpentSeconds || 0), 0)
    const avgTime = questionAttempts.length > 0 ? totalTime / questionAttempts.length : 0
    const maxTime = Math.max(...questionAttempts.map(qa => qa.timeSpentSeconds || 0), 0)
    const minTime = Math.min(...questionAttempts.map(qa => qa.timeSpentSeconds || 0), 0)

    // Sort by time spent
    const sortedByTime = [...questionAttempts].sort((a, b) => 
      (b.timeSpentSeconds || 0) - (a.timeSpentSeconds || 0)
    )

    res.json({
      success: true,
      data: {
        totalQuestions: questionAttempts.length,
        totalTimeSpent: totalTime,
        averageTimePerQuestion: Math.round(avgTime),
        maxTimeOnQuestion: maxTime,
        minTimeOnQuestion: minTime,
        hardestQuestions: sortedByTime.slice(0, 5).map(qa => ({
          questionId: mapLookupId(qa.questionId, questionIdLookup, qa.questionId),
          timeSpent: qa.timeSpentSeconds,
          visits: qa.visitsCount
        })),
        questionAttempts: serializedQuestionAttempts
      }
    })
  } catch (error) {
    console.error('[Attempt Analytics] Error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
