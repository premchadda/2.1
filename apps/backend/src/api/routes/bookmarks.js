import express from 'express'
import { protect } from '../../middleware/auth.middleware.js'
import rateLimit from 'express-rate-limit'
import { idsMatch } from '../../services/core/common.js'
import { parseNumericId } from '../../shared/utils/db-utils.js'
import { findEntityByIdentifier, getInternalId } from '../../shared/utils/identifier-utils.js'

const router = express.Router()

// Rate limiting for bookmark operations (Issue #36)
const bookmarkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Max 50 bookmark operations per 15 minutes
  message: { success: false, message: 'Too many bookmark requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// Allowed item types for bookmarks (Issue #38)
const ALLOWED_ITEM_TYPES = ['test', 'question', 'study-material', 'chapter', 'video']

const validateItemType = (itemType) => {
  if (!itemType) return { valid: false, error: 'itemType is required' }
  if (!ALLOWED_ITEM_TYPES.includes(itemType)) {
    return { 
      valid: false, 
      error: `Invalid itemType. Allowed types: ${ALLOWED_ITEM_TYPES.join(', ')}` 
    }
  }
  return { valid: true }
}

// Sanitize input
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input
  return input
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#x27;')
    .trim()
}

const resolveBookmarkEntity = async (itemType, itemId) => {
  switch (itemType) {
    case 'test':
      return findEntityByIdentifier(global.dbHelpers, 'tests', itemId, { slugFields: ['slug'] })
    case 'question':
      return findEntityByIdentifier(global.dbHelpers, 'questions', itemId)
    case 'study-material':
    case 'chapter':
      return findEntityByIdentifier(global.dbHelpers, 'studyMaterials', itemId)
    case 'video':
      return (
        await findEntityByIdentifier(global.dbHelpers, 'videos', itemId)
      ) || (
        await findEntityByIdentifier(global.dbHelpers, 'studyMaterials', itemId)
      )
    default:
      return null
  }
}

// All bookmark routes require authentication
router.use(protect)

// @route   GET /api/bookmarks
// @desc    Get all bookmarks for logged in user
// @access  Private
router.get('/', async (req, res) => {
  try {
    const bookmarks = await global.dbHelpers.find('bookmarks', { 
      userId: req.user.id,
      isActive: true 
    })
    
    // Enrich bookmark data with actual item details
    const enrichedBookmarks = await Promise.all(
      bookmarks.map(async (bookmark) => {
        let itemDetails = null
        
        try {
          // Fetch details based on item type
          itemDetails = await resolveBookmarkEntity(bookmark.itemType, bookmark.itemId)
        } catch (error) {
          console.warn(`Failed to enrich bookmark ${bookmark._id}:`, error.message)
        }
        
        return {
          ...bookmark,
          item: itemDetails
        }
      })
    )
    
    res.json({
      success: true,
      data: enrichedBookmarks,
      count: enrichedBookmarks.length
    })
  } catch (error) {
    console.error('Get bookmarks error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   POST /api/bookmarks
// @desc    Create a new bookmark
// @access  Private
router.post('/', bookmarkLimiter, async (req, res) => {
  try {
    const { itemId, itemType, title, notes } = req.body
    
    if (!itemId || !itemType) {
      return res.status(400).json({
        success: false,
        message: 'itemId and itemType are required'
      })
    }
    
    // Validate itemType (Issue #38)
    const typeValidation = validateItemType(itemType)
    if (!typeValidation.valid) {
      return res.status(400).json({
        success: false,
        message: typeValidation.error
      })
    }

    const resolvedEntity = await resolveBookmarkEntity(itemType, itemId)
    const canonicalItemId = getInternalId(resolvedEntity) ?? parseNumericId(itemId)

    if (canonicalItemId === null) {
      return res.status(404).json({
        success: false,
        message: 'Bookmark item not found'
      })
    }
    
    // Check if already bookmarked
    const existing = (await global.dbHelpers.find('bookmarks', {
      userId: req.user.id,
      itemType,
      isActive: true
    })).find((bookmark) => idsMatch(bookmark.itemId, canonicalItemId))
    
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Item already bookmarked'
      })
    }
    
    // Sanitize input
    const sanitizedTitle = title ? sanitizeInput(String(title).substring(0, 200)) : ''
    const sanitizedNotes = notes ? sanitizeInput(String(notes).substring(0, 1000)) : ''
    
    const bookmark = await global.dbHelpers.insertOne('bookmarks', {
      userId: req.user.id,
      itemId: canonicalItemId,
      itemType,
      title: sanitizedTitle,
      notes: sanitizedNotes,
      isActive: true,
      createdAt: new Date().toISOString()
    })
    
    res.status(201).json({
      success: true,
      data: bookmark,
      message: 'Bookmark created successfully'
    })
  } catch (error) {
    console.error('Create bookmark error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   PUT /api/bookmarks/:id
// @desc    Update bookmark (notes, etc.)
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const { notes, title } = req.body
    
    // Verify bookmark belongs to user
    const bookmark = await findEntityByIdentifier(global.dbHelpers, 'bookmarks', req.params.id)
    if (!bookmark || !idsMatch(bookmark.userId, req.user.id)) {
      return res.status(404).json({
        success: false,
        message: 'Bookmark not found'
      })
    }
    
    const updated = await global.dbHelpers.updateById('bookmarks', getInternalId(bookmark), {
      notes: notes !== undefined ? notes : bookmark.notes,
      title: title !== undefined ? title : bookmark.title,
      updatedAt: new Date().toISOString()
    })
    
    res.json({
      success: true,
      data: updated,
      message: 'Bookmark updated successfully'
    })
  } catch (error) {
    console.error('Update bookmark error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   DELETE /api/bookmarks/:id
// @desc    Delete bookmark (soft delete)
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    // Verify bookmark belongs to user
    const bookmark = await findEntityByIdentifier(global.dbHelpers, 'bookmarks', req.params.id)
    if (!bookmark || !idsMatch(bookmark.userId, req.user.id)) {
      return res.status(404).json({
        success: false,
        message: 'Bookmark not found'
      })
    }
    
    await global.dbHelpers.updateById('bookmarks', getInternalId(bookmark), {
      isActive: false,
      deletedAt: new Date().toISOString()
    })
    
    res.json({
      success: true,
      message: 'Bookmark removed successfully'
    })
  } catch (error) {
    console.error('Delete bookmark error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   GET /api/bookmarks/check/:itemType/:itemId
// @desc    Check if item is bookmarked by user
// @access  Private
router.get('/check/:itemType/:itemId', async (req, res) => {
  try {
    const { itemType, itemId } = req.params
    
    const bookmark = (await global.dbHelpers.find('bookmarks', {
      userId: req.user.id,
      itemType,
      isActive: true
    })).find((entry) => idsMatch(entry.itemId, itemId))
    
    res.json({
      success: true,
      isBookmarked: !!bookmark,
      bookmarkId: bookmark?._id || null
    })
  } catch (error) {
    console.error('Check bookmark error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   POST /api/bookmarks/toggle
// @desc    Toggle bookmark (add if not exists, remove if exists)
// @access  Private
router.post('/toggle', bookmarkLimiter, async (req, res) => {
  try {
    const { itemId, itemType, title } = req.body
    
    if (!itemId || !itemType) {
      return res.status(400).json({
        success: false,
        message: 'itemId and itemType are required'
      })
    }
    
    // Validate itemType (Issue #38)
    const typeValidation = validateItemType(itemType)
    if (!typeValidation.valid) {
      return res.status(400).json({
        success: false,
        message: typeValidation.error
      })
    }
    
    // Check if already bookmarked
    const existing = (await global.dbHelpers.find('bookmarks', {
      userId: req.user.id,
      itemType,
      isActive: true
    })).find((bookmark) => idsMatch(bookmark.itemId, itemId))
    
    if (existing) {
      // Remove bookmark
      await global.dbHelpers.updateById('bookmarks', existing._id || existing.id, {
        isActive: false,
        deletedAt: new Date().toISOString()
      })
      
      res.json({
        success: true,
        isBookmarked: false,
        message: 'Bookmark removed'
      })
    } else {
      // Sanitize input
      const sanitizedTitle = title ? sanitizeInput(String(title).substring(0, 200)) : ''
      
      // Add bookmark
      const bookmark = await global.dbHelpers.insertOne('bookmarks', {
        userId: req.user.id,
        itemId,
        itemType,
        title: sanitizedTitle,
        notes: '',
        isActive: true,
        createdAt: new Date().toISOString()
      })
      
      res.status(201).json({
        success: true,
        isBookmarked: true,
        bookmarkId: bookmark._id || bookmark.id,
        message: 'Bookmark added'
      })
    }
  } catch (error) {
    console.error('Toggle bookmark error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

export default router
