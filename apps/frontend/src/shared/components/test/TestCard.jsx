import { useState, useMemo, memo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Radio,
  Crown,
  Clock,
  Users,
  Construction,
  Zap,
  CheckCircle2,
  Trophy,
  Loader2,
  Bell,
  Calendar,
} from "lucide-react";
import { checkFeatureAccess } from "../../utils/pass-helpers";
import {
  getTestEntitlement,
  isUserPro as checkUserIsPro,
} from "../../utils/entitlement";
import {
  checkIsLive,
  checkIsUpcoming,
  checkIsComingSoon,
  checkIsLiveExpired,
  checkIsQuiz,
  checkIsSolutionExpired,
  getTestId as getTestIdShared,
  formatDateRange as formatDateRangeShared,
  getTestStartDate,
  getTestEndDate,
  getTimeUntil,
} from "../../utils/testClassification";
import { parseLanguageList } from "../../lib/language";

// Badge configuration for test & quiz cards
const badgeConfig = {
  "LIVE TEST": { bg: "bg-red-500", color: "text-white", icon: Radio },
  "LIVE QUIZ": {
    bg: "bg-gradient-to-r from-violet-600 to-indigo-600",
    color: "text-white",
    icon: Zap,
  },
  "SPEED QUIZ": {
    bg: "bg-gradient-to-r from-amber-500 to-orange-500",
    color: "text-white",
    icon: Zap,
  },
  QUIZ: { bg: "bg-violet-600", color: "text-white", icon: Zap },
  "SCHEDULED QUIZ": { bg: "bg-violet-500", color: "text-white", icon: Clock },
  FREE: { bg: "bg-green-500", color: "text-white", icon: null },
  "MUST ATTEMPT": {
    bg: "bg-gradient-to-r from-indigo-500 to-blue-500",
    color: "text-white",
    icon: null,
  },
  PRO: {
    bg: "bg-gradient-to-r from-amber-400 to-orange-400",
    color: "text-white",
    icon: Crown,
  },
  SCHEDULED: { bg: "bg-blue-500", color: "text-white", icon: Clock },
  NEW: { bg: "bg-purple-500", color: "text-white", icon: null },
  "COMING SOON": {
    bg: "bg-amber-100 dark:bg-amber-950/60",
    color: "text-amber-700 dark:text-amber-400",
    icon: Clock,
  },
  UPDATING: {
    bg: "bg-amber-100 dark:bg-amber-950/60",
    color: "text-amber-700 dark:text-amber-400",
    icon: Clock,
  },
  EXPIRED: {
    bg: "bg-gray-400 dark:bg-slate-700",
    color: "text-white",
    icon: Clock,
  },
};

// CTA button configuration conforming to TRSTPrep Live CTA standard
const ctaConfig = {
  coming_soon: {
    label: "Coming Soon",
    bg: "bg-gray-200 dark:bg-slate-800",
    hover: "hover:bg-gray-200",
    color: "text-gray-500 dark:text-slate-400",
    border: "border border-gray-300 dark:border-slate-700",
  },
  unlock: {
    label: "🔒 Get Pro Pass",
    bg: "bg-gradient-to-r from-amber-500 to-orange-500",
    hover: "hover:from-amber-600 hover:to-orange-600",
    color: "text-white",
    border: "shadow-xs",
  },
  login_unlock: {
    label: "🔒 Login to Unlock",
    bg: "bg-white dark:bg-slate-800",
    hover: "hover:bg-amber-50 dark:hover:bg-slate-700",
    color: "text-amber-600 dark:text-amber-400",
    border: "border-2 border-amber-500 dark:border-amber-400",
  },
  login: {
    label: "Log In to Start",
    bg: "bg-gradient-to-r from-brand-start to-brand-end",
    hover: "hover:opacity-95",
    color: "text-white",
    border: "",
  },
  expired: {
    label: "Expired",
    bg: "bg-gray-200 dark:bg-slate-800 text-gray-500 dark:text-slate-400",
    hover: "hover:bg-gray-200",
    color: "text-gray-500 dark:text-slate-400",
    border: "border border-gray-300 dark:border-slate-700",
  },
  result: {
    label: "Result",
    bg: "bg-emerald-500",
    hover: "hover:bg-emerald-600",
    color: "text-white",
    border: "",
  },
  attempt_now: {
    label: "🎯 Attempt Now",
    bg: "bg-red-500",
    hover: "hover:bg-red-600",
    color: "text-white",
    border: "",
  },
  attempt_quiz: {
    label: "🎯 Attempt Now",
    bg: "bg-gradient-to-r from-violet-600 to-indigo-600",
    hover: "hover:from-violet-500 hover:to-indigo-500",
    color: "text-white",
    border: "",
  },
  join_now: {
    label: "🔔 Join Now",
    bg: "bg-red-500",
    hover: "hover:bg-red-600",
    color: "text-white",
    border: "",
  },
  join_quiz: {
    label: "🔔 Join Now",
    bg: "bg-gradient-to-r from-violet-600 to-indigo-600",
    hover: "hover:from-violet-500 hover:to-indigo-500",
    color: "text-white",
    border: "",
  },
  register: {
    label: "🔔 Register",
    bg: "bg-green-500",
    hover: "hover:bg-green-600",
    color: "text-white",
    border: "",
  },
  registered: {
    label: "✓ Registered",
    bg: "bg-emerald-50 dark:bg-emerald-950/60",
    hover: "",
    color: "text-emerald-700 dark:text-emerald-300",
    border: "border border-emerald-300 dark:border-emerald-700",
  },
  start: {
    label: "Start Now",
    bg: "bg-sky-500",
    hover: "hover:bg-sky-600",
    color: "text-white",
    border: "",
  },
  reattempt: {
    label: "Reattempt",
    bg: "bg-white dark:bg-slate-800",
    hover: "hover:bg-gray-50 dark:hover:bg-slate-700",
    color: "text-sky-600 dark:text-sky-400",
    border: "border border-sky-200 dark:border-sky-700",
  },
};

// Determine test status and badges
const getTestBadges = (
  test,
  isLiveParam,
  isUpcomingParam,
  isFreeParam,
  isQuizItem,
) => {
  const badges = [];
  const isExpired = checkIsLiveExpired(test);
  const isLive = (isLiveParam ?? checkIsLive(test)) && !isExpired;
  const isUpcoming = isUpcomingParam ?? checkIsUpcoming(test);
  const isFree = isFreeParam;

  if (isQuizItem) {
    if (isLive) badges.push("LIVE QUIZ");
    else if (isUpcoming && !isExpired) badges.push("SCHEDULED QUIZ");
    else if (isExpired) badges.push("EXPIRED");
    else badges.push("QUIZ");
  } else {
    if (isLive) badges.push("LIVE TEST");
    if (isExpired) badges.push("EXPIRED");
    if (isUpcoming && !isLive && !isExpired) badges.push("SCHEDULED");
  }

  if (isFree) {
    badges.push("FREE");
  } else {
    badges.push("PRO");
  }

  if (test.isMustAttempt || test.tags?.includes("Must Attempt"))
    badges.push("MUST ATTEMPT");
  if (test.isNew || test.tags?.includes("New")) badges.push("NEW");
  if (checkIsComingSoon(test)) badges.push("COMING SOON");

  return badges;
};

// Determine CTA type
const getTestCtaType = (test, hasAccess, isLive, isUpcoming, isQuizItem) => {
  if (checkIsComingSoon(test)) return "coming_soon";
  if (!hasAccess) return "unlock";

  // Check if live test has expired
  if (checkIsLiveExpired(test)) return "expired";

  if (isLive) return isQuizItem ? "join_quiz" : "join";
  if (isUpcoming) return "register";
  return "start";
};

// Get border color based on test status
const getCardBorderClass = (
  isLive,
  isUpcoming,
  isFree,
  isLocked,
  isHovered,
  isQuizItem,
) => {
  if (isLive) {
    if (isQuizItem) {
      return isHovered
        ? "border-2 border-violet-500 dark:border-violet-400 shadow-lg shadow-violet-500/10"
        : "border-2 border-violet-300/80 dark:border-violet-600/70 shadow-sm";
    }
    return isHovered
      ? "border-2 border-red-500 dark:border-red-400 shadow-lg shadow-red-500/10"
      : "border-2 border-red-300/80 dark:border-red-600/70 shadow-sm";
  }
  if (isUpcoming) {
    return isHovered
      ? "border-2 border-blue-400 dark:border-blue-500 shadow-md"
      : "border-2 border-blue-200/90 dark:border-blue-800/70 shadow-sm";
  }
  if (isFree) {
    return isHovered
      ? "border-2 border-green-400 dark:border-green-500 shadow-md"
      : "border-2 border-green-200/90 dark:border-green-800/70 shadow-sm";
  }
  if (isLocked) {
    return isHovered
      ? "border-2 border-amber-400 dark:border-amber-500 shadow-md"
      : "border-2 border-amber-200/90 dark:border-amber-800/70 shadow-sm";
  }
  return isHovered
    ? "border-2 border-indigo-400 dark:border-indigo-500 shadow-md"
    : "border border-gray-200 dark:border-slate-800 shadow-sm";
};

/**
 * Unified TestCard Component
 *
 * Used across: LiveTests, TestDetails, TagPage, Dashboard, Admin Panel, Landing Page
 *
 * @param {Object} test - Test data object
 * @param {string} seriesId - Series ID for navigation
 * @param {Object} user - Current user object
 * @param {boolean} showSeriesTitle - Show series title tag
 * @param {boolean} isLiveArena - If true, points to /live-tests routes
 * @param {Function} onRegister - Optional callback for live registration
 * @param {boolean} isRegistered - Whether user is registered for upcoming test
 * @param {boolean} isRegistering - Loading state for registration
 * @param {boolean} showLeaderboardAndReview - Show leaderboard and solutions actions in footer
 * @param {string} variant - 'default' | 'compact' | 'detailed'
 */
function TestCard({
  test,
  seriesId,
  series = null,
  user,
  showSeriesTitle = false,
  isLiveArena = false,
  onRegister = null,
  isRegistered = false,
  isRegistering = false,
  showLeaderboardAndReview = false,
  variant: _variant = "default",
}) {
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);

  // Determine if item is a Quiz or Full Test
  const isQuizItem =
    checkIsQuiz(test) ||
    test.itemType === "quiz" ||
    test.item_type === "quiz" ||
    test.type === "Quiz" ||
    test.type === "quiz";

  // Test status
  const isLive = checkIsLive(test);
  const isUpcoming = checkIsUpcoming(test);

  // Canonical entitlement resolution (Series & Test access)
  const entitlement = useMemo(() => {
    return getTestEntitlement({ test, user, series: series || test.series });
  }, [test, user, series, test.series]);

  const isTestPro = entitlement.accessType === "PRO";
  const isFree = entitlement.accessType === "FREE";
  const isUserPro = entitlement.isUserPro;
  const isLocked = entitlement.requiresPro;
  const hasAccess = entitlement.canAttempt;

  // Question count comes directly from the test object
  const totalQs =
    test.totalQuestions ??
    test.total_questions ??
    (Array.isArray(test.questions)
      ? test.questions.length
      : typeof test.questions === "number"
        ? test.questions
        : 0);
  const displayQuestions = Number(totalQs) || 0;
  const noQuestions = displayQuestions === 0;

  // Add UPDATING badge if no questions
  const badges = getTestBadges(test, isLive, isUpcoming, isFree, isQuizItem);
  if (noQuestions && !checkIsComingSoon(test)) {
    badges.push("UPDATING");
  }

  // Check if live expired
  const isExpired = checkIsLiveExpired(test);

  // Languages
  const languagesRaw = test.languages || test.language || test.langs;
  const languageList = parseLanguageList(languagesRaw, ["English", "Hindi"]);
  const extraLangCount =
    test.extraLanguagesCount ||
    (languageList.length > 2 ? languageList.length - 2 : 0);
  const displayLanguages = languageList.slice(0, 2);
  const langText =
    extraLangCount > 0
      ? `${displayLanguages.join(", ")} +${extraLangCount}`
      : languageList.join(", ");

  // Date range
  const isLiveTest =
    isLiveArena ||
    checkIsLive(test) ||
    isUpcoming ||
    test.type === "live-tests" ||
    test.type === "live" ||
    test.test_category_id === 20 ||
    test.testCategoryId === 20 ||
    (Array.isArray(test.tags) &&
      test.tags.some(
        (t) =>
          String(t).toLowerCase() === "live" ||
          String(t).toLowerCase() === "live-tests",
      ));
  const startTimeVal = getTestStartDate(test);
  const endTimeVal = getTestEndDate(test);
  const dateRange = isLiveTest
    ? formatDateRangeShared(startTimeVal, endTimeVal, test.duration)
    : null;

  // Real Test metadata (no hardcoded fallback numbers)
  const totalMarksVal =
    test.totalMarks ??
    test.total_marks ??
    test.marks ??
    (displayQuestions > 0 ? displayQuestions : null);
  const marks =
    totalMarksVal !== null && totalMarksVal !== undefined
      ? Number(totalMarksVal)
      : null;
  const durationVal =
    test.duration ?? test.durationMinutes ?? test.duration_minutes ?? null;
  const duration =
    durationVal !== null && durationVal !== undefined
      ? Number(durationVal)
      : null;
  const bannerUrl =
    test.bannerUrl || test.bannerImageUrl || test.banner_image_url || null;

  // Target test UUID / ID (prefer public_id / UUID over slug for Testbook URL standard)
  const targetTestId = getTestIdShared(test);
  const seriesSlug =
    seriesId ||
    test.seriesSlug ||
    test.series_slug ||
    (isLiveArena ? "live-tests" : "ssc-cgl-2026");

  // Attempt number calculation
  const attemptNo = useMemo(() => {
    const count =
      test.userAttemptCount ??
      test.attemptsCount ??
      (Array.isArray(test.attempts) ? test.attempts.length : 0);
    return Number(count) + 1;
  }, [test]);

  const instructionsUrl = isLiveArena
    ? `/live-tests/${targetTestId}`
    : `/${seriesSlug}/tests/${targetTestId}/instructions?attemptNo=${attemptNo}`;
  const testUrl = isLiveArena
    ? `/live-tests/${targetTestId}`
    : `/${seriesSlug}/tests/${targetTestId}?attemptNo=${attemptNo}`;
  const resultUrl = isLiveArena
    ? `/live-test-results/${targetTestId}`
    : `/${seriesSlug}/tests/${targetTestId}/result`;
  const leaderboardUrl = `/live-tests/${targetTestId}/leaderboard`;
  const reviewUrl = `/live-tests/${targetTestId}/review`;

  // Check if test was attempted
  const isAttempted = useMemo(() => {
    if (test.isAttempted || test.hasAttempted || test.attempted) return true;
    if (!user?.attemptedTestIds || !Array.isArray(user.attemptedTestIds))
      return false;

    const targetIds = [
      String(test._id || ""),
      String(test.id || ""),
      String(test.slug || ""),
      String(test.public_id || ""),
      String(targetTestId || ""),
    ]
      .filter(Boolean)
      .map((id) => id.toLowerCase());

    return user.attemptedTestIds.some((id) =>
      targetIds.includes(String(id).toLowerCase()),
    );
  }, [
    user?.attemptedTestIds,
    test._id,
    test.id,
    test.slug,
    test.public_id,
    targetTestId,
    test.isAttempted,
    test.hasAttempted,
    test.attempted,
  ]);

  // Check if user is registered for this live session
  const isUserRegistered = Boolean(
    isRegistered ||
    test.isRegistered ||
    test.userIsRegistered ||
    (user?.registeredTestIds &&
      Array.isArray(user.registeredTestIds) &&
      user.registeredTestIds.includes(String(targetTestId))),
  );

  // Deterministic Priority CTA Resolution:
  // Coming Soon → Expired → Attempted/Completed → Unauthenticated (Login / Login to Unlock) → Locked → Live (Not Reg: Join Now / Reg: Attempt Now) → Upcoming (Not Reg: Register / Reg: Registered) → Start Now
  const resolvedCta = useMemo(() => {
    // 1. Coming Soon (or no questions on non-live tests)
    if (checkIsComingSoon(test) || (noQuestions && !isLiveTest)) {
      return {
        type: "coming_soon",
        label: "Coming Soon",
        isDisabled: true,
        tooltip: "Test questions are under preparation",
      };
    }

    // 2. Expired / Contest Ended (Contest has ended — takes precedence over auth state)
    if (isExpired) {
      if (isAttempted) {
        return {
          type: "result",
          label: "Result",
          isLink: true,
          isResult: true,
        };
      }
      return {
        type: "expired",
        label: "Expired",
        isDisabled: true,
        tooltip: "This live contest has ended",
      };
    }

    // 3. Completed / Attempted (for active/regular tests)
    if (isAttempted) {
      return { type: "result", label: "Result", isLink: true, isResult: true };
    }

    // 4. Unauthenticated (User not logged in) — only for active, upcoming, or regular mock tests
    if (!user) {
      if (isLocked) {
        return {
          type: "login_unlock",
          label: "🔒 Login to Unlock",
          isLink: true,
          to: "/login",
          state: {
            from: instructionsUrl,
            backgroundLocation: location,
            message: "Please login to unlock this test",
          },
        };
      }
      return {
        type: "login",
        label: "Log In to Start",
        isLink: true,
        to: "/login",
        state: { from: instructionsUrl, backgroundLocation: location },
      };
    }

    // 5. Locked (PRO Pass required)
    if (isLocked) {
      return {
        type: "unlock",
        label: "🔒 Get Pro Pass",
        isLink: true,
        to: "/pass",
      };
    }

    // 6. Live Now (Active Contest Window)
    if (isLive || (isLiveTest && !isUpcoming && !isExpired)) {
      if (isUserRegistered) {
        return {
          type: isQuizItem ? "attempt_quiz" : "attempt_now",
          label: "🎯 Attempt Now",
          isLink: true,
          to: instructionsUrl,
        };
      } else {
        return {
          type: isQuizItem ? "join_quiz" : "join_now",
          label: "🔔 Join Now",
          isRegisterAction: true,
        };
      }
    }

    // 7. Upcoming (Scheduled Session)
    if (isUpcoming) {
      if (isUserRegistered) {
        return {
          type: "registered",
          label: "✓ Registered",
          isStatusPill: true,
        };
      } else {
        return {
          type: "register",
          label: "🔔 Register",
          isRegisterAction: true,
        };
      }
    }

    // 8. Regular Mock Test Fallback
    return {
      type: "start",
      label: "Start Now",
      isLink: true,
      to: instructionsUrl,
    };
  }, [
    test,
    noQuestions,
    isLiveTest,
    isExpired,
    isAttempted,
    user,
    isLocked,
    location,
    instructionsUrl,
    isLive,
    isUpcoming,
    isUserRegistered,
    isQuizItem,
  ]);

  // Border class based on status
  const borderClass = getCardBorderClass(
    isLive,
    isUpcoming,
    isFree,
    isLocked,
    isHovered,
    isQuizItem,
  );

  // Participant count (show on quiz cards and live tests, at least 1 or real count)
  const realCount = Number(test.participants ?? test.participantsCount ?? 0);
  const participantCount =
    realCount > 0 ? realCount : isQuizItem || isLive || isUpcoming ? 1 : 0;

  // Background surface class based on type
  const bgSurfaceClass = isQuizItem
    ? "bg-gradient-to-br from-violet-50/30 via-white to-white dark:from-violet-950/20 dark:via-slate-900 dark:to-slate-900"
    : isLive
      ? "bg-gradient-to-br from-rose-50/30 via-white to-white dark:from-rose-950/20 dark:via-slate-900 dark:to-slate-900"
      : "bg-white dark:bg-slate-900";

  return (
    <div
      className={`rounded-2xl transition-all duration-200 overflow-hidden ${bgSurfaceClass} ${
        isHovered ? "shadow-md scale-[1.003]" : "shadow-xs"
      } ${borderClass} ${isLocked ? "opacity-85" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {bannerUrl && (
        <div className="h-24 md:h-28 w-full overflow-hidden bg-gray-100 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800">
          <img
            src={bannerUrl}
            alt={test.title || "Test banner"}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Main Content */}
      <div className="p-3 sm:p-3.5">
        {/* Badges and Category Row */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {badges.map((badge) => {
              const config = badgeConfig[badge] || {
                bg: "bg-gray-200 dark:bg-slate-800",
                color: "text-gray-700 dark:text-slate-300",
                icon: null,
              };
              const IconComponent = config.icon;
              return (
                <span
                  key={badge}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider uppercase whitespace-nowrap shadow-2xs ${config.bg} ${config.color}`}
                >
                  {IconComponent && (
                    <IconComponent
                      className={`w-3 h-3 ${badge.includes("LIVE") ? "animate-pulse" : ""}`}
                    />
                  )}
                  {badge}
                </span>
              );
            })}

            {test.category && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                {test.category}
              </span>
            )}
          </div>

          {/* Real Participants Count */}
          {participantCount > 0 && (
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/60 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 border border-slate-200/50 dark:border-slate-700/50">
              <Users className="w-3 h-3 text-slate-400" />
              <span>{participantCount.toLocaleString()} joined</span>
            </span>
          )}

          {/* Series Title */}
          {showSeriesTitle && test.seriesTitle && (
            <span className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate flex-1 min-w-[100px]">
              {test.seriesTitle}
            </span>
          )}
        </div>

        {/* Rows 2 & 3: Left (Title + Description + Meta) | Right (Merged CTA Button) */}
        <div className="flex items-center justify-between gap-3">
          {/* Left Column: Title, Description, and Meta Info Row */}
          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white leading-snug line-clamp-2">
                {test.title}
              </h3>
              {test.description && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                  {test.description}
                </p>
              )}
            </div>

            {/* Meta Info Row with subtle background container effect */}
            <div className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 px-2.5 py-1.5 bg-slate-50/90 dark:bg-slate-800/60 rounded-xl border border-slate-100/90 dark:border-slate-800 text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-medium">
              <span className="flex items-center gap-1">
                <span className="text-xs">❓</span>
                <>
                  {displayQuestions} Qs
                  {noQuestions && (
                    <span className="ml-1 inline-flex items-center gap-0.5 text-amber-600">
                      <Construction className="w-3 h-3" />
                      <span className="text-[9px]">Updating</span>
                    </span>
                  )}
                </>
              </span>
              {marks !== null && marks !== undefined && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <span className="flex items-center gap-1">
                    <span className="text-xs">📄</span>
                    {marks} Marks
                  </span>
                </>
              )}
              {duration !== null && duration !== undefined && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <span className="flex items-center gap-1">
                    <span className="text-xs">🕒</span>
                    {duration} Mins
                  </span>
                </>
              )}

              {/* Countdown for Upcoming items */}
              {isUpcoming && startTimeVal && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold">
                    <Clock className="w-3 h-3" />
                    <span>Starts in {getTimeUntil(startTimeVal)}</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Merged CTA Action (Vertically Centered across Row 2 & 3) */}
          <div className="shrink-0 self-center pl-1">
            {resolvedCta.isResult ? (
              <div className="flex flex-col sm:flex-row gap-1.5 items-center">
                <Link
                  to={resultUrl}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-150 shadow-xs flex items-center justify-center ${
                    isHovered ? "brightness-95" : "brightness-100"
                  } ${ctaConfig.result.bg} ${ctaConfig.result.hover} ${ctaConfig.result.color} ${ctaConfig.result.border}`}
                >
                  {ctaConfig.result.label}
                </Link>
                {!isExpired &&
                  !isLive &&
                  !isLiveArena &&
                  !test.isLive &&
                  !test.is_live &&
                  test.type !== "live-tests" && (
                    <Link
                      to={hasAccess ? instructionsUrl : "/pass"}
                      className={`px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-all duration-150 ${ctaConfig.reattempt.bg} ${ctaConfig.reattempt.hover} ${ctaConfig.reattempt.color} ${ctaConfig.reattempt.border}`}
                    >
                      {ctaConfig.reattempt.label}
                    </Link>
                  )}
              </div>
            ) : resolvedCta.isRegisterAction ? (
              <button
                onClick={() => (onRegister ? onRegister(test) : null)}
                disabled={isRegistering}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-150 flex items-center justify-center gap-1.5 shadow-xs active:scale-95 ${
                  ctaConfig[resolvedCta.type]?.bg || "bg-green-500"
                } ${ctaConfig[resolvedCta.type]?.hover || "hover:bg-green-600"} ${
                  ctaConfig[resolvedCta.type]?.color || "text-white"
                } ${ctaConfig[resolvedCta.type]?.border || ""}`}
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>...</span>
                  </>
                ) : (
                  <span>{resolvedCta.label}</span>
                )}
              </button>
            ) : resolvedCta.isStatusPill ? (
              <div
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap flex items-center justify-center gap-1.5 ${
                  ctaConfig.registered.bg
                } ${ctaConfig.registered.color} ${ctaConfig.registered.border}`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>{resolvedCta.label}</span>
              </div>
            ) : resolvedCta.isDisabled ? (
              <button
                disabled
                title={resolvedCta.tooltip || resolvedCta.label}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap opacity-70 cursor-not-allowed ${
                  ctaConfig[resolvedCta.type]?.bg ||
                  "bg-gray-200 dark:bg-slate-800"
                } ${ctaConfig[resolvedCta.type]?.color || "text-gray-500 dark:text-slate-400"} ${
                  ctaConfig[resolvedCta.type]?.border ||
                  "border border-gray-300 dark:border-slate-700"
                }`}
              >
                {resolvedCta.label}
              </button>
            ) : (
              <Link
                to={resolvedCta.to || (hasAccess ? instructionsUrl : "/pass")}
                state={resolvedCta.state}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-150 shadow-xs flex items-center justify-center active:scale-95 ${
                  isHovered ? "brightness-95" : "brightness-100"
                } ${ctaConfig[resolvedCta.type]?.bg || "bg-sky-500"} ${
                  ctaConfig[resolvedCta.type]?.hover || "hover:bg-sky-600"
                } ${ctaConfig[resolvedCta.type]?.color || "text-white"} ${
                  ctaConfig[resolvedCta.type]?.border || ""
                }`}
              >
                {resolvedCta.label}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-50/70 dark:bg-slate-850/80 border-t border-slate-100 dark:border-slate-800/80 px-3 sm:px-3.5 py-2">
        <div className="flex flex-wrap justify-between items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          {/* Left: Languages + Syllabus */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 font-medium">
              <span className="text-xs">🌐</span>
              {langText}
            </span>
            {test.syllabusUrl && (
              <Link
                to={`${testUrl}#syllabus`}
                className={`text-indigo-500 font-medium transition-all ${isHovered ? "underline" : ""}`}
              >
                Syllabus
              </Link>
            )}
          </div>

          {/* Right: Available Date Range or Leaderboard / Review Links */}
          <div className="flex items-center gap-1.5 flex-wrap ml-auto">
            {showLeaderboardAndReview || isExpired ? (
              <div className="flex items-center gap-1.5">
                <Link
                  to={leaderboardUrl}
                  className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold text-[10px] flex items-center gap-1 border border-amber-200 dark:border-amber-800 transition-colors"
                >
                  <Trophy className="w-3 h-3 text-amber-500" />
                  <span>Leaderboard</span>
                </Link>
                {checkIsSolutionExpired(test) ? (
                  <span
                    title="The 7-day post-live solution window has expired"
                    className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-850 text-slate-400 dark:text-slate-500 font-bold text-[10px] flex items-center gap-1 border border-slate-200 dark:border-slate-700 cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                    <span>Solutions Expired</span>
                  </span>
                ) : (
                  <Link
                    to={reviewUrl}
                    className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center gap-1 transition-colors"
                  >
                    <CheckCircle2 className="w-3 h-3 text-slate-500" />
                    <span>Solutions</span>
                  </Link>
                )}
              </div>
            ) : dateRange ? (
              <span className="flex items-center gap-1 font-medium text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] border border-amber-200/70 dark:border-amber-800/50">
                <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>{dateRange}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(TestCard);
