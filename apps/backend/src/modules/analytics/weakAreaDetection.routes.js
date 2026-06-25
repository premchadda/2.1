import express from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import weakAreaDetectionService from './weakAreaDetection.service.js'

const router = express.Router()

router.get('/weak-topics', protect, async (req, res) => {
  try {
    const { limit, minAttempts } = req.query
    const topics = await weakAreaDetectionService.getWeakTopics(req.user.id, {
      limit: parseInt(limit) || 10,
      minAttempts: parseInt(minAttempts) || 5,
    })
    res.json({ success: true, data: topics })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/weak-subjects', protect, async (req, res) => {
  try {
    const subjects = await weakAreaDetectionService.getWeakSubjects(req.user.id)
    res.json({ success: true, data: subjects })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/difficulty-performance', protect, async (req, res) => {
  try {
    const performance = await weakAreaDetectionService.getPerformanceByDifficulty(req.user.id)
    res.json({ success: true, data: performance })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/trends', protect, async (req, res) => {
  try {
    const { days } = req.query
    const trends = await weakAreaDetectionService.getPerformanceTrends(req.user.id, {
      days: parseInt(days) || 30,
    })
    res.json({ success: true, data: trends })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/full-analysis', protect, async (req, res) => {
  try {
    const analysis = await weakAreaDetectionService.getFullAnalysis(req.user.id)
    res.json({ success: true, data: analysis })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/peer-comparison', protect, async (req, res) => {
  try {
    const { topicId } = req.query
    const comparison = await weakAreaDetectionService.getPeerComparison(req.user.id, topicId)
    res.json({ success: true, data: comparison })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
