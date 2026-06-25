import express from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import { idsMatch } from '../../services/core/common.js'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'

const router = express.Router()

// @route   GET /api/study-groups
// @desc    Get all study groups
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { category, search, limit = 20, offset = 0 } = req.query
    
    let groups = await dbHelpers.find('studyGroups', { isActive: true })
    
    // Filter by category
    if (category && category !== 'all') {
      groups = groups.filter(g => g.category === category)
    }
    
    // Search
    if (search) {
      const searchLower = search.toLowerCase()
      groups = groups.filter(g => 
        g.name?.toLowerCase().includes(searchLower) || 
        g.description?.toLowerCase().includes(searchLower)
      )
    }
    
    // Sort by most active and apply pagination
    groups = groups
      .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
    
    // Get member count for each group
    const groupsWithCounts = await Promise.all(groups.map(async (group) => {
      const members = await dbHelpers.find('studyGroupMembers', {
        groupId: group._id || group.id,
        isActive: { $ne: false }
      })
      return {
        ...group,
        memberCount: members.length,
        isPrivate: group.isPrivate || false
      }
    }))
    
    res.json({
      success: true,
      data: groupsWithCounts,
      count: groupsWithCounts.length
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/study-groups/:id
// @desc    Get single study group with members
// @access  Public
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    if (id === 'my' || id === 'categories') return next()
    
    let group = await dbHelpers.findById('studyGroups', id)
    
    if (!group) {
      return res.status(404).json({ success: false, message: 'Study group not found' })
    }
    
    // Get members
    const members = await dbHelpers.find('studyGroupMembers', {
      groupId: group._id || group.id,
      isActive: { $ne: false }
    })
    
    // Get admin info for each member
    const membersWithInfo = await Promise.all(members.map(async (member) => {
      const user = await dbHelpers.findById('users', member.userId)
      return {
        ...member,
        userName: user?.name || member.userName,
      }
    }))
    
    res.json({
      success: true,
      data: {
        ...group,
        members: membersWithInfo,
        memberCount: members.length
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/study-groups
// @desc    Create a new study group
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { name, description, category, isPrivate, maxMembers = 50 } = req.body
    
    if (!name || !description) {
      return res.status(400).json({ success: false, message: 'Name and description required' })
    }
    
    const group = await dbHelpers.insertOne('studyGroups', {
      name,
      description,
      category: category || 'general',
      isPrivate: isPrivate || false,
      maxMembers: maxMembers || 50,
      userId: req.user.id,
      ownerName: req.user.name,
      isActive: true,
      memberCount: 1,
      createdAt: new Date().toISOString()
    })
    
    // Add creator as admin member
    await dbHelpers.insertOne('studyGroupMembers', {
      groupId: group._id || group.id,
      userId: req.user.id,
      userName: req.user.name,
      role: 'admin',
      joinedAt: new Date().toISOString()
    })
    
    res.status(201).json({ success: true, data: group })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   PUT /api/study-groups/:id
// @desc    Update a study group
// @access  Private (owner only)
router.put('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, category, isPrivate, maxMembers } = req.body
    
    const group = await dbHelpers.findById('studyGroups', id)
    
    if (!group) {
      return res.status(404).json({ success: false, message: 'Study group not found' })
    }
    
    if (!idsMatch(group.userId, req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' })
    }
    
    const updated = await dbHelpers.updateById('studyGroups', id, {
      ...(name && { name }),
      ...(description && { description }),
      ...(category && { category }),
      ...(isPrivate !== undefined && { isPrivate }),
      ...(maxMembers && { maxMembers }),
      updatedAt: new Date().toISOString()
    })
    
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   DELETE /api/study-groups/:id
// @desc    Delete a study group
// @access  Private (owner only)
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params
    
    const group = await dbHelpers.findById('studyGroups', id)
    
    if (!group) {
      return res.status(404).json({ success: false, message: 'Study group not found' })
    }
    
    if (!idsMatch(group.userId, req.user.id) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' })
    }
    
    await dbHelpers.softDelete('studyGroups', id, req.user.id)
    
    res.json({ success: true, message: 'Study group deleted' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/study-groups/:id/join
// @desc    Join a study group
// @access  Private
router.post('/:id/join', protect, async (req, res) => {
  try {
    const { id } = req.params
    
    const group = await dbHelpers.findById('studyGroups', id)
    
    if (!group) {
      return res.status(404).json({ success: false, message: 'Study group not found' })
    }
    
    // Check if already a member
    const existingMember = await dbHelpers.findOne('studyGroupMembers', {
      groupId: group._id || group.id,
      userId: req.user.id,
      isActive: { $ne: false }
    })
    
    if (existingMember) {
      return res.status(400).json({ success: false, message: 'Already a member' })
    }
    
    // Check max members
    const members = await dbHelpers.find('studyGroupMembers', {
      groupId: group._id || group.id,
      isActive: { $ne: false }
    })
    if (members.length >= (group.maxMembers || 50)) {
      return res.status(400).json({ success: false, message: 'Group is full' })
    }
    
    // Add member
    const member = await dbHelpers.insertOne('studyGroupMembers', {
      groupId: group._id || group.id,
      userId: req.user.id,
      userName: req.user.name,
      role: 'member',
      joinedAt: new Date().toISOString()
    })
    
    // Update member count
    await dbHelpers.updateById('studyGroups', id, {
      memberCount: members.length + 1
    })
    
    res.status(201).json({ success: true, data: member })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/study-groups/:id/leave
// @desc    Leave a study group
// @access  Private
router.post('/:id/leave', protect, async (req, res) => {
  try {
    const { id } = req.params
    
    const group = await dbHelpers.findById('studyGroups', id)
    
    if (!group) {
      return res.status(404).json({ success: false, message: 'Study group not found' })
    }
    
    // Find and remove member
    const member = await dbHelpers.findOne('studyGroupMembers', {
      groupId: group._id || group.id,
      userId: req.user.id,
      isActive: { $ne: false }
    })
    
    if (!member) {
      return res.status(400).json({ success: false, message: 'Not a member' })
    }
    
    // Can't leave if only admin
    if (member.role === 'admin') {
      const members = await dbHelpers.find('studyGroupMembers', {
        groupId: group._id || group.id,
        isActive: { $ne: false }
      })
      if (members.length === 1) {
        return res.status(400).json({ success: false, message: 'Cannot leave as the only admin. Delete the group instead.' })
      }
    }
    
    await dbHelpers.softDelete('studyGroupMembers', member._id || member.id, req.user.id)
    
    // Update member count
    const remainingMembers = await dbHelpers.find('studyGroupMembers', {
      groupId: group._id || group.id,
      isActive: { $ne: false }
    })
    await dbHelpers.updateById('studyGroups', id, {
      memberCount: remainingMembers.length
    })
    
    res.json({ success: true, message: 'Left the group' })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   PUT /api/study-groups/:id/member/:memberId/role
// @desc    Update member role
// @access  Private (group admin only)
router.put('/:id/member/:memberId/role', protect, async (req, res) => {
  try {
    const { id, memberId } = req.params
    const { role } = req.body
    
    const group = await dbHelpers.findById('studyGroups', id)
    
    if (!group) {
      return res.status(404).json({ success: false, message: 'Study group not found' })
    }
    
    // Check if requester is admin
    const requesterMember = await dbHelpers.findOne('studyGroupMembers', {
      groupId: group._id || group.id,
      userId: req.user.id,
      isActive: { $ne: false }
    })
    
    if ((!requesterMember || requesterMember.role !== 'admin') && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' })
    }

    const memberToUpdate = await dbHelpers.findById('studyGroupMembers', memberId)
    if (!memberToUpdate || !idsMatch(memberToUpdate.groupId, group._id || group.id)) {
      return res.status(404).json({ success: false, message: 'Group member not found' })
    }
    
    const updated = await dbHelpers.updateById('studyGroupMembers', memberId, {
      role,
      updatedAt: new Date().toISOString()
    })
    
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/study-groups/my
// @desc    Get user's study groups
// @access  Private
router.get('/my', protect, async (req, res) => {
  try {
    const members = await dbHelpers.find('studyGroupMembers', {
      userId: req.user.id,
      isActive: { $ne: false }
    })
    const groupIds = members.map(m => m.groupId)
    
    const groups = await Promise.all(groupIds.map(async (groupId) => {
      const group = await dbHelpers.findById('studyGroups', groupId)
      const member = members.find((m) => idsMatch(m.groupId, groupId))
      return group ? { ...group, role: member?.role } : null
    }))
    
    res.json({
      success: true,
      data: groups.filter(Boolean)
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   GET /api/study-groups/categories
// @desc    Get study group categories
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      { id: 'general', name: 'General', icon: '👥' },
      { id: 'ssc', name: 'SSC Preparation', icon: '📋' },
      { id: 'railway', name: 'Railway Exams', icon: '🚂' },
      { id: 'banking', name: 'Banking Exams', icon: '🏦' },
      { id: 'state-psc', name: 'State PSC', icon: '🏛️' },
      { id: 'defence', name: 'Defence Exams', icon: '🛡️' },
      { id: 'teaching', name: 'Teaching Exams', icon: '📚' }
    ]
    
    res.json({ success: true, data: categories })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
