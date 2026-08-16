import express from 'express'
import { protect, admin } from '../../middleware/auth.middleware.js'
import aiExplanationService from './aiExplanation.service.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router()

router.post('/generate/:questionId', protect, admin, async (req, res) => {
  try {
    const result = await aiExplanationService.generateExplanation(req.params.questionId, {
      ...req.body,
      userId: req.user.id,
    })
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/generate-bulk', protect, admin, async (req, res) => {
  try {
    const { questionIds, options } = req.body
    if (!questionIds || !Array.isArray(questionIds)) {
      return res.status(400).json({
        success: false,
        message: 'questionIds array is required'
      })
    }

    const result = await aiExplanationService.generateBulk(questionIds, {
      ...options,
      userId: req.user.id,
    })
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/improve/:questionId', protect, admin, async (req, res) => {
  try {
    const result = await aiExplanationService.improveExplanation(
      req.params.questionId,
      req.body.instructions,
      { ...req.body, userId: req.user.id }
    )
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/generate-hindi/:questionId', protect, admin, async (req, res) => {
  try {
    const result = await aiExplanationService.generateHindiExplanation(req.params.questionId, {
      ...req.body,
      userId: req.user.id,
    })
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/stats', protect, admin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    const stats = await aiExplanationService.getUsageStats(startDate, endDate)
    res.json({ success: true, data: stats })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/model-stats', protect, admin, async (req, res) => {
  try {
    const stats = await aiExplanationService.getModelStats()
    res.json({ success: true, data: stats })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

export default router
