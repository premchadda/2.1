import express from 'express'
import { TestCategory } from '../../data/models/index.js'

const router = express.Router()

// Get all active test categories (public endpoint)
router.get('/', async (req, res) => {
  try {
    const { examCategory } = req.query
    let categories = await TestCategory.findActive()
    
    if (examCategory) {
      categories = categories.filter(cat => String(cat.examCategoryId) === String(examCategory))
    }

    categories.sort((a, b) => ((a.displayOrder ?? a.display_order ?? 0) - (b.displayOrder ?? b.display_order ?? 0)))
    
    res.json({ success: true, data: categories })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get categories as tree structure (public endpoint)
router.get('/tree', async (req, res) => {
  try {
    const { examCategory } = req.query
    let categories = await TestCategory.findActive()
    
    if (examCategory) {
      categories = categories.filter(cat => String(cat.examCategoryId) === String(examCategory))
    }

    categories.sort((a, b) => ((a.displayOrder ?? a.display_order ?? 0) - (b.displayOrder ?? b.display_order ?? 0)))
    
    const tree = TestCategory.buildTree(categories)
    res.json({ success: true, data: tree })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get root categories only (public endpoint)
router.get('/roots', async (req, res) => {
  try {
    const { examCategory } = req.query
    const categories = examCategory 
      ? await TestCategory.findRoots(examCategory)
      : await TestCategory.findByParent(null)
    categories.sort((a, b) => ((a.displayOrder ?? a.display_order ?? 0) - (b.displayOrder ?? b.display_order ?? 0)))
    res.json({ success: true, data: categories })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get test categories by exam category (public endpoint)
router.get('/by-exam-category/:examCategoryId', async (req, res) => {
  try {
    const categories = await TestCategory.findByExamCategory(req.params.examCategoryId)
    res.json({ success: true, data: categories })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get category by ID (public endpoint) - supports both numeric ID and slug
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    // First try to find by ID
    let category = await TestCategory.findById(id)
    
    // If not found by ID, try to find by slug
    if (!category) {
      category = await TestCategory.findOne({ slug: id })
    }
    
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' })
    }
    res.json({ success: true, data: category })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get category by slug (public endpoint)
router.get('/slug/:slug', async (req, res) => {
  try {
    const category = await TestCategory.findOne({ slug: req.params.slug })
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' })
    }
    res.json({ success: true, data: category })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get children of a category (public endpoint)
router.get('/:id/children', async (req, res) => {
  try {
    const children = await TestCategory.findByParent(req.params.id)
    // Sort by displayOrder (admin-set order)
    children.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    res.json({ success: true, data: children })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get full path from root to category (public endpoint)
router.get('/:id/path', async (req, res) => {
  try {
    const categories = await TestCategory.find()
    const path = TestCategory.getCategoryPath(categories, req.params.id)
    res.json({ success: true, data: path })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get test categories by test series (new endpoint)
router.get('/by-test-series/:testSeriesId', async (req, res) => {
  try {
    const categories = await TestCategory.findByTestSeries(req.params.testSeriesId)
    res.json({ success: true, data: categories })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Get orphaned categories (admin endpoint)
router.get('/orphaned/list', async (req, res) => {
  try {
    const orphanedCategories = await TestCategory.findOrphaned()
    res.json({ 
      success: true, 
      count: orphanedCategories.length,
      data: orphanedCategories 
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

// Bulk reassign orphaned categories to test series
router.put('/orphaned/reassign', async (req, res) => {
  try {
    const { categoryIds, testSeriesId } = req.body
    
    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({ success: false, message: 'categoryIds array is required' })
    }
    
    if (!testSeriesId) {
      return res.status(400).json({ success: false, message: 'testSeriesId is required' })
    }
    
    const updated = []
    for (const categoryId of categoryIds) {
      const result = await TestCategory.updateById(categoryId, { testSeriesId })
      if (result) updated.push(result)
    }
    
    res.json({ 
      success: true, 
      message: `Reassigned ${updated.length} categories to test series ${testSeriesId}`,
      updatedCount: updated.length,
      data: updated 
    })
  } catch (error) {
    res.status(500).json({ success: false, message: error.message })
  }
})

export default router
