import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Pause,
  Play,
  Send,
  UserX,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Clock,
  Radio,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { apiClient } from "../../../shared/lib/apiClient";

const RISK_TIER_STYLES = {
  CRITICAL: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    border: "border-rose-300 dark:border-rose-800",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300",
    icon: AlertOctagon,
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  HIGH: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-300 dark:border-amber-800",
    badge:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300",
    icon: AlertTriangle,
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  MODERATE: {
    bg: "bg-yellow-50 dark:bg-yellow-950/40",
    border: "border-yellow-200 dark:border-yellow-800",
    badge:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300",
    icon: AlertTriangle,
    iconColor: "text-yellow-600 dark:text-yellow-400",
  },
  LOW: {
    bg: "bg-emerald-50/60 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800/60",
    badge:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300",
    icon: ShieldCheck,
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
};

export default function LiveProctoringConsole() {
  const { liveTestId: paramLiveTestId } = useParams();
  const [liveTestId, setLiveTestId] = useState(paramLiveTestId || "1");
  const [data, setData] = useState({
    candidates: [],
    summary: { low: 0, moderate: 0, high: 0, critical: 0 },
    totalCandidates: 0,
    highRiskCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("ALL");
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [interventionAction, setInterventionAction] = useState(null);
  const [interventionReason, setInterventionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCandidates = useCallback(async () => {
    if (!liveTestId) return;
    try {
      setLoading(true);
      const res = await apiClient.get(
        `/admin/live-tests/${liveTestId}/proctoring/candidates`,
      );
      const payload = res.data?.data || res.data || {};
      setData({
        candidates: payload.candidates || [],
        summary: payload.summary || {
          low: 0,
          moderate: 0,
          high: 0,
          critical: 0,
        },
        totalCandidates:
          payload.totalCandidates || payload.candidates?.length || 0,
        highRiskCount: payload.highRiskCount || 0,
      });
    } catch (err) {
      console.warn("[LiveProctoringConsole] Failed to load candidates:", err);
    } finally {
      setLoading(false);
    }
  }, [liveTestId]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchCandidates();
    }, 10_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchCandidates]);

  const handleExecuteIntervention = async () => {
    if (!selectedCandidate || !interventionAction) return;
    try {
      setActionLoading(true);
      await apiClient.post(
        `/admin/live-tests/${liveTestId}/proctoring/intervene`,
        {
          attemptId: selectedCandidate.attemptId,
          action: interventionAction,
          reason:
            interventionReason ||
            `Administrative intervention: ${interventionAction}`,
        },
      );
      toast.success(
        `Successfully executed ${interventionAction.replace("_", " ")} on Candidate #${selectedCandidate.candidateName || selectedCandidate.userId}`,
      );
      setSelectedCandidate(null);
      setInterventionAction(null);
      setInterventionReason("");
      fetchCandidates();
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
          err.message ||
          "Failed to execute intervention",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const filteredCandidates = (data.candidates || []).filter((c) => {
    const matchesSearch =
      !searchQuery ||
      c.candidateName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.candidateEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(c.attemptId).includes(searchQuery);

    const matchesTier = tierFilter === "ALL" || c.riskTier === tierFilter;

    return matchesSearch && matchesTier;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
            <Link
              to="/admin/tests"
              className="hover:text-indigo-600 transition flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Assessments
            </Link>
            <ChevronRight className="w-3 h-3 text-gray-400" />
            <span className="font-semibold text-gray-900 dark:text-white">
              Live Mock Proctoring Console
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              Live Test Integrity Cockpit
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 animate-pulse">
              <Radio className="w-3 h-3 text-rose-600 dark:text-rose-400" />
              LIVE
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-xl text-xs">
            <span className="text-gray-500 font-medium">Live Test ID:</span>
            <input
              type="text"
              value={liveTestId}
              onChange={(e) => setLiveTestId(e.target.value)}
              className="w-16 font-bold text-gray-900 dark:text-white bg-transparent outline-none"
            />
          </div>

          <button
            onClick={() => setAutoRefresh((v) => !v)}
            title={
              autoRefresh ? "Auto-refresh active (10s)" : "Auto-refresh paused"
            }
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
              autoRefresh
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300"
                : "bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
            }`}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${autoRefresh ? "animate-spin text-indigo-600" : ""}`}
            />
            <span>{autoRefresh ? "10s Poll" : "Paused"}</span>
          </button>

          <button
            onClick={fetchCandidates}
            disabled={loading}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs">
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
            Total Candidates
          </p>
          <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white mt-1">
            {data.totalCandidates}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Active exam sessions
          </p>
        </div>

        <div className="bg-rose-50/60 dark:bg-rose-950/20 p-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-rose-700 dark:text-rose-400">
              Critical Risk
            </p>
            <AlertOctagon className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-rose-700 dark:text-rose-300 mt-1">
            {data.summary.critical}
          </p>
          <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
            Immediate intervention
          </p>
        </div>

        <div className="bg-amber-50/60 dark:bg-amber-950/20 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
              High Risk
            </p>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-700 dark:text-amber-300 mt-1">
            {data.summary.high}
          </p>
          <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
            Multiple violations
          </p>
        </div>

        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
              Clean / Low Risk
            </p>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-300 mt-1">
            {data.summary.low}
          </p>
          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
            Normal telemetry
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search candidate name, email, or attempt ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-gray-900 dark:text-white"
          />
        </div>

        {/* Tier Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {["ALL", "CRITICAL", "HIGH", "MODERATE", "LOW"].map((tier) => (
            <button
              key={tier}
              onClick={() => setTierFilter(tier)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                tierFilter === tier
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* Candidate Grid */}
      {filteredCandidates.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 border border-gray-100 dark:border-gray-700 text-center space-y-2">
          <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            No candidates match active filters
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {data.totalCandidates === 0
              ? "No live sessions currently in progress for this test ID."
              : "Try adjusting your search query or tier filters."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCandidates.map((c) => {
            const tierConfig =
              RISK_TIER_STYLES[c.riskTier] || RISK_TIER_STYLES.LOW;
            const TierIcon = tierConfig.icon;

            return (
              <div
                key={c.attemptId}
                className={`p-4 rounded-2xl border ${tierConfig.border} ${tierConfig.bg} shadow-xs flex flex-col justify-between space-y-3 transition hover:shadow-md`}
              >
                <div>
                  {/* Card Header: Name + Risk Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className="font-extrabold text-sm text-gray-900 dark:text-white truncate"
                        title={c.candidateName}
                      >
                        {c.candidateName}
                      </p>
                      <p
                        className="text-[11px] text-gray-500 dark:text-gray-400 truncate"
                        title={c.candidateEmail}
                      >
                        {c.candidateEmail}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 ${tierConfig.badge}`}
                    >
                      <TierIcon className="w-3 h-3" />
                      {c.riskTier}
                    </span>
                  </div>

                  {/* Status & Telemetry Row */}
                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-black/5 dark:border-white/5 text-center">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400">
                        Status
                      </span>
                      <p
                        className={`text-xs font-black mt-0.5 ${
                          c.status === "PAUSED"
                            ? "text-amber-600 dark:text-amber-400"
                            : c.status === "SUBMITTED"
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {c.status}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-gray-400">
                        Timer
                      </span>
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mt-0.5 flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3 text-indigo-500" />
                        {Math.floor((c.remainingTimeSeconds || 0) / 60)}m
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-gray-400">
                        Violations
                      </span>
                      <p className="text-xs font-black text-rose-600 dark:text-rose-400 mt-0.5">
                        {c.incidentCount || 0}
                      </p>
                    </div>
                  </div>

                  {c.flagReason && (
                    <div className="mt-2.5 p-2 rounded-lg bg-rose-100/70 dark:bg-rose-900/40 text-[11px] text-rose-900 dark:text-rose-200 font-medium">
                      Flag: {c.flagReason}
                    </div>
                  )}
                </div>

                {/* Intervention Buttons */}
                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-black/5 dark:border-white/5">
                  <button
                    onClick={() => {
                      setSelectedCandidate(c);
                      setInterventionAction("warning_banner");
                      setInterventionReason(
                        "Multiple tab switches / DevTools detected",
                      );
                    }}
                    title="Send Warning Banner"
                    className="p-1.5 rounded-lg text-xs font-bold bg-white dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-gray-200 dark:border-gray-700 text-amber-700 dark:text-amber-300 transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Warn</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedCandidate(c);
                      setInterventionAction(
                        c.isExamPaused ? "resume_exam" : "pause_exam",
                      );
                      setInterventionReason(
                        c.isExamPaused
                          ? "Candidate identity verified"
                          : "Identity check / suspicious background audio",
                      );
                    }}
                    title={c.isExamPaused ? "Resume Exam" : "Pause Exam"}
                    className="p-1.5 rounded-lg text-xs font-bold bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-gray-200 dark:border-gray-700 text-indigo-700 dark:text-indigo-300 transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {c.isExamPaused ? (
                      <Play className="w-3.5 h-3.5" />
                    ) : (
                      <Pause className="w-3.5 h-3.5" />
                    )}
                    <span>{c.isExamPaused ? "Resume" : "Pause"}</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedCandidate(c);
                      setInterventionAction("force_submit");
                      setInterventionReason(
                        "Proctoring rule violation - exam terminated",
                      );
                    }}
                    title="Force Submit Exam"
                    className="p-1.5 rounded-lg text-xs font-bold bg-white dark:bg-gray-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-gray-200 dark:border-gray-700 text-rose-700 dark:text-rose-300 transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Submit</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Intervention Confirmation Modal */}
      {selectedCandidate && interventionAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                  Confirm Proctor Intervention
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedCandidate(null);
                  setInterventionAction(null);
                }}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 text-xs space-y-1">
              <p>
                <span className="font-bold text-gray-500">Candidate: </span>
                <span className="font-extrabold text-gray-900 dark:text-white">
                  {selectedCandidate.candidateName} (Attempt #
                  {selectedCandidate.attemptId})
                </span>
              </p>
              <p>
                <span className="font-bold text-gray-500">Action: </span>
                <span className="font-extrabold text-rose-600 dark:text-rose-400 uppercase">
                  {interventionAction.replace("_", " ")}
                </span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Intervention Reason / Proctor Note
              </label>
              <textarea
                rows={3}
                value={interventionReason}
                onChange={(e) => setInterventionReason(e.target.value)}
                placeholder="Specify reason for intervention (visible in audit logs)..."
                className="w-full p-2.5 text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-gray-900 dark:text-white resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setSelectedCandidate(null);
                  setInterventionAction(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteIntervention}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {actionLoading && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>Execute Intervention</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
