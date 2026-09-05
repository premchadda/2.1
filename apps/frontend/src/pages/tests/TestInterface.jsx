import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Suspense,
  lazy,
} from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { toast } from "react-hot-toast";
import {
  apiClient,
  isCancel,
  getTestById,
  getQuestionsByTestId,
  bookmarksAPI,
} from "../../shared/lib/dataService";
import { API_BASE_URL } from "../../shared/lib/apiBase.js";
import { clearDashboardCache } from "../../shared/lib/dashboardCache";
import Telemetry from "../../shared/lib/telemetry";
import sanitizeHtml from "../../shared/lib/sanitizeHtml";
import { getLocalizedField } from "../../shared/lib/language";
import MathRenderer from "../../shared/components/MathRenderer";
import { useAuth } from "../../shared/providers/AuthContext";
// M25: code-split the heavy, conditionally-shown panels out of the main
// TestInterface chunk so they're only fetched when the user actually opens
// them (notes / discussions).
const QuestionNotes = lazy(
  () => import("../../shared/components/QuestionNotes"),
);
const QuestionDiscussions = lazy(
  () => import("../../shared/components/QuestionDiscussions"),
);
import { useAdaptiveDifficulty } from "../../shared/hooks/useAdaptiveDifficulty";
import DifficultyBadge from "../../shared/components/common/DifficultyBadge";
import QuestionPalette from "./QuestionPalette";
import SubmitSummaryModal from "./components/SubmitSummaryModal";
import ImageZoomModal from "./components/ImageZoomModal";
import TestTimerHeader from "./components/TestTimerHeader";
import SectionTabs from "./components/SectionTabs";
import QuestionViewer from "./components/QuestionViewer";
import TestBottomBar from "./components/TestBottomBar";
import { normalizeTestQuestions } from "../../shared/utils/testClassification";
import { AlertCircle } from "lucide-react";

// Local offline buffer key for in-progress answers. Uses the URL param testId
// so it is stable and available at restore time (before numeric DB id resolves).
const ANSWERS_KEY = (id) => `trstprep_answers_${id}`;
const OFFLINE_BUFFER_TTL_MS = 24 * 60 * 60 * 1000; // 24h — stale buffers are discarded

// Persist the current answer buffer to localStorage. Guarded so quota /
// private-mode failures never crash the test. On QuotaExceededError we evict
// the oldest trstprep_answers_* entry and retry once.
const persistLocalAnswers = (id, payload) => {
  try {
    const record = { ...payload, savedAt: Date.now() };
    localStorage.setItem(ANSWERS_KEY(id), JSON.stringify(record));
  } catch (e) {
    const isQuota = e?.name === "QuotaExceededError" || e?.code === 22;
    if (isQuota) {
      try {
        // Evict oldest answer buffer to free quota
        let oldestKey = null;
        let oldestTime = Infinity;
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith("trstprep_answers_") && k !== ANSWERS_KEY(id)) {
            try {
              const v = JSON.parse(localStorage.getItem(k) || "{}");
              if (v.savedAt && v.savedAt < oldestTime) {
                oldestTime = v.savedAt;
                oldestKey = k;
              }
            } catch {}
          }
        }
        if (oldestKey) localStorage.removeItem(oldestKey);
        // Retry once after eviction
        try {
          localStorage.setItem(
            ANSWERS_KEY(id),
            JSON.stringify({ ...payload, savedAt: Date.now() }),
          );
        } catch {}
      } catch {}
    }
    // storage unavailable — silently skip
  }
};

// Read the local answer buffer. Returns null on missing/garbage/expired input.
const readLocalAnswers = (id) => {
  try {
    const raw = localStorage.getItem(ANSWERS_KEY(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Expire stale buffers (e.g. abandoned test days ago) — prevents
    // resurrecting outdated answers after a long gap.
    if (
      parsed?.savedAt &&
      Date.now() - parsed.savedAt > OFFLINE_BUFFER_TTL_MS
    ) {
      try {
        localStorage.removeItem(ANSWERS_KEY(id));
      } catch {}
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const clearLocalAnswers = (id) => {
  try {
    localStorage.removeItem(ANSWERS_KEY(id));
  } catch {
    // storage unavailable — silently skip
  }
};

const resolveCorrectIndex = (q) => {
  if (!q) return null;
  const raw =
    q.correctOption ??
    q.correct_option ??
    q.correct_option_id ??
    q.correctOptionId ??
    q.correctAnswer ??
    q.correct_answer ??
    q.correct ??
    q.answer;

  const opts = Array.isArray(q.options)
    ? q.options
    : Array.isArray(q.options?.en)
      ? q.options.en
      : [];

  if (Array.isArray(opts)) {
    const explicitIdx = opts.findIndex(
      (opt) =>
        opt &&
        typeof opt === "object" &&
        (opt.isCorrect === true ||
          opt.is_correct === true ||
          opt.correct === true),
    );
    if (explicitIdx >= 0) return explicitIdx;
  }

  if (raw === undefined || raw === null || raw === "") return null;

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }

  const str = String(raw).trim();
  if (/^[0-9]+$/.test(str)) {
    return Number.parseInt(str, 10);
  }

  // Single letter "A", "B", "C", "D"
  if (/^[A-Za-z]$/.test(str)) {
    return str.toUpperCase().charCodeAt(0) - 65;
  }

  // Match by option text or key
  if (Array.isArray(opts)) {
    const matchIdx = opts.findIndex((opt) => {
      if (!opt) return false;
      if (typeof opt === "string") return opt.trim() === str;
      return (
        opt.text?.trim() === str ||
        opt.en?.trim() === str ||
        opt.key?.trim()?.toUpperCase() === str.toUpperCase() ||
        opt.value?.trim() === str ||
        String(opt.id) === str
      );
    });
    if (matchIdx >= 0) return matchIdx;
  }

  return null;
};

const normalizeAnswerIndex = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = String(value).trim();
  if (/^[A-Za-z]$/.test(normalized)) {
    return normalized.toUpperCase().charCodeAt(0) - 65;
  }
  if (/^-?\d+(\.\d+)?$/.test(normalized)) return Number(normalized);
  return null;
};

const isReviewAnswerCorrect = (question, answer) => {
  if (answer === undefined || answer === null || answer === "") return false;

  const rawCorrect =
    question?.correctOption ??
    question?.correct_option ??
    question?.correct_option_id ??
    question?.correctOptionId ??
    question?.correctAnswer ??
    question?.correct_answer ??
    question?.correct ??
    question?.answer;

  if (question?.type === "true-false") {
    return String(answer).toLowerCase() === String(rawCorrect).toLowerCase();
  }

  if (Array.isArray(answer) || Array.isArray(rawCorrect)) {
    const selected = (Array.isArray(answer) ? answer : [answer])
      .map(normalizeAnswerIndex)
      .filter((value) => value !== null)
      .sort((a, b) => a - b);
    const correct = (Array.isArray(rawCorrect) ? rawCorrect : [rawCorrect])
      .map(normalizeAnswerIndex)
      .filter((value) => value !== null)
      .sort((a, b) => a - b);
    return (
      selected.length === correct.length &&
      selected.every((value, index) => value === correct[index])
    );
  }

  const selectedIndex = normalizeAnswerIndex(answer);
  const correctIndex = resolveCorrectIndex(question);
  return (
    selectedIndex !== null &&
    correctIndex !== null &&
    selectedIndex === correctIndex
  );
};

const normalizeReviewAnswer = (question, answer) => {
  if (question?.type === "msq" && Array.isArray(answer)) {
    return answer.map(normalizeAnswerIndex).filter((value) => value !== null);
  }
  if (question?.type === "true-false") return answer;
  return normalizeAnswerIndex(answer) ?? answer;
};

function TestInterface() {
  const routeParams = useParams();
  const testId = routeParams.testId;
  const seriesId = routeParams.seriesSlug || routeParams.seriesId;
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  // Auto-detect /review route or explicit reviewMode in state
  const isReviewRoute = location.pathname.endsWith("/review");
  const reviewMode = Boolean(location.state?.reviewMode) || isReviewRoute;
  const reviewResultData = location.state?.resultData || null;
  const sectionalTimerParam = new URLSearchParams(location.search).get(
    "sectionalTimer",
  );

  const preloadedQuestions = location.state?.preloadedQuestions;
  const preloadedTest = location.state?.preloadedTest;
  const preloadedAttemptData = location.state?.preloadedAttemptData;

  const initialQuestions = useMemo(() => {
    if (
      !reviewMode &&
      Array.isArray(preloadedQuestions) &&
      preloadedQuestions.length > 0
    ) {
      return normalizeTestQuestions(preloadedQuestions, preloadedTest);
    }
    return [];
  }, [reviewMode, preloadedQuestions, preloadedTest]);

  // State
  const [test, setTest] = useState(() => {
    if (!reviewMode && preloadedTest) {
      const configuredSections = Array.isArray(preloadedTest.sections)
        ? preloadedTest.sections
        : [];
      const questionSectionNames = [
        ...new Set(initialQuestions.map((q) => q.section || "General")),
      ];
      const useSectionalTimer =
        sectionalTimerParam === "on" ||
        (sectionalTimerParam !== "off" &&
          Boolean(
            preloadedTest.hasSectionalTiming ||
            preloadedTest.has_sectional_timing ||
            preloadedTest.sectionalTiming ||
            preloadedTest.enableSectionalTiming,
          ));
      const sectionTimeLimits = {};
      if (useSectionalTimer) {
        const fallbackMinutes =
          (Number(preloadedTest.duration) || 60) /
          Math.max(questionSectionNames.length, 1);
        questionSectionNames.forEach((sectionName) => {
          const config = configuredSections.find(
            (section) =>
              String(
                section.name || section.title || section.subject || "",
              ).toLowerCase() === String(sectionName).toLowerCase(),
          );
          const configuredMinutes = Number(
            config?.duration ??
              config?.timeLimit ??
              config?.time_limit ??
              config?.durationMinutes,
          );
          sectionTimeLimits[sectionName] =
            (configuredMinutes > 0 ? configuredMinutes : fallbackMinutes) * 60;
        });
      }
      return {
        ...preloadedTest,
        sectionTimeLimits,
        sectionalTimerEnabled: useSectionalTimer,
      };
    }
    return null;
  });
  const [questions, setQuestions] = useState(() => initialQuestions);
  const [loading, setLoading] = useState(() => {
    if (reviewMode) return true;
    if (initialQuestions.length > 0) return false;
    return true;
  });
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [currentSection, setCurrentSection] = useState(
    () => initialQuestions[0]?.section || "",
  );
  const [answers, setAnswers] = useState(() => {
    if (
      preloadedAttemptData?.answers &&
      preloadedAttemptData.answers.length > 0
    ) {
      const restoredAnswers = {};
      preloadedAttemptData.answers.forEach((a) => {
        restoredAnswers[a.questionIndex] = a.selectedOption;
      });
      return restoredAnswers;
    }
    return {};
  });
  const [markedForReview, setMarkedForReview] = useState(() => {
    if (
      preloadedAttemptData?.markedForReview &&
      preloadedAttemptData.markedForReview.length > 0
    ) {
      return new Set(preloadedAttemptData.markedForReview);
    }
    return new Set();
  });
  const [visitedQuestions, setVisitedQuestions] = useState(() => {
    if (
      preloadedAttemptData?.answers &&
      preloadedAttemptData.answers.length > 0
    ) {
      const visited = new Set([0]);
      preloadedAttemptData.answers.forEach((a) => {
        visited.add(a.questionIndex);
      });
      return visited;
    }
    return new Set([0]);
  });
  const [timeLeft, setTimeLeft] = useState(() => {
    if (!reviewMode && preloadedTest?.duration) {
      if (preloadedAttemptData?.timeSpent > 0) {
        return Math.max(
          1,
          (preloadedTest.duration || 60) * 60 - preloadedAttemptData.timeSpent,
        );
      }
      return (Number(preloadedTest.duration) || 60) * 60;
    }
    return 0;
  });
  const [showPalette, setShowPalette] = useState(false);
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem("trstprep_language");
    const lang = saved === "hi" ? "hi" : "en";
    document.documentElement.lang = lang;
    return lang;
  });
  const [_showInstructions, _setShowInstructions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [attemptId, setAttemptId] = useState(
    () => preloadedAttemptData?.attemptId || null,
  );
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [interactiveReviewEnabled, _setInteractiveReviewEnabled] =
    useState(false);
  const [showReviewExplanation, setShowReviewExplanation] = useState(true);
  const [reviewComparisons, setReviewComparisons] = useState({});
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [showSubmitSummary, setShowSubmitSummary] = useState(false);
  const pauseDialogRef = useRef(null);
  const submitDialogRef = useRef(null);
  const [disableNegativeMarking, _setDisableNegativeMarking] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showDiscussions, setShowDiscussions] = useState(false);
  const [savedQuestions, setSavedQuestions] = useState(new Set());

  // Load existing bookmarks on mount
  useEffect(() => {
    if (user) {
      bookmarksAPI
        // The test interface only needs saved item IDs; avoid enriching up to
        // 100 bookmarks with one database lookup per item.
        .getAll(1, 100, { includeDetails: false })
        .then((res) => {
          const items = res.data || [];
          const set = new Set(items.map((b) => String(b.itemId || b.item_id)));
          setSavedQuestions(set);
        })
        .catch((err) => console.warn("Load bookmarks error:", err));
    }
  }, [user]);

  const toggleSaveQuestion = async (qId) => {
    const targetQ = qId
      ? questions.find((q) => String(q.id || q._id) === String(qId))
      : questions[currentQuestion];
    const targetId = qId || targetQ?.id || targetQ?._id || currentQuestion;
    if (!targetId) return;

    const strTargetId = String(targetId);
    const isCurrentlySaved = savedQuestions.has(strTargetId);
    const extractText = (val) => {
      if (!val) return "";
      if (typeof val === "string") {
        if (val === "[object Object]") return "";
        if (val.trim().startsWith("{") && val.trim().endsWith("}")) {
          try {
            const p = JSON.parse(val);
            return (
              p.en || p.hi || p.text || p.question || Object.values(p)[0] || val
            );
          } catch {
            return val;
          }
        }
        return val;
      }
      if (typeof val === "object") {
        return (
          val.en ||
          val.hi ||
          val.text ||
          val.question ||
          Object.values(val)[0] ||
          ""
        );
      }
      return String(val);
    };

    const titleSnippet =
      extractText(targetQ?.questionText) ||
      extractText(targetQ?.text) ||
      extractText(targetQ?.title) ||
      extractText(targetQ?.question) ||
      `Question #${strTargetId}`;

    // Optimistic UI update
    setSavedQuestions((prev) => {
      const next = new Set(prev);
      if (isCurrentlySaved) next.delete(strTargetId);
      else next.add(strTargetId);
      return next;
    });

    try {
      const res = await bookmarksAPI.toggle({
        itemId: strTargetId,
        itemType: "question",
        title: String(titleSnippet).substring(0, 200),
      });

      if (res.isBookmarked || !isCurrentlySaved) {
        toast.success("Question saved successfully", {
          id: `save-${strTargetId}`,
        });
      } else {
        toast.success("Question removed from saved items", {
          id: `save-${strTargetId}`,
        });
      }
    } catch (err) {
      console.error("Failed to toggle save question:", err);
      // Revert optimistic state
      setSavedQuestions((prev) => {
        const next = new Set(prev);
        if (isCurrentlySaved) next.add(strTargetId);
        else next.delete(strTargetId);
        return next;
      });
      toast.error("Failed to save question. Please try again.");
    }
  };

  // Question time tracking
  const [questionTimers, setQuestionTimers] = useState({});
  const [sectionTimers, setSectionTimers] = useState({});
  const questionStartTimeRef = useRef(null);
  const submitFrozenTimeSpentRef = useRef(null);
  const lastSaveRef = useRef(Date.now());

  const configuredSectionalTimer = Boolean(
    test?.sectionalTimerEnabled ||
    test?.hasSectionalTiming ||
    test?.has_sectional_timing ||
    test?.sectionalTiming ||
    test?.enableSectionalTiming,
  );
  const sectionalTimerEnabled =
    sectionalTimerParam === "on" ||
    (sectionalTimerParam !== "off" && configuredSectionalTimer);

  // Anti-cheat
  const tabSwitchCountRef = useRef(0);
  const _lastActivityRef = useRef(Date.now());

  // Derived state for sections in proper configured order directly from normalized questions
  const sections = useMemo(() => {
    return Array.from(new Set(questions.map((q) => q.section || "General")));
  }, [questions]);

  // Adaptive difficulty for the current question's topic
  const currentTopicId =
    questions[currentQuestion]?.topicId || questions[currentQuestion]?.topic_id;
  const {
    level: adaptiveLevel,
    score: adaptiveScore,
    submitPerformance,
  } = useAdaptiveDifficulty(currentTopicId);

  const computeSectionTimers = useCallback(
    (timers = questionTimers) => {
      const computed = {};
      Object.entries(timers).forEach(([key, value]) => {
        if (String(key).includes("_visits")) return;
        const index = Number.parseInt(key, 10);
        if (!Number.isInteger(index)) return;
        const section = questions[index]?.section || "General";
        computed[section] = (computed[section] || 0) + (Number(value) || 0);
      });
      // Add current active question's unsaved time to its section
      if (questionStartTimeRef.current && questions[currentQuestion]) {
        const activeSection = questions[currentQuestion].section || "General";
        const elapsed = Math.floor(
          (Date.now() - questionStartTimeRef.current) / 1000,
        );
        computed[activeSection] = (computed[activeSection] || 0) + elapsed;
      }
      return computed;
    },
    [questionTimers, questions, currentQuestion],
  );

  // Fetch test and questions from API
  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      try {
        // --- Review Mode: use state data or fetch from API ---
        if (reviewMode) {
          let rawResultData = reviewResultData;

          // If no resultData in state, fetch from the API
          if (!rawResultData?.questions?.length) {
            const attemptId = location.state?.attemptId;
            const endpoint = attemptId
              ? `/api/tests/${testId}/result/${attemptId}`
              : `/api/tests/${testId}/result`;
            const response = await apiClient.get(endpoint, {
              signal: controller.signal,
            });
            rawResultData = response.data?.data || response.data;
          }

          if (rawResultData?.questions?.length) {
            const mappedQuestions = rawResultData.questions.map((q, index) => {
              const rawSection = q.section || q.subject || "General";

              return {
                ...q,
                id: q.id || q._id || q.questionId || index,
                _id: q._id || q.id || q.questionId || index,
                text:
                  typeof q.text === "object"
                    ? {
                        en: q.text?.en || q.questionText || q.question || "",
                        hi:
                          q.text?.hi ||
                          q.questionTextHi ||
                          q.question_text_hi ||
                          "",
                      }
                    : {
                        en: q.text || q.questionText || q.question || "",
                        hi: q.questionTextHi || q.question_text_hi || "",
                      },
                options:
                  typeof q.options === "object" && !Array.isArray(q.options)
                    ? {
                        en: Array.isArray(q.options.en) ? q.options.en : [],
                        hi:
                          Array.isArray(q.options.hi) && q.options.hi.length > 0
                            ? q.options.hi
                            : Array.isArray(q.optionsHi) &&
                                q.optionsHi.length > 0
                              ? q.optionsHi
                              : Array.isArray(q.options_hi) &&
                                  q.options_hi.length > 0
                                ? q.options_hi
                                : [],
                      }
                    : {
                        en: Array.isArray(q.options) ? q.options : [],
                        hi:
                          Array.isArray(q.optionsHi) && q.optionsHi.length > 0
                            ? q.optionsHi
                            : Array.isArray(q.options_hi) &&
                                q.options_hi.length > 0
                              ? q.options_hi
                              : [],
                      },
                section: rawSection,
                subject: q.subject || rawSection,
                correctOption:
                  q.correctOption ??
                  q.correct_option ??
                  q.correct_option_id ??
                  q.correctOptionId ??
                  q.correctAnswer ??
                  q.correct_answer ??
                  q.correct ??
                  q.answer,
                correctAnswer:
                  q.correctOption ??
                  q.correct_option ??
                  q.correct_option_id ??
                  q.correctOptionId ??
                  q.correctAnswer ??
                  q.correct_answer ??
                  q.correct ??
                  q.answer,
                explanation:
                  typeof q.explanation === "object"
                    ? q.explanation
                    : {
                        en: q.explanation || "",
                        hi: q.explanationHi || q.explanation_hi || null,
                      },
                // Normalize userAnswer from various API shapes
                userAnswer:
                  q.userAnswer ??
                  q.selectedOption ??
                  q.user_answer ??
                  q.userChoice,
              };
            });

            const finalQuestions = normalizeTestQuestions(
              mappedQuestions,
              rawResultData,
            );

            setTest({
              ...rawResultData,
              id: testId,
              _id: testId,
              title:
                rawResultData.testTitle || rawResultData.title || "Test Review",
              sections:
                rawResultData.sections ||
                rawResultData.testSections ||
                rawResultData.test?.sections ||
                [],
              duration: Math.ceil(
                (rawResultData.timeSpent || rawResultData.timeTaken || 0) / 60,
              ),
            });
            setQuestions(finalQuestions);
            setCurrentSection(finalQuestions[0]?.section || "General");
            setVisitedQuestions(
              new Set(finalQuestions.map((_, index) => index)),
            );
            const restoredAnswers = {};
            finalQuestions.forEach((question, index) => {
              if (
                question.userAnswer !== undefined &&
                question.userAnswer !== null &&
                question.userAnswer !== "" &&
                question.userAnswer !== -1
              ) {
                restoredAnswers[index] = normalizeReviewAnswer(
                  question,
                  question.userAnswer,
                );
              }
            });
            setAnswers(restoredAnswers);
            const markedSet = new Set();
            finalQuestions.forEach((question, index) => {
              if (question.isMarked) {
                markedSet.add(index);
              }
            });
            setMarkedForReview(markedSet);
            setTimeLeft(0);
            questionStartTimeRef.current = null;
            return;
          }
        }

        let testData = test;
        let finalQuestions = questions;

        if (!testData || finalQuestions.length === 0) {
          testData = await getTestById(testId);

          if (testData) {
            setTimeLeft((testData.duration || 60) * 60);

            const questionsData = await getQuestionsByTestId(
              testData._id || testId,
            );
            finalQuestions = normalizeTestQuestions(questionsData, testData);

            const useSectionalTimer =
              sectionalTimerParam === "on" ||
              (sectionalTimerParam !== "off" &&
                Boolean(
                  testData.hasSectionalTiming ||
                  testData.has_sectional_timing ||
                  testData.sectionalTiming ||
                  testData.enableSectionalTiming,
                ));
            const configuredSections = Array.isArray(testData.sections)
              ? testData.sections
              : [];
            const questionSectionNames = [
              ...new Set(finalQuestions.map((q) => q.section || "General")),
            ];
            const sectionTimeLimits = {};
            if (useSectionalTimer) {
              const fallbackMinutes =
                (Number(testData.duration) || 60) /
                Math.max(questionSectionNames.length, 1);
              questionSectionNames.forEach((sectionName) => {
                const config = configuredSections.find(
                  (section) =>
                    String(
                      section.name || section.title || section.subject || "",
                    ).toLowerCase() === String(sectionName).toLowerCase(),
                );
                const configuredMinutes = Number(
                  config?.duration ??
                    config?.timeLimit ??
                    config?.time_limit ??
                    config?.durationMinutes,
                );
                sectionTimeLimits[sectionName] =
                  (configuredMinutes > 0
                    ? configuredMinutes
                    : fallbackMinutes) * 60;
              });
            }
            testData.sectionTimeLimits = sectionTimeLimits;
            testData.sectionalTimerEnabled = useSectionalTimer;
            setTest(testData);

            setQuestions(finalQuestions);
            if (finalQuestions.length > 0) {
              setCurrentSection(finalQuestions[0].section);
            }
          }
        }

        if (testData && finalQuestions.length > 0) {
          const isReattempt = Boolean(
            location.state?.isReattempt ||
            new URLSearchParams(location.search).get("attempt"),
          );
          if (isReattempt) {
            clearLocalAnswers(testId);
          }

          let attemptData = preloadedAttemptData;
          if (!attemptData?.attemptId && !attemptId) {
            const attemptResponse = await apiClient.post(
              `/api/tests/${testData._id || testData.id || testId}/start`,
              { isReattempt },
              { signal: controller.signal },
            );
            attemptData = attemptResponse.data?.data;
          }

          if (attemptData?.attemptId) {
            setAttemptId(attemptData.attemptId);
            questionStartTimeRef.current = Date.now();

            // Resume previous progress from autosave only if NOT a reattempt
            if (!isReattempt) {
              if (attemptData.serverEndTime) {
                const endMs = new Date(attemptData.serverEndTime).getTime();
                const remainingFromEnd = Math.max(
                  0,
                  Math.ceil((endMs - Date.now()) / 1000),
                );
                setTimeLeft(remainingFromEnd);
                endTimeRef.current = endMs;
              } else if (attemptData.timeSpent > 0) {
                const calculatedLeft = Math.max(
                  1,
                  (testData.duration || 60) * 60 - attemptData.timeSpent,
                );
                setTimeLeft(calculatedLeft);
                endTimeRef.current = Date.now() + calculatedLeft * 1000;
              }
              if (attemptData.answers && attemptData.answers.length > 0) {
                const restoredAnswers = {};
                const visited = new Set([0]);
                attemptData.answers.forEach((a) => {
                  restoredAnswers[a.questionIndex] = a.selectedOption;
                  visited.add(a.questionIndex);
                });
                setAnswers(restoredAnswers);
                setVisitedQuestions(visited);
              }
              if (
                attemptData.markedForReview &&
                attemptData.markedForReview.length > 0
              ) {
                setMarkedForReview(new Set(attemptData.markedForReview));
              }
              if (attemptData.currentSection) {
                setCurrentSection(attemptData.currentSection);
              }

              // Offline fallback: hydrate from a local buffer when it is newer
              // than the server's last autosave, or when the server has no
              // answers at all. We compare `savedAt` timestamps so answers typed
              // after the last server autosave are never lost. If the server
              // exposes no timestamp, the original behaviour is preserved
              // (server wins only when it actually has answers).
              const localBuffer = readLocalAnswers(testId);
              if (localBuffer) {
                const serverHasAnswers =
                  attemptData.answers && attemptData.answers.length > 0;
                const serverHasReview =
                  attemptData.markedForReview &&
                  attemptData.markedForReview.length > 0;
                const serverSavedAt =
                  attemptData.savedAt ||
                  attemptData.updatedAt ||
                  attemptData.lastSavedAt ||
                  null;
                const localSavedAt = localBuffer.savedAt || null;
                let localIsNewer;
                if (serverSavedAt !== null && localSavedAt !== null) {
                  localIsNewer = localSavedAt >= serverSavedAt;
                } else {
                  // No server timestamp to compare against: only treat the local
                  // buffer as authoritative when the server has nothing saved.
                  localIsNewer = !serverHasAnswers && localSavedAt !== null;
                }

                if (
                  localBuffer.answers &&
                  Object.keys(localBuffer.answers).length > 0 &&
                  (!serverHasAnswers || localIsNewer)
                ) {
                  const restoredAnswers = {};
                  const visited = new Set([0]);
                  Object.entries(localBuffer.answers).forEach(
                    ([idx, selectedOption]) => {
                      restoredAnswers[idx] = selectedOption;
                      visited.add(Number(idx));
                    },
                  );
                  setAnswers(restoredAnswers);
                  setVisitedQuestions(visited);
                }
                if (
                  Array.isArray(localBuffer.markedForReview) &&
                  localBuffer.markedForReview.length > 0 &&
                  (!serverHasReview || localIsNewer)
                ) {
                  setMarkedForReview(new Set(localBuffer.markedForReview));
                }
                if (
                  localBuffer.currentSection &&
                  (!attemptData.currentSection || localIsNewer)
                ) {
                  setCurrentSection(localBuffer.currentSection);
                }
              }
            }
            if (
              attemptData.sectionTimers &&
              typeof attemptData.sectionTimers === "object"
            ) {
              setSectionTimers(attemptData.sectionTimers);
            }
          }
        }
      } catch (error) {
        if (isCancel(error)) return;
        // The shared-config apiClient interceptor maps all HTTP error responses to
        // typed error classes (AuthenticationError, ValidationError, etc.). The
        // original axios response object is NOT preserved — use error.status
        // (HTTP status code, added by our interceptor fix) and error.details
        // (the backend JSON body) for branching instead of error.response.*.
        const status = error?.status ?? error?.response?.status;
        const data = error?.details ?? error?.response?.data;

        // Track a general error state for non-auth failures (500, network, etc.)
        if (
          !(status === 401 || (status === 403 && data?.requiresAuth)) &&
          !(status === 403)
        ) {
          setIsError(true);
          setErrorMessage(
            data?.message || error?.message || "Failed to load test data",
          );
        }

        if (status === 401 || (status === 403 && data?.requiresAuth)) {
          // Session expired or unauthenticated — send to login with return path
          navigate("/login", {
            state: {
              from: `/${seriesId}/tests/${testId}`,
              message: data?.message || "Please login to access this test",
            },
          });
          return;
        }
        if (status === 403) {
          const msg = (data?.message || error?.message || "").toLowerCase();
          const isProRequired = Boolean(
            data?.requiresPro ||
            msg.includes("pro pass") ||
            msg.includes("pro required") ||
            msg.includes("upgrade to continue"),
          );
          if (isProRequired) {
            toast.error(
              "Pro Pass required for this test. Upgrade to continue.",
              { icon: "👑" },
            );
            navigate("/pass");
          } else if (data?.limitReached) {
            toast.error(data?.message || "Attempt limit reached");
            navigate("/pass");
          } else if (
            data?.code === "LIVE_TEST_NOT_STARTED" ||
            data?.code === "LIVE_TEST_EXPIRED"
          ) {
            setIsError(true);
            setErrorMessage(data.message);
          } else if (!user) {
            navigate("/login", {
              state: {
                from: `/${seriesId}/tests/${testId}`,
                message: data?.message || "Please login to access this test",
              },
            });
          } else {
            setIsError(true);
            setErrorMessage(data?.message || "Access denied for this test");
          }
          return;
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
  }, [
    testId,
    seriesId,
    navigate,
    reviewMode,
    reviewResultData,
    sectionalTimerParam,
  ]);

  // Timer
  // Uses an absolute deadline so background tab throttling / coalescing
  // never causes the countdown to drift longer than the configured duration.
  // timeLeft is derived from Date.now() each tick rather than decrementing
  // a mutable counter, so it stays accurate even when the tab is hidden.
  const endTimeRef = useRef(Date.now() + (test?.duration || 60) * 60 * 1000);
  useEffect(() => {
    endTimeRef.current = Date.now() + (test?.duration || 60) * 60 * 1000;
  }, [test?.duration]);

  useEffect(() => {
    if (
      reviewMode ||
      loading ||
      !test ||
      isPaused ||
      showPauseModal ||
      showSubmitSummary
    )
      return;

    // Re-sync absolute deadline upon resumption so elapsed pause/summary time is not counted
    endTimeRef.current = Date.now() + timeLeft * 1000;

    const tick = () => {
      const remaining = Math.max(0, endTimeRef.current - Date.now());
      setTimeLeft(Math.ceil(remaining / 1000));
    };

    tick(); // initial render
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [reviewMode, loading, test, isPaused, showPauseModal, showSubmitSummary]);

  // Auto-submit once the clock hits zero (cheap guard effect; runs on each tick
  // but does no work unless time has actually elapsed).
  useEffect(() => {
    if (
      timeLeft <= 0 &&
      !reviewMode &&
      !loading &&
      test &&
      !isPaused &&
      !showPauseModal &&
      !showSubmitSummary &&
      !isSubmitting
    ) {
      handleSubmit();
    }
  }, [
    timeLeft,
    reviewMode,
    loading,
    test,
    isPaused,
    showPauseModal,
    showSubmitSummary,
    isSubmitting,
    handleSubmit,
  ]);

  // Monitor section time limits
  useEffect(() => {
    if (
      reviewMode ||
      loading ||
      !test ||
      isPaused ||
      showPauseModal ||
      showSubmitSummary ||
      isSubmitting ||
      !currentSection
    )
      return;

    const remaining = getSectionTimeRemaining(currentSection);
    if (remaining !== null && remaining <= 0) {
      toast.error(
        `Time has expired for section "${currentSection}". Switching to the next section.`,
        { duration: 4000, icon: "⏱️" },
      );

      // Find the next section that is not expired
      const unexpiredSection = sections.find((sec) => {
        const rem = getSectionTimeRemaining(sec);
        return rem === null || rem > 0;
      });

      if (unexpiredSection) {
        changeSection(unexpiredSection);
      } else {
        toast.error("All section time limits have expired. Submitting test.", {
          duration: 4000,
        });
        handleSubmit();
      }
    }
  }, [
    timeLeft,
    currentSection,
    reviewMode,
    loading,
    test,
    isPaused,
    showPauseModal,
    showSubmitSummary,
    isSubmitting,
  ]);

  // Format time (mm:ss)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Auto-save progress
  // NOTE: Previously this effect listed `timeLeft` (which ticks every second)
  // and `answers`/`markedForReview`/`currentSection` in its deps, causing the
  // 30s setInterval to be torn down and recreated on every state change. That
  // meant the interval closure often captured stale values and the timer could
  // reset before firing. We now keep the latest mutable state in a ref and only
  // gate the effect on the flags that actually control whether autosave runs.
  const autosaveStateRef = useRef({});
  useEffect(() => {
    autosaveStateRef.current = {
      answers,
      markedForReview,
      timeLeft,
      test,
      questions,
      testId,
      attemptId,
      computeSectionTimers,
      currentSection,
    };
  });

  useEffect(() => {
    if (
      reviewMode ||
      !attemptId ||
      isSubmitting ||
      timeLeft <= 0 ||
      loading ||
      isPaused
    )
      return;

    const autosave = async () => {
      try {
        const s = autosaveStateRef.current;
        const currentAnswers = s.questions
          .map((question, index) => {
            const selectedOption = s.answers[index];
            if (selectedOption === undefined || selectedOption === null)
              return null;
            return {
              questionId: question.id || question._id,
              questionIndex: index,
              selectedOption,
            };
          })
          .filter(Boolean);

        // Persist to a local offline buffer first so answers are never lost
        // even if the network call below fails (e.g. offline / tab closing).
        const localAnswersMap = {};
        Object.entries(s.answers).forEach(([idx, selectedOption]) => {
          if (selectedOption !== undefined && selectedOption !== null) {
            localAnswersMap[idx] = selectedOption;
          }
        });
        persistLocalAnswers(s.testId, {
          answers: localAnswersMap,
          markedForReview: Array.from(s.markedForReview),
          currentSection: s.currentSection,
        });

        let actualTestId = s.test?.id || s.test?._id || s.testId;
        if (typeof actualTestId === "string" && actualTestId.includes("-")) {
          if (typeof s.test?.id === "number") actualTestId = s.test.id;
          else if (typeof s.test?._id === "number") actualTestId = s.test._id;
        }

        await apiClient.put(`/api/tests/${actualTestId}/autosave`, {
          attemptId: s.attemptId,
          timeSpent: (s.test?.duration || 60) * 60 - s.timeLeft,
          answers: currentAnswers,
          markedForReview: Array.from(s.markedForReview),
          sectionTimers: s.computeSectionTimers(),
          currentSection: s.currentSection,
        });
      } catch {
        // autosave failed silently — local buffer still holds the latest answers
      }
    };

    const interval = setInterval(autosave, 30000); // autosave every 30 seconds

    // Flush the offline buffer to the server as soon as connectivity returns.
    const handleOnline = () => {
      autosave();
    };
    window.addEventListener("online", handleOnline);

    // Best-effort flush when the tab is hidden and immediate resync on visible
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        autosave();
      } else if (document.visibilityState === "visible") {
        if (endTimeRef.current) {
          const remaining = Math.max(
            0,
            Math.ceil((endTimeRef.current - Date.now()) / 1000),
          );
          setTimeLeft(remaining);
        }
      }
    };
    window.addEventListener("visibilitychange", handleVisibility);

    // Best-effort flush on tab close / unload. We persist to the local buffer
    // first, then fire a keepalive request so it survives the page teardown.
    const handleBeforeUnload = () => {
      try {
        const s = autosaveStateRef.current;
        const localAnswersMap = {};
        Object.entries(s.answers).forEach(([idx, selectedOption]) => {
          if (selectedOption !== undefined && selectedOption !== null) {
            localAnswersMap[idx] = selectedOption;
          }
        });
        persistLocalAnswers(s.testId, {
          answers: localAnswersMap,
          markedForReview: Array.from(s.markedForReview),
          currentSection: s.currentSection,
        });

        let actualTestId = s.test?.id || s.test?._id || s.testId;
        if (typeof actualTestId === "string" && actualTestId.includes("-")) {
          if (typeof s.test?.id === "number") actualTestId = s.test.id;
          else if (typeof s.test?._id === "number") actualTestId = s.test._id;
        }

        const unloadAnswers = s.questions
          .map((question, index) => {
            const selectedOption = s.answers[index];
            if (selectedOption === undefined || selectedOption === null)
              return null;
            return {
              questionId: question.id || question._id,
              questionIndex: index,
              selectedOption,
            };
          })
          .filter(Boolean);

        const payload = {
          attemptId: s.attemptId,
          timeSpent: (s.test?.duration || 60) * 60 - s.timeLeft,
          answers: unloadAnswers,
          markedForReview: Array.from(s.markedForReview),
          sectionTimers: s.computeSectionTimers(),
          currentSection: s.currentSection,
        };

        const headers = { "Content-Type": "application/json" };
        // httpOnly cookie auth: no Authorization header from JS storage — browser
        // sends httpOnly cookies automatically via credentials:'include' (keepalive).

        const autosaveEndpoint = `${API_BASE_URL || ""}/api/tests/${actualTestId}/autosave`;
        fetch(autosaveEndpoint, {
          method: "PUT",
          headers,
          body: JSON.stringify(payload),
          credentials: "include",
          keepalive: true,
        }).catch(() => {});
      } catch {
        // best-effort flush failed — local buffer already persisted above
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [reviewMode, attemptId, isSubmitting, timeLeft <= 0, loading, isPaused]);

  // Persist answers to the local offline buffer on every change (debounced),
  // independent of the 30s server autosave. This guarantees a crash, offline
  // event, or abrupt tab close *within* the 30s window still leaves a
  // recoverable local copy. The timeout is cleared on each change so we never
  // leak timers or trigger per-second re-renders.
  useEffect(() => {
    if (reviewMode || !testId) return;
    const t = setTimeout(() => {
      try {
        const localAnswersMap = {};
        Object.entries(answers).forEach(([idx, selectedOption]) => {
          if (selectedOption !== undefined && selectedOption !== null) {
            localAnswersMap[idx] = selectedOption;
          }
        });
        persistLocalAnswers(testId, {
          answers: localAnswersMap,
          markedForReview: Array.from(markedForReview),
          currentSection,
        });
      } catch {
        // storage unavailable — silently skip
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [answers, markedForReview, currentSection, testId, reviewMode]);

  // Question status
  const getQuestionStatus = (index) => {
    const isAnswered =
      answers[index] !== undefined &&
      answers[index] !== null &&
      answers[index] !== "";
    const isReview = markedForReview.has(index);
    const isVisited = visitedQuestions.has(index);
    const _isCurrent = currentQuestion === index;

    if (reviewMode) {
      if (!isAnswered) return isReview ? "p-skipped-review" : "p-skipped";
      const result = isReviewAnswerCorrect(questions[index], answers[index])
        ? "p-correct"
        : "p-wrong";
      return isReview ? `${result}-review` : result;
    }

    if (isAnswered && isReview) return "p-ans-review";
    if (isReview) return "p-review";
    if (isAnswered) return "p-answered";
    if (isVisited && !isAnswered) return "p-not-answered";
    return "p-not-visited";
  };

  // Track time spent on current question
  const trackQuestionTime = useCallback(() => {
    if (!questionStartTimeRef.current) return 0;
    const spent = Math.floor(
      (Date.now() - questionStartTimeRef.current) / 1000,
    );
    return spent;
  }, []);

  // Save question progress (uses autosave endpoint for consistent data format)
  const saveQuestionProgress = useCallback(
    async (questionIndex, _extraData = {}) => {
      if (reviewMode || !attemptId) return;

      try {
        let actualTestId = test?.id || test?._id || testId;
        if (typeof actualTestId === "string" && actualTestId.includes("-")) {
          if (typeof test?.id === "number") actualTestId = test.id;
          else if (typeof test?._id === "number") actualTestId = test._id;
        }

        const normalizedAnswers = Object.entries(answers).map(([qId, ans]) => ({
          questionId: questions[qId]?.id || questions[qId]?._id || qId,
          questionIndex: parseInt(qId),
          selectedOption: ans,
        }));

        await apiClient.put(`/api/tests/${actualTestId}/autosave`, {
          attemptId,
          answers: normalizedAnswers,
          timeSpent: (test.duration || 60) * 60 - timeLeft,
          markedForReview: Array.from(markedForReview),
          sectionTimers: computeSectionTimers(),
          sectionalTimerEnabled,
          currentSection,
        });
        lastSaveRef.current = Date.now();
      } catch {
        // autosave failed silently
      }
    },
    [
      attemptId,
      answers,
      timeLeft,
      test,
      testId,
      questions,
      markedForReview,
      computeSectionTimers,
      currentSection,
    ],
  );

  // Log anti-cheat event
  const logAntiCheatEvent = useCallback(
    async (eventType, data = {}) => {
      if (reviewMode || !attemptId) return;
      try {
        const q = questions[currentQuestion];
        const actualQuestionId = q?.id || q?._id || null;
        await apiClient.post(`/api/attempt/${attemptId}/event`, {
          eventType,
          questionId: actualQuestionId,
          eventData: { ...data, timestamp: Date.now() },
        });
      } catch {
        // anti-cheat event logging failed silently
      }
    },
    [attemptId, currentQuestion, questions, reviewMode],
  );

  // Handle pause
  const handlePause = useCallback(async () => {
    if (reviewMode || !attemptId) return;

    try {
      // Save current question time
      const currentQt = {
        questionId:
          questions[currentQuestion]?.id ||
          questions[currentQuestion]?._id ||
          currentQuestion,
        timeSpent: questionTimers[currentQuestion] || 0,
        timeSpentDelta: trackQuestionTime(),
        visits: questionTimers[`${currentQuestion}_visits`] || 0,
        newVisit: false,
      };

      await apiClient.post("/api/attempt/pause", {
        attemptId,
        remainingTime: timeLeft,
        currentQuestionIndex: currentQuestion,
        questionTimers: [currentQt],
      });

      setIsPaused(true);
      setShowPauseModal(true);
      questionStartTimeRef.current = null;
      await logAntiCheatEvent("pause", { timeLeft });
    } catch {
      // pause failed silently
    }
  }, [
    attemptId,
    timeLeft,
    currentQuestion,
    questions,
    questionTimers,
    trackQuestionTime,
    logAntiCheatEvent,
  ]);

  // Fullscreen helpers — must only be called from a real user gesture (button click).
  // Browsers block requestFullscreen() called outside a gesture handler; useEffect
  // dependency callbacks are async and do NOT count as user gestures.
  const requestFullscreenSafely = useCallback(() => {
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().catch(() => {
        toast("For best experience, use fullscreen mode", { icon: "ℹ️" });
      });
    }
  }, []);

  // Only exit fullscreen on unmount — no auto-enter on mount.
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Handle resume
  const handleResume = useCallback(async () => {
    if (reviewMode || !attemptId) return;

    try {
      const response = await apiClient.post("/api/attempt/resume", {
        attemptId,
      });
      const data = response.data?.data;

      if (data?.remainingTime) {
        setTimeLeft(data.remainingTime);
      }

      // Reset the start time reference BEFORE computing section timers,
      // so the paused wall-clock duration is NOT folded into active section timers
      questionStartTimeRef.current = Date.now();

      // Restore question timers from server
      if (data?.questionAttempts) {
        const restoredTimers = {};
        data.questionAttempts.forEach((qa) => {
          const questionIndex = questions.findIndex(
            (question) =>
              String(question.id || question._id) === String(qa.questionId),
          );
          if (questionIndex >= 0) {
            restoredTimers[questionIndex] = qa.timeSpentSeconds || 0;
          }
        });
        setQuestionTimers(restoredTimers);
        setSectionTimers(computeSectionTimers(restoredTimers));
      }

      setIsPaused(false);
      setShowPauseModal(false);
      await logAntiCheatEvent("resume", { pausedDuration: 0 });
      // Re-request fullscreen here: this callback fires from a button click
      // so it qualifies as a user gesture — the browser will allow it.
      requestFullscreenSafely();
    } catch {
      // resume failed silently
    }
  }, [
    attemptId,
    logAntiCheatEvent,
    questions,
    computeSectionTimers,
    requestFullscreenSafely,
  ]);

  // Refs to share active state values dynamically with the Telemetry singleton without triggering re-renders
  const currentQuestionRef = useRef(currentQuestion);
  const timeLeftRef = useRef(timeLeft);
  const questionsRef = useRef(questions);

  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  // Initialize central Telemetry SDK
  useEffect(() => {
    if (reviewMode || !attemptId || !test || isPaused || showSubmitSummary)
      return;

    Telemetry.start({
      attemptId,
      testId: test._id || test.id,
      getCurrentQuestion: () => {
        const qIdx = currentQuestionRef.current;
        const qList = questionsRef.current;
        return qList[qIdx]?.id || qList[qIdx]?._id || null;
      },
      getTimeLeft: () => timeLeftRef.current,
      onViolation: (type, e) => {
        if (type === "tab_switch") {
          tabSwitchCountRef.current += 1;
          toast.error(
            `Tab switching detected (${tabSwitchCountRef.current}). This may disqualify your attempt.`,
            { duration: 4000, icon: "⚠️" },
          );
        } else if (type === "fullscreen_exit") {
          toast.error("Please return to fullscreen mode", { icon: "⚠️" });
        } else if (type === "copy" || type === "cut" || type === "paste") {
          if (e) e.preventDefault();
          toast.error("Copy/Paste is not allowed during the test", {
            icon: "⚠️",
          });
        } else if (type === "context_menu") {
          if (e) e.preventDefault();
        } else if (type === "attempt_revoked") {
          toast.error(
            `Test attempt has been ${e?.status || "revoked"}. Redirecting...`,
            { duration: 5000, icon: "❌" },
          );
          setTimeout(() => {
            navigate(`/test-series/${test?.seriesId || test?.series_id || ""}`);
          }, 3000);
        }
      },
    });

    return () => {
      Telemetry.stop();
    };
  }, [attemptId, test, reviewMode, isPaused]);

  // Lock background scrolling while the pause modal is open
  useEffect(() => {
    if (showPauseModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [showPauseModal]);

  useEffect(() => {
    if (showSubmitSummary) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [showSubmitSummary]);

  // A11y: move focus into the pause modal on open, restore it to the trigger on close.
  useEffect(() => {
    if (!showPauseModal) return;
    const prev = document.activeElement;
    const node = pauseDialogRef.current;
    if (node) {
      const focusable = node.querySelector(
        'input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (focusable || node).focus();
    }
    return () => {
      if (prev && typeof prev.focus === "function") prev.focus();
    };
  }, [showPauseModal]);

  // A11y: move focus into the submit summary modal on open, restore it on close.
  useEffect(() => {
    if (!showSubmitSummary) return;
    const prev = document.activeElement;
    const node = submitDialogRef.current;
    if (node) {
      const focusable = node.querySelector(
        'input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (focusable || node).focus();
    }
    return () => {
      if (prev && typeof prev.focus === "function") prev.focus();
    };
  }, [showSubmitSummary]);

  // Keyboard shortcuts for power users (1-4 to select options, arrows to
  // navigate, M to mark for review, C to clear, Ctrl+Enter for next).
  // Disabled during review mode, while paused, or when an input/textarea has focus.
  // M29: the listener is attached once per *flag* change only. The latest
  // handler (which closes over current `questions`/`currentQuestion`) is read
  // through `keyHandlerRef`, so we never re-create the listener on every
  // question change.
  const keyHandlerRef = useRef(null);
  keyHandlerRef.current = (e) => {
    const tag = e.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable)
      return;

    const currentQ = questions[currentQuestion];
    if (!currentQ) return;

    // 1-4 / 1-6: select option by index
    if (/^[1-9]$/.test(e.key)) {
      const idx = parseInt(e.key) - 1;
      const opts = currentQ.options;
      const optCount = Array.isArray(opts)
        ? opts.length
        : typeof opts === "object"
          ? Object.keys(opts).length
          : 0;
      if (idx < optCount) {
        e.preventDefault();
        handleAnswer(idx);
      }
      return;
    }

    // ArrowLeft/ArrowRight: navigate questions
    if (e.key === "ArrowRight" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      nextQuestion();
      return;
    }
    if (e.key === "ArrowLeft" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      prevQuestion();
      return;
    }

    // M: toggle mark for review
    if (e.key.toLowerCase() === "m" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      toggleReview();
      return;
    }

    // C: clear response
    if (e.key.toLowerCase() === "c" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      clearResponse();
      return;
    }

    // Ctrl/Cmd + Enter: next question
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      nextQuestion();
      return;
    }

    // Ctrl/Cmd + Shift + Enter: submit
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Enter") {
      e.preventDefault();
      confirmSubmit();
      return;
    }
  };

  useEffect(() => {
    if (
      reviewMode ||
      loading ||
      isPaused ||
      showPauseModal ||
      showSubmitSummary
    )
      return;

    const listener = (e) => keyHandlerRef.current?.(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [reviewMode, loading, isPaused, showPauseModal, showSubmitSummary]);

  // Track question time when changing questions
  useEffect(() => {
    if (reviewMode || loading || isPaused || questions.length === 0) return;

    // Save previous question time
    const savePrevQuestionTime = async () => {
      if (questionStartTimeRef.current && currentQuestion > 0) {
        const timeSpent = Math.floor(
          (Date.now() - questionStartTimeRef.current) / 1000,
        );
        setQuestionTimers((prev) => ({
          ...prev,
          [currentQuestion]: (prev[currentQuestion] || 0) + timeSpent,
        }));

        // Save to server
        await saveQuestionProgress(currentQuestion - 1);
      }
    };

    savePrevQuestionTime();
    questionStartTimeRef.current = Date.now();

    // Increment visit count for new question
    setQuestionTimers((prev) => ({
      ...prev,
      [`${currentQuestion}_visits`]:
        (prev[`${currentQuestion}_visits`] || 0) + 1,
    }));

    // Log question change
    logAntiCheatEvent("question_change", {
      from: currentQuestion - 1,
      to: currentQuestion,
    });
  }, [currentQuestion]);

  // Removed: duplicate 10s save interval (was writing to /api/attempt/save-progress)
  // Autosave via PUT /api/tests/:id/autosave handles all persistence

  // Navigation
  const goToQuestion = (index) => {
    const targetSection = questions[index]?.section || "General";
    const targetRemaining = getSectionTimeRemaining(targetSection);
    if (targetRemaining !== null && targetRemaining <= 0) {
      toast.error(`The section "${targetSection}" has expired.`);
      return;
    }

    // Save time spent on current question
    if (questionStartTimeRef.current) {
      const spent = Math.floor(
        (Date.now() - questionStartTimeRef.current) / 1000,
      );
      setQuestionTimers((prev) => ({
        ...prev,
        [currentQuestion]: (prev[currentQuestion] || 0) + spent,
      }));
      setSectionTimers((prev) => ({
        ...prev,
        [questions[currentQuestion]?.section || "General"]:
          (prev[questions[currentQuestion]?.section || "General"] || 0) + spent,
      }));
    }

    setCurrentQuestion(index);
    setVisitedQuestions((prev) => new Set([...prev, index]));
    setShowPalette(false);

    // Reset start time for new question
    questionStartTimeRef.current = Date.now();

    // Update section if needed
    if (targetSection !== currentSection) {
      setCurrentSection(targetSection);
    }
  };

  const changeSection = (section) => {
    const targetRemaining = getSectionTimeRemaining(section);
    if (targetRemaining !== null && targetRemaining <= 0) {
      toast.error(`The section "${section}" has expired.`);
      return;
    }
    setCurrentSection(section);
    // Find first question of this section
    const firstIdx = questions.findIndex((q) => q.section === section);
    if (firstIdx !== -1) {
      goToQuestion(firstIdx);
    }
  };

  // Stats calculation
  const stats = {
    answered: Object.keys(answers).length,
    notAnswered: visitedQuestions.size - Object.keys(answers).length,
    notVisited: questions.length - visitedQuestions.size,
    review: markedForReview.size,
  };

  const getSectionTimeRemaining = (section) => {
    if (reviewMode) return null;
    const limit = test?.sectionTimeLimits?.[section];
    if (!limit) return null;
    let spent = sectionTimers[section] || 0;
    if (section === currentSection && questionStartTimeRef.current) {
      spent += Math.floor((Date.now() - questionStartTimeRef.current) / 1000);
    }
    return Math.max(0, limit - spent);
  };

  const getSectionTimeColor = (remaining) => {
    if (remaining > 300)
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800";
    if (remaining > 120)
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
    return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800";
  };

  const formatSectionTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const totalReviewTime =
    reviewResultData?.timeSpent ||
    reviewResultData?.timeTaken ||
    (test?.duration ? test.duration * 60 : 0);
  const reviewCurrentResponse = reviewComparisons[currentQuestion];

  // Handlers
  const handleAnswer = (optionIndex) => {
    if (reviewMode) {
      if (!interactiveReviewEnabled) return;
      setReviewComparisons((prev) => ({
        ...prev,
        [currentQuestion]: optionIndex,
      }));
      return;
    }
    setAnswers((prev) => ({ ...prev, [currentQuestion]: optionIndex }));
  };

  const toggleReview = () => {
    if (reviewMode) return;
    setMarkedForReview((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(currentQuestion)) {
        newSet.delete(currentQuestion);
      } else {
        newSet.add(currentQuestion);
      }
      return newSet;
    });
  };

  const clearResponse = () => {
    if (reviewMode) return;
    setAnswers((prev) => {
      const newAnswers = { ...prev };
      delete newAnswers[currentQuestion];
      return newAnswers;
    });
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      goToQuestion(currentQuestion + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      goToQuestion(currentQuestion - 1);
    }
  };

  const confirmSubmit = () => {
    if (reviewMode) return;
    // Save current active question time so far
    if (questionStartTimeRef.current) {
      const spent = Math.floor(
        (Date.now() - questionStartTimeRef.current) / 1000,
      );
      setQuestionTimers((prev) => ({
        ...prev,
        [currentQuestion]: (prev[currentQuestion] || 0) + spent,
      }));
      setSectionTimers((prev) => ({
        ...prev,
        [questions[currentQuestion]?.section || "General"]:
          (prev[questions[currentQuestion]?.section || "General"] || 0) + spent,
      }));
      questionStartTimeRef.current = null;
    }
    // Freeze the exact time spent when submit is initiated
    submitFrozenTimeSpentRef.current = Math.max(
      0,
      (test?.duration || 60) * 60 - timeLeft,
    );
    setShowSubmitSummary(true);
  };

  async function handleSubmit() {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const submittedAnswers = questions
        .map((question, index) => {
          const selectedOption = answers[index];
          if (selectedOption === undefined || selectedOption === null) {
            return null;
          }

          return {
            questionId: question.id || question._id,
            questionIndex: index,
            selectedOption,
          };
        })
        .filter(Boolean);

      // Use test.id or test._id (actual database ID) instead of URL param testId
      // The URL param testId might be a slug or different identifier
      let actualTestId = test.id || test._id || testId;

      // If testId looks like a string/UUID but we have a numeric ID, use the numeric one
      // PostgreSQL findById only works with numeric IDs
      if (typeof actualTestId === "string" && actualTestId.includes("-")) {
        // This looks like a UUID or slug, try to get numeric ID from test object
        if (typeof test.id === "number") {
          actualTestId = test.id;
        } else if (typeof test._id === "number") {
          actualTestId = test._id;
        }
      }

      const sectionTimersData = computeSectionTimers();
      const sumSectionTime = Object.values(sectionTimersData).reduce(
        (sum, t) => sum + (Number(t) || 0),
        0,
      );
      const calculatedTimeSpent =
        sumSectionTime > 0
          ? sumSectionTime
          : submitFrozenTimeSpentRef.current !== null
            ? submitFrozenTimeSpentRef.current
            : Math.max(0, (test?.duration || 60) * 60 - timeLeft);

      const response = await apiClient.put(
        `/api/tests/${actualTestId}/submit`,
        {
          attemptId,
          timeSpent: calculatedTimeSpent,
          answers: submittedAnswers,
          markedForReview: Array.from(markedForReview),
          sectionTimers: sectionTimersData,
          currentSection,
          disableNegativeMarking,
        },
      );

      // Refresh user data to update attemptedTestsIds
      if (refreshUser) {
        await refreshUser();
      }

      // Clear client-side dashboard cache & invalidate queries so dashboard, test series, and analytics update immediately
      clearDashboardCache();
      queryClient.invalidateQueries({ queryKey: ["user-attempts"] });
      queryClient.invalidateQueries({ queryKey: ["user-incomplete-attempts"] });
      queryClient.invalidateQueries({ queryKey: ["user-attempts-live"] });
      queryClient.invalidateQueries({ queryKey: ["user-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] });
      queryClient.invalidateQueries({ queryKey: ["intelligence-performance"] });
      queryClient.invalidateQueries({ queryKey: ["intelligence-weak-topics"] });
      queryClient.invalidateQueries({
        queryKey: ["intelligence-recommendations"],
      });
      queryClient.invalidateQueries({ queryKey: ["intelligence-streak"] });
      queryClient.invalidateQueries({ queryKey: ["practice-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
      queryClient.invalidateQueries({ queryKey: ["attempted-tests"] });

      // Report adaptive difficulty for each answered question (fire-and-forget)
      submittedAnswers.forEach(({ questionId, selectedOption }) => {
        const question = questions.find((q) => (q.id || q._id) === questionId);
        const topicId = question?.topicId || question?.topic_id;
        if (topicId) {
          const correctOption =
            question.correct_option ??
            question.correctOption ??
            question.correct_answer;
          const isCorrect = selectedOption === Number(correctOption);
          const timeSpent = questionTimers[questions.indexOf(question)] || 0;
          submitPerformance(isCorrect, timeSpent).catch(() => {});
        }
      });

      // Clear the local offline buffer now that the server has the submission.
      clearLocalAnswers(testId);

      const submittedAttemptId = response.data?.data?.attemptId || attemptId;
      const targetSeriesSlug = test?.seriesSlug || seriesId || "ssc-cgl-2026";
      const targetTestId = test?.id || test?._id || testId;
      navigate(`/${targetSeriesSlug}/tests/${targetTestId}/result`, {
        state: { attemptId: submittedAttemptId },
      });
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          "Failed to submit test. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // Loading state — seamless dark transition that blends with the countdown overlay
  if (loading)
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm w-full animate-fade-in">
          <div className="relative inline-flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <div className="absolute w-8 h-8 rounded-full bg-indigo-500/20 animate-ping" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white tracking-wide">
              {reviewMode
                ? "Loading Test Review..."
                : "Preparing Assessment..."}
            </h3>
            <p className="text-xs text-slate-400">
              {reviewMode
                ? "Fetching your submitted solutions"
                : "Loading questions, sections & timer"}
            </p>
          </div>
        </div>
      </div>
    );

  if (isError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 max-w-md w-full text-center shadow-lg">
          <div className="text-red-600 dark:text-red-400 mb-4" role="alert">
            <AlertCircle className="w-8 h-8 mr-2" />
            <span>{errorMessage}</span>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            An error occurred while loading the test.
          </p>
          <button
            onClick={() => setIsError(false)}
            className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-500 transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!test) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Test Not Found
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            The test you're looking for doesn't exist.
          </p>
          <button
            onClick={() => navigate("/test-series")}
            className="text-brand-start hover:underline"
          >
            Back to Test Series
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            No Questions Available
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            This test doesn't have any questions yet.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="text-brand-start hover:underline"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];
  const questionImageUrl =
    currentQ?.image ||
    currentQ?.imageUrl ||
    currentQ?.questionImageUrl ||
    currentQ?.image_url ||
    null;
  const currentSectionIndexes = questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => question.section === currentSection);
  const currentSectionStats = currentSectionIndexes.reduce(
    (acc, { index }) => {
      const status = getQuestionStatus(index);
      acc.total += 1;
      if (status === "p-answered") acc.answered += 1;
      else if (status === "p-not-answered") acc.notAnswered += 1;
      else if (status === "p-review") acc.review += 1;
      else if (status === "p-ans-review") acc.answeredReview += 1;
      else acc.notVisited += 1;
      return acc;
    },
    {
      total: 0,
      answered: 0,
      notAnswered: 0,
      notVisited: 0,
      review: 0,
      answeredReview: 0,
    },
  );
  const userName = user?.name || user?.fullName || "Student";
  const userIdentifier = user?.studentId || user?.id || user?._id || "";
  const userInitials =
    userName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "ST";
  return (
    <div className="h-[100dvh] md:overflow-hidden flex flex-col md:flex-row bg-gray-50 dark:bg-gray-900 test-interface overscroll-none overscroll-y-none touch-pan-y">
      <Helmet>
        <title>{test?.title || "Test"} | Trstprep</title>
        <meta name="description" content="Taking test on Trstprep." />
        <meta
          property="og:title"
          content={`${test?.title || "Test"} | Trstprep`}
        />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* Left Column: Header + Main */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
        <TestTimerHeader
          test={test}
          reviewMode={reviewMode}
          seriesId={seriesId}
          testId={testId}
          location={location}
          navigate={navigate}
          timeLeft={timeLeft}
          isPaused={isPaused}
          handleResume={handleResume}
          handlePause={handlePause}
          language={language}
          setLanguage={setLanguage}
          requestFullscreenSafely={requestFullscreenSafely}
          showPalette={showPalette}
          setShowPalette={setShowPalette}
          showPauseModal={showPauseModal}
          pauseDialogRef={pauseDialogRef}
          answers={answers}
          questions={questions}
          formatTime={formatTime}
        />

        {/* Main Question Area */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-gray-50 dark:bg-gray-900">
          {/* Scrollable Content */}
          <div className="flex-1 p-3 pb-24 md:pb-3 scroll-smooth overflow-y-auto overscroll-contain">
            <div className="mx-auto flex flex-col min-h-full">
              {/* Section Tabs */}
              <SectionTabs
                sections={sections}
                currentSection={currentSection}
                changeSection={changeSection}
                getSectionTimeRemaining={getSectionTimeRemaining}
                getSectionTimeColor={getSectionTimeColor}
                formatSectionTime={formatSectionTime}
              />

              {/* Question Card */}
              <QuestionViewer
                currentQ={currentQ}
                currentQuestion={currentQuestion}
                adaptiveLevel={adaptiveLevel}
                adaptiveScore={adaptiveScore}
                test={test}
                reviewMode={reviewMode}
                interactiveReviewEnabled={interactiveReviewEnabled}
                reviewCurrentResponse={reviewCurrentResponse}
                totalReviewTime={totalReviewTime}
                questionTimers={questionTimers}
                isPaused={isPaused}
                questionStartTimeRef={questionStartTimeRef}
                formatTime={formatTime}
                setShowDiscussions={setShowDiscussions}
                toggleSaveQuestion={toggleSaveQuestion}
                savedQuestions={savedQuestions}
                questionImageUrl={questionImageUrl}
                setShowImageZoom={setShowImageZoom}
                language={language}
                answers={answers}
                handleAnswer={handleAnswer}
                resolveCorrectIndex={resolveCorrectIndex}
                showReviewExplanation={showReviewExplanation}
                setShowReviewExplanation={setShowReviewExplanation}
              />
            </div>
          </div>

          {/* Combined Navigation Footer */}
          <TestBottomBar
            prevQuestion={prevQuestion}
            nextQuestion={nextQuestion}
            currentQuestion={currentQuestion}
            questionsLength={questions.length}
            reviewMode={reviewMode}
            toggleReview={toggleReview}
            markedForReview={markedForReview}
            clearResponse={clearResponse}
            answers={answers}
          />
        </main>
      </div>

      {/* Question Palette - Sidebar */}
      <QuestionPalette
        showPalette={showPalette}
        setShowPalette={setShowPalette}
        user={user}
        userName={userName}
        userInitials={userInitials}
        userEmail={user?.email || ""}
        stats={stats}
        currentSectionStats={currentSectionStats}
        currentSection={currentSection}
        sections={sections}
        changeSection={changeSection}
        getSectionTimeRemaining={getSectionTimeRemaining}
        getSectionTimeColor={getSectionTimeColor}
        formatSectionTime={formatSectionTime}
        currentSectionIndexes={currentSectionIndexes}
        getQuestionStatus={getQuestionStatus}
        questions={questions}
        currentQuestion={currentQuestion}
        goToQuestion={goToQuestion}
        reviewMode={reviewMode}
        confirmSubmit={confirmSubmit}
        isSubmitting={isSubmitting}
        navigate={navigate}
        seriesId={seriesId}
        testId={testId}
        location={location}
      />

      {/* Submit Summary Modal */}
      <SubmitSummaryModal
        isOpen={showSubmitSummary}
        onClose={() => {
          submitFrozenTimeSpentRef.current = null;
          setShowSubmitSummary(false);
          questionStartTimeRef.current = Date.now();
        }}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        testTitle={test?.title || "Test Paper"}
        testDuration={test?.duration || 60}
        timeLeft={timeLeft}
        questions={questions}
        sections={sections}
        answers={answers}
        markedForReview={markedForReview}
        visitedQuestions={visitedQuestions}
        sectionTimers={computeSectionTimers()}
        dialogRef={submitDialogRef}
      />

      {/* Question Notes Panel */}
      <Suspense fallback={null}>
        <QuestionNotes
          isOpen={showNotes}
          onClose={() => setShowNotes(false)}
          questionId={currentQ?.id || currentQ?._id || currentQuestion}
          contextId={testId}
        />
      </Suspense>

      {/* Question Discussions Panel (Review mode only) */}
      {reviewMode && (
        <Suspense fallback={null}>
          <QuestionDiscussions
            isOpen={showDiscussions}
            onClose={() => setShowDiscussions(false)}
            questionId={currentQ?.id || currentQ?._id || currentQuestion}
            contextId={testId}
          />
        </Suspense>
      )}

      {/* Image zoom overlay */}
      <ImageZoomModal
        isOpen={showImageZoom && Boolean(questionImageUrl)}
        imageUrl={questionImageUrl}
        questionNumber={currentQuestion + 1}
        onClose={() => setShowImageZoom(false)}
      />
    </div>
  );
}

export default TestInterface;
