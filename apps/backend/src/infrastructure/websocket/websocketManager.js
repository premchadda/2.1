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
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

      socket.join(roomName);

      // Emit participant count update
      const participantCount =
        io.sockets.adapter.rooms.get(roomName)?.size || 0;
      io.to(roomName).emit("live-test:participant_count", {
        testId,
        count: participantCount,
        isLive: true,
      });

      acknowledge?.({ success: true, room: roomName, participantCount });
    });

    // Leave live test room
    socket.on("live-tests:leave", (data = {}, acknowledge) => {
      const { testId } = data;
      const roomName = normalizeTestRoom(testId);
      if (!roomName) {
        return acknowledge?.({
          success: false,
          message: "Valid testId is required",
        });
      }

      socket.leave(roomName);

      // Emit participant count update
      const participantCount =
        io.sockets.adapter.rooms.get(roomName)?.size || 0;
      io.to(roomName).emit("live-test:participant_count", {
        testId,
        count: participantCount,
        isLive: participantCount > 0,
      });

      acknowledge?.({ success: true, room: roomName, participantCount });
    });

    // Subscribe to notifications - requires authentication
    socket.on("notifications:subscribe", (acknowledge) => {
      if (!socket.isAuthenticated) {
        return acknowledge?.({
          success: false,
          message: "Authentication required",
        });
      }

      socket.join("notifications");
      acknowledge?.({ success: true });
    });

    socket.on("notifications:unsubscribe", (acknowledge) => {
      socket.leave("notifications");
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

const setupEventBusListeners = () => {
  if (!io) return;

  // Test result ready - notify specific user
  eventBus.on("test:result_ready", (data) => {
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
  });

  // Leaderboard updated - notify test room
  eventBus.on("leaderboard:updated", (data) => {
    try {
      const leaderboardData = data?.payload || data;
      const testId = leaderboardData?.testId;

      if (!testId) {
        logger.warn("[WebSocket] leaderboard:updated event missing testId");
        return;
      }

      io.to(`test:${testId}`).emit("leaderboard:updated", {
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
  });

  // New notification - send to user
  eventBus.on("notification:new", (data) => {
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
  });

  // Series updated - broadcast to all
  eventBus.on("series:updated", (data) => {
    try {
      io.emit("series:updated", {
        ...(data?.payload || data),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("[WebSocket] Error handling series:updated:", error.message);
    }
  });

  // Test submitted - update leaderboard for live tests
  eventBus.on("test_submitted", (data) => {
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
        io.to(`test:${testId}`).emit("leaderboard:updated", {
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

      io.to(`test:${testId}`).emit("live-test:attempt_submitted", {
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
  });

  logger.info("[WebSocket] Event bus listeners configured");
};

/**
 * Get the Socket.IO instance
 * Returns a no-op emitter if not initialized (for testing)
 */
export const getIO = () => {
  if (!io) {
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
 * Broadcast to room with error handling
 */
export const broadcastToRoom = (room, event, data) => {
  try {
    const ioInstance = getIO();
    ioInstance.to(room).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(
      `[WebSocket] Error broadcasting to room ${room}:`,
      error.message,
    );
  }
};

/**
 * Notify user with error handling
 */
export const notifyUser = (userId, event, data) => {
  try {
    if (!userId) {
      logger.warn("[WebSocket] notifyUser called without userId");
      return;
    }
    const ioInstance = getIO();
    ioInstance.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`[WebSocket] Error notifying user ${userId}:`, error.message);
  }
};
