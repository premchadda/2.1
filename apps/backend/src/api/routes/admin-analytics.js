import express from 'express'
import { protect, admin } from '../../middleware/auth.middleware.js'
import { pool } from '../../infrastructure/database/postgres-helpers.js'

const router = express.Router()

// Apply authentication and admin authorization to all routes
router.use(protect)
router.use(admin)

/**
 * GET /admin/analytics/funnel
 * Get user conversion funnel analysis
 * Shows progression: Registered → Active → Enrolled → Test Takers → Subscribed
 */
router.get('/funnel', async (req, res) => {
  try {
    const client = await pool.connect()
    
    try {
      // Stage 1: Total registered users
      const totalUsersResult = await client.query(
        'SELECT COUNT(*) as count FROM users WHERE role = $1',
        ['user']
      )
      const totalUsers = parseInt(totalUsersResult.rows[0].count)
      
      // Stage 2: Active users (logged in within last 30 days)
      const activeUsersResult = await client.query(
        `SELECT COUNT(DISTINCT user_id) as count 
         FROM sessions 
         WHERE created_at > NOW() - INTERVAL '30 days'`
      )
      const activeUsers = parseInt(activeUsersResult.rows[0].count) || 0
      
      // Stage 3: Enrolled users (have at least one enrollment)
      const enrolledUsersResult = await client.query(
        'SELECT COUNT(DISTINCT user_id) as count FROM enrollments'
      )
      const enrolledUsers = parseInt(enrolledUsersResult.rows[0].count)
      
      // Stage 4: Test takers (have attempted at least one test)
      const testTakersResult = await client.query(
        'SELECT COUNT(DISTINCT user_id) as count FROM test_attempts'
      )
      const testTakers = parseInt(testTakersResult.rows[0].count)
      
      // Stage 5: Subscribed users (active subscription)
      const subscribedUsersResult = await client.query(
        `SELECT COUNT(DISTINCT user_id) as count 
         FROM subscriptions 
         WHERE status = 'active' 
         AND end_date > NOW()`
      )
      const subscribedUsers = parseInt(subscribedUsersResult.rows[0].count) || 0
      
      // Calculate conversion rates
      const funnelStages = [
        {
          name: 'Registered Users',
          count: totalUsers,
          conversion_rate: 100,
          drop_off_rate: 0,
          description: 'Total user registrations'
        },
        {
          name: 'Active Users',
          count: activeUsers,
          conversion_rate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0,
          drop_off_rate: totalUsers > 0 ? (((totalUsers - activeUsers) / totalUsers) * 100).toFixed(2) : 0,
          description: 'Users active in last 30 days'
        },
        {
          name: 'Enrolled Users',
          count: enrolledUsers,
          conversion_rate: totalUsers > 0 ? ((enrolledUsers / totalUsers) * 100).toFixed(2) : 0,
          drop_off_rate: activeUsers > 0 ? (((activeUsers - enrolledUsers) / activeUsers) * 100).toFixed(2) : 0,
          description: 'Users enrolled in at least one test series'
        },
        {
          name: 'Test Takers',
          count: testTakers,
          conversion_rate: totalUsers > 0 ? ((testTakers / totalUsers) * 100).toFixed(2) : 0,
          drop_off_rate: enrolledUsers > 0 ? (((enrolledUsers - testTakers) / enrolledUsers) * 100).toFixed(2) : 0,
          description: 'Users who attempted at least one test'
        },
        {
          name: 'Subscribed Users',
          count: subscribedUsers,
          conversion_rate: totalUsers > 0 ? ((subscribedUsers / totalUsers) * 100).toFixed(2) : 0,
          drop_off_rate: testTakers > 0 ? (((testTakers - subscribedUsers) / testTakers) * 100).toFixed(2) : 0,
          description: 'Users with active subscriptions'
        }
      ]
      
      res.json({
        success: true,
        data: {
          stages: funnelStages,
          summary: {
            total_users: totalUsers,
            overall_conversion: totalUsers > 0 ? ((subscribedUsers / totalUsers) * 100).toFixed(2) : 0,
            biggest_dropoff: funnelStages.reduce((prev, curr) => 
              parseFloat(curr.drop_off_rate) > parseFloat(prev.drop_off_rate) ? curr : prev
            )
          }
        }
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Funnel analytics error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch funnel analytics',
      details: error.message
    })
  }
})

/**
 * GET /admin/analytics/cohort
 * Get cohort-based retention analysis
 * Query params: period (weekly|monthly), months (number of months to look back)
 */
router.get('/cohort', async (req, res) => {
  try {
    const { period = 'monthly', months = 6 } = req.query
    const dateTrunc = period === 'weekly' ? 'week' : 'month'
    // FIX CRIT-04: Calculate interval as integer for parameterized query
    const intervalDays = period === 'weekly' ? parseInt(months) * 4 * 7 : parseInt(months) * 30
    
    const client = await pool.connect()
    
    try {
      // Get user cohorts by registration period
      // FIX CRIT-04: Use parameterized make_interval instead of string interpolation
      const cohortQuery = `
        WITH user_cohorts AS (
          SELECT 
            DATE_TRUNC($1, created_at) as cohort_period,
            COUNT(*) as user_count
          FROM users
          WHERE role = 'user'
          AND created_at > NOW() - make_interval(days => $2)
          GROUP BY DATE_TRUNC($1, created_at)
          ORDER BY cohort_period DESC
          LIMIT $3
        )
        SELECT * FROM user_cohorts
      `
      
      const { rows: cohorts } = await client.query(cohortQuery, [dateTrunc, intervalDays, parseInt(months)])
      
      // For each cohort, calculate retention at different time intervals
      const cohortsWithRetention = []
      
      for (const cohort of cohorts) {
        const cohortDate = new Date(cohort.cohort_period)
        const retentionRates = []
        
        // Calculate retention for periods 1-6
        for (let i = 1; i <= 6; i++) {
          const periodDate = new Date(cohortDate)
          if (period === 'weekly') {
            periodDate.setDate(periodDate.getDate() + (i * 7))
          } else {
            periodDate.setMonth(periodDate.getMonth() + i)
          }
          
          const retentionQuery = `
            SELECT COUNT(DISTINCT s.user_id) as active_users
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE DATE_TRUNC($1, u.created_at) = $2
            AND s.created_at >= $3
            AND s.created_at < $4
          `
          
          const nextPeriodDate = new Date(periodDate)
          if (period === 'weekly') {
            nextPeriodDate.setDate(nextPeriodDate.getDate() + 7)
          } else {
            nextPeriodDate.setMonth(nextPeriodDate.getMonth() + 1)
          }
          
          const { rows } = await client.query(retentionQuery, [
            dateTrunc,
            cohort.cohort_period,
            periodDate,
            nextPeriodDate
          ])
          
          const activeUsers = parseInt(rows[0].active_users)
          const retentionRate = cohort.user_count > 0 
            ? ((activeUsers / cohort.user_count) * 100).toFixed(2) 
            : 0
          
          retentionRates.push({
            period: i,
            active_users: activeUsers,
            retention_rate: parseFloat(retentionRate)
          })
        }
        
        cohortsWithRetention.push({
          cohort_period: cohort.cohort_period.toISOString().split('T')[0],
          user_count: parseInt(cohort.user_count),
          retention_rates: retentionRates
        })
      }
      
      res.json({
        success: true,
        data: {
          cohorts: cohortsWithRetention,
          period: period,
          months: parseInt(months)
        }
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Cohort analytics error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cohort analytics',
      details: error.message
    })
  }
})

/**
 * GET /admin/analytics/engagement
 * Get user engagement metrics over time
 * Query params: range (7d|30d|90d), granularity (daily|weekly)
 */
router.get('/engagement', async (req, res) => {
  try {
    const { range = '30d', granularity = 'daily' } = req.query
    const days = Math.min(365, Math.max(1, parseInt(range.replace('d', ''))))
    const dateTrunc = granularity === 'weekly' ? 'week' : 'day'
    
    const client = await pool.connect()
    
    try {
      // FIX CRIT-04: Use parameterized make_interval instead of string interpolation
      // Daily/Weekly Active Users
      const dauQuery = `
        SELECT 
          DATE_TRUNC($1, created_at) as date,
          COUNT(DISTINCT user_id) as daily_active
        FROM sessions
        WHERE created_at > NOW() - make_interval(days => $2)
        GROUP BY DATE_TRUNC($1, created_at)
        ORDER BY date ASC
      `
      
      const { rows: dauData } = await client.query(dauQuery, [dateTrunc, days])
      
      // Test attempts over time
      const testAttemptsQuery = `
        SELECT 
          DATE_TRUNC($1, created_at) as date,
          COUNT(*) as attempts,
          COUNT(DISTINCT user_id) as unique_test_takers,
          AVG(score) as avg_score
        FROM test_attempts
        WHERE created_at > NOW() - make_interval(days => $2)
        GROUP BY DATE_TRUNC($1, created_at)
        ORDER BY date ASC
      `
      
      const { rows: testAttemptsData } = await client.query(testAttemptsQuery, [dateTrunc, days])
      
      // New enrollments over time
      const enrollmentsQuery = `
        SELECT 
          DATE_TRUNC($1, created_at) as date,
          COUNT(*) as new_enrollments
        FROM enrollments
        WHERE created_at > NOW() - make_interval(days => $2)
        GROUP BY DATE_TRUNC($1, created_at)
        ORDER BY date ASC
      `
      
      const { rows: enrollmentsData } = await client.query(enrollmentsQuery, [dateTrunc, days])
      
      // Calculate summary statistics
      const totalDau = dauData.reduce((sum, row) => sum + parseInt(row.daily_active), 0)
      const avgDau = dauData.length > 0 ? (totalDau / dauData.length).toFixed(2) : 0
      
      const totalAttempts = testAttemptsData.reduce((sum, row) => sum + parseInt(row.attempts), 0)
      const avgScore = testAttemptsData.length > 0 
        ? (testAttemptsData.reduce((sum, row) => sum + parseFloat(row.avg_score || 0), 0) / testAttemptsData.length).toFixed(2)
        : 0
      
      const totalEnrollments = enrollmentsData.reduce((sum, row) => sum + parseInt(row.new_enrollments), 0)
      
      res.json({
        success: true,
        data: {
          summary: {
            avg_daily_active_users: parseFloat(avgDau),
            total_test_attempts: totalAttempts,
            avg_test_score: parseFloat(avgScore),
            total_new_enrollments: totalEnrollments,
            period_days: days
          },
          trends: {
            daily_active_users: dauData.map(row => ({
              date: row.date.toISOString().split('T')[0],
              count: parseInt(row.daily_active)
            })),
            test_attempts: testAttemptsData.map(row => ({
              date: row.date.toISOString().split('T')[0],
              attempts: parseInt(row.attempts),
              unique_users: parseInt(row.unique_test_takers),
              avg_score: parseFloat(row.avg_score || 0)
            })),
            enrollments: enrollmentsData.map(row => ({
              date: row.date.toISOString().split('T')[0],
              count: parseInt(row.new_enrollments)
            }))
          }
        }
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Engagement analytics error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch engagement analytics',
      details: error.message
    })
  }
})

export default router
