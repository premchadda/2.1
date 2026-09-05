import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  ExternalLink,
  Shield,
  Lock,
  Info,
  AlertTriangle,
} from "lucide-react";
import api from "../../lib/api";
import { useAuth } from "../../providers/AuthContext";
import videoTelemetry from "../../lib/telemetry/videoTelemetry";
import DynamicWatermark from "./VideoPlayer/DynamicWatermark.jsx";
import { getEmbedInfo } from "./VideoPlayer/EmbedResolver.js";
import NativePlayer from "./VideoPlayer/NativePlayer.jsx";

// FortSpy encrypted video player using canvas + MJPEG stream
function FortSpyPlayer({ videoData, isPlaying, _onPlayPause, onError }) {
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!videoData?.fortspyId) return;
    const fetchStreamUrl = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.post("/api/fortspy/generate-stream-token", {
          videoId: videoData.fortspyId,
          key: videoData.fortspyKey || videoData.key,
        });
        if (response.data.success) {
          setStreamUrl(response.data.data.streamUrl);
        } else {
          throw new Error("Failed to generate stream token");
        }
      } catch (err) {
        console.error("FortSpy stream setup error:", err);
        setError(err.message || "Failed to setup encrypted video stream");
        onError?.(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStreamUrl();
    return () => {
      if (streamRef.current) {
        streamRef.current.close();
        streamRef.current = null;
      }
    };
  }, [videoData?.fortspyId, videoData?.fortspyKey, onError]);

  useEffect(() => {
    if (!streamUrl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth || 1280;
      canvas.height = img.naturalHeight || 720;
      ctx.drawImage(img, 0, 0);
    };
    img.onerror = () => setError("Failed to load video frame");
    const startStream = async () => {
      try {
        const response = await fetch(streamUrl);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frameMatch = buffer.match(
            /Content-Type: image\/jpeg\r\n\r\n([\s\S]*?)(?=Content-Type:|$)/,
          );
          if (frameMatch) {
            const frameData = frameMatch[1].trim();
            if (frameData) {
              const frameImg = new Image();
              frameImg.onload = () => {
                canvas.width = frameImg.naturalWidth || 1280;
                canvas.height = frameImg.naturalHeight || 720;
                ctx.drawImage(frameImg, 0, 0);
              };
              frameImg.src = "data:image/jpeg;base64," + frameData;
            }
            buffer = buffer.slice(frameMatch[0].length);
          }
        }
      } catch (err) {
        console.error("Stream error:", err);
        setError("Stream connection lost");
      }
    };
    if (isPlaying) startStream();
  }, [streamUrl, isPlaying]);

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-emerald-400/20 border-emerald-400 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-emerald-400 text-sm font-medium">
            Decrypting video...
          </p>
          <p className="text-white/50 text-xs mt-1">
            Establishing secure connection
          </p>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
        <div className="text-center px-4">
          <AlertTriangle
            className="w-12 h-12 text-amber-400 mx-auto mb-3"
            aria-hidden="true"
          />
          <p className="text-white text-sm font-medium mb-1">
            Decryption Error
          </p>
          <p className="text-white/50 text-xs">{error}</p>
        </div>
      </div>
    );
  }
  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-contain bg-black"
    />
  );
}

export default function VideoPlayer({
  isOpen,
  onClose,
  videoData,
  inline = false,
}) {
  const { user } = useAuth();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, _setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSecurityInfo, setShowSecurityInfo] = useState(false);
  const [savedProgress, setSavedProgress] = useState({
    lastTimestamp: 0,
    totalTimeSpent: 0,
  });
  const [_showResumeBanner, _setShowResumeBanner] = useState(false);
  const containerRef = useRef(null);
  const controlsTimeout = useRef(null);
  const viewRecordedRef = useRef(false);
  const watchTimeSecondsRef = useRef(0);
  const throttleRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (
        (e.ctrlKey && (e.key === "s" || e.key === "u" || e.key === "p")) ||
        (e.ctrlKey &&
          e.shiftKey &&
          (e.key === "I" ||
            e.key === "i" ||
            e.key === "J" ||
            e.key === "j" ||
            e.key === "C" ||
            e.key === "c")) ||
        e.key === "F12"
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const isEncrypted = videoData?.isEncrypted || videoData?.fortspy || false;
  const encryptionType = videoData?.encryptionType || "AES-256-CTR";
  const hasFortSpy = !!videoData?.fortspyId;
  const videoId = videoData?.publicId || videoData?.id || videoData?._id;

  useEffect(() => {
    if (isOpen && videoId) {
      videoTelemetry.startSession({
        videoId,
        duration,
        initialOffset: savedProgress.lastTimestamp || 0,
        videoTitle: videoData?.title || "",
        userId: user?.id || null,
      });
    }
    return () => videoTelemetry.endSession();
  }, [
    isOpen,
    videoId,
    duration,
    savedProgress.lastTimestamp,
    videoData?.title,
    user?.id,
  ]);

  useEffect(() => {
    if (!isOpen || !videoId) return;
    viewRecordedRef.current = false;
    watchTimeSecondsRef.current = 0;
    const localKey = `video_progress_${videoId}`;
    let localData = null;
    try {
      const raw =
        typeof window !== "undefined" ? localStorage.getItem(localKey) : null;
      if (raw) localData = JSON.parse(raw);
    } catch {}
    if (localData && localData.lastTimestamp > 3) {
      setSavedProgress(localData);
      _setShowResumeBanner(true);
    }
    api
      .get(`/api/videos/${videoId}/progress`)
      .then((res) => {
        if (res.data?.success && res.data?.data) {
          const apiData = res.data.data;
          if (apiData.lastTimestamp > 3) {
            setSavedProgress((prev) => ({
              lastTimestamp: Math.max(
                prev.lastTimestamp || 0,
                apiData.lastTimestamp || 0,
              ),
              totalTimeSpent:
                (prev.totalTimeSpent || 0) + (apiData.totalTimeSpent || 0),
            }));
            _setShowResumeBanner(true);
          }
        }
      })
      .catch(() => {});
  }, [isOpen, videoId]);

  useEffect(() => {
    if (!isPlaying || !videoId) return;
    if (!viewRecordedRef.current) {
      viewRecordedRef.current = true;
      api.post(`/api/videos/${videoId}/view`).catch(() => {});
    }
  }, [isPlaying, videoId]);

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [isOpen]);

  const formatTime = (time) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleMouseMove = useCallback(() => {
    if (throttleRef.current) return;
    throttleRef.current = setTimeout(() => {
      throttleRef.current = null;
    }, 100);
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  }, [isPlaying]);

  const skip = useCallback((_seconds) => {
    // For FortSpy controls we don't have videoRef here; skip is handled via FortSpy if needed
    // This version is used for FortSpy UI buttons (video element not present)
    // No-op for FortSpy canvas; native player handles its own skip
  }, []);

  // FortSpy inline controls helpers (need local state for FortSpy canvas mode)
  const togglePlayFortSpy = useCallback(() => setIsPlaying((p) => !p), []);
  const toggleMute = useCallback(() => setIsMuted((m) => !m), []);
  const handleVolumeChange = useCallback((e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setIsMuted(newVol === 0);
  }, []);
  const changePlaybackRate = useCallback(
    (rate) => {
      videoTelemetry.trackRateChange(rate, currentTime);
      setPlaybackRate(rate);
      setShowSettings(false);
    },
    [currentTime],
  );
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

  if (!isOpen) return null;

  const overlayClass = inline
    ? "relative w-full"
    : "fixed inset-0 bg-black/95 z-[99999] flex items-center justify-center p-4";
  const overlayCenterClass = inline
    ? "relative w-full flex items-center justify-center"
    : "fixed inset-0 bg-black/95 z-[99999] flex items-center justify-center p-4";
  const innerBoxClass = inline
    ? "relative w-full bg-black overflow-hidden rounded-xl"
    : "relative w-full max-w-4xl bg-black overflow-hidden rounded-xl shadow-2xl";

  const embedInfo = getEmbedInfo(videoData?.url || videoData?.videoUrl || "");

  if (embedInfo && !hasFortSpy) {
    return (
      <div className={overlayClass}>
        <div
          className={innerBoxClass}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="flex items-center justify-between px-4 py-2 bg-black/90">
            <div className="min-w-0 flex-1 mr-3">
              <h3
                className="text-white font-semibold text-sm truncate"
                title={videoData?.title}
              >
                {videoData?.title}
              </h3>
              {videoData?.description && (
                <p
                  className="text-white/50 text-xs truncate"
                  title={videoData.description}
                >
                  {videoData.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full">
                <Shield
                  className="w-3 h-3 text-indigo-400"
                  aria-hidden="true"
                />
                <span className="text-indigo-400 text-[11px] font-medium capitalize">
                  {embedInfo.type} Stream
                </span>
              </div>
              {!videoData?.isPaid && !isEncrypted && (
                <a
                  href={videoData.url || videoData.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" aria-hidden="true" />
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                aria-label="Close video"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <DynamicWatermark user={user} />
            <iframe
              src={embedInfo.embedUrl}
              className="absolute inset-0 w-full h-full border-0"
              title={videoData?.title || "Video"}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    );
  }

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
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <DynamicWatermark user={user} />
            <FortSpyPlayer
              videoData={videoData}
              isPlaying={isPlaying}
              onPlayPause={() => setIsPlaying(!isPlaying)}
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
                onClick={togglePlayFortSpy}
                className="absolute inset-0 m-auto w-16 h-16 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-all z-10"
                aria-label="Play"
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
                    FortSpy
                  </span>
                </button>
              </div>
              <p className="text-white/80 text-xs drop-shadow-lg">
                {videoData?.description}
              </p>
              {showSecurityInfo && (
                <div className="absolute top-full left-0 mt-2 bg-gray-900 border border-emerald-500/30 rounded-lg p-3 shadow-xl max-w-xs">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock
                      className="w-4 h-4 text-emerald-400"
                      aria-hidden="true"
                    />
                    <span className="text-white text-xs font-semibold">
                      FortSpy Protection
                    </span>
                  </div>
                  <p className="text-white/70 text-xs leading-relaxed">
                    This video is encrypted at the pixel level using{" "}
                    {encryptionType}. Frames are decrypted in real-time during
                    playback for secure viewing.
                  </p>
                  <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                    <div className="flex items-center gap-1 text-emerald-400 text-xs">
                      <Info className="w-3 h-3" aria-hidden="true" />
                      <span>Content protected from screen capture</span>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-400 text-xs">
                      <Info className="w-3 h-3" aria-hidden="true" />
                      <span>End-to-end encrypted stream</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-4 pt-8 pb-3 transition-all ${showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            >
              <div className="w-full h-1 bg-white/30 rounded-full mb-3 cursor-pointer group">
                <div
                  className="h-full bg-emerald-400 rounded-full relative"
                  style={{
                    width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                  }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={togglePlayFortSpy}
                    className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                    aria-label={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? (
                      <Pause
                        className="w-5 h-5 text-white"
                        aria-hidden="true"
                      />
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
                    <SkipBack
                      className="w-4 h-4 text-white"
                      aria-hidden="true"
                    />
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
                  <div
                    className="ml-2 flex items-center gap-1 text-emerald-400"
                    title="FortSpy Encrypted"
                  >
                    <Shield className="w-3.5 h-3.5" aria-hidden="true" />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSettings(!showSettings)}
                      className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                      aria-label="Playback speed"
                    >
                      <Settings
                        className="w-4 h-4 text-white"
                        aria-hidden="true"
                      />
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
                      <Minimize
                        className="w-4 h-4 text-white"
                        aria-hidden="true"
                      />
                    ) : (
                      <Maximize
                        className="w-4 h-4 text-white"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!videoData?.url && !videoData?.videoUrl) {
    return (
      <div className={overlayCenterClass}>
        <div className="bg-gray-900 rounded-xl p-8 text-center max-w-sm w-full shadow-2xl">
          <div className="text-6xl mb-4" aria-hidden="true">
            🎬
          </div>
          <p className="text-white text-lg font-bold mb-2">
            {videoData?.title || "Video"}
          </p>
          <p className="text-white/50 text-sm mb-6">No video URL available</p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Native HTML5 video — delegated to extracted component (keeps telemetry wiring via props)
  return (
    <div className={overlayClass}>
      <NativePlayer
        videoData={videoData}
        user={user}
        onClose={onClose}
        isEncrypted={isEncrypted}
        encryptionType={encryptionType}
        showSecurityInfo={showSecurityInfo}
        setShowSecurityInfo={setShowSecurityInfo}
      />
    </div>
  );
}
