import express from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import rankingService from './ranking.service.js'

const router = express.Router()

router.get('/overall', async (req, res) => {
  try {
    const { limit, offset } = req.query
    const ranking = await rankingService.getOverallRanking({
      limit: parseInt(limit) || 100,
      offset: parseInt(offset) || 0,
    })
    res.json({ success: true, data: ranking })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/my-rank', protect, async (req, res) => {
  try {
    const rank = await rankingService.getUserRank(req.user.id)
    res.json({ success: true, data: rank })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/subject/:subjectId', async (req, res) => {
  try {
    const { limit } = req.query
    const ranking = await rankingService.getSubjectRanking(req.params.subjectId, {
      limit: parseInt(limit) || 100,
    })
    res.json({ success: true, data: ranking })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/exam/:examId', async (req, res) => {
  try {
    const { limit } = req.query
    const ranking = await rankingService.getExamRanking(req.params.examId, {
      limit: parseInt(limit) || 100,
    })
    res.json({ success: true, data: ranking })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/history', protect, async (req, res) => {
  try {
    const { days } = req.query
    const history = await rankingService.getRankHistory(req.user.id, {
      days: parseInt(days) || 30,
    })
    res.json({ success: true, data: history })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/percentile/:testId', protect, async (req, res) => {
  try {
    const percentile = await rankingService.calculatePercentile(req.user.id, req.params.testId)
    res.json({ success: true, data: percentile })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/top-performers', async (req, res) => {
  try {
    const { limit, period } = req.query
    const performers = await rankingService.getTopPerformers({
      limit: parseInt(limit) || 10,
      period: period || 'all',
    })
    res.json({ success: true, data: performers })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
