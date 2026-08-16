import express from 'express'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { auth } from '../../middleware/auth.middleware.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router()

/**
 * GET /api/notifications
 * Get user notifications (authenticated)
 */
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id
    const { read, page = 1, limit = 20 } = req.query

    let query = 'SELECT id, user_id, type, title, message, data, image, action_url, action_text, is_read, read_at, sent_via, scheduled_at, is_sent, sent_at, priority, expires_at, created_at, updated_at, is_active, public_id_uuid, public_id, channel, is_deleted, deleted_at, deleted_by, read, metadata FROM notifications WHERE user_id = $1'
    const params = [userId]
    let paramCount = 2

    if (read === 'true') {
      query += ` AND read = true`
    } else if (read === 'false') {
      query += ` AND read = false`
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`
    params.push(limit, (page - 1) * limit)

    const result = await dbHelpers.query(query, params)

    // Get unread count
    const unreadResult = await dbHelpers.query(
      'SELECT COUNT(*) as unread FROM notifications WHERE user_id = $1 AND read = false',
      [userId]
    )

    res.json({
      success: true,
      data: result.rows,
      unreadCount: parseInt(unreadResult.rows[0].unread),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: sanitizeErrorMessage(error) })
  }
})

/**
 * PUT /api/notifications/:id/read
 * Mark notification as read (authenticated)
 */
router.put('/:id/read', auth, async (req, res) => {
  try {
    const userId = req.user.id
    const { id } = req.params

    const result = await dbHelpers.query(
      `UPDATE notifications SET read = true, updated_at = NOW() 
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Notification not found' })
    }

    res.json({ success: true, data: result.rows[0] })
  } catch (error) {
    res.status(500).json({ success: false, error: sanitizeErrorMessage(error) })
  }
})

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read (authenticated)
 */
router.put('/read-all', auth, async (req, res) => {
  try {
    const userId = req.user.id

    await dbHelpers.query(
      `UPDATE notifications SET read = true, updated_at = NOW() 
       WHERE user_id = $1 AND read = false`,
      [userId]
    )

    res.json({ success: true, message: 'All notifications marked as read' })
  } catch (error) {
    res.status(500).json({ success: false, error: sanitizeErrorMessage(error) })
  }
})

/**
 * DELETE /api/notifications/:id
 * Delete notification (authenticated)
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const userId = req.user.id
    const { id } = req.params

    await dbHelpers.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [id, userId]
    )

    res.json({ success: true, message: 'Notification deleted' })
  } catch (error) {
    res.status(500).json({ success: false, error: sanitizeErrorMessage(error) })
  }
})

/**
 * POST /api/notifications/subscribe
 * Subscribe to notifications (authenticated)
 */
router.post('/subscribe', auth, async (req, res) => {
  try {
    const userId = req.user.id
    const { type, email, sms, push } = req.body

    // M33: validate notification type against a known allowlist to prevent
    // arbitrary row insertion via spoofed topics.
    const ALLOWED_TYPES = ['coming_soon', 'marketing', 'product', 'security', 'system']
    if (!type || !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid notification type. Allowed: ${ALLOWED_TYPES.join(', ')}`,
      })
    }

    await dbHelpers.query(
      `INSERT INTO notification_preferences (user_id, notification_type, email, sms, push, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, notification_type) DO UPDATE SET 
       email = $3, sms = $4, push = $5, updated_at = NOW()`,
      [userId, type, email, sms, push]
    )

    res.json({ success: true, message: 'Subscription updated' })
  } catch (error) {
    res.status(500).json({ success: false, error: sanitizeErrorMessage(error) })
  }
})

export default router
