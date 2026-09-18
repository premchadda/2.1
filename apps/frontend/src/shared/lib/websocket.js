import { io } from "socket.io-client";

let socket = null;

/**
 * Canonical socket-URL resolver (single source of truth).
 *
 * Precedence: VITE_SOCKET_URL → VITE_BACKEND_URL → VITE_API_URL →
 * page origin (production) / current host (dev) → localhost (last resort
 * for non-DOM runtimes only). Both `initWebSocket` (when no explicit URL is
 * passed) and `useWebSocket` resolve through here so the two can never drift.
 */
export const resolveSocketUrl = () => {
  const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
  if (env.VITE_SOCKET_URL) return env.VITE_SOCKET_URL;
  if (env.VITE_BACKEND_URL) return env.VITE_BACKEND_URL;
  // VITE_API_URL doubles as the socket host when no dedicated socket URL is
  // set (same origin serves both HTTP and WS in production).
  if (env.VITE_API_URL) return env.VITE_API_URL;
  if (typeof window !== "undefined") {
    // In production fall back to the page origin — never localhost, which
    // would point at the user's own machine on a deployed site.
    if (env.PROD) return window.location.origin;
    return `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ""}`;
  }
  // localhost is a DEV-only last resort (SSR/test with no window).
  return "http://localhost:5001";
};

/**
 * Initialize the WebSocket connection
 * @param {Object} options - Socket.io client options
 * @param {string} options.url - WebSocket server URL (defaults to same origin)
 * @param {string} options.token - JWT auth token
 * @param {Function} options.onConnect - Callback when connected
 * @param {Function} options.onDisconnect - Callback when disconnected
 */
export const initWebSocket = ({
  url,
  token,
  onConnect,
  onDisconnect,
  onReconnect,
  onReconnectError,
} = {}) => {
  if (socket?.connected) {
    return socket;
  }

  // If no URL is provided, resolve through the canonical resolver
  // (VITE_SOCKET_URL → VITE_BACKEND_URL → VITE_API_URL → origin).
  // (Deliberately no bare localhost default: in production that would point
  // at the user's own machine. Local dev passes an explicit URL or relies
  // on origin.)
  const wsUrl = url || resolveSocketUrl() || "";

  const socketOptions = {
    transports: ["polling", "websocket"],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    withCredentials: true,
    auth: {},
  };

  if (token) {
    socketOptions.auth.token = token;
  }

  try {
    socket = io(wsUrl, socketOptions);

    socket.on("connect", () => {
      onConnect?.(socket.id);
    });

    socket.on("disconnect", (reason) => {
      onDisconnect?.(reason);
    });

    socket.on("connect_error", (err) => {
      if (import.meta.env.DEV)
        console.warn("[WebSocket] Connection error:", err.message);
    });

    if (onReconnect) {
      socket.on("reconnect", (attemptNumber) => {
        onReconnect(attemptNumber);
      });
    }

    if (onReconnectError) {
      socket.on("reconnect_error", (err) => {
        if (import.meta.env.DEV)
          console.warn("[WebSocket] Reconnection error:", err.message);
        onReconnectError(err);
      });
    }

    // Setup default event listeners
    setupEventListeners();

    return socket;
  } catch (err) {
    if (import.meta.env.DEV)
      console.warn("[WebSocket] Failed to initialize:", err);
    return null;
  }
};

/**
 * Setup default event listeners for real-time notifications
 */
const setupEventListeners = () => {
  if (!socket) return;

  socket.on("test:result_ready", (data) => {
    dispatchCustomEvent("testResultReady", data);
  });

  socket.on("leaderboard:updated", (data) => {
    dispatchCustomEvent("leaderboardUpdated", data);
  });

  socket.on("notification:new", (data) => {
    dispatchCustomEvent("newNotification", data);
  });

  socket.on("live-test:attempt_submitted", (data) => {
    dispatchCustomEvent("liveTestAttemptSubmitted", data);
  });

  socket.on("live-test:participant_count", (data) => {
    dispatchCustomEvent("liveTestParticipantCount", data);
  });

  socket.on("series:updated", (data) => {
    dispatchCustomEvent("seriesUpdated", data);
  });
};

/**
 * Dispatch a custom event that components can listen to
 */
const dispatchCustomEvent = (eventName, data) => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(`trstprep:${eventName}`, { detail: data }),
    );
  }
};

/**
 * Get the current socket instance
 */
export const getSocket = () => socket;

/**
 * Disconnect the WebSocket
 */
export const disconnectWebSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Join a test room for live updates
 */
export const joinTestRoom = (testId) => {
  if (!socket?.connected) {
    if (import.meta.env.DEV)
      console.warn("[WebSocket] Cannot join room - not connected");
    return;
  }
  socket.emit("live-tests:join", { testId });
};

/**
 * Leave a test room
 */
export const leaveTestRoom = (testId) => {
  if (!socket?.connected) return;
  socket.emit("live-tests:leave", { testId });
};

/**
 * Subscribe to leaderboard updates for a specific test
 * @param {string} testId - Test ID to subscribe to
 * @param {Function} callback - Callback when leaderboard updates
 * @returns {Function|null} Unsubscribe function, or null when the socket is
 * not connected (caller must handle the null case — no subscription exists).
 */
export const subscribeToLeaderboard = (testId, callback) => {
  if (!socket?.connected) return null;

  const handler = (data) => {
    if (data.testId === testId) {
      callback(data);
    }
  };

  socket.on("leaderboard:updated", handler);
  joinTestRoom(testId);

  return () => {
    socket.off("leaderboard:updated", handler);
    leaveTestRoom(testId);
  };
};

/**
 * Subscribe to notification updates
 * @param {Function} callback - Callback when new notification arrives
 * @returns {Function|null} Unsubscribe function, or null when the socket is
 * not connected (caller must handle the null case — no subscription exists).
 */
export const subscribeToNotifications = (callback) => {
  if (!socket?.connected) return null;

  const handler = (data) => {
    callback(data);
  };

  socket.on("notification:new", handler);

  return () => {
    socket.off("notification:new", handler);
  };
};
