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
} from "lucide-react";
import { toast } from "react-hot-toast";
import Breadcrumb from "../../../shared/components/common/Breadcrumb";
import { apiClient as api } from "../../../shared/lib/dataService";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV ? "http://localhost:5001/api" : "/api");

const MAX_DISPLAY_LOGS = 2000;

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

  const terminalEndRef = useRef(null);
  const terminalContainerRef = useRef(null);
  const eventSourceRef = useRef(null);
  const isAutoScrollingRef = useRef(autoScroll);

  useEffect(() => {
    isAutoScrollingRef.current = autoScroll;
  }, [autoScroll]);

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

  // Initial Fetch of recent logs
  const fetchInitialLogs = useCallback(async () => {
    try {
      const res = await api.get("/admin/logs?limit=300");
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

    // EventSource uses httpOnly cookies (withCredentials) — never put token in URL
    const streamUrl = `${API_BASE_URL}/admin/logs/stream`;

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <Breadcrumb
            items={[
              { label: "System & Settings", path: "/admin/system-health" },
              { label: "Terminal Logs" },
            ]}
          />
          <div className="flex items-center gap-3 mt-1">
            <div className="p-2 bg-slate-900 text-emerald-400 rounded-lg border border-slate-800 shadow-sm flex items-center justify-center">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Live Backend Terminal Console
                {/* Live Stream Pulse Badge */}
                {streamStatus === "connected" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    LIVE STREAM
                  </span>
                )}
                {streamStatus === "connecting" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    CONNECTING
                  </span>
                )}
                {streamStatus === "paused" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-500/15 text-gray-400 border border-gray-500/30">
                    PAUSED
                  </span>
                )}
                {streamStatus === "error" && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-500 border border-red-500/30">
                    <AlertCircle className="w-3 h-3" />
                    RECONNECTING
                  </span>
                )}
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Real-time server console output, HTTP access events, database
                logs, and errors from live production
              </p>
            </div>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Pause / Resume Button */}
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors shadow-sm ${
              isStreaming
                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 hover:bg-amber-100"
                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
            }`}
          >
            {isStreaming ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                Pause Stream
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Resume Stream
              </>
            )}
          </button>

          {/* Test Log Modal Button */}
          <button
            onClick={() => setShowTestModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors shadow-sm"
          >
            <Zap className="w-3.5 h-3.5" />
            Send Test Log
          </button>

          {/* Copy Logs */}
          <button
            onClick={handleCopyLogs}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>

          {/* Export Dropdown / Button */}
          <button
            onClick={() => handleExport("log")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            title="Download formatted .log file"
          >
            <Download className="w-3.5 h-3.5" />
            Export (.log)
          </button>

          {/* Clear Actions */}
          <button
            onClick={handleClearLocal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
            title="Clear current view"
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-400" />
            Clear View
          </button>
        </div>
      </div>

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

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-2.5 shadow-sm">
        {/* Level Badges */}
        <div className="flex items-center flex-wrap gap-1.5">
          {["ALL", "ERROR", "WARN", "INFO", "HTTP", "DEBUG"].map((lvl) => {
            const count = counts[lvl] || 0;
            const isActive = selectedLevel === lvl;
            return (
              <button
                key={lvl}
                onClick={() => setSelectedLevel(lvl)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
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
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
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
        </div>

        {/* Search Input & Controls */}
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs, IPs, routes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Time format selector */}
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
            className="px-2.5 py-1 text-xs font-mono rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-200 transition-colors"
            title="Toggle timestamp format"
          >
            {timeFormat.toUpperCase()}
          </button>

          {/* Auto-Scroll Toggle */}
          <button
            onClick={() => {
              const next = !autoScroll;
              setAutoScroll(next);
              if (next) scrollToBottom();
            }}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
              autoScroll
                ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700"
                : "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-slate-700 hover:bg-gray-200"
            }`}
            title="Lock scroll to latest log"
          >
            <ArrowDownToLine
              className={`w-3.5 h-3.5 ${autoScroll ? "animate-bounce" : ""}`}
            />
            <span className="hidden md:inline">Auto-Scroll</span>
          </button>
        </div>
      </div>

      {/* Terminal Display View */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-[#0a0e17] shadow-2xl">
        {/* Terminal Title Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#0e1422] border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
            <span className="text-slate-400 font-mono ml-2 font-medium">
              bash - production@trstprep-backend:~
            </span>
          </div>
          <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
            <span>Showing {filteredLogs.length} logs</span>
            {!autoScroll && (
              <button
                onClick={() => {
                  setAutoScroll(true);
                  scrollToBottom();
                }}
                className="text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1"
              >
                <ArrowDownToLine className="w-3 h-3" />
                Jump to bottom
              </button>
            )}
          </div>
        </div>

        {/* Terminal Log Stream Scroll Area */}
        <div
          ref={terminalContainerRef}
          onScroll={handleScroll}
          className="h-[560px] overflow-y-auto p-3 font-mono text-xs text-slate-300 space-y-1 select-text scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
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
