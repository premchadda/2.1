import { useState, useRef, useEffect } from 'react'
import { X, Play, Pause, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward, Settings } from 'lucide-react'

export default function VideoPlayer({ isOpen, onClose, videoData }) {
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
  const containerRef = useRef(null)
  const controlsTimeout = useRef(null)

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false)
      setCurrentTime(0)
    }
  }, [isOpen])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => setCurrentTime(video.currentTime)
    const handleDurationChange = () => setDuration(video.duration)
    const handleEnded = () => setIsPlaying(false)

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('durationchange', handleDurationChange)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('durationchange', handleDurationChange)
      video.removeEventListener('ended', handleEnded)
    }
  }, [])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      video.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleSeek = (e) => {
    const video = videoRef.current
    if (!video) return

    const rect = e.currentTarget.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    video.currentTime = pos * duration
  }

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
    setIsMuted(newVolume === 0)
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return

    if (isMuted) {
      video.volume = volume || 0.5
      setVolume(volume || 0.5)
      setIsMuted(false)
    } else {
      video.volume = 0
      setIsMuted(true)
    }
  }

  const toggleFullscreen = async () => {
    const container = containerRef.current
    if (!container) return

    try {
      if (!isFullscreen) {
        if (container.requestFullscreen) {
          await container.requestFullscreen()
        } else if (container.webkitRequestFullscreen) {
          await container.webkitRequestFullscreen()
        } else if (container.mozRequestFullScreen) {
          await container.mozRequestFullScreen()
        }
        setIsFullscreen(true)
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen()
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen()
        }
        setIsFullscreen(false)
      }
    } catch (error) {
      console.error('Fullscreen error:', error)
    }
  }

  const skip = (seconds) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds))
  }

  const changePlaybackRate = (rate) => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = rate
    setPlaybackRate(rate)
    setShowSettings(false)
  }

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const handleMouseMove = () => {
    setShowControls(true)
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current)
    }
    controlsTimeout.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false)
      }
    }, 3000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div
        ref={containerRef}
        className="relative w-full max-w-4xl bg-black rounded-xl overflow-hidden shadow-2xl"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        {/* 16:9 aspect-ratio video wrapper — no gaps */}
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-contain bg-black"
            src={videoData?.url || ''}
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
            <h3 className="text-white font-bold text-sm drop-shadow-lg">{videoData?.title}</h3>
            <p className="text-white/80 text-xs drop-shadow-lg">{videoData?.description}</p>
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
