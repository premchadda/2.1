/**
 * Session Controller — Modular session management (V2.2 structure)
 * Merged with V2.1's SessionCaptureService for WebSocket events + IP geolocation.
 *
 * This controller provides REST endpoints for both user-facing and admin session management.
 * Actual session creation/invalidation is delegated to SessionCaptureService (which handles
 * WebSocket events, IP geolocation, and audit logging).
 */
import { pool } from '../../infrastructure/database/postgres-helpers.js'
import {
  captureSession,
  invalidateSession,
  getUserSessions,
  updateSessionActivity
} from '../../services/SessionCaptureService.js'

// ─── User-Agent Parser ────────────────────────────────────────────────────────
// No external deps – inline detection for browser, OS, and device type
export const parseUserAgent = (ua = '') => {
  const info = { browser: 'Unknown', os: 'Unknown', type: 'Desktop', raw: ua }
  if (!ua) return info

  // Browser
  if (ua.includes('Edg/') || ua.includes('Edge/'))       info.browser = 'Edge'
  else if (ua.includes('OPR/') || ua.includes('Opera'))  info.browser = 'Opera'
  else if (ua.includes('SamsungBrowser'))                 info.browser = 'Samsung Browser'
  else if (ua.includes('Chrome/'))                        info.browser = 'Chrome'
  else if (ua.includes('Firefox/'))                       info.browser = 'Firefox'
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) info.browser = 'Safari'
  else if (ua.includes('MSIE') || ua.includes('Trident/'))   info.browser = 'Internet Explorer'

  // OS
  if (ua.includes('Windows NT 10'))      info.os = 'Windows 10/11'
  else if (ua.includes('Windows NT 6.3')) info.os = 'Windows 8.1'
  else if (ua.includes('Windows NT 6.1')) info.os = 'Windows 7'
  else if (ua.includes('Windows'))        info.os = 'Windows'
  else if (ua.includes('Mac OS X'))       info.os = 'macOS'
  else if (ua.includes('Android')) {
    const m = ua.match(/Android ([\d.]+)/)
    info.os = m ? `Android ${m[1]}` : 'Android'
  } else if (ua.includes('iPhone OS') || ua.includes('CPU OS')) {
    const m = ua.match(/OS ([\d_]+)/)
    info.os = m ? `iOS ${m[1].replace(/_/g, '.')}` : 'iOS'
  } else if (ua.includes('Linux')) info.os = 'Linux'
  else if (ua.includes('CrOS'))  info.os = 'ChromeOS'

  // Device type
  if (ua.includes('iPad') || (ua.includes('Android') && ua.includes('Tablet'))) {
    info.type = 'Tablet'
  } else if (
    ua.includes('Mobile') || ua.includes('iPhone') ||
    (ua.includes('Android') && !ua.includes('Tablet'))
  ) {
    info.type = 'Mobile'
  } else {
    info.type = 'Desktop'
  }

  return info
}

// ─── Auto-Schema Ensure ───────────────────────────────────────────────────────
// Run at module load — creates or migrates the user_sessions table
const ensureUserSessionsTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id          SERIAL PRIMARY KEY,
        session_id  VARCHAR(255) UNIQUE,
        user_id     VARCHAR(255) NOT NULL,
        device_info JSONB        DEFAULT '{}',
        device_type VARCHAR(50)  DEFAULT 'desktop',
        browser     VARCHAR(100) DEFAULT 'unknown',
        os          VARCHAR(100) DEFAULT 'unknown',
        ip_address  VARCHAR(100) DEFAULT 'unknown',
        user_agent  TEXT         DEFAULT '',
        country     VARCHAR(100),
        country_code VARCHAR(10),
        city        VARCHAR(100),
        region      VARCHAR(100),
        session_type VARCHAR(50) DEFAULT 'web',
        created_at  TIMESTAMP    DEFAULT NOW(),
        expires_at  TIMESTAMP,
        last_active TIMESTAMP    DEFAULT NOW(),
        is_active   BOOLEAN      DEFAULT true
      )
    `)

    // Detect if old camelCase columns exist and rename
    const colCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_sessions'
    `)
    const cols = colCheck.rows.map(r => r.column_name)

    if (cols.includes('userId')) {
      console.log('[Sessions] Migrating user_sessions columns from camelCase → snake_case')
      const renames = [
        ['"userId"',     'user_id'],
        ['"deviceInfo"', 'device_info'],
        ['"ipAddress"',  'ip_address'],
        ['"userAgent"',  'user_agent'],
        ['"createdAt"',  'created_at'],
        ['"expiresAt"',  'expires_at'],
        ['"isActive"',   'is_active'],
        ['"deletedAt"',  'deleted_at'],
        ['"deletedBy"',  'deleted_by'],
      ]
      for (const [from, to] of renames) {
        if (cols.includes(from.replace(/"/g, ''))) {
          try {
            await pool.query(`ALTER TABLE user_sessions RENAME COLUMN ${from} TO ${to}`)
          } catch (_) { /* column may already be renamed */ }
        }
      }
    }

    // Add missing columns (idempotent)
    const addCols = [
      ['session_id',   'VARCHAR(255) UNIQUE'],
      ['last_active',  'TIMESTAMP DEFAULT NOW()'],
      ['is_active',    'BOOLEAN DEFAULT true'],
      ['device_info',  "JSONB DEFAULT '{}'"],
      ['device_type',  "VARCHAR(50) DEFAULT 'desktop'"],
      ['browser',      "VARCHAR(100) DEFAULT 'unknown'"],
      ['os',           "VARCHAR(100) DEFAULT 'unknown'"],
      ['ip_address',   "VARCHAR(100) DEFAULT 'unknown'"],
      ['user_agent',   "TEXT DEFAULT ''"],
      ['expires_at',   'TIMESTAMP'],
      ['country',      'VARCHAR(100)'],
      ['country_code', 'VARCHAR(10)'],
      ['city',         'VARCHAR(100)'],
      ['region',       'VARCHAR(100)'],
      ['session_type', "VARCHAR(50) DEFAULT 'web'"],
    ]
    for (const [col, def] of addCols) {
      try {
        await pool.query(
          `ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS ${col} ${def}`
        )
      } catch (_) { /* already exists */ }
    }

    // Indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_us_user_id   ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_us_active     ON user_sessions(is_active, expires_at);
      CREATE INDEX IF NOT EXISTS idx_us_created    ON user_sessions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_us_session_id ON user_sessions(session_id);
    `)

    // Note: id column is VARCHAR (created by dbHelpers), not SERIAL.
    // captureSession generates explicit string ids like 'sess_<timestamp>_<random>'.

    console.log('[Sessions] user_sessions table ready ✓')
  } catch (err) {
    console.error('[Sessions] ensureUserSessionsTable failed:', err.message)
  }
}

// Run at startup
ensureUserSessionsTable()

// ─── Session Controller ───────────────────────────────────────────────────────
const sessionController = {
  // GET /api/sessions — current user's own sessions
  getMySessions: async (req, res) => {
    try {
      const userId = String(req.user.id)
      const sessions = await getUserSessions(userId)
      // Map to the frontend-expected shape
      const mapped = sessions.map(s => ({
        id: s.session_id || s.id,
        deviceInfo: s.device_info || { browser: s.browser, os: s.os, type: s.device_type },
        browser: s.browser,
        os: s.os,
        type: s.device_type,
        ipAddress: s.ip_address,
        ip: s.ip_address,
        userAgent: s.user_agent,
        createdAt: s.created_at,
        expiresAt: s.expires_at,
        lastActive: s.last_active,
        isActive: s.is_active,
        country: s.country,
        city: s.city,
      }))
      res.json({ success: true, data: mapped })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  },

  // DELETE /api/sessions/:sessionId — revoke own session
  revokeSession: async (req, res) => {
    try {
      const { sessionId } = req.params
      const userId = String(req.user.id)
      const check = await pool.query(
        `SELECT user_id FROM user_sessions WHERE (session_id = $1 OR id::text = $1) AND is_active = true`,
        [sessionId]
      )
      if (!check.rows.length) {
        return res.status(404).json({ success: false, message: 'Session not found' })
      }
      if (String(check.rows[0].user_id) !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Not authorized' })
      }
      // Delegate to SessionCaptureService (handles WebSocket events)
      await invalidateSession(sessionId, userId)
      res.json({ success: true, message: 'Session revoked' })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  },

  // DELETE /api/sessions — revoke all my sessions except current
  revokeAllSessions: async (req, res) => {
    try {
      const userId = String(req.user.id)
      const currentSessionId = req.headers['x-session-id'] || null
      const result = await pool.query(
        `UPDATE user_sessions
         SET is_active = false
         WHERE user_id = $1 AND is_active = true
           AND ($2::text IS NULL OR session_id != $2)`,
        [userId, currentSessionId]
      )
      res.json({ success: true, message: `Revoked ${result.rowCount} session(s)` })
    } catch (error) {
      res.status(500).json({ success: false, message: error.message })
    }
  },

  // ADMIN: GET /api/admin/sessions — all active sessions across all users
  getAllSessions: async (req, res) => {
    try {
      const { page = 1, limit = 50, userId, search } = req.query
      const offset = (parseInt(page) - 1) * parseInt(limit)

      const buildWhere = () => {
        const params = []
        let where = `s.is_active = true`
        if (userId) { 
          params.push(String(userId))
          where += ` AND s.user_id = $${params.length}` 
        }
        if (search) {
          params.push(`%${search}%`, `%${search}%`)
          where += ` AND (u.name ILIKE $${params.length - 1} OR u.email ILIKE $${params.length})`
        }
        return { where, params }
      }

      const { where, params: baseParams } = buildWhere()

      const dataParams = [...baseParams, parseInt(limit), offset]
      const limitN = `$${dataParams.length - 1}`
      const offsetN = `$${dataParams.length}`
      const result = await pool.query(`
        SELECT
          s.id,
          s.session_id     AS "sessionId",
          s.user_id        AS "userId",
          s.device_type    AS "device_type",
          s.browser,
          s.os,
          s.device_info    AS "deviceInfo",
          s.ip_address     AS "ipAddress",
          s.user_agent     AS "userAgent",
          s.country,
          s.country_code   AS "countryCode",
          s.city,
          s.created_at     AS "createdAt",
          s.expires_at     AS "expiresAt",
          s.last_active    AS "lastActive",
          u.name           AS "userName",
          u.email          AS "userEmail",
          u.role           AS "userRole"
        FROM user_sessions s
        LEFT JOIN users u ON s.user_id = CAST(u.id AS TEXT)
        WHERE ${where}
        ORDER BY s.last_active DESC NULLS LAST
        LIMIT ${limitN}::int OFFSET ${offsetN}::int
      `, dataParams)

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM user_sessions s
         LEFT JOIN users u ON s.user_id = CAST(u.id AS TEXT)
         WHERE ${where}`,
        baseParams
      )

      res.json({
        success: true,
        data: { sessions: result.rows },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0]?.count || 0)
        }
      })
    } catch (error) {
      console.error('[Sessions] getAllSessions error:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  // ADMIN: GET /api/admin/sessions/stats
  getSessionStats: async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          COUNT(*)::int                                                        AS "totalSessions",
          COUNT(DISTINCT user_id)::int                                         AS "uniqueUsers",
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS "last24h",
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int   AS "last7days",
          COUNT(*) FILTER (WHERE device_type = 'mobile')::int                    AS "mobileCount",
          COUNT(*) FILTER (WHERE device_type = 'desktop')::int                   AS "desktopCount"
        FROM user_sessions
        WHERE is_active = true
      `)
      res.json({ success: true, data: result.rows[0] })
    } catch (error) {
      console.error('[Sessions] getSessionStats error:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  // ADMIN: DELETE /api/admin/sessions/:sessionId — force-revoke any session
  revokeAnySession: async (req, res) => {
    try {
      const { sessionId } = req.params
      // Use SessionCaptureService for WebSocket notifications
      await invalidateSession(sessionId, String(req.user.id))
      res.json({ success: true, message: 'Session revoked' })
    } catch (error) {
      console.error('[Sessions] revokeAnySession error:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  // ADMIN: DELETE /api/admin/users/:userId/sessions — revoke all sessions for a user
  revokeUserSessions: async (req, res) => {
    try {
      const { userId } = req.params
      // Get all active sessions for this user
      const sessions = await pool.query(
        `SELECT session_id FROM user_sessions WHERE user_id = $1 AND is_active = true`,
        [String(userId)]
      )
      // Invalidate each (triggers WebSocket events per session)
      let revoked = 0
      for (const row of sessions.rows) {
        await invalidateSession(row.session_id, String(req.user.id))
        revoked++
      }
      res.json({ success: true, message: `Revoked ${revoked} session(s)` })
    } catch (error) {
      console.error('[Sessions] revokeUserSessions error:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  // ADMIN: GET /api/admin/users/:userId/sessions — get sessions for specific user
  getUserSessionsById: async (req, res) => {
    try {
      const { userId } = req.params
      const sessions = await getUserSessions(String(userId))
      const mapped = sessions.map(s => ({
        id: s.session_id || s.id,
        browser: s.browser,
        os: s.os,
        type: s.device_type,
        ip: s.ip_address,
        lastActive: s.last_active,
        createdAt: s.created_at,
        isActive: s.is_active,
        country: s.country,
        countryCode: s.country_code,
        city: s.city,
      }))
      res.json({ success: true, data: mapped })
    } catch (error) {
      console.error('[Sessions] getUserSessionsById error:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  },

  // PUT /api/admin/users/:userId/session-limit — update session limit for a user
  updateSessionLimit: async (req, res) => {
    try {
      const { userId } = req.params
      const { sessionLimit } = req.body
      const limit = sessionLimit ? parseInt(sessionLimit) : null

      await pool.query(
        `UPDATE users SET session_limit = $1 WHERE id = $2`,
        [limit, userId]
      )
      res.json({ success: true, message: 'Session limit updated', data: { sessionLimit: limit } })
    } catch (error) {
      console.error('[Sessions] updateSessionLimit error:', error)
      res.status(500).json({ success: false, message: error.message })
    }
  }
}

export default sessionController

// ─── createSession — called on every login ────────────────────────────────────
// Wrapper around captureSession from SessionCaptureService to maintain V2.2 API compat
export const createSession = async (userId, deviceInfo, ipAddress, userAgent = '', limit = null) => {
  try {
    if (limit) {
      // Find active sessions ordered by created_at DESC
      const activeSessions = await pool.query(
        `SELECT session_id FROM user_sessions 
         WHERE user_id = $1 AND is_active = true 
         ORDER BY created_at DESC`,
        [String(userId)]
      )
      
      // If adding this new session exceeds the limit, revoke the oldest ones
      if (activeSessions.rows.length >= limit) {
        const keepCount = limit - 1
        const sessionsToRevoke = activeSessions.rows.slice(Math.max(0, keepCount))
        
        for (const row of sessionsToRevoke) {
          await invalidateSession(row.session_id, 'system:limit-enforcement')
        }
        console.log(`[Sessions] Revoked ${sessionsToRevoke.length} old session(s) for user ${userId} to enforce limit of ${limit}`)
      }
    }

    // Use a fake request object for captureSession compatibility
    const fakeReq = {
      headers: { 'user-agent': userAgent, 'x-forwarded-for': ipAddress },
      socket: { remoteAddress: ipAddress },
      ip: ipAddress
    }
    const sessionId = await captureSession(fakeReq, String(userId), 'web')

    console.log(`[Sessions] Created session ${sessionId} for user ${userId}`)
    return sessionId
  } catch (err) {
    // Don't break login if session creation fails — log and continue
    console.error('[Sessions] createSession failed (non-fatal):', err.message)
    return null
  }
}
