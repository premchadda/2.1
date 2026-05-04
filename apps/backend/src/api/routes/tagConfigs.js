import express from 'express'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { protect, admin } from '../../middleware/auth.middleware.js'

const router = express.Router()

// ===== PUBLIC ENDPOINTS =====
// Get all active tag configs (public endpoint)
router.get('/', async (req, res) => {
  try {
    const tagConfigs = await dbHelpers.find('tagConfigs', { isActive: true })
    res.json({ success: true, data: tagConfigs })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get single tag config by slug/tag
router.get('/:tag', async (req, res) => {
  try {
    const { tag } = req.params
    const tagConfig = await dbHelpers.findOne('tagConfigs', { id: tag, isActive: true })
    
    if (!tagConfig) {
      return res.status(404).json({ success: false, message: 'Tag config not found' })
    }
    res.json({ success: true, data: tagConfig })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// ===== TAG CONFIGS ADMIN CRUD OPERATIONS =====
// @route   GET /api/tag-configs/admin/list
// @desc    Get all tag configs (including inactive) - Admin
// @access  Private/Admin
router.get('/admin/list', protect, admin, async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive, type } = req.query
    const tagConfigs = await dbHelpers.find('tagConfigs')
    
    let filtered = tagConfigs
    if (isActive !== undefined) {
      const isActiveBool = isActive === 'true'
      filtered = filtered.filter(t => t.isActive === isActiveBool)
    }
    if (type && type !== 'all') {
      filtered = filtered.filter(t => t.type === type)
    }

    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

    const offset = (parseInt(page) - 1) * parseInt(limit)
    const paginated = filtered.slice(offset, offset + parseInt(limit))

    res.json({
      success: true,
      data: paginated,
      count: paginated.length,
      total: filtered.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / parseInt(limit))
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   POST /api/tag-configs
// @desc    Create a new tag config - Admin
// @access  Private/Admin
router.post('/', protect, admin, async (req, res) => {
  try {
    const { tag, label, description, type, color, icon, priority, isActive, metadata } = req.body

    if (!tag) {
      return res.status(400).json({
        success: false,
        message: 'Tag is required'
      })
    }

    // Check if tag already exists
    const existingTag = await dbHelpers.findOne('tagConfigs', { tag })
    if (existingTag) {
      return res.status(400).json({
        success: false,
        message: 'A tag config with this tag already exists'
      })
    }

    const newTagConfig = await dbHelpers.insertOne('tagConfigs', {
      tag,
      label: label || tag,
      description: description || '',
      type: type || 'general',
      color: color || '#000000',
      icon: icon || '',
      priority: priority || 0,
      isActive: isActive !== false,
      metadata: metadata || {},
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    res.status(201).json({
      success: true,
      data: newTagConfig,
      message: 'Tag config created successfully'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   PUT /api/tag-configs/:id
// @desc    Update a tag config - Admin
// @access  Private/Admin
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const { id } = req.params
    const { tag, label, description, type, color, icon, priority, isActive, metadata } = req.body

    const tagConfig = await dbHelpers.findById('tagConfigs', id)
    if (!tagConfig) {
      return res.status(404).json({
        success: false,
        message: 'Tag config not found'
      })
    }

    const updateData = { updatedAt: new Date().toISOString() }

    if (tag !== undefined) {
      // Check if new tag conflicts with existing tag
      const existing = await dbHelpers.findOne('tagConfigs', { tag, isActive: true })
      if (existing && String(existing.id) !== String(id)) {
        return res.status(400).json({
          success: false,
          message: 'A tag config with this tag already exists'
        })
      }
      updateData.tag = tag
    }
    if (label !== undefined) updateData.label = label
    if (description !== undefined) updateData.description = description
    if (type !== undefined) updateData.type = type
    if (color !== undefined) updateData.color = color
    if (icon !== undefined) updateData.icon = icon
    if (priority !== undefined) updateData.priority = priority
    if (isActive !== undefined) updateData.isActive = isActive
    if (metadata !== undefined) updateData.metadata = metadata

    const updated = await dbHelpers.updateById('tagConfigs', id, updateData)
    
    res.json({
      success: true,
      data: updated,
      message: 'Tag config updated successfully'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   DELETE /api/tag-configs/:id
// @desc    Delete a tag config - Admin
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const { id } = req.params

    const tagConfig = await dbHelpers.findById('tagConfigs', id)
    if (!tagConfig) {
      return res.status(404).json({
        success: false,
        message: 'Tag config not found'
      })
    }

    await dbHelpers.softDelete('tagConfigs', id, req.user.id)
    
    res.json({
      success: true,
      message: 'Tag config moved to trash'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router