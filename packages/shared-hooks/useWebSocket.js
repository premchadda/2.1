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
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ""}`;
  }
  return "http://localhost:5001";
};

const SOCKET_URL = getSocketUrl();

// Shared socket — prevents React StrictMode duplicate connections
let sharedSocket = null;
let consumerCount = 0;

/**
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
 */
export const useWebSocket = (options = {}) => {
  const { enabled = true, token = null } =
    typeof options === "boolean" ? { enabled: options } : options || {};

  const [isConnected, setIsConnected] = useState(() =>
    Boolean(sharedSocket?.connected),
  );

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return undefined;
    }

    consumerCount += 1;

    if (!sharedSocket) {
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
      sharedSocket = io(SOCKET_URL, socketOptions);
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
      }
      setIsConnected(false);
    };
  }, [enabled, token]);

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
