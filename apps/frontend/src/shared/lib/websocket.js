import { io } from 'socket.io-client'

let socket = null

/**
 * Initialize the WebSocket connection
 * @param {Object} options - Socket.io client options
 * @param {string} options.url - WebSocket server URL (defaults to same origin)
 * @param {string} options.token - JWT auth token
 * @param {Function} options.onConnect - Callback when connected
 * @param {Function} options.onDisconnect - Callback when disconnected
 */
export const initWebSocket = ({ url, token, onConnect, onDisconnect, onReconnect, onReconnectError } = {}) => {
  if (socket?.connected) {
    console.log('[WebSocket] Already connected')
    return socket
  }

  // If no URL provided, try to use same origin
  const wsUrl = url || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5001')

  const options = {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    auth: {},
    ...options
  }

  if (token) {
    options.auth.token = token
  }

  try {
    socket = io(wsUrl, options)

    socket.on('connect', () => {
      console.log('[WebSocket] Connected:', socket.id)
      onConnect?.(socket.id)
    })

    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason)
      onDisconnect?.(reason)
    })

    socket.on('connect_error', (err) => {
      console.error('[WebSocket] Connection error:', err.message)
    })

    if (onReconnect) {
      socket.on('reconnect', (attemptNumber) => {
        console.log(`[WebSocket] Reconnected after ${attemptNumber} attempts`)
        onReconnect(attemptNumber)
      })
    }

    if (onReconnectError) {
      socket.on('reconnect_error', (err) => {
        console.error('[WebSocket] Reconnection error:', err.message)
        onReconnectError(err)
      })
    }

    // Setup default event listeners
    setupEventListeners()

    return socket
  } catch (err) {
    console.error('[WebSocket] Failed to initialize:', err)
    return null
  }
}

/**
 * Setup default event listeners for real-time notifications
 */
const setupEventListeners = () => {
  if (!socket) return

  // Test result ready
  socket.on('test:result_ready', (data) => {
    console.log('[WebSocket] Test result ready:', data)
    // Dispatch custom event for app-level handling
    dispatchCustomEvent('testResultReady', data)
  })

  // Leaderboard updated
  socket.on('leaderboard:updated', (data) => {
    console.log('[WebSocket] Leaderboard updated:', data)
    dispatchCustomEvent('leaderboardUpdated', data)
  })

  // New notification
  socket.on('notification:new', (data) => {
    console.log('[WebSocket] New notification:', data)
    dispatchCustomEvent('newNotification', data)
  })

  // Live test submission
  socket.on('live-test:attempt_submitted', (data) => {
    console.log('[WebSocket] Live test attempt submitted:', data)
    dispatchCustomEvent('liveTestAttemptSubmitted', data)
  })

  // Live test participant count
  socket.on('live-test:participant_count', (data) => {
    console.log('[WebSocket] Live test participant count:', data)
    dispatchCustomEvent('liveTestParticipantCount', data)
  })

  // Series updated
  socket.on('series:updated', (data) => {
    console.log('[WebSocket] Series updated:', data)
    dispatchCustomEvent('seriesUpdated', data)
  })
}

/**
 * Dispatch a custom event that components can listen to
 */
const dispatchCustomEvent = (eventName, data) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(`trstprep:${eventName}`, { detail: data }))
  }
}

/**
 * Get the current socket instance
 */
export const getSocket = () => socket

/**
 * Disconnect the WebSocket
 */
export const disconnectWebSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
    console.log('[WebSocket] Disconnected')
  }
}

/**
 * Join a test room for live updates
 */
export const joinTestRoom = (testId) => {
  if (!socket?.connected) {
    console.warn('[WebSocket] Cannot join room - not connected')
    return
  }
  socket.emit('live-tests:join', { testId })
  console.log(`[WebSocket] Joined test room: test:${testId}`)
}

/**
 * Leave a test room
 */
export const leaveTestRoom = (testId) => {
  if (!socket?.connected) return
  socket.emit('live-tests:leave', { testId })
  console.log(`[WebSocket] Left test room: test:${testId}`)
}

/**
 * Subscribe to leaderboard updates for a specific test
 * @param {string} testId - Test ID to subscribe to
 * @param {Function} callback - Callback when leaderboard updates
 */
export const subscribeToLeaderboard = (testId, callback) => {
  if (!socket?.connected) return null

  const handler = (data) => {
    if (data.testId === testId) {
      callback(data)
    }
  }

  socket.on('leaderboard:updated', handler)
  joinTestRoom(testId)

  return () => {
    socket.off('leaderboard:updated', handler)
    leaveTestRoom(testId)
  }
}

/**
 * Subscribe to notification updates
 * @param {Function} callback - Callback when new notification arrives
 */
export const subscribeToNotifications = (callback) => {
  if (!socket?.connected) return null

  const handler = (data) => {
    callback(data)
  }

  socket.on('notification:new', handler)

  return () => {
    socket.off('notification:new', handler)
  }
}
