import express from 'express'
import { dbHelpers } from '../../infrastructure/database/postgres-helpers.js'
import { protect, admin } from '../../middleware/auth.middleware.js'

const router = express.Router()

// @route   GET /api/blogs
// @desc    Get all blog posts
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { category, limit = 20, offset = 0 } = req.query
    
    let blogs = await global.dbHelpers.find('blogs', { isActive: true })
    
    // Filter by category if specified
    if (category && category !== 'all') {
      blogs = blogs.filter(blog => blog.category === category)
    }
    
    // Sort by date and apply pagination
    blogs = blogs
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(parseInt(offset), parseInt(offset) + parseInt(limit))
    
    res.json({
      success: true,
      data: blogs,
      count: blogs.length,
      total: await global.dbHelpers.count('blogs')
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   GET /api/blogs/categories
// @desc    Get all blog categories
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const blogs = await global.dbHelpers.find('blogs', { isActive: true })
    const categories = [...new Set(blogs.map(blog => blog.category).filter(Boolean))]
    
    res.json({
      success: true,
      data: categories
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   GET /api/blogs/:id
// @desc    Get single blog post
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    let blog = await dbHelpers.findById('blogs', id)
    
    if (!blog) {
      // Try finding by slug
      const blogs = await dbHelpers.find('blogs', { isActive: true })
      blog = blogs.find(b => b.slug === id)
    }
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      })
    }
    
    res.json({
      success: true,
      data: blog
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// ===== BLOG ADMIN CRUD OPERATIONS =====
// @route   POST /api/blogs
// @desc    Create a new blog post (Admin)
// @access  Private/Admin
router.post('/', protect, admin, async (req, res) => {
  try {
    const { title, slug, content, excerpt, category, tags, featuredImage, isFeatured, metaTitle, metaDescription, metaKeywords } = req.body

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      })
    }

    const blogSlug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

    // Check if slug already exists
    const existingBlogs = await dbHelpers.find('blogs', { slug: blogSlug })
    if (existingBlogs.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A blog post with this slug already exists'
      })
    }

    const newBlog = await dbHelpers.insertOne('blogs', {
      title,
      slug: blogSlug,
      content,
      excerpt: excerpt || '',
      category: category || '',
      tags: tags || [],
      featuredImage: featuredImage || '',
      isFeatured: isFeatured || false,
      isActive: true,
      metaTitle: metaTitle || title,
      metaDescription: metaDescription || '',
      metaKeywords: metaKeywords || [],
      authorId: req.user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    res.status(201).json({
      success: true,
      data: newBlog,
      message: 'Blog post created successfully'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   PUT /api/blogs/:id
// @desc    Update a blog post (Admin)
// @access  Private/Admin
router.put('/:id', protect, admin, async (req, res) => {
  try {
    const { id } = req.params
    const { title, slug, content, excerpt, category, tags, featuredImage, isFeatured, isActive, metaTitle, metaDescription, metaKeywords } = req.body

    const blog = await dbHelpers.findById('blogs', id)
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      })
    }

    const updateData = { updatedAt: new Date().toISOString() }

    if (title) {
      updateData.title = title
      updateData.slug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    }

    if (content !== undefined) updateData.content = content
    if (excerpt !== undefined) updateData.excerpt = excerpt
    if (category !== undefined) updateData.category = category
    if (tags !== undefined) updateData.tags = tags
    if (featuredImage !== undefined) updateData.featuredImage = featuredImage
    if (isFeatured !== undefined) updateData.isFeatured = isFeatured
    if (isActive !== undefined) updateData.isActive = isActive
    if (metaTitle !== undefined) updateData.metaTitle = metaTitle
    if (metaDescription !== undefined) updateData.metaDescription = metaDescription
    if (metaKeywords !== undefined) updateData.metaKeywords = metaKeywords

    const updated = await dbHelpers.updateById('blogs', id, updateData)
    
    res.json({
      success: true,
      data: updated,
      message: 'Blog post updated successfully'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   DELETE /api/blogs/:id
// @desc    Delete a blog post (Admin)
// @access  Private/Admin
router.delete('/:id', protect, admin, async (req, res) => {
  try {
    const { id } = req.params

    const blog = await dbHelpers.findById('blogs', id)
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      })
    }

    await dbHelpers.softDelete('blogs', id, req.user.id)
    
    res.json({
      success: true,
      message: 'Blog post moved to trash'
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

// @route   GET /api/blogs/admin/list
// @desc    Get all blog posts (Admin - including inactive)
// @access  Private/Admin
router.get('/admin/list', protect, admin, async (req, res) => {
  try {
    const { page = 1, limit = 20, category } = req.query
    const blogs = await dbHelpers.find('blogs')
    
    let filtered = blogs
    if (category && category !== 'all') {
      filtered = blogs.filter(blog => blog.category === category)
    }

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

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
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

export default router
