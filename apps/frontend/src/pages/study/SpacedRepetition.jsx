import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { aiAPI } from "../../shared/lib/dataService";
import { AnimatedHero } from "../../shared/components";
import MathRenderer from "../../shared/components/MathRenderer";
import toast from "react-hot-toast";
import {
  RefreshCw,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  Sparkles,
  BookOpen,
  Target,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  RotateCw,
  Zap,
} from "lucide-react";

/**
 * Safely normalizes question options from array, object or JSON string.
 */
function normalizeOptions(options) {
  if (!options) return [];
  if (Array.isArray(options)) return options;
  if (typeof options === "object") return Object.values(options);
  if (typeof options === "string") {
    try {
      const parsed = JSON.parse(options);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === "object") return Object.values(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Modern 3D Flashcard component with active recall self-assessment.
 */
function Flashcard({ card, onKnow, onNeedsReview, index }) {
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState(null);

  // Reset flip state when card changes
  useEffect(() => {
    setFlipped(false);
    setAnswered(false);
    setResult(null);
  }, [card?.id, card?.question_id]);

  const handleFlip = useCallback(() => {
    if (!answered) setFlipped((prev) => !prev);
  }, [answered]);

  const handleKnow = useCallback(() => {
    if (answered) return;
    setAnswered(true);
    setResult("known");
    onKnow(card);
  }, [answered, card, onKnow]);

  const handleNeedsReview = useCallback(() => {
    if (answered) return;
    setAnswered(true);
    setResult("needs_review");
    onNeedsReview(card);
  }, [answered, card, onNeedsReview]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input
      if (["INPUT", "TEXTAREA"].includes(e.target?.tagName)) return;

      if (e.code === "Space" || e.key === "Enter") {
        e.preventDefault();
        handleFlip();
      } else if (flipped && !answered) {
        if (e.key === "1" || e.key === "ArrowLeft") {
          e.preventDefault();
          handleNeedsReview();
        } else if (e.key === "2" || e.key === "ArrowRight") {
          e.preventDefault();
          handleKnow();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flipped, answered, handleFlip, handleKnow, handleNeedsReview]);

  const priorityConfig = {
    high: {
      text: "High Priority",
      badge:
        "bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border-rose-200/80 dark:border-rose-800/60",
      dot: "bg-rose-500",
    },
    medium: {
      text: "Medium Priority",
      badge:
        "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/60",
      dot: "bg-amber-500",
    },
    low: {
      text: "Low Priority",
      badge:
        "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/60",
      dot: "bg-emerald-500",
    },
  };

  const priority = priorityConfig[card.priority] || priorityConfig.medium;
  const options = useMemo(() => normalizeOptions(card.options), [card.options]);

  return (
    <div
      className="w-full max-w-2xl mx-auto"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="perspective-1000">
        <div
          className="relative w-full min-h-[380px] sm:min-h-[420px] transition-transform duration-500 transform-style-3d"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            transition: "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          {/* ================= FRONT FACE (QUESTION) ================= */}
          <div
            className={`absolute inset-0 w-full h-full rounded-2xl sm:rounded-3xl border p-4 sm:p-6 md:p-7 flex flex-col justify-between shadow-soft transition-all duration-300 ${
              answered
                ? result === "known"
                  ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                  : "bg-amber-50/90 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                : "bg-white dark:bg-gray-800 border-slate-200/90 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-lg"
            }`}
            style={{ backfaceVisibility: "hidden" }}
          >
            {/* Header Badges */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-3.5 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-full border shadow-2xs ${priority.badge}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${priority.dot}`}
                    />
                    {priority.text}
                  </span>

                  {card.difficulty && (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] sm:text-xs font-bold rounded-full border shadow-2xs ${
                        card.difficulty === "hard"
                          ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200/80 dark:border-red-800/60"
                          : card.difficulty === "medium"
                            ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/60"
                            : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/60"
                      }`}
                    >
                      {String(card.difficulty).toUpperCase()}
                    </span>
                  )}
                </div>

                {card.topic_name && (
                  <span
                    className="px-2.5 py-1 text-[10px] sm:text-xs font-semibold rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 truncate max-w-[160px] sm:max-w-[220px]"
                    title={card.topic_name}
                  >
                    {card.topic_name}
                  </span>
                )}
              </div>

              {/* Question Text */}
              <div className="py-2 sm:py-3">
                <div className="text-gray-900 dark:text-white text-base sm:text-lg md:text-xl font-bold leading-relaxed">
                  <MathRenderer text={card.question_text || ""} />
                </div>
              </div>

              {/* Multiple Choice Options Preview (if present) */}
              {options.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 sm:mt-3">
                  {options.map((opt, i) => (
                    <div
                      key={i}
                      className="px-3 py-2 bg-slate-50 dark:bg-gray-750/70 border border-slate-200/70 dark:border-gray-700/80 rounded-xl text-xs text-slate-700 dark:text-gray-300 flex items-center gap-2"
                    >
                      <span className="w-5 h-5 rounded-md bg-white dark:bg-gray-700 text-slate-600 dark:text-gray-300 font-bold text-[10px] flex items-center justify-center shrink-0 border border-slate-200 dark:border-gray-600">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="truncate">
                        <MathRenderer text={String(opt)} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Tap to Reveal Action */}
            <div className="pt-4 border-t border-slate-100 dark:border-gray-700/60 mt-4">
              <button
                type="button"
                onClick={handleFlip}
                disabled={answered}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl sm:rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-indigo-500/20 transition-all cursor-pointer group active:scale-[0.98]"
              >
                <RotateCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                <span>Reveal Answer & Explanation</span>
              </button>
              <div className="flex items-center justify-center gap-2 mt-2 text-[10px] sm:text-xs text-slate-400 dark:text-gray-500">
                <span>Press Space or Tap button to flip</span>
              </div>
            </div>
          </div>

          {/* ================= BACK FACE (ANSWER & EVALUATION) ================= */}
          <div
            className="absolute inset-0 w-full h-full rounded-2xl sm:rounded-3xl border border-indigo-200 dark:border-indigo-800 p-4 sm:p-6 md:p-7 flex flex-col justify-between shadow-soft bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/60 dark:from-gray-800 dark:via-gray-800 dark:to-indigo-950/30"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            {/* Header: Answer Tag */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs font-extrabold shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Verified Answer</span>
                </div>
                <button
                  type="button"
                  onClick={handleFlip}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>View Question</span>
                </button>
              </div>

              {/* Correct Answer Display */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-gray-750 border border-emerald-200/80 dark:border-emerald-700/60 shadow-xs mb-3">
                <div className="text-xs uppercase font-extrabold text-emerald-700 dark:text-emerald-400 mb-1">
                  Correct Option:
                </div>
                <div className="text-gray-900 dark:text-white text-base sm:text-lg font-bold leading-relaxed">
                  <MathRenderer
                    text={card.correct_option || "No answer text available"}
                  />
                </div>
              </div>

              {/* Explanation (if provided) */}
              {(card.explanation || card.metadata?.explanation) && (
                <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs text-slate-700 dark:text-gray-300 leading-relaxed max-h-[140px] overflow-y-auto">
                  <span className="font-bold text-indigo-700 dark:text-indigo-400 block mb-0.5">
                    Concept Note:
                  </span>
                  <MathRenderer
                    text={card.explanation || card.metadata?.explanation}
                  />
                </div>
              )}
            </div>

            {/* Self-Assessment Buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-gray-700/60 mt-3">
              <p className="text-xs font-bold text-slate-600 dark:text-gray-400 text-center mb-2.5">
                Did you recall this correctly?
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleNeedsReview}
                  disabled={answered}
                  className="py-3 px-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-[0.98]"
                >
                  <RotateCcw className="w-4 h-4 shrink-0" />
                  <span>Needs Review</span>
                  <span className="hidden sm:inline-block text-[10px] opacity-80">
                    (1)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleKnow}
                  disabled={answered}
                  className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl sm:rounded-2xl transition flex items-center justify-center gap-2 shadow-sm cursor-pointer active:scale-[0.98]"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Know It</span>
                  <span className="hidden sm:inline-block text-[10px] opacity-80">
                    (2)
                  </span>
                </button>
              </div>

              <div className="flex items-center justify-center gap-3 mt-2 text-[10px] text-slate-400 dark:text-gray-500">
                <span>[1] Repeat Soon</span>
                <span>•</span>
                <span>[2] Increase Interval</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact, responsive 3-column stats bar matching modern mobile layout.
 */
function StatsBar({ stats }) {
  if (!stats) return null;

  const items = [
    {
      label: "Due Now",
      value: stats.due_now || 0,
      icon: Clock,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/60 border-rose-200/70 dark:border-rose-900/50",
    },
    {
      label: "High Priority",
      value: stats.high_priority || 0,
      icon: AlertTriangle,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/60 border-amber-200/70 dark:border-amber-900/50",
    },
    {
      label: "In Queue",
      value: stats.total_in_queue || 0,
      icon: BookOpen,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200/70 dark:border-indigo-900/50",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-700/80 p-2.5 sm:p-3.5 text-center shadow-2xs hover:shadow-xs transition"
        >
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 mx-auto mb-1 rounded-lg ${item.bg} border flex items-center justify-center shrink-0`}
          >
            <item.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${item.color}`} />
          </div>
          <p className="text-base sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
            {item.value}
          </p>
          <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-gray-400 truncate mt-0.5">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * AI Revision Plan Sidebar Card
 */
function RevisionPlanCard({ plan, loading }) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700 p-5 shadow-2xs">
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
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700 overflow-hidden shadow-2xs">
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200/70 dark:border-purple-800/60 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
            AI Revision Plan
          </h3>
          {plan.model && (
            <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 ml-auto">
              {plan.model}
            </span>
          )}
        </div>

        {plan.weakAreas && plan.weakAreas.length > 0 && (
          <div className="mb-3.5">
            <p className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">
              Focus Areas
            </p>
            <div className="flex flex-wrap gap-1.5">
              {plan.weakAreas.map((area, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60"
                >
                  {area.topicName} ({area.accuracy ?? "N/A"}%)
                </span>
              ))}
            </div>
          </div>
        )}

        {plan.wrongQuestionsCount > 0 && (
          <div className="mb-3.5 p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/50 rounded-xl">
            <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">
              <span className="font-bold">{plan.wrongQuestionsCount}</span>{" "}
              questions prioritized for retention
            </p>
          </div>
        )}

        {plan.revisionPlan ? (
          <div
            className={`text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed ${
              expanded ? "" : "line-clamp-4"
            }`}
          >
            {Array.isArray(plan.revisionPlan) ? (
              plan.revisionPlan.map((item, i) => (
                <p key={i} className="whitespace-pre-wrap mb-1">
                  {item}
                </p>
              ))
            ) : (
              <p className="whitespace-pre-wrap">{plan.revisionPlan}</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            No revision plan generated yet.
          </p>
        )}

        {String(plan.revisionPlan || "").length > 200 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Main SpacedRepetition Page Component
 */
export default function SpacedRepetition() {
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
      if (error?.name !== "AbortError") toast.error("Failed to load revisions");
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
      // Non-fatal
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

  const moveToNext = useCallback(() => {
    if (currentIndex + 1 >= dueCards.length) {
      setSessionComplete(true);
      toast.success("Session complete! Great work!");
      fetchStats();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, dueCards.length, fetchStats]);

  const handleKnow = useCallback(
    async (card) => {
      try {
        await aiAPI.completeRevision(card.question_id, true);
        if (signalRef.current?.aborted) return;
        setSessionStats((prev) => ({ ...prev, known: prev.known + 1 }));
        timerRef.current = setTimeout(moveToNext, 600);
      } catch {
        toast.error("Failed to record response");
      }
    },
    [moveToNext],
  );

  const handleNeedsReview = useCallback(
    async (card) => {
      try {
        await aiAPI.completeRevision(card.question_id, false);
        if (signalRef.current?.aborted) return;
        setSessionStats((prev) => ({ ...prev, review: prev.review + 1 }));
        timerRef.current = setTimeout(moveToNext, 600);
      } catch {
        toast.error("Failed to record response");
      }
    },
    [moveToNext],
  );

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
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-12 page-transition fade-in">
      <Helmet>
        <title>Spaced Repetition | Trstprep</title>
        <meta
          name="description"
          content="Smart active recall with spaced repetition — review questions at optimal cognitive intervals."
        />
      </Helmet>

      {/* Hero Header */}
      <AnimatedHero pageType="dashboard">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-lg shrink-0">
              <Brain className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white">
                  Spaced Repetition
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs border border-white/20">
                  <Zap className="w-2.5 h-2.5" />
                  SM-2 Active Recall
                </span>
              </div>
              <p className="text-purple-100 text-xs sm:text-sm mt-0.5 font-medium">
                Review at optimal intervals for lasting memory retention
              </p>
            </div>
          </div>

          <button
            onClick={generatePlan}
            disabled={planLoading}
            className="inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-xs sm:text-sm font-bold rounded-xl border border-white/25 shadow-xs transition-all disabled:opacity-50 cursor-pointer shrink-0"
          >
            {planLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{planLoading ? "Analyzing..." : "Generate AI Plan"}</span>
          </button>
        </div>
      </AnimatedHero>

      {/* Body Content Container */}
      <div className="max-w-5xl mx-auto px-3 sm:px-4 -mt-5 sm:-mt-6 relative z-10 space-y-4 sm:space-y-6">
        {/* Compact Responsive Stats Bar */}
        <StatsBar stats={stats} />

        {/* Main Flashcard & Sidebar Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* Main Flashcard Column */}
          <div className="lg:col-span-8">
            {loading ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-gray-700 p-6 sm:p-8 shadow-2xs">
                <div className="animate-pulse space-y-4">
                  <div className="flex justify-between">
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-1/4"></div>
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-1/6"></div>
                  </div>
                  <div className="h-44 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
                  <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                </div>
              </div>
            ) : dueCards.length === 0 ? (
              /* All Caught Up State */
              <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-gray-700 p-8 sm:p-12 text-center shadow-soft">
                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/80 flex items-center justify-center text-3xl sm:text-4xl shadow-inner mb-4">
                  🎉
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mb-1.5">
                  All Caught Up!
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6 leading-relaxed">
                  No revisions are due right now. Keep practicing questions to
                  build your active retention queue and maintain your streak.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Link
                    to="/practice"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-xs"
                  >
                    <Target className="w-4 h-4" />
                    <span>Practice Questions</span>
                  </Link>
                  <button
                    onClick={() => fetchDueRevisions()}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-gray-200 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Check Queue</span>
                  </button>
                </div>
              </div>
            ) : sessionComplete ? (
              /* Session Complete State */
              <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-gray-700 p-6 sm:p-10 text-center shadow-soft">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800/80 flex items-center justify-center text-3xl shadow-inner mb-3.5">
                  🏆
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mb-1">
                  Revision Session Completed!
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
                  Great job reviewing your spaced retention questions. Intervals
                  have been recalibrated based on your responses.
                </p>

                {/* Score breakdown */}
                <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto mb-6">
                  <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 rounded-xl">
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                      {sessionStats.known}
                    </p>
                    <p className="text-[10px] sm:text-xs font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">
                      Mastered
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/60 rounded-xl">
                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400">
                      {sessionStats.review}
                    </p>
                    <p className="text-[10px] sm:text-xs font-bold text-amber-800 dark:text-amber-300 mt-0.5">
                      Rescheduled
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => fetchDueRevisions()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-xs cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Check For More</span>
                  </button>
                  <Link
                    to="/practice"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-gray-200 text-xs sm:text-sm font-bold rounded-xl transition"
                  >
                    <span>Practice Lab</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ) : (
              /* Active Review Deck */
              <div className="space-y-3.5">
                {/* Progress Header */}
                <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-gray-700 p-3 sm:p-4 shadow-2xs">
                  <div className="flex items-center justify-between text-xs font-bold mb-2">
                    <span className="text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                      Question {currentIndex + 1} of {dueCards.length}
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400">
                      {progress}% Completed
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-400 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Flashcard Component */}
                {dueCards[currentIndex] && (
                  <Flashcard
                    key={
                      dueCards[currentIndex].id ||
                      dueCards[currentIndex].question_id
                    }
                    card={dueCards[currentIndex]}
                    index={0}
                    onKnow={handleKnow}
                    onNeedsReview={handleNeedsReview}
                  />
                )}
              </div>
            )}
          </div>

          {/* Sidebar Column */}
          <div className="lg:col-span-4 space-y-4">
            {/* AI Revision Plan Widget */}
            <RevisionPlanCard plan={revisionPlan} loading={planLoading} />

            {/* Quick Actions Hub */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200/80 dark:border-gray-700 p-4 sm:p-5 shadow-2xs">
              <h3 className="font-extrabold text-gray-900 dark:text-white mb-3 text-xs sm:text-sm uppercase tracking-wider text-slate-400 dark:text-gray-400">
                Quick Shortcuts
              </h3>
              <div className="space-y-2">
                <Link
                  to="/practice"
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/50 transition text-xs sm:text-sm font-bold border border-indigo-100/70 dark:border-indigo-800/50"
                >
                  <Target className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Practice Lab Topics</span>
                  <ChevronRight className="w-4 h-4 ml-auto text-indigo-400" />
                </Link>

                <Link
                  to="/bookmarks"
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700/50 transition text-xs sm:text-sm font-semibold text-slate-700 dark:text-gray-300 border border-transparent hover:border-slate-200/60 dark:hover:border-gray-700"
                >
                  <BookOpen className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>Saved Questions Hub</span>
                  <ChevronRight className="w-4 h-4 ml-auto text-slate-400" />
                </Link>

                <Link
                  to="/dashboard"
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-gray-700/50 transition text-xs sm:text-sm font-semibold text-slate-700 dark:text-gray-300 border border-transparent hover:border-slate-200/60 dark:hover:border-gray-700"
                >
                  <TrendingUp className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>Dashboard Overview</span>
                  <ChevronRight className="w-4 h-4 ml-auto text-slate-400" />
                </Link>
              </div>
            </div>

            {/* How Spaced Repetition Works Info Card */}
            <div className="bg-gradient-to-br from-indigo-50/80 via-purple-50/50 to-slate-50/50 dark:from-indigo-950/40 dark:via-gray-800 dark:to-gray-800 rounded-2xl border border-indigo-100/80 dark:border-indigo-900/50 p-4 sm:p-5 shadow-2xs">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <h4 className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm">
                  The Leitner & SM-2 Method
                </h4>
              </div>
              <ul className="text-[11px] sm:text-xs text-slate-600 dark:text-gray-300 space-y-2 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Questions scheduled at expanding intervals (1d, 3d, 7d,
                    16d).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    <strong>Active Recall:</strong> formulate the answer in your
                    mind before flipping.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-400 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    Marking <strong>Needs Review</strong> immediately resets the
                    interval to guarantee mastery.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
