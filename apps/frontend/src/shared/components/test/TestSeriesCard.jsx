import { Link } from "react-router-dom";
import { ChevronRight, Plus, Crown } from "lucide-react";
import { useState } from "react";
import { isSeriesEnrolled } from "../../lib/enrollment.js";
import { getCategoryEmoji } from "../../../assets/config/emoji.js";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import ProgressRing from "../ui/ProgressRing.jsx";

function TestSeriesCard({
  series,
  user,
  showProgress = false,
  onEnroll,
  showCategories = true,
  className = "",
}) {
  const {
    _id,
    id,
    slug,
    title,
    category,
    categoryName,
    examName,
    stageName,
    stageNames,
    totalTests,
    freeTests,
    users,
    isPro,
    isComingSoon,
    testTypes = [],
    attemptedTests = 0,
    testCounts = {},
    languages = ["Eng", "Hin"],
  } = series;

  const seriesId = slug || id || _id;
  const enrolledSeries = user?.enrolledSeries || [];
  const isEnrolled = isSeriesEnrolled(enrolledSeries, series);
  const hasProPass = Boolean(
    user?.hasProPass ||
    user?.isProUser ||
    user?.isPro ||
    user?.is_pro ||
    user?.role === "admin" ||
    (user?.passType && user.passType !== "free"),
  );
  const hasFreeTests = freeTests > 0;
  const isSeriesPro = Boolean(
    isPro === true ||
    series.is_pro === true ||
    (freeTests === 0 && totalTests > 0),
  );
  const requiresPro =
    (isSeriesPro && !hasFreeTests) || (freeTests === 0 && totalTests > 0);

  const [expanded, setExpanded] = useState(false);
  const progressPercentage =
    showProgress && totalTests > 0
      ? Math.round(((attemptedTests || 0) / totalTests) * 100)
      : 0;

  const displayUserCount =
    typeof users === "number" && users > 0
      ? users
      : typeof series.usersCount === "number" && series.usersCount > 0
        ? series.usersCount
        : typeof series.enrollmentCount === "number" &&
            series.enrollmentCount > 0
          ? series.enrollmentCount
          : typeof series.users_count === "number" && series.users_count > 0
            ? series.users_count
            : parseInt(
                series.users || series.active_users || series.activeUsers || 0,
              ) || 5;

  const formatUserCount = (count) => {
    if (!count) return "0";
    if (typeof count === "string") return count;
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count?.toString() || "0";
  };

  const categoryLabels =
    testTypes && testTypes.length > 0
      ? testTypes
      : Object.keys(testCounts || {});
  const categoryRows = categoryLabels
    .map((type) => ({ label: type, count: Number(testCounts?.[type] || 0) }))
    .filter((row) => row.label && row.count > 0)
    .sort((a, b) => b.count - a.count);
  const isShortTitle = title?.length < 25;
  const categoriesToShow = isShortTitle ? 4 : 3;
  const mainCategories = categoryRows.slice(0, categoriesToShow);
  const extraCategories = categoryRows.slice(categoriesToShow);

  const rawCatSlug =
    series.examSlug ||
    series.exam_slug ||
    series.examCategory ||
    series.category ||
    (series.examId ? String(series.examId) : "") ||
    "ssc-cgl";
  const catSlug = String(rawCatSlug).toLowerCase().replace(/\s+/g, "-");
  const targetUrl = isEnrolled
    ? `/${catSlug}/test-series/my`
    : `/${catSlug}/test-series/${seriesId}`;

  const handleEnrollClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onEnroll) onEnroll(series);
  };

  const handleExpandClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const renderActionButton = () => {
    if (isEnrolled) {
      return (
        <Link
          to={targetUrl}
          className={`w-full py-2 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 shadow-sm transition-all ${
            isSeriesPro
              ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-500/15"
              : "bg-gradient-to-r from-brand-start to-brand-end hover:opacity-95"
          }`}
        >
          {showProgress ? "Continue" : "View"}
        </Link>
      );
    }
    if (isSeriesPro && !hasProPass) {
      return (
        <Link
          to="/pass"
          className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm shadow-amber-500/20 transition-all active:scale-98"
        >
          <Crown className="w-3.5 h-3.5" />
          <span>Get Pro</span>
        </Link>
      );
    }
    if (user) {
      return (
        <button
          onClick={handleEnrollClick}
          className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 shadow-sm transition-all active:scale-98"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      );
    }
    if (isSeriesPro) {
      return (
        <Link
          to={`/test-series/${seriesId}`}
          className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm shadow-amber-500/20 transition-all active:scale-98"
        >
          <Crown className="w-3.5 h-3.5" />
          <span>View Pro Series</span>
        </Link>
      );
    }
    return (
      <Link
        to={`/test-series/${seriesId}`}
        className="w-full py-2 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 bg-gradient-to-r from-brand-start to-brand-end hover:opacity-95 shadow-sm transition-all"
      >
        View
      </Link>
    );
  };

  const stageText =
    Array.isArray(stageNames) && stageNames.length > 0
      ? stageNames.filter(Boolean).join(", ")
      : stageName || "";

  return (
    <div
      className={`test-series-card h-full flex flex-col self-stretch ${className || "flex-shrink-0 w-[280px] sm:w-[310px] md:w-[320px] max-w-full"}`}
    >
      <Card
        variant="default"
        padding="p-0"
        hover
        className="h-full flex flex-col justify-between overflow-hidden group"
      >
        <Link to={targetUrl} className="flex-1 flex flex-col p-4">
          {/* Top Row: Logo + Exam Name on Left | PRO/FREE + Users on Right */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="text-xl shrink-0">
                {series.icon || getCategoryEmoji(categoryName || category)}
              </div>
              {(examName || categoryName || category) && (
                <span className="font-bold text-xs text-gray-700 dark:text-gray-200 truncate uppercase tracking-wider">
                  {examName || categoryName || category}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isComingSoon && (
                <Badge variant="warning" size="xs">
                  COMING SOON
                </Badge>
              )}
              {isSeriesPro ? (
                <Badge
                  variant="pro"
                  size="xs"
                  className="flex items-center gap-1"
                >
                  <Crown className="w-3 h-3" />
                  PRO
                </Badge>
              ) : (
                <Badge variant="success" size="xs" className="font-bold">
                  FREE
                </Badge>
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium ml-0.5">
                👥 {formatUserCount(displayUserCount)}
              </span>
            </div>
          </div>

          {/* Test Series Title with Stage Name in Brackets */}
          <div className="min-h-[2.75rem] mb-2.5 flex items-start">
            <h3 className="font-bold text-gray-900 dark:text-white text-base leading-snug line-clamp-2 group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors">
              {title}{" "}
              {stageText ? (
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  ({stageText})
                </span>
              ) : null}
            </h3>
          </div>

          {/* Key Metric Bar */}
          <div className="flex items-center justify-between text-xs border-t border-b border-gray-100 dark:border-gray-700/80 py-2 mb-3">
            <span className="font-semibold text-gray-900 dark:text-white">
              {totalTests || 0} Tests
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              {freeTests || 0} Free
            </span>
            <span className="text-cyan-500 dark:text-cyan-400 font-medium">
              {languages?.join(", ") || "Eng, Hin"}
            </span>
          </div>

          {/* Category Rows Breakdown */}
          {showCategories && (
            <div className="space-y-1.5 mb-2 flex-1 min-h-[5.5rem] flex flex-col justify-start">
              {mainCategories.map((row, i) => (
                <div
                  key={`${row.label}-${i}`}
                  className="flex items-center justify-between text-xs py-1 px-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <span className="text-gray-700 dark:text-gray-300 truncate mr-2 font-medium">
                    {row.label}
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {row.count}
                  </span>
                </div>
              ))}
              {extraCategories.length > 0 && !expanded && (
                <button
                  type="button"
                  onClick={handleExpandClick}
                  className="text-[11px] text-brand-start dark:text-indigo-400 font-semibold w-full text-left px-2 hover:underline"
                >
                  +{extraCategories.length} more
                </button>
              )}
              {expanded &&
                extraCategories.map((row, i) => (
                  <div
                    key={`${row.label}-${i}`}
                    className="flex items-center justify-between text-xs py-1 px-2.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <span className="text-gray-700 dark:text-gray-300 truncate mr-2 font-medium">
                      {row.label}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white">
                      {row.count}
                    </span>
                  </div>
                ))}
              {expanded && (
                <button
                  type="button"
                  onClick={handleExpandClick}
                  className="text-[11px] text-brand-start dark:text-indigo-400 font-semibold w-full text-left px-2 hover:underline"
                >
                  Show less
                </button>
              )}
            </div>
          )}
        </Link>
        <div className="mt-auto px-4 pb-4 pt-1 flex items-center gap-2 border-t border-gray-50 dark:border-gray-700/40">
          {showProgress && progressPercentage > 0 && (
            <ProgressRing
              percentage={progressPercentage}
              size={28}
              strokeWidth={3}
            >
              <span className="text-[8px] font-bold">
                {progressPercentage}%
              </span>
            </ProgressRing>
          )}
          <div className="flex-1">{renderActionButton()}</div>
        </div>
      </Card>
    </div>
  );
}

export default TestSeriesCard;
