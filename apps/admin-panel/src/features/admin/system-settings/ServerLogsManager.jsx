import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { confirmOnce } from "../../../shared/components/common/ConfirmModal";
import {
  Terminal,
  Play,
  Pause,
  Trash2,
  Download,
  Copy,
  RefreshCw,
  Search,
  Check,
  AlertCircle,
  AlertTriangle,
  Info,
  Activity,
  Server,
  Cpu,
  Clock,
  ChevronDown,
  ChevronRight,
  ArrowDownToLine,
  Send,
  Zap,
  Globe,
  Sliders,
  X,
  Maximize2,
  Minimize2,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import { toast } from "react-hot-toast";
import Breadcrumb from "../../../shared/components/common/Breadcrumb";
import { apiClient as api } from "../../../shared/lib/dataService";
import { API_URL } from "../../../shared/lib/apiBase";

const MAX_DISPLAY_LOGS = 10000;

export default function ServerLogsManager() {
  const [logs, setLogs] = useState([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const [streamStatus, setStreamStatus] = useState("connecting"); // 'connected' | 'connecting' | 'paused' | 'error'
  const [selectedLevel, setSelectedLevel] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [timeFormat, setTimeFormat] = useState("local"); // 'local' | 'iso' | 'relative'
  const [expandedLogIds, setExpandedLogIds] = useState(new Set());
  const [serverStats, setServerStats] = useState(null);
  const [isClearingServer, setIsClearingServer] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customTestMsg, setCustomTestMsg] = useState("");
  const [testLogLevel, setTestLogLevel] = useState("info");
  const [showTestModal, setShowTestModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const terminalEndRef = useRef(null);
  const terminalContainerRef = useRef(null);
  const eventSourceRef = useRef(null);
  const isAutoScrollingRef = useRef(autoScroll);

  useEffect(() => {
    isAutoScrollingRef.current = autoScroll;
  }, [autoScroll]);

  // PWA: capture install prompt + detect standalone
  useEffect(() => {
    const checkStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      window.navigator.standalone === true ||
      document.referrer.includes("android-app://");
    setIsStandalone(checkStandalone);

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      toast.success("App installed — open from home screen");
    });
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  // Fullscreen: lock body scroll + ESC to exit
  useEffect(() => {
    if (isFullscreen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const onKey = (e) => {
        if (e.key === "Escape") setIsFullscreen(false);
      };
      window.addEventListener("keydown", onKey);
      return () => {
        document.body.style.overflow = prev;
        window.removeEventListener("keydown", onKey);
      };
    }
  }, [isFullscreen]);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted")
          toast.success("Installing — check home screen");
        setDeferredPrompt(null);
        setIsInstallable(false);
      } catch {
        // fallback to manual instructions
      }
      return;
    }
    // Fallback instructions (iOS / no prompt)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      toast("On iPhone: tap Share → Add to Home Screen to save Logs as app", {
        duration: 5000,
        icon: "📱",
      });
    } else {
      toast(
        "In Chrome menu: ⋮ → Add to Home screen / Install app to save Logs",
        { duration: 5000, icon: "📱" },
      );
    }
  };

  // Scroll to bottom when autoScroll is enabled
  const scrollToBottom = useCallback((smooth = true) => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    }
  }, []);

  // Detect when user manually scrolls up to pause auto-scroll
  const handleScroll = () => {
    if (!terminalContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      terminalContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    if (isAtBottom !== isAutoScrollingRef.current) {
      setAutoScroll(isAtBottom);
    }
  };

  // Initial Fetch of recent logs — pull up to 10k to honour new limit
  const fetchInitialLogs = useCallback(async () => {
    try {
      const res = await api.get("/admin/logs?limit=10000");
      if (res.data?.success) {
        setLogs(res.data.data || []);
        if (res.data.stats) {
          setServerStats(res.data.stats);
        }
      }
    } catch (err) {
      console.error("Failed to load initial logs:", err);
    }
  }, []);

  // Setup Server-Sent Events (SSE) Stream
  useEffect(() => {
    fetchInitialLogs();
  }, [fetchInitialLogs]);

  useEffect(() => {
    if (!isStreaming) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setStreamStatus("paused");
      return;
    }

    setStreamStatus("connecting");

    // Use centralized API_URL (handles VITE_API_URL with/without /api + Vite proxy in dev)
    // In dev with empty VITE_API_URL, API_URL="/api" -> "/api/admin/logs/stream" via proxy
    // In dev with VITE_API_URL=http://localhost:5001, API_URL="http://localhost:5001/api" -> correct
    const streamUrl = `${API_URL}/admin/logs/stream`;

    let es = null;
    try {
      es = new EventSource(streamUrl, { withCredentials: true });
      eventSourceRef.current = es;

      es.onopen = () => {
        setStreamStatus("connected");
      };

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "init") {
            if (Array.isArray(payload.logs)) {
              setLogs((prev) => {
                const map = new Map();
                prev.forEach((l) => map.set(l.id, l));
                payload.logs.forEach((l) => map.set(l.id, l));
                return Array.from(map.values()).slice(-MAX_DISPLAY_LOGS);
              });
            }
            if (payload.stats) setServerStats(payload.stats);
          } else if (payload.type === "log" && payload.data) {
            setLogs((prev) => {
              const updated = [...prev, payload.data];
              if (updated.length > MAX_DISPLAY_LOGS) {
                return updated.slice(updated.length - MAX_DISPLAY_LOGS);
              }
              return updated;
            });
          } else if (payload.type === "ping") {
            if (payload.stats) setServerStats(payload.stats);
          }
        } catch (err) {
          console.warn("Error parsing SSE event:", err);
        }
      };

      es.onerror = () => {
        setStreamStatus("error");
        // EventSource automatically handles reconnection
      };
    } catch (err) {
      console.error("SSE connection error:", err);
      setStreamStatus("error");
    }

    return () => {
      if (es) {
        es.close();
        eventSourceRef.current = null;
      }
    };
  }, [isStreaming]);

  // Trigger auto scroll whenever new logs arrive if autoScroll is enabled
  useEffect(() => {
    if (autoScroll) {
      scrollToBottom(false);
    }
  }, [logs, autoScroll, scrollToBottom]);

  // Toggle log JSON details expansion
  const toggleExpand = (id) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Level filter
      if (selectedLevel !== "ALL") {
        if (selectedLevel === "HTTP" && log.source !== "http") return false;
        if (
          selectedLevel !== "HTTP" &&
          log.level !== selectedLevel.toLowerCase()
        )
          return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchMsg = log.message && log.message.toLowerCase().includes(q);
        const matchSource = log.source && log.source.toLowerCase().includes(q);
        const matchLevel = log.level && log.level.toLowerCase().includes(q);
        const matchMeta =
          log.meta && JSON.stringify(log.meta).toLowerCase().includes(q);
        const matchDetails =
          log.details && JSON.stringify(log.details).toLowerCase().includes(q);
        return (
          matchMsg || matchSource || matchLevel || matchMeta || matchDetails
        );
      }

      return true;
    });
  }, [logs, selectedLevel, searchQuery]);

  // Count by level
  const counts = useMemo(() => {
    const res = {
      ALL: logs.length,
      ERROR: 0,
      WARN: 0,
      INFO: 0,
      HTTP: 0,
      DEBUG: 0,
    };
    logs.forEach((l) => {
      if (l.source === "http") res.HTTP += 1;
      const lvl = (l.level || "").toUpperCase();
      if (res[lvl] !== undefined) res[lvl] += 1;
    });
    return res;
  }, [logs]);

  // Clear in-memory local view
  const handleClearLocal = () => {
    setLogs([]);
    toast.success("Local terminal console cleared");
  };

  // Clear backend server log buffer
  const handleClearServer = async () => {
    const ok = await confirmOnce({
      title: "Clear server logs?",
      message: "Clear the backend server log buffer? This affects all admins.",
      danger: true,
      confirmLabel: "Clear",
    });
    if (!ok) return;
    try {
      setIsClearingServer(true);
      await api.delete("/admin/logs");
      setLogs([]);
      toast.success("Server log buffer cleared");
    } catch (err) {
      toast.error(
        "Failed to clear server log buffer: " +
          (err.response?.data?.message || err.message),
      );
    } finally {
      setIsClearingServer(false);
    }
  };

  // Send a test log
  const handleSendTestLog = async () => {
    try {
      const msg =
        customTestMsg.trim() ||
        "Manual test verification from live terminal console";
      await api.post("/admin/logs/test", {
        level: testLogLevel,
        message: msg,
      });
      toast.success(`Published ${testLogLevel.toUpperCase()} test log!`);
      setShowTestModal(false);
      setCustomTestMsg("");
    } catch (err) {
      toast.error(
        "Failed to publish test log: " +
          (err.response?.data?.message || err.message),
      );
    }
  };

  // Export logs download
  const handleExport = (format = "log") => {
    try {
      if (format === "json") {
        const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `server-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const text = filteredLogs
          .map(
            (l) =>
              `[${l.timestamp}] [${(l.level || "INFO").toUpperCase()}] [${l.source}]: ${l.message} ${
                l.meta ? JSON.stringify(l.meta) : ""
              }`,
          )
          .join("\n");
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `server-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.log`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success(`Exported ${filteredLogs.length} logs`);
    } catch {
      toast.error("Failed to export logs");
    }
  };

  // Copy visible logs to clipboard
  const handleCopyLogs = () => {
    try {
      const text = filteredLogs
        .map(
          (l) =>
            `[${l.timestamp}] [${(l.level || "INFO").toUpperCase()}] [${l.source}]: ${l.message}`,
        )
        .join("\n");
      navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`Copied ${filteredLogs.length} lines to clipboard`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy logs");
    }
  };

  // Format timestamp helper
  const formatTime = (ts) => {
    if (!ts) return "";
    if (timeFormat === "iso") return ts;
    if (timeFormat === "relative") {
      const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
      if (diff < 2) return "just now";
      if (diff < 60) return `${diff}s ago`;
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      return `${Math.floor(diff / 3600)}h ago`;
    }
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  };

  // Format uptime
  const formatUptime = (seconds = 0) => {
    const total = Math.max(0, Math.floor(seconds));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  // Helper for Level styles
  const getLevelStyle = (level, source) => {
    if (source === "http") {
      return {
        badge: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40",
        text: "text-cyan-300",
        glow: "text-cyan-400",
      };
    }
    switch (level?.toLowerCase()) {
      case "error":
        return {
          badge: "bg-red-500/20 text-red-400 border border-red-500/40",
          text: "text-red-300 font-medium",
          glow: "text-red-400",
        };
      case "warn":
        return {
          badge: "bg-amber-500/20 text-amber-400 border border-amber-500/40",
          text: "text-amber-300",
          glow: "text-amber-400",
        };
      case "debug":
        return {
          badge: "bg-purple-500/20 text-purple-400 border border-purple-500/40",
          text: "text-purple-300",
          glow: "text-purple-400",
        };
      default:
        return {
          badge:
            "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
          text: "text-emerald-300",
          glow: "text-emerald-400",
        };
    }
  };

  return (
    <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
      {/* Header — compact, responsive, single row on all sizes */}
      <div className="space-y-2">
        <Breadcrumb
          items={[
            { label: "System & Settings", path: "/admin/system-health" },
            { label: "Terminal Logs" },
          ]}
        />
        <div className="flex items-center justify-between gap-2 flex-nowrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900 text-emerald-400 border border-slate-800 shadow-xs flex items-center justify-center shrink-0">
              <Terminal className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black text-gray-900 dark:text-white leading-tight flex items-center gap-1.5 flex-wrap">
                <span className="truncate">Live Terminal</span>
                {streamStatus === "connected" && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE
                  </span>
                )}
                {streamStatus === "connecting" && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 whitespace-nowrap">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    CONNECTING
                  </span>
                )}
                {streamStatus === "paused" && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:text-gray-400 whitespace-nowrap">
                    PAUSED
                  </span>
                )}
                {streamStatus === "error" && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 whitespace-nowrap">
                    <AlertCircle className="w-3 h-3" />
                    RETRY
                  </span>
                )}
              </h1>
              <p className="hidden sm:block text-[11px] text-gray-500 dark:text-gray-400 font-medium leading-none mt-0.5 truncate">
                Real-time console • HTTP • DB • errors
              </p>
            </div>
          </div>

          {/* Global Actions — single row, horizontally scrollable on tiny screens */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap shrink-0 overflow-x-auto scrollbar-none">
            {/* Add to Home Screen — install as app to see logs directly */}
            {!isStandalone && (
              <button
                onClick={handleInstallApp}
                className={`inline-flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-extrabold border whitespace-nowrap shrink-0 shadow-xs transition-colors ${
                  isInstallable
                    ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
                    : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-700 hover:bg-gray-50"
                }`}
                title={
                  isInstallable
                    ? "Install Logs as app"
                    : "Save Logs to home screen"
                }
              >
                <Smartphone className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span className="hidden sm:inline">
                  {isInstallable ? "Install App" : "Save App"}
                </span>
                <span className="sm:hidden">Save</span>
              </button>
            )}
            {/* Pause / Resume — compact */}
            <button
              onClick={() => setIsStreaming(!isStreaming)}
              className={`inline-flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-extrabold border whitespace-nowrap shrink-0 shadow-xs transition-colors ${
                isStreaming
                  ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                  : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
              }`}
            >
              {isStreaming ? (
                <>
                  <Pause className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Pause</span>
                  <span className="sm:hidden">Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                  Resume
                </>
              )}
            </button>

            <button
              onClick={() => setShowTestModal(true)}
              className="inline-flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold bg-indigo-600 text-white border border-indigo-600 hover:bg-indigo-700 whitespace-nowrap shrink-0 shadow-xs"
            >
              <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="hidden sm:inline">Test Log</span>
              <span className="sm:hidden">Test</span>
            </button>

            <button
              onClick={handleCopyLogs}
              className="inline-flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 whitespace-nowrap shrink-0 shadow-xs"
            >
              {copied ? (
                <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              )}
              <span className="hidden sm:inline">
                {copied ? "Copied" : "Copy"}
              </span>
            </button>

            <button
              onClick={() => handleExport("log")}
              className="hidden sm:inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 whitespace-nowrap shrink-0 shadow-xs"
              title="Download .log"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              Export
            </button>
            <button
              onClick={() => handleExport("log")}
              className="sm:hidden inline-flex items-center justify-center p-1.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shrink-0 shadow-xs"
              title="Export"
            >
              <Download className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
            </button>

            <button
              onClick={handleClearLocal}
              className="inline-flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-bold bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 whitespace-nowrap shrink-0 shadow-xs"
              title="Clear view"
            >
              <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400 shrink-0" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        </div>
      </div>

      {/* Install banner — visible on mobile when PWA installable, one-tap save */}
      {!isStandalone && (
        <div className="flex sm:hidden items-center justify-between gap-2 px-3 py-2 bg-indigo-600 text-white rounded-xl shadow-md">
          <span className="flex items-center gap-1.5 text-xs font-bold">
            <Smartphone className="w-4 h-4" /> Save Logs page as app
          </span>
          <button
            onClick={handleInstallApp}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white text-indigo-600 text-xs font-extrabold"
          >
            {isInstallable ? "Install" : "Add"}{" "}
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}
      {isStandalone && (
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400">
          <Check className="w-3.5 h-3.5" /> App mode — Logs open directly. Use
          Fullscreen for bottom dock.
        </div>
      )}

      {/* Live Server Stats Strip */}
      {serverStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 bg-slate-900/90 text-slate-200 border border-slate-800 rounded-xl p-3 text-xs shadow-md">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                Server Uptime
              </div>
              <div className="font-semibold text-white">
                {formatUptime(serverStats.uptimeSeconds)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                Memory (Heap)
              </div>
              <div className="font-semibold text-white">
                {serverStats.memory?.heapUsedMb || 0} /{" "}
                {serverStats.memory?.heapTotalMb || 0} MB
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-indigo-400" />
            <div>
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                Memory (RSS)
              </div>
              <div className="font-semibold text-white">
                {serverStats.memory?.rssMb || 0} MB
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                Environment
              </div>
              <div className="font-semibold text-white capitalize">
                {serverStats.environment || "production"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            <div>
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                Buffered Logs
              </div>
              <div className="font-semibold text-white">
                {logs.length} / {serverStats.maxBufferSize || 2500}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                Active Admins
              </div>
              <div className="font-semibold text-white">
                {serverStats.activeSSEClients || 1} connected
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar — compact, responsive, full filter options */}
      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-2 sm:p-2.5 shadow-sm space-y-2">
        {/* Row 1: Level badges — horizontally scrollable on mobile, never wraps to keep 1-line */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-nowrap pb-0.5 -mx-1 px-1">
          {["ALL", "ERROR", "WARN", "INFO", "HTTP", "DEBUG"].map((lvl) => {
            const count = counts[lvl] || 0;
            const isActive = selectedLevel === lvl;
            return (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={`shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? lvl === "ERROR"
                      ? "bg-red-600 text-white shadow-sm"
                      : lvl === "WARN"
                        ? "bg-amber-600 text-white shadow-sm"
                        : lvl === "HTTP"
                          ? "bg-cyan-600 text-white shadow-sm"
                          : "bg-slate-900 text-white dark:bg-indigo-600 shadow-sm"
                    : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
                }`}
              >
                <span>{lvl}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono leading-none ${
                    isActive
                      ? "bg-black/30 text-white"
                      : "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
          {/* Quick error finder */}
          <button
            onClick={() => {
              setSelectedLevel("ERROR");
              setSearchQuery("");
            }}
            title="Show only errors"
            className="shrink-0 ml-1 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 text-[11px] font-bold hover:bg-red-100 dark:hover:bg-red-500/20 whitespace-nowrap"
          >
            <AlertTriangle className="w-3 h-3" /> Errors
          </button>
        </div>

        {/* Row 2: Search + explicit filter selects — single row on desktop, stacked compact on mobile */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search errors, stacks, routes, IPs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Explicit filter controls */}
          <div className="flex items-center gap-1.5 flex-nowrap shrink-0 overflow-x-auto scrollbar-none">
            <div className="relative shrink-0">
              <Sliders className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="pl-6 pr-7 py-1.5 text-xs font-bold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 whitespace-nowrap"
                title="Filter by level"
              >
                <option value="ALL">All levels</option>
                <option value="ERROR">Error only</option>
                <option value="WARN">Warning</option>
                <option value="INFO">Info</option>
                <option value="HTTP">HTTP</option>
                <option value="DEBUG">Debug</option>
              </select>
            </div>
            <button
              onClick={() =>
                setTimeFormat((prev) =>
                  prev === "local"
                    ? "iso"
                    : prev === "iso"
                      ? "relative"
                      : "local",
                )
              }
              className="shrink-0 px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 whitespace-nowrap"
              title="Toggle timestamp format"
            >
              {timeFormat.toUpperCase()}
            </button>
            <button
              onClick={() => {
                const next = !autoScroll;
                setAutoScroll(next);
                if (next) scrollToBottom();
              }}
              className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg border whitespace-nowrap transition-colors ${
                autoScroll
                  ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
                  : "bg-white dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700"
              }`}
              title="Lock scroll to latest"
            >
              <ArrowDownToLine
                className={`w-3.5 h-3.5 ${autoScroll ? "animate-bounce" : ""}`}
              />
              <span className="hidden lg:inline">Auto</span>
            </button>
            {(selectedLevel !== "ALL" || searchQuery) && (
              <button
                onClick={() => {
                  setSelectedLevel("ALL");
                  setSearchQuery("");
                }}
                className="shrink-0 px-2 py-1.5 text-xs font-bold rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Active filter summary — compact */}
        {(selectedLevel !== "ALL" || searchQuery) && (
          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            <span className="text-gray-500 dark:text-gray-400 font-medium">
              Filters:
            </span>
            {selectedLevel !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 dark:bg-indigo-600 text-white font-bold">
                Level: {selectedLevel}
                <button
                  onClick={() => setSelectedLevel("ALL")}
                  className="ml-0.5 hover:text-gray-300"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold max-w-[200px] truncate">
                Search: “{searchQuery}”
                <button onClick={() => setSearchQuery("")} className="shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <span className="text-gray-400">
              • {filteredLogs.length} matches
            </span>
          </div>
        )}
      </div>

      {/* Terminal Display View — compact & responsive, fullscreen bottom dock */}
      <div
        className={`relative overflow-hidden border border-slate-800 bg-[#0a0e17] shadow-2xl flex flex-col ${
          isFullscreen ? "fixed inset-0 z-[70] rounded-none" : "rounded-xl"
        }`}
      >
        {/* Terminal Title Bar — compact on mobile */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-[#0e1422] border-b border-slate-800 text-[11px] sm:text-xs shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500/80 shrink-0" />
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-amber-500/80 shrink-0" />
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500/80 shrink-0" />
            <span className="text-slate-400 font-mono ml-1 sm:ml-2 font-medium truncate hidden sm:inline">
              bash - production@trstprep-backend:~
            </span>
            <span className="text-slate-400 font-mono ml-1 font-medium truncate sm:hidden">
              bash ~
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold whitespace-nowrap">
              {filteredLogs.length.toLocaleString()} logs
            </span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 text-slate-400 font-mono text-[10px] sm:text-[11px] shrink-0">
            <span className="sm:hidden whitespace-nowrap">
              {filteredLogs.length}
            </span>
            {!autoScroll && (
              <button
                onClick={() => {
                  setAutoScroll(true);
                  scrollToBottom();
                }}
                className="hidden sm:inline-flex text-indigo-400 hover:text-indigo-300 underline items-center gap-1 whitespace-nowrap"
              >
                <ArrowDownToLine className="w-3 h-3 shrink-0" />
                Bottom
              </button>
            )}
            <button
              onClick={() => setIsFullscreen((v) => !v)}
              className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold whitespace-nowrap shrink-0"
              title={
                isFullscreen
                  ? "Exit fullscreen (Esc)"
                  : "Fullscreen — bottom dock"
              }
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className="hidden sm:inline">Exit</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className="hidden sm:inline">Fullscreen</span>
                  <span className="sm:hidden">Full</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Terminal Log Stream Scroll Area — responsive height / fullscreen flex */}
        <div
          ref={terminalContainerRef}
          onScroll={handleScroll}
          className={`overflow-y-auto p-2 sm:p-3 font-mono text-[11px] sm:text-xs text-slate-300 space-y-0.5 sm:space-y-1 select-text scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent ${
            isFullscreen
              ? "flex-1 min-h-0"
              : "h-[380px] sm:h-[480px] lg:h-[560px]"
          }`}
          style={{
            fontFamily: "'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
          }}
        >
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2">
              <Terminal className="w-10 h-10 text-slate-600 animate-pulse" />
              <p>
                No log entries match your current filter or stream is waiting
                for server events...
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-xs text-indigo-400 hover:underline"
                >
                  Clear search query
                </button>
              )}
            </div>
          ) : (
            filteredLogs.map((log) => {
              const styles = getLevelStyle(log.level, log.source);
              const isExpanded = expandedLogIds.has(log.id);
              const hasMetaOrDetails =
                (log.meta && Object.keys(log.meta).length > 0) || log.details;

              return (
                <div
                  key={log.id}
                  className={`group rounded px-2 py-1 transition-colors hover:bg-slate-800/60 border border-transparent ${
                    log.level === "error"
                      ? "bg-red-950/20 hover:border-red-900/40"
                      : ""
                  }`}
                >
                  <div
                    onClick={() => hasMetaOrDetails && toggleExpand(log.id)}
                    className={`flex items-start gap-2 ${hasMetaOrDetails ? "cursor-pointer" : ""}`}
                  >
                    {/* Timestamp */}
                    <span className="text-slate-500 shrink-0 select-none text-[11px]">
                      {formatTime(log.timestamp)}
                    </span>

                    {/* Level Badge */}
                    <span
                      className={`px-1.5 py-0.2 text-[10px] uppercase font-bold rounded shrink-0 ${styles.badge}`}
                    >
                      {log.source === "http" ? "HTTP" : log.level}
                    </span>

                    {/* Source tag */}
                    <span className="text-slate-400 shrink-0 text-[11px] opacity-75">
                      [{log.source || "app"}]
                    </span>

                    {/* Log Message */}
                    <span className={`flex-1 break-all ${styles.text}`}>
                      {log.message}
                    </span>

                    {/* Expand icon if details exist */}
                    {hasMetaOrDetails && (
                      <span className="shrink-0 text-slate-500 group-hover:text-slate-300">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </span>
                    )}
                  </div>

                  {/* Expanded JSON Inspector */}
                  {isExpanded && hasMetaOrDetails && (
                    <div className="mt-1.5 ml-6 p-2.5 rounded bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 overflow-x-auto space-y-1">
                      {log.meta && (
                        <div>
                          <div className="text-slate-400 font-semibold mb-1 text-[10px] uppercase">
                            Metadata:
                          </div>
                          <pre className="text-emerald-400 leading-tight">
                            {JSON.stringify(log.meta, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.details && (
                        <div>
                          <div className="text-slate-400 font-semibold mb-1 text-[10px] uppercase">
                            Details / Stack:
                          </div>
                          <pre className="text-amber-300 leading-tight">
                            {typeof log.details === "string"
                              ? log.details
                              : JSON.stringify(log.details, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Bottom bar — bash ~ • 99 logs — full-screen bottom dock */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-[#0e1422] border-t border-slate-800 text-[11px] font-mono shrink-0">
          <span className="flex items-center gap-1.5 text-emerald-400 font-bold truncate">
            <Terminal className="w-3 h-3 shrink-0" />
            bash ~
            <span className="text-slate-400 font-normal hidden sm:inline ml-1">
              production@trstprep
            </span>
          </span>
          <span className="flex items-center gap-2 text-slate-400 shrink-0 whitespace-nowrap">
            <span className="hidden sm:inline">
              {filteredLogs.length.toLocaleString()} /{" "}
              {MAX_DISPLAY_LOGS.toLocaleString()} logs
            </span>
            <span className="sm:hidden">{filteredLogs.length} logs</span>
            <span className="hidden sm:inline w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline text-emerald-400 font-bold">
              {isFullscreen ? "FULLSCREEN" : "BOTTOM"}
            </span>
            {!isFullscreen && (
              <button
                onClick={() => setIsFullscreen(true)}
                className="sm:hidden inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold"
              >
                <Maximize2 className="w-3 h-3" /> Full
              </button>
            )}
          </span>
        </div>
      </div>

      {/* Test Log Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-500" />
                Publish Live Test Log
              </h3>
              <button
                onClick={() => setShowTestModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Log Level
              </label>
              <div className="grid grid-cols-4 gap-2">
                {["info", "warn", "error", "debug"].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setTestLogLevel(lvl)}
                    className={`py-1.5 text-xs font-semibold uppercase rounded-lg border transition-all ${
                      testLogLevel === lvl
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Custom Message (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Enter log message to emit..."
                value={customTestMsg}
                onChange={(e) => setCustomTestMsg(e.target.value)}
                className="w-full text-xs p-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTestModal(false)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendTestLog}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-colors flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Publish to Terminal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
