import express from 'express'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { protect, admin } from '../../middleware/auth.middleware.js'
import { resolveAssetAccessUrl } from '../../infrastructure/storage/storageProvider.js'
import { nullIfEmpty } from '../../services/core/common.js'

const router = express.Router()

const parseAssetId = (value) => {
  const cleanValue = nullIfEmpty(value)
  if (cleanValue === null) return null
  const numeric = Number.parseInt(cleanValue, 10)
  return Number.isNaN(numeric) ? null : numeric
}

const buildAssetMap = async (assetIds) => {
  const uniqueIds = Array.from(new Set(assetIds.map(parseAssetId).filter(Boolean)))
  if (uniqueIds.length === 0) return new Map()

  const assets = await dbHelpers.find('assets', {
    id: { $in: uniqueIds },
    isActive: true,
  })

  const map = new Map()
  assets.forEach((asset) => {
    const id = parseAssetId(asset.id || asset._id)
    if (id) {
      map.set(id, resolveAssetAccessUrl(asset) || asset.url || null)
    }
  })
  return map
}

// ===== PUBLIC ENDPOINTS =====
router.get('/', async (req, res) => {
  try {
    const now = new Date()
    const promotions = await dbHelpers.find('promotions', { isActive: true })
    const activePromotions = promotions.filter((promotion) => {
      const startDate = promotion.startDate || promotion.start_date
      const endDate = promotion.endDate || promotion.end_date
      const startOk = !startDate || new Date(startDate) <= now
      const endOk = !endDate || new Date(endDate) >= now
      return startOk && endOk
    })

    const assetMap = await buildAssetMap(activePromotions.map((promotion) => promotion.bannerAssetId || promotion.banner_asset_id))
    const data = activePromotions.map((promotion) => {
      const bannerAssetId = parseAssetId(promotion.bannerAssetId || promotion.banner_asset_id)
      return {
        ...promotion,
        bannerAssetId,
        bannerUrl: bannerAssetId
          ? assetMap.get(bannerAssetId) || null
          : promotion.bannerUrl || promotion.banner_url || promotion.imageUrl || promotion.image_url || null,
      }
    })

    res.json({ success: true, data, count: data.length })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// ===== PROMOTIONS ADMIN CRUD OPERATIONS =====
// @route   GET /api/promotions/admin/list
// @desc    Get all promotions (including inactive) - Admin
// @access  Private/Admin
router.get('/admin/list', protect, admin, async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive, type } = req.query
    const promotions = await dbHelpers.find('promotions')
    
    let filtered = promotions
    if (isActive !== undefined) {
      const isActiveBool = isActive === 'true'
      filtered = filtered.filter(p => p.isActive === isActiveBool)
    }
    if (type && type !== 'all') {
      filtered = filtered.filter(p => p.type === type)
    }

    filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))

    const offset = (parseInt(page) - 1) * parseInt(limit)
    const paginated = filtered.slice(offset, offset + parseInt(limit))

    const assetMap = await buildAssetMap(paginated.map((promotion) => promotion.bannerAssetId || promotion.banner_asset_id))
    const enriched = paginated.map((promotion) => {
      const bannerAssetId = parseAssetId(promotion.bannerAssetId || promotion.banner_asset_id)
      return {
        ...promotion,
        bannerAssetId,
        bannerUrl: bannerAssetId ? assetMap.get(bannerAssetId) || null : promotion.bannerUrl || null
      }
    })

    res.json({
      success: true,
      data: enriched,
      count: enriched.length,
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

// @route   POST /api/promotions
// @desc    Create a new promotion - Admin
// @access  Private/Admin
router.post('/', protect, admin, async (req, res) => {
  try {
    const { title, description, type, discount, code, startDate, endDate, bannerAssetId, bannerUrl, linkUrl, priority, isActive, metadata } = req.body

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      })
    }

    const newPromotion = await dbHelpers.insertOne('promotions', {
      title,
      description: description || '',
      type: type || 'general',
      discount: discount || 0,
      code: code || '',
      startDate: startDate || null,
      endDate: endDate || null,
      bannerAssetId: parseAssetId(bannerAssetId),
      bannerUrl: bannerUrl || null,
      linkUrl: linkUrl || '',
      priority: priority || 0,
      isActive: isActive !== false,
      metadata: metadata || {},
      createdBy: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    res.status(201).json({
      success: true,
      data: newPromotion,
      message: 'Promotion created successfully'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   PUT /api/promotions/:id
// @desc    Update a promotion - Admin
// @access  Private/Admin
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const { id } = req.params
    const { title, description, type, discount, code, startDate, endDate, bannerAssetId, bannerUrl, linkUrl, priority, isActive, metadata } = req.body

    const promotion = await dbHelpers.findById('promotions', id)
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      })
    }

    const updateData = { updatedAt: new Date().toISOString() }

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (type !== undefined) updateData.type = type
    if (discount !== undefined) updateData.discount = discount
    if (code !== undefined) updateData.code = code
    if (startDate !== undefined) updateData.startDate = startDate
    if (endDate !== undefined) updateData.endDate = endDate
    if (bannerAssetId !== undefined) updateData.bannerAssetId = parseAssetId(bannerAssetId)
    if (bannerUrl !== undefined) updateData.bannerUrl = bannerUrl
    if (linkUrl !== undefined) updateData.linkUrl = linkUrl
    if (priority !== undefined) updateData.priority = priority
    if (isActive !== undefined) updateData.isActive = isActive
    if (metadata !== undefined) updateData.metadata = metadata

    const updated = await dbHelpers.updateById('promotions', id, updateData)
    
    res.json({
      success: true,
      data: updated,
      message: 'Promotion updated successfully'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// @route   DELETE /api/promotions/:id
// @desc    Delete a promotion - Admin
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const { id } = req.params

    const promotion = await dbHelpers.findById('promotions', id)
    if (!promotion) {
      return res.status(404).json({
        success: false,
        message: 'Promotion not found'
      })
    }

    await dbHelpers.softDelete('promotions', id, req.user.id)
    
    res.json({
      success: true,
      message: 'Promotion moved to trash'
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router