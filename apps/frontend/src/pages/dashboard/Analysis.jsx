import { useState, useEffect, useMemo } from "react";
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
  Activity,
  Gauge,
  Layers,
  Wind,
  Brain,
} from "lucide-react";
import { checkFeatureAccess } from "../../shared/utils/pass-helpers";

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
        console.error("Failed to fetch series:", error);
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
        console.error("Failed to fetch analytics:", error);
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
        ? analytics.percentile
        : count > 0
          ? Math.min(99, Math.max(50, Math.round(70 + avgAccuracy * 0.28)))
          : 0;

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
    user?.role === "admin" ||
    user?.role === "superadmin";

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
              What you'll get:
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
    { id: "overview", label: "Overview", icon: BarChart2 },
    { id: "subjects", label: "Subject Wise", icon: BookOpen },
    { id: "insights", label: "Insights", icon: Activity },
    { id: "progress", label: "Progress", icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 page-transition fade-in">
      {/* Breadcrumb */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl md:text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2 animate-slide-in-right">
              Performance Analysis
            </h1>
            <p
              className="text-purple-100 text-lg animate-slide-in-right"
              style={{ animationDelay: "0.1s" }}
            >
              Track your progress and identify areas for improvement
            </p>
          </div>

          {/* Your Progress - Glass Card UI from Dashboard */}
          <div
            className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-5 md:w-[350px] animate-slide-in-right"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-5 h-5 text-orange-300" />
              <span className="text-white font-bold text-sm">
                Your Progress
              </span>
              <span className="ml-auto px-2 py-0.5 bg-white/20 rounded-full text-xs text-white font-medium">
                {userStats.streak} Day Streak
              </span>
            </div>
            <p className="text-purple-100 text-xs mb-4">
              Keep up the great work!
            </p>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              <div className="text-center p-1.5 sm:p-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 min-h-[56px] sm:min-h-[64px] flex flex-col justify-center items-center">
                <p className="text-base sm:text-xl font-bold text-white leading-none truncate w-full">
                  {userStats.testsTaken}
                </p>
                <p className="text-purple-100 text-[9px] sm:text-[10px] mt-1 font-semibold tracking-wide uppercase truncate w-full">
                  Tests
                </p>
              </div>
              <div className="text-center p-1.5 sm:p-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 min-h-[56px] sm:min-h-[64px] flex flex-col justify-center items-center">
                <p className="text-base sm:text-xl font-bold text-white leading-none truncate w-full">
                  {userStats.accuracy}%
                </p>
                <p className="text-purple-100 text-[9px] sm:text-[10px] mt-1 font-semibold tracking-wide uppercase truncate w-full">
                  Accuracy
                </p>
              </div>
              <div className="text-center p-1.5 sm:p-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 min-h-[56px] sm:min-h-[64px] flex flex-col justify-center items-center">
                <p className="text-base sm:text-xl font-bold text-white leading-none truncate w-full">
                  {userStats.rank && userStats.rank !== "-"
                    ? String(userStats.rank).startsWith("#")
                      ? userStats.rank
                      : `#${userStats.rank}`
                    : "—"}
                </p>
                <p className="text-purple-100 text-[9px] sm:text-[10px] mt-1 font-semibold tracking-wide uppercase truncate w-full">
                  Rank
                </p>
              </div>
              <div className="text-center p-1.5 sm:p-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 min-h-[56px] sm:min-h-[64px] flex flex-col justify-center items-center">
                <p className="text-base sm:text-xl font-bold text-white leading-none truncate w-full">
                  {userStats.timeSpent}
                </p>
                <p className="text-purple-100 text-[9px] sm:text-[10px] mt-1 font-semibold tracking-wide uppercase truncate w-full">
                  Time
                </p>
              </div>
            </div>
          </div>
        </div>
      </AnimatedHero>

      <div className="max-w-7xl mx-auto px-4 pb-6 min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Your Progress Section */}

        {/* Subject Performance & Achievements Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Subject Performance */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Subject Performance
              </h2>
            </div>
            <div className="space-y-4">
              {subjectPerformance.map((subject, index) => (
                <div
                  key={subject.subject}
                  className="animate-slide-in-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {subject.subject}
                      </span>
                      <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full text-gray-500 dark:text-gray-400 font-bold">
                        {subject.attempted} Qs
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {subject.score}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${subject.color} rounded-full transition-all duration-500`}
                      style={{ width: `${subject.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Overall Score
                </span>
                <span className="text-lg font-bold text-brand-start dark:text-indigo-400">
                  {Math.round(
                    subjectPerformance.reduce((a, b) => a + b.score, 0) /
                      subjectPerformance.length,
                  )}
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Achievements - Compact */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Achievements
              </h2>
              <Link
                to="/achievements"
                className="text-[10px] text-brand-start dark:text-indigo-400 font-medium hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
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
              ]
                .slice(0, 8)
                .map((badge, i) => (
                  <div
                    key={i}
                    className={`rounded-lg flex flex-col items-center justify-center text-center p-1.5 transition-all ${
                      badge.unlocked
                        ? "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800"
                        : "bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 opacity-50"
                    }`}
                    title={badge.name}
                  >
                    <span className="text-sm">{badge.icon}</span>
                    <span className="text-[7px] text-gray-600 dark:text-gray-400 mt-0.5 leading-tight">
                      {badge.name}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="p-3 grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {effectiveAnalytics.totalTests}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tests Attempted
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {effectiveAnalytics.avgAccuracy}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Avg Accuracy
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Award className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  #{effectiveAnalytics.rank || "—"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  All India Rank
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {effectiveAnalytics.percentile}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Percentile
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Score Trend & Consistency Tracker */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Score Trend Sparkline */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  Score Trend
                </h2>
              </div>
              {scoreTrend.length > 1 && (
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-full ${scoreTrend[scoreTrend.length - 1] >= scoreTrend[0] ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20" : "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20"}`}
                >
                  {scoreTrend[scoreTrend.length - 1] >= scoreTrend[0]
                    ? "↗"
                    : "↘"}{" "}
                  {Math.abs(scoreTrend[scoreTrend.length - 1] - scoreTrend[0])}{" "}
                  pts
                </span>
              )}
            </div>
            {scoreTrend.length > 0 ? (
              <ScoreSparkline data={scoreTrend} />
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500 py-8 text-center">
                No tests attempted yet
              </p>
            )}
            <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-2">
              <span>Oldest</span>
              <span>Recent Tests →</span>
            </div>
          </div>

          {/* Consistency Tracker (7-day heatmap) */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Flame className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Consistency
              </h2>
            </div>
            <div className="flex justify-between gap-1.5 mb-3">
              {consistencyData.map((day, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1.5 flex-1"
                >
                  <div
                    className={`w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold transition-all ${
                      day.count > 0
                        ? "bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-sm"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500"
                    }`}
                    title={`${day.date.toLocaleDateString("en-IN", { weekday: "long" })} — ${day.count} test${day.count !== 1 ? "s" : ""}`}
                  >
                    {day.count > 0 ? day.count : ""}
                  </div>
                  <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500">
                    {day.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                This Week
              </span>
              <span className="text-sm font-black text-orange-600 dark:text-orange-400">
                {consistencyData.reduce((acc, d) => acc + d.count, 0)} tests
              </span>
            </div>
          </div>
        </div>

        {/* Time Analysis + Difficulty Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Time Analysis — avg time per subject */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                <Clock className="w-4 h-4 text-cyan-600" />
              </div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Time Analysis
              </h2>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                Avg seconds per question
              </span>
            </div>
            {timeAnalysis.length > 0 ? (
              <div className="space-y-3">
                {timeAnalysis.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 w-28 truncate flex-shrink-0">
                      {item.subject}
                    </span>
                    <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden relative">
                      <div
                        className={`h-full rounded-lg flex items-center justify-end pr-2 transition-all duration-500 ${item.avgTimeSec > 75 ? "bg-red-400" : item.avgTimeSec > 50 ? "bg-amber-400" : "bg-emerald-400"}`}
                        style={{
                          width: `${Math.min(100, (item.avgTimeSec / 120) * 100)}%`,
                        }}
                      >
                        <span className="text-[9px] font-bold text-white">
                          {item.avgTimeSec}s
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 w-12 text-right">
                      {item.attempted} Qs
                    </span>
                  </div>
                ))}
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center gap-4 text-[10px] text-gray-400 dark:text-gray-500">
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
                <p className="text-sm">Complete tests to see time analysis</p>
              </div>
            )}
          </div>

          {/* Difficulty Breakdown */}
          <FeatureGate
            sectionKey="analysis:difficulty"
            variant="card"
            minHeight="240px"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Gauge className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  Difficulty Breakdown
                </h2>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  {
                    label: "Easy",
                    count: difficultyBreakdown.easy,
                    acc: difficultyBreakdown.easyAcc,
                    color: "emerald",
                    bg: "bg-emerald-50 dark:bg-emerald-900/20",
                    text: "text-emerald-600 dark:text-emerald-400",
                    bar: "bg-emerald-500",
                  },
                  {
                    label: "Medium",
                    count: difficultyBreakdown.medium,
                    acc: difficultyBreakdown.mediumAcc,
                    color: "amber",
                    bg: "bg-amber-50 dark:bg-amber-900/20",
                    text: "text-amber-600 dark:text-amber-400",
                    bar: "bg-amber-500",
                  },
                  {
                    label: "Hard",
                    count: difficultyBreakdown.hard,
                    acc: difficultyBreakdown.hardAcc,
                    color: "rose",
                    bg: "bg-rose-50 dark:bg-rose-900/20",
                    text: "text-rose-600 dark:text-rose-400",
                    bar: "bg-rose-500",
                  },
                ].map((level) => (
                  <div
                    key={level.label}
                    className={`${level.bg} rounded-xl p-4 text-center`}
                  >
                    <p className={`text-2xl font-black ${level.text}`}>
                      {level.count}
                    </p>
                    <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-0.5">
                      {level.label}
                    </p>
                    <div className="mt-2 h-1 bg-white/50 dark:bg-gray-800/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${level.bar} rounded-full`}
                        style={{ width: `${level.acc}%` }}
                      />
                    </div>
                    <p className={`text-[9px] font-bold ${level.text} mt-1`}>
                      {level.acc}% acc
                    </p>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  {difficultyBreakdown.hardAcc < 40
                    ? "⚠ Struggling with hard questions — focus on advanced concepts."
                    : difficultyBreakdown.mediumAcc < 50
                      ? "⚠ Medium questions need attention — strengthen fundamentals."
                      : "✓ Good performance across difficulty levels."}
                </p>
              </div>
            </div>
          </FeatureGate>
        </div>

        {/* New Insights Section: Strengths, Weaknesses & Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Weak Areas */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
            <div className="bg-red-50 dark:bg-red-900/10 px-5 py-4 border-b border-red-100 dark:border-red-900/20 flex items-center justify-between">
              <h3 className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> Area for Improvement
              </h3>
            </div>
            <div className="p-5 flex-1">
              <div className="space-y-3">
                {(effectiveAnalytics.weakSubjects || []).length > 0 ? (
                  effectiveAnalytics.weakSubjects.map((subject, i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-800 dark:text-gray-200">
                          {subject}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full font-bold">
                          Needs Focus
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Score below 60%. Conceptual clarity needed.
                      </p>
                      <Link
                        to={`/study/${subject.toLowerCase().replace(" ", "-")}`}
                        className="text-[10px] text-brand-start font-bold hover:underline mt-1 inline-flex items-center gap-1"
                      >
                        Start Learning <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2 opacity-20" />
                    <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                      No weak areas identified yet. Keep it up!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Strong Areas */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col">
            <div className="bg-green-50 dark:bg-green-900/10 px-5 py-4 border-b border-green-100 dark:border-green-900/20 flex items-center justify-between">
              <h3 className="font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                <Trophy className="w-5 h-5" /> Your Strengths
              </h3>
            </div>
            <div className="p-5 flex-1">
              <div className="space-y-3">
                {(effectiveAnalytics.strongSubjects || []).length > 0 ? (
                  effectiveAnalytics.strongSubjects.map((subject, i) => (
                    <div
                      key={i}
                      className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-800 dark:text-gray-200">
                          {subject}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full font-bold">
                          Mastered
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Consistent score above 85%. Maintaining speed is key.
                      </p>
                      <Link
                        to="/test-series"
                        className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline mt-1 inline-flex items-center gap-1"
                      >
                        Take Advance Test <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <ClipboardCheck className="w-8 h-8 text-indigo-500 mx-auto mb-2 opacity-20" />
                    <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                      Analyze more tests to identify your strengths.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* AI Recommended Actions */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-lg p-6 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex-1">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-6 h-6 text-yellow-300" />
                <h3 className="text-xl font-bold">AI Recommendations</h3>
              </div>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Timer className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Reduce Time Lag</p>
                    <p className="text-xs text-purple-100">
                      Spend less than 45s on Reasoning questions to save time
                      for Maths.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Concept Review</p>
                    <p className="text-xs text-purple-100">
                      Review 'Percentage' and 'Profit & Loss' videos in the
                      Study tab.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Suggested Daily Goal</p>
                    <p className="text-xs text-purple-100">
                      Attempt 1 Sectional Test and 2 Chapter Quizzes today.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <Link
              to="/test-series"
              className="relative z-10 mt-6 block w-full py-3 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 text-center font-bold rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 transition shadow-lg"
            >
              Take Action Now
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
          <div className="flex border-b border-gray-100 dark:border-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "text-brand-start border-b-2 border-brand-start"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Accuracy Breakdown */}
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                    Answer Distribution
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                      <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {effectiveAnalytics.correct}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Correct
                      </p>
                    </div>
                    <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl">
                      <XCircle className="w-8 h-8 text-red-600 dark:text-red-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {effectiveAnalytics.wrong}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Wrong
                      </p>
                    </div>
                    <div className="text-center p-4 bg-gray-100 dark:bg-gray-700 rounded-xl">
                      <AlertCircle className="w-8 h-8 text-gray-500 dark:text-gray-400 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">
                        {effectiveAnalytics.skipped}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Skipped
                      </p>
                    </div>
                  </div>
                </div>

                {/* Recent Tests */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      Recent Tests
                    </h3>
                    <Link
                      to="/attempted-tests"
                      className="text-brand-start text-sm font-medium hover:underline"
                    >
                      View All
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {(effectiveAnalytics.recentTests || []).length > 0 ? (
                      effectiveAnalytics.recentTests.map((test) => (
                        <div
                          key={test.id}
                          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-xl"
                        >
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {test.title}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {test.date}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-brand-start">
                              {test.score}%
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {test.accuracy ||
                                Math.round((test.score / 100) * 100)}
                              % accuracy
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <p>No recent tests yet</p>
                        <Link
                          to="/test-series"
                          className="text-brand-start text-sm font-medium hover:underline"
                        >
                          Start your first test →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Subject Wise Tab */}
            {activeTab === "subjects" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    Subject-wise Performance
                  </h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Based on recently attempted tests
                  </span>
                </div>

                {/* Weak/Strong Chapters Summary Group */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Strongest Areas */}
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-5 border border-green-100 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-4 text-green-700 dark:text-green-300">
                      <Zap className="w-5 h-5" />
                      <h4 className="font-bold">Strongest Chapters</h4>
                    </div>
                    <div className="space-y-3">
                      {(effectiveAnalytics.strongSubjects || []).length > 0 ? (
                        effectiveAnalytics.strongSubjects
                          .slice(0, 3)
                          .map((sub, i) => (
                            <div
                              key={i}
                              className="flex justify-between items-center text-sm"
                            >
                              <span className="text-gray-700 dark:text-gray-300 font-medium">
                                {sub.name || sub}
                              </span>
                              <span className="text-green-600 dark:text-green-400 font-bold">
                                {sub.accuracy || 85}%
                              </span>
                            </div>
                          ))
                      ) : (
                        <p className="text-xs text-green-600/70 dark:text-green-400/70 italic">
                          Keep practicing to identify your strong areas.
                        </p>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
                      <p className="text-[10px] text-green-700 dark:text-green-300 font-bold uppercase tracking-wider mb-1">
                        Recommended Action
                      </p>
                      <p className="text-xs text-green-800 dark:text-green-200">
                        Review these once a week to maintain speed. Focus on
                        advanced level problems.
                      </p>
                    </div>
                  </div>

                  {/* Weakest Areas */}
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-5 border border-red-100 dark:border-red-800/60">
                    <div className="flex items-center gap-2 mb-4 text-red-700 dark:text-red-300">
                      <AlertCircle className="w-5 h-5" />
                      <h4 className="font-bold">Needs Improvement</h4>
                    </div>
                    <div className="space-y-3">
                      {(effectiveAnalytics.weakSubjects || []).length > 0 ? (
                        effectiveAnalytics.weakSubjects
                          .slice(0, 3)
                          .map((sub, i) => (
                            <div
                              key={i}
                              className="flex justify-between items-center text-sm"
                            >
                              <span className="text-gray-700 dark:text-gray-300 font-medium">
                                {sub.name || sub}
                              </span>
                              <span className="text-red-600 dark:text-red-400 font-bold">
                                {sub.accuracy || 45}%
                              </span>
                            </div>
                          ))
                      ) : (
                        <p className="text-xs text-red-600/70 dark:text-red-400/70 italic">
                          No major weak areas detected yet. Essential sections
                          covered.
                        </p>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-red-200 dark:border-red-800">
                      <p className="text-[10px] text-red-700 dark:text-red-300 font-bold uppercase tracking-wider mb-1">
                        Impact Action
                      </p>
                      <p className="text-xs text-red-800 dark:text-red-200">
                        Watch subject videos and take chapter-wise quizzes to
                        build basics.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {(effectiveAnalytics.subjectWise || []).length > 0 ? (
                    effectiveAnalytics.subjectWise.map((subject, i) => (
                      <div
                        key={i}
                        className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:border-brand-start/20 transition-all"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">
                              {subject.icon || "📚"}
                            </span>
                            <div>
                              <p className="font-bold text-gray-900 dark:text-white">
                                {subject.name}
                              </p>
                              <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tight">
                                {subject.attempted} Qs attempted
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-lg font-black ${
                                subject.accuracy >= 80
                                  ? "text-green-600 dark:text-green-400"
                                  : subject.accuracy >= 60
                                    ? "text-yellow-600 dark:text-yellow-400"
                                    : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {subject.accuracy}%
                            </p>
                            <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold">
                              Accuracy
                            </p>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              subject.accuracy >= 80
                                ? "bg-green-500"
                                : subject.accuracy >= 60
                                  ? "bg-yellow-500"
                                  : "bg-red-500"
                            }`}
                            style={{ width: `${subject.accuracy}%` }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                      <div className="text-2xl sm:text-3xl lg:text-4xl mb-3">
                        📈
                      </div>
                      <h4 className="font-bold text-gray-900 dark:text-white">
                        No Detailed Analysis
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
                        Complete at least one full test to unlock subject-wise
                        metrics and growth plans.
                      </p>
                      <Link
                        to="/test-series"
                        className="mt-4 inline-block text-brand-start font-bold text-sm hover:underline"
                      >
                        Start Practice →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Insights Tab — deep-dive analytics */}
            {activeTab === "insights" && (
              <div className="space-y-6">
                {/* Attempt Pattern per Subject */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Layers className="w-5 h-5 text-brand-start" />
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      Attempt Pattern by Subject
                    </h3>
                  </div>
                  {attemptPattern.length > 0 ? (
                    <div className="space-y-4">
                      {attemptPattern.map((subject, i) => (
                        <div
                          key={i}
                          className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-100 dark:border-gray-700"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-bold text-sm text-gray-900 dark:text-white">
                              {subject.subject}
                            </span>
                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              {subject.total} questions
                            </span>
                          </div>
                          <div className="flex h-3 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
                            {subject.total > 0 && (
                              <>
                                <div
                                  className="bg-emerald-500"
                                  style={{
                                    width: `${(subject.correct / subject.total) * 100}%`,
                                  }}
                                  title={`${subject.correct} correct`}
                                />
                                <div
                                  className="bg-red-400"
                                  style={{
                                    width: `${(subject.wrong / subject.total) * 100}%`,
                                  }}
                                  title={`${subject.wrong} wrong`}
                                />
                                <div
                                  className="bg-gray-300 dark:bg-gray-600"
                                  style={{
                                    width: `${(subject.skipped / subject.total) * 100}%`,
                                  }}
                                  title={`${subject.skipped} skipped`}
                                />
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-[10px] font-bold">
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />{" "}
                              {subject.correct} Correct
                            </span>
                            <span className="flex items-center gap-1 text-red-500">
                              <span className="w-2 h-2 rounded-full bg-red-400" />{" "}
                              {subject.wrong} Wrong
                            </span>
                            <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
                              <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />{" "}
                              {subject.skipped} Skipped
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                      <Layers className="w-10 h-10 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Complete tests to unlock attempt pattern analysis
                      </p>
                      <Link
                        to="/test-series"
                        className="mt-3 inline-block text-brand-start font-bold text-sm hover:underline"
                      >
                        Start Practice →
                      </Link>
                    </div>
                  )}
                </div>

                {/* Comparison vs Topper */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      Comparison with Topper
                    </h3>
                  </div>
                  <div className="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-2xl p-6 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3" />
                    <div className="relative z-10">
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">
                            Your Score
                          </p>
                          <p className="text-xl sm:text-2xl lg:text-3xl font-black text-white">
                            {topperComparison.userScore}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">
                            Gap
                          </p>
                          <p className="text-xl sm:text-2xl lg:text-3xl font-black text-amber-400">
                            -{topperComparison.gap}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">
                            Topper
                          </p>
                          <p className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-400">
                            {topperComparison.topperScore}
                          </p>
                        </div>
                      </div>
                      <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full bg-gradient-to-r from-brand-start to-brand-end rounded-full transition-all duration-700"
                          style={{ width: `${topperComparison.percent}%` }}
                        />
                      </div>
                      <p className="text-center text-xs text-white/60">
                        You're at{" "}
                        <span className="font-bold text-white">
                          {topperComparison.percent}%
                        </span>{" "}
                        of the topper's score
                      </p>
                      {topperComparison.gap > 20 && (
                        <p className="text-center text-[10px] text-amber-400 mt-2">
                          💡 Closing this gap needs ~
                          {Math.ceil(topperComparison.gap / 5)} focused practice
                          tests
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Speed vs Accuracy Quadrant */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Wind className="w-5 h-5 text-cyan-500" />
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      Speed vs Accuracy Matrix
                    </h3>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
                    <div className="relative h-48 bg-gray-50 dark:bg-gray-900 rounded-xl overflow-hidden">
                      {/* Quadrant lines */}
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                      <div className="absolute top-1/2 left-0 right-0 h-px bg-gray-200 dark:bg-gray-700" />
                      {/* Quadrant labels */}
                      <span className="absolute top-2 left-2 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">
                        Fast & Accurate
                      </span>
                      <span className="absolute top-2 right-2 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">
                        Slow & Accurate
                      </span>
                      <span className="absolute bottom-2 left-2 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">
                        Fast & Low Acc
                      </span>
                      <span className="absolute bottom-2 right-2 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase">
                        Needs Improvement
                      </span>
                      {/* Plot subjects as dots */}
                      {timeAnalysis.map((item, i) => {
                        const speedX = Math.min(
                          95,
                          Math.max(5, 100 - (item.avgTimeSec / 120) * 100),
                        );
                        const accY = Math.min(
                          90,
                          Math.max(
                            10,
                            100 -
                              (effectiveAnalytics?.subjectWise?.[i]?.accuracy ||
                                50),
                          ),
                        );
                        return (
                          <div
                            key={i}
                            className="absolute w-3 h-3 rounded-full bg-brand-start shadow-md transition-all hover:scale-150 cursor-pointer group"
                            style={{
                              left: `${speedX}%`,
                              top: `${accY}%`,
                              transform: "translate(-50%, -50%)",
                            }}
                            title={`${item.subject}: ${item.avgTimeSec}s, ${effectiveAnalytics?.subjectWise?.[i]?.accuracy || 0}% acc`}
                          >
                            <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-bold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                              {item.subject}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between mt-3 text-[10px] text-gray-400 dark:text-gray-500">
                      <span>← Faster</span>
                      <span>Slower →</span>
                    </div>
                  </div>
                </div>

                {/* Smart Recommendations Engine */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Brain className="w-5 h-5 text-brand-start" />
                    <h3 className="font-bold text-gray-900 dark:text-white">
                      Smart Recommendations
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {generateRecommendations({
                      analytics: effectiveAnalytics,
                      timeAnalysis,
                      difficultyBreakdown,
                      topperComparison,
                    }).map((rec, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 p-4 rounded-xl border ${rec.severity === "high" ? "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/60" : rec.severity === "medium" ? "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800" : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800"}`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${rec.severity === "high" ? "bg-red-100 dark:bg-red-900/30" : rec.severity === "medium" ? "bg-amber-100 dark:bg-amber-900/30" : "bg-emerald-100 dark:bg-emerald-900/30"}`}
                        >
                          <rec.icon
                            className={`w-4 h-4 ${rec.severity === "high" ? "text-red-600 dark:text-red-400" : rec.severity === "medium" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-sm text-gray-900 dark:text-white">
                            {rec.title}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                            {rec.message}
                          </p>
                          {rec.action && (
                            <Link
                              to={rec.action}
                              className="text-[10px] font-bold text-brand-start hover:underline mt-1.5 inline-flex items-center gap-1"
                            >
                              {rec.actionLabel}{" "}
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Progress Tab */}
            {activeTab === "progress" && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-brand-start to-brand-end rounded-xl p-6 text-white">
                  <h3 className="font-bold text-lg mb-2">Keep Going! 🎯</h3>
                  <p className="text-purple-100 text-sm mb-4">
                    You're in the top {100 - effectiveAnalytics.percentile}% of
                    all students. Keep practicing to improve your rank!
                  </p>
                  <Link
                    to="/test-series"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-brand-start font-semibold rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition"
                  >
                    Take More Tests
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                    Areas for Improvement
                  </h3>
                  <div className="space-y-3">
                    {(effectiveAnalytics.weakSubjects || []).length > 0 ? (
                      effectiveAnalytics.weakSubjects.map((subject, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl"
                        >
                          <AlertCircle className="w-5 h-5 text-red-500" />
                          <span className="text-gray-700 dark:text-gray-300">
                            {subject}
                          </span>
                          <Link
                            to={`/study/${subject.toLowerCase().replace(" ", "-")}`}
                            className="ml-auto text-brand-start text-sm font-medium hover:underline"
                          >
                            Practice →
                          </Link>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                        <p>
                          Complete more tests to identify areas for improvement
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                    Your Strengths
                  </h3>
                  <div className="space-y-3">
                    {(effectiveAnalytics.strongSubjects || []).length > 0 ? (
                      effectiveAnalytics.strongSubjects.map((subject, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl"
                        >
                          <CheckCircle className="w-5 h-5 text-green-500" />
                          <span className="text-gray-700 dark:text-gray-300">
                            {subject}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                        <p>Complete more tests to identify your strengths</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreSparkline({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
        No data
      </div>
    );
  }
  const max = Math.max(...data, 100);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 100;
  const height = 60;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-24"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#667eea" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#667eea" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill="url(#sparkGrad)"
      />
      <polyline
        points={points}
        fill="none"
        stroke="#667eea"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * height;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="1.5"
            fill="#667eea"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

function generateRecommendations({
  analytics,
  timeAnalysis,
  difficultyBreakdown,
  topperComparison,
}) {
  const recs = [];

  if (difficultyBreakdown.hardAcc < 40 && difficultyBreakdown.hard > 0) {
    recs.push({
      icon: AlertCircle,
      severity: "high",
      title: "Focus on Hard Questions",
      message: `Your accuracy on hard questions is only ${difficultyBreakdown.hardAcc}%. Practice advanced-level problems to boost your score significantly.`,
      action: "/test-series",
      actionLabel: "Practice Advanced Tests",
    });
  }

  const slowSubject = timeAnalysis.find((t) => t.avgTimeSec > 75);
  if (slowSubject) {
    recs.push({
      icon: Timer,
      severity: "medium",
      title: `Improve Speed in ${slowSubject.subject}`,
      message: `You're averaging ${slowSubject.avgTimeSec}s per question in ${slowSubject.subject}. Target below 50s to save time for other sections.`,
      action: `/study/${slowSubject.subject.toLowerCase().replace(/\s+/g, "-")}`,
      actionLabel: "Review Concepts",
    });
  }

  if (topperComparison.gap > 20) {
    recs.push({
      icon: Trophy,
      severity: "medium",
      title: "Close the Gap with Topper",
      message: `You're ${topperComparison.gap} points behind the topper. Take ${Math.ceil(topperComparison.gap / 5)} more full-length tests with focused review.`,
      action: "/test-series",
      actionLabel: "Take Full Mock Test",
    });
  }

  const weakestSubject = analytics?.subjectWise?.find((s) => s.accuracy < 60);
  if (weakestSubject) {
    recs.push({
      icon: BookOpen,
      severity: "high",
      title: `Strengthen ${weakestSubject.name}`,
      message: `Your accuracy in ${weakestSubject.name} is ${weakestSubject.accuracy}%. Start with chapter-wise quizzes and video lessons.`,
      action: `/study/${weakestSubject.name.toLowerCase().replace(/\s+/g, "-")}`,
      actionLabel: "Start Learning",
    });
  }

  if (analytics?.totalTests >= 10 && (analytics?.avgAccuracy || 0) >= 80) {
    recs.push({
      icon: Zap,
      severity: "low",
      title: "You're Performing Well!",
      message:
        "Maintain consistency. Try timed sectional tests to push for 90%+ accuracy.",
      action: "/test-series",
      actionLabel: "Take Sectional Test",
    });
  }

  if (recs.length === 0) {
    recs.push({
      icon: Target,
      severity: "low",
      title: "Start Your Journey",
      message:
        "Complete a few tests to unlock personalized recommendations based on your performance.",
      action: "/test-series",
      actionLabel: "Take Your First Test",
    });
  }

  return recs;
}

export default Analysis;
