import express from 'express'
import { protect, admin } from '../../middleware/auth.middleware.js'
import topicAnalyticsService from './topicAnalytics.service.js'

const router = express.Router()

router.get('/:topicId/overview', protect, async (req, res) => {
  try {
    const overview = await topicAnalyticsService.getTopicOverview(req.params.topicId)
    if (!overview) {
      return res.status(404).json({ success: false, message: 'Topic not found' })
    }
    res.json({ success: true, data: overview })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/:topicId/questions', protect, async (req, res) => {
  try {
    const analytics = await topicAnalyticsService.getQuestionAnalytics(req.params.topicId)
    res.json({ success: true, data: analytics })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/:topicId/engagement', protect, async (req, res) => {
  try {
    const engagement = await topicAnalyticsService.getUserEngagement(req.params.topicId)
    res.json({ success: true, data: engagement })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/:topicId/difficulty', protect, async (req, res) => {
  try {
    const distribution = await topicAnalyticsService.getDifficultyDistribution(req.params.topicId)
    res.json({ success: true, data: distribution })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/:topicId/trends', protect, async (req, res) => {
  try {
    const { days } = req.query
    const trends = await topicAnalyticsService.getPerformanceTrends(
      req.params.topicId,
      parseInt(days) || 30
    )
    res.json({ success: true, data: trends })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/:topicId/dashboard', protect, async (req, res) => {
  try {
    const summary = await topicAnalyticsService.getDashboardSummary(req.params.topicId)
    res.json({ success: true, data: summary })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/comparative', protect, async (req, res) => {
  try {
    const { topicIds } = req.body
    if (!topicIds || !Array.isArray(topicIds)) {
      return res.status(400).json({
        success: false,
        message: 'topicIds array is required'
      })
    }
    const analytics = await topicAnalyticsService.getComparativeAnalytics(topicIds)
    res.json({ success: true, data: analytics })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
