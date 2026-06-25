import express from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import smartRevisionService from './smartRevision.service.js'

const router = express.Router()

router.post('/generate-plan', protect, async (req, res) => {
  try {
    const { days } = req.body
    const result = await smartRevisionService.generateRevisionPlan(req.user.id, {
      days: parseInt(days) || 14,
    })
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/add', protect, async (req, res) => {
  try {
    const { questionId, priority } = req.body
    if (!questionId) {
      return res.status(400).json({ success: false, message: 'questionId is required' })
    }

    const result = await smartRevisionService.addToRevisionQueue(
      req.user.id,
      questionId,
      priority || 'medium'
    )
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.get('/due', protect, async (req, res) => {
  try {
    const questions = await smartRevisionService.getDueRevisions(req.user.id)
    res.json({ success: true, data: questions })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/complete', protect, async (req, res) => {
  try {
    const { questionId, remembered } = req.body
    if (!questionId) {
      return res.status(400).json({ success: false, message: 'questionId is required' })
    }

    const result = await smartRevisionService.completeRevision(
      req.user.id,
      questionId,
      remembered !== false
    )
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.get('/stats', protect, async (req, res) => {
  try {
    const stats = await smartRevisionService.getRevisionStats(req.user.id)
    res.json({ success: true, data: stats })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
