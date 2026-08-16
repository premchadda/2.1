import express from 'express'
import { protect, admin } from '../../middleware/auth.middleware.js'
import testTemplateService from './testTemplate.service.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const { examId, stageId, isSystem, page = 1, limit = 50 } = req.query
    const query = {}
    if (examId) query.examId = examId
    if (stageId) query.stageId = stageId
    if (isSystem !== undefined) query.isSystem = isSystem === 'true'

    const templates = await testTemplateService.list(query)
    res.json({ success: true, data: templates })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/active', async (req, res) => {
  try {
    const templates = await testTemplateService.getActive()
    res.json({ success: true, data: templates })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/system', protect, admin, async (req, res) => {
  try {
    const templates = await testTemplateService.getSystemTemplates()
    res.json({ success: true, data: templates })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const template = await testTemplateService.getById(req.params.id)
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' })
    }
    res.json({ success: true, data: template })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/', protect, admin, async (req, res) => {
  try {
    const template = await testTemplateService.create({
      ...req.body,
      createdBy: req.user.id
    })
    res.status(201).json({ success: true, data: template })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.put('/:id', protect, admin, async (req, res) => {
  try {
    const template = await testTemplateService.update(req.params.id, req.body)
    res.json({ success: true, data: template })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.delete('/:id', protect, admin, async (req, res) => {
  try {
    await testTemplateService.remove(req.params.id)
    res.json({ success: true, message: 'Template deleted' })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/:id/duplicate', protect, admin, async (req, res) => {
  try {
    const template = await testTemplateService.duplicate(req.params.id)
    res.status(201).json({ success: true, data: template })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/:id/generate-test', protect, admin, async (req, res) => {
  try {
    const testData = await testTemplateService.generateTestFromTemplate(req.params.id, req.body)
    res.json({ success: true, data: testData })
  } catch (error) {
    res.status(400).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

export default router
