import express from 'express'
import { protect, admin } from '../../middleware/auth.middleware.js'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { idsMatch } from '../../services/core/common.js'

const router = express.Router()

// @route   GET /api/notifications
// @desc    Get notifications for logged in user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { limit = 20, page = 1, unreadOnly = false } = req.query
    
    let query = { 
      userId: req.user.id,
      isActive: { $ne: false }
    }
    
    if (unreadOnly === 'true') {
      query.isRead = { $ne: true }
    }
    
    const notifications = await dbHelpers.find('notifications', query)
    
    // Format notifications for frontend
    const formattedNotifications = notifications
      .map(n => ({
        id: n._id || n.id,
        _id: n._id || n.id,
        title: n.title,
        message: n.message,
        type: n.type || 'general',
        read: n.isRead || false,
        isRead: n.isRead || false,
        time: getTimeAgo(n.createdAt),
        createdAt: n.createdAt,
        link: n.link || null
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    
    // Sort by createdAt desc and paginate
    const paginatedNotifications = formattedNotifications
      .slice((page - 1) * limit, page * limit)
    
    // Get unread count
    const unreadCount = formattedNotifications.filter(n => !n.read).length
    
    res.json({
      success: true,
      data: paginatedNotifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: notifications.length
      }
    })
  } catch (error) {
    console.error('Get notifications error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// Helper function to get time ago string
function getTimeAgo(dateString) {
  if (!dateString) return ''
  
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now - date) / 1000)
  
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// @route   GET /api/notifications/unread-count
// @desc    Get unread notification count
// @access  Private
router.get('/unread-count', protect, async (req, res) => {
  try {
    const notifications = await dbHelpers.find('notifications', {
      userId: req.user.id,
      isActive: true,
      isRead: false
    })
    
    res.json({
      success: true,
      count: notifications.length
    })
  } catch (error) {
    console.error('Get unread count error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   PUT /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notification = await dbHelpers.findById('notifications', req.params.id)
    
    if (!notification || !idsMatch(notification.userId, req.user.id)) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      })
    }
    
    const updated = await dbHelpers.updateById('notifications', req.params.id, {
      isRead: true,
      readAt: new Date().toISOString()
    })
    
    res.json({
      success: true,
      data: updated,
      message: 'Notification marked as read'
    })
  } catch (error) {
    console.error('Mark read error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', protect, async (req, res) => {
  try {
    const result = await dbHelpers.pool.query(
      `UPDATE notifications 
       SET is_read = true, updated_at = NOW() 
       WHERE user_id = $1 AND is_active = true AND is_read = false`,
      [String(req.user.id)]
    )
    
    res.json({
      success: true,
      message: 'All notifications marked as read',
      count: result.rowCount || 0
    })
  } catch (error) {
    console.error('Mark all read error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   DELETE /api/notifications/clear-all
// @desc    Clear (soft-delete) all notifications for the authenticated user
// @access  Private
router.delete('/clear-all', protect, async (req, res) => {
  try {
    // Use the ORM so column-name mapping (camelCase <-> snake_case) is handled
    // consistently with the single-delete route. Avoids raw SQL pitfalls where
    // columns like `deleted_at` may not exist on the notifications table.
    const notifications = await dbHelpers.find('notifications', {
      userId: req.user.id,
      isActive: true
    })

    await Promise.all(
      notifications.map(n =>
        dbHelpers.updateById('notifications', n._id || n.id, {
          isActive: false,
          updatedAt: new Date().toISOString()
        })
      )
    )

    res.json({
      success: true,
      message: 'All notifications cleared',
      count: notifications.length
    })
  } catch (error) {
    console.error('Clear all notifications error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   DELETE /api/notifications/:id
// @desc    Delete notification
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const notification = await dbHelpers.findById('notifications', req.params.id)
    
    if (!notification || !idsMatch(notification.userId, req.user.id)) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      })
    }
    
    await dbHelpers.updateById('notifications', req.params.id, {
      isActive: false,
      deletedAt: new Date().toISOString()
    })
    
    res.json({
      success: true,
      message: 'Notification deleted'
    })
  } catch (error) {
    console.error('Delete notification error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// ============================================
// ADMIN ROUTES
// ============================================

// @route   POST /api/notifications/admin/send
// @desc    Send notification to specific user (Admin only)
// @access  Private/Admin
router.post('/admin/send', protect, admin, async (req, res) => {
  try {
    const { userId, title, message, type = 'general', link } = req.body
    
    if (!userId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'userId, title, and message are required'
      })
    }
    
    const notification = await dbHelpers.insertOne('notifications', {
      userId,
      title,
      message,
      type,
      link: link || null,
      isRead: false,
      isActive: true,
      createdAt: new Date().toISOString()
    })
    
    res.status(201).json({
      success: true,
      data: notification,
      message: 'Notification sent successfully'
    })
  } catch (error) {
    console.error('Send notification error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   POST /api/notifications/admin/broadcast
// @desc    Send notification to all users (Admin only)
// @access  Private/Admin
router.post('/admin/broadcast', protect, admin, async (req, res) => {
  try {
    const { title, message, type = 'general', link, filter } = req.body
    
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'title and message are required'
      })
    }
    
    // Validate title and message length
    if (title.length > 200 || message.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Title must be under 200 chars, message under 1000 chars'
      })
    }
    
    // Get all active users (or filtered) with limit (Issue #41)
    const MAX_BROADCAST_USERS = 10000 // Safety limit
    let userQuery = { isActive: true }
    if (filter?.role) {
      userQuery.role = filter.role
    }
    if (filter?.isPro) {
      userQuery.isProUser = filter.isPro === true
    }
    
    const users = await dbHelpers.find('users', userQuery)
    
    // Enforce maximum limit (Issue #41)
    if (users.length > MAX_BROADCAST_USERS) {
      return res.status(400).json({
        success: false,
        message: `Too many users (${users.length}). Maximum broadcast limit is ${MAX_BROADCAST_USERS}. Please use filters to narrow down the audience.`
      })
    }
    
    // Create notifications extremely fast via a single UNNEST INSERT mapping
    let createdCount = 0
    const now = new Date().toISOString()
    
    if (users.length > 0) {
      const userIds = users.map(u => String(u._id || u.id)).filter(Boolean)
      
      const metadata = JSON.stringify({ link: link || null })

      const insertQuery = `
        INSERT INTO notifications (user_id, title, message, type, metadata, is_read, is_active, created_at, updated_at)
        SELECT u.id, $1, $2, $3, $4, false, true, $5, $5
        FROM UNNEST($6::text[]) as u(id)
      `
      
      try {
        const result = await dbHelpers.pool.query(insertQuery, [
          title, message, type, metadata, now, userIds
        ])
        createdCount = result.rowCount
      } catch (err) {
        console.error("Batch insert failed:", err)
        throw err
      }
    }
    
    res.status(201).json({
      success: true,
      count: createdCount,
      message: `Notification sent to ${createdCount} users`
    })
  } catch (error) {
    console.error('Broadcast notification error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

export default router
