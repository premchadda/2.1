import { useParams, Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { toast } from "react-hot-toast";
import { apiClient } from "../../shared/lib/dataService";
import sanitizeHtml from "../../shared/lib/sanitizeHtml";
import { getLocalizedField } from "../../shared/lib/language";
import MathRenderer from "../../shared/components/MathRenderer";
import {
  Trophy,
  Target,
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Flag,
  Lightbulb,
  PieChart,
  X,
  RotateCcw,
  BookOpen,
  Timer,
  Clock,
  Zap,
  TrendingUp,
  Award,
  Layers,
  Menu,
  Globe,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import Confetti from "react-confetti";
import { ReattemptOptions } from "../../shared/components/ReattemptOptions";
import { mapQuestionToFrontend } from "../../shared/types/index.js";
import { normalizeTestQuestions } from "../../shared/utils/testClassification";

function TestResult() {
  const routeParams = useParams();
  const testId = routeParams.testId;
  const seriesId = routeParams.seriesSlug || routeParams.seriesId;
  const seriesBackLink =
    seriesId && seriesId !== "pyp" ? `/test-series/${seriesId}` : "/pyps";
  const location = useLocation();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [_activeTab, _setActiveTab] = useState("overview");
  const [solutionFilter, setSolutionFilter] = useState("all");
  const [solutionSectionFilter, setSolutionSectionFilter] = useState("all");
  const [expandedSolutions, setExpandedSolutions] = useState({});
  const [isProUser, setIsProUser] = useState(false);
  const [_reportingQuestionId, _setReportingQuestionId] = useState(null);
  const [_reportReason, _setReportReason] = useState("");
  const [reportedQuestions, setReportedQuestions] = useState(new Set());
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem("trstprep_language");
    const lang = saved === "hi" ? "hi" : "en";
    document.documentElement.lang = lang;
    return lang;
  });

  const attemptIdFromState = location.state?.attemptId;
  const [showConfetti, setShowConfetti] = useState(false);
  const [winSize, setWinSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });
  const [activeSection, setActiveSection] = useState("score");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [showReattemptModal, setShowReattemptModal] = useState(false);
  const sectionRefs = useRef({});
  const confettiShownRef = useRef(new Set());
  const confettiTimerRef = useRef(null);

  const selectSection = (id) => {
    setActiveSection(id);
    setSidebarOpen(false);
    const el = sectionRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const nextAttemptNumber =
    (result?.attemptNumber ||
      result?.attemptCount ||
      (attemptIdFromState ? 2 : 1)) + 1;

  const handleRealReattempt = () => {
    setShowReattemptModal(true);
  };

  const confirmReattempt = () => {
    setShowReattemptModal(false);
    const seriesSlug = result?.seriesSlug || seriesId || "ssc-cgl-2026";
    const targetTestId = result?.testId || result?.id || testId;
    navigate(
      `/${seriesSlug}/tests/${targetTestId}?attempt=${nextAttemptNumber}`,
      {
        state: {
          isReattempt: true,
          attemptNumber: nextAttemptNumber,
        },
      },
    );
  };

  useEffect(() => {
    const handleResize = () =>
      setWinSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (result) {
      const maxScore =
        result.maxScore || result.totalMarks || result.totalQuestions * 2;
      const pct =
        result.totalQuestions > 0 ? (result.score / maxScore) * 100 : 0;
      const attemptKey =
        attemptIdFromState ||
        `${testId}-${result.score}-${result.totalQuestions}`;
      if (pct >= 90 && !confettiShownRef.current.has(attemptKey)) {
        confettiShownRef.current.add(attemptKey);
        setShowConfetti(true);
        confettiTimerRef.current = setTimeout(
          () => setShowConfetti(false),
          6000,
        );
      }
    }
    return () => {
      if (confettiTimerRef.current) {
        clearTimeout(confettiTimerRef.current);
        confettiTimerRef.current = null;
      }
    };
  }, [result?.score, result?.totalQuestions, attemptIdFromState, testId]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchResult = async () => {
      try {
        setLoading(true);
        setError(null);

        const endpoint = attemptIdFromState
          ? `/api/tests/${testId}/result/${attemptIdFromState}`
          : `/api/tests/${testId}/result`;

        const response = await apiClient.get(endpoint, {
          signal: controller.signal,
        });
        const resultData = response.data?.data;

        if (resultData) {
          const answersMap = new Map();
          if (Array.isArray(resultData.answers)) {
            resultData.answers.forEach((ans) => {
              if (ans?.questionId !== undefined && ans?.questionId !== null) {
                answersMap.set(String(ans.questionId), ans);
              }
            });
          }

          if (Array.isArray(resultData.questions)) {
            const mappedQuestions = resultData.questions.map((q, index) => {
              const mapped = mapQuestionToFrontend(q);
              const qid = String(q.id || q._id || mapped.id || mapped._id);
              const ansFromList = answersMap.get(qid) || null;

              const rawTime =
                q.timeTaken ??
                q.timeSpent ??
                q.time_taken ??
                q.time_spent ??
                ansFromList?.timeSpent ??
                ansFromList?.timeTaken ??
                ansFromList?.time_spent ??
                ansFromList?.time ??
                0;
              const rawUserAns =
                q.userAnswer ??
                q.selectedOption ??
                q.user_answer ??
                q.userChoice ??
                ansFromList?.selectedOption ??
                ansFromList?.userAnswer;

              const rawMarks = Number(
                q.marks && !isNaN(q.marks) && Number(q.marks) > 0
                  ? q.marks
                  : mapped.marks &&
                      !isNaN(mapped.marks) &&
                      Number(mapped.marks) > 0
                    ? mapped.marks
                    : (resultData.marksPerQuestion ??
                      resultData.positiveMarks ??
                      2),
              );

              const rawNegativeMarks = Number(
                q.negativeMarks !== undefined &&
                  q.negativeMarks !== null &&
                  !isNaN(q.negativeMarks) &&
                  Number(q.negativeMarks) >= 0
                  ? q.negativeMarks
                  : resultData.negativeMarks !== undefined &&
                      resultData.negativeMarks !== null &&
                      !isNaN(resultData.negativeMarks) &&
                      Number(resultData.negativeMarks) >= 0
                    ? resultData.negativeMarks
                    : rawMarks > 0
                      ? rawMarks === 2
                        ? 0.5
                        : rawMarks === 1
                          ? 0.33
                          : Number((rawMarks * 0.25).toFixed(2))
                      : 0.5,
              );

              return {
                ...mapped,
                originalIndex: index + 1,
                userAnswer: rawUserAns,
                isMarked: q.isMarked ?? q.is_marked ?? false,
                correctAnswer:
                  q.correctAnswer !== undefined
                    ? q.correctAnswer
                    : q.correct !== undefined
                      ? q.correct
                      : q.correct_option,
                timeTaken: Number(rawTime || 0),
                timeSpent: Number(rawTime || 0),
                marks: rawMarks,
                negativeMarks: rawNegativeMarks,
              };
            });

            const normalizedQuestions = normalizeTestQuestions(
              mappedQuestions,
              resultData,
            );
            resultData.questions = normalizedQuestions.map((q, idx) => ({
              ...q,
              originalIndex: idx + 1,
            }));

            // Recalculate score from evaluated questions to handle any historical 0-clamped backend data
            let computedScore = 0;
            let hasEvaluatedQuestions = false;
            resultData.questions.forEach((q) => {
              const uAns = q.userAnswer;
              if (
                uAns !== undefined &&
                uAns !== null &&
                uAns !== "" &&
                uAns !== -1
              ) {
                hasEvaluatedQuestions = true;
                const isCorr =
                  Number(uAns) === Number(q.correctAnswer ?? q.correct);
                if (isCorr) {
                  computedScore += Number(q.marks || 2);
                } else {
                  computedScore -= Number(
                    q.negativeMarks !== undefined ? q.negativeMarks : 0.5,
                  );
                }
              }
            });
            if (
              hasEvaluatedQuestions &&
              (resultData.score === undefined ||
                resultData.score === null ||
                Number.isNaN(Number(resultData.score)))
            ) {
              resultData.score = Number(computedScore.toFixed(2));
            }
          }
          setResult(resultData);
        } else {
          setError("Test result not found");
        }
      } catch (err) {
        if (axios.isCancel(err)) return;
        setError(err.message || "Failed to load test result");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    if (testId && seriesId) {
      fetchResult();
      fetchSubscriptionStatus(controller.signal);
    }
    return () => controller.abort();
  }, [testId, seriesId, attemptIdFromState]);

  const fetchSubscriptionStatus = async (signal) => {
    try {
      const response = await apiClient.get("/api/subscriptions/status", {
        signal,
      });
      setIsProUser(response.data.isProUser || false);
    } catch (err) {
      if (axios.isCancel(err)) return;
    }
  };

  // Scroll spy for continuous infinite-scroll experience across all 6 sections
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "-100px 0px -50% 0px",
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute("data-section-id");
          if (id) {
            setActiveSection(id);
          }
        }
      });
    }, observerOptions);

    const sectionIds = [
      "score",
      "overview",
      "subjects",
      "difficulty",
      "time",
      "solutions",
    ];
    sectionIds.forEach((id) => {
      const el = sectionRefs.current[id];
      if (el) {
        el.setAttribute("data-section-id", id);
        observer.observe(el);
      }
    });

    return () => observer.disconnect();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-start border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card p-6">
            <XCircle className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Result Not Found
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4 text-sm">
              {error || "Test may not have been submitted properly."}
            </p>
            <div className="flex gap-2 justify-center">
              <Link
                to={seriesBackLink}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium"
              >
                Back
              </Link>
              <Link
                to={`/test/${seriesId}/${testId}`}
                className="px-4 py-2 bg-brand-start text-white rounded-lg text-sm font-medium"
              >
                Take Test
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatTime = (seconds) => {
    if (!seconds) return "0m";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  const _getScoreColor = () => {
    const maxScore =
      result.maxScore || result.totalMarks || result.totalQuestions * 2;
    const percentage = (result.score / maxScore) * 100;
    if (percentage >= 70) return "text-green-600 dark:text-green-400";
    if (percentage >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getAccuracyColor = (accValue) => {
    const val = accValue ?? (result.accuracy || 0);
    if (val >= 80) return "text-green-600 dark:text-green-400";
    if (val >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const isSkippedQuestion = (q) => {
    const ans =
      q.userAnswer ?? q.selectedOption ?? q.user_answer ?? q.userChoice;
    return (
      ans === undefined ||
      ans === null ||
      ans === "" ||
      (Array.isArray(ans) && ans.length === 0) ||
      ans === -1 ||
      ans === "-1"
    );
  };

  const normalizeResultOption = (value) => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const normalized = String(value).trim();
    if (/^[A-Za-z]$/.test(normalized)) {
      return normalized.toUpperCase().charCodeAt(0) - 65;
    }
    return /^-?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : null;
  };

  const answersMatch = (userAns, correctAns) => {
    if (Array.isArray(userAns) || Array.isArray(correctAns)) {
      const selected = (Array.isArray(userAns) ? userAns : [userAns])
        .map(normalizeResultOption)
        .filter((value) => value !== null)
        .sort((a, b) => a - b);
      const correct = (Array.isArray(correctAns) ? correctAns : [correctAns])
        .map(normalizeResultOption)
        .filter((value) => value !== null)
        .sort((a, b) => a - b);
      return (
        selected.length === correct.length &&
        selected.every((value, index) => value === correct[index])
      );
    }
    const selected = normalizeResultOption(userAns);
    const correct = normalizeResultOption(correctAns);
    return selected !== null && correct !== null && selected === correct;
  };

  const isCorrectQuestion = (q) => {
    if (isSkippedQuestion(q)) return false;
    const userAns =
      q.userAnswer ?? q.selectedOption ?? q.user_answer ?? q.userChoice;
    const correctAns =
      q.correctOption ??
      q.correct_option ??
      q.correct_option_id ??
      q.correctOptionId ??
      q.correctAnswer ??
      q.correct_answer ??
      q.correct ??
      q.answer;
    return (
      correctAns !== undefined &&
      correctAns !== null &&
      answersMatch(userAns, correctAns)
    );
  };

  const isWrongQuestion = (q) => {
    if (isSkippedQuestion(q)) return false;
    return !isCorrectQuestion(q);
  };

  const getSubjectBreakdown = () => {
    if (!result?.questions) return {};
    const breakdown = {};

    const defaultMarks = Number(
      result.positiveMarks ??
        result.positive_marks ??
        result.marksPerQuestion ??
        result.marks_per_question ??
        2,
    );
    const defaultNeg = Number(
      result.negativeMarks ??
        result.negative_marks ??
        (defaultMarks > 0
          ? defaultMarks === 2
            ? 0.5
            : defaultMarks === 1
              ? 0.33
              : Number((defaultMarks * 0.25).toFixed(2))
          : 0.5),
    );

    result.questions.forEach((q) => {
      const section = q.section || q.subject || "General";

      const qMarks = Number(
        q.marks && !isNaN(q.marks) && Number(q.marks) > 0
          ? q.marks
          : defaultMarks,
      );
      const qNeg = Number(
        q.negativeMarks !== undefined &&
          q.negativeMarks !== null &&
          !isNaN(q.negativeMarks) &&
          Number(q.negativeMarks) >= 0
          ? q.negativeMarks
          : defaultNeg !== undefined &&
              defaultNeg !== null &&
              !isNaN(defaultNeg) &&
              Number(defaultNeg) >= 0
            ? defaultNeg
            : qMarks === 2
              ? 0.5
              : qMarks === 1
                ? 0.33
                : Number((qMarks * 0.25).toFixed(2)),
      );

      if (!breakdown[section]) {
        breakdown[section] = {
          correct: 0,
          wrong: 0,
          unattempted: 0,
          total: 0,
          timeSpent: 0,
          score: 0,
          maxScore: 0,
          positiveMarks: qMarks,
          negativeMarks: qNeg,
        };
      }
      breakdown[section].total++;
      breakdown[section].maxScore += qMarks;

      const qTime = Number(q.timeTaken || q.timeSpent || 0);
      breakdown[section].timeSpent += qTime;

      if (isSkippedQuestion(q)) {
        breakdown[section].unattempted++;
      } else if (isCorrectQuestion(q)) {
        breakdown[section].correct++;
        breakdown[section].score += qMarks;
      } else {
        breakdown[section].wrong++;
        breakdown[section].score -= qNeg;
      }
    });

    // If per-question times sum to 0, check sectionTimers/sectionTimings or overall timeSpent
    const sectionTimers = result.sectionTimers || result.sectionTimings || {};
    Object.keys(breakdown).forEach((sec) => {
      if (breakdown[sec].timeSpent === 0 && sectionTimers[sec]) {
        breakdown[sec].timeSpent = Number(sectionTimers[sec]);
      }
    });

    const totalCalculatedTime = Object.values(breakdown).reduce(
      (s, b) => s + b.timeSpent,
      0,
    );
    const overallTotalTime = Number(result.timeSpent || result.timeTaken || 0);
    if (
      totalCalculatedTime === 0 &&
      overallTotalTime > 0 &&
      result.questions.length > 0
    ) {
      Object.keys(breakdown).forEach((sec) => {
        const ratio = breakdown[sec].total / result.questions.length;
        breakdown[sec].timeSpent = Math.round(overallTotalTime * ratio);
      });
    }

    return breakdown;
  };

  const getDifficultyBreakdown = () => {
    if (!result.questions)
      return {
        Easy: { correct: 0, total: 0 },
        Medium: { correct: 0, total: 0 },
        Hard: { correct: 0, total: 0 },
      };
    const breakdown = {
      Easy: { correct: 0, total: 0 },
      Medium: { correct: 0, total: 0 },
      Hard: { correct: 0, total: 0 },
    };
    result.questions.forEach((q) => {
      const raw = String(q.difficulty || "medium")
        .trim()
        .toLowerCase();
      const difficulty =
        raw === "easy"
          ? "Easy"
          : raw === "hard" || raw === "very_hard"
            ? "Hard"
            : "Medium";
      if (breakdown[difficulty]) {
        breakdown[difficulty].total++;
        if (isCorrectQuestion(q)) breakdown[difficulty].correct++;
      }
    });
    return breakdown;
  };

  const getFilteredQuestions = () => {
    if (!result.questions) return [];
    let list = result.questions;

    // 1. Filter by Section
    if (solutionSectionFilter && solutionSectionFilter !== "all") {
      list = list.filter(
        (q) => (q.section || q.subject || "General") === solutionSectionFilter,
      );
    }

    // 2. Filter by Status
    if (solutionFilter === "correct")
      return list.filter((q) => isCorrectQuestion(q));
    if (solutionFilter === "wrong")
      return list.filter((q) => isWrongQuestion(q));
    if (solutionFilter === "unattempted" || solutionFilter === "skip")
      return list.filter((q) => isSkippedQuestion(q));
    if (solutionFilter === "marked")
      return list.filter((q) => q.isMarked || q.is_marked);
    return list;
  };

  const toggleSolution = (qId) => {
    setExpandedSolutions((prev) => ({ ...prev, [qId]: !prev[qId] }));
  };

  const questions = result.questions || [];
  const subjectBreakdown = getSubjectBreakdown();
  const difficultyBreakdown = getDifficultyBreakdown();
  const subjectBarClasses = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-green-500",
    "bg-orange-500",
  ];
  const difficultyStyles = {
    Easy: {
      dot: "bg-green-500",
      text: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-900/20",
    },
    Medium: {
      dot: "bg-yellow-500",
      text: "text-yellow-600 dark:text-yellow-400",
      bg: "bg-yellow-50 dark:bg-yellow-900/20",
    },
    Hard: {
      dot: "bg-red-500",
      text: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-900/20",
    },
  };

  const markedCount = questions.filter((q) => q.isMarked || q.is_marked).length;
  const calculatedCorrect = questions.filter((q) =>
    isCorrectQuestion(q),
  ).length;
  const calculatedWrong = questions.filter((q) => isWrongQuestion(q)).length;
  const calculatedSkipped = questions.filter((q) =>
    isSkippedQuestion(q),
  ).length;

  // Prefer backend values when available (they are the authoritative source from the scoring engine)
  const backendCorrect = result.correct ?? result.correctAnswers ?? 0;
  const backendWrong = result.wrong ?? result.wrongAnswers ?? 0;
  const backendUnattempted = result.unattempted ?? result.skippedQuestions ?? 0;
  const hasBackendCounts =
    backendCorrect + backendWrong + backendUnattempted > 0;

  const correctCount = hasBackendCounts ? backendCorrect : calculatedCorrect;
  const wrongCount = hasBackendCounts ? backendWrong : calculatedWrong;
  const skippedCount = hasBackendCounts
    ? backendUnattempted
    : calculatedSkipped;
  const totalQuestions = result.totalQuestions || questions.length || 0;
  const overallAccuracy =
    result.accuracy !== undefined &&
    result.accuracy !== null &&
    !isNaN(result.accuracy)
      ? Number(result.accuracy)
      : correctCount + wrongCount > 0
        ? (correctCount / (correctCount + wrongCount)) * 100
        : 0;
  const attemptRate =
    totalQuestions > 0
      ? ((correctCount + wrongCount) / totalQuestions) * 100
      : 0;

  const strongestSubject = Object.entries(subjectBreakdown)
    .map(([subject, data]) => {
      const attempted = data.correct + data.wrong;
      return {
        subject,
        accuracy:
          attempted > 0 ? Math.round((data.correct / attempted) * 100) : 0,
      };
    })
    .sort((a, b) => b.accuracy - a.accuracy)[0];
  const weakestSubject = Object.entries(subjectBreakdown)
    .map(([subject, data]) => {
      const attempted = data.correct + data.wrong;
      return {
        subject,
        accuracy:
          attempted > 0 ? Math.round((data.correct / attempted) * 100) : 0,
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy)[0];

  const _handleReviewMode = () => {
    const seriesSlug = result?.seriesSlug || seriesId || "ssc-cgl-2026";
    const targetTestId = result?.testId || result?.id || testId;
    navigate(`/${seriesSlug}/tests/${targetTestId}`, {
      state: {
        reviewMode: true,
        attemptId: attemptIdFromState,
        resultData: result,
      },
    });
  };

  const handleSolutionMode = () => {
    const seriesSlug = result?.seriesSlug || seriesId || "ssc-cgl-2026";
    const targetTestId = result?.testId || result?.id || testId;
    navigate(`/${seriesSlug}/tests/${targetTestId}/review`, {
      state: {
        reviewMode: true,
        solutionMode: true,
        attemptId: attemptIdFromState,
        resultData: {
          ...result,
          testTitle: result.testTitle || "Test Review",
          questions: questions.map((q) => {
            const userAns = q.userAnswer;
            const isSkipped =
              userAns === undefined ||
              userAns === null ||
              userAns === "" ||
              userAns === -1;
            return {
              id: q.id || q._id,
              _id: q._id || q.id,
              text: q.text,
              questionText: q.questionText,
              options: q.options,
              correctOption:
                q.correctAnswer !== undefined
                  ? q.correctAnswer
                  : q.correct !== undefined
                    ? q.correct
                    : q.correct_option,
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              section: q.section || q.subject || "General",
              subject: q.subject || q.section || "General",
              difficulty: q.difficulty || "Medium",
              topic: q.topic || "General",
              userAnswer: isSkipped ? null : Number(userAns),
              timeTaken: q.timeTaken || q.timeSpent || 0,
            };
          }),
        },
      },
    });
  };

  const handleReportQuestion = async (
    qId,
    reason = "Incorrect answer/solution",
  ) => {
    setReportedQuestions((prev) => new Set([...prev, qId]));
    try {
      await apiClient.post(`/api/practice/questions/${qId}/report`, { reason });
      toast.success("Question reported for review", { id: `report-${qId}` });
    } catch (err) {
      console.warn("API report fallback:", err?.message);
      toast.error("Failed to report question. Please try again.", {
        id: `report-${qId}`,
      });
    }
  };

  const maxScore =
    result.maxScore || result.totalMarks || (result.totalQuestions || 0) * 2;
  const scorePct = maxScore > 0 ? ((result.score || 0) / maxScore) * 100 : 0;
  const getBadge = (pct) => {
    if (pct >= 85)
      return {
        label: "Excellent",
        bg: "bg-emerald-500",
        text: "text-emerald-50",
        icon: Trophy,
      };
    if (pct >= 60)
      return {
        label: "Good",
        bg: "bg-blue-500",
        text: "text-blue-50",
        icon: Target,
      };
    if (pct >= 40)
      return {
        label: "Average",
        bg: "bg-amber-500",
        text: "text-amber-50",
        icon: Flag,
      };
    return {
      label: "Needs Practice",
      bg: "bg-rose-500",
      text: "text-rose-50",
      icon: Lightbulb,
    };
  };
  const perfBadge = getBadge(scorePct);
  const BadgeIcon = perfBadge.icon;

  const getEncouragingCopy = () => {
    if (scorePct >= 90) return "Outstanding! You're exam-ready!";
    if (scorePct >= 70)
      return "Great performance! A bit more practice and you'll ace it.";
    if (scorePct >= 50)
      return "Good foundation. Focus on your weak areas to level up.";
    return "Keep going! Every attempt makes you stronger.";
  };

  const getAttemptDelta = () => {
    if (result.previousScore === undefined || result.previousScore === null)
      return null;
    if (maxScore <= 0) return null;
    const previousPct = (result.previousScore / maxScore) * 100;
    return Math.round(scorePct - previousPct);
  };

  const attemptDelta = getAttemptDelta();
  const sectionTimings = result.sectionTimings || null;

  // Sidebar sections
  const sections = [
    { id: "score", label: "Score", icon: Trophy },
    { id: "cutoff", label: "Cutoff Matrix", icon: Award },
    { id: "subjects", label: "Subjects", icon: Layers },
    { id: "difficulty", label: "Difficulty", icon: Zap },
    { id: "time", label: "Time", icon: Timer },
    { id: "solutions", label: "Solutions", icon: BookOpen },
  ];

  // Unique sections list
  const resultSections = Array.from(
    new Set(questions.map((q) => q.section || q.subject || "General")),
  ).filter(Boolean);

  // Questions in currently active section filter
  const questionsInActiveSection =
    !solutionSectionFilter || solutionSectionFilter === "all"
      ? questions
      : questions.filter(
          (q) =>
            (q.section || q.subject || "General") === solutionSectionFilter,
        );

  const statusCounts = {
    correct: questionsInActiveSection.filter((q) => isCorrectQuestion(q))
      .length,
    wrong: questionsInActiveSection.filter((q) => isWrongQuestion(q)).length,
    skipped: questionsInActiveSection.filter((q) => isSkippedQuestion(q))
      .length,
    marked: questionsInActiveSection.filter((q) => q.isMarked || q.is_marked)
      .length,
  };

  // Per-question time analysis
  const questionTimeData = questions.map((q, i) => ({
    index: i + 1,
    time: q.timeTaken || q.timeSpent || 0,
    section: q.section || q.subject || "General",
    correct: isCorrectQuestion(q),
    skipped: isSkippedQuestion(q),
  }));

  const activeQuestionsWithTime = questionTimeData.filter((q) => q.time > 0);
  const attemptedQuestions = questionTimeData.filter((q) => !q.skipped);
  const totalOverallTime =
    result.timeSpent ||
    result.timeTaken ||
    activeQuestionsWithTime.reduce((s, q) => s + q.time, 0);
  const countForAvg =
    activeQuestionsWithTime.length > 0
      ? activeQuestionsWithTime.length
      : attemptedQuestions.length > 0
        ? attemptedQuestions.length
        : totalQuestions || 1;
  const avgTimePerVisitedQuestion = Math.round(totalOverallTime / countForAvg);

  // Fastest question with positive time spent (> 0s)
  const fastestQ =
    activeQuestionsWithTime.length > 0
      ? activeQuestionsWithTime.reduce((min, q) =>
          q.time < min.time ? q : min,
        )
      : questionTimeData[0] || null;

  // Slowest question with max time spent
  const slowestQ =
    activeQuestionsWithTime.length > 0
      ? activeQuestionsWithTime.reduce((max, q) =>
          q.time > max.time ? q : max,
        )
      : questionTimeData[0] || null;

  // Section Scorecard data with high-precision analytics
  const subjectAccuracies = Object.entries(subjectBreakdown).map(
    ([subject, data]) => {
      const attempted = data.correct + data.wrong;
      // Accuracy %: Ratio of correct answers out of attempted questions (standard exam metric)
      const accuracy =
        attempted > 0 ? Math.round((data.correct / attempted) * 100) : 0;
      // Attempt Rate %: Ratio of attempted questions out of total questions in section
      const attemptRatePct =
        data.total > 0 ? Math.round((attempted / data.total) * 100) : 0;
      // Average speed per attempted/visited question
      const avgSecSpeed =
        attempted > 0
          ? Math.round(data.timeSpent / attempted)
          : data.total > 0
            ? Math.round(data.timeSpent / data.total)
            : 0;

      return {
        subject,
        accuracy,
        attemptRatePct,
        correct: data.correct,
        wrong: data.wrong,
        unattempted: data.unattempted,
        total: data.total,
        score: data.score,
        maxScore: data.maxScore || data.total * 2,
        timeSpent: data.timeSpent,
        avgSpeed: avgSecSpeed,
        positiveMarks: data.positiveMarks || 2,
        negativeMarks:
          data.negativeMarks !== undefined ? data.negativeMarks : 0.5,
      };
    },
  );

  const formatScoreValue = (val) => {
    if (val === undefined || val === null || isNaN(val)) return "0";
    const num = Number(val);
    return Number.isInteger(num) ? num.toString() : num.toFixed(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <Helmet>
        <title>Test Result | Trstprep</title>
        <meta
          name="description"
          content="View your test results, score analysis, and performance on Trstprep."
        />
      </Helmet>
      {showConfetti && (
        <Confetti
          width={winSize.w}
          height={winSize.h}
          recycle={false}
          numberOfPieces={400}
          colors={[
            "#667eea",
            "#764ba2",
            "#fbbf24",
            "#22c55e",
            "#ef4444",
            "#3b82f6",
          ]}
        />
      )}

      {/* ═══ TOP BAR ═══ */}
      <div className="bg-slate-900 text-white sticky top-0 z-40 shadow-md">
        <div className="flex items-center justify-between min-h-[4.5rem] py-3 px-4 md:px-6">
          <div className="flex items-center gap-3 min-w-0 pr-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm md:text-lg font-black text-white truncate">
                {result.testTitle || "Test Result"}
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:block">
                Performance Analysis & Solutions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            <Link
              to={seriesBackLink}
              className="flex items-center gap-1.5 px-3 py-2 text-xs md:text-sm font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Series
            </Link>
            <button
              onClick={handleSolutionMode}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 text-xs md:text-sm font-bold text-sky-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all"
            >
              <Lightbulb className="w-4 h-4 text-amber-400" /> Solutions &
              Review
            </button>
            <button
              onClick={handleRealReattempt}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 text-xs md:text-sm font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl transition-all shadow-md active:scale-95"
            >
              <RotateCcw className="w-4 h-4" /> Reattempt Test
            </button>
            <Link
              to="/dashboard"
              className="hidden lg:flex items-center gap-1.5 px-3.5 py-2 text-xs md:text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all"
            >
              Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="flex relative items-start">
        {/* ═══ LEFT SIDEBAR ═══ */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <aside
          className={`fixed lg:sticky top-[4.5rem] self-start left-0 h-[calc(100vh-4.5rem)] w-60 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-30 flex-shrink-0 flex flex-col transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
        >
          {/* Score Ring in Sidebar */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-b from-slate-50 to-white dark:from-gray-800 dark:to-gray-800">
            <div className="flex items-center justify-center">
              <div className="relative w-24 h-24 bg-white dark:bg-gray-900 rounded-full p-1 shadow-inner border border-gray-200 dark:border-gray-700">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="44"
                    cy="44"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="5"
                    fill="transparent"
                    className="text-gray-200 dark:text-gray-700"
                  />
                  <circle
                    cx="44"
                    cy="44"
                    r="36"
                    stroke="currentColor"
                    strokeWidth="5"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 36}
                    strokeDashoffset={
                      2 * Math.PI * 36 -
                      (Math.max(0, Math.min(100, scorePct)) / 100) *
                        2 *
                        Math.PI *
                        36
                    }
                    className={`${scorePct >= 70 ? "text-emerald-500" : scorePct >= 40 ? "text-amber-500" : "text-rose-500"} transition-all duration-1000`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className={`text-base font-black tracking-tight ${
                      (result.score || 0) < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {formatScoreValue(result.score || 0)}
                  </span>
                  <span className="text-[8px] text-gray-400 dark:text-gray-500 font-bold uppercase">
                    SCORE
                  </span>
                </div>
              </div>
            </div>
            <div className="flex justify-center gap-3 mt-3 text-[10px] font-bold">
              <span className="text-emerald-600 dark:text-emerald-400 font-black">
                {correctCount} ✓
              </span>
              <span className="text-rose-600 dark:text-rose-400 font-black">
                {wrongCount} ✗
              </span>
              <span className="text-slate-500 dark:text-gray-400 font-black">
                {skippedCount} —
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-2 px-2">
            {sections.map((sec) => {
              const Icon = sec.icon;
              return (
                <button
                  key={sec.id}
                  onClick={() => selectSection(sec.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition-all mb-1 ${
                    activeSection === sec.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${activeSection === sec.id ? "text-white" : "text-gray-400 dark:text-gray-500"}`}
                  />
                  {sec.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ═══ MAIN CONTENT ═══ */}
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6 max-w-5xl mx-auto space-y-8">
          {/* ── Section 1: Score ── */}
          <section
            ref={(el) => (sectionRefs.current["score"] = el)}
            data-section-id="score"
            className="scroll-mt-24 space-y-4"
          >
            <div className="relative bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-100 dark:from-slate-900 dark:via-indigo-950 dark:to-slate-950 rounded-2xl sm:rounded-3xl border border-indigo-100 dark:border-indigo-950/40 p-4 sm:p-6 md:p-8 overflow-hidden shadow-card dark:shadow-2xl transition-all duration-300">
              {/* Animated Glow Background Effects */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute -top-32 -left-32 w-80 h-80 bg-indigo-400/15 dark:bg-indigo-500/15 rounded-full blur-3xl animate-pulse duration-[8000ms]" />
                <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-violet-400/15 dark:bg-indigo-600/15 rounded-full blur-3xl animate-pulse duration-[6000ms]" />
                <div className="absolute inset-0 opacity-[0.06] dark:opacity-5 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:20px_20px]" />
              </div>

              {/* Top Row: Left Marks Dial + Right Test Name, Rank, Percentile, Badge */}
              <div className="relative z-10 flex flex-row items-center gap-3.5 sm:gap-6 text-left">
                {/* Score Dial / Marks Display (Left Side) */}
                <div className="relative w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 flex-shrink-0 bg-white dark:bg-slate-900 rounded-full p-2.5 shadow-md border-2 border-indigo-200 dark:border-indigo-800/80">
                  <svg
                    viewBox="0 0 100 100"
                    className="w-full h-full transform -rotate-90"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-slate-100 dark:text-slate-800"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke={
                        scorePct >= 70
                          ? "#10b981"
                          : scorePct >= 40
                            ? "#f59e0b"
                            : "#ef4444"
                      }
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={251.327}
                      strokeDashoffset={
                        251.327 -
                        (Math.max(0, Math.min(100, scorePct)) / 100) * 251.327
                      }
                      className="transition-all duration-1000 ease-out"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span
                      className={`text-xl sm:text-2xl md:text-xl sm:text-2xl lg:text-3xl font-black tracking-tighter ${
                        (result.score || 0) < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-900 dark:text-white"
                      }`}
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {formatScoreValue(result.score || 0)}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-wider">
                      Out of {maxScore}
                    </span>
                  </div>
                </div>

                {/* Score Title & Context (Right Side: Test Name, Rank, Percentile, Badge) */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h2 className="text-base sm:text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight break-words">
                    {result.testTitle || "Test Completed!"}
                  </h2>

                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mt-2">
                    {/* Performance Badge */}
                    <div
                      className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full ${perfBadge.bg} ${perfBadge.text} text-[10px] sm:text-xs font-black shadow-xs`}
                    >
                      <BadgeIcon className="w-3.5 h-3.5" /> {perfBadge.label}
                    </div>

                    {/* Rank Pill/Card */}
                    {result.rank !== undefined && result.rank !== null && (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-black bg-amber-100 dark:bg-amber-400/20 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-400/30 shadow-2xs"
                        title={
                          result.totalParticipants
                            ? `Rank ${result.rank || 1} out of ${result.totalParticipants} test participants`
                            : `Rank ${result.rank || 1}`
                        }
                      >
                        <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />{" "}
                        Rank #{result.rank || 1}
                        {result.totalParticipants &&
                        result.totalParticipants > 1
                          ? ` / ${result.totalParticipants.toLocaleString()}`
                          : ""}
                      </span>
                    )}

                    {/* Predicted All-India Rank (AIR) Pill */}
                    {result.predictedRank &&
                      result.predictedRank !== result.rank && (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-black bg-purple-100 dark:bg-purple-400/20 text-purple-900 dark:text-purple-300 border border-purple-200 dark:border-purple-400/30 shadow-2xs"
                          title="Estimated All-India Rank based on exam cohort psychometric modeling"
                        >
                          <Target className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />{" "}
                          Est. AIR #{result.predictedRank.toLocaleString()}
                        </span>
                      )}

                    {/* Category Rank Pill */}
                    {result.categoryRank && (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-black bg-blue-100 dark:bg-blue-400/20 text-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-400/30 shadow-2xs"
                        title={`Category Rank among ${result.cutoffData?.userCategory || "UR"} candidates`}
                      >
                        <Award className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />{" "}
                        {result.cutoffData?.userCategory || "UR"} Rank #
                        {result.categoryRank}
                        {result.categoryParticipants &&
                        result.categoryParticipants > 1
                          ? ` / ${result.categoryParticipants.toLocaleString()}`
                          : ""}
                      </span>
                    )}

                    {/* Percentile Pill/Card */}
                    {result.percentile !== undefined && (
                      <span className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-black bg-indigo-100 dark:bg-indigo-400/20 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-400/30 shadow-2xs">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" />{" "}
                        {Number(result.percentile).toFixed(1)}%ile{" "}
                        {result.isCalibrated ? "(Calibrated)" : ""}
                      </span>
                    )}

                    {/* Attempt Delta */}
                    {attemptDelta !== null && (
                      <span
                        className={`inline-flex items-center px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-black ${
                          attemptDelta >= 0
                            ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
                            : "bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30"
                        }`}
                      >
                        {attemptDelta >= 0 ? "+" : ""}
                        {attemptDelta}% vs Previous
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Encouraging Copy Banner (Full Width Row) */}
              <div className="relative z-10 bg-white/75 dark:bg-slate-800/75 backdrop-blur-md rounded-xl p-3 border border-indigo-100 dark:border-indigo-900/40 flex items-center gap-2.5 shadow-2xs mt-3 sm:mt-4">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <p className="text-slate-700 dark:text-emerald-300 text-xs sm:text-sm font-bold leading-snug">
                  {getEncouragingCopy()}
                </p>
              </div>

              {/* 4 KPI Glass Cards (Full Width Row in 1 row on mobile & desktop) */}
              <div className="relative z-10 grid grid-cols-4 gap-2 sm:gap-3 mt-3 sm:mt-4">
                <div className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-md rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-indigo-100 dark:border-slate-700/70 shadow-2xs text-center sm:text-left">
                  <p className="text-[9px] sm:text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                    Correct
                  </p>
                  <p className="text-sm sm:text-lg md:text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {correctCount}
                    <span className="text-[10px] sm:text-xs text-slate-400 font-medium">
                      /{totalQuestions}
                    </span>
                  </p>
                </div>
                <div className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-md rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-indigo-100 dark:border-slate-700/70 shadow-2xs text-center sm:text-left">
                  <p className="text-[9px] sm:text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                    Wrong
                  </p>
                  <p className="text-sm sm:text-lg md:text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
                    {wrongCount}
                    <span className="text-[10px] sm:text-xs text-slate-400 font-medium">
                      /{totalQuestions}
                    </span>
                  </p>
                </div>
                <div className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-md rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-indigo-100 dark:border-slate-700/70 shadow-2xs text-center sm:text-left">
                  <p className="text-[9px] sm:text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                    Accuracy
                  </p>
                  <p className="text-sm sm:text-lg md:text-xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                    {overallAccuracy.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-md rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 border border-indigo-100 dark:border-slate-700/70 shadow-2xs text-center sm:text-left">
                  <p className="text-[9px] sm:text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                    Time Taken
                  </p>
                  <p className="text-sm sm:text-lg md:text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5 truncate">
                    {formatTime(result.timeSpent || result.timeTaken)}
                  </p>
                </div>
              </div>
            </div>

            {/* Reattempt & Mistake Re-Practice Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Card 1: 1-Click Mistake Re-Practice */}
              <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-2xl p-4 text-white shadow-md flex flex-col justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-white shrink-0">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-black uppercase tracking-wider bg-white/30 text-white px-2 py-0.5 rounded">
                        Mistake Notebook
                      </span>
                    </div>
                    <h4 className="text-sm font-extrabold text-white">
                      Re-Practice Incorrect Questions
                    </h4>
                    <p className="text-white/90 text-xs mt-0.5">
                      {wrongCount > 0
                        ? `Directly re-practice all ${wrongCount} incorrect questions from this test in Practice Lab.`
                        : "Review all test questions or practice missed questions across previous tests."}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    navigate(`/practice?mode=mistakes&testId=${testId}`)
                  }
                  className="w-full py-2.5 bg-white dark:bg-gray-800 text-amber-900 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Re-Practice Mistakes in
                  Practice Lab →
                </button>
              </div>

              {/* Card 2: Full Test Reattempt */}
              <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 rounded-2xl p-4 text-white shadow-md flex flex-col justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-white shrink-0">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-black uppercase tracking-wider bg-white/30 text-white px-2 py-0.5 rounded">
                        Score Improvement
                      </span>
                    </div>
                    <h4 className="text-sm font-extrabold text-white">
                      Reattempt Full Test
                    </h4>
                    <p className="text-white/90 text-xs mt-0.5">
                      Re-take the complete mock test to build speed and
                      reinforce test endurance.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRealReattempt}
                  className="w-full py-2.5 bg-white dark:bg-gray-800 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl font-black text-xs uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer"
                >
                  Reattempt Full Test
                </button>
              </div>
            </div>
          </section>

          {/* ── Section 2: Category Cutoff & Benchmarks ── */}
          <div className="flex items-center gap-3 pt-4">
            <div className="flex-1 border-t-2 border-dashed border-blue-200 dark:border-blue-800" />
            <span className="px-3.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
              <Award className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />{" "}
              Category Cutoff & Clearance Matrix
            </span>
            <div className="flex-1 border-t-2 border-dashed border-blue-200 dark:border-blue-800" />
          </div>

          <section
            ref={(el) => (sectionRefs.current["cutoff"] = el)}
            data-section-id="cutoff"
            className="scroll-mt-24 space-y-4"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-200 dark:border-gray-700 p-5 sm:p-6">
              {/* Top Banner: Status + User Category */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm shrink-0 ${
                      result.cutoffData?.isCleared
                        ? "bg-emerald-500 text-white"
                        : "bg-rose-500 text-white"
                    }`}
                  >
                    {result.cutoffData?.isCleared ? (
                      <CheckCircle className="w-7 h-7" />
                    ) : (
                      <XCircle className="w-7 h-7" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        Category: {result.cutoffData?.userCategory || "UR"}
                      </span>
                      <Link
                        to="/dashboard?tab=personal"
                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                        title="Change reservation category in profile"
                      >
                        (Change Category)
                      </Link>
                    </div>
                    <h3 className="text-lg font-black text-gray-900 dark:text-white mt-1">
                      {result.cutoffData?.isCleared
                        ? `Cleared ${result.cutoffData?.userCategory || "UR"} Cutoff!`
                        : `Missed ${result.cutoffData?.userCategory || "UR"} Cutoff`}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {result.cutoffData?.isCleared
                        ? `You scored ${result.score} marks, qualifying with a margin of +${result.cutoffData?.margin} marks.`
                        : `You scored ${result.score} marks, falling short by ${Math.abs(result.cutoffData?.margin ?? 0)} marks.`}
                    </p>
                  </div>
                </div>

                {/* Category Rank Badge */}
                <div className="flex flex-col sm:items-end bg-slate-50 dark:bg-gray-700/40 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700 shrink-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Category Cohort Standing
                  </span>
                  <div className="text-base font-black text-gray-900 dark:text-white mt-0.5 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-blue-500" />
                    <span>Cat. Rank #{result.categoryRank || 1}</span>
                    <span className="text-xs text-gray-400 font-normal">
                      / {result.categoryParticipants || 1} candidates
                    </span>
                  </div>
                </div>
              </div>

              {/* Category Matrix Grid */}
              <div className="pt-5">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">
                  All Categories Official Cutoff Benchmarks
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {Object.entries(
                    result.cutoffData?.cutoffs || {
                      UR: 120,
                      OBC: 112,
                      EWS: 109,
                      SC: 98,
                      ST: 90,
                    },
                  ).map(([cat, cutoffVal]) => {
                    const isUserCat =
                      (result.cutoffData?.userCategory || "UR") === cat;
                    const clearedThis = (result.score ?? 0) >= cutoffVal;
                    return (
                      <div
                        key={cat}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          isUserCat
                            ? "ring-2 ring-blue-500 bg-blue-50/70 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700"
                            : "bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span className="text-xs font-black text-gray-700 dark:text-gray-300">
                            {cat}
                          </span>
                          {isUserCat && (
                            <span className="text-[9px] font-black uppercase px-1 py-0.2 bg-blue-600 text-white rounded">
                              YOU
                            </span>
                          )}
                        </div>
                        <div className="text-base font-black text-gray-900 dark:text-white mt-1">
                          {cutoffVal}
                        </div>
                        <div className="mt-1">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              clearedThis
                                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                                : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                            }`}
                          >
                            {clearedThis ? "Cleared" : "Below"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 3: Subjects & Section Report Card ── */}
          {Object.keys(subjectBreakdown).length > 0 && (
            <>
              <div className="flex items-center gap-3 pt-4">
                <div className="flex-1 border-t-2 border-dashed border-purple-200 dark:border-purple-800" />
                <span className="px-3.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                  <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />{" "}
                  Subject & Section Analysis
                </span>
                <div className="flex-1 border-t-2 border-dashed border-purple-200 dark:border-purple-800" />
              </div>

              <section
                ref={(el) => (sectionRefs.current["subjects"] = el)}
                data-section-id="subjects"
                className="scroll-mt-24 space-y-4"
              >
                {/* Section Performance Report Card Table */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xs border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                        Section-Wise Scorecard
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Detailed report of accuracy, attempts, score and time
                        per section
                      </p>
                    </div>
                    <span className="text-xs font-extrabold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                      {Object.keys(subjectBreakdown).length} Sections
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700 text-[11px] sm:text-xs font-black text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                          <th className="py-3 px-3 sm:px-4">
                            Section / Subject
                          </th>
                          <th className="py-3 px-2 sm:px-3 text-center">
                            Total Qs
                          </th>
                          <th className="py-3 px-2 sm:px-3 text-center">
                            Attempted
                          </th>
                          <th className="py-3 px-2 sm:px-3 text-center text-emerald-600 dark:text-emerald-400">
                            Correct
                          </th>
                          <th className="py-3 px-2 sm:px-3 text-center text-rose-600 dark:text-rose-400">
                            Incorrect
                          </th>
                          <th className="py-3 px-2 sm:px-3 text-center text-slate-500">
                            Skipped
                          </th>
                          <th className="py-3 px-3 sm:px-4 text-center">
                            Accuracy
                          </th>
                          <th className="py-3 px-2 sm:px-3 text-center">
                            Score
                          </th>
                          <th className="py-3 px-3 sm:px-4 text-right">
                            Time Spent
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-medium">
                        {subjectAccuracies.map((s) => {
                          const attempted = s.correct + s.wrong;

                          return (
                            <tr
                              key={s.subject}
                              className="hover:bg-slate-50/80 dark:hover:bg-gray-700/40 transition-colors"
                            >
                              <td className="py-3 px-3 sm:px-4 font-bold text-gray-900 dark:text-white">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                                  <span className="truncate">{s.subject}</span>
                                </div>
                              </td>
                              <td className="py-3 px-2 sm:px-3 text-center font-bold text-gray-700 dark:text-gray-300">
                                {s.total}
                              </td>
                              <td className="py-3 px-2 sm:px-3 text-center font-bold text-gray-800 dark:text-gray-200">
                                {attempted}
                              </td>
                              <td className="py-3 px-2 sm:px-3 text-center">
                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-extrabold text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                                  {s.correct}
                                </span>
                              </td>
                              <td className="py-3 px-2 sm:px-3 text-center">
                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-extrabold text-xs bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300">
                                  {s.wrong}
                                </span>
                              </td>
                              <td className="py-3 px-2 sm:px-3 text-center text-slate-500 dark:text-gray-400 font-semibold">
                                {s.unattempted}
                              </td>
                              <td className="py-3 px-3 sm:px-4 text-center">
                                <span
                                  className={`inline-flex font-black text-xs px-2.5 py-0.5 rounded-md ${
                                    s.accuracy >= 75
                                      ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                      : s.accuracy >= 50
                                        ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                        : "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                  }`}
                                >
                                  {attempted > 0 ? `${s.accuracy}%` : "-"}
                                </span>
                              </td>
                              <td className="py-3 px-2 sm:px-3 text-center">
                                <span
                                  className={`font-black text-xs sm:text-sm ${
                                    s.score > 0
                                      ? "text-indigo-600 dark:text-indigo-400"
                                      : s.score < 0
                                        ? "text-rose-600 dark:text-rose-400"
                                        : "text-slate-600 dark:text-slate-400"
                                  }`}
                                >
                                  {formatScoreValue(s.score)}
                                </span>
                              </td>
                              <td className="py-3 px-3 sm:px-4 text-right font-bold text-gray-600 dark:text-gray-300 tabular-nums">
                                {formatTime(s.timeSpent)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100/80 dark:bg-gray-900/80 font-black border-t-2 border-gray-300 dark:border-gray-600 text-xs sm:text-sm text-gray-900 dark:text-white">
                          <td className="py-3 px-3 sm:px-4 uppercase tracking-wider">
                            Total / Overall
                          </td>
                          <td className="py-3 px-2 sm:px-3 text-center">
                            {totalQuestions}
                          </td>
                          <td className="py-3 px-2 sm:px-3 text-center">
                            {correctCount + wrongCount}
                          </td>
                          <td className="py-3 px-2 sm:px-3 text-center text-emerald-600 dark:text-emerald-400">
                            {correctCount}
                          </td>
                          <td className="py-3 px-2 sm:px-3 text-center text-rose-600 dark:text-rose-400">
                            {wrongCount}
                          </td>
                          <td className="py-3 px-2 sm:px-3 text-center text-slate-500 dark:text-gray-400">
                            {skippedCount}
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-center">
                            <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200 px-2 py-0.5 rounded-md font-black">
                              {overallAccuracy.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-2 sm:px-3 text-center font-black text-indigo-700 dark:text-indigo-300">
                            {formatScoreValue(result.score || 0)}
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-right tabular-nums">
                            {formatTime(
                              subjectAccuracies.reduce(
                                (sum, s) => sum + (Number(s.timeSpent) || 0),
                                0,
                              ) > 0
                                ? subjectAccuracies.reduce(
                                    (sum, s) =>
                                      sum + (Number(s.timeSpent) || 0),
                                    0,
                                  )
                                : result.timeSpent || result.timeTaken || 0,
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Strongest / Weakest Area Highlight */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3">
                  {strongestSubject && (
                    <div className="flex items-start gap-3.5 bg-emerald-50/80 dark:bg-emerald-900/20 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-800">
                      <div className="w-10 h-10 rounded-xl bg-emerald-200 dark:bg-emerald-800/40 flex items-center justify-center flex-shrink-0 text-emerald-800 dark:text-emerald-200 shadow-2xs">
                        <Trophy className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">
                          Strongest Subject
                        </p>
                        <p className="text-sm font-black text-gray-900 dark:text-white">
                          {strongestSubject.subject}
                        </p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold mt-0.5">
                          {strongestSubject.accuracy}% accuracy score
                        </p>
                      </div>
                    </div>
                  )}
                  {weakestSubject && (
                    <div className="flex items-start gap-3.5 bg-rose-50/80 dark:bg-rose-900/20 rounded-2xl p-4 border border-rose-200 dark:border-rose-800">
                      <div className="w-10 h-10 rounded-xl bg-rose-200 dark:bg-rose-800/40 flex items-center justify-center flex-shrink-0 text-rose-800 dark:text-rose-200 shadow-2xs">
                        <Target className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-rose-800 dark:text-rose-200 uppercase tracking-wider">
                          Focus / Improvement Area
                        </p>
                        <p className="text-sm font-black text-gray-900 dark:text-white">
                          {weakestSubject.subject}
                        </p>
                        <p className="text-xs text-rose-700 dark:text-rose-300 font-bold mt-0.5">
                          {weakestSubject.accuracy}% accuracy score
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {/* ── Section 4: Difficulty ── */}
          <div className="flex items-center gap-3 pt-4">
            <div className="flex-1 border-t-2 border-dashed border-amber-200 dark:border-amber-800" />
            <span className="px-3.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
              <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />{" "}
              Difficulty Analysis
            </span>
            <div className="flex-1 border-t-2 border-dashed border-amber-200 dark:border-amber-800" />
          </div>

          <section
            ref={(el) => (sectionRefs.current["difficulty"] = el)}
            data-section-id="difficulty"
            className="scroll-mt-24 space-y-4"
          >
            {/* Scrollable single row on mobile, 3-column grid on desktop */}
            <div className="flex sm:grid sm:grid-cols-3 gap-3 sm:gap-4 overflow-x-auto no-scrollbar pb-1">
              {["Easy", "Medium", "Hard"].map((difficulty) => {
                const data = difficultyBreakdown[difficulty];
                const style = difficultyStyles[difficulty];
                const pct =
                  data.total > 0
                    ? Math.round((data.correct / data.total) * 100)
                    : 0;
                const wrongD = data.total - data.correct;
                return (
                  <div
                    key={difficulty}
                    className="min-w-[240px] sm:min-w-0 flex-1 shrink-0 bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 shadow-xs border border-gray-200 dark:border-gray-700 relative overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3 sm:mb-4">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 ${style.dot} rounded-full shadow-xs`}
                          />
                          <span className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white">
                            {difficulty}
                          </span>
                        </div>
                        <span
                          className={`text-lg sm:text-xl font-black ${style.text}`}
                        >
                          {pct}%
                        </span>
                      </div>

                      {/* Dual Mini Bar Chart */}
                      <div className="flex gap-2 h-14 sm:h-16 items-end mb-3 bg-gray-50 dark:bg-gray-900 p-2 rounded-xl">
                        <div className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full bg-emerald-500 rounded-t-md"
                            style={{
                              height: `${data.total > 0 ? (data.correct / data.total) * 100 : 0}%`,
                              minHeight: data.correct > 0 ? "4px" : "0",
                            }}
                          />
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            {data.correct} Correct
                          </span>
                        </div>
                        <div className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full bg-rose-500 rounded-t-md"
                            style={{
                              height: `${data.total > 0 ? (wrongD / data.total) * 100 : 0}%`,
                              minHeight: wrongD > 0 ? "4px" : "0",
                            }}
                          />
                          <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300">
                            {wrongD} Wrong
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold text-center">
                      {data.total} total questions
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Section 5: Time Analysis ── */}
          <div className="flex items-center gap-3 pt-4">
            <div className="flex-1 border-t-2 border-dashed border-blue-200 dark:border-blue-800" />
            <span className="px-3.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
              <Timer className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />{" "}
              Time & Speed Analysis
            </span>
            <div className="flex-1 border-t-2 border-dashed border-blue-200 dark:border-blue-800" />
          </div>

          <section
            ref={(el) => (sectionRefs.current["time"] = el)}
            data-section-id="time"
            className="scroll-mt-24 space-y-4"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-3.5 sm:p-4 shadow-xs border border-gray-200 dark:border-gray-700 text-center flex flex-col justify-between">
                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Total Time
                </p>
                <p className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                  {formatTime(result.timeSpent || result.timeTaken)}
                </p>
                <p className="text-[9px] text-gray-400 dark:text-gray-500 font-medium mt-1">
                  Full test session
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-3.5 sm:p-4 shadow-xs border border-gray-200 dark:border-gray-700 text-center flex flex-col justify-between">
                <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Avg Speed / Visited Q
                </p>
                <p className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                  {avgTimePerVisitedQuestion}s
                </p>
                <p className="text-[9px] text-gray-400 dark:text-gray-500 font-medium mt-1">
                  Based on {countForAvg} visited Qs
                </p>
              </div>
              {fastestQ && (
                <div className="bg-emerald-50/80 dark:bg-emerald-900/20 rounded-2xl p-3.5 sm:p-4 border border-emerald-200 dark:border-emerald-800 text-center flex flex-col justify-between">
                  <p className="text-[10px] font-black text-emerald-800 dark:text-emerald-200 uppercase tracking-wider mb-1">
                    Lowest Time Taken
                  </p>
                  <p className="text-base sm:text-xl font-black text-emerald-700 dark:text-emerald-300">
                    Q{fastestQ.index}{" "}
                    <span className="text-xs font-semibold text-emerald-600">
                      ({fastestQ.time}s)
                    </span>
                  </p>
                  <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold truncate mt-1">
                    {fastestQ.section || "Fastest"}
                  </p>
                </div>
              )}
              {slowestQ && (
                <div className="bg-rose-50/80 dark:bg-rose-900/20 rounded-2xl p-3.5 sm:p-4 border border-rose-200 dark:border-rose-800 text-center flex flex-col justify-between">
                  <p className="text-[10px] font-black text-rose-800 dark:text-rose-200 uppercase tracking-wider mb-1">
                    Max Time Taken
                  </p>
                  <p className="text-base sm:text-xl font-black text-rose-700 dark:text-rose-300">
                    Q{slowestQ.index}{" "}
                    <span className="text-xs font-semibold text-rose-600">
                      ({formatTime(slowestQ.time)})
                    </span>
                  </p>
                  <p className="text-[9px] text-rose-600 dark:text-rose-400 font-bold truncate mt-1">
                    {slowestQ.section || "Max Time"}
                  </p>
                </div>
              )}
            </div>

            {/* Per-question time bar chart */}
            {questionTimeData.some((q) => q.time > 0) && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-5 shadow-xs border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">
                  Question-by-Question Time Graph
                </p>
                <div className="flex items-end gap-[2px] h-32 overflow-x-auto">
                  {questionTimeData.map((q) => {
                    const maxTime = Math.max(
                      ...questionTimeData.map((x) => x.time),
                      1,
                    );
                    const h = (q.time / maxTime) * 100;
                    return (
                      <div
                        key={q.index}
                        className="flex flex-col items-center flex-shrink-0"
                        style={{
                          width: `${Math.max(100 / questionTimeData.length, 8)}%`,
                        }}
                      >
                        <div
                          className={`w-full rounded-t transition-all ${q.skipped ? "bg-slate-300 dark:bg-gray-600" : q.correct ? "bg-emerald-500" : "bg-rose-500"}`}
                          style={{ height: `${Math.max(h, 3)}%` }}
                          title={`Q${q.index} (${q.section}): ${q.time}s`}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-gray-400 dark:text-gray-500 font-bold">
                  <span>Q1</span>
                  <span>Q{questionTimeData.length}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3 text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />{" "}
                    Correct
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />{" "}
                    Wrong
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-600 dark:text-gray-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-gray-600 inline-block" />{" "}
                    Skipped
                  </span>
                  <span className="text-gray-400 dark:text-gray-500 ml-auto font-medium">
                    Avg Visited: {avgTimePerVisitedQuestion}s
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* ── Section 6: Solutions ── */}
          <div className="flex items-center gap-3 pt-4">
            <div className="flex-1 border-t-2 border-dashed border-emerald-200 dark:border-emerald-800" />
            <span className="px-3.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
              <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />{" "}
              Solutions & Review
            </span>
            <div className="flex-1 border-t-2 border-dashed border-emerald-200 dark:border-emerald-800" />
          </div>

          <section
            ref={(el) => (sectionRefs.current["solutions"] = el)}
            data-section-id="solutions"
            className="scroll-mt-24 pb-12 space-y-4"
          >
            {questions.length > 0 ? (
              <>
                <div className="sticky top-16 md:top-20 z-20 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md space-y-2.5 mb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white leading-tight">
                          Solutions & Explanations
                        </h3>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">
                          Showing {getFilteredQuestions().length} of{" "}
                          {questions.length} questions
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={handleSolutionMode}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />{" "}
                        <span className="hidden xs:inline">Interactive</span>{" "}
                        Review
                      </button>
                      <button
                        onClick={() =>
                          setLanguage((lang) => {
                            const next = lang === "en" ? "hi" : "en";
                            localStorage.setItem("trstprep_language", next);
                            document.documentElement.lang = next;
                            return next;
                          })
                        }
                        className="flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 shadow-2xs font-bold text-xs transition-colors cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                        <span className="uppercase">{language}</span>
                      </button>
                    </div>
                  </div>

                  {/* Section-Wise Filter Pills (Horizontal Scroll) */}
                  {resultSections.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 pt-0.5 -mx-1 px-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 shrink-0">
                        Section:
                      </span>
                      <button
                        type="button"
                        onClick={() => setSolutionSectionFilter("all")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 border cursor-pointer whitespace-nowrap ${
                          solutionSectionFilter === "all"
                            ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                            : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        All Sections ({questions.length})
                      </button>
                      {resultSections.map((sec) => {
                        const secCount = questions.filter(
                          (q) => (q.section || q.subject || "General") === sec,
                        ).length;
                        const isSecActive = solutionSectionFilter === sec;
                        return (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => setSolutionSectionFilter(sec)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 border cursor-pointer whitespace-nowrap ${
                              isSecActive
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                                : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                            }`}
                          >
                            {sec} ({secCount})
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Status Filter Buttons (Horizontal Scroll on Mobile) */}
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-gray-100 dark:border-gray-700 -mx-1 px-1">
                    {[
                      {
                        key: "all",
                        label: `All (${questionsInActiveSection.length})`,
                      },
                      {
                        key: "correct",
                        label: `✓ Correct (${statusCounts.correct})`,
                        color:
                          "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
                      },
                      {
                        key: "wrong",
                        label: `✗ Wrong (${statusCounts.wrong})`,
                        color:
                          "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800",
                      },
                      {
                        key: "unattempted",
                        label: `— Skipped (${statusCounts.skipped})`,
                        color:
                          "text-slate-700 dark:text-gray-200 bg-slate-50 dark:bg-gray-900 border-slate-200 dark:border-gray-700",
                      },
                      ...(statusCounts.marked > 0
                        ? [
                            {
                              key: "marked",
                              label: `★ Marked (${statusCounts.marked})`,
                              color:
                                "text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800",
                            },
                          ]
                        : []),
                    ].map((filter) => {
                      const isActive = solutionFilter === filter.key;
                      const baseClass =
                        filter.color ||
                        "text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700";
                      return (
                        <button
                          key={filter.key}
                          onClick={() => setSolutionFilter(filter.key)}
                          className={`px-3 py-1 rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                            isActive
                              ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                              : `hover:shadow-xs ${baseClass}`
                          }`}
                        >
                          {filter.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Question Cards List */}
                <div className="space-y-3.5">
                  {getFilteredQuestions().map((q, idx) => {
                    const isCorrect = isCorrectQuestion(q);
                    const isSkipped = isSkippedQuestion(q);
                    const rawCorrect =
                      q.correctOption ??
                      q.correct_option ??
                      q.correct_option_id ??
                      q.correctOptionId ??
                      q.correctAnswer ??
                      q.correct_answer ??
                      q.correct ??
                      q.answer;
                    const correctAnswer = Array.isArray(rawCorrect)
                      ? rawCorrect.map(normalizeResultOption)
                      : normalizeResultOption(rawCorrect);
                    const questionNum =
                      q.originalIndex || questions.indexOf(q) + 1;
                    const isExpanded = expandedSolutions[q.id || q._id || idx];
                    const qMarks = Number(q.marks || 2);
                    const qNegMarks = Number(
                      q.negativeMarks !== undefined ? q.negativeMarks : 0.5,
                    );
                    const qTime = Number(q.timeTaken || q.timeSpent || 0);

                    const cardBorder = isSkipped
                      ? "border-l-4 border-l-slate-400 dark:border-l-slate-600"
                      : isCorrect
                        ? "border-l-4 border-l-emerald-500"
                        : "border-l-4 border-l-rose-500";

                    return (
                      <div
                        key={q.id || q._id || idx}
                        className={`bg-white dark:bg-gray-800 ${cardBorder} border-y border-r rounded-2xl overflow-hidden transition-all duration-200 ${
                          isExpanded
                            ? "shadow-md border-y-indigo-200 dark:border-y-indigo-900/60 border-r-indigo-200 dark:border-r-indigo-900/60"
                            : "border-y-gray-200 dark:border-y-gray-700/80 border-r-gray-200 dark:border-r-gray-700/80 hover:shadow-xs"
                        }`}
                      >
                        {/* Header Bar */}
                        <div
                          onClick={() => toggleSolution(q.id || q._id || idx)}
                          className={`p-3.5 sm:p-5 cursor-pointer transition-colors ${
                            isExpanded
                              ? "bg-indigo-50/15 dark:bg-indigo-950/20"
                              : "hover:bg-gray-50/60 dark:hover:bg-gray-750"
                          }`}
                        >
                          {/* Top Meta Row on Mobile & Desktop */}
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                              <span
                                className={`px-2.5 py-0.5 rounded-lg text-xs font-black shadow-2xs ${
                                  isSkipped
                                    ? "bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300"
                                    : isCorrect
                                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                                      : "bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300"
                                }`}
                              >
                                Question {questionNum}
                              </span>

                              {q.section && (
                                <span className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md truncate max-w-[140px] sm:max-w-[220px]">
                                  {q.section}
                                </span>
                              )}

                              {qTime > 0 && (
                                <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {qTime}s
                                </span>
                              )}
                            </div>

                            {/* Status and Expand Action */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {q.isMarked && (
                                <span
                                  className="p-1 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 rounded-md"
                                  title="Marked for Review"
                                >
                                  <Flag className="w-3.5 h-3.5" />
                                </span>
                              )}

                              <span
                                className={`px-2 py-0.5 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-md ${
                                  isSkipped
                                    ? "bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-400"
                                    : isCorrect
                                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                                      : "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                                }`}
                              >
                                {isSkipped
                                  ? "0.0 (Skipped)"
                                  : isCorrect
                                    ? `+${qMarks} (Correct)`
                                    : `-${qNegMarks} (Wrong)`}
                              </span>

                              <div
                                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition-colors ${
                                  isExpanded
                                    ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                                    : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-400"
                                }`}
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Question Text Body */}
                          <div className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 leading-relaxed break-words">
                            <MathRenderer
                              text={sanitizeHtml(
                                getLocalizedField(q.text, language) ||
                                  q.questionText ||
                                  "",
                              )}
                            />
                          </div>
                        </div>

                        {/* Expanded Content: Options & Explanation */}
                        {isExpanded && (
                          <div className="p-3.5 sm:p-5 border-t border-gray-100 dark:border-gray-700/80 bg-slate-50/50 dark:bg-gray-800/60 space-y-4">
                            {/* Options List */}
                            <div className="space-y-2">
                              <p className="text-[11px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                Options & Choices:
                              </p>
                              {(
                                getLocalizedField(q.options, language) || []
                              ).map((opt, optIdx) => {
                                const isCorrectOpt =
                                  !isSkipped &&
                                  (Array.isArray(correctAnswer)
                                    ? correctAnswer.includes(optIdx)
                                    : optIdx === correctAnswer);
                                const isUserChoice =
                                  !isSkipped &&
                                  (Array.isArray(q.userAnswer)
                                    ? q.userAnswer
                                        .map(normalizeResultOption)
                                        .includes(optIdx)
                                    : optIdx ===
                                      normalizeResultOption(q.userAnswer));

                                return (
                                  <div
                                    key={optIdx}
                                    className={`flex items-start gap-2.5 sm:gap-3.5 p-3 sm:p-3.5 rounded-xl border text-xs sm:text-sm font-medium transition-all ${
                                      isCorrectOpt
                                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100 shadow-2xs ring-1 ring-emerald-500/20"
                                        : isUserChoice
                                          ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-100"
                                          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/70 text-gray-700 dark:text-gray-300"
                                    }`}
                                  >
                                    <span
                                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                        isCorrectOpt
                                          ? "bg-emerald-600 text-white"
                                          : isUserChoice
                                            ? "bg-rose-600 text-white"
                                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                                      }`}
                                    >
                                      {String.fromCharCode(65 + optIdx)}
                                    </span>

                                    <div className="flex-1 min-w-0 pt-0.5 leading-relaxed break-words">
                                      <MathRenderer
                                        text={sanitizeHtml(
                                          getLocalizedField(opt, language),
                                        )}
                                      />
                                    </div>

                                    {isCorrectOpt && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded shrink-0">
                                        <CheckCircle className="w-3.5 h-3.5" />{" "}
                                        Correct
                                      </span>
                                    )}
                                    {isUserChoice && !isCorrectOpt && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/50 px-2 py-0.5 rounded shrink-0">
                                        <XCircle className="w-3.5 h-3.5" /> Your
                                        Choice
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Detailed Explanation */}
                            {q.explanation && (
                              <div className="p-3.5 sm:p-4 bg-gradient-to-br from-indigo-50/90 via-blue-50/90 to-slate-50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-950 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs">
                                <div className="flex items-center gap-1.5 text-xs font-black uppercase text-indigo-950 dark:text-indigo-300 tracking-wider mb-2">
                                  <Lightbulb className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                                  <span>Explanation & Concept</span>
                                </div>
                                <div className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-normal break-words">
                                  <MathRenderer
                                    text={sanitizeHtml(
                                      getLocalizedField(
                                        q.explanation,
                                        language,
                                      ) || q.explanation,
                                    )}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Quick Action Bar for this question */}
                            <div className="flex items-center justify-between pt-1 text-xs">
                              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
                                Marking: +{qMarks} / -{qNegMarks}
                              </span>
                              <button
                                onClick={() =>
                                  navigate(
                                    `/practice?mode=custom&questionId=${q.id || q._id}`,
                                  )
                                }
                                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                              >
                                Practice Similar Questions →
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 border-dashed">
                <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-500 mx-auto mb-3" />
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
                  No questions available for analysis.
                </p>
              </div>
            )}
          </section>
        </main>
      </div>

      {/* ═══ REATTEMPT CONFIRMATION MODAL ═══ */}
      {showReattemptModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full p-6 text-center border border-slate-100 dark:border-gray-700 relative overflow-hidden">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-100 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 shadow-xs">
              <RotateCcw className="w-8 h-8 animate-spin-once" />
            </div>

            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">
              Reattempt This Test?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-5 leading-relaxed">
              Do you want to reattempt{" "}
              <span className="font-bold text-gray-900 dark:text-white">
                {result?.testTitle || "this test"}
              </span>
              ?
              <br />
              This will start a fresh test session and be recorded as{" "}
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                Attempt #{nextAttemptNumber}
              </span>
              .
            </p>

            <div className="bg-slate-50 dark:bg-gray-900 rounded-2xl p-3.5 mb-6 border border-slate-200/80 dark:border-gray-700/80 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400 font-medium">
                  Previous Best Score
                </span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {(result?.score || 0).toFixed(1)} / {maxScore} (
                  {Math.round(scorePct)}%)
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400 font-medium">
                  Target Attempt
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                  Attempt #{nextAttemptNumber}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowReattemptModal(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                No, Cancel
              </button>
              <button
                onClick={confirmReattempt}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm hover:from-emerald-500 hover:to-teal-500 shadow-md hover:shadow-lg transition-all"
              >
                Yes, Start Attempt #{nextAttemptNumber}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MOBILE FLOATING ACTION BUBBLE ═══ */}
      <div className="md:hidden fixed bottom-6 right-4 z-50">
        {showMobileActions && (
          <div className="mb-3 flex flex-col items-end space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              onClick={() => {
                setShowMobileActions(false);
                handleSolutionMode();
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white text-xs font-bold rounded-full shadow-xl border border-sky-400/30 active:scale-95 transition-all"
            >
              <Lightbulb className="w-4 h-4" /> Solutions & Review
            </button>
            <button
              onClick={() => {
                setShowMobileActions(false);
                handleRealReattempt();
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-full shadow-xl border border-emerald-400/30 active:scale-95 transition-all"
            >
              <RotateCcw className="w-4 h-4" /> Reattempt Test
            </button>
            <Link
              to="/dashboard"
              onClick={() => setShowMobileActions(false)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-full shadow-xl border border-indigo-400/30 active:scale-95 transition-all"
            >
              <ArrowRight className="w-4 h-4" /> Dashboard
            </Link>
          </div>
        )}
        <button
          onClick={() => setShowMobileActions(!showMobileActions)}
          className="w-12 h-12 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center border border-slate-700 active:scale-95 transition-all"
        >
          {showMobileActions ? (
            <X className="w-5 h-5" />
          ) : (
            <Sparkles className="w-5 h-5 text-amber-400" />
          )}
        </button>
      </div>
    </div>
  );
}

export default TestResult;
