import express from 'express'
import { protect, admin } from '../../middleware/auth.middleware.js'
import vectorSearchService from './vectorSearch.service.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router()

router.post('/semantic', async (req, res) => {
  try {
    const { query, difficulty, topicId, subject, limit, threshold } = req.body
    if (!query) {
      return res.status(400).json({ success: false, message: 'Query is required' })
    }

    const results = await vectorSearchService.semanticSearch(query, {
      difficulty, topicId, subject,
      limit: parseInt(limit) || 20,
      threshold: parseFloat(threshold) || 0.6,
    })
    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/similar/:questionId', protect, async (req, res) => {
  try {
    const { limit, threshold } = req.query
    const results = await vectorSearchService.findSimilar(req.params.questionId, {
      limit: parseInt(limit) || 10,
      threshold: parseFloat(threshold) || 0.7,
    })
    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/by-description', protect, async (req, res) => {
  try {
    const { description, difficulty, topicId, subject, limit } = req.body
    if (!description) {
      return res.status(400).json({ success: false, message: 'Description is required' })
    }

    const results = await vectorSearchService.findByDescription(description, {
      difficulty, topicId, subject,
      limit: parseInt(limit) || 20,
    })
    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/index/:questionId', protect, admin, async (req, res) => {
  try {
    const result = await vectorSearchService.indexQuestion(req.params.questionId)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/index/batch', protect, admin, async (req, res) => {
  try {
    const { questionIds } = req.body
    if (!questionIds || !Array.isArray(questionIds)) {
      return res.status(400).json({
        success: false,
        message: 'questionIds array is required'
      })
    }

    const results = await vectorSearchService.indexBatch(questionIds)
    res.json({ success: true, data: results })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/index/all-unindexed', protect, admin, async (req, res) => {
  try {
    const { limit } = req.body
    const results = await vectorSearchService.indexAllUnindexed(parseInt(limit) || 100)
    res.json({ success: true, data: results })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/stats', protect, admin, async (req, res) => {
  try {
    const stats = await vectorSearchService.getStats()
    const hasPgvector = await vectorSearchService.checkPgvector()
    res.json({ success: true, data: { ...stats, hasPgvector } })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

export default router
