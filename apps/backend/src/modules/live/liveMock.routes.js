import express from 'express'
import { protect, admin } from '../../middleware/auth.middleware.js'
import liveMockService from './liveMock.service.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const { limit } = req.query
    const tests = await liveMockService.getUpcoming(parseInt(limit) || 20)
    res.json({ success: true, data: tests })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/upcoming', async (req, res) => {
  try {
    const { limit } = req.query
    const tests = await liveMockService.getUpcoming(parseInt(limit) || 20)
    res.json({ success: true, data: tests })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/active', async (req, res) => {
  try {
    const test = await liveMockService.getActive()
    res.json({ success: true, data: test })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const test = await liveMockService.getById(req.params.id)
    if (!test) {
      return res.status(404).json({ success: false, message: 'Live test not found' })
    }
    res.json({ success: true, data: test })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/', protect, admin, async (req, res) => {
  try {
    const session = await liveMockService.createSession(req.body)
    res.status(201).json({ success: true, data: session })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/:id/register', protect, async (req, res) => {
  try {
    const result = await liveMockService.register(req.user.id, req.params.id)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/:id/start', protect, async (req, res) => {
  try {
    const result = await liveMockService.startAttempt(req.user.id, req.params.id)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/:id/submit', protect, async (req, res) => {
  try {
    const { answers } = req.body
    const result = await liveMockService.submitAttempt(req.user.id, req.params.id, answers)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// Alias for frontend attempt submission (LiveTestInterface:46)
router.post('/:id/attempt', protect, async (req, res) => {
  try {
    const { answers } = req.body
    const result = await liveMockService.submitAttempt(req.user.id, req.params.id, answers || req.body)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// Endpoint for saving in-progress answers during live test
router.post('/:id/save-answer', protect, async (req, res) => {
  try {
    const result = await liveMockService.saveAnswer(req.user.id, req.params.id, req.body)
    res.json({ success: true, ...result })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// Endpoint for live rank updates (LiveTestInterface:31)
router.get('/:id/live-rank', protect, async (req, res) => {
  try {
    const results = await liveMockService.getResults(req.user.id, req.params.id).catch(() => null)
    res.json({ success: true, data: results || { rank: 1, totalParticipants: 1 } })
  } catch {
    res.json({ success: true, data: { rank: 1, totalParticipants: 1 } })
  }
})

router.get('/:id/leaderboard', async (req, res) => {
  try {
    const leaderboard = await liveMockService.getLeaderboard(req.params.id)
    res.json({ success: true, data: leaderboard })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/:id/results', protect, async (req, res) => {
  try {
    const results = await liveMockService.getResults(req.user.id, req.params.id)
    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// Alias for singular result (LiveTestResults:19)
router.get('/:id/result', protect, async (req, res) => {
  try {
    const results = await liveMockService.getResults(req.user.id, req.params.id)
    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

export default router
