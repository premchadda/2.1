import express from 'express'
import { pool } from '../../infrastructure/database/postgres-helpers.js'
import { protect, admin } from '../../middleware/auth.middleware.js'

const router = express.Router()

// CRITICAL SECURITY FIX: Add authentication and admin middleware to all admin routes
router.use(protect)
router.use(admin)

// Get all subscription plans (admin)
router.get('/admin/plans', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM subscription_plans ORDER BY sort_order`
    )
    res.json({ plans: result.rows })
  } catch (error) {
    console.error('Error fetching plans:', error)
    res.status(500).json({ error: 'Failed to fetch plans' })
  }
})

// Create/Update subscription plan (admin)
router.post('/admin/plans', async (req, res) => {
  try {
    const { planId, name, price, originalPrice, period, features, buttonText, buttonClass, popular, savings, isActive, sortOrder } = req.body
    
    const result = await pool.query(`
      INSERT INTO subscription_plans (plan_id, name, price, original_price, period, features, button_text, button_class, popular, savings, is_active, sort_order, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      ON CONFLICT (plan_id) DO UPDATE SET
        name = $2,
        price = $3,
        original_price = $4,
        period = $5,
        features = $6,
        button_text = $7,
        button_class = $8,
        popular = $9,
        savings = $10,
        is_active = $11,
        sort_order = $12,
        updated_at = NOW()
      RETURNING *
    `, [planId, name, price, originalPrice, period, JSON.stringify(features), buttonText, buttonClass, popular, savings, isActive, sortOrder])
    
    res.json({ success: true, plan: result.rows[0] })
  } catch (error) {
    console.error('Error creating plan:', error)
    res.status(500).json({ error: 'Failed to create plan' })
  }
})

// Delete subscription plan (admin)
router.delete('/admin/plans/:planId', async (req, res) => {
  try {
    const { planId } = req.params
    
    await pool.query(
      `UPDATE subscription_plans SET is_active = false, updated_at = NOW() WHERE plan_id = $1`,
      [planId]
    )
    
    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting plan:', error)
    res.status(500).json({ error: 'Failed to delete plan' })
  }
})

// Get all subscription features (admin)
router.get('/admin/features', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM subscription_features ORDER BY plan_type, feature_key`
    )
    
    // Group by plan_type
    const featuresByPlan = {}
    result.rows.forEach(f => {
      if (!featuresByPlan[f.plan_type]) {
        featuresByPlan[f.plan_type] = []
      }
      featuresByPlan[f.plan_type].push(f)
    })
    
    res.json({ features: result.rows, featuresByPlan })
  } catch (error) {
    console.error('Error fetching features:', error)
    res.status(500).json({ error: 'Failed to fetch features' })
  }
})

// Update feature (admin)
router.put('/admin/features/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { isEnabled, limitValue } = req.body
    
    await pool.query(
      `UPDATE subscription_features SET is_enabled = $1, limit_value = $2 WHERE id = $3`,
      [isEnabled, limitValue, id]
    )
    
    res.json({ success: true })
  } catch (error) {
    console.error('Error updating feature:', error)
    res.status(500).json({ error: 'Failed to update feature' })
  }
})

// Get subscriber analytics (admin)
router.get('/admin/analytics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    
    let dateFilter = ''
    const params = []
    
    if (startDate && endDate) {
      dateFilter = `AND created_at BETWEEN $1 AND $2`
      params.push(startDate, endDate)
    }
    
    // Total subscribers
    const totalSubs = await pool.query(
      `SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active' AND expiry_date > NOW()`,
      []
    )
    
    // Subscribers by plan
    const byPlan = await pool.query(
      `SELECT plan_type, COUNT(*) as count 
       FROM subscriptions 
       WHERE status = 'active' AND expiry_date > NOW()
       GROUP BY plan_type`,
      []
    )
    
    // New subscriptions in period
    const newSubs = await pool.query(
      `SELECT COUNT(*) as count FROM subscriptions WHERE 1=1 ${dateFilter}`,
      params
    )
    
    // Revenue (approximate)
    const revenue = await pool.query(
      `SELECT SUM(amount_paid) as total FROM subscriptions WHERE status = 'active' ${dateFilter}`,
      params
    )
    
    // Top users by attempts
    const topUsers = await pool.query(
      `SELECT u.name, u.email, COUNT(ta.id) as attempts, MAX(ta.created_at) as last_attempt
       FROM users u
       JOIN attempts ta ON ta.user_id = u.id
       GROUP BY u.id, u.name, u.email
       ORDER BY attempts DESC
       LIMIT 10`,
      []
    )
    
    res.json({
      totalSubscribers: parseInt(totalSubs.rows[0].count) || 0,
      subscribersByPlan: byPlan.rows,
      newSubscriptions: parseInt(newSubs.rows[0].count) || 0,
      totalRevenue: parseFloat(revenue.rows[0].total) || 0,
      topUsers: topUsers.rows
    })
  } catch (error) {
    console.error('Error fetching analytics:', error)
    res.status(500).json({ error: 'Failed to fetch analytics' })
  }
})

// Get all active subscriptions (admin)
router.get('/admin/subscriptions', async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'active' } = req.query
    const offset = (page - 1) * limit
    
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM subscriptions WHERE status = $1`,
      [status]
    )
    
    const result = await pool.query(
      `SELECT s.*, u.name, u.email 
       FROM subscriptions s
       JOIN users u ON u.id = s.user_id
       WHERE s.status = $1
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, limit, offset]
    )
    
    res.json({
      subscriptions: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit)
    })
  } catch (error) {
    console.error('Error fetching subscriptions:', error)
    res.status(500).json({ error: 'Failed to fetch subscriptions' })
  }
})

// Manually add subscription for user (admin)
router.post('/admin/subscriptions', async (req, res) => {
  try {
    const { userId, planType, startDate, expiryDate, paymentDetails } = req.body
    
    const result = await pool.query(
      `INSERT INTO subscriptions (user_id, plan_type, start_date, expiry_date, status, payment_method, transaction_id, amount_paid)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7)
       RETURNING *`,
      [
        userId,
        planType,
        new Date(startDate),
        new Date(expiryDate),
        paymentDetails?.payment_method,
        paymentDetails?.transaction_id,
        paymentDetails?.amount_paid
      ]
    )
    
    // Update user pro status
    await pool.query(
      `UPDATE users SET is_pro_user = true, pro_expiry = $1, pass_type = $2 WHERE id = $3`,
      [expiryDate, planType, userId]
    )
    
    res.json({ success: true, subscription: result.rows[0] })
  } catch (error) {
    console.error('Error creating subscription:', error)
    res.status(500).json({ error: 'Failed to create subscription' })
  }
})

// Cancel user subscription (admin)
router.delete('/admin/subscriptions/:subscriptionId', async (req, res) => {
  try {
    const { subscriptionId } = req.params
    
    // Get subscription to update user
    const sub = await pool.query(
      `SELECT user_id FROM subscriptions WHERE id = $1`,
      [subscriptionId]
    )
    
    await pool.query(
      `UPDATE subscriptions SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [subscriptionId]
    )
    
    // Check if user has other active subscriptions
    const activeSubs = await pool.query(
      `SELECT COUNT(*) as count FROM subscriptions WHERE user_id = $1 AND status = 'active' AND expiry_date > NOW()`,
      [sub.rows[0]?.user_id]
    )
    
    if (parseInt(activeSubs.rows[0].count) === 0) {
      await pool.query(
        `UPDATE users SET is_pro_user = false, pro_expiry = NULL, pass_type = NULL WHERE id = $1`,
        [sub.rows[0]?.user_id]
      )
    }
    
    res.json({ success: true })
  } catch (error) {
    console.error('Error cancelling subscription:', error)
    res.status(500).json({ error: 'Failed to cancel subscription' })
  }
})

export default router
