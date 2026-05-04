import express from 'express'
import { protect, admin, superAdmin } from '../../middleware/auth.middleware.js'
import { pool } from '../../infrastructure/database/postgres-helpers.js'

const router = express.Router()

// Apply authentication and admin authorization to all routes
router.use(protect)
router.use(admin)

/**
 * GET /admin/permissions
 * Get all available permissions
 * Public endpoint (within admin context) - lists all permissions for UI selection
 */
router.get('/permissions', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
        id,
        name,
        resource,
        action,
        description,
        created_at
       FROM permissions
       ORDER BY resource ASC, action ASC`
    )
    
    // Group permissions by resource
    const groupedPermissions = {}
    rows.forEach(permission => {
      if (!groupedPermissions[permission.resource]) {
        groupedPermissions[permission.resource] = []
      }
      groupedPermissions[permission.resource].push({
        id: permission.id,
        name: permission.name,
        action: permission.action,
        description: permission.description
      })
    })
    
    res.json({
      success: true,
      data: {
        permissions: rows,
        grouped: groupedPermissions,
        total: rows.length
      }
    })
  } catch (error) {
    console.error('Get permissions error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch permissions',
      details: error.message
    })
  }
})

/**
 * GET /admin/roles
 * Get all roles with their permissions and user counts
 */
router.get('/roles', async (req, res) => {
  try {
    const rolesQuery = `
      SELECT 
        r.id,
        r.name,
        r.description,
        r.created_at,
        r.updated_at,
        COUNT(DISTINCT ur.user_id) as user_count,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', p.id,
              'name', p.name,
              'resource', p.resource,
              'action', p.action
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'::json
        ) as permissions
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.id
      GROUP BY r.id, r.name, r.description, r.created_at, r.updated_at
      ORDER BY r.created_at DESC
    `
    
    const { rows } = await pool.query(rolesQuery)
    
    res.json({
      success: true,
      data: {
        roles: rows,
        total: rows.length
      }
    })
  } catch (error) {
    console.error('Get roles error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch roles',
      details: error.message
    })
  }
})

/**
 * POST /admin/roles
 * Create a new role with permissions
 * Requires superAdmin privileges
 */
router.post('/roles', protect, superAdmin, async (req, res) => {
  const { name, description, permissions } = req.body
  
  // Validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Role name is required'
    })
  }
  
  if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'At least one permission is required'
    })
  }
  
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    // Check if role name already exists
    const existingRole = await client.query(
      'SELECT id FROM roles WHERE name = $1',
      [name.toLowerCase()]
    )
    
    if (existingRole.rows.length > 0) {
      await client.query('ROLLBACK')
      return res.status(409).json({
        success: false,
        error: 'Role name already exists'
      })
    }
    
    // Create role
    const roleResult = await client.query(
      `INSERT INTO roles (name, description)
       VALUES ($1, $2)
       RETURNING id, name, description, created_at`,
      [name.toLowerCase(), description || null]
    )
    
    const roleId = roleResult.rows[0].id
    
    // Assign permissions to role
    const permissionValues = permissions.map((permId, index) => 
      `($1, $${index + 2})`
    ).join(', ')
    
    const permissionParams = [roleId, ...permissions]
    
    await client.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       VALUES ${permissionValues}`,
      permissionParams
    )
    
    await client.query('COMMIT')
    
    res.status(201).json({
      success: true,
      data: roleResult.rows[0],
      message: 'Role created successfully'
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Create role error:', error)
    
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({
        success: false,
        error: 'Role name already exists'
      })
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create role',
      details: error.message
    })
  } finally {
    client.release()
  }
})

/**
 * PUT /admin/roles/:id
 * Update role name, description, and permissions
 * Requires superAdmin privileges
 */
router.put('/roles/:id', protect, superAdmin, async (req, res) => {
  const { id } = req.params
  const { name, description, permissions } = req.body
  
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    // Check if role exists
    const existingRole = await client.query(
      'SELECT id, name FROM roles WHERE id = $1',
      [id]
    )
    
    if (existingRole.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({
        success: false,
        error: 'Role not found'
      })
    }
    
    const currentName = existingRole.rows[0].name
    
    // Update role name and description if provided
    if (name && name.toLowerCase() !== currentName) {
      // Check if new name already exists
      const nameCheck = await client.query(
        'SELECT id FROM roles WHERE name = $1 AND id != $2',
        [name.toLowerCase(), id]
      )
      
      if (nameCheck.rows.length > 0) {
        await client.query('ROLLBACK')
        return res.status(409).json({
          success: false,
          error: 'Role name already exists'
        })
      }
      
      await client.query(
        'UPDATE roles SET name = $1, description = $2, updated_at = NOW() WHERE id = $3',
        [name.toLowerCase(), description || null, id]
      )
    } else if (description !== undefined) {
      await client.query(
        'UPDATE roles SET description = $1, updated_at = NOW() WHERE id = $2',
        [description, id]
      )
    }
    
    // Update permissions if provided
    if (permissions && Array.isArray(permissions)) {
      // Delete existing permissions
      await client.query(
        'DELETE FROM role_permissions WHERE role_id = $1',
        [id]
      )
      
      // Insert new permissions
      if (permissions.length > 0) {
        const permissionValues = permissions.map((permId, index) => 
          `($1, $${index + 2})`
        ).join(', ')
        
        const permissionParams = [id, ...permissions]
        
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ${permissionValues}`,
          permissionParams
        )
      }
    }
    
    await client.query('COMMIT')
    
    res.json({
      success: true,
      message: 'Role updated successfully'
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Update role error:', error)
    
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Role name already exists'
      })
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to update role',
      details: error.message
    })
  } finally {
    client.release()
  }
})

/**
 * DELETE /admin/roles/:id
 * Delete a role
 * Requires superAdmin privileges
 * Prevents deletion of roles that have users assigned
 */
router.delete('/roles/:id', protect, superAdmin, async (req, res) => {
  const { id } = req.params
  
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    // Check if role exists
    const existingRole = await client.query(
      'SELECT id, name FROM roles WHERE id = $1',
      [id]
    )
    
    if (existingRole.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({
        success: false,
        error: 'Role not found'
      })
    }
    
    // Check if role has users assigned
    const userCountResult = await client.query(
      'SELECT COUNT(*) as count FROM user_roles WHERE role_id = $1',
      [id]
    )
    
    const userCount = parseInt(userCountResult.rows[0].count)
    
    if (userCount > 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        success: false,
        error: `Cannot delete role. It has ${userCount} user(s) assigned. Please reassign or remove users first.`
      })
    }
    
    // Delete role permissions first
    await client.query(
      'DELETE FROM role_permissions WHERE role_id = $1',
      [id]
    )
    
    // Delete role
    await client.query(
      'DELETE FROM roles WHERE id = $1',
      [id]
    )
    
    await client.query('COMMIT')
    
    res.json({
      success: true,
      message: 'Role deleted successfully'
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Delete role error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete role',
      details: error.message
    })
  } finally {
    client.release()
  }
})

/**
 * GET /admin/roles/:id/users
 * Get all users assigned to a specific role
 */
router.get('/roles/:id/users', async (req, res) => {
  const { id } = req.params
  const { page = 1, limit = 50 } = req.query
  const offset = (parseInt(page) - 1) * parseInt(limit)
  
  try {
    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM user_roles WHERE role_id = $1',
      [id]
    )
    
    const total = parseInt(countResult.rows[0].count)
    
    // Get users
    const usersQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.created_at,
        ur.created_at as assigned_at
      FROM user_roles ur
      JOIN users u ON ur.user_id = u.id
      WHERE ur.role_id = $1
      ORDER BY ur.created_at DESC
      LIMIT $2 OFFSET $3
    `
    
    const { rows } = await pool.query(usersQuery, [id, parseInt(limit), offset])
    
    res.json({
      success: true,
      data: {
        users: rows,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Get role users error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch role users',
      details: error.message
    })
  }
})

/**
 * POST /admin/roles/:id/assign
 * Assign role to users
 */
router.post('/roles/:id/assign', protect, superAdmin, async (req, res) => {
  const { id } = req.params
  const { user_ids } = req.body
  
  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'user_ids array is required'
    })
  }
  
  const client = await pool.connect()
  
  try {
    await client.query('BEGIN')
    
    // Check if role exists
    const roleExists = await client.query(
      'SELECT id FROM roles WHERE id = $1',
      [id]
    )
    
    if (roleExists.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({
        success: false,
        error: 'Role not found'
      })
    }
    
    // Assign role to users (ignore duplicates)
    const values = user_ids.map((userId, index) => 
      `($1, $${index + 2})`
    ).join(', ')
    
    const params = [id, ...user_ids]
    
    await client.query(
      `INSERT INTO user_roles (role_id, user_id)
       VALUES ${values}
       ON CONFLICT (role_id, user_id) DO NOTHING`,
      params
    )
    
    await client.query('COMMIT')
    
    res.json({
      success: true,
      message: `Role assigned to ${user_ids.length} user(s)`
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Assign role error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to assign role',
      details: error.message
    })
  } finally {
    client.release()
  }
})

/**
 * DELETE /admin/roles/:id/unassign
 * Remove role from users
 */
router.delete('/roles/:id/unassign', protect, superAdmin, async (req, res) => {
  const { id } = req.params
  const { user_ids } = req.body
  
  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'user_ids array is required'
    })
  }
  
  try {
    const values = user_ids.map((userId, index) => 
      `$${index + 1}`
    ).join(', ')
    
    const params = [id, ...user_ids]
    
    await pool.query(
      `DELETE FROM user_roles 
       WHERE role_id = $1 
       AND user_id IN (${values.slice(values.indexOf(',') + 1)})`,
      params
    )
    
    res.json({
      success: true,
      message: `Role removed from ${user_ids.length} user(s)`
    })
  } catch (error) {
    console.error('Unassign role error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to unassign role',
      details: error.message
    })
  }
})

export default router
