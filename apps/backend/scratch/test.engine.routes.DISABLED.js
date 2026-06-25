// DISABLED — see app-port5001.js line 33-36. Score manipulation concerns.
// This file was disabled because POST /attempts/:id/submit accepted
// client-computed scores and GET /:id returned questions WITH answers.
// Do not import this module until a security review is completed.
import express from 'express'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { protect } from '../../middleware/auth.middleware.js'
import { emitDomainEvent } from '../../infrastructure/events/eventBus.js'
import { validateDomainEvent } from '../../infrastructure/events/eventSchemas.js'

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
    
    const questionsResult = await dbHelpers.query(
      'SELECT q.* FROM questions q JOIN test_questions tq ON q.id = tq.question_id WHERE tq.test_id = $1 AND q.is_active = true',
      [id]
    )
    const questions = (questionsResult?.rows || []).map(r => dbHelpers.toCamel(r))
    
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
  let dbClient = null
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

    dbClient = await dbHelpers.pool.connect()
    await dbClient.query('BEGIN')
    await dbClient.query("SET LOCAL lock_timeout = '5000'")

    // Lock the row in testAttempts (attempts table)
    const table = dbHelpers.getTableName('testAttempts')
    const lockResult = await dbClient.query(
      `SELECT * FROM "${table}" WHERE id = $1 FOR UPDATE`,
      [Number(id)]
    )
    const lockedAttemptRow = lockResult.rows[0]
    if (!lockedAttemptRow) {
      throw new Error('Attempt not found under transactional lock')
    }

    const lockedAttempt = dbHelpers.toCamel(lockedAttemptRow)
    if (lockedAttempt.status === 'completed') {
      await dbClient.query('ROLLBACK')
      dbClient.release()
      dbClient = null
      
      return res.json({
        success: true,
        data: lockedAttempt
      })
    }
    
    const updatedAttempt = await dbHelpers.updateById('testAttempts', id, {
      answers,
      score,
      totalMarks,
      status: 'completed',
      submittedAt: new Date(),
      updatedAt: new Date()
    }, dbClient)

    // Write submission event atomically to transaction outbox_events table
    const eventPayload = {
      source: 'tests-engine',
      userId: req.user.id,
      attemptId: Number(id),
      testId: updatedAttempt.test_id || attempt.test_id,
      score: Number(score),
      totalMarks: Number(totalMarks)
    }

    const validatedEvent = validateDomainEvent('test_submitted', eventPayload)

    await dbClient.query(
      'INSERT INTO outbox_events (event_type, payload, status, event_version) VALUES ($1, $2, $3, $4)',
      [
        validatedEvent.eventType,
        JSON.stringify(validatedEvent.payload),
        'pending',
        validatedEvent.eventVersion
      ]
    )

    await dbClient.query('COMMIT')
    dbClient.release()
    dbClient = null
    
    res.json({
      success: true,
      data: updatedAttempt
    })
  } catch (error) {
    if (dbClient) {
      try {
        await dbClient.query('ROLLBACK')
      } catch (rollbackError) {
        console.error('[ENGINE SUBMIT DEBUG] Rollback failed:', rollbackError.message)
      }
      dbClient.release()
      dbClient = null
    }
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