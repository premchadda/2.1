import express from 'express'
import { protect, admin } from '../../middleware/auth.middleware.js'
import embeddingService from './embeddingService.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router()

/**
 * POST /api/embeddings/search
 * Search for similar content using semantic search
 */
router.post('/search', protect, async (req, res) => {
  try {
    const { query, contentType, limit, threshold } = req.body
    if (!query) {
      return res.status(400).json({ success: false, message: 'Query is required' })
    }

    const results = await embeddingService.searchSimilar(query, contentType, {
      limit: parseInt(limit) || 10,
      threshold: parseFloat(threshold) || 0.6,
    })
    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

/**
 * POST /api/embeddings/index
 * Index content (admin only)
 */
router.post('/index', protect, admin, async (req, res) => {
  try {
    const { contentType, contentId, text } = req.body
    if (!contentType || !contentId) {
      return res.status(400).json({
        success: false,
        message: 'contentType and contentId are required'
      })
    }

    const result = await embeddingService.indexContent(contentType, parseInt(contentId), text)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

/**
 * POST /api/embeddings/index/batch
 * Index multiple content items (admin only)
 */
router.post('/index/batch', protect, admin, async (req, res) => {
  try {
    const { items } = req.body
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'items array is required'
      })
    }

    const results = await embeddingService.indexBatch(items)
    res.json({ success: true, data: results })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

/**
 * POST /api/embeddings/index/all-unindexed
 * Index all unindexed content of a specific type (admin only)
 */
router.post('/index/all-unindexed', protect, admin, async (req, res) => {
  try {
    const { contentType, limit } = req.body
    if (!contentType) {
      return res.status(400).json({
        success: false,
        message: 'contentType is required'
      })
    }

    const results = await embeddingService.indexAllUnindexed(contentType, parseInt(limit) || 100)
    res.json({ success: true, data: results })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

/**
 * GET /api/embeddings/stats
 * Get embedding statistics (admin only)
 */
router.get('/stats', protect, admin, async (req, res) => {
  try {
    const stats = await embeddingService.getStats()
    const hasPgvector = await embeddingService.checkPgvector()
    res.json({ success: true, data: { ...stats, hasPgvector } })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

/**
 * DELETE /api/embeddings/:contentType/:contentId
 * Delete embedding for specific content (admin only)
 */
router.delete('/:contentType/:contentId', protect, admin, async (req, res) => {
  try {
    const { contentType, contentId } = req.params
    await embeddingService.deleteEmbedding(contentType, parseInt(contentId))
    res.json({ success: true, message: 'Embedding deleted' })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

/**
 * GET /api/embeddings/:contentType/:contentId
 * Get embedding for specific content (admin only)
 */
router.get('/:contentType/:contentId', protect, admin, async (req, res) => {
  try {
    const { contentType, contentId } = req.params
    const embedding = await embeddingService.getEmbedding(contentType, parseInt(contentId))
    res.json({ success: true, data: embedding })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

export default router
