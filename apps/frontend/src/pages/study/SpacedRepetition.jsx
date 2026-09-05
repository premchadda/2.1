import { useState, useEffect, useCallback, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useAuth } from "../../shared/providers/AuthContext";
import { aiAPI } from "../../shared/lib/dataService";
import { AnimatedHero } from "../../shared/components";
import MathRenderer from "../../shared/components/MathRenderer";
import toast from "react-hot-toast";
import {
  RefreshCw,
  Brain,
  CheckCircle,
  ChevronRight,
  Clock,
  Sparkles,
  BookOpen,
  Target,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";

// Flashcard component with flip animation
function Flashcard({ card, onKnow, onNeedsReview, index }) {
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState(null);

  const handleFlip = () => {
    if (!answered) setFlipped(!flipped);
  };

  const handleKnow = () => {
    setAnswered(true);
    setResult("known");
    onKnow(card);
  };

  const handleNeedsReview = () => {
    setAnswered(true);
    setResult("needs_review");
    onNeedsReview(card);
  };

  const priorityLabel = {
    high: {
      text: "High Priority",
      color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
    medium: {
      text: "Medium Priority",
      color:
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    },
    low: {
      text: "Low Priority",
      color:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
  };
  const priority = priorityLabel[card.priority] || priorityLabel.medium;

  return (
    <div
      className="w-full max-w-[95vw] sm:max-w-xl mx-auto"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      <div className="perspective-1000 cursor-pointer" onClick={handleFlip}>
        <div
          className={`relative w-full min-h-[320px] transition-transform duration-500 transform-style-3d ${
            flipped ? "rotate-y-180" : ""
          }`}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Front face */}
          <div
            className={`absolute inset-0 w-full h-full backface-hidden rounded-2xl border p-6 flex flex-col ${
              answered
                ? result === "known"
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700"
                  : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700"
                : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-lg"
            } transition-colors duration-300`}
            style={{ backfaceVisibility: "hidden" }}
          >
            <div className="flex items-center justify-between mb-4">
              <span
                className={`px-2.5 py-1 text-[10px] font-bold rounded-full ${priority.color}`}
              >
                {priority.text}
              </span>
              {card.topic_name && (
                <span
                  className="px-2.5 py-1 text-[10px] font-medium rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 truncate max-w-[140px]"
                  title={card.topic_name}
                >
                  {card.topic_name}
                </span>
              )}
            </div>

            <div className="flex-1 flex flex-col justify-center text-center">
              <div className="text-gray-900 dark:text-white text-lg font-semibold leading-relaxed">
                <MathRenderer text={card.question_text || ""} />
              </div>
            </div>

            {card.difficulty && (
              <div className="mt-4 flex items-center justify-center gap-1.5">
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  Difficulty:
                </span>
                <span
                  className={`text-[10px] font-bold ${
                    card.difficulty === "hard"
                      ? "text-red-500"
                      : card.difficulty === "medium"
                        ? "text-amber-500"
                        : "text-green-500"
                  }`}
                >
                  {String(card.difficulty || "")
                    .charAt(0)
                    .toUpperCase() + String(card.difficulty || "").slice(1)}
                </span>
              </div>
            )}

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Tap to reveal answer
              </p>
            </div>
          </div>

          {/* Back face */}
          <div
            className={`absolute inset-0 w-full h-full backface-hidden rounded-2xl border p-6 flex flex-col bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border-indigo-200 dark:border-indigo-700 ${
              flipped ? "" : "pointer-events-none"
            }`}
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-400">
                Answer
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-center text-center">
              <div className="text-gray-900 dark:text-white text-lg font-medium leading-relaxed">
                <MathRenderer
                  text={card.correct_option || "No answer available"}
                />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-3">
                Did you know this?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleKnow();
                  }}
                  disabled={answered}
                  className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Know it
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNeedsReview();
                  }}
                  disabled={answered}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Needs Review
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stats bar component
function StatsBar({ stats }) {
  if (!stats) return null;
  const items = [
    {
      label: "Due Now",
      value: stats.due_now || 0,
      icon: Clock,
      color: "text-red-500",
    },
    {
      label: "High Priority",
      value: stats.high_priority || 0,
      icon: AlertTriangle,
      color: "text-amber-500",
    },
    {
      label: "In Queue",
      value: stats.total_in_queue || 0,
      icon: BookOpen,
      color: "text-blue-500",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-3 text-center"
        >
          <item.icon className={`w-5 h-5 mx-auto mb-1 ${item.color}`} />
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {item.value}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}

// Revision Plan card
function RevisionPlanCard({ plan, loading }) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (!plan) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="font-bold text-gray-900 dark:text-white">
            AI Revision Plan
          </h3>
          {plan.model && (
            <span className="px-2 py-0.5 text-[9px] font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              {plan.model}
            </span>
          )}
        </div>

        {plan.weakAreas && plan.weakAreas.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Focus Areas
            </p>
            <div className="flex flex-wrap gap-2">
              {plan.weakAreas.map((area, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                >
                  {area.topicName} ({area.accuracy ?? "N/A"}%)
                </span>
              ))}
            </div>
          </div>
        )}

        {plan.wrongQuestionsCount > 0 && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
            <p className="text-xs text-red-600 dark:text-red-400">
              <span className="font-bold">{plan.wrongQuestionsCount}</span>{" "}
              questions need review
            </p>
          </div>
        )}

        {plan.revisionPlan ? (
          <div
            className={`text-sm text-gray-700 dark:text-gray-300 leading-relaxed ${expanded ? "" : "line-clamp-4"}`}
          >
            {Array.isArray(plan.revisionPlan) ? (
              plan.revisionPlan.map((item, i) => (
                <p key={i} className="whitespace-pre-wrap">
                  {item}
                </p>
              ))
            ) : (
              <p className="whitespace-pre-wrap">{plan.revisionPlan}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No revision plan yet.
          </p>
        )}
        {String(plan.revisionPlan || "").length > 200 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </div>
  );
}

// Main SpacedRepetition component
export default function SpacedRepetition() {
  const { user: _user } = useAuth();
  const [dueCards, setDueCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [revisionPlan, setRevisionPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionStats, setSessionStats] = useState({ known: 0, review: 0 });
  const timerRef = useRef(null);
  const signalRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const fetchDueRevisions = useCallback(async (signal) => {
    try {
      setLoading(true);
      signalRef.current = signal;
      const data = await aiAPI.getDueRevisions();
      if (signal?.aborted) return;
      setDueCards(data || []);
      setCurrentIndex(0);
      setSessionComplete(false);
      setSessionStats({ known: 0, review: 0 });
    } catch (error) {
      if (error.name !== "AbortError") toast.error("Failed to load revisions");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async (signal) => {
    try {
      const data = await aiAPI.getRevisionStats();
      if (signal?.aborted) return;
      setStats(data);
    } catch {
      // Stats fetch failure is non-fatal; null stats show empty state
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      await fetchDueRevisions(controller.signal);
      if (controller.signal.aborted) return;
      await fetchStats(controller.signal);
    };
    run();
    return () => controller.abort();
  }, [fetchDueRevisions, fetchStats]);

  const handleKnow = async (card) => {
    try {
      await aiAPI.completeRevision(card.question_id, true);
      if (signalRef.current?.aborted) return;
      setSessionStats((prev) => ({ ...prev, known: prev.known + 1 }));
      timerRef.current = setTimeout(moveToNext, 800);
    } catch {
      toast.error("Failed to record response");
    }
  };

  const handleNeedsReview = async (card) => {
    try {
      await aiAPI.completeRevision(card.question_id, false);
      if (signalRef.current?.aborted) return;
      setSessionStats((prev) => ({ ...prev, review: prev.review + 1 }));
      timerRef.current = setTimeout(moveToNext, 800);
    } catch {
      toast.error("Failed to record response");
    }
  };

  const moveToNext = () => {
    if (currentIndex + 1 >= dueCards.length) {
      setSessionComplete(true);
      toast.success("Session complete! Great work!");
      fetchStats();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const generatePlan = async () => {
    try {
      setPlanLoading(true);
      const plan = await aiAPI.getRevisionPlan();
      setRevisionPlan(plan);
      toast.success("Revision plan generated!");
    } catch {
      toast.error("Failed to generate plan");
    } finally {
      setPlanLoading(false);
    }
  };

  const progress =
    dueCards.length > 0
      ? Math.round(((currentIndex + 1) / dueCards.length) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-8 page-transition fade-in">
      <Helmet>
        <title>Spaced Repetition | Trstprep</title>
        <meta
          name="description"
          content="Smart revision with spaced repetition - review questions at optimal intervals."
        />
      </Helmet>

      <AnimatedHero pageType="dashboard">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg animate-scale-in">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <div className="text-white">
              <h1 className="text-2xl md:text-xl sm:text-2xl lg:text-3xl font-bold">
                Spaced Repetition
              </h1>
              <p className="text-purple-100 text-sm mt-1">
                Review at optimal intervals for lasting memory
              </p>
            </div>
          </div>
          <button
            onClick={generatePlan}
            disabled={planLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/20 backdrop-blur-sm text-white text-sm font-semibold rounded-xl hover:bg-white/30 transition border border-white/20 disabled:opacity-50"
          >
            {planLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {planLoading ? "Generating..." : "Generate AI Plan"}
          </button>
        </div>
      </AnimatedHero>

      <div className="max-w-4xl mx-auto px-4 -mt-6 relative z-10 space-y-6">
        {/* Stats */}
        <StatsBar stats={stats} />

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Flashcard Area */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
                  <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                  <div className="flex gap-3">
                    <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl flex-1"></div>
                    <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl flex-1"></div>
                  </div>
                </div>
              </div>
            ) : dueCards.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center">
                <div className="text-3xl sm:text-4xl lg:text-5xl mb-4">🎉</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  All caught up!
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  No revisions due right now. Keep practicing to build your
                  revision queue.
                </p>
                <Link
                  to="/practice"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
                >
                  Start Practicing <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : sessionComplete ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-8 text-center">
                <div className="text-3xl sm:text-4xl lg:text-5xl mb-4">💪</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Session Complete!
                </h3>
                <div className="flex justify-center gap-6 my-6">
                  <div className="text-center">
                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600 dark:text-green-400">
                      {sessionStats.known}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Known
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-amber-600 dark:text-amber-400">
                      {sessionStats.review}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Needs Review
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {sessionStats.review > 0
                    ? "Questions needing review have been rescheduled."
                    : "Perfect session! All questions remembered."}
                </p>
                <button
                  onClick={() => fetchDueRevisions()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
                >
                  <RefreshCw className="w-4 h-4" /> Check for More
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Progress bar */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {currentIndex + 1} / {dueCards.length}
                  </span>
                </div>

                {/* Flashcard */}
                {dueCards[currentIndex] && (
                  <Flashcard
                    key={dueCards[currentIndex].id}
                    card={dueCards[currentIndex]}
                    index={0}
                    onKnow={handleKnow}
                    onNeedsReview={handleNeedsReview}
                  />
                )}

                {/* Keyboard hint */}
                <div className="flex justify-center gap-4 text-[10px] text-gray-400 dark:text-gray-500">
                  <span>Click card to flip</span>
                  <span>•</span>
                  <span>Then choose Know it or Needs Review</span>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Revision Plan */}
          <div className="lg:col-span-1">
            <div className="space-y-4">
              <RevisionPlanCard plan={revisionPlan} loading={planLoading} />

              {/* Quick Links */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Quick Actions
                </h3>
                <div className="space-y-2">
                  <Link
                    to="/practice"
                    className="flex items-center gap-2.5 p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition text-sm font-medium"
                  >
                    <Target className="w-4 h-4" />
                    Practice Lab
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </Link>
                  <Link
                    to="/dashboard"
                    className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition text-sm text-gray-600 dark:text-gray-400"
                  >
                    <TrendingUp className="w-4 h-4" />
                    View Dashboard
                    <ChevronRight className="w-4 h-4 ml-auto" />
                  </Link>
                </div>
              </div>

              {/* Info */}
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800 p-5">
                <h3 className="font-semibold text-indigo-900 dark:text-indigo-200 mb-2 text-sm">
                  How Spaced Repetition Works
                </h3>
                <ul className="text-xs text-indigo-700 dark:text-indigo-300 space-y-1.5">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">1.</span>
                    Questions due for review appear as flashcards
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">2.</span>
                    Flip the card to see the answer
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">3.</span>
                    Mark as "Known" or "Needs Review"
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">4.</span>
                    Review intervals adapt to your performance
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
