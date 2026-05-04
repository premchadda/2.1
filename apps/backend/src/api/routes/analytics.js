import express from 'express'
import { dbHelpers, pool } from '../../infrastructure/database/postgres-helpers.js'
import { protect, admin } from '../../middleware/auth.middleware.js'

const router = express.Router()

// ===== ANALYTICS MODULE =====
// All analytics routes are admin-only for security

// @route   GET /api/analytics/dashboard
// @desc    Get main dashboard analytics (user growth, tests, revenue)
// @access  Private/Admin
router.get('/dashboard', protect, admin, async (req, res) => {
  try {
    const { period = '30d' } = req.query
    const now = new Date()
    let days = 30
    
    switch (period) {
      case '7d': days = 7; break
      case '30d': days = 30; break
      case '90d': days = 90; break
      case '1y': days = 365; break
      default: days = 30
    }
    
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const startDateISO = startDate.toISOString()

    // Concurrent fetches for all analytics data
    const [
      allUsers, allAttempts, allTests, allSeries,
      allSubscriptions, allStudyMaterials
    ] = await Promise.all([
      dbHelpers.find('users'),
      dbHelpers.find('attempts'),
      dbHelpers.find('tests', { isActive: true }),
      dbHelpers.find('testSeries', { isActive: true }),
      dbHelpers.find('subscriptions'),
      dbHelpers.find('studyMaterials', { isActive: true })
    ])

    // User growth
    const newUserGrowth = allUsers.filter(u => new Date(u.createdAt) >= startDate)
    const activeUsers = allUsers.filter(u => {
      const lastActive = new Date(u.updatedAt || u.createdAt)
      return lastActive >= startDate
    })

    // Test performance
    const testAttempts = allAttempts.filter(a => new Date(a.createdAt || a.startedAt) >= startDate)
    const completedTests = testAttempts.filter(a => a.isCompleted)
    const avgScore = completedTests.length > 0
      ? (completedTests.reduce((sum, a) => sum + (parseFloat(a.score) || 0), 0) / completedTests.length).toFixed(2)
      : 0
    
    const avgCompletionTime = completedTests.length > 0
      ? (completedTests.reduce((sum, a) => sum + (parseFloat(a.timeSpent) || 0), 0) / completedTests.length / 60).toFixed(1)
      : 0

    // Revenue
    const activeSubscriptions = allSubscriptions.filter(s => s.status === 'active')
    const revenueThisPeriod = allSubscriptions
      .filter(s => new Date(s.createdAt) >= startDate && s.amountPaid)
      .reduce((sum, s) => sum + (parseFloat(s.amountPaid) || 0), 0)

    // Top performing tests by completion rate
    const testAttemptCounts = {}
    testAttempts.forEach(a => {
      if (!testAttemptCounts[a.testId]) {
        testAttemptCounts[a.testId] = { total: 0, completed: 0 }
      }
      testAttemptCounts[a.testId].total++
      if (a.isCompleted) testAttemptCounts[a.testId].completed++
    })

    const topTests = Object.entries(testAttemptCounts)
      .map(([testId, counts]) => {
        const test = allTests.find(t => String(t.id || t._id) === String(testId))
        return {
          testId,
          testName: test?.title || 'Unknown Test',
          totalAttempts: counts.total,
          completionRate: counts.total > 0 ? ((counts.completed / counts.total) * 100).toFixed(1) : 0
        }
      })
      .filter(t => t.totalAttempts > 0)
      .sort((a, b) => b.totalAttempts - a.totalAttempts)
      .slice(0, 10)

    // Daily activity data for charts
    const dailyActivity = []
    for (let i = days - 1; i >= 0; i--) {
      const dateStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      dateStart.setHours(0, 0, 0, 0)
      const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000)

      const dayNewUsers = allUsers.filter(u => {
        const created = new Date(u.createdAt)
        return created >= dateStart && created < dateEnd
      }).length

      const dayAttempts = testAttempts.filter(a => {
        const started = new Date(a.createdAt || a.startedAt)
        return started >= dateStart && started < dateEnd
      }).length

      dailyActivity.push({
        date: dateStart.toISOString().split('T')[0],
        newUsers: dayNewUsers,
        attempts: dayAttempts
      })
    }

    // Study material stats
    const studyMaterialsByType = {}
    allStudyMaterials.forEach(m => {
      const type = m.type || 'other'
      studyMaterialsByType[type] = (studyMaterialsByType[type] || 0) + 1
    })

    res.json({
      success: true,
      data: {
        users: {
          total: allUsers.filter(u => u.isActive !== false).length,
          newInPeriod: newUserGrowth.length,
          activeInPeriod: activeUsers.length,
          growthRate: days > 0 ? ((newUserGrowth.length / (allUsers.length || 1)) * 100).toFixed(1) : 0
        },
        tests: {
          totalTests: allTests.length,
          totalSeries: allSeries.length,
          attemptsInPeriod: testAttempts.length,
          completionsInPeriod: completedTests.length,
          avgScore: parseFloat(avgScore),
          avgCompletionTime: parseFloat(avgCompletionTime),
          topTests
        },
        revenue: {
          activeSubscriptions: activeSubscriptions.length,
          revenueInPeriod: revenueThisPeriod,
          totalRevenue: allSubscriptions.reduce((sum, s) => sum + (parseFloat(s.amountPaid) || 0), 0)
        },
        content: {
          totalStudyMaterials: allStudyMaterials.length,
          byType: studyMaterialsByType
        },
        dailyActivity,
        period,
        generatedAt: now.toISOString()
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/analytics/users
// @desc    Get detailed user analytics
// @access  Private/Admin
router.get('/users', protect, admin, async (req, res) => {
  try {
    const { period = '30d', metric = 'registrations' } = req.query
    const now = new Date()
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    const allUsers = await dbHelpers.find('users')
    
    // User registration trend
    const registrationData = []
    for (let i = days - 1; i >= 0; i--) {
      const dateStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      dateStart.setHours(0, 0, 0, 0)
      const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000)

      const dayRegistrations = allUsers.filter(u => {
        const created = new Date(u.createdAt)
        return created >= dateStart && created < dateEnd
      }).length

      registrationData.push({
        date: dateStart.toISOString().split('T')[0],
        count: dayRegistrations
      })
    }

    // User demographics/stats
    const usersByRole = {}
    const usersByStatus = { active: 0, inactive: 0, pro: 0 }
    
    allUsers.forEach(u => {
      usersByRole[u.role || 'user'] = (usersByRole[u.role || 'user'] || 0) + 1
      if (u.isActive !== false) usersByStatus.active++
      else usersByStatus.inactive++
      if (u.isProUser) usersByStatus.pro++
    })

    // Active users over time (users with activity in last 30 days)
    const recentlyActiveUsers = allUsers.filter(u => {
      const lastActivity = new Date(u.updatedAt || u.createdAt)
      return lastActivity >= startDate
    })

    res.json({
      success: true,
      data: {
        totalUsers: allUsers.length,
        activeUsers: usersByStatus.active,
        inactiveUsers: usersByStatus.inactive,
        proUsers: usersByStatus.pro,
        byRole: usersByRole,
        recentActiveUsers: recentlyActiveUsers.length,
        registrationTrend: registrationData,
        period
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/analytics/tests
// @desc    Get detailed test analytics
// @access  Private/Admin
router.get('/tests', protect, admin, async (req, res) => {
  try {
    const allTests = await dbHelpers.find('tests', { isActive: true })
    const allAttempts = await dbHelpers.find('attempts')
    const allSeries = await dbHelpers.find('testSeries', { isActive: true })

    // Test performance by series
    const seriesStats = {}
    allSeries.forEach(series => {
      const seriesTests = allTests.filter(t => String(t.seriesId || t.series_id) === String(series.id || series._id))
      const seriesAttempts = allAttempts.filter(a => 
        seriesTests.some(t => String(t.id || t._id) === String(a.testId))
      )
      
      seriesStats[series.id || series._id] = {
        seriesId: series.id || series._id,
        seriesName: series.name || series.title,
        totalTests: seriesTests.length,
        totalAttempts: seriesAttempts.length,
        activeAttempts: seriesAttempts.filter(a => !a.isCompleted).length,
        completedAttempts: seriesAttempts.filter(a => a.isCompleted).length,
        avgScore: seriesAttempts.filter(a => a.isCompleted).length > 0
          ? (seriesAttempts.filter(a => a.isCompleted).reduce((sum, a) => sum + (parseFloat(a.score) || 0), 0) / 
             seriesAttempts.filter(a => a.isCompleted).length).toFixed(2)
          : 0
      }
    })

    // Question difficulty analysis (if questions available)
    const allQuestions = await dbHelpers.find('questions', { isActive: true })
    const questionsByDifficulty = {}
    allQuestions.forEach(q => {
      const difficulty = q.difficulty || 'medium'
      questionsByDifficulty[difficulty] = (questionsByDifficulty[difficulty] || 0) + 1
    })

    res.json({
      success: true,
      data: {
        totalTests: allTests.length,
        totalSeries: allSeries.length,
        totalQuestions: allQuestions.length,
        questionsByDifficulty,
        seriesStats: Object.values(seriesStats),
        testsWithAttempts: Object.values(seriesStats).filter(s => s.totalAttempts > 0)
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/analytics/revenue
// @desc    Get revenue analytics
// @access  Private/Admin
router.get('/revenue', protect, admin, async (req, res) => {
  try {
    const { period = '90d' } = req.query
    const now = new Date()
    const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '1y' ? 365 : 90
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    const allSubscriptions = await dbHelpers.find('subscriptions')
    const allUsers = await dbHelpers.find('users')

    const activeSubscriptions = allSubscriptions.filter(s => 
      s.status === 'active' && new Date(s.expiryDate || s.expiry_date) > now
    )
    
    const proUsers = allUsers.filter(u => u.isProUser && u.isActive !== false)

    // Revenue trend
    const revenueData = []
    for (let i = days - 1; i >= 0; i--) {
      const dateStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      dateStart.setHours(0, 0, 0, 0)
      const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000)

      const dayRevenue = allSubscriptions
        .filter(s => {
          const created = new Date(s.createdAt)
          return created >= dateStart && created < dateEnd && s.amountPaid
        })
        .reduce((sum, s) => sum + (parseFloat(s.amountPaid) || 0), 0)

      revenueData.push({
        date: dateStart.toISOString().split('T')[0],
        revenue: dayRevenue
      })
    }

    // Revenue sources
    const revenueByPlan = {}
    allSubscriptions.filter(s => s.amountPaid).forEach(s => {
      const plan = s.planType || s.plan_type || 'unknown'
      revenueByPlan[plan] = (revenueByPlan[plan] || 0) + (parseFloat(s.amountPaid) || 0)
    })

    const totalRevenue = allSubscriptions
      .filter(s => s.amountPaid)
      .reduce((sum, s) => sum + (parseFloat(s.amountPaid) || 0), 0)

    res.json({
      success: true,
      data: {
        totalRevenue,
        activeSubscriptions: activeSubscriptions.length,
        totalProUsers: proUsers.length,
        conversionRate: allUsers.filter(u => u.isActive !== false).length > 0
          ? ((proUsers.length / allUsers.filter(u => u.isActive !== false).length) * 100).toFixed(2)
          : 0,
        revenueByPlan,
        revenueTrend: revenueData,
        period
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/analytics/content
// @desc    Get content analytics
// @access  Private/Admin
router.get('/content', protect, admin, async (req, res) => {
  try {
    const [allStudyMaterials, allVideos, allPdfs, allQuestions, allBlogs] = await Promise.all([
      dbHelpers.find('studyMaterials', { isActive: true }),
      dbHelpers.find('subjectVideos', { isActive: true }),
      dbHelpers.find('subjectPdfs', { isActive: true }),
      dbHelpers.find('questions', { isActive: true }),
      dbHelpers.find('blogs', { isActive: true })
    ])

    // Content by material type
    const contentByType = {
      studyMaterials: allStudyMaterials.length,
      subjectVideos: allVideos.length,
      subjectPdfs: allPdfs.length,
      questions: allQuestions.length,
      blogs: allBlogs.length
    }

    res.json({
      success: true,
      data: {
        totalContent: allStudyMaterials.length + allVideos.length + allPdfs.length + allQuestions.length + allBlogs.length,
        byType: contentByType,
        materials: allStudyMaterials.map(m => ({
          id: m.id || m._id,
          title: m.title || m.name,
          createdAt: m.createdAt
        })),
        videos: allVideos.map(v => ({
          id: v.id || v._id,
          title: v.title,
          studyMaterialId: v.studyMaterialId || v.study_material_id,
          createdAt: v.createdAt
        })),
        pdfs: allPdfs.map(p => ({
          id: p.id || p._id,
          title: p.title,
          studyMaterialId: p.studyMaterialId || p.study_material_id,
          createdAt: p.createdAt
        }))
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/analytics/export
// @desc    Generate export data for selected metrics
// @access  Private/Admin
router.get('/export', protect, admin, async (req, res) => {
  try {
    const { type = 'users', format = 'json' } = req.query
    
    let exportData
    switch (type) {
      case 'users':
        exportData = await dbHelpers.find('users')
        break
      case 'tests':
        exportData = await dbHelpers.find('tests', { isActive: true })
        break
      case 'subscriptions':
        exportData = await dbHelpers.find('subscriptions')
        break
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type'
        })
    }

    res.json({
      success: true,
      data: exportData,
      count: exportData.length,
      exportedAt: new Date().toISOString(),
      type
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router