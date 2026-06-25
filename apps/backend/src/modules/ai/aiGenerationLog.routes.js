import express from 'express'
import { protect, admin } from '../../middleware/auth.middleware.js'
import aiGenerationLogService from './aiGenerationLog.service.js'

const router = express.Router()

router.get('/', protect, admin, async (req, res) => {
  try {
    const { entityType, model, status, page = 1, limit = 50 } = req.query
    const query = {}
    if (entityType) query.entityType = entityType
    if (model) query.model = model
    if (status) query.status = status

    const logs = await aiGenerationLogService.list(query)
    res.json({ success: true, data: logs })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/recent', protect, admin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50
    const logs = await aiGenerationLogService.getRecent(limit)
    res.json({ success: true, data: logs })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/failed', protect, admin, async (req, res) => {
  try {
    const logs = await aiGenerationLogService.getFailed()
    res.json({ success: true, data: logs })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/stats/by-model', protect, admin, async (req, res) => {
  try {
    const stats = await aiGenerationLogService.getStatsByModel()
    res.json({ success: true, data: stats })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/stats/by-entity', protect, admin, async (req, res) => {
  try {
    const stats = await aiGenerationLogService.getStatsByEntityType()
    res.json({ success: true, data: stats })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/stats/cost', protect, admin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' })
    }
    const stats = await aiGenerationLogService.getCostSummary(startDate, endDate)
    res.json({ success: true, data: stats })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/:id', protect, admin, async (req, res) => {
  try {
    const log = await aiGenerationLogService.getById(req.params.id)
    if (!log) {
      return res.status(404).json({ success: false, message: 'Log not found' })
    }
    res.json({ success: true, data: log })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/', protect, admin, async (req, res) => {
  try {
    const log = await aiGenerationLogService.log({
      ...req.body,
      createdBy: req.user.id
    })
    res.status(201).json({ success: true, data: log })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.delete('/cleanup', protect, admin, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90
    const deleted = await aiGenerationLogService.cleanupOldLogs(days)
    res.json({ success: true, data: { deleted } })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
