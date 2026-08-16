import express from 'express'
import { protect, admin, superAdmin } from '../../middleware/auth.middleware.js'
import { pool } from '../../infrastructure/database/postgres-helpers.js'
import { responseCache } from '../../middleware/responseCache.middleware.js'

const router = express.Router()

// Apply authentication and admin authorization to all routes
router.use(protect)
router.use(admin)

/**
 * GET /api/admin/audit-logs
 * Get paginated audit logs with filtering and search.
 * Query params: page, limit, action, tableName, entity_type, user_id, date_from, date_to, search
 *
 * Response shape expected by AuditTrailManager.jsx:
 *   { success, data: [...logs], pagination: { page, limit, total, totalPages } }
 */
router.get('/', responseCache('admin-audit-logs', 15), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      entity_type,
      tableName,        // frontend sends this; treated as alias for entity_type
      user_id,
      date_from,
      date_to,
      search,
    } = req.query

    const pageNum  = Math.max(1, parseInt(page))
    const limitNum = Math.min(200, Math.max(1, parseInt(limit)))
    const offset   = (pageNum - 1) * limitNum

    const conditions = []
    const params = []
    let paramIndex = 1

    if (action) {
      conditions.push(`al.action = $${paramIndex++}`)
      params.push(action)
    }

    // Accept both 'tableName' (frontend) and 'entity_type' (canonical)
    const entityTypeFilter = entity_type || tableName
    if (entityTypeFilter) {
      conditions.push(`al.entity_type = $${paramIndex++}`)
      params.push(entityTypeFilter)
    }

    if (user_id) {
      conditions.push(`al.user_id = $${paramIndex++}`)
      params.push(user_id)
    }

    if (date_from) {
      conditions.push(`al.created_at >= $${paramIndex++}`)
      params.push(date_from)
    }

    if (date_to) {
      conditions.push(`al.created_at <= $${paramIndex++}`)
      params.push(date_to)
    }

    if (search) {
      conditions.push(
        `(al.action        ILIKE $${paramIndex}
          OR al.entity_type  ILIKE $${paramIndex}
          OR COALESCE(al.resource, '') ILIKE $${paramIndex}
          OR COALESCE(al.description, '') ILIKE $${paramIndex}
          OR COALESCE(al.request_path, '') ILIKE $${paramIndex}
          OR COALESCE(u.name,  '') ILIKE $${paramIndex}
          OR COALESCE(u.email, '') ILIKE $${paramIndex})`
      )
      params.push(`%${search}%`)
      paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const client = await pool.connect()
    try {
      // Count needs the users JOIN too (search can filter by user name/email)
      const countQuery = `
        SELECT COUNT(*) FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ${whereClause}
      `
      const { rows: countRows } = await client.query(countQuery, params)
      const total = parseInt(countRows[0].count)

      const logsQuery = `
        SELECT
          al.id,
          al.user_id,
          al.action,
          al.entity_type                   AS table_name,
          al.entity_id                     AS record_id,
          al.resource,
          al.resource_id,
          al.old_values                    AS old_data,
          al.new_values                    AS new_data,
          al.description,
          al.ip_address,
          al.user_agent,
          al.status,
          al.request_method,
          al.request_path,
          al.response_status_code,
          al.details,
          al.created_at                    AS timestamp,
          COALESCE(u.name,  al.admin_name)  AS user_name,
          COALESCE(u.email, al.admin_email) AS user_email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `

      const { rows } = await client.query(logsQuery, [...params, limitNum, offset])

      res.json({
        success: true,
        data: rows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Get audit logs error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit logs',
      details: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred',
    })
  }
})

/**
 * GET /api/admin/audit-logs/stats
 * Audit statistics for the given time range.
 * Query params: range (7d|30d|90d)
 *
 * Response shape expected by AuditTrailManager.jsx:
 *   { success, data: { actions: [...], tables: [...], summary: {...} } }
 */
router.get('/stats', responseCache('admin-audit-stats', 60), async (req, res) => {
  try {
    const { range = '30d' } = req.query
    const days = Math.min(365, Math.max(1, parseInt(range.replace('d', ''))))

    const client = await pool.connect()
    try {
      // FIX CRIT-04: Use parameterized interval instead of string interpolation
      const totalResult = await client.query(
        `SELECT COUNT(*) AS total FROM audit_logs WHERE created_at >= NOW() - make_interval(days => $1)`,
        [days]
      )
      const total = parseInt(totalResult.rows[0].total)

      // Actions breakdown — returned as 'actions' to match frontend
      const { rows: byAction } = await client.query(`
        SELECT
          action,
          COUNT(*)::int               AS count,
          COUNT(DISTINCT user_id)::int AS unique_users
        FROM audit_logs
        WHERE created_at >= NOW() - make_interval(days => $1)
        GROUP BY action
        ORDER BY count DESC
        LIMIT 20
      `, [days])

      // Entity-type breakdown — returned as 'tables', with 'table_name' alias for frontend dropdown
      const { rows: byEntity } = await client.query(`
        SELECT
          COALESCE(entity_type, resource, 'unknown') AS table_name,
          COUNT(*)::int                               AS count,
          COUNT(DISTINCT user_id)::int                AS unique_users
        FROM audit_logs
        WHERE created_at >= NOW() - make_interval(days => $1)
        GROUP BY COALESCE(entity_type, resource, 'unknown')
        ORDER BY count DESC
        LIMIT 20
      `, [days])

      // Top active users
      const { rows: byUser } = await client.query(`
        SELECT
          u.id,
          u.name,
          u.email,
          COUNT(*)::int               AS action_count,
          MAX(al.created_at)          AS last_action
        FROM audit_logs al
        JOIN users u ON al.user_id = u.id
        WHERE al.created_at >= NOW() - make_interval(days => $1)
        GROUP BY u.id, u.name, u.email
        ORDER BY action_count DESC
        LIMIT 10
      `, [days])

      // Daily trend
      const { rows: dailyTrend } = await client.query(`
        SELECT
          DATE(created_at)            AS date,
          COUNT(*)::int               AS count,
          COUNT(DISTINCT user_id)::int AS unique_users
        FROM audit_logs
        WHERE created_at >= NOW() - make_interval(days => $1)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, [days])

      res.json({
        success: true,
        data: {
          actions: byAction,                          // frontend: stats.actions
          tables:  byEntity,                          // frontend: stats.tables
          summary: {
            total_logs:  total,
            period_days: days,
            avg_per_day: days > 0 ? (total / days).toFixed(2) : '0.00',
          },
          by_user:      byUser,
          daily_trend:  dailyTrend,
        },
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Get audit stats error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit statistics',
      details: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred',
    })
  }
})

/**
 * GET /api/admin/audit-logs/:id
 * Single audit log entry detail.
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params
  try {
    const { rows } = await pool.query(
      `SELECT
         al.*,
         al.entity_type                   AS table_name,
         al.entity_id                     AS record_id,
         al.old_values                    AS old_data,
         al.new_values                    AS new_data,
         al.created_at                    AS timestamp,
         COALESCE(u.name,  al.admin_name)  AS user_name,
         COALESCE(u.email, al.admin_email) AS user_email,
         u.phone                          AS user_phone
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.id = $1`,
      [id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Audit log entry not found' })
    }

    res.json({ success: true, data: rows[0] })
  } catch (error) {
    console.error('Get audit log detail error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit log detail',
      details: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred',
    })
  }
})

/**
 * DELETE /api/admin/audit-logs
 * Purge old audit logs.
 * Query params: older_than (days, default 365), limit (max rows, default 10000)
 */
router.delete('/', superAdmin, async (req, res) => {
  const { older_than = 365, limit = 10000 } = req.query
  const days = Math.max(30, parseInt(older_than))   // safety: never delete < 30 days
  const maxRows = Math.min(50000, parseInt(limit))

  try {
    // FIX CRIT-04: Use parameterized queries instead of string interpolation
    const { rows } = await pool.query(
      `DELETE FROM audit_logs
       WHERE ctid IN (
         SELECT ctid FROM audit_logs
         WHERE created_at < NOW() - make_interval(days => $1)
         LIMIT $2
       )
       RETURNING id`,
      [days, maxRows]
    )

    res.json({
      success: true,
      data: { deleted_count: rows.length, older_than_days: days },
      message: `Deleted ${rows.length} audit log entries older than ${days} days`,
    })
  } catch (error) {
    console.error('Purge audit logs error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to purge audit logs',
      details: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred',
    })
  }
})

export default router
