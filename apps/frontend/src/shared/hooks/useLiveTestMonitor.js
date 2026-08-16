import { useState, useEffect, useRef } from 'react'
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
  const joinedRef = useRef(false)

  useEffect(() => {
    if (!testId) return

    const socket = getSocket()
    if (!socket) return

    // If socket is not connected yet, wait for the 'connect' event
    // before joining the room. Previously this returned early immediately,
    // and the effect never retried — leaving the component with 0
    // participants and no leaderboard updates permanently.
    const joinRoom = () => {
      if (joinedRef.current) return
      joinedRef.current = true
      socket.emit('live-tests:join', { testId })
    }

    if (socket.connected) {
      joinRoom()
    } else {
      socket.once('connect', joinRoom)
    }

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
      joinedRef.current = false
      socket.off('connect', joinRoom)
      socket.off('live-test:attempt_submitted', handleSubmission)
      socket.off('leaderboard:updated', handleLeaderboardUpdate)
      socket.off('live-test:participant_count', handleParticipantCount)
      socket.emit('live-tests:leave', { testId })
    }
  }, [testId])

  return { participants, submissions, leaderboard, isLive }
}
