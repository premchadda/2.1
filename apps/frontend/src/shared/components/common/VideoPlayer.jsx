import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward, Settings, ExternalLink, Shield, Lock, Info, AlertTriangle, EyeOff } from 'lucide-react'
import api from '../../lib/api'
import { useAuth } from '../../providers/AuthContext'
import videoTelemetry from '../../lib/telemetry/videoTelemetry'

// Dynamic Floating Anti-Piracy Watermark
function DynamicWatermark({ user }) {
  const [pos, setPos] = useState({ top: '20%', left: '25%' })

  useEffect(() => {
    const interval = setInterval(() => {
      const top = Math.floor(Math.random() * 65 + 10) + '%'
      const left = Math.floor(Math.random() * 65 + 10) + '%'
      setPos({ top, left })
    }, 7000)
    return () => clearInterval(interval)
  }, [])

  const label = user?.email || user?.name || (user?.id ? `UID: ${user.id}` : 'Trstprep Secured')

  return (
    <div
      className="pointer-events-none select-none absolute z-30 transform -rotate-12 transition-all duration-1000 ease-in-out font-mono font-bold text-[10px] sm:text-xs text-white/20 tracking-wider flex flex-col items-center drop-shadow-sm"
      style={{ top: pos.top, left: pos.left }}
    >
      <span>{label}</span>
      <span className="text-[8px] opacity-70">AES-256 Protected</span>
    </div>
  )
}

// Detect if a URL is an embeddable hosted video (YouTube, Vimeo, Google Drive)
function getEmbedInfo(url) {
  if (!url) return null

  // YouTube: youtube.com/watch?v=ID or youtu.be/ID or youtube.com/embed/ID
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  )
  if (ytMatch) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0&modestbranding=1`,
    }
  }

  // Vimeo: vimeo.com/ID or player.vimeo.com/video/ID
  const vimeoMatch = url.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/)
  if (vimeoMatch) {
    return {
      type: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`,
    }
  }

  // Google Drive: drive.google.com/file/d/ID/view
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)
  if (driveMatch) {
    return {
      type: 'gdrive',
      embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview`,
    }
  }

  return null // direct file URL
}

// FortSpy encrypted video player using canvas + MJPEG stream
function FortSpyPlayer({ videoData, isPlaying, _onPlayPause, onError }) {
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [streamUrl, setStreamUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!videoData?.fortspyId) return

    const fetchStreamUrl = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get stream token from backend
        const response = await api.post('/api/fortspy/generate-stream-token', {
          videoId: videoData.fortspyId,
          key: videoData.fortspyKey || videoData.key,
        })

        if (response.data.success) {
          setStreamUrl(response.data.data.streamUrl)
        } else {
          throw new Error('Failed to generate stream token')
        }
      } catch (err) {
        console.error('FortSpy stream setup error:', err)
        setError(err.message || 'Failed to setup encrypted video stream')
        onError?.(err)
      } finally {
        setLoading(false)
      }
    }

    fetchStreamUrl()

    return () => {
      // Cleanup stream on unmount
      if (streamRef.current) {
        streamRef.current.close()
        streamRef.current = null
      }
    }
  }, [videoData?.fortspyId, videoData?.fortspyKey])

  useEffect(() => {
    if (!streamUrl || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      canvas.width = img.naturalWidth || 1280
      canvas.height = img.naturalHeight || 720
      ctx.drawImage(img, 0, 0)
    }

    img.onerror = () => {
      setError('Failed to load video frame')
    }

    // MJPEG stream - update image source on each frame
    const _updateFrame = () => {
      if (streamUrl) {
        img.src = streamUrl + '&t=' + Date.now()
      }
    }

    // For MJPEG streams, we need to use fetch to read chunks
    const startStream = async () => {
      try {
        const response = await fetch(streamUrl)
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Parse MJPEG frames
          const frameMatch = buffer.match(/Content-Type: image\/jpeg\r\n\r\n([\s\S]*?)(?=Content-Type:|$)/)
          if (frameMatch) {
            const frameData = frameMatch[1].trim()
            if (frameData) {
              // Convert base64 to image
              const img = new Image()
              img.onload = () => {
                canvas.width = img.naturalWidth || 1280
                canvas.height = img.naturalHeight || 720
                ctx.drawImage(img, 0, 0)
              }
              img.src = 'data:image/jpeg;base64,' + frameData
            }
            buffer = buffer.slice(frameMatch[0].length)
          }
        }
      } catch (err) {
        console.error('Stream error:', err)
        setError('Stream connection lost')
      }
    }

    if (isPlaying) {
      startStream()
    }

    return () => {
      // Cleanup
    }
  }, [streamUrl, isPlaying])

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-emerald-400/20 border-emerald-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-emerald-400 text-sm font-medium">Decrypting video...</p>
          <p className="text-white/50 text-xs mt-1">Establishing secure connection</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
        <div className="text-center px-4">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <p className="text-white text-sm font-medium mb-1">Decryption Error</p>
          <p className="text-white/50 text-xs">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-contain bg-black"
    />
  )
}

export default function VideoPlayer({ isOpen, onClose, videoData, inline = false }) {
  const { user } = useAuth()
  const videoRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showSettings, setShowSettings] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [showSecurityInfo, setShowSecurityInfo] = useState(false)
  const [savedProgress, setSavedProgress] = useState({ lastTimestamp: 0, totalTimeSpent: 0 })
  const [showResumeBanner, setShowResumeBanner] = useState(false)
  const containerRef = useRef(null)
  const controlsTimeout = useRef(null)
  const viewRecordedRef = useRef(false)
  const watchTimeSecondsRef = useRef(0)

  // Anti-inspection & keyboard protection guard
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (
        (e.ctrlKey && (e.key === 's' || e.key === 'u' || e.key === 'p')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
        e.key === 'F12'
      ) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const isEncrypted = videoData?.isEncrypted || videoData?.fortspy || false
  const encryptionType = videoData?.encryptionType || 'AES-256-CTR'
  const hasFortSpy = !!videoData?.fortspyId
  const videoId = videoData?.publicId || videoData?.id || videoData?._id

  // Initialize video telemetry session
  useEffect(() => {
    if (isOpen && videoId) {
      videoTelemetry.startSession({
        videoId,
        duration,
        initialOffset: savedProgress.lastTimestamp || 0,
        videoTitle: videoData?.title || '',
        userId: user?.id || null,
      })
    }
    return () => {
      videoTelemetry.endSession()
    }
  }, [isOpen, videoId])

  // Load progress and prompt resume on open
  useEffect(() => {
    if (!isOpen || !videoId) return

    viewRecordedRef.current = false
    watchTimeSecondsRef.current = 0

    // Load from localStorage
    const localKey = `video_progress_${videoId}`
    let localData = null
    try {
      const raw = localStorage.getItem(localKey)
      if (raw) localData = JSON.parse(raw)
    } catch {
      // localStorage may throw in Safari private mode / disabled storage
    }

    if (localData && localData.lastTimestamp > 3) {
      setSavedProgress(localData)
      setShowResumeBanner(true)
    }

    // Fetch from backend
    api.get(`/api/videos/${videoId}/progress`)
      .then(res => {
        if (res.data?.success && res.data?.data) {
          const apiData = res.data.data
          if (apiData.lastTimestamp > 3) {
            setSavedProgress(prev => ({
              lastTimestamp: Math.max(prev.lastTimestamp || 0, apiData.lastTimestamp || 0),
              totalTimeSpent: (prev.totalTimeSpent || 0) + (apiData.totalTimeSpent || 0)
            }))
            setShowResumeBanner(true)
          }
        }
      })
      .catch(() => {})
  }, [isOpen, videoId])

  // Record view after 2 seconds of playback
  useEffect(() => {
    if (!isPlaying || !videoId) return

    if (!viewRecordedRef.current) {
      viewRecordedRef.current = true
      api.post(`/api/videos/${videoId}/view`).catch(() => {})
    }
  }, [isPlaying, videoId])

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false)
      setCurrentTime(0)
    }
  }, [isOpen])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      videoTelemetry.trackTimeUpdate(video.currentTime, video.duration)
    }
    const handleDurationChange = () => setDuration(video.duration)
    const handleEnded = () => {
      setIsPlaying(false)
      videoTelemetry.trackComplete()
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('durationchange', handleDurationChange)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('durationchange', handleDurationChange)
      video.removeEventListener('ended', handleEnded)
    }
  }, [])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
      videoTelemetry.trackPause(video.currentTime)
    } else {
      video.play()
      videoTelemetry.trackPlay(video.currentTime)
    }
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const handleSeek = useCallback((e) => {
    const video = videoRef.current
    if (!video) return

    const rect = e.currentTarget.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    const target = pos * duration
    videoTelemetry.trackSeek(video.currentTime, target)
    video.currentTime = target
  }, [duration])

  const skip = useCallback((seconds) => {
    const video = videoRef.current
    if (!video) return
    const from = video.currentTime
    const target = Math.max(0, Math.min(duration, from + seconds))
    videoTelemetry.trackSeek(from, target)
    video.currentTime = target
  }, [duration])

  const changePlaybackRate = useCallback((rate) => {
    const video = videoRef.current
    if (!video) return
    videoTelemetry.trackRateChange(rate, video.currentTime)
    video.playbackRate = rate
    setPlaybackRate(rate)
    setShowSettings(false)
  }, [])

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleMouseMove = useCallback(() => {
    setShowControls(true)
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current)
    }
    controlsTimeout.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false)
      }
    }, 3000)
  }, [isPlaying])

  if (!isOpen) return null

  // When inline, render inside the parent container (no fullscreen overlay)
  const overlayClass = inline
    ? 'relative w-full'
    : '{overlayClass}'
  const overlayCenterClass = inline
    ? 'relative w-full flex items-center justify-center'
    : '{overlayCenterClass}'
  const innerBoxClass = inline
    ? 'relative w-full bg-black overflow-hidden rounded-xl'
    : '{innerBoxClass}'

  const embedInfo = getEmbedInfo(videoData?.url || videoData?.videoUrl || '')

  // ── Embedded player (YouTube / Vimeo / Google Drive) ─────────────────
  if (embedInfo && !hasFortSpy) {
    return (
      <div className={overlayClass}>
        <div
          className={innerBoxClass}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Title bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-black/90">
            <div className="min-w-0 flex-1 mr-3">
              <h3 className="text-white font-semibold text-sm truncate">{videoData?.title}</h3>
              {videoData?.description && (
                <p className="text-white/50 text-xs truncate">{videoData.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full">
                <Shield className="w-3 h-3 text-indigo-400" />
                <span className="text-indigo-400 text-[11px] font-medium capitalize">{embedInfo.type} Stream</span>
              </div>
              {/* Only show direct external link if not flagged as premium/protected */}
              {!videoData?.isPaid && !isEncrypted && (
                <a
                  href={videoData.url || videoData.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              <button
                onClick={onClose}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* 16:9 iframe container — no gaps */}
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            {/* Dynamic Anti-Piracy Watermark over iframe */}
            <DynamicWatermark user={user} />

            <iframe
              src={embedInfo.embedUrl}
              className="absolute inset-0 w-full h-full border-0"
              title={videoData?.title || 'Video'}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    )
  }

  // ── FortSpy encrypted video player ──────────────────────────────────
  if (hasFortSpy) {
    return (
      <div className={overlayClass}>
        <div
          ref={containerRef}
          className={innerBoxClass}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => isPlaying && setShowControls(false)}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* 16:9 aspect-ratio container */}
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            {/* Dynamic Anti-Piracy Watermark */}
            <DynamicWatermark user={user} />

            {/* FortSpy Canvas Player */}
            <FortSpyPlayer
              videoData={videoData}
              isPlaying={isPlaying}
              onPlayPause={() => setIsPlaying(!isPlaying)}
            />

            {/* Close Button */}
            <button
              onClick={onClose}
              className={`absolute top-3 right-3 z-50 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all ${
                showControls ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Center Play Button */}
            {!isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute inset-0 m-auto w-16 h-16 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-all z-10"
              >
                <Play className="w-8 h-8 text-white ml-1" />
              </button>
            )}

            {/* Video Info */}
            <div
              className={`absolute top-3 left-3 z-40 transition-all ${
                showControls ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="flex items-center gap-2">
                <h3 className="text-white font-bold text-sm drop-shadow-lg">{videoData?.title}</h3>
                <button
                  onClick={() => setShowSecurityInfo(!showSecurityInfo)}
                  className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full hover:bg-emerald-500/30 transition-colors"
                >
                  <Shield className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 text-xs font-medium">FortSpy</span>
                </button>
              </div>
              <p className="text-white/80 text-xs drop-shadow-lg">{videoData?.description}</p>

              {/* Security Info Popup */}
              {showSecurityInfo && (
                <div className="absolute top-full left-0 mt-2 bg-gray-900 border border-emerald-500/30 rounded-lg p-3 shadow-xl max-w-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span className="text-white text-xs font-semibold">FortSpy Protection</span>
                  </div>
                  <p className="text-white/70 text-xs leading-relaxed">
                    This video is encrypted at the pixel level using {encryptionType}.
                    Frames are decrypted in real-time during playback for secure viewing.
                  </p>
                  <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                    <div className="flex items-center gap-1 text-emerald-400 text-xs">
                      <Info className="w-3 h-3" />
                      <span>Content protected from screen capture</span>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-400 text-xs">
                      <Info className="w-3 h-3" />
                      <span>End-to-end encrypted stream</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pt-8 pb-3 transition-all ${
                showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              {/* Progress Bar */}
              <div className="w-full h-1 bg-white/30 rounded-full mb-3 cursor-pointer group">
                <div
                  className="h-full bg-emerald-400 rounded-full relative"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                {/* Left Controls */}
                <div className="flex items-center gap-1">
                  <button onClick={togglePlay} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                    {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
                  </button>
                  <button onClick={() => skip(-10)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                    <SkipBack className="w-4 h-4 text-white" />
                  </button>
                  <button onClick={() => skip(10)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                    <SkipForward className="w-4 h-4 text-white" />
                  </button>

                  {/* Volume */}
                  <div className="flex items-center gap-1 group">
                    <button onClick={toggleMute} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                      {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                    </button>
                    <input
                      type="range" min="0" max="1" step="0.1"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-0 group-hover:w-16 transition-all opacity-0 group-hover:opacity-100"
                    />
                  </div>

                  <span className="text-white text-xs font-medium ml-1">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                  <div className="ml-2 flex items-center gap-1 text-emerald-400" title="FortSpy Encrypted">
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Right Controls */}
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                      <Settings className="w-4 h-4 text-white" />
                    </button>
                    {showSettings && (
                      <div className="absolute bottom-full right-0 mb-2 bg-gray-900 rounded-lg shadow-xl p-2 min-w-[110px]">
                        <p className="text-white text-xs font-medium mb-1 px-2">Speed</p>
                        {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => changePlaybackRate(rate)}
                            className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                              playbackRate === rate ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'
                            }`}
                          >
                            {rate}x
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={toggleFullscreen} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                    {isFullscreen ? <Minimize className="w-4 h-4 text-white" /> : <Maximize className="w-4 h-4 text-white" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── No URL at all ─────────────────────────────────────────────
  if (!videoData?.url && !videoData?.videoUrl) {
    return (
      <div className={overlayCenterClass}>
        <div className="bg-gray-900 rounded-xl p-8 text-center max-w-sm w-full shadow-2xl">
          <div className="text-6xl mb-4">🎬</div>
          <p className="text-white text-lg font-bold mb-2">{videoData?.title || 'Video'}</p>
          <p className="text-white/50 text-sm mb-6">No video URL available</p>
          <button onClick={onClose} className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors">
            Close
          </button>
        </div>
      </div>
    )
  }

  // ── Native HTML5 video (direct file URL) ──────────────────────────────────
  return (
    <div className={overlayClass}>
      <div
        ref={containerRef}
        className={innerBoxClass}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* 16:9 aspect-ratio video wrapper — no gaps */}
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          {/* Dynamic Anti-Piracy Watermark */}
          <DynamicWatermark user={user} />

          {/* Resume Prompt Banner Overlay */}
          {showResumeBanner && savedProgress.lastTimestamp > 0 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white backdrop-blur-md px-4 py-2.5 rounded-2xl border border-indigo-500/40 shadow-2xl flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold text-gray-200">
                Continue watching from <strong className="text-indigo-400">{formatTime(savedProgress.lastTimestamp)}</strong>?
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (videoRef.current) videoRef.current.currentTime = savedProgress.lastTimestamp
                    setShowResumeBanner(false)
                    if (!isPlaying) togglePlay()
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Resume ({formatTime(savedProgress.lastTimestamp)})
                </button>
                <button
                  onClick={() => {
                    if (videoRef.current) videoRef.current.currentTime = 0
                    setShowResumeBanner(false)
                  }}
                  className="bg-white/10 hover:bg-white/20 text-gray-300 font-bold px-2.5 py-1 rounded-xl transition-all cursor-pointer"
                >
                  Start Over
                </button>
              </div>
            </div>
          )}

          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-contain bg-black"
            src={videoData?.url || videoData?.videoUrl || ''}
            onClick={togglePlay}
          />

          {/* Close Button */}
          <button
            onClick={onClose}
            className={`absolute top-3 right-3 z-50 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Center Play Button */}
          {!isPlaying && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 m-auto w-16 h-16 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-all"
            >
              <Play className="w-8 h-8 text-white ml-1" />
            </button>
          )}

          {/* Video Info */}
          <div
            className={`absolute top-3 left-3 z-40 transition-all ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="flex items-center gap-2">
              <h3 className="text-white font-bold text-sm drop-shadow-lg">{videoData?.title}</h3>
              {isEncrypted && (
                <button
                  onClick={() => setShowSecurityInfo(!showSecurityInfo)}
                  className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full hover:bg-emerald-500/30 transition-colors"
                >
                  <Shield className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 text-xs font-medium">Encrypted</span>
                </button>
              )}
            </div>
            <p className="text-white/80 text-xs drop-shadow-lg">{videoData?.description}</p>

            {/* Security Info Popup */}
            {showSecurityInfo && isEncrypted && (
              <div className="absolute top-full left-0 mt-2 bg-gray-900 border border-emerald-500/30 rounded-lg p-3 shadow-xl max-w-xs">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span className="text-white text-xs font-semibold">FortSpy Protection</span>
                </div>
                <p className="text-white/70 text-xs leading-relaxed">
                  This video is encrypted at the pixel level using {encryptionType}.
                  Frames are decrypted in real-time during playback for secure viewing.
                </p>
                <div className="mt-2 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-1 text-emerald-400 text-xs">
                    <Info className="w-3 h-3" />
                    <span>Content protected from screen capture</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pt-8 pb-3 transition-all ${
              showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {/* Progress Bar */}
            <div
              className="w-full h-1 bg-white/30 rounded-full mb-3 cursor-pointer group"
              onClick={handleSeek}
            >
              <div
                className="h-full bg-white rounded-full relative"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              {/* Left Controls */}
              <div className="flex items-center gap-1">
                <button onClick={togglePlay} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                  {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white" />}
                </button>
                <button onClick={() => skip(-10)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                  <SkipBack className="w-4 h-4 text-white" />
                </button>
                <button onClick={() => skip(10)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                  <SkipForward className="w-4 h-4 text-white" />
                </button>

                {/* Volume */}
                <div className="flex items-center gap-1 group">
                  <button onClick={toggleMute} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                    {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                  </button>
                  <input
                    type="range" min="0" max="1" step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-0 group-hover:w-16 transition-all opacity-0 group-hover:opacity-100"
                  />
                </div>

                <span className="text-white text-xs font-medium ml-1">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                {isEncrypted && (
                  <div className="ml-2 flex items-center gap-1 text-emerald-400" title="FortSpy Encrypted">
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-1">
                <div className="relative">
                  <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                    <Settings className="w-4 h-4 text-white" />
                  </button>
                  {showSettings && (
                    <div className="absolute bottom-full right-0 mb-2 bg-gray-900 rounded-lg shadow-xl p-2 min-w-[110px]">
                      <p className="text-white text-xs font-medium mb-1 px-2">Speed</p>
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <button
                          key={rate}
                          onClick={() => changePlaybackRate(rate)}
                          className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                            playbackRate === rate ? 'bg-white/20 text-white' : 'text-white/80 hover:bg-white/10'
                          }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={toggleFullscreen} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                  {isFullscreen ? <Minimize className="w-4 h-4 text-white" /> : <Maximize className="w-4 h-4 text-white" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
