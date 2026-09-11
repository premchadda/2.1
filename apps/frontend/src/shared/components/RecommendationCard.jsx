import { Link } from "react-router-dom";
import { ChevronRight, Info } from "lucide-react";
import PropTypes from "prop-types";

/**
 * RecommendationCard — renders a single study recommendation with its
 * data-backed rationale ("why this was recommended") surfaced to the student.
 *
 * The rationale string is expected to reference concrete performance data
 * (accuracy %, attempts, avg time) — produced by recommendationService.js
 * on the backend, or generateRecommendations() locally.
 */
export default function RecommendationCard({
  icon: Icon,
  title,
  message,
  reason,
  action,
  actionLabel = "Practice Now",
  severity = "medium",
  route,
}) {
  const severityStyles = {
    high: {
      wrapper:
        "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/60",
      iconBox: "bg-red-100 dark:bg-red-900/30",
      icon: "text-red-600 dark:text-red-400",
    },
    medium: {
      wrapper:
        "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800",
      iconBox: "bg-amber-100 dark:bg-amber-900/30",
      icon: "text-amber-600 dark:text-amber-400",
    },
    low: {
      wrapper:
        "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800",
      iconBox: "bg-emerald-100 dark:bg-emerald-900/30",
      icon: "text-emerald-600 dark:text-emerald-400",
    },
  };

  const style = severityStyles[severity] || severityStyles.medium;
  const rationale = reason || message;

  return (
    <div
      className={`p-4 rounded-xl border ${style.wrapper} h-full flex flex-col`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${style.iconBox}`}
        >
          {Icon && <Icon className={`w-5 h-5 ${style.icon}`} />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-0.5">
            {title}
          </h4>
          {rationale && (
            <div className="flex items-start gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">
                Why
              </span>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                {rationale}
              </p>
            </div>
          )}
        </div>
      </div>
      {action && (
        <Link
          to={route || action}
          className="mt-3 pt-3 border-t border-gray-200/60 dark:border-gray-700/60 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 self-start"
        >
          {actionLabel} <ChevronRight className="w-3 h-3" />
        </Link>
      )}
      {reason && message && reason !== message && (
        <div className="mt-2 pt-2 border-t border-gray-200/60 dark:border-gray-700/60 flex items-start gap-1.5">
          <Info className="w-3 h-3 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug">
            {message}
          </p>
        </div>
      )}
    </div>
  );
}

RecommendationCard.propTypes = {
  icon: PropTypes.elementType,
  title: PropTypes.string.isRequired,
  message: PropTypes.string,
  reason: PropTypes.string,
  action: PropTypes.string,
  actionLabel: PropTypes.string,
  severity: PropTypes.oneOf(["high", "medium", "low"]),
  route: PropTypes.string,
};
