import express from 'express'
import { protect, admin } from '../../middleware/auth.middleware.js'
import { pool } from '../../infrastructure/database/postgres-helpers.js'

const router = express.Router()

// Apply authentication and admin authorization to all routes
router.use(protect)
router.use(admin)

/**
 * GET /admin/coming-soon
 * Get all coming soon features
 * Query params: category, status, limit
 */
router.get('/', async (req, res) => {
  try {
    const { category, status, limit = 50 } = req.query
    
    let whereClause = ''
    const params = []
    let paramIndex = 1
    
    if (category) {
      whereClause += `WHERE category = $${paramIndex}`
      params.push(category)
      paramIndex++
    }
    
    if (status) {
      whereClause += whereClause ? ' AND' : 'WHERE'
      whereClause += ` status = $${paramIndex}`
      params.push(status)
      paramIndex++
    }
    
    const { rows } = await pool.query(
      `SELECT 
        id,
        name,
        description,
        category,
        status,
        priority,
        eta,
        progress_percentage,
        image_url,
        created_at,
        updated_at
       FROM coming_soon_features 
       ${whereClause}
       ORDER BY 
         CASE status
           WHEN 'in_development' THEN 1
           WHEN 'planned' THEN 2
           WHEN 'testing' THEN 3
           WHEN 'released' THEN 4
           ELSE 5
         END,
         CASE priority
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
           ELSE 4
         END,
         created_at DESC
       LIMIT $${paramIndex}`,
      [...params, parseInt(limit)]
    )
    
    // Group by status
    const featuresByStatus = {}
    
    rows.forEach(feature => {
      if (!featuresByStatus[feature.status]) {
        featuresByStatus[feature.status] = []
      }
      
      featuresByStatus[feature.status].push({
        id: feature.id,
        name: feature.name,
        description: feature.description,
        category: feature.category,
        priority: feature.priority,
        eta: feature.eta,
        progress_percentage: feature.progress_percentage,
        image_url: feature.image_url,
        created_at: feature.created_at
      })
    })
    
    res.json({
      success: true,
      data: {
        features: Object.entries(featuresByStatus).map(([status, items]) => ({
          status,
          count: items.length,
          items
        })),
        total: rows.length,
        summary: {
          planned: rows.filter(r => r.status === 'planned').length,
          in_development: rows.filter(r => r.status === 'in_development').length,
          testing: rows.filter(r => r.status === 'testing').length,
          released: rows.filter(r => r.status === 'released').length
        }
      }
    })
  } catch (error) {
    console.error('Get coming soon features error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch coming soon features',
      details: error.message
    })
  }
})

/**
 * GET /admin/coming-soon/:id
 * Get single coming soon feature
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params
  
  try {
    const { rows } = await pool.query(
      'SELECT * FROM coming_soon_features WHERE id = $1',
      [id]
    )
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Feature not found'
      })
    }
    
    res.json({
      success: true,
      data: rows[0]
    })
  } catch (error) {
    console.error('Get coming soon feature error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch coming soon feature',
      details: error.message
    })
  }
})

/**
 * POST /admin/coming-soon
 * Create new coming soon feature
 */
router.post('/', async (req, res) => {
  const { 
    name, 
    description, 
    category, 
    status = 'planned',
    priority = 'medium',
    eta,
    progress_percentage = 0,
    image_url 
  } = req.body
  
  // Validation
  if (!name || !description || !category) {
    return res.status(400).json({
      success: false,
      error: 'name, description, and category are required'
    })
  }
  
  const validStatuses = ['planned', 'in_development', 'testing', 'released']
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `status must be one of: ${validStatuses.join(', ')}`
    })
  }
  
  const validPriorities = ['high', 'medium', 'low']
  if (!validPriorities.includes(priority)) {
    return res.status(400).json({
      success: false,
      error: `priority must be one of: ${validPriorities.join(', ')}`
    })
  }
  
  try {
    const { rows } = await pool.query(
      `INSERT INTO coming_soon_features (
        name, description, category, status, priority, eta, 
        progress_percentage, image_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [name, description, category, status, priority, eta || null, progress_percentage, image_url || null]
    )
    
    res.status(201).json({
      success: true,
      data: rows[0],
      message: 'Coming soon feature created successfully'
    })
  } catch (error) {
    console.error('Create coming soon feature error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create coming soon feature',
      details: error.message
    })
  }
})

/**
 * PUT /admin/coming-soon/:id
 * Update coming soon feature
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params
  const updates = req.body
  
  try {
    const updateFields = []
    const params = []
    let paramIndex = 1
    
    const allowedFields = ['name', 'description', 'category', 'status', 'priority', 'eta', 'progress_percentage', 'image_url']
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        // Validate status and priority if being updated
        if (field === 'status') {
          const validStatuses = ['planned', 'in_development', 'testing', 'released']
          if (!validStatuses.includes(updates[field])) {
            return res.status(400).json({
              success: false,
              error: `status must be one of: ${validStatuses.join(', ')}`
            })
          }
        }
        
        if (field === 'priority') {
          const validPriorities = ['high', 'medium', 'low']
          if (!validPriorities.includes(updates[field])) {
            return res.status(400).json({
              success: false,
              error: `priority must be one of: ${validPriorities.join(', ')}`
            })
          }
        }
        
        updateFields.push(`${field} = $${paramIndex}`)
        params.push(updates[field])
        paramIndex++
      }
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      })
    }
    
    updateFields.push('updated_at = NOW()')
    params.push(id)
    
    const { rows } = await pool.query(
      `UPDATE coming_soon_features 
       SET ${updateFields.join(', ')} 
       WHERE id = $${paramIndex} 
       RETURNING *`,
      params
    )
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Feature not found'
      })
    }
    
    res.json({
      success: true,
      data: rows[0],
      message: 'Coming soon feature updated successfully'
    })
  } catch (error) {
    console.error('Update coming soon feature error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update coming soon feature',
      details: error.message
    })
  }
})

/**
 * DELETE /admin/coming-soon/:id
 * Delete coming soon feature
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params
  
  try {
    const result = await pool.query(
      'DELETE FROM coming_soon_features WHERE id = $1',
      [id]
    )
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Feature not found'
      })
    }
    
    res.json({
      success: true,
      message: 'Coming soon feature deleted successfully'
    })
  } catch (error) {
    console.error('Delete coming soon feature error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete coming soon feature',
      details: error.message
    })
  }
})

/**
 * PATCH /admin/coming-soon/:id/progress
 * Update progress percentage for a feature
 */
router.patch('/:id/progress', async (req, res) => {
  const { id } = req.params
  const { progress_percentage, status } = req.body
  
  if (progress_percentage === undefined) {
    return res.status(400).json({
      success: false,
      error: 'progress_percentage is required'
    })
  }
  
  if (progress_percentage < 0 || progress_percentage > 100) {
    return res.status(400).json({
      success: false,
      error: 'progress_percentage must be between 0 and 100'
    })
  }
  
  try {
    // Auto-update status based on progress
    let newStatus = status
    if (!newStatus) {
      if (progress_percentage === 0) newStatus = 'planned'
      else if (progress_percentage < 100) newStatus = 'in_development'
      else if (progress_percentage === 100) newStatus = 'testing'
    }
    
    const { rows } = await pool.query(
      `UPDATE coming_soon_features 
       SET progress_percentage = $1, status = $2, updated_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [progress_percentage, newStatus, id]
    )
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Feature not found'
      })
    }
    
    res.json({
      success: true,
      data: rows[0],
      message: 'Progress updated successfully'
    })
  } catch (error) {
    console.error('Update progress error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update progress',
      details: error.message
    })
  }
})

export default router
