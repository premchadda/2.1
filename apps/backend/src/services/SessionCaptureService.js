import { randomUUID } from 'crypto'
import { pool } from '../infrastructure/database/postgres-helpers.js'
import { getIO } from '../infrastructure/websocket/websocketManager.js'

const getClientIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for']
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || req.ip || 'unknown'
}

const parseUserAgent = (userAgent) => {
  if (!userAgent) {
    return { device: 'desktop', browser: 'Unknown', os: 'Unknown' }
  }

  const ua = userAgent  // keep original case for matching

  // Browser — order matters: Edge/Opera contain 'Chrome' so check them first
  let browser = 'Unknown'
  if (ua.includes('Edg/') || ua.includes('Edge/'))       browser = 'Edge'
  else if (ua.includes('OPR/') || ua.includes('Opera'))  browser = 'Opera'
  else if (ua.includes('SamsungBrowser'))                 browser = 'Samsung Browser'
  else if (ua.includes('Chrome/'))                        browser = 'Chrome'
  else if (ua.includes('Firefox/'))                       browser = 'Firefox'
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 'Safari'
  else if (ua.includes('MSIE') || ua.includes('Trident/'))   browser = 'Internet Explorer'

  // OS
  let os = 'Unknown'
  if (ua.includes('Windows NT 10'))       os = 'Windows 10/11'
  else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1'
  else if (ua.includes('Windows NT 6.1')) os = 'Windows 7'
  else if (ua.includes('Windows'))        os = 'Windows'
  else if (ua.includes('Mac OS X'))       os = 'macOS'
  else if (ua.includes('Android')) {
    const m = ua.match(/Android ([\d.]+)/)
    os = m ? `Android ${m[1]}` : 'Android'
  } else if (ua.includes('iPhone OS') || ua.includes('CPU OS')) {
    const m = ua.match(/OS ([\d_]+)/)
    os = m ? `iOS ${m[1].replace(/_/g, '.')}` : 'iOS'
  } else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('CrOS'))   os = 'ChromeOS'

  // Device
  let device = 'desktop'
  if (ua.includes('iPad') || (ua.includes('Android') && ua.includes('Tablet'))) {
    device = 'tablet'
  } else if (ua.includes('Mobile') || ua.includes('iPhone') || (ua.includes('Android') && !ua.includes('Tablet'))) {
    device = 'mobile'
  }

  return { device, browser, os }
}

const extractLocationFromIp = async (ip) => {
  if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { country: 'Local Network', countryCode: 'LAN', city: 'Localhost', region: 'Local' }
  }
  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,countryCode,city,region`)
    if (response.ok) {
      const data = await response.json()
      return {
        country: data.country || null,
        countryCode: data.countryCode || null,
        city: data.city || null,
        region: data.region || null
      }
    }
  } catch (error) {
    console.log('[SessionCapture] Location lookup failed:', error.message)
  }
  return { country: null, countryCode: null, city: null, region: null }
}

export const captureSession = async (req, userId, sessionType = 'web') => {
  try {
    const ipAddress = getClientIp(req)
    const userAgent = req.headers['user-agent']
    const { device, browser, os } = parseUserAgent(userAgent)
    const location = await extractLocationFromIp(ipAddress)
    const sessionId = randomUUID()

    const sessionData = {
      user_id: userId,
      session_id: sessionId,
      ip_address: ipAddress,
      user_agent: userAgent,
      device_type: device,
      browser: browser,
      os: os,
      country: location.country,
      country_code: location.countryCode,
      city: location.city,
      region: location.region,
      session_type: sessionType,
      is_active: true,
      created_at: new Date(),
      last_active: new Date()
    }

    // The id column is VARCHAR (created by dbHelpers), not SERIAL — must provide an explicit string id
    const rowId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`
    const result = await pool.query(
      `INSERT INTO user_sessions (
        id, user_id, session_id, ip_address, user_agent, device_type,
        browser, os, country, country_code, city, region,
        session_type, is_active, created_at, last_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) RETURNING id`,
      [
        rowId,
        sessionData.user_id,
        sessionData.session_id,
        sessionData.ip_address,
        sessionData.user_agent,
        sessionData.device_type,
        sessionData.browser,
        sessionData.os,
        sessionData.country,
        sessionData.country_code,
        sessionData.city,
        sessionData.region,
        sessionData.session_type,
        sessionData.is_active,
        sessionData.created_at,
        sessionData.last_active
      ]
    )
    const sessionDbId = result.rows[0].id

    console.log(`[SessionCapture] Session created for user ${userId}: ${sessionId}`)

    // Emit WebSocket event for real-time session tracking
    try {
      const io = getIO()
      // Fetch user details for admin notification
      const userResult = await pool.query('SELECT name, email, role FROM users WHERE id = $1', [userId])
      const user = userResult.rows[0] || {}
      const payload = {
        id: sessionDbId,
        session_id: sessionId,
        user_id: userId,
        user_name: user.name,
        user_email: user.email,
        user_role: user.role,
        ip_address: ipAddress,
        device_type: device,
        browser,
        os,
        country: location.country,
        city: location.city,
        session_type: sessionType,
        is_active: true,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString()
      }
      // Notify admins monitoring sessions
      io.to('admin:sessions').emit('session:created', payload)
      // Also send to user's personal room (lightweight)
      io.to(`user:${userId}`).emit('session:created', {
        session_id: sessionId,
        device_type: device,
        browser,
        os,
        location: location,
        session_type: sessionType,
        created_at: new Date().toISOString()
      })
    } catch (error) {
      console.error('[WebSocket] Failed to emit session:created:', error.message)
    }

    return sessionId
  } catch (error) {
    console.error('[SessionCapture] Failed to capture session:', error.message)
    return null
  }
}

export const updateSessionActivity = async (sessionId) => {
  try {
    if (!sessionId) return
    await pool.query(
      'UPDATE user_sessions SET last_active = $1 WHERE session_id = $2',
      [new Date(), sessionId]
    )
  } catch (error) {
    console.error('[SessionCapture] Failed to update session activity:', error.message)
  }
}

export const invalidateSession = async (sessionId, revokedBy = null) => {
  try {
    if (!sessionId) return

    // Get session details before invalidation for WebSocket notification
    const sessionResult = await pool.query(
      'SELECT user_id FROM user_sessions WHERE session_id = $1',
      [sessionId]
    )
    const session = sessionResult.rows[0]

    await pool.query(
      'UPDATE user_sessions SET is_active = false WHERE session_id = $1',
      [sessionId]
    )
    console.log(`[SessionCapture] Session invalidated: ${sessionId}`)

    // Emit WebSocket event
    if (session) {
      try {
        const io = getIO()
        const payload = {
          sessionId,
          userId: session.user_id,
          revokedBy: revokedBy,
          revokedAt: new Date().toISOString()
        }
        // Notify user that their session was revoked
        io.to(`user:${session.user_id}`).emit('session:revoked', payload)
        // Notify admins monitoring sessions
        io.to('admin:sessions').emit('session:revoked', payload)
      } catch (error) {
        console.error('[WebSocket] Failed to emit session:revoked:', error.message)
      }
    }
  } catch (error) {
    console.error('[SessionCapture] Failed to invalidate session:', error.message)
  }
}

export const getUserSessions = async (userId) => {
  try {
    const result = await pool.query(
      `SELECT id, session_id, ip_address, device_type, browser, os,
              country, country_code, city, session_type, is_active, created_at, last_active
       FROM user_sessions 
       WHERE user_id = $1 AND is_active = true
       ORDER BY last_active DESC`,
      [String(userId)]
    )
    return result.rows
  } catch (error) {
    console.error('[SessionCapture] Failed to get sessions:', error.message)
    return []
  }
}

export default {
  captureSession,
  updateSessionActivity,
  invalidateSession,
  getUserSessions
}