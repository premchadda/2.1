import express from 'express'
import { protect, admin } from '../../middleware/auth.middleware.js'
import liveMockService from './liveMock.service.js'

const router = express.Router()

router.get('/upcoming', async (req, res) => {
  try {
    const { limit } = req.query
    const tests = await liveMockService.getUpcoming(parseInt(limit) || 20)
    res.json({ success: true, data: tests })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/active', async (req, res) => {
  try {
    const test = await liveMockService.getActive()
    res.json({ success: true, data: test })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
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
    res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/', protect, admin, async (req, res) => {
  try {
    const session = await liveMockService.createSession(req.body)
    res.status(201).json({ success: true, data: session })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/:id/register', protect, async (req, res) => {
  try {
    const result = await liveMockService.register(req.user.id, req.params.id)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/:id/start', protect, async (req, res) => {
  try {
    const result = await liveMockService.startAttempt(req.user.id, req.params.id)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/:id/submit', protect, async (req, res) => {
  try {
    const { answers } = req.body
    const result = await liveMockService.submitAttempt(req.user.id, req.params.id, answers)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.get('/:id/leaderboard', async (req, res) => {
  try {
    const leaderboard = await liveMockService.getLeaderboard(req.params.id)
    res.json({ success: true, data: leaderboard })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/:id/results', protect, async (req, res) => {
  try {
    const results = await liveMockService.getResults(req.user.id, req.params.id)
    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
