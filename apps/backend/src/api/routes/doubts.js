import express from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import rateLimit from 'express-rate-limit'
import { idsMatch } from '../../services/core/common.js'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'

const router = express.Router()

// Rate limiting for content creation (Issue #36)
const contentCreationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 content creations per 15 minutes
  message: { success: false, message: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Sanitize user input to prevent XSS (Issue #37)
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input
  return input
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim()
}

const sanitizeDoubtInput = (data) => {
  const sanitized = {}
  if (data.title) sanitized.title = sanitizeInput(String(data.title).substring(0, 200))
  if (data.description) sanitized.description = sanitizeInput(String(data.description).substring(0, 5000))
  if (data.category) sanitized.category = sanitizeInput(String(data.category).substring(0, 50))
  if (data.tags && Array.isArray(data.tags)) {
    sanitized.tags = data.tags.slice(0, 10).map(tag => sanitizeInput(String(tag).substring(0, 50)))
  }
  return sanitized
}

const sanitizeDoubt = (doubt) => {
  if (!doubt) return doubt
  const { userEmail, ...safeDoubt } = doubt
  return safeDoubt
}

const sanitizeReply = (reply) => {
  if (!reply) return reply
  const { userEmail, ...safeReply } = reply
  return safeReply
}

// @route   GET /api/doubts
// @desc    Get all doubts/questions
// @access  Public (can filter by auth)
router.get('/', async (req, res) => {
  try {
    const { category, status, limit = 20, offset = 0, search } = req.query
    
    let doubts = await dbHelpers.find('doubts', { isActive: true })
    
    // Filter by category
    if (category && category !== 'all') {
      doubts = doubts.filter(d => d.category === category)
    }
    
    // Filter by status
    if (status && status !== 'all') {
      doubts = doubts.filter(d => d.status === status)
    }
    
    // Search
    if (search) {
      const searchLower = search.toLowerCase()
      doubts = doubts.filter(d => 
        d.title?.toLowerCase().includes(searchLower) || 
        d.description?.toLowerCase().includes(searchLower)
      )
    }
    
    // Sort by date and apply pagination
    doubts = doubts
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
    
    // Get reply counts for each doubt
    const doubtsWithCounts = await Promise.all(doubts.map(async (doubt) => {
      const replies = await dbHelpers.find('doubtReplies', { doubtId: doubt._id || doubt.id })
      return {
        ...sanitizeDoubt(doubt),
        replyCount: replies.length,
        isAnswered: replies.some(r => r.isAccepted)
      }
    }))
    
    res.json({
      success: true,
      data: doubtsWithCounts,
      count: doubtsWithCounts.length
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/doubts/:id
// @desc    Get single doubt with replies
// @access  Public
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (id === 'categories') return next()
    
    let doubt = await dbHelpers.findById('doubts', id)
    
    if (!doubt) {
      return res.status(404).json({ success: false, message: 'Doubt not found' })
    }
    
    // Get replies
    const replies = await dbHelpers.find('doubtReplies', { doubtId: doubt._id || doubt.id })
    const sortedReplies = replies.sort((a, b) => {
      // Put accepted answer first
      if (a.isAccepted && !b.isAccepted) return -1
      if (!a.isAccepted && b.isAccepted) return 1
      return new Date(b.createdAt) - new Date(a.createdAt)
    }).map(sanitizeReply)
    
    res.json({
      success: true,
      data: {
        ...sanitizeDoubt(doubt),
        replies: sortedReplies
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/doubts
// @desc    Create a new doubt/question
// @access  Private
router.post('/', protect, contentCreationLimiter, async (req, res) => {
  try {
    const { title, description, category, tags } = req.body
    
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description required' })
    }
    
    // Sanitize input (Issue #37)
    const sanitizedData = sanitizeDoubtInput({ title, description, category, tags })
    
    const doubt = await dbHelpers.insertOne('doubts', {
      ...sanitizedData,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      status: 'open',
      isActive: true,
      views: 0,
      createdAt: new Date().toISOString()
    })
    
    res.status(201).json({ success: true, data: sanitizeDoubt(doubt) })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   PUT /api/doubts/:id
// @desc    Update a doubt
// @access  Private (owner only)
router.put('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params
    const { title, description, category, tags, status } = req.body
    
    const doubt = await dbHelpers.findById('doubts', id)
    
    if (!doubt) {
      return res.status(404).json({ success: false, message: 'Doubt not found' })
    }
    
    if (!idsMatch(doubt.userId, req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' })
    }
    
    const updated = await dbHelpers.updateById('doubts', id, {
      ...(title && { title }),
      ...(description && { description }),
      ...(category && { category }),
      ...(tags && { tags }),
      ...(status && { status }),
      updatedAt: new Date().toISOString()
    })
    
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   DELETE /api/doubts/:id
// @desc    Delete a doubt
// @access  Private (owner only)
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params
    
    const doubt = await dbHelpers.findById('doubts', id)
    
    if (!doubt) {
      return res.status(404).json({ success: false, message: 'Doubt not found' })
    }
    
    if (!idsMatch(doubt.userId, req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' })
    }
    
    await dbHelpers.softDelete('doubts', id, req.user.id)
    
    res.json({ success: true, message: 'Doubt deleted' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/doubts/:id/reply
// @desc    Add a reply/answer to a doubt
// @access  Private
router.post('/:id/reply', protect, async (req, res) => {
  try {
    const { id } = req.params
    const { content, isAnswer } = req.body
    
    if (!content) {
      return res.status(400).json({ success: false, message: 'Content required' })
    }
    
    const doubt = await dbHelpers.findById('doubts', id)
    
    if (!doubt) {
      return res.status(404).json({ success: false, message: 'Doubt not found' })
    }
    
    const reply = await dbHelpers.insertOne('doubtReplies', {
      doubtId: doubt._id || doubt.id,
      content,
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      isAccepted: false,
      isActive: true,
      upvotes: 0,
      createdAt: new Date().toISOString()
    })
    
    // Update doubt status if it's an answer
    if (isAnswer) {
      await dbHelpers.updateById('doubts', id, {
        status: 'answered',
        updatedAt: new Date().toISOString()
      })
    }
    
    res.status(201).json({ success: true, data: reply })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   PUT /api/doubts/:id/reply/:replyId/accept
// @desc    Accept an answer
// @access  Private (doubt owner only)
router.put('/:id/reply/:replyId/accept', protect, async (req, res) => {
  try {
    const { replyId } = req.params
    
    const doubt = await dbHelpers.findById('doubts', req.params.id)
    
    if (!doubt) {
      return res.status(404).json({ success: false, message: 'Doubt not found' })
    }
    
    if (!idsMatch(doubt.userId, req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' })
    }
    
    // Unaccept all other replies
    const allReplies = await dbHelpers.find('doubtReplies', { doubtId: doubt._id || doubt.id })
    for (const reply of allReplies) {
      if (reply.isAccepted) {
        await dbHelpers.updateById('doubtReplies', reply._id || reply.id, { isAccepted: false })
      }
    }
    
    const replyToAccept = await dbHelpers.findById('doubtReplies', replyId)
    if (!replyToAccept || !idsMatch(replyToAccept.doubtId, doubt._id || doubt.id)) {
      return res.status(404).json({ success: false, message: 'Reply not found for this doubt' })
    }

    // Accept this reply
    const updated = await dbHelpers.updateById('doubtReplies', replyId, { isAccepted: true })
    
    // Update doubt status
    await dbHelpers.updateById('doubts', req.params.id, {
      status: 'answered',
      updatedAt: new Date().toISOString()
    })
    
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   PUT /api/doubts/:id/reply/:replyId/upvote
// @desc    Upvote a reply
// @access  Private
router.put('/:id/reply/:replyId/upvote', protect, async (req, res) => {
  try {
    const { replyId } = req.params
    
    const reply = await dbHelpers.findById('doubtReplies', replyId)
    
    if (!reply) {
      return res.status(404).json({ success: false, message: 'Reply not found' })
    }
    
    // Issue #34: Prevent duplicate upvotes
    const upvotedBy = reply.upvotedBy || []
    const userId = req.user.id
    
    // Check if user already upvoted
    if (upvotedBy.some(uid => idsMatch(uid, userId))) {
      return res.status(400).json({ 
        success: false, 
        message: 'You have already upvoted this reply' 
      })
    }
    
    // Add user to upvotedBy list and increment count
    const updated = await dbHelpers.updateById('doubtReplies', replyId, {
      upvotes: (reply.upvotes || 0) + 1,
      upvotedBy: [...upvotedBy, userId]
    })
    
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/doubts/categories
// @desc    Get doubt categories
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      { id: 'general', name: 'General', icon: '💬' },
      { id: 'mathematics', name: 'Mathematics', icon: '🔢' },
      { id: 'english', name: 'English', icon: '📝' },
      { id: 'reasoning', name: 'Reasoning', icon: '🧠' },
      { id: 'gk', name: 'General Knowledge', icon: '📚' },
      { id: 'current-affairs', name: 'Current Affairs', icon: '📰' },
      { id: 'technical', name: 'Technical', icon: '⚙️' }
    ]
    
    res.json({ success: true, data: categories })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
