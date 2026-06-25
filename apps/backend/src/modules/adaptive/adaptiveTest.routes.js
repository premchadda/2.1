import express from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import adaptiveTestService from './adaptiveTest.service.js'

const router = express.Router()

router.post('/session', protect, async (req, res) => {
  try {
    const { totalQuestions, startingDifficulty, testId } = req.body
    const session = await adaptiveTestService.createSession(req.user.id, {
      totalQuestions: parseInt(totalQuestions) || 30,
      startingDifficulty: startingDifficulty || 'medium',
      testId,
    })
    res.status(201).json({ success: true, data: session })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.get('/session/:sessionId/next', protect, async (req, res) => {
  try {
    const question = await adaptiveTestService.getNextQuestion(
      req.params.sessionId,
      req.user.id
    )
    if (!question) {
      return res.json({
        success: true,
        data: null,
        message: 'No more questions available'
      })
    }
    res.json({ success: true, data: question })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/session/:sessionId/answer', protect, async (req, res) => {
  try {
    const { questionId, selectedOption, timeSpent } = req.body
    const result = await adaptiveTestService.submitAnswer(
      req.params.sessionId,
      req.user.id,
      questionId,
      parseInt(selectedOption),
      parseInt(timeSpent) || 0
    )
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/session/:sessionId/complete', protect, async (req, res) => {
  try {
    const result = await adaptiveTestService.completeSession(
      req.params.sessionId,
      req.user.id
    )
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.get('/history', protect, async (req, res) => {
  try {
    const { limit } = req.query
    const history = await adaptiveTestService.getHistory(req.user.id, {
      limit: parseInt(limit) || 20,
    })
    res.json({ success: true, data: history })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
