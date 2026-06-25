import express from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import aiMentorService from './aiMentor.service.js'

const router = express.Router()

router.post('/study-plan', protect, async (req, res) => {
  try {
    const { days } = req.body
    const result = await aiMentorService.generateStudyPlan(req.user.id, {
      days: parseInt(days) || 30,
    })
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/doubt', protect, async (req, res) => {
  try {
    const { question, topic, subject } = req.body
    if (!question) {
      return res.status(400).json({ success: false, message: 'Question is required' })
    }

    const result = await aiMentorService.answerDoubt(req.user.id, question, { topic, subject })
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/exam-strategy', protect, async (req, res) => {
  try {
    const { examType } = req.body
    if (!examType) {
      return res.status(400).json({ success: false, message: 'examType is required' })
    }

    const result = await aiMentorService.generateExamStrategy(req.user.id, examType)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/daily-tip', protect, async (req, res) => {
  try {
    const result = await aiMentorService.getDailyTip(req.user.id)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/chat', protect, async (req, res) => {
  try {
    const { message, history } = req.body
    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' })
    }

    const result = await aiMentorService.chat(req.user.id, message, history || [])
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
