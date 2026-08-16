import express from 'express'
import { protect, admin } from '../../middleware/auth.middleware.js'
import { pool } from '../../infrastructure/database/postgres-helpers.js'
import logger from '../../infrastructure/logger/logger.js'
import { queueEmail } from '../../infrastructure/email/emailService.js'

const router = express.Router()

// Apply authentication and admin authorization to all routes
router.use(protect)
router.use(admin)

/**
 * HTML-escape interpolated values so template test/preview data can never
 * inject markup into emails or the admin response.
 */
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (ch) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[ch]))

/**
 * Replace {{key}} placeholders using split/join — a RegExp constructor with
 * metacharacter keys (e.g. "user(name)") would throw or misbehave. Values are
 * HTML-escaped before insertion.
 */
function interpolateTemplate(template, data) {
  if (!data || typeof data !== 'object') return template
  for (const [key, value] of Object.entries(data)) {
    const token = `{{${key}}}`
    if (template.includes(token)) {
      template = template.split(token).join(escapeHtml(value))
    }
  }
  return template
}

/**
 * GET /admin/email-templates
 * Get all email templates
 */
router.get('/', async (req, res) => {
  try {
    const { type, enabled } = req.query

    // Exclude soft-deleted templates — the DELETE handler soft-deletes
    // (is_deleted = true, migration 032/111 pattern) so templates land in the
    // recycle bin; the admin list must only show live templates.
    let whereClause = 'WHERE is_deleted = false'
    const params = []
    let paramIndex = 1

    if (type) {
      whereClause += ` AND type = $${paramIndex}`
      params.push(type)
      paramIndex++
    }

    if (enabled !== undefined) {
      whereClause += ` AND enabled = $${paramIndex}`
      params.push(enabled === 'true')
      paramIndex++
    }
    
    const { rows } = await pool.query(
      `SELECT id, name, type, subject, body, body_html, body_text, variables, enabled, is_active, created_at, updated_at, is_deleted, deleted_at, deleted_by FROM email_templates ${whereClause} ORDER BY created_at DESC`,
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
    logger.error('Get email templates error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
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
      'SELECT id, name, type, subject, body, body_html, body_text, variables, enabled, is_active, created_at, updated_at, is_deleted, deleted_at, deleted_by FROM email_templates WHERE id = $1 AND is_deleted = false',
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
    logger.error('Get email template error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
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
  if (variables !== undefined && (variables === null || typeof variables !== 'object' || Array.isArray(variables))) {
    return res.status(400).json({
      success: false,
      error: 'variables must be an object'
    })
  }
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: 'enabled must be a boolean'
    })
  }
  
  try {
    const { rows } = await pool.query(
      `INSERT INTO email_templates (name, type, subject, body, variables, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, type, subject, body, variables || {}, enabled]
    )
    
    res.status(201).json({
      success: true,
      data: rows[0],
      message: 'Email template created successfully'
    })
  } catch (error) {
    logger.error('Create email template error:', error)
    
    if (error.code === '23505') { // Unique violation
      try {
        // Relax the conflict when the name is only held by a TRASHED row —
        // restore-overwrite it so a new create is not blocked by trash.
        const { rows: trashed } = await pool.query(
          `UPDATE email_templates
             SET name = $1, type = $2, subject = $3, body = $4,
                 variables = $5, enabled = $6,
                 is_deleted = false, is_active = true,
                 deleted_at = NULL, deleted_by = NULL,
                 updated_at = NOW()
           WHERE name = $1 AND is_deleted = true
           RETURNING *`,
          [name, type, subject, body, variables || {}, enabled]
        )
        if (trashed.length > 0) {
          return res.status(201).json({
            success: true,
            data: trashed[0],
            message: 'Email template created successfully (restored from trash)'
          })
        }
      } catch (restoreErr) {
        logger.error('Restore trashed template on name conflict error:', restoreErr)
      }
      return res.status(409).json({
        success: false,
        error: 'Template name already exists'
      })
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
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
  
  if (variables !== undefined && (variables === null || typeof variables !== 'object' || Array.isArray(variables))) {
    return res.status(400).json({
      success: false,
      error: 'variables must be an object'
    })
  }
  if (enabled !== undefined && typeof enabled !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: 'enabled must be a boolean'
    })
  }
  
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
      `UPDATE email_templates SET ${updates.join(', ')} WHERE id = $${paramIndex} AND is_deleted = false RETURNING *`,
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
    logger.error('Update email template error:', error)
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Template name already exists'
      })
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

/**
 * DELETE /admin/email-templates/:id
 * Soft-delete email template (migration 032 pattern: is_deleted = true,
 * is_active = false, deleted_at/deleted_by audit columns). Hard DELETE is
 * intentionally avoided so templates are recoverable via the recycle bin.
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params

  try {
    const result = await pool.query(
      `UPDATE email_templates
         SET is_deleted = true,
             is_active = false,
             deleted_at = NOW(),
             deleted_by = $2,
             updated_at = NOW()
       WHERE id = $1`,
      [id, req.user?.id ?? null]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Email template not found'
      })
    }

    res.json({
      success: true,
      message: 'Email template soft-deleted (moved to trash)'
    })
  } catch (error) {
    logger.error('Delete email template error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
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
    // Get template — trashed templates cannot be tested
    const { rows } = await pool.query(
      'SELECT id, name, type, subject, body, body_html, body_text, variables, enabled, is_active, created_at, updated_at, is_deleted, deleted_at, deleted_by FROM email_templates WHERE id = $1 AND is_deleted = false',
      [id]
    )
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Email template not found'
      })
    }
    
    const template = rows[0]
    
    // Replace {{variable}} with test_data values (split/join, HTML-escaped)
    const subject = interpolateTemplate(template.subject, test_data)
    const body = interpolateTemplate(template.body, test_data)
    
    await queueEmail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'Trstprep <noreply@trstprep.com>',
      to: to_email,
      subject,
      html: body,
    })

    res.json({
      success: true,
      data: {
        to: to_email,
        subject,
        body_preview: body.substring(0, 500) + (body.length > 500 ? '...' : ''),
      },
      message: 'Test email queued for delivery',
    })
  } catch (error) {
    logger.error('Test email template error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
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
    // Trashed templates cannot be previewed
    const { rows } = await pool.query(
      'SELECT id, name, type, subject, body, body_html, body_text, variables, enabled, is_active, created_at, updated_at, is_deleted, deleted_at, deleted_by FROM email_templates WHERE id = $1 AND is_deleted = false',
      [template_id]
    )
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Email template not found'
      })
    }
    
    const template = rows[0]
    
    // Replace variables (split/join, HTML-escaped)
    const subject = interpolateTemplate(template.subject, test_data)
    const body = interpolateTemplate(template.body, test_data)
    
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
    logger.error('Preview email template error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

export default router
