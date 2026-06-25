import express from 'express'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { protect } from '../../middleware/auth.middleware.js'
import { emitDomainEvent } from '../../infrastructure/events/eventBus.js'

const router = express.Router()

const publishEvent = async (eventName, payload) => {
  try {
    await emitDomainEvent(eventName, payload)
  } catch (error) {
    console.error(`[EventBus] Failed to publish "${eventName}":`, error.message)
  }
}

router.get('/', async (req, res) => {
  try {
    const tests = await dbHelpers.find('tests', { isActive: true })
    res.json({
      success: true,
      data: tests,
      count: tests.length
    })
  } catch (error) {
    console.error('Get tests error:', error)
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const test = await dbHelpers.findById('tests', id)
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      })
    }
    
    const questions = await dbHelpers.find('questions', { testId: id, isActive: true })
    
    res.json({
      success: true,
      data: {
        ...test,
        questions: questions
      }
    })
  } catch (error) {
    console.error('Get test by ID error:', error)
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

router.get('/series/:seriesId', async (req, res) => {
  try {
    const { seriesId } = req.params
    const tests = await dbHelpers.find('tests', { seriesId: Number(seriesId), isActive: true })
    
    res.json({
      success: true,
      data: tests,
      count: tests.length
    })
  } catch (error) {
    console.error('Get tests by series error:', error)
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

router.post('/:id/attempt', protect, async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id
    
    const test = await dbHelpers.findById('tests', id)
    if (!test) {
      return res.status(404).json({
        success: false,
        message: 'Test not found'
      })
    }
    
    const attempt = await dbHelpers.insertOne('testAttempts', {
      userId,
      testId: Number(id),
      status: 'in_progress',
      answers: {},
      score: 0,
      totalMarks: 0,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    await publishEvent('test_started', {
      source: 'tests-engine',
      userId,
      testId: Number(id),
      attemptId: attempt.id
    })
    
    res.status(201).json({
      success: true,
      data: attempt
    })
  } catch (error) {
    console.error('Create test attempt error:', error)
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

router.post('/attempts/:id/submit', protect, async (req, res) => {
  try {
    const { id } = req.params
    const { answers, score, totalMarks } = req.body
    
    const attempt = await dbHelpers.findById('testAttempts', id)
    if (!attempt) {
      return res.status(404).json({
        success: false,
        message: 'Attempt not found'
      })
    }

    if (String(attempt.userId) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to submit this attempt'
      })
    }
    
    const updatedAttempt = await dbHelpers.updateById('testAttempts', id, {
      answers,
      score,
      totalMarks,
      status: 'completed',
      submittedAt: new Date(),
      updatedAt: new Date()
    })

    await publishEvent('test_submitted', {
      source: 'tests-engine',
      userId: req.user.id,
      attemptId: Number(id),
      testId: updatedAttempt.test_id || attempt.test_id,
      score,
      totalMarks
    })
    
    res.json({
      success: true,
      data: updatedAttempt
    })
  } catch (error) {
    console.error('Submit test attempt error:', error)
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

router.get('/attempts/user/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params

    if (String(userId) !== String(req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view these attempts'
      })
    }

    const attempts = await dbHelpers.find('testAttempts', { userId: Number(userId), isActive: true })
    
    res.json({
      success: true,
      data: attempts,
      count: attempts.length
    })
  } catch (error) {
    console.error('Get user attempts error:', error)
    res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

export default router