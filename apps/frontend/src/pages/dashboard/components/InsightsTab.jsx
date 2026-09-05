import React from "react";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import {
  Layers,
  Trophy,
  Wind,
  Brain,
  ChevronRight,
  AlertCircle,
  Timer,
  BookOpen,
  Target,
  Zap,
} from "lucide-react";

export function generateRecommendations({
  analytics,
  timeAnalysis = [],
  difficultyBreakdown = {},
  topperComparison = {},
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

export default function InsightsTab({
  attemptPattern = [],
  topperComparison = { userScore: 0, topperScore: 100, gap: 0, percent: 0 },
  timeAnalysis = [],
  effectiveAnalytics = {},
  difficultyBreakdown = {},
}) {
  return (
    <div className="space-y-6">
      {/* Attempt Pattern per Subject */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
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
          <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
            <Layers className="w-10 h-10 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Complete tests to unlock attempt pattern analysis
            </p>
            <Link
              to="/test-series"
              className="mt-3 inline-block text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:underline"
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
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
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
                💡 Closing this gap needs ~{Math.ceil(topperComparison.gap / 5)}{" "}
                focused practice tests
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
                  100 - (effectiveAnalytics?.subjectWise?.[i]?.accuracy || 50),
                ),
              );
              return (
                <div
                  key={i}
                  className="absolute w-3 h-3 rounded-full bg-indigo-600 shadow-md transition-all hover:scale-150 cursor-pointer group"
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
          <Brain className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
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
                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline mt-1.5 inline-flex items-center gap-1"
                  >
                    {rec.actionLabel} <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

InsightsTab.propTypes = {
  attemptPattern: PropTypes.array,
  topperComparison: PropTypes.object,
  timeAnalysis: PropTypes.array,
  effectiveAnalytics: PropTypes.object,
  difficultyBreakdown: PropTypes.object,
};
