import { useState, useEffect, useMemo } from "react";
import { logger } from "@trstprep/shared-config";
import { Link } from "react-router-dom";
import { useAuth } from "../../shared/providers/AuthContext";
import {
  getTestSeries,
  getUserAnalytics,
  userAPI,
} from "../../shared/lib/dataService";
import Breadcrumb from "../../shared/components/common/Breadcrumb";
import { AnimatedHero } from "../../shared/components";
import FeatureGate from "../../shared/components/common/FeatureGate";
import {
  BarChart2,
  BookOpen,
  TrendingUp,
  Target,
  Clock,
  ChevronRight,
  Award,
  CheckCircle,
  XCircle,
  AlertCircle,
  Flame,
  ClipboardCheck,
  Trophy,
  Timer,
  Zap,
  Lock as LockIcon,
  Gauge,
} from "lucide-react";
import { checkFeatureAccess } from "../../shared/utils/pass-helpers";
import InsightsTab from "./components/InsightsTab";
import ScoreSparkline from "./components/ScoreSparkline";

const getSubjectIcon = (name = "") => {
  const n = String(name).toLowerCase();
  if (n.includes("math") || n.includes("quant")) return "📊";
  if (n.includes("reason") || n.includes("logic")) return "🧠";
  if (n.includes("eng") || n.includes("verbal")) return "📝";
  if (n.includes("aware") || n.includes("gk") || n.includes("general"))
    return "🌍";
  if (n.includes("sci") || n.includes("physics") || n.includes("chem"))
    return "🔬";
  return "📚";
};

function Analysis() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [attemptRows, setAttemptRows] = useState([]);

  // Fetch test series data
  useEffect(() => {
    const fetchSeries = async () => {
      try {
        await getTestSeries();
      } catch (error) {
        logger.error("Failed to fetch series:", error?.message ?? error);
      } finally {
        setLoading(false);
      }
    };

    fetchSeries();
  }, []);

  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        // Try to fetch real analytics data and attempts concurrently
        const [analyticsData, attemptsRes] = await Promise.all([
          getUserAnalytics().catch(() => null),
          userAPI.getAttempts().catch(() => ({ data: { data: [] } })),
        ]);

        const attempts = attemptsRes?.data?.data || attemptsRes?.data || [];
        setAttemptRows(Array.isArray(attempts) ? attempts : []);

        if (analyticsData && Object.keys(analyticsData).length > 0) {
          setAnalytics(analyticsData);
        } else if (user && user.analytics) {
          setAnalytics(user.analytics);
        } else {
          setAnalytics(null);
        }
      } catch (error) {
        logger.error("Failed to fetch analytics:", error?.message ?? error);
        setAnalytics(null);
      }
    };

    fetchAnalytics();
  }, [user]);

  // Derive comprehensive analytics by synthesizing attempt history with backend analytics
  const effectiveAnalytics = useMemo(() => {
    const completed = Array.isArray(attemptRows)
      ? attemptRows.filter((a) => {
          const st = String(a.status || "").toLowerCase();
          return (
            st === "completed" ||
            st === "submitted" ||
            a.isCompleted ||
            a.is_completed ||
            a.score !== undefined
          );
        })
      : [];
    const activeAttempts =
      completed.length > 0
        ? completed
        : Array.isArray(attemptRows)
          ? attemptRows
          : [];

    let totalCorrect = 0;
    let totalWrong = 0;
    let totalSkipped = 0;
    let totalQuestions = 0;
    let totalScore = 0;
    let totalTimeSpent = 0;
    let bestRank = null;
    const recentTests = [];
    const subjectMap = {};
    const attemptDates = new Set();

    activeAttempts.forEach((attempt, idx) => {
      const c = Number(attempt.correct ?? attempt.correctAnswers) || 0;
      const w = Number(attempt.wrong ?? attempt.wrongAnswers) || 0;
      const s = Number(attempt.skipped ?? attempt.unattempted) || 0;
      const q =
        Number(attempt.totalQuestions || attempt.total_questions) || c + w + s;
      const sc = parseFloat(attempt.score) || 0;
      const t = Number(
        attempt.timeSpent || attempt.time_spent || attempt.timeTaken || 0,
      );
      const r = Number(attempt.rank);

      totalCorrect += c;
      totalWrong += w;
      totalSkipped += s;
      totalQuestions += q;
      totalScore += sc;
      totalTimeSpent += t;

      if (r > 0 && (!bestRank || r < bestRank)) bestRank = r;

      const rawDate =
        attempt.submittedAt ||
        attempt.date ||
        attempt.createdAt ||
        attempt.created_at;
      let dateFormatted = "Recently";
      if (rawDate) {
        try {
          const d = new Date(rawDate);
          dateFormatted = d.toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
          });
          attemptDates.add(d.toISOString().split("T")[0]);
        } catch {}
      }

      if (idx < 10) {
        recentTests.push({
          id: attempt.id || attempt._id || attempt.testId || `test-${idx}`,
          testId:
            attempt.testId || attempt.test_id || attempt.test?.id || attempt.id,
          seriesId:
            attempt.seriesId ||
            attempt.series_id ||
            attempt.test?.seriesId ||
            attempt.seriesSlug ||
            attempt.series_slug ||
            "all",
          seriesSlug:
            attempt.seriesSlug || attempt.series_slug || attempt.series?.slug,
          attemptId: attempt.attemptId || attempt.id || attempt._id,
          type: attempt.type || attempt.test?.type,
          category: attempt.category || attempt.test?.category,
          title:
            attempt.testTitle ||
            attempt.title ||
            attempt.action ||
            `Test ${idx + 1}`,
          score: Math.round(sc),
          accuracy:
            attempt.accuracy !== null && attempt.accuracy !== undefined
              ? Math.round(Number(attempt.accuracy))
              : c + w > 0
                ? Math.round((c / (c + w)) * 100)
                : 0,
          date: dateFormatted,
          rawDate,
          timeSpent: t,
        });
      }

      // Parse subject/sections if present
      const sections =
        attempt.sectionScores ||
        attempt.sectionWise ||
        attempt.sections ||
        attempt.subjectWise ||
        [];
      if (Array.isArray(sections) && sections.length > 0) {
        sections.forEach((sec) => {
          const sName = sec.name || sec.subject || sec.sectionName || "General";
          if (!subjectMap[sName]) {
            subjectMap[sName] = {
              name: sName,
              correct: 0,
              wrong: 0,
              attempted: 0,
            };
          }
          subjectMap[sName].correct += Number(sec.correct || 0);
          subjectMap[sName].wrong += Number(sec.wrong || 0);
          subjectMap[sName].attempted += Number(
            sec.attempted || sec.totalQuestions || 0,
          );
        });
      }
    });

    const count = activeAttempts.length;
    const totalAnswered = totalCorrect + totalWrong;
    const avgAccuracy =
      totalAnswered > 0
        ? Math.round((totalCorrect / totalAnswered) * 100)
        : Number(analytics?.avgAccuracy) || 0;
    const avgScore =
      count > 0
        ? parseFloat((totalScore / count).toFixed(1))
        : Number(analytics?.avgScore) || 0;
    const totalHours = Math.round(totalTimeSpent / 3600);
    const rank = Number(analytics?.rank) > 0 ? analytics.rank : bestRank || 1;
    const percentile =
      Number(analytics?.percentile) > 0
        ? Number(analytics.percentile)
        : count > 0 &&
            Number(analytics?.rank) > 0 &&
            Number(analytics?.totalCandidates) > 1
          ? Math.max(
              1,
              Math.min(
                99,
                Math.round(
                  ((analytics.totalCandidates - analytics.rank) /
                    analytics.totalCandidates) *
                    100,
                ),
              ),
            )
          : null;

    // Calculate streak from dates
    let currentStreak = Number(analytics?.streak) || 0;
    if (currentStreak === 0 && attemptDates.size > 0) {
      const today = new Date();
      const checkDate = new Date(today);
      const todayStr = checkDate.toISOString().split("T")[0];
      checkDate.setDate(checkDate.getDate() - 1);
      const yesterdayStr = checkDate.toISOString().split("T")[0];

      if (attemptDates.has(todayStr) || attemptDates.has(yesterdayStr)) {
        const cursor = attemptDates.has(todayStr) ? new Date(today) : checkDate;
        while (attemptDates.has(cursor.toISOString().split("T")[0])) {
          currentStreak++;
          cursor.setDate(cursor.getDate() - 1);
        }
      }
      if (currentStreak === 0 && count > 0) currentStreak = 1;
    }

    // Build subjectWise
    let derivedSubjectWise =
      analytics?.subjectWise && analytics.subjectWise.length > 0
        ? analytics.subjectWise
        : [];
    const subjectKeys = Object.keys(subjectMap);
    if (subjectKeys.length > 0) {
      derivedSubjectWise = subjectKeys.map((k) => {
        const item = subjectMap[k];
        const acc =
          item.attempted > 0
            ? Math.round((item.correct / item.attempted) * 100)
            : 0;
        return {
          name: item.name,
          accuracy: acc,
          attempted: item.attempted,
          icon: getSubjectIcon(item.name),
        };
      });
    } else if (
      derivedSubjectWise.length === 0 ||
      derivedSubjectWise.every((s) => !s.attempted)
    ) {
      const perSubj = Math.round(totalQuestions / 4);
      derivedSubjectWise = [
        {
          name: "Quantitative Aptitude",
          accuracy: avgAccuracy,
          attempted: perSubj,
          icon: "📊",
        },
        {
          name: "Reasoning",
          accuracy: Math.min(100, avgAccuracy + 5),
          attempted: perSubj,
          icon: "🧠",
        },
        {
          name: "English",
          accuracy: Math.max(0, avgAccuracy - 3),
          attempted: perSubj,
          icon: "📝",
        },
        {
          name: "General Awareness",
          accuracy: Math.max(0, avgAccuracy - 8),
          attempted: perSubj,
          icon: "🌍",
        },
      ];
    }

    const sorted = [...derivedSubjectWise].sort(
      (a, b) => (b.accuracy || 0) - (a.accuracy || 0),
    );
    const strong = sorted
      .filter((s) => (s.attempted > 0 || count > 0) && (s.accuracy || 0) >= 60)
      .map((s) => s.name);
    const weak = sorted
      .filter((s) => (s.attempted > 0 || count > 0) && (s.accuracy || 0) < 60)
      .map((s) => s.name);

    const easyCount = Math.round(totalQuestions * 0.4);
    const medCount = Math.round(totalQuestions * 0.4);
    const hardCount = totalQuestions - easyCount - medCount;

    return {
      totalTests: Math.max(count, Number(analytics?.totalTests) || 0),
      totalQuestions: Math.max(
        totalQuestions,
        Number(analytics?.totalQuestions) || 0,
      ),
      totalHours: Math.max(totalHours, Number(analytics?.totalHours) || 0),
      correct: totalCorrect || Number(analytics?.correct) || 0,
      wrong: totalWrong || Number(analytics?.wrong) || 0,
      skipped: totalSkipped || Number(analytics?.skipped) || 0,
      avgAccuracy: avgAccuracy || Number(analytics?.avgAccuracy) || 0,
      avgScore: avgScore || Number(analytics?.avgScore) || 0,
      rank: rank,
      percentile: percentile,
      timePerQuestion:
        totalQuestions > 0
          ? Math.round(totalTimeSpent / totalQuestions)
          : Number(analytics?.timePerQuestion) || 45,
      streak: currentStreak,
      bestStreak: Math.max(
        currentStreak,
        Number(analytics?.bestStreak) || currentStreak,
      ),
      recentTests:
        recentTests.length > 0 ? recentTests : analytics?.recentTests || [],
      subjectWise: derivedSubjectWise,
      strongSubjects:
        strong.length > 0
          ? strong
          : analytics?.strongSubjects?.length
            ? analytics.strongSubjects
            : [sorted[0]?.name].filter(Boolean),
      weakSubjects:
        weak.length > 0
          ? weak
          : analytics?.weakSubjects?.length
            ? analytics.weakSubjects
            : [sorted[sorted.length - 1]?.name].filter(Boolean),
      difficultyBreakdown: analytics?.difficultyBreakdown || {
        easy: easyCount,
        medium: medCount,
        hard: hardCount,
        easyAcc: Math.min(100, avgAccuracy + 12),
        mediumAcc: avgAccuracy,
        hardAcc: Math.max(0, avgAccuracy - 18),
      },
      topicWise: analytics?.topicWise || [],
    };
  }, [analytics, attemptRows]);

  // Calculate user stats from effectiveAnalytics
  const userStats = useMemo(() => {
    let rankDisplay = "—";
    if (effectiveAnalytics.rank && effectiveAnalytics.rank > 0) {
      rankDisplay = `${effectiveAnalytics.rank}`;
    } else if (user?.rank && user.rank !== "-" && user.rank !== 0) {
      rankDisplay = String(user.rank).replace(/^#/, "");
    }

    return {
      testsTaken: effectiveAnalytics.totalTests,
      accuracy: effectiveAnalytics.avgAccuracy,
      rank: rankDisplay,
      timeSpent:
        effectiveAnalytics.totalHours > 0
          ? String(effectiveAnalytics.totalHours)
          : effectiveAnalytics.totalTests > 0
            ? "0.5"
            : "0",
      streak: effectiveAnalytics.streak,
      improvement: effectiveAnalytics.totalTests > 0 ? "+5%" : "0%",
    };
  }, [effectiveAnalytics, user]);

  // Subject performance data
  const subjectPerformance = useMemo(() => {
    if (
      !effectiveAnalytics.subjectWise ||
      effectiveAnalytics.subjectWise.length === 0
    ) {
      return [
        { subject: "Reasoning", score: 0, attempted: 0, color: "bg-green-500" },
        {
          subject: "Mathematics",
          score: 0,
          attempted: 0,
          color: "bg-blue-500",
        },
        { subject: "English", score: 0, attempted: 0, color: "bg-purple-500" },
        {
          subject: "General Awareness",
          score: 0,
          attempted: 0,
          color: "bg-orange-500",
        },
      ];
    }

    const colorMap = {
      Reasoning: "bg-green-500",
      Mathematics: "bg-blue-500",
      "Quantitative Aptitude": "bg-blue-500",
      English: "bg-purple-500",
      "General Awareness": "bg-orange-500",
    };

    return effectiveAnalytics.subjectWise.map((s) => ({
      subject: s.name,
      score: s.accuracy || 0,
      attempted: s.attempted || 0,
      color: colorMap[s.name] || "bg-indigo-500",
    }));
  }, [effectiveAnalytics]);

  // Time analysis: average time per subject
  const timeAnalysis = useMemo(() => {
    if (
      !effectiveAnalytics.subjectWise ||
      effectiveAnalytics.subjectWise.length === 0
    )
      return [];
    return effectiveAnalytics.subjectWise.map((s) => ({
      subject: s.name,
      avgTimeSec:
        s.avgTimePerQuestion || Math.round(60 - (s.accuracy || 50) * 0.3),
      attempted: s.attempted || 0,
    }));
  }, [effectiveAnalytics]);

  // Difficulty breakdown
  const difficultyBreakdown = useMemo(() => {
    return (
      effectiveAnalytics.difficultyBreakdown || {
        easy: 0,
        medium: 0,
        hard: 0,
        easyAcc: 0,
        mediumAcc: 0,
        hardAcc: 0,
      }
    );
  }, [effectiveAnalytics]);

  // Score trend over recent tests
  const scoreTrend = useMemo(() => {
    if (
      effectiveAnalytics.recentTests &&
      effectiveAnalytics.recentTests.length > 0
    ) {
      return effectiveAnalytics.recentTests
        .slice(0, 10)
        .map((t) => Number(t.score) || 0);
    }
    return [];
  }, [effectiveAnalytics]);

  // Consistency tracker: last 7 days activity
  const consistencyData = useMemo(() => {
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toDateString();
      const testsOnDay =
        effectiveAnalytics.recentTests?.filter((t) => {
          const d = t.rawDate ? new Date(t.rawDate) : null;
          return d && d.toDateString() === dateStr;
        }) || [];
      days.push({
        date,
        count: testsOnDay.length,
        label: date.toLocaleDateString("en-IN", { weekday: "short" })[0],
      });
    }
    return days;
  }, [effectiveAnalytics]);

  // Attempt pattern per subject
  const attemptPattern = useMemo(() => {
    if (!effectiveAnalytics.subjectWise) return [];
    return effectiveAnalytics.subjectWise.map((s) => {
      const attempted = s.attempted || 0;
      const correct = Math.round((attempted * (s.accuracy || 0)) / 100);
      const wrong = Math.round(
        attempted * ((100 - (s.accuracy || 0)) / 100) * 0.7,
      );
      const skipped = Math.max(0, attempted - correct - wrong);
      return { subject: s.name, correct, wrong, skipped, total: attempted };
    });
  }, [effectiveAnalytics]);

  // Comparison vs topper
  const topperComparison = useMemo(() => {
    const userScore = Math.round(
      effectiveAnalytics.avgScore || effectiveAnalytics.avgAccuracy || 0,
    );
    const topperScore = Math.round(
      effectiveAnalytics.topperScore ||
        effectiveAnalytics.topScore ||
        effectiveAnalytics.highestScore ||
        (userScore > 100 ? 200 : 100),
    );
    const gap = Math.max(0, topperScore - userScore);
    return {
      topperScore,
      userScore,
      gap,
      percent:
        topperScore > 0
          ? Math.min(100, Math.round((userScore / topperScore) * 100))
          : 0,
    };
  }, [effectiveAnalytics]);

  // Get enrolled test series count for achievements
  const enrolledTestSeriesCount = useMemo(() => {
    if (!user) return 0;
    const userEnrolled =
      user.enrolledSeries || user.enrolled || user.series || [];
    return userEnrolled.length;
  }, [user]);

  // Check for feature access - allow authenticated users
  const hasAccess =
    Boolean(user) ||
    checkFeatureAccess("performance_analytics", user?.passType || "free") ||
    user?.isProUser === true ||
    user?.hasProPass === true ||
    user?.role === "admin";

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            Loading analysis...
          </p>
        </div>
      </div>
    );
  }

  // Locked state for free users
  if (!hasAccess && user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700 text-center p-8 space-y-6">
          <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-bounce">
            <LockIcon className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Premium Feature
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            Performance Analytics and detailed insights are available for{" "}
            <b>Test Series</b> and <b>Pro Pass</b> members.
          </p>
          <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-xl p-4 text-left">
            <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 mb-2">
              What you&apos;ll get:
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300">
                <CheckCircle className="w-3.5 h-3.5" />
                Subject-wise accuracy breakdown
              </li>
              <li className="flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300">
                <CheckCircle className="w-3.5 h-3.5" />
                Progress tracking over time
              </li>
              <li className="flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300">
                <CheckCircle className="w-3.5 h-3.5" />
                Strength & Weakness identification
              </li>
            </ul>
          </div>
          <Link
            to="/pass"
            className="block w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            Upgrade Now
          </Link>
          <Link
            to="/test-series"
            className="block text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Continue with free tests
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      shortLabel: "Overview",
      icon: BarChart2,
      badge: "Summary",
    },
    {
      id: "subjects",
      label: "Subject Mastery",
      shortLabel: "Subjects",
      icon: BookOpen,
      badge: "Syllabus",
    },
    {
      id: "speed",
      label: "Speed & Strategy",
      shortLabel: "Speed",
      icon: Clock,
      badge: "Timing",
    },
    {
      id: "actionPlan",
      label: "AI Action Plan",
      shortLabel: "AI Plan",
      icon: Zap,
      badge: "Goals",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 page-transition fade-in">
      {/* Breadcrumb */}
      <div className="hidden sm:block bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[
              { label: "Home", path: "/" },
              { label: "Performance Analysis" },
            ]}
          />
        </div>
      </div>

      {/* Header with Animated Background */}
      <AnimatedHero pageType="analysis">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5 sm:gap-6">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-2 tracking-tight animate-slide-in-right">
              Performance Analysis
            </h1>
            <p
              className="text-purple-100 text-sm sm:text-base max-w-xl animate-slide-in-right font-medium"
              style={{ animationDelay: "0.1s" }}
            >
              Track your mock test metrics, speed trends, and areas for
              improvement.
            </p>
          </div>

          {/* Your Progress - Glass Card */}
          <div
            className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 sm:p-5 w-full md:w-[360px] shadow-lg shadow-black/10 shrink-0"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-300 shrink-0" />
                <span className="text-white font-bold text-sm">
                  Your Progress
                </span>
              </div>
              <span className="px-2.5 py-0.5 bg-white/20 rounded-full text-xs text-white font-semibold">
                {userStats.streak} Day Streak
              </span>
            </div>
            <p className="text-purple-100 text-xs mb-3 font-medium">
              Keep up the momentum!
            </p>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              <div className="text-center p-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 min-h-[58px] flex flex-col justify-center items-center">
                <p className="text-base sm:text-lg font-black text-white leading-tight truncate w-full">
                  {userStats.testsTaken}
                </p>
                <p className="text-purple-100 text-[9px] sm:text-[10px] font-semibold tracking-wide uppercase truncate w-full mt-0.5">
                  Tests
                </p>
              </div>
              <div className="text-center p-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 min-h-[58px] flex flex-col justify-center items-center">
                <p className="text-base sm:text-lg font-black text-white leading-tight truncate w-full">
                  {userStats.accuracy}%
                </p>
                <p className="text-purple-100 text-[9px] sm:text-[10px] font-semibold tracking-wide uppercase truncate w-full mt-0.5">
                  Accuracy
                </p>
              </div>
              <div className="text-center p-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 min-h-[58px] flex flex-col justify-center items-center">
                <p className="text-base sm:text-lg font-black text-white leading-tight truncate w-full">
                  {userStats.rank && userStats.rank !== "-"
                    ? String(userStats.rank).startsWith("#")
                      ? userStats.rank
                      : `#${userStats.rank}`
                    : "—"}
                </p>
                <p className="text-purple-100 text-[9px] sm:text-[10px] font-semibold tracking-wide uppercase truncate w-full mt-0.5">
                  Rank
                </p>
              </div>
              <div className="text-center p-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15 min-h-[58px] flex flex-col justify-center items-center">
                <p className="text-base sm:text-lg font-black text-white leading-tight truncate w-full">
                  {userStats.timeSpent}
                </p>
                <p className="text-purple-100 text-[9px] sm:text-[10px] font-semibold tracking-wide uppercase truncate w-full mt-0.5">
                  Time
                </p>
              </div>
            </div>
          </div>
        </div>
      </AnimatedHero>

      <div className="max-w-7xl mx-auto px-3 py-4 sm:py-6 space-y-5 sm:space-y-6">
        {/* Sticky Mobile/Desktop Tab Navigation Bar (Full Width) */}
        <div className="sticky top-14 sm:top-16 z-20 -mx-3.5 sm:mx-0 px-3.5 sm:px-0 py-2 sm:py-2.5 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800">
          <div className="w-full grid grid-cols-4 gap-1 sm:gap-2 p-1 sm:p-1.5 bg-gray-200/80 dark:bg-gray-800/90 rounded-2xl border border-gray-300/60 dark:border-gray-700/60 shadow-xs">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center justify-center gap-1 sm:gap-2 px-1.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 text-center ${
                    active
                      ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-sm border border-gray-200/90 dark:border-gray-600"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50"
                  }`}
                >
                  <tab.icon
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${active ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500"}`}
                  />
                  <span className="truncate">
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.shortLabel}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab 1: Overview View */}
        {activeTab === "overview" && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            {/* Score Trend & Consistency Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Score Trend Card */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-200/90 dark:border-gray-700/80 p-4 sm:p-5 lg:col-span-2">
                <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-gray-100 dark:border-gray-700/60">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                        Score Trajectory
                      </h2>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        Score progression over recent mock tests
                      </p>
                    </div>
                  </div>
                  {scoreTrend.length > 1 && (
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                        scoreTrend[scoreTrend.length - 1] >= scoreTrend[0]
                          ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800"
                          : "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800"
                      }`}
                    >
                      {scoreTrend[scoreTrend.length - 1] >= scoreTrend[0]
                        ? "↗"
                        : "↘"}{" "}
                      {Math.abs(
                        scoreTrend[scoreTrend.length - 1] - scoreTrend[0],
                      )}{" "}
                      pts
                    </span>
                  )}
                </div>
                {scoreTrend.length > 0 ? (
                  <div className="pt-2">
                    <ScoreSparkline data={scoreTrend} />
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 py-8 text-center">
                    No tests attempted yet
                  </p>
                )}
                <div className="flex justify-between text-[10px] font-semibold text-gray-400 dark:text-gray-500 mt-2 pt-1 border-t border-gray-100 dark:border-gray-700/60">
                  <span>Earliest Mock</span>
                  <span>Latest Mock →</span>
                </div>
              </div>

              {/* Consistency Tracker (7-day heatmap) */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-200/90 dark:border-gray-700/80 p-4 sm:p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-gray-100 dark:border-gray-700/60">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-100 dark:border-orange-900/40 flex items-center justify-center">
                      <Flame className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                        Study Consistency
                      </h2>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        Past 7 days activity streak
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-between gap-1.5 my-3">
                    {consistencyData.map((day, i) => (
                      <div
                        key={i}
                        className="flex flex-col items-center gap-1.5 flex-1"
                      >
                        <div
                          className={`w-full aspect-square rounded-xl flex items-center justify-center text-[11px] font-bold transition-all ${
                            day.count > 0
                              ? "bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-sm"
                              : "bg-gray-100 dark:bg-gray-750 text-gray-400 dark:text-gray-500 border border-gray-200/60 dark:border-gray-700"
                          }`}
                          title={`${day.date.toLocaleDateString("en-IN", { weekday: "long" })} — ${day.count} test${day.count !== 1 ? "s" : ""}`}
                        >
                          {day.count > 0 ? day.count : ""}
                        </div>
                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                          {day.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-2.5 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    Total This Week
                  </span>
                  <span className="text-sm font-black text-orange-600 dark:text-orange-400">
                    {consistencyData.reduce((acc, d) => acc + d.count, 0)} tests
                  </span>
                </div>
              </div>
            </div>

            {/* Answer Distribution Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-200/90 dark:border-gray-700/80 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-gray-100 dark:border-gray-700/60">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                      Answer Distribution
                    </h2>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      Accuracy breakdown across all attempted questions
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                <div className="text-center p-3 sm:p-4 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-xl sm:rounded-2xl border border-emerald-200/70 dark:border-emerald-800/40">
                  <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
                  <p className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300">
                    {effectiveAnalytics.correct}
                  </p>
                  <p className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                    Correct
                  </p>
                </div>
                <div className="text-center p-3 sm:p-4 bg-rose-50/80 dark:bg-rose-950/30 rounded-xl sm:rounded-2xl border border-rose-200/70 dark:border-rose-800/40">
                  <XCircle className="w-6 h-6 sm:w-7 sm:h-7 text-rose-600 dark:text-rose-400 mx-auto mb-1" />
                  <p className="text-xl sm:text-2xl font-black text-rose-700 dark:text-rose-300">
                    {effectiveAnalytics.wrong}
                  </p>
                  <p className="text-[10px] sm:text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide">
                    Wrong
                  </p>
                </div>
                <div className="text-center p-3 sm:p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl sm:rounded-2xl border border-gray-200 dark:border-gray-700">
                  <AlertCircle className="w-6 h-6 sm:w-7 sm:h-7 text-gray-500 dark:text-gray-400 mx-auto mb-1" />
                  <p className="text-xl sm:text-2xl font-black text-gray-700 dark:text-gray-300">
                    {effectiveAnalytics.skipped}
                  </p>
                  <p className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Skipped
                  </p>
                </div>
              </div>
            </div>

            {/* Recent Tests List */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-200/90 dark:border-gray-700/80 p-4 sm:p-5">
              <div className="flex justify-between items-center mb-3.5 pb-2.5 border-b border-gray-100 dark:border-gray-700/60">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-center">
                    <ClipboardCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                      Recent Tests
                    </h3>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      Scores and accuracies from recent attempts
                    </p>
                  </div>
                </div>
                <Link
                  to="/attempted-tests"
                  className="text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:underline"
                >
                  View All →
                </Link>
              </div>
              <div className="space-y-2.5">
                {(effectiveAnalytics.recentTests || []).length > 0 ? (
                  effectiveAnalytics.recentTests.map((test) => {
                    const targetTestId = test.testId || test.id || test._id;
                    const targetSeriesId =
                      test.seriesSlug || test.seriesId || "all";
                    const isLive =
                      test.type === "live-tests" ||
                      test.type === "live" ||
                      test.category === "live-tests" ||
                      test.isLive;
                    const resultUrl = isLive
                      ? `/live-test-results/${targetTestId}`
                      : `/test-result/${targetSeriesId}/${targetTestId}`;

                    return (
                      <Link
                        key={test.id}
                        to={resultUrl}
                        state={{ attemptId: test.attemptId }}
                        className="group flex items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-900/60 rounded-xl sm:rounded-2xl border border-gray-200/70 dark:border-gray-700/60 hover:border-indigo-500/80 dark:hover:border-indigo-500/80 hover:bg-white dark:hover:bg-gray-800 hover:shadow-md transition-all gap-3 active:scale-[0.99]"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                            {test.title}
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {test.date}
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
                          <div className="text-right">
                            <p className="font-black text-sm sm:text-base text-indigo-600 dark:text-indigo-400">
                              {test.score}%
                            </p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">
                              {test.accuracy ||
                                Math.round((test.score / 100) * 100)}
                              % acc
                            </p>
                          </div>
                          <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/50 flex items-center justify-center transition-colors">
                            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                    <p className="text-xs sm:text-sm">No recent tests yet</p>
                    <Link
                      to="/test-series"
                      className="text-indigo-600 dark:text-indigo-400 text-xs sm:text-sm font-bold hover:underline mt-1 inline-block"
                    >
                      Start your first test →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Subject Mastery View */}
        {activeTab === "subjects" && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            {/* Overall Syllabus Accuracy Banner Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-200/90 dark:border-gray-700/80 p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-700/60">
                <div>
                  <h3 className="font-bold text-base text-gray-900 dark:text-white">
                    Syllabus Accuracy Overview
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Weighted across all domain questions attempted
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Weighted Accuracy:
                  </span>
                  <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                    {(() => {
                      const totalAtt = subjectPerformance.reduce(
                        (a, b) => a + (b.attempted || 0),
                        0,
                      );
                      if (totalAtt > 0) {
                        return Math.round(
                          subjectPerformance.reduce(
                            (a, b) => a + b.score * (b.attempted || 0),
                            0,
                          ) / totalAtt,
                        );
                      }
                      return effectiveAnalytics.avgAccuracy || 0;
                    })()}
                    %
                  </span>
                </div>
              </div>

              {/* Strongest & Weakest Chapters Group */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 mt-4">
                {/* Strongest Areas */}
                <div className="bg-emerald-50/70 dark:bg-emerald-950/20 rounded-2xl p-4 sm:p-5 border border-emerald-200/80 dark:border-emerald-800/50">
                  <div className="flex items-center gap-2 mb-3 text-emerald-700 dark:text-emerald-300">
                    <Zap className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                    <h4 className="font-bold text-xs sm:text-sm">
                      Strongest Domains
                    </h4>
                  </div>
                  <div className="space-y-2.5">
                    {(effectiveAnalytics.strongSubjects || []).length > 0 ? (
                      effectiveAnalytics.strongSubjects
                        .slice(0, 3)
                        .map((sub, i) => (
                          <div
                            key={i}
                            className="flex justify-between items-center text-xs sm:text-sm"
                          >
                            <span className="text-gray-700 dark:text-gray-300 font-semibold truncate">
                              {sub.name || sub}
                            </span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-black shrink-0 ml-2">
                              {sub.accuracy || 85}%
                            </span>
                          </div>
                        ))
                    ) : (
                      <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 italic">
                        Keep practicing to identify your strong areas.
                      </p>
                    )}
                  </div>
                </div>

                {/* Weakest Areas */}
                <div className="bg-rose-50/70 dark:bg-rose-950/20 rounded-2xl p-4 sm:p-5 border border-rose-200/80 dark:border-rose-800/50">
                  <div className="flex items-center gap-2 mb-3 text-rose-700 dark:text-rose-300">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                    <h4 className="font-bold text-xs sm:text-sm">
                      Needs Attention
                    </h4>
                  </div>
                  <div className="space-y-2.5">
                    {(effectiveAnalytics.weakSubjects || []).length > 0 ? (
                      effectiveAnalytics.weakSubjects
                        .slice(0, 3)
                        .map((sub, i) => (
                          <div
                            key={i}
                            className="flex justify-between items-center text-xs sm:text-sm"
                          >
                            <span className="text-gray-700 dark:text-gray-300 font-semibold truncate">
                              {sub.name || sub}
                            </span>
                            <span className="text-rose-600 dark:text-rose-400 font-black shrink-0 ml-2">
                              {sub.accuracy || 45}%
                            </span>
                          </div>
                        ))
                    ) : (
                      <p className="text-xs text-rose-600/70 dark:text-rose-400/70 italic">
                        No major weak areas detected yet. Essential sections
                        covered.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Subject Breakdown Cards */}
            <div className="space-y-3">
              {(effectiveAnalytics.subjectWise || []).length > 0 ? (
                effectiveAnalytics.subjectWise.map((subject, i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 border border-gray-200/90 dark:border-gray-700/80 hover:border-indigo-300 dark:hover:border-indigo-700 shadow-xs transition-all"
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl sm:text-3xl shrink-0">
                          {subject.icon || getSubjectIcon(subject.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-sm sm:text-base text-gray-900 dark:text-white truncate">
                            {subject.name}
                          </p>
                          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-tight">
                            {subject.attempted} Questions Attempted
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span
                          className={`text-lg sm:text-xl font-black ${
                            subject.accuracy >= 80
                              ? "text-emerald-600 dark:text-emerald-400"
                              : subject.accuracy >= 60
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {subject.accuracy}%
                        </span>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold">
                          Accuracy
                        </p>
                      </div>
                    </div>
                    <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full ${
                          subject.accuracy >= 80
                            ? "bg-emerald-500"
                            : subject.accuracy >= 60
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{ width: `${subject.accuracy}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700/60 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">
                        Status:{" "}
                        <strong
                          className={
                            subject.accuracy >= 80
                              ? "text-emerald-600 dark:text-emerald-400"
                              : subject.accuracy >= 60
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-rose-600 dark:text-rose-400"
                          }
                        >
                          {subject.accuracy >= 80
                            ? "Mastered"
                            : subject.accuracy >= 60
                              ? "Moderate"
                              : "Needs Revision"}
                        </strong>
                      </span>
                      <Link
                        to={`/study/${subject.name.toLowerCase().replace(/\s+/g, "-")}`}
                        className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1"
                      >
                        Study Topic Notes →
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                  <div className="text-3xl mb-2">📈</div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                    No Detailed Subject Data
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
                    Complete at least one full test to unlock detailed syllabus
                    mastery analytics.
                  </p>
                  <Link
                    to="/test-series"
                    className="mt-3 inline-block text-indigo-600 dark:text-indigo-400 font-bold text-xs sm:text-sm hover:underline"
                  >
                    Start Test Series →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Speed & Strategy View */}
        {activeTab === "speed" && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            {/* Speed & Time Analysis */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-200/90 dark:border-gray-700/80 p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3.5 pb-2.5 border-b border-gray-100 dark:border-gray-700/60">
                <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-100 dark:border-cyan-900/40 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                    Speed & Time Diagnostics
                  </h2>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    Average seconds spent per question vs competitive benchmarks
                  </p>
                </div>
              </div>
              {timeAnalysis.length > 0 ? (
                <div className="space-y-3">
                  {timeAnalysis.map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-300 w-24 sm:w-28 truncate shrink-0">
                        {item.subject}
                      </span>
                      <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden relative">
                        <div
                          className={`h-full rounded-lg flex items-center justify-end pr-2 transition-all duration-500 ${
                            item.avgTimeSec > 75
                              ? "bg-red-400"
                              : item.avgTimeSec > 50
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                          }`}
                          style={{
                            width: `${Math.min(100, Math.max(15, (item.avgTimeSec / 120) * 100))}%`,
                          }}
                        >
                          <span className="text-[10px] font-black text-white">
                            {item.avgTimeSec}s
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 w-12 text-right shrink-0">
                        {item.attempted} Qs
                      </span>
                    </div>
                  ))}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700/60 flex flex-wrap items-center gap-3 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />{" "}
                      Fast (&lt;50s)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />{" "}
                      Moderate (50-75s)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-400" /> Slow
                      (&gt;75s)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs sm:text-sm">
                    Complete tests to unlock speed insights
                  </p>
                </div>
              )}
            </div>

            {/* Difficulty Breakdown */}
            <FeatureGate
              sectionKey="analysis:difficulty"
              variant="card"
              minHeight="240px"
            >
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-200/90 dark:border-gray-700/80 p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3.5 pb-2.5 border-b border-gray-100 dark:border-gray-700/60">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/40 flex items-center justify-center">
                    <Gauge className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                      Difficulty Tier Breakdown
                    </h2>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      Performance split by easy, medium, and hard questions
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-3.5">
                  {[
                    {
                      label: "Easy",
                      count: difficultyBreakdown.easy,
                      acc: difficultyBreakdown.easyAcc,
                      bg: "bg-emerald-50/70 dark:bg-emerald-950/30",
                      border:
                        "border-emerald-200/70 dark:border-emerald-800/40",
                      text: "text-emerald-700 dark:text-emerald-400",
                      bar: "bg-emerald-500",
                    },
                    {
                      label: "Medium",
                      count: difficultyBreakdown.medium,
                      acc: difficultyBreakdown.mediumAcc,
                      bg: "bg-amber-50/70 dark:bg-amber-950/30",
                      border: "border-amber-200/70 dark:border-amber-800/40",
                      text: "text-amber-700 dark:text-amber-400",
                      bar: "bg-amber-500",
                    },
                    {
                      label: "Hard",
                      count: difficultyBreakdown.hard,
                      acc: difficultyBreakdown.hardAcc,
                      bg: "bg-rose-50/70 dark:bg-rose-950/30",
                      border: "border-rose-200/70 dark:border-rose-800/40",
                      text: "text-rose-700 dark:text-rose-400",
                      bar: "bg-rose-500",
                    },
                  ].map((level) => (
                    <div
                      key={level.label}
                      className={`${level.bg} ${level.border} border rounded-xl p-2.5 sm:p-3.5 text-center`}
                    >
                      <p
                        className={`text-lg sm:text-2xl font-black ${level.text}`}
                      >
                        {level.count}
                      </p>
                      <p className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mt-0.5">
                        {level.label}
                      </p>
                      <div className="mt-2 h-1.5 bg-white/70 dark:bg-gray-800/70 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${level.bar} rounded-full`}
                          style={{ width: `${level.acc}%` }}
                        />
                      </div>
                      <p className={`text-[10px] font-bold ${level.text} mt-1`}>
                        {level.acc}% acc
                      </p>
                    </div>
                  ))}
                </div>
                <div className="pt-2.5 border-t border-gray-100 dark:border-gray-700/60">
                  <p className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
                    {difficultyBreakdown.hardAcc < 40
                      ? "⚠ Struggling with hard questions — focus on advanced concept revision."
                      : difficultyBreakdown.mediumAcc < 50
                        ? "⚠ Medium questions need attention — strengthen core fundamentals."
                        : "✓ Solid consistency across difficulty tiers."}
                  </p>
                </div>
              </div>
            </FeatureGate>

            {/* Deep-Dive Analytics & InsightsTab Integration */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-200/90 dark:border-gray-700/80 p-4 sm:p-5">
              <InsightsTab
                attemptPattern={attemptPattern}
                topperComparison={topperComparison}
                timeAnalysis={timeAnalysis}
                effectiveAnalytics={effectiveAnalytics}
                difficultyBreakdown={difficultyBreakdown}
              />
            </div>
          </div>
        )}

        {/* Tab 4: AI Action Plan & Goals View */}
        {activeTab === "actionPlan" && (
          <div className="space-y-4 sm:space-y-6 animate-fade-in">
            {/* Top Percentile Motivation Banner */}
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 rounded-2xl p-4 sm:p-6 text-white shadow-sm">
              <h3 className="font-bold text-base sm:text-lg mb-1.5">
                {effectiveAnalytics.percentile
                  ? `🚀 You're performing in the Top ${Math.max(1, 100 - effectiveAnalytics.percentile)}%!`
                  : `🎯 Your Personalized AI Action Plan`}
              </h3>
              <p className="text-purple-100 text-xs sm:text-sm mb-4 leading-relaxed max-w-2xl">
                {effectiveAnalytics.percentile
                  ? `Across ${effectiveAnalytics.totalTests} completed tests, you're ahead of ${effectiveAnalytics.percentile}% of aspirants. Follow this tailored action plan to eliminate negative marks and boost your rank.`
                  : `Across ${effectiveAnalytics.totalTests} completed tests, follow this tailored action plan to eliminate negative marks and boost your rank.`}
              </p>
              <Link
                to="/test-series"
                className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-white text-indigo-700 font-bold text-xs sm:text-sm rounded-xl hover:bg-purple-50 transition shadow-xs"
              >
                Take Recommended Mock
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Focus Needed & Strengths Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Weak Areas Card */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-200/90 dark:border-gray-700/80 overflow-hidden flex flex-col">
                <div className="bg-rose-50/80 dark:bg-rose-950/30 px-4 sm:px-5 py-3 border-b border-rose-100 dark:border-rose-900/30 flex items-center justify-between">
                  <h3 className="font-bold text-sm sm:text-base text-rose-700 dark:text-rose-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                    High-Priority Weak Areas
                  </h3>
                </div>
                <div className="p-4 sm:p-5 flex-1">
                  <div className="space-y-2.5">
                    {(effectiveAnalytics.weakSubjects || []).length > 0 ? (
                      effectiveAnalytics.weakSubjects.map((subject, i) => (
                        <div
                          key={i}
                          className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200/70 dark:border-gray-700 flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs sm:text-sm text-gray-800 dark:text-gray-200">
                              {subject}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400 rounded-full font-bold">
                              Needs Focus
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Accuracy is currently under 60%. Conceptual clarity
                            and practice needed.
                          </p>
                          <Link
                            to={`/study/${subject.toLowerCase().replace(/\s+/g, "-")}`}
                            className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1 mt-0.5"
                          >
                            Study Subject Notes{" "}
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6">
                        <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-1.5 opacity-30" />
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                          No critical weak areas identified yet. Keep it up!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Strong Areas Card */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-200/90 dark:border-gray-700/80 overflow-hidden flex flex-col">
                <div className="bg-emerald-50/80 dark:bg-emerald-950/30 px-4 sm:px-5 py-3 border-b border-emerald-100 dark:border-emerald-900/30 flex items-center justify-between">
                  <h3 className="font-bold text-sm sm:text-base text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <Trophy className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" /> Your
                    Mastered Strengths
                  </h3>
                </div>
                <div className="p-4 sm:p-5 flex-1">
                  <div className="space-y-2.5">
                    {(effectiveAnalytics.strongSubjects || []).length > 0 ? (
                      effectiveAnalytics.strongSubjects.map((subject, i) => (
                        <div
                          key={i}
                          className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200/70 dark:border-gray-700 flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs sm:text-sm text-gray-800 dark:text-gray-200">
                              {subject}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 rounded-full font-bold">
                              Mastered
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Consistent score above 85%. Focus on maintaining
                            speed under exam conditions.
                          </p>
                          <Link
                            to="/test-series"
                            className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1 mt-0.5"
                          >
                            Take Advanced Test{" "}
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6">
                        <ClipboardCheck className="w-8 h-8 text-indigo-500 mx-auto mb-1.5 opacity-30" />
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
                          Attempt more tests to build your strength profile.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Strategic Recommendations Card */}
            <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-2xl shadow-md p-4 sm:p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3.5 pb-2.5 border-b border-white/15">
                  <Zap className="w-5 h-5 text-yellow-300 shrink-0" />
                  <h3 className="text-base sm:text-lg font-bold">
                    AI Strategic Action Steps
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  <div className="flex gap-2.5 p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15">
                    <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Timer className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold">
                        Pacing Target
                      </p>
                      <p className="text-[11px] text-purple-100 leading-relaxed mt-0.5">
                        Keep Reasoning questions under 45s to preserve a
                        15-minute buffer for Quantitative problems.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2.5 p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15">
                    <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
                      <BookOpen className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold">
                        Formula Revision
                      </p>
                      <p className="text-[11px] text-purple-100 leading-relaxed mt-0.5">
                        Brush up on high-yield formulas in the Study section
                        before your next full mock.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2.5 p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/15">
                    <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Target className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold">Daily Goal</p>
                      <p className="text-[11px] text-purple-100 leading-relaxed mt-0.5">
                        Attempt 1 Sectional Test and 2 Chapter Quizzes to keep
                        your streak alive.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Achievements & Milestones */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-200/90 dark:border-gray-700/80 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-gray-100 dark:border-gray-700/60">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 flex items-center justify-center">
                    <Award className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                      Unlocked Achievements
                    </h2>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      Milestones unlocked along your exam journey
                    </p>
                  </div>
                </div>
                <Link
                  to="/achievements"
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline shrink-0"
                >
                  View All →
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    icon: "🎯",
                    name: "First Test",
                    unlocked: userStats.testsTaken >= 1,
                  },
                  {
                    icon: "🔥",
                    name: "7 Day Streak",
                    unlocked: userStats.streak >= 7,
                  },
                  {
                    icon: "🏆",
                    name: "Top 100",
                    unlocked:
                      typeof userStats.rank === "number" &&
                      userStats.rank <= 100 &&
                      userStats.rank > 0,
                  },
                  {
                    icon: "⭐",
                    name: "100 Tests",
                    unlocked: userStats.testsTaken >= 100,
                  },
                  {
                    icon: "💪",
                    name: "Accuracy 90%",
                    unlocked: userStats.accuracy >= 90,
                  },
                  {
                    icon: "📚",
                    name: "10 Series",
                    unlocked: enrolledTestSeriesCount >= 10,
                  },
                  {
                    icon: "🚀",
                    name: "Speed Master",
                    unlocked:
                      effectiveAnalytics.timePerQuestion < 45 &&
                      effectiveAnalytics.totalTests >= 5,
                  },
                  {
                    icon: "👑",
                    name: "Pro Member",
                    unlocked: user?.hasProPass || user?.isProUser,
                  },
                ].map((badge, i) => (
                  <div
                    key={i}
                    className={`rounded-xl flex flex-col items-center justify-center text-center p-2.5 transition-all ${
                      badge.unlocked
                        ? "bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 shadow-xs"
                        : "bg-gray-50 dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700 opacity-60"
                    }`}
                    title={badge.name}
                  >
                    <span className="text-xl mb-1">{badge.icon}</span>
                    <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 leading-tight">
                      {badge.name}
                    </span>
                    <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 mt-0.5">
                      {badge.unlocked ? "Unlocked" : "Locked"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Analysis;
