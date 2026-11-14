import { useState, useRef, useEffect } from "react";
import { logger } from "@trstprep/shared-config";
import { X, ExternalLink, Shield } from "lucide-react";
import api from "../../lib/api";
import { useAuth } from "../../providers/AuthContext";
import videoTelemetry from "../../lib/telemetry/videoTelemetry";
import DynamicWatermark from "./VideoPlayer/DynamicWatermark.jsx";
import { getEmbedInfo } from "./VideoPlayer/EmbedResolver.js";
import NativePlayer from "./VideoPlayer/NativePlayer.jsx";

// FortSpy player removed — standard HTML5 NativePlayer and YouTube/embed modes are canonical.

export default function VideoPlayer({
  isOpen,
  onClose,
  videoData,
  inline = false,
  forcePlayer = "auto",
}) {
  const { user } = useAuth();
  const [isPlaying, setIsPlaying] = useState(false);
  const [, setCurrentTime] = useState(0);
  const [duration, _setDuration] = useState(0);
  const [showSecurityInfo, setShowSecurityInfo] = useState(false);
  const [savedProgress, setSavedProgress] = useState({
    lastTimestamp: 0,
    totalTimeSpent: 0,
  });
  const [_showResumeBanner, _setShowResumeBanner] = useState(false);
  const overlayRef = useRef(null);
  const viewRecordedRef = useRef(false);
  const watchTimeSecondsRef = useRef(0);

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

  // Escape-to-close the full-screen overlay. Inline players are not overlays,
  // so they are skipped. No Tab trap: the player controls must stay reachable.
  useEffect(() => {
    if (!isOpen || inline) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleEsc);

    const prevFocused = document.activeElement;
    overlayRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", handleEsc);
      if (
        prevFocused &&
        typeof prevFocused.focus === "function" &&
        document.contains(prevFocused)
      ) {
        prevFocused.focus();
      }
    };
  }, [isOpen, inline, onClose]);

  const isEncrypted = videoData?.isEncrypted || false;
  const encryptionType = videoData?.encryptionType || "Standard";
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
      .catch((err) => {
        if (import.meta.env.DEV)
          logger.warn("[VideoPlayer] Failed to fetch server progress:", err);
      });
  }, [isOpen, videoId]);

  useEffect(() => {
    if (!isPlaying || !videoId) return;
    if (!viewRecordedRef.current) {
      viewRecordedRef.current = true;
      api.post(`/api/videos/${videoId}/view`).catch((err) => {
        if (import.meta.env.DEV)
          logger.warn("[VideoPlayer] Failed to record view event:", err);
      });
    }
  }, [isPlaying, videoId]);

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [isOpen]);

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

  // Dialog semantics only apply to the full-screen overlay — an inline player
  // is part of the page flow, not a modal.
  const overlayA11yProps = inline
    ? {}
    : {
        ref: overlayRef,
        tabIndex: -1,
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Video player",
      };

  const embedInfo = getEmbedInfo(videoData?.url || videoData?.videoUrl || "");

  // Player mode resolution: "auto" picks embed if embedInfo, otherwise native HTML5.
  const requested = (forcePlayer || "auto").toLowerCase();
  const resolvedMode =
    requested === "auto"
      ? embedInfo
        ? "embed"
        : "native"
      : requested === "youtube"
        ? "embed"
        : "native";

  if (resolvedMode === "embed" && !embedInfo) {
    return (
      <div className={overlayCenterClass} {...overlayA11yProps}>
        <div className="bg-gray-900 rounded-xl p-8 text-center max-w-sm w-full shadow-2xl">
          <p className="text-white text-sm font-medium mb-1">
            YouTube player requested
          </p>
          <p className="text-white/50 text-xs mb-6">
            This video URL is not an embeddable YouTube / Vimeo / Drive link.
            Switch back to Auto or Native.
          </p>
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

  if (resolvedMode === "embed" && embedInfo) {
    return (
      <div className={overlayClass} {...overlayA11yProps}>
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
              {!videoData?.isPaid &&
                !isEncrypted &&
                (() => {
                  const rawUrl = String(
                    videoData?.url || videoData?.videoUrl || "",
                  ).trim();
                  const isSafeUrl = /^https?:\/\//i.test(rawUrl);
                  return (
                    <a
                      href={isSafeUrl ? rawUrl : "#"}
                      target={isSafeUrl ? "_blank" : undefined}
                      rel={isSafeUrl ? "noopener noreferrer" : undefined}
                      className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                      title={
                        isSafeUrl ? "Open in new tab" : "Invalid video URL"
                      }
                      onClick={
                        isSafeUrl ? undefined : (e) => e.preventDefault()
                      }
                    >
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                    </a>
                  );
                })()}
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

  if (!videoData?.url && !videoData?.videoUrl) {
    return (
      <div className={overlayCenterClass} {...overlayA11yProps}>
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
    <div className={overlayClass} {...overlayA11yProps}>
      <div className={innerBoxClass}>
        {resolvedMode === "native" && embedInfo && (
          <p className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs">
            Native player forced on an embed URL — YouTube / Vimeo watch links
            need a direct .mp4 / HLS file to play here. Switch back to Auto if
            playback fails.
          </p>
        )}
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
    </div>
  );
}
