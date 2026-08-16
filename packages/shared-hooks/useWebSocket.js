import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = (() => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (typeof process !== 'undefined' && process.env?.REACT_APP_SOCKET_URL) return process.env.REACT_APP_SOCKET_URL;
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}`;
  }
  return 'http://localhost:5001';
})();

// HIGH-09/05 FIX: Uses cookie-based auth (withCredentials), no token parameter
export const useWebSocket = () => {
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  if (!socketRef.current && typeof window !== 'undefined') {
    socketRef.current = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleConnectError = (err) => console.error('WebSocket Connect Error:', err.message);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const emit = useCallback((event, data) => {
    if (socketRef.current) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
      return () => {
        if (socketRef.current) {
          socketRef.current.off(event, callback);
        }
      };
    }
    return () => {};
  }, []);

  return { isConnected, emit, on, socketRef };
};

export default useWebSocket;
