import express from 'express'
import { dbHelpers, pool } from '../../infrastructure/database/postgres-helpers.js'
import { protect, admin } from '../../middleware/auth.middleware.js'

const router = express.Router()

// Apply auth and admin middleware to all routes
router.use(protect)
router.use(admin)

// ===== LEADERBOARD ADMIN ROUTES =====

// @route   GET /api/leaderboards/admin/attempts
// @desc    Get leaderboard data directly from attempts (no leaderboard config needed)
// @access  Private/Admin
router.get('/admin/attempts', async (req, res) => {
  try {
    const { testId, seriesId, limit = 50 } = req.query
    
    // Fetch completed attempts
    const query = { isCompleted: true }
    if (testId) query.testId = testId
    if (seriesId) query.seriesId = seriesId
    
    const attempts = await dbHelpers.find('attempts', query)
    
    // Aggregate by user - get best score per user
    const userBest = {}
    attempts.forEach(attempt => {
      const userId = attempt.userId
      if (!userId) return
      
      const score = parseFloat(attempt.score) || 0
      if (!userBest[userId] || score > userBest[userId].score) {
        userBest[userId] = {
          userId,
          score,
          totalAttempts: 1,
          timeSpent: attempt.timeTaken || attempt.timeSpent || 0,
          testId: attempt.testId,
          seriesId: attempt.seriesId,
          lastAttempt: attempt.submittedAt || attempt.createdAt
        }
      } else {
        userBest[userId].totalAttempts++
      }
    })
    
    // Sort by score, then by time
    const sorted = Object.values(userBest).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return (a.timeSpent || 0) - (b.timeSpent || 0)
    }).slice(0, parseInt(limit))

    const total = sorted.length || 1
    const rankings = sorted.map((entry, index) => ({
      ...entry,
      rank: index + 1,
      percentile: (((total - index) / total) * 100).toFixed(1)
    }))
    
    res.json({
      success: true,
      data: rankings,
      summary: {
        totalAttempts: attempts.length,
        uniqueUsers: Object.keys(userBest).length
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/leaderboards/admin/list
// @desc    Get all leaderboards (including inactive) with stats - Admin
// @access  Private/Admin
router.get('/admin/list', async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive, type } = req.query
    const leaderboards = await dbHelpers.find('leaderboards')
    
    let filtered = leaderboards
    if (isActive !== undefined) {
      const isActiveBool = isActive === 'true'
      filtered = filtered.filter(l => l.isActive === isActiveBool)
    }
    if (type && type !== 'all') {
      filtered = filtered.filter(l => l.type === type)
    }

    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

    const offset = (parseInt(page) - 1) * parseInt(limit)
    const paginated = filtered.slice(offset, offset + parseInt(limit))

    res.json({
      success: true,
      data: paginated,
      count: paginated.length,
      total: filtered.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / parseInt(limit))
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/leaderboards
// @desc    Create a new leaderboard - Admin
// @access  Private/Admin
router.post('/', async (req, res) => {
  try {
    const { name, description, type, scope, scopeId, period, startDate, endDate, rankingCriteria, isPublished, showOnHomepage, maxRankings } = req.body

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      })
    }

    const newLeaderboard = await dbHelpers.insertOne('leaderboards', {
      name,
      description: description || '',
      type: type || 'test',
      scope: scope || 'global',
      scopeId: scopeId || null,
      period: period || 'all-time',
      startDate: startDate || null,
      endDate: endDate || null,
      rankingCriteria: rankingCriteria || ['score', 'timeTaken'],
      isPublished: isPublished || false,
      showOnHomepage: showOnHomepage || false,
      maxRankings: maxRankings || 100,
      rankings: [],
      totalParticipants: 0,
      isActive: true,
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    res.status(201).json({
      success: true,
      data: newLeaderboard,
      message: 'Leaderboard created successfully'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   PUT /api/leaderboards/:id
// @desc    Update a leaderboard - Admin
// @access  Private/Admin
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, type, scope, scopeId, period, startDate, endDate, rankingCriteria, isPublished, showOnHomepage, maxRankings, isActive } = req.body

    const leaderboard = await dbHelpers.findById('leaderboards', id)
    if (!leaderboard) {
      return res.status(404).json({
        success: false,
        message: 'Leaderboard not found'
      })
    }

    const updateData = { updatedAt: new Date().toISOString() }

    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (type !== undefined) updateData.type = type
    if (scope !== undefined) updateData.scope = scope
    if (scopeId !== undefined) updateData.scopeId = scopeId
    if (period !== undefined) updateData.period = period
    if (startDate !== undefined) updateData.startDate = startDate
    if (endDate !== undefined) updateData.endDate = endDate
    if (rankingCriteria !== undefined) updateData.rankingCriteria = rankingCriteria
    if (isPublished !== undefined) updateData.isPublished = isPublished
    if (showOnHomepage !== undefined) updateData.showOnHomepage = showOnHomepage
    if (maxRankings !== undefined) updateData.maxRankings = maxRankings
    if (isActive !== undefined) updateData.isActive = isActive

    const updated = await dbHelpers.updateById('leaderboards', id, updateData)
    
    res.json({
      success: true,
      data: updated,
      message: 'Leaderboard updated successfully'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   DELETE /api/leaderboards/:id
// @desc    Delete a leaderboard - Admin
// @access  Private/Admin
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const leaderboard = await dbHelpers.findById('leaderboards', id)
    if (!leaderboard) {
      return res.status(404).json({
        success: false,
        message: 'Leaderboard not found'
      })
    }

    await dbHelpers.softDelete('leaderboards', id, req.user.id)
    
    res.json({
      success: true,
      message: 'Leaderboard moved to trash'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/leaderboards/:id/recalculate
// @desc    Recalculate leaderboard rankings - Admin
// @access  Private/Admin
router.post('/:id/recalculate', async (req, res) => {
  try {
    const { id } = req.params

    const leaderboard = await dbHelpers.findById('leaderboards', id)
    if (!leaderboard) {
      return res.status(404).json({
        success: false,
        message: 'Leaderboard not found'
      })
    }

    // Fetch attempts for this leaderboard scope
    const query = { isCompleted: true }
    if (leaderboard.scope === 'test' && leaderboard.scopeId) {
      query.testId = leaderboard.scopeId
    } else if (leaderboard.scope === 'series' && leaderboard.scopeId) {
      query.seriesId = leaderboard.scopeId
    } else if (leaderboard.scope === 'exam' && leaderboard.scopeId) {
      query.examId = leaderboard.scopeId
    }

    const allAttempts = await dbHelpers.find('attempts', query)
    
    // Apply period filter
    let filteredAttempts = allAttempts
    if (leaderboard.period === 'daily') {
      const today = new Date().toISOString().split('T')[0]
      filteredAttempts = allAttempts.filter(a => a.createdAt?.startsWith(today))
    } else if (leaderboard.period === 'weekly') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      filteredAttempts = allAttempts.filter(a => new Date(a.createdAt) >= weekAgo)
    } else if (leaderboard.period === 'monthly') {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      filteredAttempts = allAttempts.filter(a => new Date(a.createdAt) >= monthAgo)
    } else if (leaderboard.period === 'yearly') {
      const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      filteredAttempts = allAttempts.filter(a => new Date(a.createdAt) >= yearAgo)
    }

    // Aggregate user scores
    const userScores = {}
    filteredAttempts.forEach(attempt => {
      const userId = attempt.userId
      if (!userScores[userId]) {
        userScores[userId] = {
          userId,
          totalScore: 0,
          totalAttempts: 0,
          bestScore: 0,
          lastAttempt: null
        }
      }
      const score = parseFloat(attempt.score) || 0
      userScores[userId].totalScore += score
      userScores[userId].totalAttempts += 1
      userScores[userId].bestScore = Math.max(userScores[userId].bestScore, score)
      userScores[userId].lastAttempt = attempt.createdAt || attempt.submittedAt
    })

    // Sort by ranking criteria
    const criteria = leaderboard.rankingCriteria || ['score', 'timeTaken']
    const rankings = Object.values(userScores).sort((a, b) => {
      for (const criterion of criteria) {
        if (criterion === 'bestScore' || criterion === 'score') {
          if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore
        } else if (criterion === 'totalScore') {
          if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore
        } else if (criterion === 'totalAttempts') {
          if (b.totalAttempts !== a.totalAttempts) return b.totalAttempts - a.totalAttempts
        }
      }
      return 0
    }).slice(0, leaderboard.maxRankings || 100).map((user, index) => ({
      rank: index + 1,
      userId: user.userId,
      name: '',
      score: criteria.includes('bestScore') ? user.bestScore : user.totalScore,
      totalAttempts: user.totalAttempts,
      accuracy: 0,
      percentile: (((rankings?.length || 0) - index) / (allAttempts.length || 1) * 100).toFixed(1),
      isPro: false
    }))

    // Update leaderboard with new rankings
    const updated = await dbHelpers.updateById('leaderboards', id, {
      rankings,
      totalParticipants: Object.keys(userScores).length,
      lastCalculatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    
    res.json({
      success: true,
      data: updated,
      message: `Leaderboard recalculated with ${Object.keys(userScores).length} participants`,
      participantsCount: Object.keys(userScores).length
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/leaderboards/:id/reset
// @desc    Reset leaderboard rankings - Admin
// @access  Private/Admin
router.post('/:id/reset', async (req, res) => {
  try {
    const { id } = req.params

    const leaderboard = await dbHelpers.findById('leaderboards', id)
    if (!leaderboard) {
      return res.status(404).json({
        success: false,
        message: 'Leaderboard not found'
      })
    }

    await dbHelpers.updateById('leaderboards', id, {
      rankings: [],
      totalParticipants: 0,
      resetAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    
    res.json({
      success: true,
      message: 'Leaderboard reset successfully'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/leaderboards/:id/archived
// @desc    Archive/unarchive a leaderboard - Admin
// @access  Private/Admin
router.post('/:id/archive', async (req, res) => {
  try {
    const { id } = req.params
    const { archive } = req.body

    const leaderboard = await dbHelpers.findById('leaderboards', id)
    if (!leaderboard) {
      return res.status(404).json({
        success: false,
        message: 'Leaderboard not found'
      })
    }

    await dbHelpers.updateById('leaderboards', id, {
      isArchived: archive !== false,
      updatedAt: new Date().toISOString()
    })
    
    res.json({
      success: true,
      message: archive !== false ? 'Leaderboard archived' : 'Leaderboard unarchived'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/leaderboards/admin/stats
// @desc    Get leaderboard statistics - Admin
// @access  Private/Admin
router.get('/admin/stats', async (req, res) => {
  try {
    const leaderboards = await dbHelpers.find('leaderboards')
    
    const stats = {
      total: leaderboards.length,
      active: leaderboards.filter(l => l.isActive !== false).length,
      published: leaderboards.filter(l => l.isPublished === true).length,
      archived: leaderboards.filter(l => l.isArchived === true).length,
      totalParticipants: leaderboards.reduce((sum, l) => sum + (l.totalParticipants || 0), 0),
      byType: {},
      byPeriod: {}
    }

    leaderboards.forEach(lb => {
      const type = lb.type || 'unknown'
      const period = lb.period || 'all-time'
      stats.byType[type] = (stats.byType[type] || 0) + 1
      stats.byPeriod[period] = (stats.byPeriod[period] || 0) + 1
    })
    
    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router