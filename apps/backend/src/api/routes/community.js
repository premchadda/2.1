import express from 'express'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { protect, admin, optionalAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

// ===== COMMUNITY GROUPS CRUD =====
// @route   GET /api/community/groups
// @desc    Get all community groups (public)
// @access  Public
router.get('/groups', async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive, search } = req.query
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)

    const query = {}
    if (isActive !== undefined) {
      query.isActive = isActive === 'true'
    }

    let groups = await dbHelpers.find('communityGroups', query)

    // Filter by search
    if (search) {
      const searchTerm = search.toLowerCase()
      groups = groups.filter(g => 
        g.name?.toLowerCase().includes(searchTerm) ||
        g.description?.toLowerCase().includes(searchTerm) ||
        g.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
      )
    }

    // Sort by member count
    groups.sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))

    // Pagination
    const offset = (pageNum - 1) * limitNum
    const paginated = groups.slice(offset, offset + limitNum)

    res.json({
      success: true,
      data: paginated,
      count: paginated.length,
      total: groups.length,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: groups.length,
        totalPages: Math.ceil(groups.length / limitNum)
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/community/groups/:id
// @desc    Get a single community group
// @access  Public
router.get('/groups/:id', async (req, res) => {
  try {
    const group = await dbHelpers.findById('communityGroups', req.params.id)
    
    if (!group || (group.isActive === false && !req.user?.isAdmin)) {
      return res.status(404).json({ success: false, message: 'Group not found' })
    }

    res.json({ success: true, data: group })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/community/groups
// @desc    Create a community group
// @access  Private
router.post('/groups', protect, async (req, res) => {
  try {
    const { name, description, tags, isPublic, maxMembers, category } = req.body

    if (!name || !description) {
      return res.status(400).json({
        success: false,
        message: 'Name and description are required'
      })
    }

    const newGroup = await dbHelpers.insertOne('communityGroups', {
      name,
      description,
      tags: tags || [],
      isPublic: isPublic !== false,
      maxMembers: maxMembers || 1000,
      category: category || 'general',
      memberCount: 0,
      members: [req.user.id],
      admins: [req.user.id],
      rules: [],
      isActive: true,
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    res.status(201).json({
      success: true,
      data: newGroup,
      message: 'Community group created successfully'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   PUT /api/community/groups/:id
// @desc    Update a community group
// @access  Private (Admin only for group)
router.put('/groups/:id', protect, async (req, res) => {
  try {
    const { name, description, tags, isPublic, maxMembers, category, rules } = req.body

    const group = await dbHelpers.findById('communityGroups', req.params.id)
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' })
    }

    // Check if user is admin of group
    const isAdmin = group.admins?.some(id => String(id) === String(req.user.id)) || req.user.isAdmin
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to edit this group' })
    }

    const updateData = { updatedAt: new Date().toISOString() }
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (tags !== undefined) updateData.tags = tags
    if (isPublic !== undefined) updateData.isPublic = isPublic
    if (maxMembers !== undefined) updateData.maxMembers = maxMembers
    if (category !== undefined) updateData.category = category
    if (rules !== undefined) updateData.rules = rules

    const updated = await dbHelpers.updateById('communityGroups', req.params.id, updateData)
    
    res.json({
      success: true,
      data: updated,
      message: 'Group updated successfully'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   DELETE /api/community/groups/:id
// @desc    Delete a community group
// @access  Private (Admin only)
router.delete('/groups/:id', protect, admin, async (req, res) => {
  try {
    const group = await dbHelpers.findById('communityGroups', req.params.id)
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' })
    }

    await dbHelpers.softDelete('communityGroups', req.params.id, req.user.id)
    
    res.json({ success: true, message: 'Group deleted successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// ===== GROUP MEMBERSHIP =====
// @route   POST /api/community/groups/:id/join
// @desc    Join a community group
// @access  Private
router.post('/groups/:id/join', protect, async (req, res) => {
  try {
    const group = await dbHelpers.findById('communityGroups', req.params.id)
    if (!group || group.isActive === false) {
      return res.status(404).json({ success: false, message: 'Group not found' })
    }

    const members = group.members || []
    if (members.some(id => String(id) === String(req.user.id))) {
      return res.status(400).json({ success: false, message: 'Already a member' })
    }

    if (members.length >= (group.maxMembers || 1000)) {
      return res.status(400).json({ success: false, message: 'Group is full' })
    }

    await dbHelpers.updateById('communityGroups', req.params.id, {
      members: [...members, req.user.id],
      memberCount: members.length + 1,
      updatedAt: new Date().toISOString()
    })

    res.json({ success: true, message: 'Joined group successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/community/groups/:id/leave
// @desc    Leave a community group
// @access  Private
router.post('/groups/:id/leave', protect, async (req, res) => {
  try {
    const group = await dbHelpers.findById('communityGroups', req.params.id)
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' })
    }

    const members = group.members || []
    const updatedMembers = members.filter(id => String(id) !== String(req.user.id))

    if (updatedMembers.length === members.length) {
      return res.status(400).json({ success: false, message: 'Not a member' })
    }

    // Prevent admins from leaving if they're the only admin
    const admins = group.admins || []
    const isLeavingAdmin = admins.some(id => String(id) === String(req.user.id))
    if (isLeavingAdmin && admins.length <= 1 && updatedMembers.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot leave as you are the only admin. Transfer admin role first.' 
      })
    }

    await dbHelpers.updateById('communityGroups', req.params.id, {
      members: updatedMembers,
      admins: isLeavingAdmin ? admins.filter(id => String(id) !== String(req.user.id)) : admins,
      memberCount: updatedMembers.length,
      updatedAt: new Date().toISOString()
    })

    res.json({ success: true, message: 'Left group successfully' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// ===== GROUP POSTS =====
// @route   GET /api/community/groups/:id/posts
// @desc    Get posts in a community group
// @access  Public (for public groups) or Private
router.get('/groups/:id/posts', optionalAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, sortBy = 'newest' } = req.query
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)

    const group = await dbHelpers.findById('communityGroups', req.params.id)
    if (!group || group.isActive === false) {
      return res.status(404).json({ success: false, message: 'Group not found' })
    }

    // Check access for private groups
    if (group.isPublic === false) {
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Login required to view private group posts' })
      }
      const isMember = group.members?.some(id => String(id) === String(req.user.id))
      if (!isMember) {
        return res.status(403).json({ success: false, message: 'Join the group to view posts' })
      }
    }

    let posts = await dbHelpers.find('communityPosts', { 
      groupId: req.params.id, 
      isActive: true 
    })

    // Sort posts
    if (sortBy === 'newest') {
      posts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    } else if (sortBy === 'popular') {
      posts.sort((a, b) => ((b.upvotes || 0) - (b.downvotes || 0)) - ((a.upvotes || 0) - (a.downvotes || 0)))
    }

    // Pagination
    const paginated = posts.slice((pageNum - 1) * limitNum, pageNum * limitNum)

    res.json({
      success: true,
      data: paginated,
      count: paginated.length,
      total: posts.length,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: posts.length,
        totalPages: Math.ceil(posts.length / limitNum)
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/community/groups/:id/posts
// @desc    Create a post in a community group
// @access  Private (group member)
router.post('/groups/:id/posts', protect, async (req, res) => {
  try {
    const { title, content, tags, type, mediaUrls } = req.body

    if (!content) {
      return res.status(400).json({ success: false, message: 'Post content is required' })
    }

    const group = await dbHelpers.findById('communityGroups', req.params.id)
    if (!group || group.isActive === false) {
      return res.status(404).json({ success: false, message: 'Group not found' })
    }

    const isMember = group.members?.some(mid => String(mid) === String(req.user.id))
    if (!isMember) {
      return res.status(403).json({ success: false, message: 'Join the group to post' })
    }

    const newPost = await dbHelpers.insertOne('communityPosts', {
      title: title || '',
      content,
      tags: tags || [],
      type: type || 'text',
      mediaUrls: mediaUrls || [],
      groupId: req.params.id,
      userId: req.user.id,
      upvotes: 0,
      downvotes: 0,
      comments: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    res.status(201).json({
      success: true,
      data: newPost,
      message: 'Post created successfully'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// ===== GROUP COMMENTS =====
// @route   GET /api/community/posts/:postId/comments
// @desc    Get comments on a community post
// @access  Public
router.get('/posts/:postId/comments', async (req, res) => {
  try {
    const comments = await dbHelpers.find('communityComments', { 
      postId: req.params.postId, 
      isActive: true 
    })
    comments.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    
    res.json({ success: true, data: comments })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/community/posts/:postId/comments
// @desc    Comment on a community post
// @access  Private
router.post('/posts/:postId/comments', protect, async (req, res) => {
  try {
    const { content } = req.body
    if (!content || !String(content).trim()) {
      return res.status(400).json({ success: false, message: 'Comment content is required' })
    }

    const comment = await dbHelpers.insertOne('communityComments', {
      postId: req.params.postId,
      userId: req.user.id,
      content: String(content).trim(),
      upvotes: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    // Increment comment count on post
    await dbHelpers.updateById('communityPosts', req.params.postId, {
      comments: dbHelpers.pool.query(
        'SELECT COUNT(*) FROM community_comments WHERE post_id = $1 AND is_active = true',
        [req.params.postId]
      ).then(r => parseInt(r.rows[0].count))
    })

    res.status(201).json({ success: true, data: comment })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// ===== VOTING =====
// @route   POST /api/community/posts/:postId/vote
// @desc    Vote on a community post
// @access  Private
router.post('/posts/:postId/vote', protect, async (req, res) => {
  try {
    const { voteType } = req.body
    if (!['upvote', 'downvote'].includes(voteType)) {
      return res.status(400).json({ success: false, message: 'Vote type must be "upvote" or "downvote"' })
    }

    const post = await dbHelpers.findById('communityPosts', req.params.postId)
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' })
    }

    // Check for existing vote
    const existingVote = await dbHelpers.findOne('communityVotes', {
      postId: req.params.postId,
      userId: req.user.id
    })

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        return res.status(400).json({ success: false, message: `Already ${voteType}d` })
      }
      // Change vote
      await dbHelpers.updateById('communityVotes', existingVote.id, { voteType })
    } else {
      await dbHelpers.insertOne('communityVotes', {
        postId: req.params.postId,
        userId: req.user.id,
        voteType,
        createdAt: new Date().toISOString()
      })
    }

    // Recalculate vote counts
    const allVotes = await dbHelpers.find('communityVotes', { postId: req.params.postId })
    const upvotes = allVotes.filter(v => v.voteType === 'upvote').length
    const downvotes = allVotes.filter(v => v.voteType === 'downvote').length

    await dbHelpers.updateById('communityPosts', req.params.postId, { upvotes, downvotes })

    res.json({ 
      success: true, 
      data: { upvotes, downvotes },
      message: 'Vote recorded' 
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router