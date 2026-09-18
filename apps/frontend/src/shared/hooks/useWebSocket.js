import { useEffect, useState, useCallback } from "react";
import {
  initWebSocket,
  getSocket,
  disconnectWebSocket,
  resolveSocketUrl,
} from "../lib/websocket.js";

// Single canonical resolver (see shared/lib/websocket.js) — evaluated once.
const SOCKET_URL = resolveSocketUrl();

// Reference-counted consumer tracking for unified socket instance
let consumerCount = 0;

// Listeners registered before the shared socket exists. The effect below
// flushes them onto the socket immediately after init — without this, an
// on() call during first render (before the effect) would silently drop
// the listener and the subscription would never activate.
const pendingListeners = [];

// Default resolver value is frozen at module load; callers that need a
// different host (tests, multi-backend, local overrides) pass `url` to opt
// out of the frozen SOCKET_URL without mutating module state.
export const useWebSocket = (enabled = true, url = null) => {
  const [isConnected, setIsConnected] = useState(() =>
    Boolean(getSocket()?.connected),
  );

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return undefined;
    }

    consumerCount++;

    const socketUrl = url || SOCKET_URL;
    let socket = getSocket();
    if (!socket) {
      socket = initWebSocket({ url: socketUrl });
      // Flush any listeners queued by on() calls that ran before this init.
      // If init failed (null socket), drop the queue — those subscriptions
      // can never activate, and keeping them would replay stale callbacks
      // onto a future unrelated socket.
      const queued = pendingListeners.splice(0, pendingListeners.length);
      if (socket) {
        for (const [event, callback] of queued) {
          try {
            socket.on(event, callback);
          } catch {}
        }
      }
    }

    if (!socket) {
      // Init failed — decrement the consumer count we just took so the
      // last real consumer's unmount still disconnects the socket.
      consumerCount = Math.max(0, consumerCount - 1);
      setIsConnected(false);
      return undefined;
    }

    setIsConnected(Boolean(socket.connected));

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    let errorCount = 0;
    const handleConnectError = (error) => {
      errorCount++;
      if (errorCount <= 3 && import.meta.env.DEV) {
        console.warn(
          `[WebSocket] Connection failed (${errorCount}/5):`,
          error.message,
        );
      } else if (errorCount === 5 && import.meta.env.DEV) {
        console.warn(
          "[WebSocket] Stopping reconnection attempts — server unreachable",
        );
      }
    };
    socket.on("connect_error", handleConnectError);

    return () => {
      consumerCount = Math.max(0, consumerCount - 1);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);

      if (consumerCount === 0) {
        disconnectWebSocket();
      }
      setIsConnected(false);
    };
  }, [enabled, url]);

  const emit = useCallback((event, data) => {
    getSocket()?.emit(event, data);
  }, []);

  const on = useCallback((event, callback) => {
    const s = getSocket();
    if (!s) {
      // Socket not yet initialized (first render before the owning effect):
      // queue the registration — it is flushed onto the socket the moment
      // initWebSocket runs. Dropping it here was a silent no-op.
      const entry = [event, callback];
      pendingListeners.push(entry);
      return () => {
        const idx = pendingListeners.indexOf(entry);
        if (idx !== -1) pendingListeners.splice(idx, 1);
        getSocket()?.off(event, callback);
      };
    }
    s.on(event, callback);
    return () => {
      getSocket()?.off(event, callback);
    };
  }, []);

  return { isConnected, emit, on, socket: getSocket() };
};

export default useWebSocket;
