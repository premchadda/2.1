import express from 'express'
import { sectionService } from './section.service.js'
import { restrictAdminOrigin, validateAdminApiKey } from '../../middleware/origin.middleware.js'
import { protect, admin } from '../../middleware/auth.middleware.js'
import { auditMiddleware } from '../../middleware/audit.middleware.js'

const router = express.Router()
const adminAuth = [restrictAdminOrigin, validateAdminApiKey, protect, admin, auditMiddleware]

router.get('/', ...adminAuth, async (req, res) => {
  try {
    const sections = await sectionService.list(req.query.testId)
    res.json({ success: true, data: sections })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/:id', ...adminAuth, async (req, res) => {
  try {
    const section = await sectionService.getById(req.params.id)
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' })
    res.json({ success: true, data: section })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/', ...adminAuth, async (req, res) => {
  try {
    const section = await sectionService.create(req.body)
    res.status(201).json({ success: true, data: section })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.put('/:id', ...adminAuth, async (req, res) => {
  try {
    const updated = await sectionService.update(req.params.id, req.body)
    if (!updated) return res.status(404).json({ success: false, message: 'Section not found' })
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.delete('/:id', ...adminAuth, async (req, res) => {
  try {
    const result = await sectionService.remove(req.params.id, req.user.id)
    if (!result) return res.status(404).json({ success: false, message: 'Section not found' })
    res.json({ success: true, message: 'Section moved to trash' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.put('/:id/restore', ...adminAuth, async (req, res) => {
  try {
    const restored = await sectionService.restore(req.params.id)
    if (!restored) return res.status(404).json({ success: false, message: 'Section not found in trash' })
    res.json({ success: true, message: 'Section restored successfully', data: restored })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
