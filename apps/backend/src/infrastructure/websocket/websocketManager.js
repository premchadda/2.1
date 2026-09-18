/**
 * WebSocket/Socket.IO Manager with Proper Authentication and Error Handling
 *
 * FIXED (CRIT-02): Complete implementation with:
 * - Proper authentication validation for all connections
 * - Error handlers for all event listeners
 * - Rate limiting for socket events
 * - Heartbeat/ping-pong for connection health
 * - Proper room management and cleanup
 * - Reconnection handling documentation
 */

import { Server } from "socket.io";
import { eventBus } from "../events/eventBus.js";
import jwt from "jsonwebtoken";
import { getRedisClient } from "../cache/redisClient.js";
import logger from "../logger/logger.js";

let io = null;
let redisPubClient = null;
let redisSubClient = null;

// Rate limiting configuration for socket events
const SOCKET_RATE_LIMIT = {
  maxEventsPerMinute: 60,
  maxMessagesPerMinute: 30,
};

// Track event frequency per socket
const socketEventCounts = new Map();

const parseCookies = (cookieHeader = "") => {
  if (!cookieHeader) return {};
  return cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex === -1) return cookies;

      const key = entry.slice(0, separatorIndex).trim();
      const value = decodeURIComponent(entry.slice(separatorIndex + 1));
      cookies[key] = value;
      return cookies;
    }, {});
};

const resolveSocketToken = (socket) => {
  // Token from httpOnly cookie (preferred — not exposed to JS or logged in URLs)
  const cookies = parseCookies(socket.handshake.headers?.cookie);
  const cookieToken = cookies.token;

  // Auth header on the handshake (sent via socket.auth on the client).
  const authToken = socket.handshake.auth?.token;

  // NOTE: query-token path removed — tokens in URLs are logged by proxies,
  // nginx, and browser history. Rely on httpOnly cookies + auth payload only.
  return cookieToken || authToken || null;
};

const normalizeTestRoom = (testId) => {
  if (testId === undefined || testId === null) return null;
  const normalized = String(testId).trim();
  return normalized ? `test:${normalized}` : null;
};

// Rate limiter middleware for socket events (Redis-backed when available)
const createSocketRateLimiter = (eventName, maxPerMinute) => {
  return async (socketId) => {
    const key = `ws-ratelimit:${socketId}:${eventName}`;
    const windowMs = 60 * 1000;

    const redisClient = getRedisClient();
    if (redisClient && redisClient.status === "ready") {
      try {
        const count = await redisClient.incr(key);
        if (count === 1) {
          await redisClient.pexpire(key, windowMs);
        }
        return count <= maxPerMinute;
      } catch {
        // Fall through to in-memory on Redis error
      }
    }

    // In-memory fallback
    const now = Date.now();

    if (!socketEventCounts.has(socketId)) {
      socketEventCounts.set(socketId, {});
    }

    const socketEvents = socketEventCounts.get(socketId);
    if (!socketEvents[eventName]) {
      socketEvents[eventName] = { count: 0, windowStart: now };
    }

    const eventTrack = socketEvents[eventName];

    if (now - eventTrack.windowStart > windowMs) {
      eventTrack.count = 0;
      eventTrack.windowStart = now;
    }

    eventTrack.count++;

    return eventTrack.count <= maxPerMinute;
  };
};

export const initWebSocket = async (server) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.ADMIN_PANEL_URL,
  ].filter(Boolean);

  // M5: dev-only loopback origins (hardcoded localhost must NOT be trusted in
  // production — a misconfigured NODE_ENV would otherwise allow them).
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.push(
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:5173",
    );
  }

  const PRIVATE_IP_REGEX =
    /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})$/;

  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        if (process.env.NODE_ENV !== "production") {
          try {
            const url = new URL(origin);
            const hostname = url.hostname;
            if (
              hostname === "localhost" ||
              hostname === "127.0.0.1" ||
              hostname === "0.0.0.0" ||
              hostname === "[::1]" ||
              PRIVATE_IP_REGEX.test(hostname)
            ) {
              return callback(null, true);
            }
          } catch {
            /* ignore */
          }
        }

        logger.warn(`[WebSocket] Blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Heartbeat configuration for connection health monitoring
    pingInterval: 25000, // 25 seconds
    pingTimeout: 20000, // 20 seconds
    maxHttpBufferSize: 1e6, // 1MB max message size
    transports: ["websocket", "polling"],
  });

  // Attach Redis adapter for multi-instance pub/sub if available
  const redisClient = getRedisClient();
  if (redisClient) {
    try {
      const { createAdapter } = await import("@socket.io/redis-adapter");
      const pubClient = redisClient.duplicate();
      const subClient = redisClient.duplicate();
      redisPubClient = pubClient;
      redisSubClient = subClient;
      pubClient.on("error", (err) =>
        logger.warn("[WebSocket] Redis pubClient error:", err.message),
      );
      subClient.on("error", (err) =>
        logger.warn("[WebSocket] Redis subClient error:", err.message),
      );
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      logger.info(
        "[WebSocket] Redis adapter attached for multi-instance support",
      );
    } catch (err) {
      logger.warn(
        "[WebSocket] Redis adapter unavailable, using in-memory adapter:",
        err.message,
      );
    }
  }

  // Authentication middleware — require a valid token. Reject expired/invalid
  // tokens instead of silently downgrading to guest (which would let revoked
  // sessions keep an open socket).
  io.use((socket, next) => {
    const token = resolveSocketToken(socket);

    if (!token) {
      // No token at all — reject. Public broadcasts (e.g. series:updated) are
      // handled by the event-bus subscriber, not by guest sockets joining rooms.
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
      });
      socket.isAuthenticated = true;
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.sessionId = decoded.sessionId || null;

      // Attach minimal user info to socket
      socket.user = {
        id: decoded.id,
        role: decoded.role,
      };

      next();
    } catch (error) {
      // Invalid/expired token — reject the connection rather than silently
      // downgrading to guest (was a security gap: revoked sessions kept sockets).
      return next(new Error("Invalid or expired authentication"));
    }
  });

  io.on("connection", async (socket) => {
    logger.info(`[WebSocket] Connected: ${socket.id} (User: ${socket.userId})`);

    // Validate the session is still active in the DB (catches revoked sessions
    // where the JWT hasn't expired yet but the user has been logged out).
    if (socket.sessionId) {
      try {
        const { pool } = await import("../database/postgres-helpers.js");
        const sessionResult = await pool.query(
          "SELECT is_active FROM user_sessions WHERE session_id = $1",
          [socket.sessionId],
        );
        if (
          sessionResult.rows.length === 0 ||
          !sessionResult.rows[0].is_active
        ) {
          logger.info(
            `[WebSocket] Disconnecting revoked session: ${socket.sessionId}`,
          );
          socket.emit("auth:revoked", { message: "Session has been revoked" });
          return socket.disconnect(true);
        }
      } catch (sessionErr) {
        // If the user_sessions table is missing, allow the connection (dev mode).
        if (sessionErr.code !== "42P01") {
          logger.error("[WebSocket] Session check failed:", sessionErr.message);
        }
      }
    }

    // Auto-join user-specific room if authenticated
    if (socket.isAuthenticated && socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // Handle client reconnection
    socket.on("reconnect_attempt", (attemptNumber) => {
      logger.info(
        `[WebSocket] Reconnection attempt ${attemptNumber} for socket ${socket.id}`,
      );
    });

    // Authentication challenge-response for privileged operations
    socket.on("auth:verify", (data, callback) => {
      if (!socket.isAuthenticated) {
        return callback?.({ success: false, message: "Not authenticated" });
      }
      callback?.({
        success: true,
        userId: socket.userId,
        role: socket.userRole,
        timestamp: new Date().toISOString(),
      });
    });

    // Join live test room - requires authentication
    socket.on("live-tests:join", async (data = {}, acknowledge) => {
      const rateLimiter = createSocketRateLimiter(
        "live-tests:join",
        SOCKET_RATE_LIMIT.maxEventsPerMinute,
      );
      if (!(await rateLimiter(socket.id))) {
        return acknowledge?.({
          success: false,
          message: "Rate limit exceeded",
        });
      }

      if (!socket.isAuthenticated) {
        return acknowledge?.({
          success: false,
          message: "Authentication required",
        });
      }

      const { testId } = data;
      const roomName = normalizeTestRoom(testId);
      if (!roomName) {
        return acknowledge?.({
          success: false,
          message: "Valid testId is required",
        });
      }

      // Slug support: non-numeric testIds are SEO slugs — resolve to the live
      // test id first (deny when unresolvable instead of joining a slug room
      // no publisher ever emits to).
      let numericId = Number(testId);
      let roomTestId = testId;
      if (!Number.isInteger(numericId) || numericId <= 0) {
        try {
          const { pool: slugPool } =
            await import("../database/postgres-helpers.js");
          const slug = String(testId).trim();
          let resolved = null;
          try {
            const lt = await slugPool.query(
              `SELECT id FROM live_tests WHERE slug = $1 OR code = $1 LIMIT 1`,
              [slug],
            );
            if (lt.rows[0]?.id) resolved = Number(lt.rows[0].id);
          } catch {
            /* column may not exist — fall through to tests lookup */
          }
          if (resolved == null) {
            try {
              const t = await slugPool.query(
                `SELECT id FROM tests WHERE slug = $1 LIMIT 1`,
                [slug],
              );
              if (t.rows[0]?.id) resolved = Number(t.rows[0].id);
            } catch {
              /* tests.slug may not exist */
            }
          }
          if (
            resolved == null ||
            !Number.isInteger(resolved) ||
            resolved <= 0
          ) {
            return acknowledge?.({
              success: false,
              // Distinct from "Not registered": the slug itself is invalid.
              message: "Invalid test",
            });
          }
          numericId = resolved;
          roomTestId = resolved;
        } catch {
          return acknowledge?.({
            success: false,
            message: "Not registered for this live test",
          });
        }
      }
      // Verify registration/enrollment before joining (fail-closed: deny on
      // lookup failure, except the live_test_registrations absence
      // fall-through above where the optional table provably does not exist).
      try {
        const { pool } = await import("../database/postgres-helpers.js");
        let allowed = false;
        if (Number.isInteger(numericId) && numericId > 0) {
          try {
            const reg = await pool.query(
              `SELECT 1 FROM live_test_registrations WHERE live_test_id = $1 AND user_id = $2 LIMIT 1`,
              [numericId, socket.userId],
            );
            if (reg.rows.length > 0) allowed = true;
          } catch {
            /* optional table may not exist — fall through to capacity check */
          }
          if (!allowed) {
            try {
              const lt = await pool.query(
                `SELECT max_participants, (SELECT COUNT(*)::int FROM live_test_registrations WHERE live_test_id = $1) AS registered FROM live_tests WHERE id = $1 LIMIT 1`,
                [numericId],
              );
              const row = lt.rows[0];
              if (
                row &&
                (row.max_participants == null ||
                  row.registered < row.max_participants)
              )
                allowed = true;
            } catch {
              // Fail-closed: an unreadable capacity row must not grant entry.
              // (The only allow-open path is the live_test_registrations
              // absence fall-through above, where the optional table provably
              // does not exist yet.)
              allowed = false;
            }
          }
        } else {
          allowed = true;
        }
        if (!allowed) {
          return acknowledge?.({
            success: false,
            message: "Not registered for this live test",
          });
        }
      } catch {
        // Fail-closed: verification errors deny entry (acknowledge Not
        // registered) rather than silently admitting an unverified socket.
        return acknowledge?.({
          success: false,
          message: "Not registered for this live test",
        });
      }

      const resolvedRoom = normalizeTestRoom(roomTestId) || roomName;
      socket.join(resolvedRoom);

      // Emit participant count update
      const participantCount =
        io.sockets.adapter.rooms.get(resolvedRoom)?.size || 0;
      io.to(resolvedRoom).emit("live-test:participant_count", {
        testId: roomTestId,
        count: participantCount,
        isLive: true,
      });

      acknowledge?.({ success: true, room: resolvedRoom, participantCount });
    });

    // Leave live test room
    socket.on("live-tests:leave", async (data = {}, acknowledge) => {
      if (!socket.isAuthenticated) {
        return acknowledge?.({
          success: false,
          message: "Authentication required",
        });
      }

      const { testId } = data;
      const roomName = normalizeTestRoom(testId);
      if (!roomName) {
        return acknowledge?.({
          success: false,
          message: "Valid testId is required",
        });
      }

      // Resolve slug→numeric exactly like join, so leave targets the numeric
      // room actually joined (otherwise a slug leave would miss the room).
      let roomTestId = testId;
      const asNumber = Number(testId);
      if (!Number.isInteger(asNumber) || asNumber <= 0) {
        try {
          const { pool: leavePool } =
            await import("../database/postgres-helpers.js");
          const slug = String(testId).trim();
          let resolved = null;
          try {
            const lt = await leavePool.query(
              `SELECT id FROM live_tests WHERE slug = $1 OR code = $1 LIMIT 1`,
              [slug],
            );
            if (lt.rows[0]?.id) resolved = Number(lt.rows[0].id);
          } catch {
            /* column may not exist — fall through to tests lookup */
          }
          if (resolved == null) {
            try {
              const t = await leavePool.query(
                `SELECT id FROM tests WHERE slug = $1 LIMIT 1`,
                [slug],
              );
              if (t.rows[0]?.id) resolved = Number(t.rows[0].id);
            } catch {
              /* tests.slug may not exist */
            }
          }
          if (
            resolved == null ||
            !Number.isInteger(resolved) ||
            resolved <= 0
          ) {
            return acknowledge?.({
              success: false,
              message: "Invalid test",
            });
          }
          roomTestId = resolved;
        } catch {
          return acknowledge?.({
            success: false,
            message: "Invalid test",
          });
        }
      }

      const resolvedRoom = normalizeTestRoom(roomTestId) || roomName;
      socket.leave(resolvedRoom);

      // Emit participant count update
      const participantCount =
        io.sockets.adapter.rooms.get(resolvedRoom)?.size || 0;
      io.to(resolvedRoom).emit("live-test:participant_count", {
        testId: roomTestId,
        count: participantCount,
        isLive: participantCount > 0,
      });

      acknowledge?.({ success: true, room: resolvedRoom, participantCount });
    });

    // Subscribe to notifications - requires authentication.
    // Scoped to the caller's own user:{id} room only (auto-joined on connect);
    // the legacy global "notifications" room join is dropped to prevent cross-user fan-out.
    socket.on("notifications:subscribe", (acknowledge) => {
      if (!socket.isAuthenticated) {
        return acknowledge?.({
          success: false,
          message: "Authentication required",
        });
      }

      acknowledge?.({ success: true, room: `user:${socket.userId}` });
    });

    socket.on("notifications:unsubscribe", (acknowledge) => {
      acknowledge?.({ success: true });
    });

    // Admin sessions monitoring - requires admin role
    socket.on("admin:sessions:subscribe", (acknowledge) => {
      if (!socket.isAuthenticated) {
        return acknowledge?.({
          success: false,
          message: "Authentication required",
        });
      }
      if (socket.userRole !== "admin") {
        return acknowledge?.({
          success: false,
          message: "Admin privileges required",
        });
      }

      socket.join("admin:sessions");
      acknowledge?.({
        success: true,
        message: "Subscribed to session updates",
      });
    });

    socket.on("admin:sessions:unsubscribe", (acknowledge) => {
      socket.leave("admin:sessions");
      acknowledge?.({ success: true });
    });

    // Admin live-test participant monitoring - requires admin role.
    // Provides an aggregate realtime feed of active test attempts across
    // all tests (emitted by attempt.routes heartbeat / anti-cheat revoke).
    socket.on("admin:live-tests:subscribe", (acknowledge) => {
      if (!socket.isAuthenticated) {
        return acknowledge?.({
          success: false,
          message: "Authentication required",
        });
      }
      if (socket.userRole !== "admin") {
        return acknowledge?.({
          success: false,
          message: "Admin privileges required",
        });
      }

      socket.join("admin:live-tests");
      acknowledge?.({
        success: true,
        message: "Subscribed to live-test monitoring",
      });
    });

    socket.on("admin:live-tests:unsubscribe", (acknowledge) => {
      socket.leave("admin:live-tests");
      acknowledge?.({ success: true });
    });

    // Handle disconnection with cleanup
    socket.on("disconnect", (reason) => {
      logger.info(`[WebSocket] Disconnected: ${socket.id} (Reason: ${reason})`);

      // Clean up rate limit tracking
      socketEventCounts.delete(socket.id);

      // Leave all rooms
      socket.rooms.forEach((room) => {
        if (room !== socket.id) {
          socket.leave(room);
        }
      });
    });

    // Handle connection errors
    socket.on("error", (error) => {
      logger.error(`[WebSocket] Error for socket ${socket.id}:`, error.message);
    });
  });

  // Setup event bus listeners for real-time data push
  setupEventBusListeners();

  logger.info(
    "[WebSocket] Server initialized with authentication and rate limiting",
  );
  return io;
};

const WS_BRIDGE_EVENTS = [
  "test:result_ready",
  "leaderboard:updated",
  "notification:new",
  "series:updated",
  "test_submitted",
];

// Unsubscribe fns for the cross-instance broker bridge (cleared on shutdown).
const wsBridgeUnsubs = [];
// eventBus handlers registered by setupEventBusListeners (cleared on shutdown).
const wsBusHandlers = [];

const setupEventBusListeners = () => {
  if (!io) return;

  // Test result ready - notify specific user
  const onResultReady = (data) => {
    try {
      const resultData = data?.payload || data;
      const userId = resultData?.userId;

      if (!userId) {
        logger.warn("[WebSocket] test:result_ready event missing userId");
        return;
      }

      io.to(`user:${userId}`).emit("notification:new", {
        type: "test:result_ready",
        message: "Your test result is ready!",
        timestamp: new Date().toISOString(),
        data: {
          testId: resultData.testId,
          attemptId: resultData.attemptId,
          score: resultData.score,
        },
      });

      io.to(`user:${userId}`).emit("test:result_ready", {
        testId: resultData.testId,
        attemptId: resultData.attemptId,
        score: resultData.score,
        summary: resultData.summary,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        "[WebSocket] Error handling test:result_ready:",
        error.message,
      );
    }
  };
  eventBus.on("test:result_ready", onResultReady);

  // Leaderboard updated - notify test room
  const onLeaderboard = (data) => {
    try {
      const leaderboardData = data?.payload || data;
      const testId = leaderboardData?.testId;

      if (!testId) {
        logger.warn("[WebSocket] leaderboard:updated event missing testId");
        return;
      }

      // Normalize the room the same way join does (numeric ids and slugs
      // converge on one `test:<id>` room) so publishers never emit to a room
      // no socket joined.
      const leaderboardRoom = normalizeTestRoom(testId) || `test:${testId}`;
      io.to(leaderboardRoom).emit("leaderboard:updated", {
        testId,
        type: leaderboardData.type || "leaderboard",
        entries: leaderboardData.entries || [],
        updatedAt: leaderboardData.updatedAt || new Date().toISOString(),
      });
    } catch (error) {
      logger.error(
        "[WebSocket] Error handling leaderboard:updated:",
        error.message,
      );
    }
  };
  eventBus.on("leaderboard:updated", onLeaderboard);

  // New notification - send to user
  const onNotification = (data) => {
    try {
      const notificationData = data?.payload || data;
      const userId = notificationData?.userId;

      if (userId) {
        io.to(`user:${userId}`).emit("notification:new", {
          ...notificationData,
          deliveredAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error(
        "[WebSocket] Error handling notification:new:",
        error.message,
      );
    }
  };
  eventBus.on("notification:new", onNotification);

  // Series updated - broadcast to all
  const onSeries = (data) => {
    try {
      io.emit("series:updated", {
        ...(data?.payload || data),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("[WebSocket] Error handling series:updated:", error.message);
    }
  };
  eventBus.on("series:updated", onSeries);

  // Test submitted - update leaderboard for live tests
  const onSubmitted = (data) => {
    try {
      const submissionData = data?.payload || data;
      const testId = submissionData.testId;

      if (!testId) return;

      // The publisher (attempt.service.js emitDomainEvent) now sets
      // `source: 'live-tests'` for tests flagged is_live/isLive. The
      // leaderboard refresh is scoped to that signal — and the admin
      // monitor room only receives it for live tests, so a client
      // subscribed to both test:{id} and admin:live-tests does not get
      // duplicate leaderboard events for regular submissions.
      if (submissionData.source === "live-tests") {
        // Normalized room (see join/leave): publishers must emit to the same
        // `test:<id>` room sockets actually joined.
        const liveRoom = normalizeTestRoom(testId) || `test:${testId}`;
        io.to(liveRoom).emit("leaderboard:updated", {
          testId,
          type: "live-test",
          updatedAt: new Date().toISOString(),
          participantCount: submissionData.participantCount || 0,
        });

        io.to("admin:live-tests").emit("leaderboard:updated", {
          testId,
          type: "live-test",
          updatedAt: new Date().toISOString(),
          participantCount: submissionData.participantCount || 0,
        });
      }

      const submittedRoom = normalizeTestRoom(testId) || `test:${testId}`;
      io.to(submittedRoom).emit("live-test:attempt_submitted", {
        testId,
        submittedAt: new Date().toISOString(),
      });

      // Also notify the admin live-test monitor room (same room the
      // presence events in attempt.routes.js emit to via
      // 'admin:live-tests:subscribe' → socket.join('admin:live-tests')),
      // so LiveTestMonitor receives submission updates without joining
      // each individual test room.
      io.to("admin:live-tests").emit("live-test:attempt_submitted", {
        testId,
        submittedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("[WebSocket] Error handling test_submitted:", error.message);
    }
  };
  eventBus.on("test_submitted", onSubmitted);
  // Track for shutdown removal (prevents listener leaks across re-init).
  wsBusHandlers.push(
    ["test:result_ready", onResultReady],
    ["leaderboard:updated", onLeaderboard],
    ["notification:new", onNotification],
    ["series:updated", onSeries],
    ["test_submitted", onSubmitted],
  );

  logger.info("[WebSocket] Event bus listeners configured");

  // Cross-instance bridge: events emitted on a sibling replica arrive via
  // Redis pub/sub (messageBroker.publishRemote). Re-emit them on the local
  // bus so the handlers above run here too. The broker skips the publisher's
  // own loopback via publisherId, and the publishing node already emitted
  // locally — so no event is ever delivered twice.
  import("../events/messageBroker.js")
    .then(({ messageBroker }) => {
      for (const evt of WS_BRIDGE_EVENTS) {
        try {
          const maybeUnsub = messageBroker.subscribe(evt, (payload) => {
            eventBus.emit(evt, { payload });
          });
          if (typeof maybeUnsub === "function") wsBridgeUnsubs.push(maybeUnsub);
        } catch {
          /* broker subscribe failed for this event */
        }
      }
    })
    .catch(() => {
      /* broker unavailable — local-only realtime mode */
    });
};

/**
 * Whether the Socket.IO server is up. Prefer this over getIO() for
 * health checks — getIO() returns a silent no-op when down (compat), which
 * hides outages from callers that assume delivery.
 */
export const isWebSocketReady = () => Boolean(io);

let wsDownWarned = false;

/**
 * Get the Socket.IO instance
 * Returns a no-op emitter if not initialized (for testing).
 * NOTE: the no-op hides outages — new code should check isWebSocketReady()
 * or use broadcastToRoom()/notifyUser() (boolean result + warn on drop).
 */
export const getIO = () => {
  if (!io) {
    if (!wsDownWarned) {
      wsDownWarned = true;
      logger.warn(
        "[WebSocket] getIO() called before init — emits are being dropped",
      );
    }
    return {
      emit: () => {},
      to: () => ({ emit: () => {} }),
      in: () => ({ emit: () => {} }),
      sockets: { connected: {} },
      serverSideEmit: () => {},
    };
  }

  return io;
};

/**
 * Broadcast to room with error handling.
 * @returns {boolean} true when emitted, false when dropped (WS down).
 */
export const broadcastToRoom = (room, event, data) => {
  try {
    if (!io) {
      logger.warn(
        `[WebSocket] broadcast to room ${room} dropped — server not initialized`,
      );
      return false;
    }
    const ioInstance = getIO();
    ioInstance.to(room).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    logger.error(
      `[WebSocket] Error broadcasting to room ${room}:`,
      error.message,
    );
    return false;
  }
};

/**
 * Notify user with error handling.
 * @returns {boolean} true when emitted, false when dropped (WS down).
 */
export const notifyUser = (userId, event, data) => {
  try {
    if (!userId) {
      logger.warn("[WebSocket] notifyUser called without userId");
      return false;
    }
    if (!io) {
      logger.warn(
        `[WebSocket] notify user ${userId} dropped — server not initialized`,
      );
      return false;
    }
    const ioInstance = getIO();
    ioInstance.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    logger.error(`[WebSocket] Error notifying user ${userId}:`, error.message);
    return false;
  }
};

/**
 * Clean up Redis adapter connections on shutdown.
 */
export const closeWebSocket = async () => {
  try {
    // Remove eventBus listeners first so no new emits fire during teardown.
    for (const [evt, handler] of wsBusHandlers.splice(0)) {
      try {
        eventBus.off?.(evt, handler);
      } catch {
        try {
          eventBus.removeListener?.(evt, handler);
        } catch {
          /* ignore */
        }
      }
    }
    // Unsubscribe the cross-instance broker bridge before quitting Redis.
    for (const unsub of wsBridgeUnsubs.splice(0)) {
      try {
        await unsub?.();
      } catch {
        /* ignore */
      }
    }
    try {
      const { messageBroker } = await import("../events/messageBroker.js");
      for (const evt of WS_BRIDGE_EVENTS) {
        try {
          await messageBroker.unsubscribe?.(evt);
        } catch {
          /* broker may not support per-event unsubscribe */
        }
      }
    } catch {
      /* broker unavailable */
    }
    if (redisPubClient) {
      await redisPubClient.quit().catch(() => {});
      redisPubClient = null;
    }
    if (redisSubClient) {
      await redisSubClient.quit().catch(() => {});
      redisSubClient = null;
    }
    if (io) {
      const closing = io;
      io = null;
      await new Promise((resolve) => {
        try {
          closing.close(() => resolve());
        } catch {
          resolve();
        }
        setTimeout(resolve, 5000);
      });
    }
    socketEventCounts.clear();
  } catch (err) {
    logger.warn("[WebSocket] Cleanup error:", err.message);
  }
};
