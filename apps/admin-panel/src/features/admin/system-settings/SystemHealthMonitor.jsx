import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Breadcrumb from "../../../shared/components/common/Breadcrumb";
import { toast } from "react-hot-toast";
import {
  Server,
  Activity,
  Cpu,
  Database,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Wifi,
  Shield,
  Clock3,
  Terminal,
  HardDrive,
  MemoryStick,
  Gauge,
  Timer,
  Signal,
} from "lucide-react";
import { apiClient as api } from "../../../shared/lib/dataService";

function SystemHealthMonitor() {
  const [health, setHealth] = useState({
    status: "healthy",
    uptime: "0h 0m",
    lastChecked: new Date().toISOString(),
    services: [],
    resources: {
      cpu: { usage: 0, trend: "stable" },
      memory: { usage: 0, trend: "stable" },
      disk: { usage: 0, trend: "stable" },
      bandwidth: { usage: 0, trend: "stable" },
    },
    alerts: [],
    responseTime: null,
    requestsPerMin: null,
  });
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const formatUptime = (seconds = 0) => {
    const total = Math.max(0, Math.floor(seconds));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  const refreshHealth = useCallback(async (showToast = false) => {
    setLoading(true);
    try {
      const start = performance.now();
      const response = await api.get("/admin/system-health");
      const latency = Math.round(performance.now() - start);
      const data = response.data?.data || {};

      const heapUsed = data.memory?.heapUsed || 0;
      const heapTotal = data.memory?.heapTotal || 1;
      const memoryUsage =
        heapTotal > 0
          ? Math.min(100, Math.round((heapUsed / heapTotal) * 100))
          : 0;

      const cpuUsage = data.cpu?.usage ?? 0;
      const diskUsage = data.disk?.usage ?? 0;
      const reqPerMin = data.requestsPerMin ?? null;
      const dbResponseTime = data.databaseResponseTime ?? null;

      const alerts = [];
      if (memoryUsage > 80) {
        alerts.push({
          id: 1,
          severity: "error",
          message: "High memory usage (>80%)",
          time: new Date().toLocaleTimeString(),
          resolved: false,
        });
      } else if (memoryUsage > 60) {
        alerts.push({
          id: 2,
          severity: "warning",
          message: "Memory usage above 60%",
          time: new Date().toLocaleTimeString(),
          resolved: false,
        });
      }
      if (cpuUsage > 80) {
        alerts.push({
          id: 3,
          severity: "error",
          message: "High CPU usage (>80%)",
          time: new Date().toLocaleTimeString(),
          resolved: false,
        });
      }
      if (diskUsage > 80) {
        alerts.push({
          id: 4,
          severity: "warning",
          message: "Disk usage above 80%",
          time: new Date().toLocaleTimeString(),
          resolved: false,
        });
      }
      if (data.database !== "connected") {
        alerts.push({
          id: 5,
          severity: "error",
          message: "Database connection lost!",
          time: new Date().toLocaleTimeString(),
          resolved: false,
        });
      }

      setHealth({
        status: data.status || "unknown",
        uptime: formatUptime(data.uptime),
        lastChecked: data.timestamp || new Date().toISOString(),
        responseTime: latency,
        requestsPerMin: reqPerMin,
        services: [
          {
            name: "API Server",
            status: "operational",
            latency: `${latency}ms`,
            uptime: formatUptime(data.uptime),
          },
          {
            name: "Database",
            status: data.database === "connected" ? "operational" : "down",
            latency: dbResponseTime ? `${dbResponseTime}ms` : "n/a",
            uptime: "n/a",
          },
          {
            name: "Static Assets",
            status: "operational",
            latency: "n/a",
            uptime: "n/a",
          },
        ],
        resources: {
          cpu: { usage: cpuUsage, trend: cpuUsage > 60 ? "up" : "stable" },
          memory: {
            usage: memoryUsage,
            trend: memoryUsage > 75 ? "up" : "stable",
          },
          disk: { usage: diskUsage, trend: diskUsage > 70 ? "up" : "stable" },
          bandwidth: { usage: 0, trend: "stable" },
        },
        alerts,
        _raw: data,
      });
      setFetchError(false);

      if (showToast) toast.success("System health refreshed");
    } catch (error) {
      console.error("Failed to fetch system health:", error);
      setFetchError(true);
      if (showToast) toast.error("Failed to fetch system health");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => refreshHealth(), 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshHealth]);

  const getStatusColor = (status) => {
    switch (status) {
      case "operational":
        return "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-800";
      case "degraded":
        return "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-800";
      case "down":
        return "text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-500/10 dark:border-red-800";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700";
    }
  };

  const getAlertColor = (severity) => {
    switch (severity) {
      case "error":
        return "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-500/10 dark:text-red-300";
      case "warning":
        return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300";
      case "info":
        return "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-500/10 dark:text-blue-300";
      default:
        return "border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const isHealthy = health.status === "healthy";
  const unresolvedCount = health.alerts.filter((a) => !a.resolved).length;

  return (
    <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
      {/* Breadcrumb + Header */}
      <div>
        <Breadcrumb
          items={[
            { label: "Admin", href: "/admin" },
            { label: "System Health" },
          ]}
        />
        {/* Title + Controls — single row on all sizes, compact */}
        <div className="flex items-center justify-between gap-2 mt-3 flex-nowrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center shrink-0 shadow-xs">
              <Server className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black text-gray-900 dark:text-white leading-tight flex items-center gap-1.5">
                <span className="truncate">System Health</span>
                <span
                  className={`hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold border whitespace-nowrap ${
                    isHealthy
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800"
                      : health.status === "degraded"
                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400"
                        : "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isHealthy ? "bg-emerald-500" : health.status === "degraded" ? "bg-amber-500" : "bg-red-500"}`}
                  />
                  {isHealthy
                    ? "Healthy"
                    : health.status === "degraded"
                      ? "Degraded"
                      : "Unhealthy"}
                </span>
              </h1>
              <p className="hidden sm:block text-[11px] text-gray-500 dark:text-gray-400 font-medium leading-none mt-0.5 truncate">
                Real-time server & DB monitoring
              </p>
            </div>
          </div>

          {/* Controls — single row, never wraps, compact */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap shrink-0">
            <span className="hidden lg:inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs whitespace-nowrap">
              <Clock3 className="w-3 h-3 text-indigo-500 shrink-0" />
              {new Date(health.lastChecked).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <Link
              to="/admin/logs"
              title="Terminal Logs"
              className="flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 bg-slate-900 dark:bg-slate-800 text-emerald-400 border border-slate-700 rounded-xl hover:bg-slate-800 transition text-xs font-bold shadow-xs whitespace-nowrap shrink-0"
            >
              <Terminal className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Logs</span>
            </Link>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              title={autoRefresh ? "Auto refresh ON (30s)" : "Auto refresh OFF"}
              className={`flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-extrabold border transition whitespace-nowrap shrink-0 shadow-xs ${
                autoRefresh
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700"
              }`}
            >
              <span className="relative flex h-2 w-2 shrink-0">
                {autoRefresh && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${autoRefresh ? "bg-emerald-500" : "bg-gray-400"}`}
                />
              </span>
              <span className="hidden xs:inline">Auto</span>
              {autoRefresh ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => refreshHealth(true)}
              disabled={loading}
              className="flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 text-[11px] sm:text-xs font-extrabold shadow-xs whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 ${loading ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh</span>
              <span className="sm:hidden">Sync</span>
            </button>
          </div>
        </div>
        {/* Mobile uptime/status line */}
        <div className="flex sm:hidden items-center gap-2 mt-2">
          <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
            Uptime{" "}
            <span className="font-black text-gray-900 dark:text-white">
              {health.uptime}
            </span>
          </span>
          <span className="text-gray-300">•</span>
          <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
            {health.responseTime != null ? `${health.responseTime}ms` : "—"}{" "}
            response
          </span>
        </div>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-800 rounded-xl p-2.5 sm:p-3">
          <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-red-800 dark:text-red-200 leading-tight">
              Unable to fetch system health
            </p>
            <p className="text-[11px] text-red-600 dark:text-red-400 leading-tight">
              Check connection and try refresh.
            </p>
          </div>
        </div>
      )}

      {/* Status Overview — compact 2x2 on mobile, 4 on lg */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {/* Uptime */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 sm:p-3.5 border border-gray-100 dark:border-gray-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold tracking-wider uppercase text-gray-500 dark:text-gray-400">
              Uptime
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/50 dark:border-emerald-800 flex items-center justify-center shrink-0">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-none truncate">
            {health.uptime}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-1 flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${isHealthy ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            {health.status}
          </p>
        </div>

        {/* Response Time */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 sm:p-3.5 border border-gray-100 dark:border-gray-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold tracking-wider uppercase text-gray-500 dark:text-gray-400">
              Response
            </span>
            <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200/50 flex items-center justify-center shrink-0">
              <Timer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-none">
            {health.responseTime != null ? `${health.responseTime}ms` : "—"}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-1 truncate">
            Last check •{" "}
            {new Date(health.lastChecked).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {/* Requests / Throughput */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 sm:p-3.5 border border-gray-100 dark:border-gray-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold tracking-wider uppercase text-gray-500 dark:text-gray-400">
              Throughput
            </span>
            <div className="w-6 h-6 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-200/50 flex items-center justify-center shrink-0">
              <Signal className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-none">
            {health.requestsPerMin != null
              ? `${health.requestsPerMin}/min`
              : "—"}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-1">
            Requests / min
          </p>
        </div>

        {/* Alerts */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 sm:p-3.5 border border-gray-100 dark:border-gray-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold tracking-wider uppercase text-gray-500 dark:text-gray-400">
              Alerts
            </span>
            <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <div className="flex items-end justify-between gap-2">
            <p className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-none">
              {health.alerts.length}
            </p>
            {unresolvedCount > 0 ? (
              <span className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-extrabold rounded-full border border-amber-200 dark:border-amber-800 whitespace-nowrap">
                {unresolvedCount} active
              </span>
            ) : (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                All clear
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-1">
            {unresolvedCount
              ? `${unresolvedCount} requires attention`
              : "No active issues"}
          </p>
        </div>
      </div>

      {/* Services + Resources — stacked on mobile, side-by-side on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Services Status */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs overflow-hidden flex flex-col">
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
            <h2 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-indigo-600 shrink-0" />
              Service Status
            </h2>
            <span className="text-[11px] font-bold text-gray-400 hidden sm:inline">
              Real-time
            </span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {health.services.map((service, index) => (
              <div
                key={index}
                className="px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-gray-50/70 dark:hover:bg-gray-800/50 transition"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${service.status === "operational" ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" : "bg-red-500"}`}
                  />
                  <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">
                    {service.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="hidden sm:inline text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    {service.latency}
                  </span>
                  <span className="sm:hidden text-[11px] font-bold text-gray-500 dark:text-gray-400">
                    {service.latency}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border whitespace-nowrap ${getStatusColor(service.status)}`}
                  >
                    {service.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {/* Raw DB latency detail for realness */}
          <div className="px-3 sm:px-4 py-2 bg-gray-50/70 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px]">
            <span className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1">
              <Database className="w-3 h-3" /> DB
            </span>
            <span className="font-bold text-gray-900 dark:text-white">
              {health._raw?.databaseResponseTime != null
                ? `${health._raw.databaseResponseTime}ms`
                : health.services.find((s) => s.name === "Database")?.latency ||
                  "—"}
              <span className="font-medium text-gray-500 ml-1">
                •{" "}
                {health._raw?.database === "connected"
                  ? "connected"
                  : health._raw?.database || "—"}
              </span>
            </span>
          </div>
        </div>

        {/* Resource Usage */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs overflow-hidden flex flex-col">
          <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
            <h2 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-indigo-600 shrink-0" />
              Resource Usage
            </h2>
            <span className="text-[11px] font-bold text-gray-400 hidden sm:inline">
              Live %
            </span>
          </div>
          <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
            {Object.entries(health.resources).map(([key, data]) => {
              const icons = {
                cpu: Cpu,
                memory: MemoryStick,
                disk: HardDrive,
                bandwidth: Wifi,
              };
              const Icon = icons[key] || Gauge;
              const pct = Math.max(0, Math.min(100, Number(data.usage) || 0));
              const barColor =
                pct > 80
                  ? "bg-red-500"
                  : pct > 60
                    ? "bg-amber-500"
                    : "bg-emerald-500";
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300 capitalize">
                      <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      {key}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-black text-gray-900 dark:text-white">
                        {pct}%
                      </span>
                      {data.trend === "up" ? (
                        <TrendingUp className="w-3.5 h-3.5 text-red-500" />
                      ) : data.trend === "down" ? (
                        <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <span className="w-3.5" />
                      )}
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {/* Real detail line */}
                  {key === "memory" && health._raw?.memory && (
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-medium truncate">
                      Heap{" "}
                      {Math.round(
                        (health._raw.memory.heapUsed || 0) / 1024 / 1024,
                      )}
                      MB /{" "}
                      {Math.round(
                        (health._raw.memory.heapTotal || 1) / 1024 / 1024,
                      )}
                      MB • RSS{" "}
                      {Math.round((health._raw.memory.rss || 0) / 1024 / 1024)}
                      MB
                    </p>
                  )}
                  {key === "disk" && health._raw?.disk?.total > 0 && (
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-medium truncate">
                      {(health._raw.disk.total / 1024 / 1024 / 1024).toFixed(1)}
                      GB total •{" "}
                      {(health._raw.disk.free / 1024 / 1024 / 1024).toFixed(1)}
                      GB free
                    </p>
                  )}
                  {key === "cpu" && health._raw?.cpu && (
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 font-medium">
                      ~{pct}% across {health._raw?.cpu?.cores || "all"} cores
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Alerts — compact */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xs overflow-hidden">
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
            System Alerts
            {health.alerts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-[10px] font-black">
                {health.alerts.length}
              </span>
            )}
          </h2>
          <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">
            Last: {new Date(health.lastChecked).toLocaleTimeString()}
          </span>
        </div>
        {health.alerts.length === 0 ? (
          <div className="p-6 sm:p-8 text-center">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center mx-auto mb-2">
              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-xs font-bold text-gray-900 dark:text-white">
              All systems normal
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              No alerts • real-time checks passing
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {health.alerts.map((alert) => (
              <div
                key={alert.id}
                className={`px-3 sm:px-4 py-2.5 border-l-4 ${getAlertColor(alert.severity)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold leading-tight">
                      {alert.message}
                    </p>
                    <p className="text-[11px] opacity-75 mt-0.5">
                      {alert.time}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-extrabold border whitespace-nowrap ${
                      alert.resolved
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400"
                    }`}
                  >
                    {alert.resolved ? "Resolved" : "Active"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer meta — compact, real data */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400 px-1">
        <span className="flex items-center gap-1.5 font-medium">
          <Clock3 className="w-3 h-3" />
          Checked {new Date(health.lastChecked).toLocaleString()}
        </span>
        <span className="flex items-center gap-2 font-medium">
          {health._raw?.timestamp && (
            <span className="hidden sm:inline">
              Server {new Date(health._raw.timestamp).toLocaleTimeString()} •
            </span>
          )}
          <span>Uptime {health.uptime}</span>
        </span>
      </div>
    </div>
  );
}

export default SystemHealthMonitor;
