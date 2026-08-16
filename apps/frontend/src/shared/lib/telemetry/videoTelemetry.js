/**
 * Video Telemetry & Engagement Tracker for Trstprep
 * Captures play, pause, resume, seek, rate changes, heartbeat, and watch duration.
 */

import api from '../api'

class VideoTelemetry {
  constructor() {
    this.currentSession = null
    this.heartbeatTimer = null
    this.batchQueue = []
  }

  /**
   * Start a video telemetry session
   */
  startSession({ videoId, duration, initialOffset = 0, videoTitle = '', userId = null }) {
    this.endSession() // Clean up any active session

    this.currentSession = {
      sessionId: `vses_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      videoId,
      videoTitle,
      userId,
      duration: duration || 0,
      currentSecond: initialOffset,
      lastTimestamp: initialOffset,
      totalWatchSeconds: 0,
      segmentWatchSeconds: 0,
      playbackSpeed: 1,
      isPlaying: false,
      startedAt: Date.now(),
      lastPlayTime: null,
      events: [],
    }

    this.logEvent('VIDEO_INIT', { initialOffset, duration })

    // Heartbeat every 8 seconds
    this.heartbeatTimer = setInterval(() => {
      this.tickHeartbeat()
    }, 8000)

    // Save initial progress to localStorage
    this.persistLocalProgress()
  }

  /**
   * Log an event
   */
  logEvent(type, metadata = {}) {
    if (!this.currentSession) return

    const event = {
      type,
      sessionId: this.currentSession.sessionId,
      videoId: this.currentSession.videoId,
      timestamp: Date.now(),
      currentSecond: Math.round(this.currentSession.currentSecond || 0),
      playbackSpeed: this.currentSession.playbackSpeed,
      metadata,
    }

    this.currentSession.events.push(event)
    this.batchQueue.push(event)

    // If critical event, flush immediately
    if (['VIDEO_COMPLETE', 'VIDEO_PAUSE', 'VIDEO_SEEK'].includes(type)) {
      this.flushEvents()
    }
  }

  /**
   * Called when user presses Play or resumes playback
   */
  trackPlay(currentSecond) {
    if (!this.currentSession) return
    this.currentSession.isPlaying = true
    this.currentSession.currentSecond = currentSecond
    this.currentSession.lastPlayTime = Date.now()

    this.logEvent('VIDEO_PLAY', {
      fromSecond: Math.round(currentSecond),
    })
  }

  /**
   * Called when user pauses
   */
  trackPause(currentSecond) {
    if (!this.currentSession) return
    this.accumulateWatchTime()
    this.currentSession.isPlaying = false
    this.currentSession.currentSecond = currentSecond

    this.logEvent('VIDEO_PAUSE', {
      atSecond: Math.round(currentSecond),
      segmentWatchSeconds: this.currentSession.segmentWatchSeconds,
      totalWatchSeconds: this.currentSession.totalWatchSeconds,
    })

    this.currentSession.segmentWatchSeconds = 0
    this.persistLocalProgress()
  }

  /**
   * Called when user seeks or scrubs
   */
  trackSeek(fromSecond, toSecond) {
    if (!this.currentSession) return
    this.accumulateWatchTime()
    const delta = toSecond - fromSecond

    this.logEvent('VIDEO_SEEK', {
      fromSecond: Math.round(fromSecond),
      toSecond: Math.round(toSecond),
      deltaSeconds: Math.round(delta),
      seekType: delta > 0 ? 'FORWARD' : 'BACKWARD',
    })

    this.currentSession.currentSecond = toSecond
    this.persistLocalProgress()
  }

  /**
   * Called when user changes playback speed
   */
  trackRateChange(newRate, currentSecond) {
    if (!this.currentSession) return
    this.accumulateWatchTime()
    const prevRate = this.currentSession.playbackSpeed
    this.currentSession.playbackSpeed = newRate

    this.logEvent('VIDEO_RATE_CHANGE', {
      previousSpeed: prevRate,
      newSpeed: newRate,
      atSecond: Math.round(currentSecond),
    })
  }

  /**
   * Called on timeupdate / progress tick
   */
  trackTimeUpdate(currentSecond, duration) {
    if (!this.currentSession) return
    this.currentSession.currentSecond = currentSecond
    if (duration && !this.currentSession.duration) {
      this.currentSession.duration = duration
    }
  }

  /**
   * Called when video finishes
   */
  trackComplete() {
    if (!this.currentSession) return
    this.accumulateWatchTime()
    this.currentSession.isPlaying = false

    this.logEvent('VIDEO_COMPLETE', {
      totalWatchSeconds: this.currentSession.totalWatchSeconds,
      duration: this.currentSession.duration,
    })

    this.persistLocalProgress(true)
    this.flushEvents()
  }

  /**
   * Internal accumulator for real elapsed watch seconds
   */
  accumulateWatchTime() {
    if (!this.currentSession || !this.currentSession.isPlaying || !this.currentSession.lastPlayTime) return
    const now = Date.now()
    const elapsedSeconds = Math.max(0, (now - this.currentSession.lastPlayTime) / 1000)
    this.currentSession.totalWatchSeconds += elapsedSeconds
    this.currentSession.segmentWatchSeconds += elapsedSeconds
    this.currentSession.lastPlayTime = now
  }

  /**
   * Periodic heartbeat
   */
  tickHeartbeat() {
    if (!this.currentSession || !this.currentSession.isPlaying) return
    this.accumulateWatchTime()

    this.logEvent('VIDEO_HEARTBEAT', {
      currentSecond: Math.round(this.currentSession.currentSecond),
      totalWatchSeconds: Math.round(this.currentSession.totalWatchSeconds),
      speed: this.currentSession.playbackSpeed,
    })

    this.persistLocalProgress()
    this.flushEvents()
  }

  /**
   * Persist progress to localStorage for instantaneous offline sync & resume
   */
  persistLocalProgress(completed = false) {
    if (!this.currentSession?.videoId) return
    const videoId = this.currentSession.videoId
    const duration = this.currentSession.duration || 1
    const lastTimestamp = Math.round(this.currentSession.currentSecond || 0)
    const percentage = Math.min(100, Math.round((lastTimestamp / duration) * 100))

    const record = {
      videoId,
      lastTimestamp,
      totalTimeSpent: Math.round(this.currentSession.totalWatchSeconds || 0),
      percentage,
      completed: completed || percentage >= 90,
      updatedAt: Date.now(),
    }

    try {
      localStorage.setItem(`video_progress_${videoId}`, JSON.stringify(record))

      // Also update master list of watched videos
      const masterKey = 'trstprep_user_video_progress_map'
      const raw = localStorage.getItem(masterKey)
      const map = raw ? JSON.parse(raw) : {}
      map[videoId] = record
      localStorage.setItem(masterKey, JSON.stringify(map))
    } catch {}
  }

  /**
   * Flush batch of events to backend API
   */
  async flushEvents() {
    if (this.batchQueue.length === 0 || !this.currentSession?.videoId) return

    const eventsToFlush = [...this.batchQueue]
    this.batchQueue = []
    const videoId = this.currentSession.videoId

    try {
      await api.post(`/api/videos/${videoId}/activity`, {
        sessionId: this.currentSession.sessionId,
        events: eventsToFlush,
        lastTimestamp: Math.round(this.currentSession.currentSecond || 0),
        totalTimeSpent: Math.round(this.currentSession.totalWatchSeconds || 0),
      })
    } catch {
      // Put events back in queue if network failed
      this.batchQueue = [...eventsToFlush, ...this.batchQueue]
    }
  }

  /**
   * End session and send final beacon
   */
  endSession() {
    if (!this.currentSession) return

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    this.accumulateWatchTime()
    this.persistLocalProgress()

    // Final flush via sendBeacon or API
    if (this.batchQueue.length > 0 && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const payload = JSON.stringify({
          sessionId: this.currentSession.sessionId,
          events: this.batchQueue,
          lastTimestamp: Math.round(this.currentSession.currentSecond || 0),
          totalTimeSpent: Math.round(this.currentSession.totalWatchSeconds || 0),
        })
        const blob = new Blob([payload], { type: 'application/json' })
        navigator.sendBeacon(`/api/videos/${this.currentSession.videoId}/activity`, blob)
      } catch {}
    } else {
      this.flushEvents()
    }

    this.currentSession = null
  }
}

export default new VideoTelemetry()
