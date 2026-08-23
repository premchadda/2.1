import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../shared/providers/AuthContext";
import {
  AnimatedHero,
  Card,
  Badge,
  ScrollReveal,
} from "../../shared/components";
import { api } from "../../shared/lib/dataService";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Activity,
  Target,
  Clock,
  Award,
  Brain,
  Zap,
  AlertTriangle,
  CheckCircle,
  BookOpen,
  ChevronRight,
  Sparkles,
  Loader2,
} from "lucide-react";

const timeframeOptions = [
  "This Week",
  "This Month",
  "This Quarter",
  "All Time",
];

const TIMEFRAME_MAP = {
  "This Week": "week",
  "This Month": "month",
  "This Quarter": "quarter",
  "All Time": "all",
};

function PerformanceInsights() {
  const { _user } = useAuth();
  const [timeframe, setTimeframe] = useState("This Month");
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (key) => {
    setExpandedSection(expandedSection === key ? null : key);
  };

  const {
    data: perfData,
    isError: errorPerf,
    isLoading: loadingPerf,
  } = useQuery({
    queryKey: ["intelligence-performance", timeframe],
    queryFn: async () => {
      const period = TIMEFRAME_MAP[timeframe] || "month";
      const res = await api.get(
        `/api/intelligence/performance?period=${period}`,
      );
      const data = res.data?.data || {};
      const summary = data.summary || data;
      return {
        ...data,
        totalTests: summary.testCount ?? 0,
        avgAccuracy: summary.overallAccuracy ?? 0,
        avgScore: summary.averageScore ?? 0,
        avgTimePerQuestion: summary.speedPerQuestion ?? 0,
        subjectWise: data.subjectWise || summary.subjectWise || [],
      };
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!_user,
  });

  const {
    data: weakTopics = [],
    isError: errorWeak = false,
    isLoading: loadingWeak,
  } = useQuery({
    queryKey: ["intelligence-weak-topics"],
    queryFn: async () => {
      const res = await api.get(
        "/api/intelligence/weak-topics?minAttempts=3&limit=10",
      );
      return res.data?.data || [];
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!_user,
  });

  const {
    data: recommendations = [],
    isError: errorRecs = false,
    isLoading: loadingRecs,
  } = useQuery({
    queryKey: ["intelligence-recommendations"],
    queryFn: async () => {
      const res = await api.get("/api/intelligence/recommendations?limit=6");
      return res.data?.data || [];
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!_user,
  });

  const { data: streakData } = useQuery({
    queryKey: ["intelligence-streak"],
    queryFn: async () => {
      const res = await api.get("/api/intelligence/streak");
      const data = res.data?.data || {};
      return {
        current: data.currentStreak ?? 0,
        longest: data.bestStreak ?? 0,
      };
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!_user,
  });

  const isLoading = loadingPerf || loadingWeak || loadingRecs;

  const overviewStats = [
    {
      label: "Tests Taken",
      value: perfData?.totalTests ?? 0,
      change: perfData?.testsChange
        ? `${perfData.testsChange > 0 ? "+" : ""}${perfData.testsChange}`
        : null,
      trend: perfData?.testsChange >= 0 ? "up" : "down",
      icon: BookOpen,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      label: "Avg. Accuracy",
      value: `${perfData?.avgAccuracy ?? 0}%`,
      change: perfData?.accuracyChange
        ? `${perfData.accuracyChange > 0 ? "+" : ""}${perfData.accuracyChange}%`
        : null,
      trend: perfData?.accuracyChange >= 0 ? "up" : "down",
      icon: Target,
      color: "text-green-500",
      bg: "bg-green-50 dark:bg-green-900/20",
    },
    {
      label: "Avg. Score",
      value: perfData?.avgScore?.toFixed(1) ?? "0.0",
      change: perfData?.scoreChange
        ? `${perfData.scoreChange > 0 ? "+" : ""}${perfData.scoreChange}`
        : null,
      trend: perfData?.scoreChange >= 0 ? "up" : "down",
      icon: Award,
      color: "text-purple-500",
      bg: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      label: "Time Spent",
      value: `${perfData?.totalHours ?? 0}h`,
      change: perfData?.hoursChange
        ? `${perfData.hoursChange > 0 ? "+" : ""}${perfData.hoursChange}h`
        : null,
      trend: perfData?.hoursChange >= 0 ? "up" : "down",
      icon: Clock,
      color: "text-orange-500",
      bg: "bg-orange-50 dark:bg-orange-900/20",
    },
    {
      label: "Streak",
      value: `${streakData?.current ?? 0} days`,
      change: streakData?.longest ? `Best: ${streakData.longest}` : null,
      trend: "neutral",
      icon: Zap,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-900/20",
    },
    {
      label: "Rank",
      value: perfData?.rank ? `#${perfData.rank}` : "—",
      change: perfData?.rankChange
        ? `${perfData.rankChange > 0 ? "+" : ""}${perfData.rankChange}`
        : null,
      trend: perfData?.rankChange >= 0 ? "up" : "down",
      icon: Award,
      color: "text-indigo-500",
      bg: "bg-indigo-50 dark:bg-indigo-900/20",
    },
  ];

  const subjectBreakdown = (perfData?.subjectWise || []).map((s) => ({
    name: s.name,
    accuracy: s.accuracy || 0,
    tests: s.attempted || 0,
    trend: (s.accuracy || 0) >= (s.prevAccuracy || 0) ? "up" : "down",
    color: s.color || "from-indigo-400 to-indigo-600",
  }));

  const weakAreas = weakTopics.map((t) => ({
    topic: t.topic || t.name,
    subject: t.subject,
    attempts: t.attempts || 0,
    accuracy: t.accuracy || 0,
    priority: (t.accuracy || 0) < 40 ? "high" : "medium",
  }));

  const recList = Array.isArray(recommendations)
    ? recommendations
    : recommendations?.dashboardSuggestions ||
      recommendations?.recommendedTests ||
      [];

  const recs = recList.map((r) => ({
    icon: Brain,
    title: r.title || r.recommendation || (r.topic ? `Improve ${r.topic}` : ""),
    desc: r.description || r.reason || r.desc || "",
    action: r.actionLabel || "Practice Now",
    route: r.route || r.actionUrl || "/test-series",
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-8">
      <AnimatedHero pageType="analysis" compact>
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </Link>
          <div>
            <h1 className="text-2xl md:text-xl sm:text-2xl lg:text-3xl font-bold text-white">
              Performance Insights
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              Detailed analysis of your preparation progress
            </p>
          </div>
        </div>
      </AnimatedHero>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 relative z-20">
        {/* Timeframe Filter */}
        <ScrollReveal>
          <Card variant="elevated" size="md" className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-brand-start" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  Overview
                </span>
              </div>
              <div className="flex gap-1">
                {timeframeOptions.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      timeframe === tf
                        ? "bg-brand-start text-white"
                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </ScrollReveal>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
          {overviewStats.map((stat, i) => (
            <ScrollReveal key={stat.label} delay={i * 0.03}>
              <Card variant="elevated" size="md" hover>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}
                  >
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  {stat.change && (
                    <span
                      className={`text-xs font-medium ${stat.trend === "up" ? "text-green-600" : stat.trend === "down" ? "text-red-600" : "text-gray-500"}`}
                    >
                      {stat.trend === "up" && (
                        <TrendingUp className="w-3 h-3 inline" />
                      )}
                      {stat.trend === "down" && (
                        <TrendingDown className="w-3 h-3 inline" />
                      )}
                      {stat.change}
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {isLoading ? (
                    <span className="inline-block w-12 h-6 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
                  ) : (
                    stat.value
                  )}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {stat.label}
                </p>
              </Card>
            </ScrollReveal>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          {/* Subject Breakdown */}
          <div className="lg:col-span-7">
            <ScrollReveal>
              <Card variant="elevated" className="h-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-brand-start" />
                    Subject-wise Performance
                  </h3>
                </div>
                {loadingPerf ? (
                  <LoadingPlaceholder />
                ) : subjectBreakdown.length > 0 ? (
                  <div className="space-y-4">
                    {subjectBreakdown.map((subject) => (
                      <div key={subject.name}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {subject.name}
                            </span>
                            <span className="text-xs text-gray-400">
                              ({subject.tests} tests)
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-sm font-bold ${subject.accuracy >= 70 ? "text-green-600" : subject.accuracy >= 50 ? "text-amber-600" : "text-red-600"}`}
                            >
                              {subject.accuracy}%
                            </span>
                            {subject.trend === "up" ? (
                              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                            )}
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${subject.color} transition-all duration-500`}
                            style={{ width: `${subject.accuracy}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyHint
                    icon={PieChart}
                    message="Complete tests to see subject-wise performance"
                  />
                )}
              </Card>
            </ScrollReveal>
          </div>

          {/* Weak Areas */}
          <div className="lg:col-span-5">
            <ScrollReveal delay={0.1}>
              <Card variant="elevated" className="h-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Areas to Improve
                  </h3>
                </div>
                {loadingWeak ? (
                  <LoadingPlaceholder />
                ) : weakAreas.length > 0 ? (
                  <div className="space-y-3">
                    {weakAreas.map((area) => (
                      <div
                        key={area.topic}
                        className="p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm text-gray-900 dark:text-white">
                            {area.topic}
                          </span>
                          <Badge
                            variant={
                              area.priority === "high" ? "error" : "warning"
                            }
                            size="xs"
                          >
                            {area.priority}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          {area.subject} · {area.attempts} attempts
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-red-500 rounded-full transition-all"
                              style={{ width: `${area.accuracy}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-red-600">
                            {area.accuracy}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-10 h-10 text-green-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">
                      No weak areas detected. Keep practicing!
                    </p>
                  </div>
                )}
              </Card>
            </ScrollReveal>
          </div>
        </div>

        {/* AI Recommendations */}
        <ScrollReveal delay={0.15}>
          <Card variant="elevated" className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-gray-900 dark:text-white">
                Smart Recommendations
              </h3>
              <Badge variant="primary" size="xs">
                AI-Powered
              </Badge>
            </div>
            {loadingRecs ? (
              <LoadingPlaceholder />
            ) : recs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recs.map((rec) => (
                  <div
                    key={rec.title}
                    className="p-4 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-750 rounded-xl border border-gray-200 dark:border-gray-700"
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-3">
                      <rec.icon className="w-5 h-5 text-brand-start" />
                    </div>
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                      {rec.title}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      {rec.desc}
                    </p>
                    <Link
                      to={rec.route}
                      className="text-xs font-semibold text-brand-start dark:text-indigo-400 hover:underline"
                    >
                      {rec.action} →
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyHint
                icon={Sparkles}
                message="Complete more tests to unlock AI recommendations"
              />
            )}
          </Card>
        </ScrollReveal>

        {/* Accordion Details */}
        <ScrollReveal delay={0.2}>
          <Card variant="elevated" className="mb-6">
            {[
              {
                key: "accuracy",
                icon: Target,
                title: "Accuracy Trends",
                content:
                  perfData?.accuracyTrend ||
                  `Your accuracy is ${perfData?.avgAccuracy || 0}%. ${perfData?.avgAccuracy >= 70 ? "Great work — maintain consistency." : "Focus on weak areas to improve."}`,
              },
              {
                key: "speed",
                icon: Clock,
                title: "Speed Analysis",
                content:
                  perfData?.speedAnalysis ||
                  `Average time per question: ${perfData?.avgTimePerQuestion || 0}s. ${perfData?.avgTimePerQuestion > 60 ? "Practice speed drills to reduce time." : "Good speed — keep it up."}`,
              },
              {
                key: "consistency",
                icon: Activity,
                title: "Consistency Score",
                content:
                  perfData?.consistencyNote ||
                  `Your current streak is ${streakData?.current || 0} days (best: ${streakData?.longest || 0}). Attempt tests regularly to build momentum.`,
              },
            ].map((section) => (
              <div
                key={section.key}
                className="border-b border-gray-100 dark:border-gray-700 last:border-b-0"
              >
                <button
                  onClick={() => toggleSection(section.key)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <section.icon className="w-4 h-4 text-brand-start" />
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {section.title}
                    </span>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-gray-400 transition-transform ${expandedSection === section.key ? "rotate-90" : ""}`}
                  />
                </button>
                {expandedSection === section.key && (
                  <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400 ml-9">
                    {section.content}
                  </div>
                )}
              </div>
            ))}
          </Card>
        </ScrollReveal>
      </div>
    </div>
  );
}

function LoadingPlaceholder() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 text-brand-start animate-spin" />
    </div>
  );
}

function EmptyHint({ icon: Icon, message }) {
  return (
    <div className="text-center py-10">
      <Icon className="w-10 h-10 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
      <p className="text-sm text-gray-400">{message}</p>
      <Link
        to="/test-series"
        className="mt-3 inline-block text-brand-start font-bold text-sm hover:underline"
      >
        Start practicing →
      </Link>
    </div>
  );
}

export default PerformanceInsights;
