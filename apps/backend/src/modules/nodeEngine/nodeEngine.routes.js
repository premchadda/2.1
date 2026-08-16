import express from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { nodeEngineService } from '../../services/core/NodeEngineService.js'

const router = express.Router()

// GET /api/node-engine/recommendations
// Get personalized recommended study topics for student
router.get('/recommendations', protect, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || '5', 10)
    const recommendations = await nodeEngineService.getRecommendations(req.user.id, limit)

    res.json({
      success: true,
      data: recommendations,
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/node-engine/learning-path
// Get dynamic AI-generated learning path
router.get('/learning-path', protect, async (req, res, next) => {
  try {
    const rootNodeId = req.query.rootNodeId ? parseInt(req.query.rootNodeId, 10) : null
    const learningPath = await nodeEngineService.generateLearningPath(req.user.id, rootNodeId)

    res.json({
      success: true,
      data: learningPath,
    })
  } catch (error) {
    next(error)
  }
})

// GET /api/node-engine/spaced-repetition
// Get topics due for revision based on Ebbinghaus forgetting curve
router.get('/spaced-repetition', protect, async (req, res, next) => {
  try {
    const dueTopics = await nodeEngineService.getSpacedRepetitions(req.user.id)

    res.json({
      success: true,
      count: dueTopics.length,
      data: dueTopics,
    })
  } catch (error) {
    next(error)
  }
})

// POST /api/node-engine/record-attempt
// Log an answer attempt and recalculate student skill mastery & node difficulty
router.post('/record-attempt', protect, async (req, res, next) => {
  try {
    const { nodeId, isCorrect, timeSpentSeconds } = req.body

    if (!nodeId || isCorrect === undefined) {
      return res.status(400).json({
        success: false,
        message: 'nodeId and isCorrect are required',
      })
    }

    const result = await nodeEngineService.recordAttempt(
      req.user.id,
      parseInt(nodeId, 10),
      Boolean(isCorrect),
      parseInt(timeSpentSeconds || '45', 10)
    )

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
})

export default router
