import express from 'express'
import { protect, admin } from '../../middleware/auth.middleware.js'
import testBuilderService from './testBuilder.service.js'

const router = express.Router()

router.get('/', protect, admin, async (req, res) => {
  try {
    const { status, difficulty, seriesId, limit = 50, offset = 0 } = req.query
    const query = {}
    if (status) query.status = status
    if (difficulty) query.difficulty = difficulty
    if (seriesId) query.seriesId = seriesId

    const tests = await testBuilderService.list(query)
    res.json({ success: true, data: tests })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/:id', protect, admin, async (req, res) => {
  try {
    const test = await testBuilderService.getById(req.params.id)
    res.json({ success: true, data: test })
  } catch (error) {
    res.status(404).json({ success: false, message: error.message })
  }
})

router.post('/', protect, admin, async (req, res) => {
  try {
    const validation = testBuilderService.validate(req.body)
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      })
    }

    const test = await testBuilderService.create(req.body)
    res.status(201).json({ success: true, data: test })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/from-template/:templateId', protect, admin, async (req, res) => {
  try {
    const test = await testBuilderService.createFromTemplate(req.params.templateId, req.body)
    res.status(201).json({ success: true, data: test })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.put('/:id', protect, admin, async (req, res) => {
  try {
    const test = await testBuilderService.update(req.params.id, req.body)
    res.json({ success: true, data: test })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/:id/clone', protect, admin, async (req, res) => {
  try {
    const test = await testBuilderService.clone(req.params.id, req.body)
    res.status(201).json({ success: true, data: test })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.get('/:id/questions', protect, admin, async (req, res) => {
  try {
    const questions = await testBuilderService.getQuestions(req.params.id)
    res.json({ success: true, data: questions })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.post('/:id/questions', protect, admin, async (req, res) => {
  try {
    const { questionIds } = req.body
    if (!questionIds || !Array.isArray(questionIds)) {
      return res.status(400).json({
        success: false,
        message: 'questionIds array is required'
      })
    }

    await testBuilderService.linkQuestions(req.params.id, questionIds)
    res.json({ success: true, message: 'Questions linked' })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.delete('/:id/questions', protect, admin, async (req, res) => {
  try {
    const { questionIds } = req.body
    await testBuilderService.unlinkQuestions(req.params.id, questionIds)
    res.json({ success: true, message: 'Questions unlinked' })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/:id/sections', protect, admin, async (req, res) => {
  try {
    const section = await testBuilderService.createSection(req.params.id, req.body)
    res.status(201).json({ success: true, data: section })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.put('/:id/sections', protect, admin, async (req, res) => {
  try {
    await testBuilderService.updateSections(req.params.id, req.body.sections)
    res.json({ success: true, message: 'Sections updated' })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

export default router
