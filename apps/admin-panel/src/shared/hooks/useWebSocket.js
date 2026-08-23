import { useEffect, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { API_BASE_URL } from "../lib/apiBase.js";

const SOCKET_URL = (() => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  // Unify with REST base: if API_BASE_URL is explicit (prod), use it; else dev proxy via window origin or backend URL
  if (API_BASE_URL) return API_BASE_URL;
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  if (typeof window !== "undefined") {
    // When API_BASE_URL is "" (dev proxy same-origin), socket should also use same origin so /socket.io proxy works
    return window.location.origin;
  }
  return import.meta.env.DEV ? "http://localhost:5001" : "";
})();

// Shared socket instance — prevents React StrictMode from creating duplicates
let sharedSocket = null;
let consumerCount = 0;

export const clearWebSocket = () => {
  try {
    sharedSocket?.disconnect();
  } catch (_e) {
    void _e;
  }
  sharedSocket = null;
  consumerCount = 0;
};
if (typeof window !== "undefined") {
  window.addEventListener("unauthorized", clearWebSocket);
}

export const useWebSocket = (enabled = true) => {
  const [isConnected, setIsConnected] = useState(() =>
    Boolean(sharedSocket?.connected),
  );

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return undefined;
    }

    consumerCount++;

    if (!sharedSocket) {
      sharedSocket = io(SOCKET_URL, {
        transports: ["websocket"],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 15000,
        timeout: 20000,
      });
    }

    const socket = sharedSocket;
    setIsConnected(socket.connected);

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    // If the session expires server-side while the socket is open, disconnect
    // and trigger the same client-side logout path as a 401.
    const handleSessionEnd = () => {
      sharedSocket?.disconnect();
      window.dispatchEvent(new Event("unauthorized"));
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("unauthorized", handleSessionEnd);
    socket.on("session_expired", handleSessionEnd);

    let errorCount = 0;
    const handleConnectError = (error) => {
      errorCount++;
      if (errorCount <= 3) {
        console.warn(
          `[WebSocket] Connection failed (${errorCount}):`,
          error.message,
        );
      } else if (errorCount === 10) {
        console.warn(
          "[WebSocket] Still retrying — server unreachable, check VITE_SOCKET_URL / API_BASE_URL",
        );
      }
    };
    // Auto-clear on successful connect
    const handleConnectOk = () => {
      errorCount = 0;
    };
    socket.on("connect", handleConnectOk);
    socket.on("connect_error", handleConnectError);

    return () => {
      consumerCount = Math.max(0, consumerCount - 1);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("unauthorized", handleSessionEnd);
      socket.off("session_expired", handleSessionEnd);
      socket.off("connect_error", handleConnectError);
      socket.off("connect", handleConnectOk);

      if (consumerCount === 0 && sharedSocket === socket) {
        // Only disconnect, don't removeAllListeners that might be from other consumers still cleaning up
        socket.disconnect();
        sharedSocket = null;
      }
      setIsConnected(false);
    };
  }, [enabled]);

  const emit = useCallback((event, data) => {
    sharedSocket?.emit(event, data);
  }, []);

  const on = useCallback((event, callback) => {
    // Queue listener if socket not yet connected (fixes race before connection)
    if (!sharedSocket) {
      const timer = setTimeout(() => {
        if (sharedSocket) sharedSocket.on(event, callback);
      }, 100);
      return () => {
        clearTimeout(timer);
        sharedSocket?.off(event, callback);
      };
    }
    sharedSocket.on(event, callback);
    return () => {
      sharedSocket?.off(event, callback);
    };
  }, []);

  return { isConnected, emit, on, socket: sharedSocket };
};

export default useWebSocket;
