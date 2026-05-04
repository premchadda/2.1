import express from 'express'
import { protect } from '../../middleware/auth.middleware.js'

const router = express.Router()

// All achievement routes require authentication
router.use(protect)

// Predefined achievement definitions
const ACHIEVEMENT_DEFINITIONS = [
  {
    id: 'first-test',
    title: 'First Steps',
    description: 'Complete your first test',
    icon: '🎯',
    category: 'milestone',
    requirement: { type: 'tests_completed', count: 1 }
  },
  {
    id: 'test-streak-7',
    title: 'Week Warrior',
    description: 'Complete tests for 7 consecutive days',
    icon: '🔥',
    category: 'streak',
    requirement: { type: 'day_streak', count: 7 }
  },
  {
    id: 'test-streak-30',
    title: 'Monthly Master',
    description: 'Complete tests for 30 consecutive days',
    icon: '💪',
    category: 'streak',
    requirement: { type: 'day_streak', count: 30 }
  },
  {
    id: 'tests-10',
    title: 'Dedicated Learner',
    description: 'Complete 10 tests',
    icon: '📚',
    category: 'milestone',
    requirement: { type: 'tests_completed', count: 10 }
  },
  {
    id: 'tests-50',
    title: 'Test Champion',
    description: 'Complete 50 tests',
    icon: '🏆',
    category: 'milestone',
    requirement: { type: 'tests_completed', count: 50 }
  },
  {
    id: 'tests-100',
    title: 'Century Club',
    description: 'Complete 100 tests',
    icon: '💯',
    category: 'milestone',
    requirement: { type: 'tests_completed', count: 100 }
  },
  {
    id: 'accuracy-90',
    title: 'Precision Master',
    description: 'Achieve 90% accuracy in a test',
    icon: '🎯',
    category: 'performance',
    requirement: { type: 'accuracy', count: 90 }
  },
  {
    id: 'accuracy-100',
    title: 'Perfect Score',
    description: 'Achieve 100% accuracy in a test',
    icon: '⭐',
    category: 'performance',
    requirement: { type: 'accuracy', count: 100 }
  },
  {
    id: 'speed-demon',
    title: 'Speed Demon',
    description: 'Complete a test with 2+ minutes remaining',
    icon: '⚡',
    category: 'performance',
    requirement: { type: 'time_remaining', count: 120 }
  },
  {
    id: 'night-owl',
    title: 'Night Owl',
    description: 'Complete a test between 10 PM and 6 AM',
    icon: '🦉',
    category: 'special',
    requirement: { type: 'night_test', count: 1 }
  },
  {
    id: 'early-bird',
    title: 'Early Bird',
    description: 'Complete a test before 8 AM',
    icon: '🐦',
    category: 'special',
    requirement: { type: 'early_test', count: 1 }
  },
  {
    id: 'comeback-kid',
    title: 'Comeback Kid',
    description: 'Improve your score by 20+ points',
    icon: '📈',
    category: 'improvement',
    requirement: { type: 'score_improvement', count: 20 }
  },
  {
    id: 'consistent-performer',
    title: 'Consistent Performer',
    description: 'Score above 80% in 5 consecutive tests',
    icon: '🎪',
    category: 'performance',
    requirement: { type: 'consistent_high_scores', count: 5 }
  },
  {
    id: 'subject-expert-quant',
    title: 'Quant Expert',
    description: 'Complete 20 Quantitative Aptitude tests',
    icon: '🔢',
    category: 'subject',
    requirement: { type: 'subject_tests', subject: 'Quantitative Aptitude', count: 20 }
  },
  {
    id: 'subject-expert-reasoning',
    title: 'Reasoning Expert',
    description: 'Complete 20 Reasoning tests',
    icon: '🧩',
    category: 'subject',
    requirement: { type: 'subject_tests', subject: 'Reasoning', count: 20 }
  },
  {
    id: 'bookmark-collector',
    title: 'Collector',
    description: 'Save 50 bookmarks',
    icon: '🔖',
    category: 'engagement',
    requirement: { type: 'bookmarks', count: 50 }
  }
]

// @route   GET /api/achievements
// @desc    Get all achievements with user progress
// @access  Private
router.get('/', async (req, res) => {
  try {
    // Get user's earned achievements
    const userAchievements = await global.dbHelpers.find('userAchievements', {
      userId: req.user.id,
      isActive: true
    })
    
    // Get user's stats for progress calculation
    const userStats = await calculateUserStats(req.user.id)
    
    // Combine definitions with user progress
    const achievements = ACHIEVEMENT_DEFINITIONS.map(def => {
      const earned = userAchievements.find(ua => ua.achievementId === def.id)
      const progress = calculateProgress(def, userStats)
      
      return {
        ...def,
        earned: !!earned,
        earnedAt: earned?.earnedAt || null,
        progress: Math.min(100, progress),
        currentValue: getCurrentValue(def, userStats)
      }
    })
    
    // Calculate summary stats
    const earnedCount = achievements.filter(a => a.earned).length
    const totalCount = achievements.length
    
    res.json({
      success: true,
      data: achievements,
      summary: {
        earned: earnedCount,
        total: totalCount,
        percentage: Math.round((earnedCount / totalCount) * 100),
        recentAchievements: userAchievements
          .sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt))
          .slice(0, 5)
          .map(ua => ({
            ...ACHIEVEMENT_DEFINITIONS.find(d => d.id === ua.achievementId),
            earnedAt: ua.earnedAt
          }))
      }
    })
  } catch (error) {
    console.error('Get achievements error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   GET /api/achievements/check
// @desc    Check and award new achievements
// @access  Private
router.get('/check', async (req, res) => {
  try {
    const newAchievements = await checkAndAwardAchievements(req.user.id)
    
    res.json({
      success: true,
      newAchievements,
      count: newAchievements.length
    })
  } catch (error) {
    console.error('Check achievements error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   GET /api/achievements/leaderboard
// @desc    Get top users by achievement count
// @access  Private
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 10 } = req.query
    
    // Get all user achievements
    const allAchievements = await global.dbHelpers.find('userAchievements', {
      isActive: true
    })
    
    // Group by user and count
    const userCounts = {}
    allAchievements.forEach(ua => {
      if (!userCounts[ua.userId]) {
        userCounts[ua.userId] = { count: 0, achievements: [] }
      }
      userCounts[ua.userId].count++
      userCounts[ua.userId].achievements.push(ua.achievementId)
    })
    
    // Get user details
    const topUsers = await Promise.all(
      Object.entries(userCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, limit)
        .map(async ([userId, data]) => {
          const user = await global.dbHelpers.findById('users', userId)
          return {
            userId,
            name: user?.name || 'Anonymous',
            achievementCount: data.count,
            rank: 0 // Will be assigned below
          }
        })
    )
    
    // Assign ranks
    topUsers.forEach((user, index) => {
      user.rank = index + 1
    })
    
    res.json({
      success: true,
      data: topUsers
    })
  } catch (error) {
    console.error('Get achievement leaderboard error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// Helper function to calculate user stats
async function calculateUserStats(userId) {
  const stats = {
    testsCompleted: 0,
    totalAccuracy: 0,
    dayStreak: 0,
    bookmarks: 0,
    subjectTests: {},
    lastTestDate: null,
    consecutiveHighScores: 0
  }
  
  try {
    // Get test results
    const results = await global.dbHelpers.find('results', {
      userId,
      isCompleted: true,
      isActive: true
    })
    
    stats.testsCompleted = results.length
    
    if (results.length > 0) {
      // Calculate average accuracy
      const totalAccuracy = results.reduce((sum, r) => sum + (parseFloat(r.accuracy) || 0), 0)
      stats.totalAccuracy = totalAccuracy / results.length
      
      // Get last test date for streak calculation
      const sortedResults = results.sort((a, b) => 
        new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt)
      )
      stats.lastTestDate = sortedResults[0]?.submittedAt || sortedResults[0]?.createdAt
      
      // Calculate day streak
      stats.dayStreak = calculateDayStreak(sortedResults.map(r => r.submittedAt || r.createdAt))
      
      // Count high scores (80%+ accuracy)
      let consecutiveHigh = 0
      let maxConsecutiveHigh = 0
      sortedResults.forEach(r => {
        if ((parseFloat(r.accuracy) || 0) >= 80) {
          consecutiveHigh++
          maxConsecutiveHigh = Math.max(maxConsecutiveHigh, consecutiveHigh)
        } else {
          consecutiveHigh = 0
        }
      })
      stats.consecutiveHighScores = maxConsecutiveHigh
    }
    
    // Get bookmarks count
    const bookmarks = await global.dbHelpers.find('bookmarks', {
      userId,
      isActive: true
    })
    stats.bookmarks = bookmarks.length
    
  } catch (error) {
    console.error('Error calculating user stats:', error)
  }
  
  return stats
}

// Helper function to calculate progress percentage
function calculateProgress(definition, stats) {
  const req = definition.requirement
  
  switch (req.type) {
    case 'tests_completed':
      return (stats.testsCompleted / req.count) * 100
    case 'day_streak':
      return (stats.dayStreak / req.count) * 100
    case 'accuracy':
      return stats.totalAccuracy >= req.count ? 100 : (stats.totalAccuracy / req.count) * 100
    case 'bookmarks':
      return (stats.bookmarks / req.count) * 100
    case 'consistent_high_scores':
      return (stats.consecutiveHighScores / req.count) * 100
    default:
      return 0
  }
}

// Helper function to get current value for progress
function getCurrentValue(definition, stats) {
  const req = definition.requirement
  
  switch (req.type) {
    case 'tests_completed':
      return stats.testsCompleted
    case 'day_streak':
      return stats.dayStreak
    case 'accuracy':
      return Math.round(stats.totalAccuracy)
    case 'bookmarks':
      return stats.bookmarks
    case 'consistent_high_scores':
      return stats.consecutiveHighScores
    default:
      return 0
  }
}

// Helper function to calculate day streak
function calculateDayStreak(dates) {
  if (dates.length === 0) return 0
  
  const uniqueDays = [...new Set(dates.map(d => new Date(d).toDateString()))]
    .sort((a, b) => new Date(b) - new Date(a))
  
  if (uniqueDays.length === 0) return 0
  
  let streak = 1
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  
  // Check if tested today or yesterday
  if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) {
    return 0
  }
  
  for (let i = 0; i < uniqueDays.length - 1; i++) {
    const current = new Date(uniqueDays[i])
    const next = new Date(uniqueDays[i + 1])
    const diffDays = (current - next) / (1000 * 60 * 60 * 24)
    
    if (diffDays === 1) {
      streak++
    } else {
      break
    }
  }
  
  return streak
}

// Helper function to check and award achievements
async function checkAndAwardAchievements(userId) {
  const newAchievements = []
  
  try {
    const stats = await calculateUserStats(userId)
    const existingAchievements = await global.dbHelpers.find('userAchievements', {
      userId,
      isActive: true
    })
    
    const earnedIds = existingAchievements.map(ea => ea.achievementId)
    
    for (const def of ACHIEVEMENT_DEFINITIONS) {
      if (earnedIds.includes(def.id)) continue
      
      const progress = calculateProgress(def, stats)
      
      if (progress >= 100) {
        // Award achievement
        await global.dbHelpers.insertOne('userAchievements', {
          userId,
          achievementId: def.id,
          earnedAt: new Date().toISOString(),
          isActive: true
        })
        
        newAchievements.push(def)
      }
    }
  } catch (error) {
    console.error('Error checking achievements:', error)
  }
  
  return newAchievements
}

export default router
