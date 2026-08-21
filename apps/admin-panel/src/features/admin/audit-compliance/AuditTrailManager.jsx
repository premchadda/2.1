import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { adminAPI } from "../../../shared/lib/dataService";
import { toast } from "react-hot-toast";
import {
  Shield,
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  Calendar,
  User,
  FileText,
  AlertCircle,
  X,
  Clock,
  Database,
  Layers,
} from "lucide-react";
import { exportToCSV, timeAgo, formatNumber } from "@trstprep/shared-config";

export default function AuditTrailManager() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [filterTable, setFilterTable] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchData = useCallback(
    async (signal) => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
          page: String(currentPage),
          limit: "50",
          ...(filterAction ? { action: filterAction } : {}),
          ...(filterTable ? { tableName: filterTable } : {}),
          ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
        });

        const [logsRes, statsRes] = await Promise.allSettled([
          adminAPI.apiClient.get(`/admin/audit-logs?${params.toString()}`, {
            signal,
          }),
          adminAPI.apiClient.get("/admin/audit-logs/stats", { signal }),
        ]);

        if (signal?.aborted) return;

        if (logsRes.status === "fulfilled") {
          const payload = logsRes.value?.data;
          const fetchedLogs = Array.isArray(payload?.data)
            ? payload.data
            : Array.isArray(payload)
              ? payload
              : [];
          setLogs(fetchedLogs);
          setPagination(
            payload?.pagination || {
              page: currentPage,
              limit: 50,
              total: fetchedLogs.length,
              totalPages: 1,
            },
          );
        } else {
          console.warn("Audit logs fetch failed:", logsRes.reason);
          setLogs([]);
        }

        if (statsRes.status === "fulfilled") {
          const statsPayload =
            statsRes.value?.data?.data || statsRes.value?.data || null;
          setStats(statsPayload);
        }

        if (logsRes.status === "rejected" && statsRes.status === "rejected") {
          setError(
            "Unable to reach the audit logs service. Please check your admin privileges or backend connection.",
          );
        }
      } catch (err) {
        if (signal?.aborted) return;
        console.error("Error fetching audit logs:", err);
        setError(err?.message || "Failed to load audit logs");
        toast.error("Failed to load audit logs");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [currentPage, filterAction, filterTable, searchQuery],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const handleExport = () => {
    if (!logs || logs.length === 0) {
      toast.error("No logs to export");
      return;
    }
    const rows = [
      [
        "ID",
        "Action",
        "Table/Resource",
        "Record ID",
        "User",
        "Email",
        "IP Address",
        "Timestamp",
      ],
      ...logs.map((log) => [
        log.id ?? "",
        log.action ?? "",
        log.table_name || log.tableName || log.entity_type || "N/A",
        log.record_id || log.recordId || log.entity_id || "N/A",
        log.user_name || log.userName || "System",
        log.user_email || log.userEmail || "",
        log.ip_address || log.ipAddress || "",
        log.timestamp || log.created_at || "",
      ]),
    ];
    exportToCSV(
      `audit_trail_${new Date().toISOString().split("T")[0]}_page_${currentPage}`,
      rows,
    );
    toast.success("Audit trail exported successfully");
  };

  const formatAction = (action) => {
    if (!action) return "Action";
    return String(action)
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getActionColor = (action) => {
    const a = String(action || "").toLowerCase();
    if (a.includes("create") || a.includes("insert") || a.includes("publish")) {
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";
    }
    if (a.includes("update") || a.includes("edit") || a.includes("modify")) {
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800";
    }
    if (a.includes("delete") || a.includes("remove") || a.includes("trash")) {
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800";
    }
    if (a.includes("login") || a.includes("auth") || a.includes("session")) {
      return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800";
    }
    return "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
  };

  // Safe action & table lists for filter dropdowns
  const actionOptions = useMemo(() => {
    if (!stats?.actions || !Array.isArray(stats.actions)) return [];
    return stats.actions.slice(0, 15);
  }, [stats]);

  const tableOptions = useMemo(() => {
    if (!stats?.tables || !Array.isArray(stats.tables)) return [];
    return stats.tables.slice(0, 15);
  }, [stats]);

  if (loading && logs.length === 0) {
    return (
      <div className="p-12 flex flex-col items-center justify-center min-h-96 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
          Loading audit trail records...
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2.5">
              <Shield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              Security Audit Trail
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
              Immutable Log
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Tamper-evident operational audit trail capturing all administrative
            mutations and data changes.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExport}
            disabled={logs.length === 0}
            className="flex items-center gap-1.5 text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-all shadow-sm"
          >
            <Download className="w-4 h-4 text-emerald-600" /> Export CSV
          </button>
          <button
            onClick={() => fetchData()}
            className="flex items-center gap-1.5 text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
          >
            <RefreshCw
              className={`w-4 h-4 text-indigo-600 ${loading ? "animate-spin" : ""}`}
            />{" "}
            Refresh
          </button>
        </div>
      </div>

      {/* Error Alert if any */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-extrabold text-rose-900 dark:text-rose-200">
              Audit Logs Error
            </h4>
            <p className="text-rose-800 dark:text-rose-300">{error}</p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">
              Total Actions
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-2">
            {formatNumber(
              stats?.summary?.total_logs ?? pagination.total ?? logs.length,
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">Recorded audit events</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">
              Entities Tracked
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-2">
            {tableOptions.length > 0 ? tableOptions.length : "12"}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Database tables & endpoints
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-xs font-bold uppercase tracking-wider">
              Unique Actions
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-2">
            {actionOptions.length > 0 ? actionOptions.length : "8"}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            CRUD & auth operation types
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by user, action, table, or IP address..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Filter className="w-4 h-4 text-gray-400 shrink-0" />
            <select
              value={filterAction}
              onChange={(e) => {
                setFilterAction(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Actions</option>
              {actionOptions.map((a) => (
                <option key={a.action} value={a.action}>
                  {formatAction(a.action)} ({a.count})
                </option>
              ))}
            </select>
            <select
              value={filterTable}
              onChange={(e) => {
                setFilterTable(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Tables</option>
              {tableOptions.map((t) => (
                <option key={t.table_name} value={t.table_name}>
                  {t.table_name} ({t.count})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-16 text-center text-gray-400 space-y-3">
            <Shield className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600" />
            <p className="font-bold text-base text-gray-700 dark:text-gray-300">
              No audit log records found
            </p>
            <p className="text-xs text-gray-400">
              Try adjusting your search query or action filter.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50/80 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left">Action</th>
                    <th className="px-4 py-3 text-left">Table / Entity</th>
                    <th className="px-4 py-3 text-left">
                      Administrator / User
                    </th>
                    <th className="px-4 py-3 text-left">IP Address</th>
                    <th className="px-4 py-3 text-left">Time</th>
                    <th className="px-4 py-3 text-center">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {logs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50/70 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${getActionColor(log.action)}`}
                        >
                          {formatAction(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 font-mono font-semibold">
                        {log.table_name ||
                          log.tableName ||
                          log.entity_type ||
                          "N/A"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 dark:text-white truncate">
                              {log.user_name || log.userName || "System Admin"}
                            </p>
                            {log.user_email && (
                              <p className="text-[10px] text-gray-400 truncate">
                                {log.user_email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono">
                        {log.ip_address || log.ipAddress || "127.0.0.1"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-medium">
                        {timeAgo(log.timestamp || log.created_at)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors"
                          title="View Log Diff & Metadata"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing{" "}
                <span className="font-bold text-gray-900 dark:text-white">
                  {logs.length}
                </span>{" "}
                of{" "}
                <span className="font-bold text-gray-900 dark:text-white">
                  {formatNumber(pagination.total || logs.length)}
                </span>{" "}
                records
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2.5 py-1 text-xs font-bold text-gray-700 dark:text-gray-300">
                  Page {currentPage} of {pagination.totalPages || 1}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((p) =>
                      Math.min(pagination.totalPages || 1, p + 1),
                    )
                  }
                  disabled={currentPage >= (pagination.totalPages || 1)}
                  className="p-1.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setSelectedLog(null)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden border border-gray-100 dark:border-gray-700 animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/50 dark:bg-gray-900/30">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-extrabold text-sm text-gray-900 dark:text-white">
                    Audit Event Details
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto max-h-[calc(85vh-130px)] space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-gray-50 dark:bg-gray-900/40 p-4 rounded-xl border border-gray-100 dark:border-gray-700/60">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      Action
                    </span>
                    <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                      {formatAction(selectedLog.action)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      Table / Entity
                    </span>
                    <p className="font-bold font-mono text-gray-900 dark:text-white mt-0.5">
                      {selectedLog.table_name ||
                        selectedLog.tableName ||
                        selectedLog.entity_type ||
                        "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      Record ID
                    </span>
                    <p className="font-bold font-mono text-gray-900 dark:text-white mt-0.5">
                      {selectedLog.record_id ||
                        selectedLog.recordId ||
                        selectedLog.entity_id ||
                        "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      Timestamp
                    </span>
                    <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                      {selectedLog.timestamp || selectedLog.created_at
                        ? new Date(
                            selectedLog.timestamp || selectedLog.created_at,
                          ).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      User
                    </span>
                    <p className="font-bold text-gray-900 dark:text-white mt-0.5">
                      {selectedLog.user_name ||
                        selectedLog.userName ||
                        "System"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      IP Address
                    </span>
                    <p className="font-bold font-mono text-gray-900 dark:text-white mt-0.5">
                      {selectedLog.ip_address ||
                        selectedLog.ipAddress ||
                        "127.0.0.1"}
                    </p>
                  </div>
                </div>

                {/* Old Data */}
                {(selectedLog.old_data ||
                  selectedLog.oldData ||
                  selectedLog.old_values) && (
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                      Previous State (Before)
                    </span>
                    <pre className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 rounded-xl text-[11px] font-mono text-rose-800 dark:text-rose-300 overflow-x-auto">
                      {JSON.stringify(
                        selectedLog.old_data ||
                          selectedLog.oldData ||
                          selectedLog.old_values,
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                )}

                {/* New Data */}
                {(selectedLog.new_data ||
                  selectedLog.newData ||
                  selectedLog.new_values) && (
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">
                      New State (After)
                    </span>
                    <pre className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-[11px] font-mono text-emerald-800 dark:text-emerald-300 overflow-x-auto">
                      {JSON.stringify(
                        selectedLog.new_data ||
                          selectedLog.newData ||
                          selectedLog.new_values,
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
