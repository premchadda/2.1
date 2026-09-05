import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Edit2,
  Search,
  X,
  ShieldAlert,
  AlertCircle,
  Info,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import Badge from "./Badge";
import {
  AUDIT_FILTER_TABS,
  AUDIT_ISSUE_SEVERITY,
  filterAuditedQuestions,
} from "./auditHelpers";

/**
 * AuditQuestionsView
 * Modular, dark-mode ready QA inspector for flagged and incomplete questions.
 */
export default function AuditQuestionsView({ questions = [], onEditQuestion }) {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Filtered questions based on active tab and search
  const filteredList = useMemo(() => {
    return filterAuditedQuestions(questions, activeTab, searchQuery);
  }, [questions, activeTab, searchQuery]);

  // Overall counts for summary breakdown
  const counts = useMemo(() => {
    let criticalCount = 0;
    let warningCount = 0;
    let infoCount = 0;

    questions.forEach((q) => {
      const issues = q.auditIssues || [];
      issues.forEach((i) => {
        if (i.severity === AUDIT_ISSUE_SEVERITY.DANGER) criticalCount++;
        else if (i.severity === AUDIT_ISSUE_SEVERITY.WARNING) warningCount++;
        else if (i.severity === AUDIT_ISSUE_SEVERITY.INFO) infoCount++;
      });
    });

    return {
      total: questions.length,
      critical: criticalCount,
      warning: warningCount,
      info: infoCount,
    };
  }, [questions]);

  // Tab-specific question counts
  const tabCounts = useMemo(() => {
    const map = {};
    AUDIT_FILTER_TABS.forEach((tab) => {
      map[tab.id] = filterAuditedQuestions(questions, tab.id, "").length;
    });
    return map;
  }, [questions]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-colors">
      {/* Header & Metric Overview */}
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-rose-50/60 via-amber-50/40 to-transparent dark:from-rose-950/20 dark:via-amber-950/10 dark:to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Question Audit & Quality Assurance
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                  {counts.total} Flagged
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Automated inspection for test-breaking issues, incomplete
                options, missing marking schemes, and duplicates.
              </p>
            </div>
          </div>

          {/* Quick Severity Counters */}
          <div className="flex items-center gap-2 flex-wrap">
            {counts.critical > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                <AlertCircle className="w-3.5 h-3.5" />
                {counts.critical} Critical
              </span>
            )}
            {counts.warning > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5" />
                {counts.warning} Warnings
              </span>
            )}
            {counts.info > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                <Info className="w-3.5 h-3.5" />
                {counts.info} Informational
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      {questions.length > 0 && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {AUDIT_FILTER_TABS.map((tab) => {
              const count = tabCounts[tab.id] ?? 0;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm font-semibold"
                      : "bg-white dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? "bg-white/20 text-white font-bold"
                        : "bg-gray-200/80 dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audit issues or questions..."
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {questions.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3.5">
            <CheckCircle className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            All Questions Look Good!
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            Zero incomplete or broken questions detected in the current
            category. Everything meets quality standards.
          </p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="p-10 text-center">
          <AlertCircle className="w-10 h-10 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            No questions match this filter
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Try choosing a different issue tab or clearing your search term.
          </p>
          {(activeTab !== "all" || searchQuery) && (
            <button
              onClick={() => {
                setActiveTab("all");
                setSearchQuery("");
              }}
              className="mt-3 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 transition-colors"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
          {filteredList.map((q) => {
            const issues = q.auditIssues || [];
            const qId = q.id || q._id;
            const qText = q.questionText || q.question_text || "";
            const testLabel = q.testName || q.test_name || q.testId || null;
            const seriesLabel = q.testSeriesName || q.seriesName || null;

            return (
              <div
                key={qId}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50/75 dark:hover:bg-gray-700/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  {/* Origin Metadata */}
                  {(testLabel || seriesLabel) && (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                      {seriesLabel && <span>{seriesLabel}</span>}
                      {seriesLabel && testLabel && <span>•</span>}
                      {testLabel && (
                        <span className="truncate">{testLabel}</span>
                      )}
                    </div>
                  )}

                  {/* Question Text */}
                  <p
                    className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2"
                    title={qText || "No Question Text"}
                  >
                    {qText || (
                      <span className="italic text-rose-500 dark:text-rose-400">
                        [No Question Text Provided]
                      </span>
                    )}
                  </p>

                  {/* Issue Badges */}
                  <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
                    {issues.map((issue) => {
                      let badgeVariant = "default";
                      if (issue.severity === AUDIT_ISSUE_SEVERITY.DANGER)
                        badgeVariant = "danger";
                      else if (issue.severity === AUDIT_ISSUE_SEVERITY.WARNING)
                        badgeVariant = "warning";
                      else if (issue.severity === AUDIT_ISSUE_SEVERITY.INFO)
                        badgeVariant = "info";

                      return (
                        <span key={issue.id} title={issue.description}>
                          <Badge variant={badgeVariant} size="xs" dot>
                            {issue.label}
                          </Badge>
                        </span>
                      );
                    })}

                    {/* Secondary helper info */}
                    {Array.isArray(q.options) && q.options.length > 0 && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-1">
                        ({q.options.length} options)
                      </span>
                    )}
                  </div>
                </div>

                {/* Edit Action Button */}
                <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => onEditQuestion(q)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-xs font-semibold transition-colors"
                    title="Open question editor to resolve issues"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit & Fix</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
