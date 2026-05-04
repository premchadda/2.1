import express from 'express'
import { protect, admin } from '../../middleware/auth.middleware.js'
import { pool } from '../../infrastructure/database/postgres-helpers.js'

const router = express.Router()

// Apply authentication and admin authorization to all routes
router.use(protect)
router.use(admin)

/**
 * GET /admin/email-templates
 * Get all email templates
 */
router.get('/', async (req, res) => {
  try {
    const { type, enabled } = req.query
    
    let whereClause = ''
    const params = []
    let paramIndex = 1
    
    if (type) {
      whereClause += `WHERE type = $${paramIndex}`
      params.push(type)
      paramIndex++
    }
    
    if (enabled !== undefined) {
      whereClause += whereClause ? ' AND' : 'WHERE'
      whereClause += ` enabled = $${paramIndex}`
      params.push(enabled === 'true')
      paramIndex++
    }
    
    const { rows } = await pool.query(
      `SELECT * FROM email_templates ${whereClause} ORDER BY created_at DESC`,
      params
    )
    
    res.json({
      success: true,
      data: {
        templates: rows,
        total: rows.length
      }
    })
  } catch (error) {
    console.error('Get email templates error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch email templates',
      details: error.message
    })
  }
})

/**
 * GET /admin/email-templates/:id
 * Get single email template
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params
  
  try {
    const { rows } = await pool.query(
      'SELECT * FROM email_templates WHERE id = $1',
      [id]
    )
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Email template not found'
      })
    }
    
    res.json({
      success: true,
      data: rows[0]
    })
  } catch (error) {
    console.error('Get email template error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch email template',
      details: error.message
    })
  }
})

/**
 * POST /admin/email-templates
 * Create new email template
 */
router.post('/', async (req, res) => {
  const { name, type, subject, body, variables, enabled = true } = req.body
  
  // Validation
  if (!name || !type || !subject || !body) {
    return res.status(400).json({
      success: false,
      error: 'name, type, subject, and body are required'
    })
  }
  
  try {
    const { rows } = await pool.query(
      `INSERT INTO email_templates (name, type, subject, body, variables, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, type, subject, body, variables || [], enabled]
    )
    
    res.status(201).json({
      success: true,
      data: rows[0],
      message: 'Email template created successfully'
    })
  } catch (error) {
    console.error('Create email template error:', error)
    
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({
        success: false,
        error: 'Template name already exists'
      })
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create email template',
      details: error.message
    })
  }
})

/**
 * PUT /admin/email-templates/:id
 * Update email template
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params
  const { name, type, subject, body, variables, enabled } = req.body
  
  try {
    const updates = []
    const params = []
    let paramIndex = 1
    
    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`)
      params.push(name)
      paramIndex++
    }
    
    if (type !== undefined) {
      updates.push(`type = $${paramIndex}`)
      params.push(type)
      paramIndex++
    }
    
    if (subject !== undefined) {
      updates.push(`subject = $${paramIndex}`)
      params.push(subject)
      paramIndex++
    }
    
    if (body !== undefined) {
      updates.push(`body = $${paramIndex}`)
      params.push(body)
      paramIndex++
    }
    
    if (variables !== undefined) {
      updates.push(`variables = $${paramIndex}`)
      params.push(variables)
      paramIndex++
    }
    
    if (enabled !== undefined) {
      updates.push(`enabled = $${paramIndex}`)
      params.push(enabled)
      paramIndex++
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      })
    }
    
    updates.push(`updated_at = NOW()`)
    params.push(id)
    
    const { rows } = await pool.query(
      `UPDATE email_templates SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    )
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Email template not found'
      })
    }
    
    res.json({
      success: true,
      data: rows[0],
      message: 'Email template updated successfully'
    })
  } catch (error) {
    console.error('Update email template error:', error)
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Template name already exists'
      })
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update email template',
      details: error.message
    })
  }
})

/**
 * DELETE /admin/email-templates/:id
 * Delete email template
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params
  
  try {
    const result = await pool.query(
      'DELETE FROM email_templates WHERE id = $1',
      [id]
    )
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Email template not found'
      })
    }
    
    res.json({
      success: true,
      message: 'Email template deleted successfully'
    })
  } catch (error) {
    console.error('Delete email template error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete email template',
      details: error.message
    })
  }
})

/**
 * POST /admin/email-templates/:id/test
 * Send test email using template
 */
router.post('/:id/test', async (req, res) => {
  const { id } = req.params
  const { to_email, test_data = {} } = req.body
  
  if (!to_email) {
    return res.status(400).json({
      success: false,
      error: 'to_email is required'
    })
  }
  
  try {
    // Get template
    const { rows } = await pool.query(
      'SELECT * FROM email_templates WHERE id = $1',
      [id]
    )
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Email template not found'
      })
    }
    
    const template = rows[0]
    
    // Replace variables in template
    let subject = template.subject
    let body = template.body
    
    // Replace {{variable}} with test_data values
    Object.keys(test_data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g')
      subject = subject.replace(regex, test_data[key])
      body = body.replace(regex, test_data[key])
    })
    
    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    // For now, return the rendered template
    // const emailService = new EmailService()
    // await emailService.send({
    //   to: to_email,
    //   subject: subject,
    //   html: body
    // })
    
    res.json({
      success: true,
      data: {
        to: to_email,
        subject: subject,
        body_preview: body.substring(0, 500) + (body.length > 500 ? '...' : '')
      },
      message: 'Test email rendered successfully (email service integration pending)'
    })
  } catch (error) {
    console.error('Test email template error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to send test email',
      details: error.message
    })
  }
})

/**
 * POST /admin/email-templates/preview
 * Preview template with variables (without sending)
 */
router.post('/preview', async (req, res) => {
  const { template_id, test_data = {} } = req.body
  
  if (!template_id) {
    return res.status(400).json({
      success: false,
      error: 'template_id is required'
    })
  }
  
  try {
    const { rows } = await pool.query(
      'SELECT * FROM email_templates WHERE id = $1',
      [template_id]
    )
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Email template not found'
      })
    }
    
    const template = rows[0]
    
    // Replace variables
    let subject = template.subject
    let body = template.body
    
    Object.keys(test_data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g')
      subject = subject.replace(regex, test_data[key])
      body = body.replace(regex, test_data[key])
    })
    
    res.json({
      success: true,
      data: {
        subject,
        body,
        variables_used: Object.keys(test_data),
        variables_available: template.variables
      }
    })
  } catch (error) {
    console.error('Preview email template error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to preview email template',
      details: error.message
    })
  }
})

export default router
