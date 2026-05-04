import { useState, useEffect } from 'react'
import { getSocket } from '../lib/websocket'

/**
 * Hook to monitor live test activity in real-time
 * @param {string} testId - The test ID to monitor
 * @returns {Object} Real-time test data
 */
export function useLiveTestMonitor(testId) {
  const [participants, setParticipants] = useState(0)
  const [submissions, setSubmissions] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    if (!testId) return

    const socket = getSocket()
    if (!socket?.connected) return

    // Join the test room
    socket.emit('join:testRoom', { testId })

    // Listen for live test updates
    const handleSubmission = (data) => {
      if (data.testId === testId) {
        setSubmissions(prev => [...prev.slice(-50), { ...data, timestamp: new Date().toISOString() }])
      }
    }

    const handleLeaderboardUpdate = (data) => {
      if (data.testId === testId) {
        setLeaderboard(data.entries || [])
      }
    }

    const handleParticipantCount = (data) => {
      if (data.testId === testId) {
        setParticipants(data.count || 0)
        setIsLive(data.isLive ?? true)
      }
    }

    socket.on('live-test:attempt_submitted', handleSubmission)
    socket.on('leaderboard:updated', handleLeaderboardUpdate)
    socket.on('live-test:participant_count', handleParticipantCount)

    return () => {
      socket.off('live-test:attempt_submitted', handleSubmission)
      socket.off('leaderboard:updated', handleLeaderboardUpdate)
      socket.off('live-test:participant_count', handleParticipantCount)
      socket.emit('leave:testRoom', { testId })
    }
  }, [testId])

  return { participants, submissions, leaderboard, isLive }
}