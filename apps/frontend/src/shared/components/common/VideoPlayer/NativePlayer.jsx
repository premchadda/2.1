import { useRef, useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  Shield,
  Lock,
  Info,
  X,
} from "lucide-react";
import DynamicWatermark from "./DynamicWatermark.jsx";
import videoTelemetry from "../../../lib/telemetry/videoTelemetry";

/**
 * NativePlayer — HTML5 video element with custom controls + telemetry.
 * Extracted from VideoPlayer.jsx to reduce god file size.
 * Keeps videoTelemetry wiring and watermark visible (/30).
 */
export default function NativePlayer({
  videoData,
  user,
  onClose,
  isEncrypted,
  encryptionType,
  showSecurityInfo,
  setShowSecurityInfo,
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeout = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [savedProgress, setSavedProgress] = useState({
    lastTimestamp: 0,
    totalTimeSpent: 0,
  });
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const viewRecordedRef = useRef(false);

  const videoId = videoData?.publicId || videoData?.id || videoData?._id;

  const formatTime = (time) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // throttle helper for mousemove ( ~100ms )
  const throttleRef = useRef(null);
  const handleMouseMove = useCallback(() => {
    if (throttleRef.current) return;
    throttleRef.current = setTimeout(() => {
      throttleRef.current = null;
    }, 100);
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowControls(false);
    }, 3000);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      videoTelemetry.trackTimeUpdate(video.currentTime, video.duration);
    };
    const handleDurationChange = () => setDuration(video.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      videoTelemetry.trackComplete();
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("ended", handleEnded);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  // Load progress and prompt resume
  useEffect(() => {
    if (!videoId) return;
    viewRecordedRef.current = false;
    const localKey = `video_progress_${videoId}`;
    let localData = null;
    try {
      const raw =
        typeof window !== "undefined" ? localStorage.getItem(localKey) : null;
      if (raw) localData = JSON.parse(raw);
    } catch {}
    if (localData && localData.lastTimestamp > 3) {
      setSavedProgress(localData);
      setShowResumeBanner(true);
    }
  }, [videoId]);

  useEffect(() => {
    if (!isPlaying || !videoId) return;
    if (!viewRecordedRef.current) {
      viewRecordedRef.current = true;
      import("../../../lib/api").then(({ default: api }) => {
        api.post(`/api/videos/${videoId}/view`).catch(() => {});
      });
    }
  }, [isPlaying, videoId]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      videoTelemetry.trackPause(video.currentTime);
    } else {
      video.play();
      videoTelemetry.trackPlay(video.currentTime);
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleSeek = useCallback(
    (e) => {
      const video = videoRef.current;
      if (!video) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      const target = pos * duration;
      videoTelemetry.trackSeek(video.currentTime, target);
      video.currentTime = target;
    },
    [duration],
  );

  const skip = useCallback(
    (seconds) => {
      const video = videoRef.current;
      if (!video) return;
      const from = video.currentTime;
      const target = Math.max(0, Math.min(duration, from + seconds));
      videoTelemetry.trackSeek(from, target);
      video.currentTime = target;
    },
    [duration],
  );

  const changePlaybackRate = useCallback((rate) => {
    const video = videoRef.current;
    if (!video) return;
    videoTelemetry.trackRateChange(rate, video.currentTime);
    video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !isMuted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
  }, [isMuted]);

  const handleVolumeChange = useCallback((e) => {
    const newVol = parseFloat(e.target.value);
    const video = videoRef.current;
    if (video) {
      video.volume = newVol;
      video.muted = newVol === 0;
    }
    setVolume(newVol);
    setIsMuted(newVol === 0);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-black overflow-hidden rounded-xl"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <DynamicWatermark user={user} />

        {showResumeBanner && savedProgress.lastTimestamp > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white backdrop-blur-md px-4 py-2.5 rounded-2xl border border-indigo-500/40 shadow-2xl flex flex-wrap items-center gap-3 text-xs">
            <span className="font-semibold text-gray-200">
              Continue watching from{" "}
              <strong className="text-indigo-400">
                {formatTime(savedProgress.lastTimestamp)}
              </strong>
              ?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (videoRef.current)
                    videoRef.current.currentTime = savedProgress.lastTimestamp;
                  setShowResumeBanner(false);
                  if (!isPlaying) togglePlay();
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1 rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Resume ({formatTime(savedProgress.lastTimestamp)})
              </button>
              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) videoRef.current.currentTime = 0;
                  setShowResumeBanner(false);
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
          src={videoData?.url || videoData?.videoUrl || ""}
          onClick={togglePlay}
        />

        <button
          type="button"
          onClick={onClose}
          className={`absolute top-3 right-3 z-50 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all ${showControls ? "opacity-100" : "opacity-0"}`}
          aria-label="Close video"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        {!isPlaying && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 m-auto w-16 h-16 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-all"
            aria-label="Play video"
          >
            <Play className="w-8 h-8 text-white ml-1" aria-hidden="true" />
          </button>
        )}

        <div
          className={`absolute top-3 left-3 z-40 transition-all ${showControls ? "opacity-100" : "opacity-0"}`}
        >
          <div className="flex items-center gap-2">
            <h3 className="text-white font-bold text-sm drop-shadow-lg">
              {videoData?.title}
            </h3>
            {isEncrypted && (
              <button
                type="button"
                onClick={() => setShowSecurityInfo(!showSecurityInfo)}
                className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full hover:bg-emerald-500/30 transition-colors"
              >
                <Shield
                  className="w-3 h-3 text-emerald-400"
                  aria-hidden="true"
                />
                <span className="text-emerald-400 text-xs font-medium">
                  Encrypted
                </span>
              </button>
            )}
          </div>
          <p className="text-white/80 text-xs drop-shadow-lg">
            {videoData?.description}
          </p>
          {showSecurityInfo && isEncrypted && (
            <div className="absolute top-full left-0 mt-2 bg-gray-900 border border-emerald-500/30 rounded-lg p-3 shadow-xl max-w-xs">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                <span className="text-white text-xs font-semibold">
                  FortSpy Protection
                </span>
              </div>
              <p className="text-white/70 text-xs leading-relaxed">
                This video is encrypted at the pixel level using{" "}
                {encryptionType}. Frames are decrypted in real-time during
                playback for secure viewing.
              </p>
              <div className="mt-2 pt-2 border-t border-white/10">
                <div className="flex items-center gap-1 text-emerald-400 text-xs">
                  <Info className="w-3 h-3" aria-hidden="true" />
                  <span>Content protected from screen capture</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pt-8 pb-3 transition-all ${showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
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
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={togglePlay}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-white" aria-hidden="true" />
                ) : (
                  <Play className="w-5 h-5 text-white" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={() => skip(-10)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                aria-label="Skip back 10 seconds"
              >
                <SkipBack className="w-4 h-4 text-white" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => skip(10)}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                aria-label="Skip forward 10 seconds"
              >
                <SkipForward
                  className="w-4 h-4 text-white"
                  aria-hidden="true"
                />
              </button>
              <div className="flex items-center gap-1 group">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <VolumeX
                      className="w-4 h-4 text-white"
                      aria-hidden="true"
                    />
                  ) : (
                    <Volume2
                      className="w-4 h-4 text-white"
                      aria-hidden="true"
                    />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-0 group-hover:w-16 transition-all opacity-0 group-hover:opacity-100"
                  aria-label="Volume"
                />
              </div>
              <span className="text-white text-xs font-medium ml-1">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              {isEncrypted && (
                <div
                  className="ml-2 flex items-center gap-1 text-emerald-400"
                  title="FortSpy Encrypted"
                >
                  <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                  aria-label="Playback speed"
                >
                  <Settings className="w-4 h-4 text-white" aria-hidden="true" />
                </button>
                {showSettings && (
                  <div className="absolute bottom-full right-0 mb-2 bg-gray-900 rounded-lg shadow-xl p-2 min-w-[110px]">
                    <p className="text-white text-xs font-medium mb-1 px-2">
                      Speed
                    </p>
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        type="button"
                        key={rate}
                        onClick={() => changePlaybackRate(rate)}
                        className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${playbackRate === rate ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10"}`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                aria-label={
                  isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                }
              >
                {isFullscreen ? (
                  <Minimize className="w-4 h-4 text-white" aria-hidden="true" />
                ) : (
                  <Maximize className="w-4 h-4 text-white" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
