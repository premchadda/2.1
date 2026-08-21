import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  CreditCard,
  Search,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  ArrowRight,
  X,
} from "lucide-react";
import { adminAPI } from "../../../shared/lib/dataService.js";
import { toast } from "react-hot-toast";

const STATUS_STYLES = {
  success: "bg-green-100 dark:bg-green-900/30 text-green-700",
  failed: "bg-red-100 dark:bg-red-900/30 text-red-700",
  pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700",
  refunded: "bg-purple-100 dark:bg-purple-900/30 text-purple-700",
};

const STATUS_ICONS = {
  success: CheckCircle2,
  failed: XCircle,
  pending: Clock,
  refunded: RefreshCw,
};

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "success", label: "Success" },
  { value: "failed", label: "Failed" },
  { value: "pending", label: "Pending" },
  { value: "refunded", label: "Refunded" },
];

const formatCurrency = (amount, currency = "INR") => {
  const value = parseFloat(amount) || 0;
  const symbol = currency === "INR" ? "₹" : "";
  return `${symbol}${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const formatDate = (date) => {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function PaymentsManager() {
  const [transactions, setTransactions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [refundTarget, setRefundTarget] = useState(null);
  const [refunding, setRefunding] = useState(false);
  const debounceRef = useRef(null);

  const fetchTransactions = useCallback(
    async (pageToFetch, searchToUse, statusToUse) => {
      try {
        setLoading(true);
        const response = await adminAPI.getTransactions({
          page: pageToFetch,
          limit: 20,
          search: searchToUse || undefined,
          status: statusToUse || undefined,
        });
        const body = response.data || {};
        if (body.success) {
          setTransactions(body.data || []);
          setTotal(body.total || 0);
          setTotalPages(body.totalPages || 1);
        }
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
        toast.error("Failed to load transactions");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const fetchStats = useCallback(async () => {
    try {
      const response = await adminAPI.getPaymentStats();
      if (response.data?.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch payment stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchTransactions(1, "", "");
  }, [fetchStats, fetchTransactions]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchTransactions(1, search, statusFilter);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, statusFilter, fetchTransactions]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    fetchTransactions(newPage, search, statusFilter);
  };

  const handleRefund = async () => {
    if (!refundTarget) return;
    setRefunding(true);
    try {
      const refundId = refundTarget.id || refundTarget._id;
      const response = await adminAPI.refundPayment(refundId);
      if (response.data?.success) {
        toast.success("Payment refunded successfully");
        setRefundTarget(null);
        fetchStats();
        fetchTransactions(page, search, statusFilter);
      } else {
        toast.error(response.data?.message || "Refund failed");
      }
    } catch (error) {
      console.error("Refund failed:", error);
      toast.error(error.response?.data?.message || "Failed to process refund");
    } finally {
      setRefunding(false);
    }
  };

  const statCards = [
    {
      label: "Total Revenue",
      value: stats ? formatCurrency(stats.total_revenue) : "—",
      icon: CreditCard,
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    {
      label: "Successful",
      value: stats?.successful ?? 0,
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-900/20",
    },
    {
      label: "Failed",
      value: stats?.failed ?? 0,
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-50 dark:bg-red-900/20",
    },
    {
      label: "Refunded",
      value: stats?.refunded ?? 0,
      icon: RefreshCw,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      label: "Last 24h",
      value: stats?.last_24h ?? 0,
      icon: Clock,
      color: "text-amber-600",
      bg: "bg-amber-50 dark:bg-amber-900/20",
    },
  ];

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-indigo-600" />
            Payments Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Transaction monitoring & refunds
          </p>
        </div>
        <button
          onClick={() => {
            fetchStats();
            fetchTransactions(page, search, statusFilter);
          }}
          className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                {card.label}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {card.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by user, email, or gateway reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16">
            <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              No Transactions Found
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Try adjusting filters or search
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Gateway
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {transactions.map((txn) => {
                  const StatusIcon = STATUS_ICONS[txn.status] || Clock;
                  return (
                    <tr
                      key={txn.id || txn._id || txn.gatewayPaymentId}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {txn.userName || "Unknown"}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {txn.userEmail || `User #${txn.userId ?? "—"}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(txn.amount, txn.currency)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {txn.gateway || "—"}
                          </span>
                          {txn.gatewayPaymentId && (
                            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                              {txn.gatewayPaymentId}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[txn.status] || "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {txn.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(txn.createdAt)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        {txn.status === "success" ? (
                          <button
                            onClick={() => setRefundTarget(txn)}
                            className="px-3 py-1.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 rounded-lg hover:bg-red-200 transition"
                          >
                            Refund
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && transactions.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Showing <span className="font-medium">{transactions.length}</span>{" "}
              of <span className="font-medium">{total}</span> transactions
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <ArrowLeft className="w-4 h-4" />
                Prev
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {refundTarget &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-5 sm:p-6">
                <div className="flex justify-between items-center mb-5 border-b border-gray-100 dark:border-gray-700 pb-3">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-red-600" />
                    Confirm Refund
                  </h2>
                  <button
                    onClick={() => setRefundTarget(null)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                  Are you sure you want to refund this payment? This action will
                  mark the payment as refunded and cannot be undone from this
                  panel.
                </p>

                <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 space-y-2.5 mb-6 border border-gray-100 dark:border-gray-800 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      User
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {refundTarget.userName || "Unknown"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      Amount
                    </span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {formatCurrency(
                        refundTarget.amount,
                        refundTarget.currency,
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      Gateway
                    </span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {refundTarget.gateway || "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">
                      Reference
                    </span>
                    <span className="text-gray-700 dark:text-gray-300 font-mono text-xs">
                      {refundTarget.gatewayPaymentId || "—"}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setRefundTarget(null)}
                    disabled={refunding}
                    className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-sm font-semibold text-gray-700 dark:text-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRefund}
                    disabled={refunding}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 text-sm font-semibold shadow-md shadow-red-500/20 transition"
                  >
                    {refunding ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    {refunding ? "Processing..." : "Refund Payment"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
