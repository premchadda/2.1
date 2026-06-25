import express from 'express'
import { protect, admin } from '../../middleware/auth.middleware.js'
import questionBuilderService from './questionBuilder.service.js'
import Question from '../../data/models/question/Question.js'

const router = express.Router()

router.get('/', protect, admin, async (req, res) => {
  try {
    const {
      difficulty, topicId, subject, testId, importedFrom,
      search, isActive, limit = 50, offset = 0
    } = req.query

    const questions = await questionBuilderService.listForAdmin({
      difficulty, topicId, subject, testId, importedFrom,
      search, isActive: isActive !== undefined ? isActive === 'true' : undefined,
      limit: parseInt(limit), offset: parseInt(offset)
    })
    res.json({ success: true, data: questions })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

router.get('/:id', protect, admin, async (req, res) => {
  try {
    const question = await questionBuilderService.getWithVersions(req.params.id)
    res.json({ success: true, data: question })
  } catch (error) {
    res.status(404).json({ success: false, message: error.message })
  }
})

router.post('/', protect, admin, async (req, res) => {
  try {
    const validation = questionBuilderService.validate(req.body)
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      })
    }

    const question = await questionBuilderService.create({
      ...req.body,
      createdBy: req.user.id
    })
    res.status(201).json({ success: true, data: question })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/bulk', protect, admin, async (req, res) => {
  try {
    const { questions, config } = req.body
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Questions array is required'
      })
    }

    const results = await questionBuilderService.bulkCreate(questions, {
      ...config,
      createdBy: req.user.id
    })
    res.status(201).json({ success: true, data: results })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.post('/:id/clone', protect, admin, async (req, res) => {
  try {
    const question = await questionBuilderService.clone(req.params.id, req.body)
    res.status(201).json({ success: true, data: question })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.put('/:id', protect, admin, async (req, res) => {
  try {
    const question = await questionBuilderService.update(
      req.params.id,
      req.body,
      req.user.id
    )
    res.json({ success: true, data: question })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

router.delete('/:id', protect, admin, async (req, res) => {
  try {
    await Question.deleteById(req.params.id)
    res.json({ success: true, message: 'Question deleted' })
  } catch (error) {
    res.status(400).json({ success: false, message: error.message })
  }
})

export default router
