import { createContext, useContext, useEffect, useRef, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { useNotificationContext } from './NotificationContext'
import { initWebSocket, disconnectWebSocket, getSocket } from '../lib/websocket'

const WebSocketContext = createContext(null)

export const useWebSocket = () => {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider')
  }
  return context
}

export function WebSocketProvider({ children }) {
  const { user, isAuthenticated } = useAuth()

  const socketRef = useRef(null)

  const handleConnect = useCallback((socketId) => {
    console.log(`[WebSocket] Provider connected with socket ID: ${socketId}`)
  }, [])

  const handleDisconnect = useCallback((reason) => {
    console.log(`[WebSocket] Provider disconnected: ${reason}`)
  }, [])

  useEffect(() => {
    if (isAuthenticated()) {
      // Initialize WebSocket connection
      const socket = initWebSocket({
        url: import.meta.env.VITE_WS_URL || `${window.location.protocol}//${window.location.hostname}:5001`,
        onConnect: handleConnect,
        onDisconnect: handleDisconnect,
      })
      socketRef.current = socket

      return () => {
        disconnectWebSocket()
      }
    }
  }, [isAuthenticated])

  // Broadcast custom events for app-level handling
  const broadcast = useCallback((event, data) => {
    const socket = getSocket()
    if (socket?.connected) {
      socket.emit(event, data)
    }
  }, [])

  const contextValue = {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected ?? false,
    broadcast,
  }

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  )
}
