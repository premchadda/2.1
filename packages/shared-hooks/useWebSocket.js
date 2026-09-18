import { useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";

const getSocketUrl = () => {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_SOCKET_URL)
      return import.meta.env.VITE_SOCKET_URL;
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_BACKEND_URL)
      return import.meta.env.VITE_BACKEND_URL;
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL)
      return import.meta.env.VITE_API_URL;
  } catch {
    // import.meta not available in Node/SSR
  }
  if (typeof process !== "undefined" && process.env?.REACT_APP_SOCKET_URL)
    return process.env.REACT_APP_SOCKET_URL;
  if (typeof process !== "undefined" && process.env?.VITE_SOCKET_URL)
    return process.env.VITE_SOCKET_URL;
  if (typeof process !== "undefined" && process.env?.VITE_API_URL)
    return process.env.VITE_API_URL;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  // Env-only resolution: no hardcoded host/port here. Empty string signals
  // "unconfigured" — the hook surfaces a CONFIG_ERROR-style console error and
  // skips connecting (callers may still pass options.url / options.socketUrl).
  return "";
};

const SOCKET_URL = getSocketUrl();
// NOTE: SOCKET_URL is resolved ONCE at module load (frozen). For tests or
// multi-backend setups, pass a per-hook override via options.url /
// options.socketUrl — the hook resolves the effective URL lazily at effect
// time and recreates the shared socket if the URL changes.

// Shared socket — prevents React StrictMode duplicate connections
let sharedSocket = null;
let sharedSocketUrl = null;
let consumerCount = 0;

/**
 * DEPRECATION NOTICE (canonical hook, no behavior change):
 * Prefer the app-level socket stack (shared lib websocket client + realtime
 * hooks) for new code — it owns connection lifecycle, room subscriptions, and
 * cache invalidation. This shared hook is kept working as the canonical
 * fallback for lightweight emit/on use cases; do not extend it with new
 * features. No behavior was changed by this notice.
 *
 * WebSocket hook — httpOnly cookie auth via `withCredentials`.
 *
 * SECURITY MIGRATION (httpOnly):
 * Previously this hook read `trstprep_auth_token` from browser storage and
 * injected it as `auth: { token }` on every socket handshake. That pattern
 * is vulnerable to XSS exfiltration. The migration removes ALL storage reads:
 * - No browser storage read here (token is never sourced from storage).
 * - Auth relies exclusively on the httpOnly `accessToken` cookie sent automatically
 *   via `withCredentials: true` and validated by the Socket.IO `protect` middleware.
 * - The optional `token` param is retained only for backwards compat / manual testing;
 *   production callers must omit it. If provided, it is sent as `auth.token` but
 *   never sourced from browser storage inside this module.
 *
 * Shared singleton + ref-count pattern is preserved to avoid duplicate connections
 * under React StrictMode.
 *
 * @param {Object|boolean} options - Either `{ enabled, token }` or a boolean `enabled`
 * @param {boolean} [options.enabled=true] - Whether to establish the connection
 * @param {string|null} [options.token=null] - Deprecated: explicit token (prefer cookie auth; omit in prod)
 * @param {string|null} [options.url=null] - Lazy socket URL override (preferred over frozen module-level SOCKET_URL)
 * @param {string|null} [options.socketUrl=null] - Alias of options.url
 */
export const useWebSocket = (options = {}) => {
  const {
    enabled = true,
    token = null,
    url = null,
    socketUrl = null,
  } = typeof options === "boolean" ? { enabled: options } : options || {};
  // Lazy override: per-hook URL wins, else the frozen module-level SOCKET_URL.
  const effectiveUrl = url || socketUrl || SOCKET_URL;

  const [isConnected, setIsConnected] = useState(() =>
    Boolean(sharedSocket?.connected),
  );

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return undefined;
    }

    if (!effectiveUrl) {
      // CONFIG_ERROR: no socket URL configured (no env + no window origin +
      // no per-hook override). Never fall back to a hardcoded localhost port —
      // surface explicitly and skip connecting.
      if (typeof console !== "undefined" && console.error) {
        console.error(
          "useWebSocket CONFIG_ERROR: socket URL is not configured. " +
            "Set VITE_SOCKET_URL (or VITE_BACKEND_URL / VITE_API_URL) or pass options.url.",
        );
      }
      setIsConnected(false);
      return undefined;
    }

    consumerCount += 1;

    if (!sharedSocket || sharedSocketUrl !== effectiveUrl) {
      if (sharedSocket && sharedSocketUrl !== effectiveUrl) {
        // URL override changed — drop the old singleton before reconnecting.
        try {
          sharedSocket.removeAllListeners();
          sharedSocket.disconnect();
        } catch {
          // ignore teardown failures
        }
        sharedSocket = null;
      }
      const socketOptions = {
        // httpOnly migration: rely on cookie, never read token from storage
        withCredentials: true,
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      };
      // Back-compat only: if caller explicitly passes token, forward it; otherwise rely on cookie.
      // Intentionally no storage read here (see JSDoc).
      if (token) {
        socketOptions.auth = { token };
      }
      sharedSocket = io(effectiveUrl, socketOptions);
      sharedSocketUrl = effectiveUrl;
    }

    const socket = sharedSocket;
    if (socket.connected) {
      setIsConnected(true);
    }

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleConnectError = (err) => {
      // Avoid leaking sensitive info; only log message
      if (typeof console !== "undefined" && console.error) {
        console.error("WebSocket Connect Error:", err?.message || "unknown");
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    return () => {
      consumerCount = Math.max(0, consumerCount - 1);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);

      if (consumerCount === 0 && sharedSocket === socket) {
        socket.removeAllListeners();
        socket.disconnect();
        sharedSocket = null;
        sharedSocketUrl = null;
      }
      setIsConnected(false);
    };
  }, [enabled, token, effectiveUrl]);

  const emit = useCallback((event, data) => {
    if (sharedSocket) {
      sharedSocket.emit(event, data);
    }
  }, []);

  const on = useCallback((event, callback) => {
    if (sharedSocket) {
      sharedSocket.on(event, callback);
      return () => {
        if (sharedSocket) {
          sharedSocket.off(event, callback);
        }
      };
    }
    return () => {};
  }, []);

  return {
    isConnected,
    emit,
    on,
    socket: sharedSocket,
    socketRef: { current: sharedSocket },
  };
};

export default useWebSocket;
