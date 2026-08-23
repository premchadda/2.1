import { randomUUID, createHash, timingSafeEqual } from "crypto";
import { pool } from "../infrastructure/database/postgres-helpers.js";
import { getIO } from "../infrastructure/websocket/websocketManager.js";
import { getRedisClient } from "../infrastructure/cache/redisClient.js";
import logger from "../infrastructure/logger/logger.js";

const getClientIp = (req) => {
  // Prefer Express trust-proxy aware req.ip (app.set('trust proxy',1))
  // to avoid XFF spoofing. Fallback to XFF only when req.ip unavailable
  // or in development without proxy.
  if (req?.ip) {
    let ip = String(req.ip).trim();
    if (ip.startsWith("::ffff:")) ip = ip.slice(7);
    // req.ip may be ::1 for localhost
    if (ip && ip !== "::1") return ip;
    if (ip === "::1") return "127.0.0.1";
  }
  const forwardedFor = req?.headers?.["x-forwarded-for"];
  if (forwardedFor) {
    const first = String(forwardedFor).split(",")[0].trim();
    if (first.startsWith("::ffff:")) return first.slice(7);
    return first;
  }
  const sock = req?.socket?.remoteAddress || req?.connection?.remoteAddress;
  if (sock) {
    if (sock.startsWith("::ffff:")) return sock.slice(7);
    if (sock === "::1") return "127.0.0.1";
    return sock;
  }
  return "unknown";
};

export const parseUserAgent = (userAgent) => {
  if (!userAgent) {
    return { device: "desktop", browser: "Unknown", os: "Unknown" };
  }

  const ua = String(userAgent);

  // Browser — order matters: Edge/Opera/Brave contain 'Chrome' so check them first
  let browser = "Unknown";
  if (ua.includes("Edg/") || ua.includes("Edge/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Brave/")) browser = "Brave";
  else if (ua.includes("SamsungBrowser")) browser = "Samsung Browser";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (
    ua.includes("Safari/") &&
    !ua.includes("Chrome") &&
    !ua.includes("Chromium")
  )
    browser = "Safari";
  else if (ua.includes("MSIE") || ua.includes("Trident/"))
    browser = "Internet Explorer";

  // OS — check iOS before macOS (iPhone UA contains 'like Mac OS X')
  let os = "Unknown";
  if (ua.includes("Windows NT 10")) os = "Windows 10/11";
  else if (ua.includes("Windows NT 6.3")) os = "Windows 8.1";
  else if (ua.includes("Windows NT 6.2")) os = "Windows 8";
  else if (ua.includes("Windows NT 6.1")) os = "Windows 7";
  else if (ua.includes("Windows NT 6.0")) os = "Windows Vista";
  else if (ua.includes("Windows")) os = "Windows";
  else if (
    ua.includes("iPhone OS") ||
    ua.includes("iPad") ||
    ua.includes("CPU OS")
  ) {
    // iOS / iPadOS — must come before Mac OS X
    const m = ua.match(/OS ([\d_]+)/);
    if (m) {
      const ver = m[1].replace(/_/g, ".");
      // Distinguish iPad vs iPhone when possible
      if (ua.includes("iPad")) os = `iPadOS ${ver}`;
      else os = `iOS ${ver}`;
    } else {
      os = ua.includes("iPad") ? "iPadOS" : "iOS";
    }
  } else if (ua.includes("Mac OS X")) {
    // macOS — but iPadOS 13+ masquerades as Macintosh; detect touch-capable iPad
    // via "Macintosh" + "Mobile" is not present, so we keep macOS. Real iPad desktop mode
    // cannot be reliably distinguished without client hints; keep as macOS with note.
    const m = ua.match(/Mac OS X ([\d_]+)/);
    if (m) os = `macOS ${m[1].replace(/_/g, ".")}`;
    else os = "macOS";
  } else if (ua.includes("Android")) {
    const m = ua.match(/Android ([\d.]+)/);
    os = m ? `Android ${m[1]}` : "Android";
  } else if (ua.includes("CrOS")) os = "ChromeOS";
  else if (ua.includes("Linux")) os = "Linux";

  // Device — robust heuristic:
  // tablet: iPad OR (Android && !Mobile) ; mobile: iPhone/iPod/Mobile ; desktop: rest
  // Many Android tablets do NOT contain "Tablet" token, they are identified by lack of "Mobile"
  let device = "desktop";
  const isIPad = ua.includes("iPad");
  const isAndroid = ua.includes("Android");
  const isMobileToken = ua.includes("Mobile");
  const isIPhone = ua.includes("iPhone") || ua.includes("iPod");
  if (isIPad) {
    device = "tablet";
  } else if (isAndroid) {
    // Android phones contain "Mobile", tablets do not
    device = isMobileToken ? "mobile" : "tablet";
  } else if (isIPhone || isMobileToken) {
    device = "mobile";
  } else {
    device = "desktop";
  }

  return { device, browser, os };
};

const isPrivateOrLocalIp = (ip) => {
  if (!ip || ip === "unknown") return true;
  const v4 = String(ip).trim();
  if (v4 === "127.0.0.1" || v4 === "::1" || v4 === "localhost") return true;
  if (v4.startsWith("::ffff:")) return isPrivateOrLocalIp(v4.slice(7));
  if (v4.startsWith("192.168.")) return true;
  if (v4.startsWith("10.")) return true;
  if (v4.startsWith("169.254.")) return true; // link-local
  if (v4.startsWith("fc") || v4.startsWith("fd") || v4.startsWith("fe80:"))
    return true; // unique local / link-local v6
  // 172.16.0.0/12 => 172.16.0.0 - 172.31.255.255
  if (v4.startsWith("172.")) {
    const second = parseInt(v4.split(".")[1] || "0", 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
};

const extractLocationFromIp = async (ip) => {
  if (isPrivateOrLocalIp(ip)) {
    return {
      country: "Local Network",
      countryCode: "LAN",
      city: "Localhost",
      region: "Local",
    };
  }
  // Skip lookup for unknown/invalid IPs
  if (
    !ip ||
    ip === "unknown" ||
    (ip.includes(":") && ip.split(":").length > 7)
  ) {
    return { country: null, countryCode: null, city: null, region: null };
  }
  try {
    // Timeout after 3 seconds — if ip-api.com is slow or down, don't block
    // session creation indefinitely. Use HTTPS and handle rate-limit (429).
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(
      `https://ip-api.com/json/${encodeURIComponent(ip)}?fields=country,countryCode,city,region,status,message`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      },
    );
    clearTimeout(timeoutId);
    if (response.ok) {
      const data = await response.json();
      // ip-api returns {status:"fail", message:"private range"} for private IPs
      // and {status:"fail", message:"rate limited"} on 429
      if (data.status === "fail") {
        if (data.message && data.message.toLowerCase().includes("private")) {
          return {
            country: "Local Network",
            countryCode: "LAN",
            city: "Localhost",
            region: "Local",
          };
        }
        logger.info(
          `[SessionCapture] Geo lookup fail for ${ip}: ${data.message}`,
        );
        return { country: null, countryCode: null, city: null, region: null };
      }
      return {
        country: data.country || null,
        countryCode: data.countryCode || null,
        city: data.city || null,
        region: data.region || null,
      };
    }
    if (response.status === 429) {
      logger.warn("[SessionCapture] Geo lookup rate-limited (429)");
    }
  } catch (error) {
    // AbortError is expected on timeout
    if (error.name !== "AbortError") {
      logger.info("[SessionCapture] Location lookup failed:", error.message);
    }
  }
  return { country: null, countryCode: null, city: null, region: null };
};

export const captureSession = async (req, userId, sessionType = "web") => {
  const ipAddress = getClientIp(req);
  const userAgent = req.headers?.["user-agent"] || "";
  const { device, browser, os } = parseUserAgent(userAgent);
  const location = await extractLocationFromIp(ipAddress);

  // Per-app fingerprint: student-web vs admin-web via X-Client-App.
  // Warn if header missing in web flow (fallback to sessionType) to surface client misconfig.
  const rawClientTag = String(req.headers?.["x-client-app"] || "")
    .trim()
    .toLowerCase()
    .slice(0, 50);
  const clientTag =
    rawClientTag ||
    String(sessionType || "web")
      .toLowerCase()
      .slice(0, 50);
  if (!rawClientTag && String(sessionType).toLowerCase() === "web") {
    logger.warn(
      `[SessionCapture] Missing X-Client-App for user ${userId}, using fallback "${clientTag}"`,
    );
  }

  // Use a transaction + row-level lock to prevent TOCTOU race where two concurrent
  // requests both miss the existing row and INSERT duplicates.
  // Lock the users row (not user_sessions) so new users with 0 sessions are also serialized.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Try to lock the user row; if users.id is integer, cast string param.
    // Fallback to advisory lock if user row missing (should not happen).
    try {
      await client.query(`SELECT 1 FROM users WHERE id = $1::int FOR UPDATE`, [
        parseInt(String(userId), 10) || 0,
      ]);
    } catch {
      await client.query(
        `SELECT 1 FROM user_sessions WHERE user_id = $1 FOR UPDATE`,
        [String(userId)],
      );
    }

    // Reuse fingerprint EXCLUDES ip_address: IP changes (WiFi→mobile) should NOT create a new
    // device row, otherwise free users (limit 1) would be evicted on every network switch.
    // Fingerprint is (user_id, device_type, browser, os, session_type).
    const existingSessionRow = await client.query(
      `SELECT session_id
       FROM user_sessions
       WHERE user_id = $1
         AND is_active = true
         AND lower(COALESCE(device_type, '')) = lower($2)
         AND lower(COALESCE(browser, '')) = lower($3)
         AND lower(COALESCE(os, '')) = lower($4)
         AND lower(COALESCE(session_type, '')) = lower($5)
       ORDER BY last_active DESC, created_at DESC
       LIMIT 1`,
      [String(userId), device, browser, os, clientTag],
    );

    if (existingSessionRow.rows?.length) {
      const existingSessionId = existingSessionRow.rows[0].session_id;
      logger.info(
        `[SessionCapture] Reusing active session for user ${userId}: ${existingSessionId}`,
      );
      try {
        await client.query(
          `UPDATE user_sessions
             SET last_active = NOW(),
                 ip_address = $2,
                 user_agent = $3,
                 country = COALESCE($4, country),
                 city = COALESCE($5, city),
                 region = COALESCE($6, region)
           WHERE session_id = $1`,
          [
            existingSessionId,
            ipAddress,
            userAgent,
            location.country,
            location.city,
            location.region,
          ],
        );
      } catch (updateErr) {
        logger.error(
          "[SessionCapture] Failed to update reused session activity:",
          updateErr.message,
        );
      }
      await client.query("COMMIT");

      // Emit WebSocket event outside transaction (best-effort, never blocks return)
      try {
        const io = getIO();
        const userResult = await pool.query(
          "SELECT name, email, role FROM users WHERE id = $1",
          [userId],
        );
        const user = userResult.rows[0] || {};
        const payload = {
          sessionId: existingSessionId,
          session_id: existingSessionId,
          userId: userId,
          user_id: userId,
          userName: user.name,
          user_name: user.name,
          userEmail: user.email,
          user_email: user.email,
          user_role: user.role,
          ip_address: ipAddress,
          device_type: device,
          browser,
          os,
          country: location.country,
          city: location.city,
          session_type: clientTag,
          is_active: true,
          last_active: new Date().toISOString(),
        };
        io.to("admin:sessions").emit("session:updated", payload);
        io.to(`user:${userId}`).emit("session:updated", {
          session_id: existingSessionId,
          device_type: device,
          browser,
          os,
          location: location,
          session_type: clientTag,
          last_active: new Date().toISOString(),
        });
      } catch (error) {
        logger.error(
          "[WebSocket] Failed to emit session:updated:",
          error.message,
        );
      }
      return existingSessionId;
    }

    const sessionId = randomUUID();

    const sessionData = {
      user_id: String(userId),
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
      session_type: clientTag,
      is_active: true,
      created_at: new Date(),
      last_active: new Date(),
    };

    const rowId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
    // INSERT is inside the same transaction that holds the FOR UPDATE lock,
    // so concurrent inserts on the same fingerprint are serialized.
    // Also handle unique violation from ux_user_sessions_active_fingerprint race.
    let result;
    try {
      result = await client.query(
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
          sessionData.last_active,
        ],
      );
    } catch (insertErr) {
      // 23505 = unique_violation (active fingerprint collision)
      if (insertErr.code === "23505") {
        await client.query("ROLLBACK");
        logger.warn(
          `[SessionCapture] Unique fingerprint collision for user ${userId}, reusing existing`,
        );
        // Re-fetch the winner
        const winner = await pool.query(
          `SELECT session_id FROM user_sessions
            WHERE user_id = $1 AND is_active = true
              AND lower(COALESCE(device_type,'')) = lower($2)
              AND lower(COALESCE(browser,'')) = lower($3)
              AND lower(COALESCE(os,'')) = lower($4)
              AND lower(COALESCE(session_type,'')) = lower($5)
            ORDER BY last_active DESC LIMIT 1`,
          [String(userId), device, browser, os, clientTag],
        );
        if (winner.rows.length) return winner.rows[0].session_id;
      }
      throw insertErr;
    }
    await client.query("COMMIT");
    const sessionDbId = result.rows[0].id;

    logger.info(
      `[SessionCapture] Session created for user ${userId}: ${sessionId}`,
    );

    try {
      const io = getIO();
      const userResult = await pool.query(
        "SELECT name, email, role FROM users WHERE id = $1",
        [String(userId)],
      );
      const user = userResult.rows[0] || {};
      const payload = {
        id: sessionDbId,
        session_id: sessionId,
        user_id: String(userId),
        user_name: user.name,
        user_email: user.email,
        user_role: user.role,
        ip_address: ipAddress,
        device_type: device,
        browser,
        os,
        country: location.country,
        city: location.city,
        session_type: clientTag,
        is_active: true,
        created_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
      };
      io.to("admin:sessions").emit("session:created", payload);
      io.to(`user:${String(userId)}`).emit("session:created", {
        session_id: sessionId,
        device_type: device,
        browser,
        os,
        location: location,
        session_type: clientTag,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        "[WebSocket] Failed to emit session:created:",
        error.message,
      );
    }

    return sessionId;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // intentionally empty - rollback failure is non-critical during error handling
    }
    logger.error("[SessionCapture] Failed to capture session:", error.message);
    return null;
  } finally {
    client.release();
  }
};

export const updateSessionActivity = async (sessionId) => {
  try {
    if (!sessionId) return;
    await pool.query(
      "UPDATE user_sessions SET last_active = $1 WHERE session_id = $2",
      [new Date(), sessionId],
    );
    // Notify admins that an existing session's last activity changed
    try {
      const sessionResult = await pool.query(
        "SELECT user_id FROM user_sessions WHERE session_id = $1",
        [sessionId],
      );
      const sessionRow = sessionResult.rows[0];
      if (sessionRow) {
        const io = getIO();
        const payload = {
          sessionId,
          session_id: sessionId,
          userId: sessionRow.user_id,
          user_id: sessionRow.user_id,
          is_active: true,
          last_active: new Date().toISOString(),
        };
        io.to("admin:sessions").emit("session:updated", payload);
      }
    } catch (emitErr) {
      logger.error(
        "[WebSocket] Failed to emit session:updated:",
        emitErr.message,
      );
    }
  } catch (error) {
    logger.error(
      "[SessionCapture] Failed to update session activity:",
      error.message,
    );
  }
};

export const invalidateSession = async (sessionId, revokedBy = null) => {
  try {
    if (!sessionId) return;

    // Get session details before invalidation for WebSocket notification
    const sessionResult = await pool.query(
      "SELECT user_id FROM user_sessions WHERE session_id = $1",
      [sessionId],
    );
    const session = sessionResult.rows[0];

    await pool.query(
      "UPDATE user_sessions SET is_active = false WHERE session_id = $1",
      [sessionId],
    );

    // Invalidate Redis session cache immediately to close the 5-minute TTL window
    try {
      const redis = getRedisClient();
      if (redis && redis.status === "ready") {
        await redis.del(`session:${sessionId}`);
      }
    } catch (e) {
      // Redis invalidation is best-effort
    }

    logger.info(`[SessionCapture] Session invalidated: ${sessionId}`);

    // Emit WebSocket event
    if (session) {
      try {
        const io = getIO();
        const payload = {
          sessionId,
          userId: session.user_id,
          revokedBy: revokedBy,
          revokedAt: new Date().toISOString(),
        };
        // Notify user that their session was revoked
        io.to(`user:${session.user_id}`).emit("session:revoked", payload);
        // Notify admins monitoring sessions
        io.to("admin:sessions").emit("session:revoked", payload);
      } catch (error) {
        logger.error(
          "[WebSocket] Failed to emit session:revoked:",
          error.message,
        );
      }
    }
  } catch (error) {
    logger.error(
      "[SessionCapture] Failed to invalidate session:",
      error.message,
    );
  }
};

// ===== Per-device refresh token hashing =====
// Each device's session stores a SHA-256 hash of its current refresh token so
// that refresh tokens can be validated and revoked per-device, and stale/stolen
// tokens are rejected. A short grace window (prev hash) tolerates multi-tab
// races where two tabs refresh near-simultaneously.

// 10 minutes: browser tabs fire refreshes out of order (background-tab
// throttling), and a tab presenting the previous token after the grace window
// was treated as theft ("replay-detected"), revoking the whole session and
// forcing re-login. 10 min comfortably covers multi-tab rotation races while
// keeping genuine replay detection for anything older.
const REFRESH_ROTATION_GRACE_MS = 600_000;

export const hashRefreshToken = (token) =>
  createHash("sha256").update(String(token)).digest("hex");

const hashesEqual = (a, b) => {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
};

// Fetch the fields needed to validate a refresh token for a given session.
export const getSessionForRefresh = async (sessionId) => {
  if (!sessionId) return null;
  const result = await pool.query(
    `SELECT is_active, refresh_token_hash, prev_refresh_token_hash, rotated_at, user_id,
            created_at, last_active, last_activity, expires_at
       FROM user_sessions WHERE session_id = $1`,
    [String(sessionId)],
  );
  return result.rows[0] || null;
};

// Verify a presented refresh token against the stored hash for its session.
// Returns { ok, reason }. When the session has no stored hash (legacy session
// created before this feature), we accept it so existing logins keep working.
export const verifyRefreshTokenForSession = (session, presentedToken) => {
  if (!session) return { ok: true, reason: "no-session-row" };
  if (session.is_active === false) return { ok: false, reason: "revoked" };
  if (!session.refresh_token_hash)
    return { ok: true, reason: "legacy-no-hash" };

  const presentedHash = hashRefreshToken(presentedToken);
  if (hashesEqual(presentedHash, session.refresh_token_hash)) {
    return { ok: true, reason: "match-current" };
  }

  const withinGrace =
    session.rotated_at &&
    Date.now() - new Date(session.rotated_at).getTime() <
      REFRESH_ROTATION_GRACE_MS;
  if (
    withinGrace &&
    hashesEqual(presentedHash, session.prev_refresh_token_hash)
  ) {
    return { ok: true, reason: "match-prev-grace" };
  }

  // REPLAY ALARM: a presented token matches the PREVIOUS refresh hash but is
  // OUTSIDE the rotation grace window. The current token was already rotated
  // away, so this copy is being replayed — a strong signal of token theft
  // (a stolen copy reused after the legitimate client rotated it). This is
  // treated as a distinct, security-relevant failure so the caller can
  // revoke the session, alert the user, and record the event.
  if (
    session.prev_refresh_token_hash &&
    hashesEqual(presentedHash, session.prev_refresh_token_hash)
  ) {
    return { ok: false, reason: "replay-detected" };
  }

  return { ok: false, reason: "stale-or-stolen" };
};

// Store the initial refresh token hash for a freshly created session (login).
export const setSessionRefreshHash = async (sessionId, token) => {
  if (!sessionId || !token) return;
  try {
    await pool.query(
      `UPDATE user_sessions SET refresh_token_hash = $1, rotated_at = NOW() WHERE session_id = $2`,
      [hashRefreshToken(token), String(sessionId)],
    );
  } catch (error) {
    logger.error("[SessionCapture] Failed to set refresh hash:", error.message);
  }
};

// Rotate the stored hash on refresh: current → prev, new → current.
export const rotateSessionRefreshHash = async (sessionId, newToken) => {
  if (!sessionId || !newToken) return;
  await pool.query(
    `UPDATE user_sessions
        SET prev_refresh_token_hash = refresh_token_hash,
            refresh_token_hash = $1,
            rotated_at = NOW(),
            last_active = NOW()
      WHERE session_id = $2`,
    [hashRefreshToken(newToken), String(sessionId)],
  );
};

export const getUserSessions = async (userId) => {
  try {
    const result = await pool.query(
      `SELECT id, session_id, ip_address, device_type, browser, os,
              country, country_code, city, session_type, is_active, created_at, last_active
       FROM user_sessions 
       WHERE user_id = $1 AND is_active = true
       ORDER BY last_active DESC`,
      [String(userId)],
    );
    return result.rows;
  } catch (error) {
    logger.error("[SessionCapture] Failed to get sessions:", error.message);
    return [];
  }
};

export default {
  captureSession,
  updateSessionActivity,
  invalidateSession,
  getUserSessions,
  hashRefreshToken,
  getSessionForRefresh,
  verifyRefreshTokenForSession,
  setSessionRefreshHash,
  rotateSessionRefreshHash,
};
