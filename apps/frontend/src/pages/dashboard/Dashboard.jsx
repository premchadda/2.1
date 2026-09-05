import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../shared/providers/AuthContext";
import {
  getTestSeries,
  getTests,
  getUserAnalytics,
  getTopPerformers,
  testsAPI,
  userAPI,
  getExams,
  aiAPI,
} from "../../shared/lib/dataService";
import { AnimatedHero } from "../../shared/components";
import { getOnboardingPrefs } from "../../shared/lib/onboardingUtils";
import { useDraggableScroll } from "../../shared/hooks/useDraggableScroll";
import {
  isSeriesEnrolled,
  getNormalizedEnrolledSeries,
} from "../../shared/lib/enrollment";
import { getSeriesTestStats } from "../../shared/lib/testSeriesStats";
import RecentActivity from "./RecentActivity";
import TopPerformers from "./TopPerformers";
import {
  checkIsLiveExpired,
  checkIsQuiz,
  formatDateRange,
  getTestStartDate,
  getTestEndDate,
} from "../../shared/utils/testClassification";
import {
  Radio,
  HelpCircle,
  BookOpen,
  Target,
  BarChartBig,
  ClipboardCheck,
  ArrowRight,
  Users,
  Clock,
  ChevronRight,
  Calendar,
  CheckCircle,
  Flame,
  Zap,
  Timer,
  RefreshCw,
  Brain,
  Sparkles,
  RotateCcw,
  User,
  Crown,
} from "lucide-react";

import {
  getDashboardCache,
  setDashboardCache,
} from "../../shared/lib/dashboardCache";

function Dashboard() {
  const { user } = useAuth();
  const currentUserId = user?.id || user?._id || user?.email || null;

  const cachedData = getDashboardCache(currentUserId);
  const isCacheValid = Boolean(cachedData);

  const [testSeries, setTestSeries] = useState(
    () => cachedData?.allSeries || [],
  );
  const [_tests, _setTests] = useState(() => cachedData?.allTests || []);
  const [allExams, setAllExams] = useState(() => cachedData?.examsData || []);
  const [attemptRows, setAttemptRows] = useState(
    () => cachedData?.attemptsData || [],
  );
  const [userEnrolledSeries, setUserEnrolledSeries] = useState(
    () => cachedData?.userEnrolledSeries || [],
  );
  const [loading, setLoading] = useState(() => !isCacheValid);
  const [analytics, setAnalytics] = useState(
    () => cachedData?.analyticsData || null,
  );
  const [topPerformers, setTopPerformers] = useState(
    () => cachedData?.topPerformers || [],
  );
  const [topPerformersLoading, setTopPerformersLoading] = useState(
    () => !isCacheValid,
  );
  const [liveTests, setLiveTests] = useState(() => cachedData?.liveTests || []);
  const [liveTestsLoading, setLiveTestsLoading] = useState(() => !isCacheValid);
  const [freeQuizzes, setFreeQuizzes] = useState(
    () => cachedData?.freeQuizzes || [],
  );
  const [freeQuizzesLoading, setFreeQuizzesLoading] = useState(
    () => !isCacheValid,
  );
  const [dailyTip, setDailyTip] = useState(null);
  const [tipLoading, setTipLoading] = useState(false);
  const [dueRevisions, setDueRevisions] = useState(
    () => cachedData?.dueRevisions || [],
  );
  const userName = user?.name || "Student";

  // Refs for scroll containers
  const { ref: scrollContainerRef } = useDraggableScroll();
  const { ref: examsScrollRef } = useDraggableScroll();

  // Staged parallel fetch for dashboard data to eliminate render blocking and waterfalls
  useEffect(() => {
    let cancelled = false;

    const activeUserId = user?.id || user?._id || user?.email || null;

    const fetchDashboardData = async () => {
      try {
        const isUserCacheValid = Boolean(getDashboardCache(activeUserId));

        if (!isUserCacheValid) {
          setLoading(true);
          setTopPerformersLoading(true);
          setLiveTestsLoading(true);
          setFreeQuizzesLoading(true);
        }

        // Stage 1: Fast essential data required for core series & progress
        const [allSeriesRes, allTestsRes, attemptsRes, examsRes, enrolledRes] =
          await Promise.allSettled([
            getTestSeries(),
            getTests(),
            userAPI.getAttempts().catch(() => ({ data: { data: [] } })),
            getExams().catch(() => []),
            userAPI.getEnrolledSeries().catch(() => ({ data: { data: [] } })),
          ]);

        if (cancelled) return;

        const allSeries =
          allSeriesRes.status === "fulfilled" ? allSeriesRes.value || [] : [];
        const allTests =
          allTestsRes.status === "fulfilled" ? allTestsRes.value || [] : [];
        const attemptsData =
          attemptsRes.status === "fulfilled" && attemptsRes.value?.data?.data
            ? Array.isArray(attemptsRes.value.data.data)
              ? attemptsRes.value.data.data
              : []
            : attemptsRes.status === "fulfilled" &&
                Array.isArray(attemptsRes.value?.data)
              ? attemptsRes.value.data
              : [];
        const examsData =
          examsRes.status === "fulfilled" ? examsRes.value || [] : [];
        const fetchedEnrolled =
          enrolledRes.status === "fulfilled" && enrolledRes.value?.data?.data
            ? enrolledRes.value.data.data
            : enrolledRes.status === "fulfilled" &&
                Array.isArray(enrolledRes.value?.data)
              ? enrolledRes.value.data
              : [];

        setUserEnrolledSeries(fetchedEnrolled);
        setTestSeries(allSeries);
        _setTests(allTests);
        setAttemptRows(attemptsData);
        setAllExams(examsData);
        setLoading(false);

        // Stage 2: Secondary / heavier background data (runs concurrently)
        const [
          analyticsRes,
          topPerformersRes,
          liveTestsRes,
          quizzesRes,
          revisionsRes,
        ] = await Promise.allSettled([
          getUserAnalytics().catch(() => null),
          getTopPerformers(3).catch(() => []),
          testsAPI.getByTag("live-tests").catch(() => ({ data: { data: [] } })),
          testsAPI.getByTag("quizzes").catch(() => ({ data: { data: [] } })),
          aiAPI.getDueRevisions().catch(() => []),
        ]);

        if (cancelled) return;

        const analyticsData =
          analyticsRes.status === "fulfilled" ? analyticsRes.value : null;

        // Top performers
        let performersSorted = [];
        if (topPerformersRes.status === "fulfilled") {
          const rawPerformers =
            topPerformersRes.value?.data?.data || topPerformersRes.value || [];
          performersSorted = (Array.isArray(rawPerformers) ? rawPerformers : [])
            .sort(
              (a, b) =>
                (b.testsAttempted || b.testsTaken || 0) -
                (a.testsAttempted || a.testsTaken || 0),
            )
            .slice(0, 3);
          setTopPerformers(performersSorted);
        }
        setTopPerformersLoading(false);

        // Live tests
        let mappedLive = [];
        if (liveTestsRes.status === "fulfilled") {
          let liveData =
            liveTestsRes.value?.data?.data || liveTestsRes.value || [];
          if (!Array.isArray(liveData) || liveData.length === 0) {
            liveData = allTests.filter(
              (t) =>
                t.is_live ||
                t.isLive ||
                t.type === "live-tests" ||
                (t.tags && t.tags.includes("live-tests")),
            );
          }
          mappedLive = (Array.isArray(liveData) ? liveData : [])
            .filter((test) => !checkIsLiveExpired(test))
            .slice(0, 3)
            .map((test) => {
              const series = allSeries.find(
                (s) =>
                  s._id === test.seriesId ||
                  s.id === test.seriesId ||
                  s.dbId === test.series_id,
              );
              const startVal = getTestStartDate(test);
              const endVal = getTestEndDate(test);
              const timePeriod =
                formatDateRange(startVal, endVal, test.duration) ||
                "Available Now";

              return {
                id: test._id || test.id,
                title: test.title,
                startTime: test.scheduledAt
                  ? new Date(test.scheduledAt).toLocaleString()
                  : "Now",
                timePeriod,
                duration: test.duration ? `${test.duration} mins` : "60 mins",
                participants: test.participants || 0,
                type: "Live",
                tag: test.isPro ? "PRO" : "FREE",
                series,
              };
            });
          setLiveTests(mappedLive);
        }
        setLiveTestsLoading(false);

        // Free quizzes
        let mappedQuizzes = [];
        if (quizzesRes.status === "fulfilled") {
          let quizzesData =
            quizzesRes.value?.data?.data || quizzesRes.value || [];
          if (!Array.isArray(quizzesData) || quizzesData.length === 0) {
            quizzesData = allTests.filter((t) => checkIsQuiz(t));
          } else {
            quizzesData = quizzesData.filter((t) => checkIsQuiz(t));
          }
          mappedQuizzes = (Array.isArray(quizzesData) ? quizzesData : [])
            .filter(
              (test) =>
                (!test.isPro || test.type === "Free" || test.type === "quiz") &&
                !checkIsLiveExpired(test),
            )
            .slice(0, 3)
            .map((test) => {
              const series = allSeries.find(
                (s) =>
                  s._id === test.seriesId ||
                  s.id === test.seriesId ||
                  s.dbId === test.series_id,
              );
              return {
                id: test._id || test.id,
                title: test.title,
                startTime: test.scheduledAt
                  ? new Date(test.scheduledAt).toLocaleString()
                  : "Now",
                duration: test.duration ? `${test.duration} mins` : "60 mins",
                participants: test.participants || 0,
                type: "Quiz",
                tag: "FREE",
                series,
              };
            });
          setFreeQuizzes(mappedQuizzes);
        }
        setFreeQuizzesLoading(false);

        // Due revisions
        if (revisionsRes.status === "fulfilled") {
          setDueRevisions(revisionsRes.value || []);
        }

        setAnalytics(analyticsData);

        // Store in client-side memory cache for instant future loads
        setDashboardCache(currentUserId, {
          allSeries,
          allTests,
          analyticsData,
          attemptsData,
          examsData,
          userEnrolledSeries: fetchedEnrolled,
          topPerformers: performersSorted,
          liveTests: mappedLive,
          freeQuizzes: mappedQuizzes,
          dueRevisions: revisionsRes.value || [],
        });
      } catch (err) {
        console.error("[Dashboard] Error fetching dashboard data:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setTopPerformersLoading(false);
          setLiveTestsLoading(false);
          setFreeQuizzesLoading(false);
        }
      }
    };

    fetchDashboardData();

    const handleInvalidation = () => {
      fetchDashboardData();
    };
    if (typeof window !== "undefined") {
      window.addEventListener("trstprep:data-invalidated", handleInvalidation);
    }

    return () => {
      cancelled = true;
      if (typeof window !== "undefined") {
        window.removeEventListener(
          "trstprep:data-invalidated",
          handleInvalidation,
        );
      }
    };
  }, [user]);

  // Define quick access items
  const quickAccessItems = [
    {
      icon: RotateCcw,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/60 border-amber-200/60 dark:border-amber-800/60",
      title: "Mistakes",
      desc: "Re-practice",
      route: "/practice?mode=mistakes",
    },
    {
      icon: Radio,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/60 border-rose-200/60 dark:border-rose-800/60",
      title: "Live Tests",
      desc: "Real-time",
      route: "/live-tests",
    },
    {
      icon: HelpCircle,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/60 border-blue-200/60 dark:border-blue-800/60",
      title: "Quizzes",
      desc: "Practice",
      route: "/quizzes",
    },
    {
      icon: BookOpen,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200/60 dark:border-emerald-800/60",
      title: "PYQ",
      desc: "Past Papers",
      route: "/pyps",
    },
    {
      icon: Target,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/60 border-purple-200/60 dark:border-purple-800/60",
      title: "Practice",
      desc: "Skills",
      route: "/practice",
    },
    {
      icon: Brain,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200/60 dark:border-indigo-800/60",
      title: "Review",
      desc: "Flashcards",
      route: "/spaced-repetition",
    },
    {
      icon: BarChartBig,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-50 dark:bg-orange-950/60 border-orange-200/60 dark:border-orange-800/60",
      title: "Analysis",
      desc: "Reports",
      route: "/analysis",
    },
    {
      icon: ClipboardCheck,
      color: "text-sky-600 dark:text-sky-400",
      bg: "bg-sky-50 dark:bg-sky-950/60 border-sky-200/60 dark:border-sky-800/60",
      title: "Attempted",
      desc: "History",
      route: "/attempted-tests",
    },
  ];

  // Filter enrolled series from real data - check actual user enrollment and attempted tests
  const enrolledTestSeries = useMemo(() => {
    if (!user) return [];

    // Build merged set of enrolled IDs from user object and API-fetched enrolled series
    const directEnrolledIds = getNormalizedEnrolledSeries(
      user.enrolledSeries || user.enrolled_series || user.enrolled || [],
    );
    const apiEnrolledIds = getNormalizedEnrolledSeries(
      userEnrolledSeries || [],
    );
    const mergedEnrolledSet = new Set([
      ...directEnrolledIds,
      ...apiEnrolledIds,
    ]);

    const attemptCountBySeries = new Map();
    attemptRows.forEach((attempt) => {
      const raw = attempt.rawAttempt || attempt;
      const seriesKeys = [
        attempt.seriesId,
        attempt.series_id,
        attempt.seriesSlug,
        attempt.series_slug,
        raw.seriesId,
        raw.series_id,
        raw.seriesSlug,
        raw.series_slug,
      ]
        .filter(Boolean)
        .map(String);

      const testId =
        attempt.testId ||
        attempt.test_id ||
        raw.testId ||
        raw.test_id ||
        attempt.id;
      if (testId && _tests && _tests.length > 0) {
        const foundTest = _tests.find(
          (t) => String(t._id || t.id || t.dbId) === String(testId),
        );
        if (foundTest) {
          const tSeriesId =
            foundTest.seriesId ||
            foundTest.series_id ||
            foundTest.seriesSlug ||
            foundTest.series_slug;
          if (tSeriesId) seriesKeys.push(String(tSeriesId));
        }
      }

      const testKey = String(testId || "");
      seriesKeys.forEach((seriesKey) => {
        if (!attemptCountBySeries.has(seriesKey)) {
          attemptCountBySeries.set(seriesKey, new Set());
        }
        if (testKey) attemptCountBySeries.get(seriesKey).add(testKey);
      });
    });

    const attemptedKeys = Object.keys(user.attemptedTests || {});

    const seriesWithAttempts = testSeries.filter((s) => {
      if (isSeriesEnrolled(user, s) || isSeriesEnrolled(userEnrolledSeries, s))
        return true;
      const seriesIds = [s.dbId, s._id, s.id, s.slug, s.public_id, s.publicId]
        .filter(Boolean)
        .map(String);
      if (seriesIds.some((sid) => mergedEnrolledSet.has(sid))) return true;
      const inAttemptedKeys = attemptedKeys.some((tid) =>
        seriesIds.some((sid) => String(tid) === String(sid)),
      );
      const inAttemptRows = seriesIds.some((sid) =>
        attemptCountBySeries.has(sid),
      );
      return inAttemptedKeys || inAttemptRows;
    });

    return seriesWithAttempts.map((series) => {
      const attemptCountFromUser =
        user?.attemptedTests?.[series.dbId] ??
        user?.attemptedTests?.[series._id] ??
        user?.attemptedTests?.[series.id] ??
        user?.attemptedTests?.[String(series.dbId)] ??
        user?.attemptedTests?.[String(series._id)] ??
        user?.attemptedTests?.[String(series.id)] ??
        user?.attemptedTests?.[series.slug] ??
        user?.attemptedTests?.[series.public_id] ??
        0;

      const attemptCountFromRows = [
        series.dbId,
        series._id,
        series.id,
        String(series.dbId),
        String(series._id),
        String(series.id),
        series.slug,
        series.public_id,
      ]
        .filter(Boolean)
        .reduce(
          (max, key) =>
            Math.max(max, attemptCountBySeries.get(String(key))?.size || 0),
          0,
        );

      const attemptedCount = Math.max(
        attemptCountFromUser,
        attemptCountFromRows,
      );

      const stats = getSeriesTestStats(series, _tests);
      const total = Math.max(stats.totalTests || 0, attemptedCount);

      const rawCat = String(
        series.categoryName || series.category || "",
      ).trim();
      const formattedCategory = rawCat
        ? rawCat.toLowerCase() === "ssc"
          ? "SSC"
          : rawCat.toLowerCase() === "railways" ||
              rawCat.toLowerCase() === "railway"
            ? "Railway"
            : rawCat.charAt(0).toUpperCase() + rawCat.slice(1)
        : "General";

      return {
        id: series.slug || series.public_id || series._id || series.id,
        _id: series._id,
        dbId: series.dbId,
        slug: series.slug || series.public_id,
        title: series.title,
        totalTests: total,
        attemptedTests: attemptedCount,
        category: formattedCategory,
        examId: series.examId || series.exam_id || series.sub_category_id,
        icon:
          series.icon ||
          (rawCat.toLowerCase().includes("railway") ||
          rawCat.toLowerCase().includes("rrb")
            ? "🚂"
            : rawCat.toLowerCase().includes("ssc")
              ? "📝"
              : "📋"),
      };
    });
  }, [attemptRows, user, testSeries, _tests, userEnrolledSeries]);

  // Derive enrolledExams from user's explicit enrolled exams or enrolledTestSeries
  const enrolledExams = useMemo(() => {
    const enrolledExamsMap = new Map();

    const userEnrolled = user?.enrolledExams || user?.enrolled_exams || [];
    const userEnrolledIds = new Set(
      (Array.isArray(userEnrolled) ? userEnrolled : [userEnrolled])
        .map((e) =>
          typeof e === "object" && e !== null
            ? e.id || e._id || e.exam_id || e.examId
            : e,
        )
        .filter(Boolean)
        .map(String),
    );

    if (userEnrolledIds.size > 0 && allExams && allExams.length > 0) {
      allExams.forEach((exam, index) => {
        const examKeys = [
          exam.id,
          exam._id,
          exam.exam_id,
          exam.examId,
          exam.slug,
        ]
          .filter(Boolean)
          .map(String);
        if (examKeys.some((k) => userEnrolledIds.has(k))) {
          const examKey = exam.id || exam._id || exam.exam_id;
          enrolledExamsMap.set(examKey, {
            id: examKey,
            examId: exam.exam_id || exam.examId,
            name: exam.title || exam.name || exam.fullName,
            icon: ["📝", "🚂", "🏦", "🏛️", "🎓", "⚔️"][index % 6],
            color: ["blue", "green", "purple", "red", "amber", "slate"][
              index % 6
            ],
            categoryId: exam.categoryId,
            description: exam.fullName || exam.description,
            seriesCount: 1,
            upcomingTests: 0,
          });
        }
      });
    }

    if (
      enrolledTestSeries &&
      enrolledTestSeries.length > 0 &&
      allExams &&
      allExams.length > 0
    ) {
      enrolledTestSeries.forEach((series, index) => {
        const examIdRef =
          series.examId || series.exam_id || series.sub_category_id;
        const category = series.category;
        let matchedExam = examIdRef
          ? allExams.find(
              (exam) =>
                String(exam.exam_id || exam.examId || exam.id || exam._id) ===
                String(examIdRef),
            )
          : null;
        if (!matchedExam && category) {
          matchedExam = allExams.find(
            (exam) =>
              (exam.title || exam.name || "").toLowerCase() ===
              category.toLowerCase(),
          );
        }

        if (matchedExam) {
          const examKey =
            matchedExam.id || matchedExam._id || matchedExam.exam_id;
          const existing = enrolledExamsMap.get(examKey);
          if (existing) {
            existing.seriesCount++;
            existing.upcomingTests += series.totalTests || 0;
          } else {
            enrolledExamsMap.set(examKey, {
              id: examKey,
              examId: matchedExam.exam_id || matchedExam.examId,
              name:
                matchedExam.title || matchedExam.name || matchedExam.fullName,
              icon: ["📝", "🚂", "🏦", "🏛️", "🎓", "⚔️"][index % 6],
              color: ["blue", "green", "purple", "red", "amber", "slate"][
                index % 6
              ],
              categoryId: matchedExam.categoryId,
              description: matchedExam.fullName || matchedExam.description,
              seriesCount: 1,
              upcomingTests: series.totalTests || 0,
            });
          }
        }
      });
    }

    if (
      enrolledExamsMap.size === 0 &&
      enrolledTestSeries &&
      enrolledTestSeries.length > 0
    ) {
      const categoryMap = {};
      enrolledTestSeries.forEach((series) => {
        const normalizedCategory = (
          series.category || "General Prep"
        ).toLowerCase();
        if (!categoryMap[normalizedCategory]) {
          categoryMap[normalizedCategory] = {
            originalName: series.category || "General Prep",
            count: 0,
            tests: 0,
          };
        }
        categoryMap[normalizedCategory].count++;
        categoryMap[normalizedCategory].tests += series.totalTests || 0;
      });

      return Object.entries(categoryMap).map(
        ([normalizedCategory, data], index) => ({
          id: `${normalizedCategory}-${index}`,
          name: data.originalName,
          icon: ["📝", "🚂", "🏦", "🏛️", "🎓", "⚔️"][index % 6],
          color: ["blue", "green", "purple", "red", "amber", "slate"][
            index % 6
          ],
          seriesCount: data.count,
          upcomingTests: data.tests,
        }),
      );
    }

    return Array.from(enrolledExamsMap.values());
  }, [user, enrolledTestSeries, allExams]);

  // Check if loading is complete
  // Derive recent activity from attempt rows (richest data source)
  const recentActivity = useMemo(() => {
    if (!attemptRows || attemptRows.length === 0) return [];
    return attemptRows.slice(0, 20).map((attempt) => {
      const rawDate = attempt.submittedAt || attempt.date || attempt.created_at;
      const dateObj = rawDate ? new Date(rawDate) : null;
      const timeLabel =
        dateObj && !isNaN(dateObj)
          ? dateObj.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : "Recently";

      const accuracyNum =
        attempt.accuracy !== null && Number.isFinite(attempt.accuracy)
          ? Math.round(Number(attempt.accuracy))
          : null;
      const scoreNum =
        attempt.score !== null && Number.isFinite(attempt.score)
          ? Math.round(Number(attempt.score))
          : null;

      return {
        id: attempt.id || attempt._id || attempt.testId,
        testId: attempt.testId || attempt.test_id,
        seriesId: attempt.seriesId || attempt.series_id,
        action: attempt.title || attempt.testTitle || "Test Completed",
        detail: attempt.seriesTitle || attempt.category || "Practice Test",
        time: timeLabel,
        icon: CheckCircle,
        score: scoreNum,
        accuracy: accuracyNum,
        percentage:
          attempt.percentage !== null
            ? Math.round(Number(attempt.percentage))
            : accuracyNum,
        timeSpent: attempt.timeSpent
          ? `${Math.round(attempt.timeSpent / 60)} mins`
          : null,
      };
    });
  }, [attemptRows]);

  // Derive real-time aggregate statistics from user attempt history
  const derivedStatsFromAttempts = useMemo(() => {
    if (
      !attemptRows ||
      !Array.isArray(attemptRows) ||
      attemptRows.length === 0
    ) {
      return {
        testsTaken: 0,
        accuracy: 0,
        timeSpent: "0h",
        totalHours: 0,
        rank: "—",
        streak: 0,
      };
    }

    const completed = attemptRows.filter((a) => {
      const st = String(a.status || "").toLowerCase();
      return (
        st === "completed" ||
        st === "submitted" ||
        a.isCompleted ||
        a.is_completed ||
        a.score !== undefined
      );
    });

    const effectiveAttempts = completed.length > 0 ? completed : attemptRows;
    const totalTests = effectiveAttempts.length;

    let totalCorrect = 0;
    let totalWrong = 0;
    let totalTimeSpentSeconds = 0;
    let bestRank = null;
    const attemptDates = new Set();

    effectiveAttempts.forEach((attempt) => {
      totalCorrect += Number(attempt.correct ?? attempt.correctAnswers) || 0;
      totalWrong += Number(attempt.wrong ?? attempt.wrongAnswers) || 0;
      totalTimeSpentSeconds += Number(
        attempt.timeSpent ||
          attempt.time_spent ||
          attempt.timeTaken ||
          attempt.duration ||
          0,
      );

      const r = Number(attempt.rank);
      if (r > 0) {
        if (!bestRank || r < bestRank) {
          bestRank = r;
        }
      }

      const rawDate =
        attempt.submittedAt ||
        attempt.date ||
        attempt.createdAt ||
        attempt.created_at;
      if (rawDate) {
        try {
          const d = new Date(rawDate).toISOString().split("T")[0];
          attemptDates.add(d);
        } catch {
          // ignore
        }
      }
    });

    const totalAnswered = totalCorrect + totalWrong;
    const avgAccuracy =
      totalAnswered > 0
        ? Math.round((totalCorrect / totalAnswered) * 100)
        : effectiveAttempts.some((a) => Number(a.accuracy) > 0)
          ? Math.round(
              effectiveAttempts.reduce(
                (acc, a) => acc + (Number(a.accuracy) || 0),
                0,
              ) / effectiveAttempts.length,
            )
          : 0;

    const totalMinutes = Math.round(totalTimeSpentSeconds / 60);
    let timeSpentDisplay = "0h";
    if (totalTimeSpentSeconds >= 3600) {
      const hours = (totalTimeSpentSeconds / 3600).toFixed(1);
      timeSpentDisplay = `${parseFloat(hours)}h`;
    } else if (totalMinutes > 0) {
      timeSpentDisplay = `${totalMinutes}m`;
    } else if (totalTimeSpentSeconds > 0) {
      timeSpentDisplay = `${totalTimeSpentSeconds}s`;
    } else if (totalTests > 0) {
      timeSpentDisplay = `${totalTests * 0.5}h`;
    }

    // Calculate streak from unique calendar days
    let currentStreak = 0;
    if (attemptDates.size > 0) {
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
      if (currentStreak === 0 && attemptDates.size > 0) {
        currentStreak = 1;
      }
    }

    return {
      testsTaken: totalTests,
      accuracy: avgAccuracy,
      timeSpent: timeSpentDisplay,
      totalHours: Math.round(totalTimeSpentSeconds / 3600),
      rank: bestRank ? `#${bestRank}` : "—",
      streak: currentStreak,
    };
  }, [attemptRows]);

  // Calculate user stats by fusing analytics with real-time attempt rows
  const userStats = useMemo(() => {
    const testsTaken =
      Number(analytics?.totalTests) > 0
        ? Number(analytics.totalTests)
        : Math.max(
            derivedStatsFromAttempts.testsTaken,
            Number(user?.testsTaken) || Number(user?.totalTests) || 0,
          );

    const accuracy =
      Number(analytics?.avgAccuracy) > 0
        ? Number(analytics.avgAccuracy)
        : derivedStatsFromAttempts.accuracy > 0
          ? derivedStatsFromAttempts.accuracy
          : Number(user?.avgAccuracy) || Number(user?.accuracy) || 0;

    let rank = "—";
    if (analytics?.rank && Number(analytics.rank) > 0) {
      rank = `#${analytics.rank}`;
    } else if (derivedStatsFromAttempts.rank !== "—") {
      rank = derivedStatsFromAttempts.rank;
    } else if (user?.rank && user.rank !== "-" && user.rank !== 0) {
      rank = String(user.rank).startsWith("#") ? user.rank : `#${user.rank}`;
    } else if (user?.bestRank && user.bestRank !== "-" && user.bestRank !== 0) {
      rank = String(user.bestRank).startsWith("#")
        ? user.bestRank
        : `#${user.bestRank}`;
    }

    let timeSpent = "0h";
    if (
      analytics?.totalHours !== undefined &&
      Number(analytics.totalHours) > 0
    ) {
      timeSpent = `${analytics.totalHours}h`;
    } else if (derivedStatsFromAttempts.timeSpent !== "0h") {
      timeSpent = derivedStatsFromAttempts.timeSpent;
    } else if (Number(user?.timeSpent || user?.hoursSpent) > 0) {
      timeSpent = `${user.timeSpent || user.hoursSpent}h`;
    }

    const streak =
      Number(analytics?.streak) > 0
        ? Number(analytics.streak)
        : derivedStatsFromAttempts.streak > 0
          ? derivedStatsFromAttempts.streak
          : Number(user?.streak) || (testsTaken > 0 ? 1 : 0);

    return {
      testsTaken,
      accuracy,
      rank,
      timeSpent,
      streak,
      improvement: analytics?.improvement || null,
    };
  }, [analytics, derivedStatsFromAttempts, user]);

  // Helper function to get category emoji for dashboard
  const getCategoryEmojiForDashboard = (category) => {
    const icons = {
      ssc: "📝",
      railways: "🚂",
      banking: "💰",
      upsc: "🏛️",
      defence: "🎖️",
      teaching: "🎓",
      default: "📋",
    };
    return icons[category?.toLowerCase()] || icons.default;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-8 page-transition fade-in">
      <Helmet>
        <title>Dashboard | Trstprep</title>
        <meta
          name="description"
          content="Your Trstprep dashboard - track progress, view analytics, and access test series."
        />
        <meta property="og:title" content="Dashboard | Trstprep" />
        <meta
          property="og:description"
          content="Your Trstprep dashboard - track progress, view analytics, and access test series."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
      </Helmet>
      {/* Welcome Banner with Animated Background */}
      <AnimatedHero pageType="dashboard" className="pb-8 sm:pb-10 md:pb-11">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-5">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to="/profile"
              className="relative group block shrink-0"
              title="View Profile"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center text-white shadow-lg group-hover:scale-105 group-hover:border-white/80 transition-all duration-300">
                {user?.avatar || user?.avatarUrl || user?.photoURL ? (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={user.avatar || user.avatarUrl || user.photoURL}
                    alt={userName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      if (e.currentTarget.nextSibling) {
                        e.currentTarget.nextSibling.style.display = "flex";
                      }
                    }}
                  />
                ) : null}
                <div
                  className={`${user?.avatar || user?.avatarUrl || user?.photoURL ? "hidden" : "flex"} w-full h-full items-center justify-center bg-white/20 backdrop-blur-sm`}
                >
                  <User className="w-6 h-6 sm:w-8 sm:h-8 text-white/90" />
                </div>
              </div>
            </Link>
            <div className="text-white min-w-0 flex-1">
              <h1
                className="text-lg sm:text-2xl md:text-3xl font-bold animate-slide-in-right truncate"
                title={`Welcome ${userName.trim().split(/\s+/)[0] || "Student"}`}
                style={{ animationDelay: "0.1s" }}
              >
                Welcome {userName.trim().split(/\s+/)[0] || "Student"} 👋
              </h1>
              <p
                className="text-purple-100 text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1 animate-slide-in-right truncate"
                style={{ animationDelay: "0.2s" }}
              >
                Continue your preparation journey
              </p>
            </div>
          </div>

          {/* Your Progress - Hero Section */}
          <div
            className="bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 p-3 sm:p-4 w-full md:w-auto max-w-full md:max-w-[360px] lg:min-w-[360px] shadow-lg animate-slide-in-right shrink-0"
            style={{ animationDelay: "0.3s" }}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 shrink-0" />
                <span className="text-white font-extrabold text-xs sm:text-sm truncate">
                  Your Progress
                </span>
              </div>
              <span className="px-2.5 py-0.5 bg-white/20 backdrop-blur-sm rounded-full text-[10px] sm:text-xs text-white font-bold shrink-0 border border-white/20">
                {userStats.streak} Day Streak
              </span>
            </div>
            <p className="text-purple-100 text-[10px] sm:text-xs mb-2 sm:mb-3">
              Keep up the great work!
            </p>
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              <div className="text-center p-1 sm:p-2 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/15 min-h-[48px] sm:min-h-[64px] flex flex-col justify-center items-center transition-colors">
                <p className="text-xs xs:text-sm sm:text-lg md:text-xl font-black text-white leading-none truncate w-full">
                  {userStats.testsTaken}
                </p>
                <p className="text-purple-100 text-[8px] xs:text-[9px] sm:text-[10px] mt-1 font-bold tracking-tight uppercase truncate w-full">
                  Tests
                </p>
              </div>
              <div className="text-center p-1 sm:p-2 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/15 min-h-[48px] sm:min-h-[64px] flex flex-col justify-center items-center transition-colors">
                <p className="text-xs xs:text-sm sm:text-lg md:text-xl font-black text-white leading-none truncate w-full">
                  {userStats.accuracy}%
                </p>
                <p className="text-purple-100 text-[8px] xs:text-[9px] sm:text-[10px] mt-1 font-bold tracking-tight uppercase truncate w-full">
                  Accuracy
                </p>
              </div>
              <div className="text-center p-1 sm:p-2 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/15 min-h-[48px] sm:min-h-[64px] flex flex-col justify-center items-center transition-colors">
                <p className="text-xs xs:text-sm sm:text-lg md:text-xl font-black text-white leading-none truncate w-full">
                  {userStats.rank}
                </p>
                <p className="text-purple-100 text-[8px] xs:text-[9px] sm:text-[10px] mt-1 font-bold tracking-tight uppercase truncate w-full">
                  Rank
                </p>
              </div>
              <div className="text-center p-1 sm:p-2 rounded-xl bg-white/10 hover:bg-white/15 backdrop-blur-sm border border-white/15 min-h-[48px] sm:min-h-[64px] flex flex-col justify-center items-center transition-colors">
                <p className="text-xs xs:text-sm sm:text-lg md:text-xl font-black text-white leading-none truncate w-full">
                  {userStats.timeSpent}
                </p>
                <p className="text-purple-100 text-[8px] xs:text-[9px] sm:text-[10px] mt-1 font-bold tracking-tight uppercase truncate w-full">
                  Time
                </p>
              </div>
            </div>
          </div>
        </div>
      </AnimatedHero>

      {/* Quick Access - Floats slightly over hero section with title height */}
      <section className="max-w-7xl mb-4 sm:mb-6 mx-auto px-3 sm:px-6 lg:px-8 -mt-4 sm:-mt-6 md:-mt-7 relative z-20">
        <div
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-soft border border-gray-100 dark:border-gray-700/80 p-2.5 sm:p-4 md:p-6 animate-slide-in-up"
          style={{ animationDelay: "0.15s" }}
        >
          <div className="flex items-center justify-between gap-2 mb-2.5 sm:mb-4">
            <h2 className="text-[11px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider truncate">
              Quick Access
            </h2>
            <Link
              to="/practice?mode=mistakes"
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-lg text-[11px] sm:text-xs font-bold hover:bg-amber-100 dark:hover:bg-amber-900/50 transition border border-amber-200/80 dark:border-amber-800/60 shrink-0"
            >
              <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>Mistakes Practice</span> →
            </Link>
          </div>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-1.5 sm:gap-2.5">
            {quickAccessItems.map((item, _index) => (
              <Link
                key={item.title}
                to={item.route}
                className="bg-gray-50/80 dark:bg-gray-750/70 hover:bg-white dark:hover:bg-gray-700 rounded-xl sm:rounded-2xl border border-gray-100 dark:border-gray-600/50 p-1.5 sm:p-2.5 text-center cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:border-indigo-200 dark:hover:border-indigo-700/60 transition-all duration-150 group flex flex-col items-center justify-center min-h-[68px] sm:min-h-[90px] active:scale-[0.97]"
              >
                <div
                  className={`w-7 h-7 sm:w-10 sm:h-10 ${item.bg} border rounded-lg sm:rounded-xl flex items-center justify-center mb-1 group-hover:scale-110 transition-transform duration-150 shrink-0 shadow-xs`}
                >
                  <item.icon
                    className={`${item.color} w-3.5 h-3.5 sm:w-5 sm:h-5`}
                  />
                </div>
                <h3 className="font-bold text-gray-800 dark:text-gray-200 text-[10px] sm:text-xs leading-tight truncate w-full px-0.5">
                  {item.title}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 text-[9px] sm:text-[10px] leading-tight hidden sm:block mt-0.5 truncate w-full">
                  {item.desc}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pb-6">
        {/* MAIN CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* LEFT COLUMN - MAIN CONTENT */}
          <div className="lg:col-span-8 space-y-4 sm:space-y-6">
            {/* RECENT TEST SERIES */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-3.5 sm:p-4 md:p-5">
              <div className="flex justify-between items-center mb-3 md:mb-4">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <h2 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 dark:text-white">
                    Recent Test Series
                  </h2>
                  <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full">
                    {enrolledTestSeries.length} Active
                  </span>
                </div>
                <Link
                  to="/test-series"
                  className="text-xs md:text-sm text-brand-start dark:text-indigo-400 font-medium hover:underline flex items-center gap-1"
                >
                  View All <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Link>
              </div>

              {loading ? (
                <div className="flex gap-2.5 sm:gap-4 overflow-x-auto pb-3 -mx-3.5 pl-4 pr-3.5 sm:mx-0 sm:px-0 snap-x">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="animate-pulse bg-gray-100 dark:bg-gray-700/60 rounded-2xl h-36 w-[85vw] max-w-[300px] min-w-[240px] sm:w-[300px] shrink-0 snap-start"
                    />
                  ))}
                </div>
              ) : enrolledTestSeries.length > 0 ? (
                <div
                  ref={scrollContainerRef}
                  className="flex gap-2.5 sm:gap-4 overflow-x-auto pb-3 -mx-3.5 pl-4 pr-3.5 sm:mx-0 sm:px-0 scroll-smooth snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] cursor-grab active:cursor-grabbing hover:shadow-inner rounded-xl"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {enrolledTestSeries.slice(0, 10).map((series) => {
                    const total = Number(series.totalTests) || 0;
                    const attempted = Number(series.attemptedTests) || 0;
                    const progress =
                      total > 0
                        ? Math.min(100, Math.round((attempted / total) * 100))
                        : 0;
                    const progressColor =
                      progress >= 70
                        ? "green"
                        : progress >= 40
                          ? "yellow"
                          : "blue";
                    return (
                      <Link
                        key={series.id}
                        to={`/test-series/${series.id}`}
                        className="group bg-gray-50 dark:bg-gray-700 rounded-2xl border border-gray-200 dark:border-gray-600 p-3.5 sm:p-4 cursor-pointer hover:shadow-lg hover:border-brand-start dark:hover:border-indigo-500 transition-all flex-shrink-0 w-[85vw] max-w-[300px] min-w-[260px] sm:w-[300px] snap-start"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="text-2xl group-hover:scale-110 transition-transform">
                            {series.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-800 dark:text-white text-sm line-clamp-1 group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors">
                              {series.title}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {series.category}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 text-xs font-bold rounded-full ${progressColor === "green" ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : progressColor === "yellow" ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400" : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"}`}
                          >
                            {progress}%
                          </span>
                        </div>

                        <div className="mb-2">
                          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                            <span>
                              {total > 0
                                ? `${attempted}/${total} tests`
                                : `${attempted} tests`}
                            </span>
                            <span>
                              {progress >= 70
                                ? "🎯 Almost done!"
                                : progress >= 40
                                  ? "💪 Keep going!"
                                  : attempted > 0
                                    ? "👍 In progress"
                                    : "🚀 Just started"}
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${progressColor === "green" ? "bg-gradient-to-r from-green-400 to-green-600" : progressColor === "yellow" ? "bg-gradient-to-r from-yellow-400 to-yellow-600" : "bg-gradient-to-r from-blue-400 to-blue-600"}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>

                        <span className="block w-full py-2.5 bg-gradient-to-r from-brand-start to-brand-end text-white text-xs font-semibold rounded-lg text-center group-hover:opacity-90">
                          Continue Learning
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <div className="text-2xl sm:text-3xl lg:text-4xl mb-3">
                    📚
                  </div>
                  {(() => {
                    const prefs = getOnboardingPrefs();
                    if (prefs && prefs.selectedExam) {
                      return (
                        <p className="text-gray-700 dark:text-gray-200 text-sm mb-1 font-semibold">
                          Welcome! Start your {prefs.selectedExam.name} prep
                          here.
                        </p>
                      );
                    }
                    return (
                      <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
                        You haven't enrolled in any test series yet
                      </p>
                    );
                  })()}
                  <Link
                    to="/test-series"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-brand-start text-white text-sm font-semibold rounded-lg hover:opacity-90 transition mt-2"
                  >
                    Browse Test Series <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>

            {/* LIVE TESTS & QUIZZES - Two Column Layout */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-3.5 sm:p-4 md:p-5">
              <div className="flex justify-between items-center mb-3 md:mb-4">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <div className="relative">
                    <span className="text-base sm:text-lg md:text-xl">🔴</span>
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 md:w-2 md:h-2 bg-red-500 rounded-full animate-ping" />
                  </div>
                  <h2 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 dark:text-white">
                    Live Tests & Quizzes
                  </h2>
                </div>
                <Link
                  to="/live-tests"
                  className="text-xs md:text-sm text-brand-start dark:text-indigo-400 font-medium hover:underline flex items-center gap-1"
                >
                  View All <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                {/* Live Tests Column */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Radio className="w-4 h-4 text-red-500" />
                    <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                      Live Tests
                    </h3>
                    <span className="text-xs text-gray-400">
                      ({liveTests.length})
                    </span>
                  </div>
                  <div className="space-y-3">
                    {liveTestsLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="animate-pulse p-4 rounded-xl border bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-100 dark:border-red-800"
                          >
                            <div className="h-4 bg-red-200 dark:bg-red-800 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-red-100 dark:bg-red-900 rounded w-1/2"></div>
                          </div>
                        ))}
                      </div>
                    ) : liveTests.length > 0 ? (
                      liveTests.map((test) => {
                        const seriesSlug =
                          test.series?.slug ||
                          test.seriesSlug ||
                          test.series_slug ||
                          (test.category
                            ? String(test.category)
                                .toLowerCase()
                                .replace(/\s+/g, "-")
                            : "live-tests");
                        return (
                          <Link
                            key={test.id}
                            to={`/${seriesSlug}/tests/${test.id || test._id}/instructions?attemptNo=1`}
                            className="block p-4 rounded-xl border hover:shadow-lg transition-all cursor-pointer group bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-100 dark:border-red-800"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full text-white bg-red-500">
                                🔴 LIVE
                              </span>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <Users className="w-3 h-3" />{" "}
                                {(
                                  (Number(test.participants) || 0) / 1000
                                ).toFixed(1)}
                                k
                              </span>
                            </div>
                            <h3
                              className="font-bold text-gray-800 dark:text-white text-sm mb-2 line-clamp-1 group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors"
                              title={test.title}
                            >
                              {test.title}
                            </h3>
                            <div className="flex flex-col gap-1.5 text-[10px] text-gray-600 dark:text-gray-400 mb-3">
                              <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1 font-semibold">
                                  <Clock className="w-3 h-3 text-red-500" />{" "}
                                  {test.duration}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 font-medium text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-800/60">
                                <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span
                                  className="truncate"
                                  title={`Available: ${test.timePeriod}`}
                                >
                                  Available: {test.timePeriod}
                                </span>
                              </div>
                            </div>
                            <span className="block w-full py-2 bg-red-500 group-hover:bg-red-600 text-white text-xs font-semibold rounded-lg text-center transition">
                              Start Now
                            </span>
                          </Link>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 bg-gradient-to-br from-red-50/50 to-orange-50/50 dark:from-red-900/10 dark:to-orange-900/10 rounded-xl border border-dashed border-red-200 dark:border-red-800">
                        <Radio className="w-10 h-10 text-red-300 dark:text-red-700 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                          No Live Tests Right Now
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                          New live tests are scheduled regularly. Check back
                          soon!
                        </p>
                        <Link
                          to="/test-series"
                          className="text-xs text-brand-start dark:text-indigo-400 font-medium hover:underline"
                        >
                          Browse Test Series →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                {/* Free Quizzes Column */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <HelpCircle className="w-4 h-4 text-blue-500" />
                    <h3 className="font-semibold text-gray-700 dark:text-gray-300 text-sm">
                      Free Quizzes
                    </h3>
                    <span className="text-xs text-gray-400">
                      ({freeQuizzes.length})
                    </span>
                  </div>
                  <div className="space-y-3">
                    {freeQuizzesLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="animate-pulse p-4 rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-100 dark:border-blue-800"
                          >
                            <div className="h-4 bg-blue-200 dark:bg-blue-800 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-blue-100 dark:bg-blue-900 rounded w-1/2"></div>
                          </div>
                        ))}
                      </div>
                    ) : freeQuizzes.length > 0 ? (
                      freeQuizzes.map((test) => {
                        const seriesSlug =
                          test.series?.slug ||
                          test.seriesSlug ||
                          test.series_slug ||
                          (test.category
                            ? String(test.category)
                                .toLowerCase()
                                .replace(/\s+/g, "-")
                            : "live-tests");
                        return (
                          <Link
                            key={test.id}
                            to={`/${seriesSlug}/tests/${test.id || test._id}/instructions?attemptNo=1`}
                            className="block p-4 rounded-xl border hover:shadow-lg transition-all cursor-pointer group bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-100 dark:border-blue-800"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full text-white bg-blue-500">
                                  ⚡ QUIZ
                                </span>
                                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                  FREE
                                </span>
                              </div>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                <Users className="w-3 h-3" />{" "}
                                {(
                                  (Number(test.participants) || 0) / 1000
                                ).toFixed(1)}
                                k
                              </span>
                            </div>
                            <h3 className="font-bold text-gray-800 dark:text-white text-sm mb-2 line-clamp-1 group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors">
                              {test.title}
                            </h3>
                            <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-400 mb-3">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {test.duration}
                              </span>
                              <span>{test.startTime}</span>
                            </div>
                            <span className="block w-full py-2 bg-blue-500 group-hover:bg-blue-600 text-white text-xs font-semibold rounded-lg text-center transition">
                              Start Now
                            </span>
                          </Link>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl border border-dashed border-blue-200 dark:border-blue-800">
                        <HelpCircle className="w-10 h-10 text-blue-300 dark:text-blue-700 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                          No Free Quizzes Available
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                          Practice quizzes are added frequently. Stay tuned!
                        </p>
                        <Link
                          to="/test-series"
                          className="text-xs text-brand-start dark:text-indigo-400 font-medium hover:underline"
                        >
                          Explore Test Series →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* MY EXAMS */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-3.5 sm:p-4 md:p-5">
              <div className="flex justify-between items-center mb-3 md:mb-4">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <h2 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 dark:text-white">
                    My Exams
                  </h2>
                  {enrolledExams.length > 0 && (
                    <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-[10px] md:text-xs font-bold px-2 py-0.5 rounded-full">
                      {enrolledExams.length} Enrolled
                    </span>
                  )}
                </div>
                <Link
                  to="/exams"
                  className="text-xs md:text-sm text-brand-start dark:text-indigo-400 font-medium hover:underline flex items-center gap-1"
                >
                  Browse <span className="hidden sm:inline">Exams</span>{" "}
                  <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </Link>
              </div>
              {enrolledExams.length > 0 ? (
                <div
                  ref={examsScrollRef}
                  className="flex gap-2.5 sm:gap-4 overflow-x-auto pb-2 -mx-3.5 pl-4 pr-3.5 sm:mx-0 sm:px-0 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
                  {enrolledExams.map((exam) => (
                    <Link
                      key={exam.examId || exam.id}
                      to={`/exam/${exam.examId || exam.id}`}
                      className="p-3.5 sm:p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all group flex-shrink-0 w-[240px] sm:w-[290px] snap-start"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="text-2xl group-hover:scale-110 transition-transform">
                          {exam.icon}
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-800 dark:text-white text-sm">
                            {exam.name}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {exam.description || "View details"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                          View Details
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <div className="text-xl sm:text-2xl lg:text-3xl mb-2">📚</div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
                    You haven't enrolled in any exams yet
                  </p>
                  <Link
                    to="/exams"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-brand-start text-white text-sm font-semibold rounded-lg hover:opacity-90 transition"
                  >
                    Browse Exams <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>

            {/* AI STUDY ASSISTANT & DUE FOR REVIEW (2-COLUMN GRID IN LEFT COLUMN) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-5">
              {/* AI STUDY ASSISTANT CARD */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col justify-between">
                <div>
                  {/* Header */}
                  <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 p-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                        <Brain className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-white tracking-tight leading-none">
                          AI Study Assistant
                        </h3>
                        <p className="text-xs text-purple-100 mt-1 font-medium">
                          Smart AI tutor & daily insights
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-sm">
                      AI Powered
                    </span>
                  </div>

                  {/* Body */}
                  <div className="p-4 space-y-3.5">
                    {/* Daily Tip Display */}
                    {dailyTip ? (
                      <div className="bg-gradient-to-r from-purple-50/80 to-indigo-50/80 dark:from-purple-950/40 dark:to-indigo-950/40 border border-purple-100 dark:border-purple-800/40 rounded-xl p-3.5 relative">
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-700 dark:text-gray-200 italic leading-relaxed">
                            "{dailyTip}"
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        Get personalized daily study strategy or ask our
                        Socratic AI tutor any subject doubt.
                      </p>
                    )}

                    {/* Action Buttons Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={tipLoading}
                        onClick={async () => {
                          if (tipLoading) return;
                          setTipLoading(true);
                          try {
                            const tip = await aiAPI.getDailyTip();
                            setDailyTip(tip);
                          } catch {
                            setDailyTip(null);
                          } finally {
                            setTipLoading(false);
                          }
                        }}
                        className="w-full py-2.5 px-3 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-xl border border-purple-100 dark:border-purple-800/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-60"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        <span>Daily Tip</span>
                      </button>

                      <Link
                        to="/ai-tutor"
                        className="w-full py-2.5 px-3 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-xl border border-indigo-100 dark:border-indigo-800/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Brain className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>Ask AI Tutor</span>
                      </Link>
                    </div>
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="px-4 pb-4">
                  <Link
                    to="/practice"
                    className="block w-full text-center py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow transition-all"
                  >
                    Launch Practice Lab →
                  </Link>
                </div>
              </div>

              {/* DUE FOR REVIEW CARD */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col justify-between">
                <div>
                  {/* Header */}
                  <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                        <Timer className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-white tracking-tight leading-none">
                          Due for Review
                        </h3>
                        <p className="text-xs text-amber-100 mt-1 font-medium">
                          Spaced repetition smart memory
                        </p>
                      </div>
                    </div>

                    {dueRevisions.length > 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs font-bold text-white backdrop-blur-sm">
                        {dueRevisions.length} Due
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-sm">
                        All Caught Up
                      </span>
                    )}
                  </div>

                  {/* Body */}
                  <div className="p-4">
                    {dueRevisions.length === 0 ? (
                      <div className="text-center py-4 px-2 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-dashed border-amber-200 dark:border-amber-800/40">
                        <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-2">
                          <CheckCircle className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                          No Pending Revisions
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                          Your memory deck is up to date!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dueRevisions.slice(0, 3).map((rev, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-2.5 bg-amber-50/70 dark:bg-amber-950/30 rounded-xl border border-amber-100/80 dark:border-amber-900/40"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <RefreshCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                                {rev.topic_name ||
                                  rev.question_text?.substring(0, 38) ||
                                  `Revision Topic ${i + 1}`}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded-md shrink-0">
                              Due Now
                            </span>
                          </div>
                        ))}
                        {dueRevisions.length > 3 && (
                          <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 font-medium pt-1">
                            +{dueRevisions.length - 3} additional revision items
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="px-4 pb-4">
                  <Link
                    to="/spaced-repetition"
                    className="block w-full text-center py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow transition-all"
                  >
                    {dueRevisions.length > 0
                      ? "Start Review Session →"
                      : "Open Spaced Repetition →"}
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - SIDEBAR */}
          <div className="lg:col-span-4 space-y-4 sm:space-y-6">
            {/* RECENT ACTIVITY */}
            <RecentActivity recentActivity={recentActivity} />

            {/* TOP PERFORMERS */}
            <TopPerformers
              user={user}
              userStats={userStats}
              topPerformersLoading={topPerformersLoading}
              topPerformers={topPerformers}
            />

            {/* SUGGESTED / RECOMMENDED TEST SERIES - SIDEBAR */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
              {/* Subtle Refined Mixed Header */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-3.5 flex items-center justify-between text-white border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/20 flex items-center justify-center text-amber-300">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-tight leading-none">
                      Recommended For You
                    </h2>
                    <p className="text-[11px] text-slate-300/80 mt-0.5 font-medium">
                      Top series curated for your exam goals
                    </p>
                  </div>
                </div>

                <Link
                  to="/test-series"
                  className="text-[11px] font-semibold text-white/90 bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded-lg backdrop-blur-sm flex items-center gap-1 transition-[background-color,transform] duration-150 group"
                >
                  <span>Explore</span>
                  <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>

              {/* Enhanced Cards List */}
              <div className="p-3 sm:p-3.5 space-y-2 sm:space-y-2.5">
                {testSeries.slice(0, 4).map((series) => {
                  const seriesId = series.slug || series.id || series._id;
                  const emoji = getCategoryEmojiForDashboard(
                    series.categoryName || series.category,
                  );
                  const enrolled =
                    isSeriesEnrolled(user, series) ||
                    isSeriesEnrolled(userEnrolledSeries, series);
                  const totalCount = Number(
                    series.totalTests || series.total_tests || 0,
                  );
                  const freeCount = Number(
                    series.freeTests || series.free_tests || 0,
                  );
                  const isProSeries = Boolean(
                    series.isPro ||
                    series.is_pro ||
                    (freeCount === 0 && totalCount > 0),
                  );

                  return (
                    <Link
                      key={series._id || series.id}
                      to={`/test-series/${seriesId}`}
                      className="group relative flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-gray-50/90 dark:bg-gray-700/40 hover:bg-white dark:hover:bg-gray-700/80 rounded-xl border border-gray-100 dark:border-gray-600/70 hover:border-indigo-300 dark:hover:border-indigo-500/50 shadow-xs hover:shadow-md transition-[border-color,box-shadow,background-color,transform] duration-150"
                    >
                      {/* Icon container */}
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-300/40 dark:border-amber-700/30 flex items-center justify-center text-lg sm:text-xl shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-xs">
                        {series.icon || emoji}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider truncate">
                            {series.categoryName ||
                              series.category ||
                              "Test Series"}
                          </span>
                          {isProSeries ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-gradient-to-r from-amber-500 to-orange-500 text-white flex items-center gap-0.5 shadow-xs">
                              <Crown className="w-2.5 h-2.5" /> PRO
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                              FREE
                            </span>
                          )}
                        </div>

                        <h3 className="font-bold text-xs text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {series.title}
                        </h3>

                        <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1 font-medium">
                            <BookOpen className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                            {totalCount > 0
                              ? `${totalCount} Tests`
                              : "Full Series"}
                          </span>
                          {freeCount > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                              • {freeCount} Free
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right Action / Enrolled Tag */}
                      <div className="shrink-0 flex items-center">
                        {enrolled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                            <CheckCircle className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                            <span>Enrolled</span>
                          </span>
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 flex items-center justify-center text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:border-indigo-300 transition-all shadow-xs">
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}

                {/* Footer Link */}
                <Link
                  to="/test-series"
                  className="mt-3 w-full py-2 px-3 text-center text-xs font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50/70 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 rounded-xl border border-indigo-200/60 dark:border-indigo-800/40 flex items-center justify-center gap-1.5 transition-all group shadow-xs"
                >
                  <span>Browse All Test Series</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
