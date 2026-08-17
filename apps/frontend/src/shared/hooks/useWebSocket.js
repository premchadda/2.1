import { useEffect, useState, useCallback } from 'react'
import { io } from 'socket.io-client'
import { API_BASE_URL } from '../lib/apiBase.js'

const SOCKET_URL = (() => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL
  if (API_BASE_URL) return API_BASE_URL
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ''}`
  }
  return 'http://localhost:5001'
})()

// Shared socket instance — prevents React StrictMode from creating duplicates.
// Reference-counted so the first component to unmount doesn't destroy the
// socket for all other consumers.
let sharedSocket = null
let consumerCount = 0

export const useWebSocket = (enabled = true) => {
  const [isConnected, setIsConnected] = useState(() => Boolean(sharedSocket?.connected))

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false)
      return undefined
    }

    consumerCount++

    if (!sharedSocket) {
      const storedToken = typeof window !== 'undefined'
        ? (sessionStorage.getItem('trstprep_auth_token') || localStorage.getItem('trstprep_token'))
        : null
      sharedSocket = io(SOCKET_URL, {
        transports: ['polling', 'websocket'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 15000,
        auth: storedToken ? { token: storedToken } : {}
      })
    }

    const socket = sharedSocket
    setIsConnected(socket.connected)

    const handleConnect = () => setIsConnected(true)
    const handleDisconnect = () => setIsConnected(false)

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)

    let errorCount = 0
    const handleConnectError = (error) => {
      errorCount++
      if (errorCount <= 3) {
        console.warn(`[WebSocket] Connection failed (${errorCount}/5):`, error.message)
      } else if (errorCount === 5) {
        console.warn('[WebSocket] Stopping reconnection attempts — server unreachable')
      }
    }
    socket.on('connect_error', handleConnectError)

    return () => {
      consumerCount = Math.max(0, consumerCount - 1)
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)

      if (consumerCount === 0 && sharedSocket === socket) {
        socket.removeAllListeners()
        socket.disconnect()
        sharedSocket = null
      }
      setIsConnected(false)
    }
  }, [enabled])

  const emit = useCallback((event, data) => {
    sharedSocket?.emit(event, data)
  }, [])

  const on = useCallback((event, callback) => {
    if (!sharedSocket) return () => {}
    sharedSocket.on(event, callback)
    return () => {
      sharedSocket?.off(event, callback)
    }
  }, [])

  return { isConnected, emit, on, socket: sharedSocket }
}

export default useWebSocket

