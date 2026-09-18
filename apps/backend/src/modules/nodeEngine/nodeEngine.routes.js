import express from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { aiRateLimiter } from '../../middleware/aiRateLimiter.js'
import { nodeEngineService } from '../../services/core/NodeEngineService.js'

const router = express.Router()

// NOTE: aiRateLimiter on read GETs below is intentional — recommendations,
// learning-path, and spaced-repetition all fan out to the AI gateway
// (NodeEngineService LLM calls), so unauthenticated-cost reads get the same
// burst protection as the POST route. Do not "optimize" it away.

// GET /api/node-engine/recommendations
// Get personalized recommended study topics for student
router.get('/recommendations', protect, aiRateLimiter, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || '5', 10)
    const recommendations = await nodeEngineService.getRecommendations(req.user.id, limit, {
      subjectId: req.query.subjectId,
      examId: req.query.examId,
    })

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
router.get('/learning-path', protect, aiRateLimiter, async (req, res, next) => {
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
router.get('/spaced-repetition', protect, aiRateLimiter, async (req, res, next) => {
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
router.post('/record-attempt', protect, aiRateLimiter, async (req, res, next) => {
  try {
    const { nodeId, isCorrect, timeSpentSeconds } = req.body

    if (!nodeId || isCorrect === undefined) {
      return res.status(400).json({
        success: false,
        message: 'nodeId and isCorrect are required',
      })
    }

    // Strict integer validation: parseInt("12abc") === 12 would silently
    // write mastery to the WRONG node. Reject non-canonical forms outright.
    const parsedNodeId = typeof nodeId === 'number' ? nodeId : Number(String(nodeId).trim())
    if (!Number.isInteger(parsedNodeId) || parsedNodeId <= 0 || String(nodeId).trim() !== String(parsedNodeId)) {
      return res.status(400).json({
        success: false,
        message: 'nodeId must be an integer node id',
      })
    }

    const result = await nodeEngineService.recordAttempt(
      req.user.id,
      parsedNodeId,
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
