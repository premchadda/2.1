import express from 'express'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { protect, admin } from '../../middleware/auth.middleware.js'
import { idsMatch } from '../../services/core/common.js'
import { sanitizeErrorMessage } from '../../utils/sanitizeError.js';

const router = express.Router()

// @route   GET /api/discussions/question/:questionId
// @desc    Get discussions for a question (with pagination)
// @access  Public
router.get('/question/:questionId', async (req, res) => {
  try {
    const { page = 1, limit = 20, sortBy = 'newest' } = req.query
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)

    const discussions = await dbHelpers.find('questionDiscussions', { 
      questionId: parseInt(req.params.questionId), 
      isActive: true 
    })

    // Sort discussions
    let sortedDiscussions = discussions
    if (sortBy === 'newest') {
      sortedDiscussions.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    } else if (sortBy === 'oldest') {
      sortedDiscussions.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    } else if (sortBy === 'popular') {
      sortedDiscussions.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0))
    }

    // Get discussion IDs for replies query
    const paginatedDiscussions = sortedDiscussions.slice((pageNum - 1) * limitNum, pageNum * limitNum)
    const discussionIds = paginatedDiscussions.map((d) => d.id || d._id).filter(Boolean)
    
    // Fetch replies for paginated discussions
    let replies = []
    if (discussionIds.length > 0) {
      replies = await dbHelpers.find('discussionReplies', { 
        discussionId: { $in: discussionIds }, 
        isActive: true 
      })
      
      if (replies.length === 0) {
        const snakeReplies = await dbHelpers.find('discussionReplies', { 
          discussion_id: { $in: discussionIds }, 
          isActive: true 
        })
        replies = [...snakeReplies]
      }
    }

    const data = paginatedDiscussions.map((discussion) => ({
      ...discussion,
      replies: replies.filter((reply) => idsMatch(reply.discussionId || reply.discussion_id, discussion.id || discussion._id)),
    }))

    res.json({ 
      success: true, 
      data,
      count: data.length,
      total: discussions.length,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: discussions.length,
        totalPages: Math.ceil(discussions.length / limitNum)
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/question/:questionId', protect, async (req, res) => {
  try {
    const content = String(req.body?.content || '').trim()
    if (!content) {
      return res.status(400).json({ success: false, message: 'content is required' })
    }

    const inserted = await dbHelpers.insertOne('questionDiscussions', {
      questionId: Number(req.params.questionId),
      userId: req.user.id,
      content,
      upvotes: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    res.status(201).json({ success: true, data: inserted })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/:discussionId/replies', protect, async (req, res) => {
  try {
    const content = String(req.body?.content || '').trim()
    if (!content) {
      return res.status(400).json({ success: false, message: 'content is required' })
    }

    const discussion = await dbHelpers.findById('questionDiscussions', req.params.discussionId)
    if (!discussion) {
      return res.status(404).json({ success: false, message: 'discussion not found' })
    }

    const inserted = await dbHelpers.insertOne('discussionReplies', {
      discussionId: discussion.id || discussion._id,
      userId: req.user.id,
      content,
      upvotes: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    res.status(201).json({ success: true, data: inserted })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/:discussionId/upvote', protect, async (req, res) => {
  try {
    const discussion = await dbHelpers.findById('questionDiscussions', req.params.discussionId)
    if (!discussion) {
      return res.status(404).json({ success: false, message: 'discussion not found' })
    }

    const vote = await dbHelpers.find('discussionVotes', {
      discussionId: discussion.id || discussion._id,
      userId: req.user.id,
    })
    if (vote.length > 0) {
      return res.status(400).json({ success: false, message: 'already upvoted' })
    }

    await dbHelpers.insertOne('discussionVotes', {
      discussionId: discussion.id || discussion._id,
      userId: req.user.id,
      voteType: 'upvote',
      createdAt: new Date().toISOString(),
    })
    const updated = await dbHelpers.updateById('questionDiscussions', discussion.id || discussion._id, {
      upvotes: Number(discussion.upvotes || 0) + 1,
      updatedAt: new Date().toISOString(),
    })

    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

router.post('/replies/:replyId/upvote', protect, async (req, res) => {
  try {
    const reply = await dbHelpers.findById('discussionReplies', req.params.replyId)
    if (!reply) {
      return res.status(404).json({ success: false, message: 'reply not found' })
    }

    const vote = await dbHelpers.find('discussionVotes', {
      replyId: reply.id || reply._id,
      userId: req.user.id,
    })
    if (vote.length > 0) {
      return res.status(400).json({ success: false, message: 'already upvoted' })
    }

    await dbHelpers.insertOne('discussionVotes', {
      replyId: reply.id || reply._id,
      userId: req.user.id,
      voteType: 'upvote',
      createdAt: new Date().toISOString(),
    })
    const updated = await dbHelpers.updateById('discussionReplies', reply.id || reply._id, {
      upvotes: Number(reply.upvotes || 0) + 1,
      updatedAt: new Date().toISOString(),
    })

    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// ===== DISCUSSION EDIT/DELETE ROUTES =====
// @route   PUT /api/discussions/:discussionId
// @desc    Edit a discussion post
// @access  Private
router.put('/:discussionId', protect, async (req, res) => {
  try {
    const { content } = req.body
    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, message: 'content is required' })
    }

    const discussion = await dbHelpers.findById('questionDiscussions', req.params.discussionId)
    if (!discussion) {
      return res.status(404).json({ success: false, message: 'discussion not found' })
    }

    // Check ownership or admin
    if (String(discussion.userId) !== String(req.user.id) && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'not authorized to edit this discussion' })
    }

    const updated = await dbHelpers.updateById('questionDiscussions', req.params.discussionId, {
      content: String(content).trim(),
      updatedAt: new Date().toISOString(),
    })

    res.json({ success: true, data: updated, message: 'Discussion updated successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// @route   DELETE /api/discussions/:discussionId
// @desc    Delete a discussion post (soft delete)
// @access  Private
router.delete('/:discussionId', protect, async (req, res) => {
  try {
    const discussion = await dbHelpers.findById('questionDiscussions', req.params.discussionId)
    if (!discussion) {
      return res.status(404).json({ success: false, message: 'discussion not found' })
    }

    // Check ownership or admin
    if (String(discussion.userId) !== String(req.user.id) && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'not authorized to delete this discussion' })
    }

    await dbHelpers.softDelete('questionDiscussions', req.params.discussionId, req.user.id)
    
    res.json({ success: true, message: 'Discussion deleted successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// @route   PUT /api/discussions/replies/:replyId
// @desc    Edit a reply
// @access  Private
router.put('/replies/:replyId', protect, async (req, res) => {
  try {
    const { content } = req.body
    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, message: 'content is required' })
    }

    const reply = await dbHelpers.findById('discussionReplies', req.params.replyId)
    if (!reply) {
      return res.status(404).json({ success: false, message: 'reply not found' })
    }

    // Check ownership or admin
    if (String(reply.userId) !== String(req.user.id) && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'not authorized to edit this reply' })
    }

    const updated = await dbHelpers.updateById('discussionReplies', req.params.replyId, {
      content: String(content).trim(),
      updatedAt: new Date().toISOString(),
    })

    res.json({ success: true, data: updated, message: 'Reply updated successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

// @route   DELETE /api/discussions/replies/:replyId
// @desc    Delete a reply (soft delete)
// @access  Private
router.delete('/replies/:replyId', protect, async (req, res) => {
  try {
    const reply = await dbHelpers.findById('discussionReplies', req.params.replyId)
    if (!reply) {
      return res.status(404).json({ success: false, message: 'reply not found' })
    }

    // Check ownership or admin
    if (String(reply.userId) !== String(req.user.id) && !req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'not authorized to delete this reply' })
    }

    await dbHelpers.softDelete('discussionReplies', req.params.replyId, req.user.id)
    
    res.json({ success: true, message: 'Reply deleted successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: sanitizeErrorMessage(error) })
  }
})

export default router

