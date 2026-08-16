import express from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import smartRevisionService from './smartRevision.service.js'
import { responseCache } from '../../middleware/responseCache.middleware.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router()

router.post('/generate-plan', protect, async (req, res) => {
  try {
    const { days } = req.body
    const result = await smartRevisionService.generateRevisionPlan(req.user.id, {
      days: parseInt(days) || 14,
    })
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
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
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/due', protect, responseCache("smart-revision-due", 60), async (req, res) => {
  try {
    const questions = await smartRevisionService.getDueRevisions(req.user.id)
    res.json({ success: true, data: questions })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
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
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/wrong-questions', protect, async (req, res) => {
  try {
    const questions = await smartRevisionService.getWrongQuestions(req.user.id)
    res.json({ success: true, data: questions })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/mistakes/practice-session', protect, async (req, res) => {
  try {
    const { testId, subjectId, limit } = req.query
    const questions = await smartRevisionService.getMistakePracticeQuestions(req.user.id, {
      testId,
      subjectId,
      limit: parseInt(limit, 10) || 25,
    })
    res.json({ success: true, data: questions, total: questions.length })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

export default router
