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

      // Deep profiling data from backend
      const cpuUsage = data.cpu?.usage || 0;
      const diskUsage = data.disk?.usage || 0;
      const reqPerMin = data.requestsPerMin || null;
      const dbResponseTime = data.databaseResponseTime || null;

      const alerts = [];
      if (memoryUsage > 80) {
        alerts.push({
          id: 1,
          severity: "error",
          message: "High memory usage detected (>80%)",
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
          message: "High CPU usage detected (>80%)",
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

  // Auto-refresh interval (30 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => refreshHealth(), 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshHealth]);

  const getStatusColor = (status) => {
    switch (status) {
      case "operational":
        return "text-green-600 bg-green-100";
      case "degraded":
        return "text-amber-600 bg-amber-100";
      case "down":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getAlertColor = (severity) => {
    switch (severity) {
      case "error":
        return "border-red-200 bg-red-50 text-red-800";
      case "warning":
        return "border-amber-200 bg-amber-50 text-amber-800";
      case "info":
        return "border-blue-200 bg-blue-50 text-blue-800";
      default:
        return "border-gray-200 bg-gray-50 text-gray-800";
    }
  };

  return (
    <div className="p-3 sm:p-4">
      <div className="mb-6">
        <Breadcrumb
          items={[
            { label: "Admin", href: "/admin" },
            { label: "System Health" },
          ]}
        />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Server className="w-7 h-7 text-indigo-600" />
              System Health Monitor
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Monitor server performance and service status
            </p>
          </div>
          <div className="flex items-center gap-3 mt-4 sm:mt-0">
            <Link
              to="/admin/logs"
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-800 text-emerald-400 border border-slate-700 rounded-lg hover:bg-slate-800 transition font-medium text-sm shadow-sm"
            >
              <Terminal className="w-4 h-4 text-emerald-400" />
              Terminal Logs
            </Link>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                autoRefresh
                  ? "bg-green-100 text-green-700 border border-green-300"
                  : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              <Clock3 className="w-4 h-4" />
              Auto {autoRefresh ? "ON" : "OFF"}
            </button>
            <button
              onClick={() => refreshHealth(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="mb-6 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">
              Unable to fetch system health
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">
              Check the server connection and try refreshing.
            </p>
          </div>
        </div>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <span
              className={`px-3 py-1 text-sm font-medium rounded-full ${
                health.status === "healthy"
                  ? "bg-green-100 text-green-700"
                  : health.status === "degraded"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              {health.status === "healthy"
                ? "Healthy"
                : health.status === "degraded"
                  ? "Degraded"
                  : "Unhealthy"}
            </span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {health.uptime}
          </p>
          <p className="text-sm text-gray-500 mt-1">System Uptime</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Wifi className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">Last check</span>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {health.responseTime != null ? `${health.responseTime}ms` : "N/A"}
          </p>
          <p className="text-sm text-gray-500 mt-1">Response Time</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Database className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {health.requestsPerMin != null
              ? `${health.requestsPerMin}/min`
              : "N/A"}
          </p>
          <p className="text-sm text-gray-500 mt-1">Requests/min</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            {health.alerts.filter((a) => !a.resolved).length > 0 && (
              <span className="px-3 py-1 bg-amber-100 text-amber-700 text-sm font-medium rounded-full animate-pulse">
                {health.alerts.filter((a) => !a.resolved).length} Active
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {health.alerts.length}
          </p>
          <p className="text-sm text-gray-500 mt-1">Active Alerts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Services Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600" />
              Service Status
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {health.services.map((service, index) => (
              <div
                key={index}
                className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${service.status === "operational" ? "bg-green-500" : "bg-red-500"}`}
                  ></div>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {service.name}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">{service.latency}</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(service.status)}`}
                  >
                    {service.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resource Usage */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              Resource Usage
            </h2>
          </div>
          <div className="p-6 space-y-6">
            {Object.entries(health.resources).map(([key, data]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {key}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {data.usage}%
                    </span>
                    {data.trend === "up" ? (
                      <TrendingUp className="w-4 h-4 text-red-500" />
                    ) : data.trend === "down" ? (
                      <TrendingDown className="w-4 h-4 text-green-500" />
                    ) : null}
                  </div>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      data.usage > 80
                        ? "bg-red-500"
                        : data.usage > 60
                          ? "bg-amber-500"
                          : "bg-green-500"
                    }`}
                    style={{ width: `${data.usage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600" />
            System Alerts
          </h2>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {health.alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 border-l-4 ${getAlertColor(alert.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{alert.message}</p>
                  <p className="text-sm opacity-75 mt-1">{alert.time}</p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    alert.resolved
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {alert.resolved ? "Resolved" : "Active"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SystemHealthMonitor;
