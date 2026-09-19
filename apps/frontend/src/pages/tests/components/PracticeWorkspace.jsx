import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-hot-toast";
import { practiceAPI } from "../../../shared/lib/practiceAPI";
import sanitizeHtml from "../../../shared/lib/sanitizeHtml.js";
import MathRenderer from "../../../shared/components/MathRenderer";
import KnowledgeVaultModal from "./KnowledgeVaultModal";
import { useAuth } from "../../../shared/providers/AuthContext";
import {
  CheckCircle,
  XCircle,
  Bookmark,
  MessageSquare,
  Sparkles,
  Layers,
  BookOpen,
  ThumbsUp,
  Plus,
  ArrowRight,
  Play,
  ArrowLeft,
  Languages,
  Globe,
  Menu,
  Tag,
  X,
  Maximize,
  Minimize,
  Clock,
} from "lucide-react";
import {
  formatTime,
  getEstimatedReadingSeconds,
  formatReadingTime,
} from "@trstprep/shared-config";
import { formatPyqSourceLabel } from "../../../shared/lib/questionUtils.js";
import { handleAvatarError } from "../../../shared/utils/avatarFallback.js";

export default function PracticeWorkspace({
  session,
  onComplete,
  onExit,
  onLaunchTopicSession,
}) {
  const [questionCache, setQuestionCache] = useState(() => {
    const map = {};
    if (Array.isArray(session?.questions)) {
      session.questions.forEach((q, i) => {
        if (
          typeof q === "object" &&
          q !== null &&
          (q.questionText || q.question_text || q.question || q.id)
        ) {
          map[i] = q;
        }
      });
    }
    return map;
  });

  const questionCacheRef = useRef(questionCache);
  questionCacheRef.current = questionCache;

  // Defensive: session rows may carry id, sessionId, or session_id depending
  // on the list source. Resolve once so no call-site can hit ".../undefined".
  const activeSessionId =
    session?.id ?? session?.sessionId ?? session?.session_id;

  const [currentIdx, setCurrentIdx] = useState(session?.currentIndex || 0);
  const [question, setQuestion] = useState(() => {
    const startIdx = session?.currentIndex || 0;
    return questionCache[startIdx] || null;
  });

  const [answerResults, setAnswerResults] = useState(() => {
    const initial = {};
    if (session?.answers && Array.isArray(session.answers)) {
      session.answers.forEach((ans) => {
        if (
          ans &&
          ans.index !== undefined &&
          !ans.isSkipped &&
          ans.selectedOption !== null &&
          ans.selectedOption !== undefined
        ) {
          initial[ans.index] = Boolean(ans.isCorrect);
        }
      });
    } else if (session?.answersMap && typeof session.answersMap === "object") {
      Object.entries(session.answersMap).forEach(([idx, ans]) => {
        if (
          ans &&
          !ans.isSkipped &&
          ans.selectedOption !== null &&
          ans.selectedOption !== undefined
        ) {
          initial[Number(idx)] = Boolean(ans.isCorrect);
        }
      });
    }
    try {
      const activeId = session?.id ?? session?.sessionId ?? session?.session_id;
      if (activeId) {
        const cached = localStorage.getItem(
          `practice_session_answers_${activeId}`,
        );
        if (cached) {
          const parsed = JSON.parse(cached);
          Object.assign(initial, parsed);
        }
      }
    } catch {}
    return initial;
  });

  const [userSelections, setUserSelections] = useState(() => {
    const initial = {};
    const processAns = (ans, idxKey) => {
      if (!ans) return;
      const idx = ans.index !== undefined ? ans.index : Number(idxKey);
      if (!Number.isNaN(idx)) {
        initial[idx] = {
          selectedOption: ans.selectedOption ?? null,
          isChecked:
            !ans.isSkipped &&
            ans.selectedOption !== null &&
            ans.selectedOption !== undefined,
          isSkipped: Boolean(ans.isSkipped),
          isCorrect: Boolean(ans.isCorrect),
          checkResult: {
            isCorrect: Boolean(ans.isCorrect),
            correctOption: ans.correctOption,
            explanation: ans.explanation,
            explanationHi: ans.explanationHi,
          },
        };
      }
    };
    if (session?.answers && Array.isArray(session.answers)) {
      session.answers.forEach((ans) => processAns(ans));
    } else if (session?.answersMap && typeof session.answersMap === "object") {
      Object.entries(session.answersMap).forEach(([idx, ans]) =>
        processAns(ans, idx),
      );
    }
    try {
      const activeId = session?.id ?? session?.sessionId ?? session?.session_id;
      if (activeId) {
        const cached = localStorage.getItem(
          `practice_session_selections_${activeId}`,
        );
        if (cached) {
          const parsed = JSON.parse(cached);
          Object.assign(initial, parsed);
        }
      }
    } catch {}
    return initial;
  });

  const userSelectionsRef = useRef(userSelections);
  userSelectionsRef.current = userSelections;

  const answerResultsRef = useRef(answerResults);
  answerResultsRef.current = answerResults;

  const [questionTimes, setQuestionTimes] = useState(() => {
    const initial = {};
    const processTime = (ans, idxKey) => {
      if (!ans) return;
      const idx = ans.index !== undefined ? ans.index : Number(idxKey);
      const t = ans.timeTaken ?? ans.time_taken_sec ?? ans.time_taken ?? 0;
      if (!Number.isNaN(idx) && t > 0) {
        initial[idx] = Number(t);
      }
    };
    if (session?.answers && Array.isArray(session.answers)) {
      session.answers.forEach((ans) => processTime(ans));
    } else if (session?.answersMap && typeof session.answersMap === "object") {
      Object.entries(session.answersMap).forEach(([idx, ans]) =>
        processTime(ans, idx),
      );
    }
    try {
      const activeId = session?.id ?? session?.sessionId ?? session?.session_id;
      if (activeId) {
        const cached = localStorage.getItem(
          `practice_session_times_${activeId}`,
        );
        if (cached) {
          const parsed = JSON.parse(cached);
          Object.assign(initial, parsed);
        }
      }
    } catch {}
    return initial;
  });

  const questionTimesRef = useRef(questionTimes);
  questionTimesRef.current = questionTimes;

  const [selectedOption, setSelectedOption] = useState(() => {
    const startIdx = session?.currentIndex || 0;
    return userSelections[startIdx]?.selectedOption ?? null;
  });
  const [isChecked, setIsChecked] = useState(() => {
    const startIdx = session?.currentIndex || 0;
    return Boolean(userSelections[startIdx]?.isChecked);
  });
  const [checkResult, setCheckResult] = useState(() => {
    const startIdx = session?.currentIndex || 0;
    return userSelections[startIdx]?.checkResult ?? null;
  });
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const loadIdRef = useRef(0);

  // Track active time spent per question (pauses when question is answered or during finish/loading)
  useEffect(() => {
    if (loading || finishing || isChecked) return;

    const timer = setInterval(() => {
      setQuestionTimes((prev) => {
        const current = prev[currentIdx] || 0;
        const updated = { ...prev, [currentIdx]: current + 1 };
        try {
          const activeId =
            session?.id ?? session?.sessionId ?? session?.session_id;
          if (activeId) {
            localStorage.setItem(
              `practice_session_times_${activeId}`,
              JSON.stringify(updated),
            );
          }
        } catch {}
        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [
    currentIdx,
    loading,
    finishing,
    isChecked,
    session?.id,
    session?.sessionId,
    session?.session_id,
  ]);

  // Learning System Tabs & Data
  const [activeExplTab, setActiveExplTab] = useState("text"); // text | visual | video | formula
  const [explanations, setExplanations] = useState(null);
  const [approaches, setApproaches] = useState([]);
  const [similarQs, setSimilarQs] = useState([]);
  const [aiTutorResponse, setAiTutorResponse] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Vault Modal
  const [vaultOpen, setVaultOpen] = useState(false);

  // Question language switch ("en" | "hi") — persistent across questions and sessions
  const [preferredLang, setPreferredLang] = useState(() => {
    try {
      return (
        localStorage.getItem("trstprep_practice_lang") ||
        (localStorage.getItem("test_language")?.toLowerCase() === "hi"
          ? "hi"
          : "en") ||
        "en"
      );
    } catch {
      return "en";
    }
  });

  const handleSetLang = (newLang) => {
    setPreferredLang(newLang);
    try {
      localStorage.setItem("trstprep_practice_lang", newLang);
    } catch {
      // ignore
    }
  };

  // Community Approach Submit state
  const [newApproachText, setNewApproachText] = useState("");
  const [newApproachType, setNewApproachType] = useState("fastest");
  const [showSubmitApproach, setShowSubmitApproach] = useState(false);
  const [isSubmittingApproach, setIsSubmittingApproach] = useState(false);
  const [showMobilePalette, setShowMobilePalette] = useState(false);

  // Fullscreen state & helpers (Matches Test Interface behavior)
  const [isFullscreen, setIsFullscreen] = useState(() => {
    return (
      typeof document !== "undefined" &&
      Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement,
      )
    );
  });

  // Set practice-session-active class on body/html so global top Navbar and mobile BottomNav are hidden (matching real test environment)
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.classList.add("practice-session-active");
      document.documentElement.classList.add("practice-session-active");
      try {
        window.dispatchEvent(
          new CustomEvent("trstprep:practice-mode-change", {
            detail: { active: true },
          }),
        );
      } catch {}
    }
    return () => {
      if (typeof document !== "undefined") {
        document.body.classList.remove("practice-session-active");
        document.documentElement.classList.remove("practice-session-active");
        try {
          window.dispatchEvent(
            new CustomEvent("trstprep:practice-mode-change", {
              detail: { active: false },
            }),
          );
        } catch {}
      }
    };
  }, []);

  const requestFullscreenSafely = useCallback(() => {
    try {
      const el = document.documentElement;
      const fn =
        el.requestFullscreen ||
        el.webkitRequestFullscreen ||
        el.mozRequestFullScreen ||
        el.msRequestFullscreen;
      const fsEl =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement;
      if (fn && !fsEl) {
        fn.call(el).catch(() => {});
      }
    } catch {
      // ignore
    }
  }, []);

  const exitFullscreenSafely = useCallback(() => {
    try {
      const fsEl =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement;
      const exitFn =
        document.exitFullscreen ||
        document.webkitExitFullscreen ||
        document.mozCancelFullScreen ||
        document.msExitFullscreen;
      if (fsEl && exitFn) {
        exitFn.call(document).catch(() => {});
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const fsEl =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement;
    if (fsEl) {
      exitFullscreenSafely();
    } else {
      requestFullscreenSafely();
    }
  }, [exitFullscreenSafely, requestFullscreenSafely]);

  // Attempt fullscreen on session workspace mount (mobile only), track fullscreen state, and cleanup on unmount
  useEffect(() => {
    const isMobile =
      typeof window !== "undefined" &&
      (window.innerWidth < 768 ||
        /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent || "",
        ));

    // Only auto-request fullscreen on mobile devices, not on PC / desktop
    if (isMobile) {
      requestFullscreenSafely();
    }

    // In case mobile browser requires a user gesture after async route transition,
    // fire on the very first touch/click anywhere
    const handleFirstGesture = () => {
      if (isMobile) {
        requestFullscreenSafely();
      }
    };
    if (isMobile) {
      window.addEventListener("click", handleFirstGesture, { capture: true });
      window.addEventListener("touchstart", handleFirstGesture, {
        capture: true,
      });
    }

    const handleFsChange = () => {
      const fsEl =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement;
      setIsFullscreen(Boolean(fsEl));
      if (fsEl && isMobile) {
        window.removeEventListener("click", handleFirstGesture, {
          capture: true,
        });
        window.removeEventListener("touchstart", handleFirstGesture, {
          capture: true,
        });
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    document.addEventListener("mozfullscreenchange", handleFsChange);
    document.addEventListener("MSFullscreenChange", handleFsChange);

    return () => {
      if (isMobile) {
        window.removeEventListener("click", handleFirstGesture, {
          capture: true,
        });
        window.removeEventListener("touchstart", handleFirstGesture, {
          capture: true,
        });
      }
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
      document.removeEventListener("mozfullscreenchange", handleFsChange);
      document.removeEventListener("MSFullscreenChange", handleFsChange);
      exitFullscreenSafely();
    };
  }, [requestFullscreenSafely, exitFullscreenSafely]);

  const handleExit = useCallback(() => {
    exitFullscreenSafely();
    if (onExit) onExit();
  }, [exitFullscreenSafely, onExit]);

  const { user } = useAuth();
  const userName = user?.name || user?.fullName || "Candidate";
  const userInitials = (user?.name || user?.fullName || "U")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const userEmail = user?.email || "";

  const totalQuestions = Number(
    session?.totalQuestions ?? session?.questions?.length ?? 0,
  );
  const answeredCount = Object.keys(answerResults).length;
  const correctCount = Object.values(answerResults).filter(Boolean).length;
  const incorrectCount = answeredCount - correctCount;
  const skippedCount = Object.values(userSelections).filter(
    (s) => s?.isSkipped,
  ).length;
  const notVisitedCount = Math.max(
    0,
    totalQuestions - answeredCount - skippedCount,
  );
  const accuracy =
    answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  useEffect(() => {
    loadQuestion(currentIdx);
  }, [currentIdx]);

  // Debounced autosave of the current index so a reload resumes at the
  // right question. Fires ~2s after the index settles.
  useEffect(() => {
    if (
      activeSessionId === undefined ||
      activeSessionId === null ||
      activeSessionId === ""
    ) {
      return;
    }
    const timer = setTimeout(() => {
      practiceAPI
        .patchSession(activeSessionId, { current_index: currentIdx })
        .catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [currentIdx, activeSessionId]);

  const loadQuestion = async (idx) => {
    const loadId = ++loadIdRef.current;
    try {
      if (
        activeSessionId === undefined ||
        activeSessionId === null ||
        activeSessionId === ""
      ) {
        throw new Error("Practice session ID is missing");
      }
      setAiTutorResponse(null);

      // Restore previously saved answer state if question was visited or answered
      const prev = userSelectionsRef.current[idx];
      if (prev && prev.isChecked) {
        setSelectedOption(prev.selectedOption ?? null);
        setIsChecked(true);
        setCheckResult(prev.checkResult ?? null);
      } else {
        setSelectedOption(prev?.selectedOption ?? null);
        setIsChecked(false);
        setCheckResult(null);
      }

      // Check if question is already available in cache for instant render
      let q = questionCacheRef.current[idx] || questionCache[idx];
      if (q) {
        if (loadId !== loadIdRef.current) return;
        setQuestion(q);
      } else {
        setLoading(true);
        q = await practiceAPI.getQuestion(activeSessionId, idx);
        if (loadId !== loadIdRef.current) return;
        setQuestion(q);
        const nextCache = { ...questionCacheRef.current, [idx]: q };
        questionCacheRef.current = nextCache;
        setQuestionCache(nextCache);
        setLoading(false);
      }

      // If question carried userAnswer from backend (e.g. after refresh or resuming) and local state didn't have it:
      if (!userSelectionsRef.current[idx] && q?.userAnswer) {
        const ua = q.userAnswer;
        const restored = {
          selectedOption: ua.selectedOption ?? null,
          isChecked:
            !ua.isSkipped &&
            ua.selectedOption !== null &&
            ua.selectedOption !== undefined,
          isSkipped: Boolean(ua.isSkipped),
          isCorrect: Boolean(ua.isCorrect),
          checkResult: {
            isCorrect: Boolean(ua.isCorrect),
            correctOption: ua.correctOption,
            explanation: ua.explanation,
            explanationHi: ua.explanationHi,
          },
        };
        userSelectionsRef.current = {
          ...userSelectionsRef.current,
          [idx]: restored,
        };
        setUserSelections((prev) => ({ ...prev, [idx]: restored }));
        if (restored.isChecked) {
          setSelectedOption(restored.selectedOption);
          setIsChecked(true);
          setCheckResult(restored.checkResult);
          const newAns = {
            ...answerResultsRef.current,
            [idx]: Boolean(ua.isCorrect),
          };
          answerResultsRef.current = newAns;
          setAnswerResults(newAns);
        }
      }

      // Fetch supplementary learning data asynchronously in the background
      if (q?.id) {
        const bgLoadId = loadId;
        Promise.all([
          practiceAPI.getExplanations(q.id).catch(() => null),
          practiceAPI.getApproaches(q.id).catch(() => []),
          practiceAPI.getSimilarQuestions(q.id).catch(() => []),
        ]).then(([expl, apprs, sim]) => {
          if (bgLoadId !== loadIdRef.current) return;
          setExplanations(expl);
          setApproaches(apprs || []);
          setSimilarQs(sim || []);
        });
      }
    } catch {
      if (loadId !== loadIdRef.current) return;
      toast.error("Failed to load question");
      setLoading(false);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentIdx > 0 && !loading && !finishing) {
      setCurrentIdx((prev) => prev - 1);
    }
  };

  const handleJumpToQuestion = (idx) => {
    if (idx === currentIdx || loading || finishing) return;
    if (idx >= 0 && idx < totalQuestions) {
      setCurrentIdx(idx);
    }
  };

  const handleSelectOption = async (optionIdx) => {
    if (isChecked || isChecking || finishing) return;
    setSelectedOption(optionIdx);

    try {
      if (
        activeSessionId === undefined ||
        activeSessionId === null ||
        activeSessionId === ""
      ) {
        throw new Error("Practice session ID is missing");
      }
      setIsChecking(true);
      const timeSpent =
        questionTimesRef.current[currentIdx] || questionTimes[currentIdx] || 0;
      const payload = {
        selectedOption: optionIdx,
        ...(timeSpent > 0 ? { time_taken_sec: timeSpent } : {}),
      };
      const res = await practiceAPI.checkAnswer(
        activeSessionId,
        currentIdx,
        payload,
      );
      setCheckResult(res);
      const newAnswerResults = {
        ...answerResultsRef.current,
        [currentIdx]: Boolean(res?.isCorrect),
      };
      answerResultsRef.current = newAnswerResults;
      setAnswerResults(newAnswerResults);

      const newSelection = {
        selectedOption: optionIdx,
        isChecked: true,
        checkResult: res,
        isCorrect: Boolean(res?.isCorrect),
        isSkipped: false,
      };
      const newUserSelections = {
        ...userSelectionsRef.current,
        [currentIdx]: newSelection,
      };
      userSelectionsRef.current = newUserSelections;
      setUserSelections(newUserSelections);
      setIsChecked(true);

      // Persist to localStorage for uninterrupted resumption
      try {
        if (activeSessionId) {
          localStorage.setItem(
            `practice_session_answers_${activeSessionId}`,
            JSON.stringify(newAnswerResults),
          );
          localStorage.setItem(
            `practice_session_selections_${activeSessionId}`,
            JSON.stringify(newUserSelections),
          );
        }
      } catch {}
    } catch {
      toast.error("Failed to check answer");
    } finally {
      setIsChecking(false);
    }
  };

  const handleCheckAnswer = async () => {
    if (selectedOption === null || selectedOption === undefined) return;
    await handleSelectOption(selectedOption);
  };

  const handleAskAiTutor = async (promptType) => {
    try {
      setAiLoading(true);
      const res = await practiceAPI.askAiTutor({
        questionId: question.id,
        promptType,
        userAnswer: selectedOption,
        language: preferredLang === "hi" ? "hi" : "en",
      });
      setAiTutorResponse(res?.response);
    } catch {
      toast.error("AI Tutor temporarily unavailable");
    } finally {
      setAiLoading(false);
    }
  };

  const handleUpvoteApproach = async (approachId) => {
    try {
      await practiceAPI.upvoteApproach(question.id, approachId);
      setApproaches((prev) =>
        prev.map((a) =>
          a.id === approachId ? { ...a, upvotes: (a.upvotes || 0) + 1 } : a,
        ),
      );
      toast.success("Upvoted solution approach!");
    } catch {
      // silent
    }
  };

  const handleSubmitApproach = async () => {
    if (!newApproachText.trim() || isSubmittingApproach) return;
    try {
      setIsSubmittingApproach(true);
      const newApp = await practiceAPI.submitApproach(question.id, {
        approachType: newApproachType,
        title: `${newApproachType.toUpperCase()} Method`,
        content: newApproachText,
      });
      setApproaches((prev) => [newApp, ...prev]);
      setNewApproachText("");
      setShowSubmitApproach(false);
      toast.success("Your approach has been shared with the community!");
    } catch {
      toast.error("Failed to submit approach");
    } finally {
      setIsSubmittingApproach(false);
    }
  };

  const handleFinishSession = async () => {
    if (finishing) return;

    try {
      if (
        activeSessionId === undefined ||
        activeSessionId === null ||
        activeSessionId === ""
      )
        throw new Error("Practice session ID is missing");
      setFinishing(true);
      const result = await practiceAPI.completeSession(activeSessionId);
      const completedSession = result?.session || {};
      const completedCorrect = Number(completedSession.correctCount || 0);
      const completedWrong = Number(completedSession.wrongCount || 0);
      const completedSkipped = Number(completedSession.skippedCount || 0);
      const completedTotal =
        completedCorrect + completedWrong + completedSkipped;
      const answered = completedCorrect + completedWrong;
      const timeSpent = Number(
        completedSession.timeSpentSec ??
          completedSession.timeSpent ??
          completedSession.timeTaken ??
          0,
      );
      // Topic mastery recomputed server-side on completion
      const masteryPercent =
        result?.mastery && typeof result.mastery === "object"
          ? (result.mastery.mastery ?? null)
          : null;

      exitFullscreenSafely();
      try {
        if (activeSessionId) {
          localStorage.removeItem(
            `practice_session_answers_${activeSessionId}`,
          );
          localStorage.removeItem(
            `practice_session_selections_${activeSessionId}`,
          );
          localStorage.removeItem(`practice_session_times_${activeSessionId}`);
        }
      } catch {}
      onComplete?.({
        ...result,
        questionsAttempted: completedTotal,
        correctCount: completedCorrect,
        wrongCount: completedWrong,
        skippedCount: completedSkipped,
        masteryPercent,
        accuracy:
          answered > 0 ? Math.round((completedCorrect / answered) * 100) : 0,
        avgTimeSeconds:
          completedTotal > 0 && timeSpent > 0
            ? Math.round(timeSpent / completedTotal)
            : 0,
        conceptsMastered: [],
        conceptsNeedsPractice: [],
      });
    } catch {
      toast.error("Failed to complete practice session. Please try again.");
    } finally {
      setFinishing(false);
    }
  };

  const handleNextQuestion = async () => {
    if (currentIdx + 1 < totalQuestions) {
      setCurrentIdx((prev) => prev + 1);
    } else {
      await handleFinishSession();
    }
  };

  const handleSkipQuestion = async () => {
    if (skipping || finishing) return;

    try {
      if (
        activeSessionId === undefined ||
        activeSessionId === null ||
        activeSessionId === ""
      )
        throw new Error("Practice session ID is missing");
      setSkipping(true);
      await practiceAPI.skipQuestion(activeSessionId, currentIdx);
      setUserSelections((prev) => ({
        ...prev,
        [currentIdx]: {
          selectedOption: null,
          isChecked: false,
          checkResult: null,
          isSkipped: true,
        },
      }));
      if (currentIdx + 1 < totalQuestions) {
        setCurrentIdx((prev) => prev + 1);
      } else {
        await handleFinishSession();
      }
    } catch {
      toast.error("Failed to skip question. Please try again.");
    } finally {
      setSkipping(false);
    }
  };

  if (!question) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // ── Language switch + PYQ source derivation ──────────────────────────
  const questionTextEn = question.questionText || question.question_text;
  const questionTextHi = question.questionTextHi || question.question_text_hi;
  const optionsHi = Array.isArray(question.optionsHi)
    ? question.optionsHi
    : Array.isArray(question.options_hi)
      ? question.options_hi
      : [];
  const explanationEn = question.explanation;
  const explanationHi = question.explanationHi || question.explanation_hi;
  const hasHindi =
    Boolean(questionTextHi) ||
    Boolean(explanationHi) ||
    optionsHi.some((o) => (typeof o === "object" && o !== null ? o.text : o));
  const isHi = preferredLang === "hi" && hasHindi;

  const qTags = Array.isArray(question.tags) ? question.tags : [];
  const pyqSource = question.sourceConfig || question.source_config || {};
  const isPyq =
    qTags.map((t) => String(t).toLowerCase()).includes("pyq") ||
    String(pyqSource.type || "")
      .toLowerCase()
      .includes("pyq") ||
    String(pyqSource.type || "")
      .toLowerCase()
      .includes("prev") ||
    String(question.source || "")
      .toLowerCase()
      .includes("pyq") ||
    Boolean(
      pyqSource.examName ||
      pyqSource.exam_name ||
      pyqSource.year ||
      pyqSource.shift ||
      pyqSource.paper,
    );
  const pyqLabel = isPyq
    ? formatPyqSourceLabel(question, pyqSource, question.source)
    : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-12">
      {/* ── 1. TOP STICKY APP BAR (Matches Test Interface on Mobile & Desktop) ── */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 px-2.5 sm:px-6 py-2 sm:py-2.5 shadow-xs mb-4 sm:mb-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-3">
          {/* Top Left: Back to Section Button */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {onExit && (
              <button
                type="button"
                onClick={handleExit}
                className="inline-flex items-center gap-1 sm:gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 border border-slate-200 dark:border-slate-600 px-2 sm:px-3 py-1.5 rounded-xl transition active:scale-95 shadow-2xs cursor-pointer shrink-0"
                title="Back to Section"
                aria-label="Back to Section"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>Back</span>
                <span className="hidden sm:inline">&nbsp;to Section</span>
              </button>
            )}
          </div>

          {/* Top Center: Question Counter & Accuracy */}
          <div className="flex items-center gap-1 sm:gap-2 text-xs font-bold shrink-0">
            <span className="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/60 px-2 sm:px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700 whitespace-nowrap">
              Q{currentIdx + 1} / {totalQuestions}
            </span>
            <span className="hidden sm:inline-flex text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 px-2 py-1 rounded-lg">
              {accuracy}% Acc
            </span>
          </div>

          {/* Top Right: Fullscreen, Language Switch Option (Click to Change) & Question Palette (Mobile) */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              aria-label={
                isFullscreen ? "Exit Fullscreen mode" : "Enter Fullscreen mode"
              }
              className="inline-flex items-center justify-center h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs shrink-0"
            >
              {isFullscreen ? (
                <Minimize className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 shrink-0" />
              ) : (
                <Maximize className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 shrink-0" />
              )}
            </button>

            {/* Language Switch: 1-Click Toggle EN ↔ HI (Shows language name only, no EN/HI badge) */}
            <button
              type="button"
              onClick={() => {
                const nextLang = preferredLang === "hi" ? "en" : "hi";
                handleSetLang(nextLang);
              }}
              title={`Switch language (Current: ${preferredLang === "hi" ? "हिन्दी" : "English"})`}
              aria-label={`Switch language. Current: ${preferredLang === "hi" ? "हिन्दी" : "English"}`}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs shrink-0"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>{preferredLang === "hi" ? "हिन्दी" : "English"}</span>
            </button>

            {/* Mobile Question Palette Toggle: Icon only on mobile (Never show Palette word) */}
            <button
              type="button"
              onClick={() => setShowMobilePalette(!showMobilePalette)}
              title="Question Palette"
              aria-label="Toggle Question Palette"
              className="lg:hidden inline-flex items-center justify-center h-8 w-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition active:scale-95 cursor-pointer shadow-2xs shrink-0"
            >
              <Menu className="w-4 h-4 text-slate-700 dark:text-slate-300 shrink-0" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-2 sm:py-4 px-3 sm:px-4">
        <div className="lg:grid lg:grid-cols-12 lg:gap-6 items-start">
          {/* Left Column: Context, Question Workspace, Learning System */}
          <div className="lg:col-span-8 xl:col-span-8 space-y-6">
            {/* ── 2. QUESTION WORKSPACE ──────────────────────────────────────── */}
            <div
              className={`bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6 shadow-xs mb-6 transition-opacity duration-150 ${loading ? "opacity-60 pointer-events-none" : "opacity-100"}`}
            >
              <div className="flex items-center justify-between gap-2 mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Question {currentIdx + 1}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 text-[11px] font-medium"
                    title="Estimated reading time"
                  >
                    <BookOpen className="w-3 h-3 text-slate-400 dark:text-slate-400" />
                    <span>
                      ~{formatReadingTime(getEstimatedReadingSeconds(question))}
                    </span>
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/40 text-[11px] font-medium"
                    title="Time spent on this question"
                  >
                    <Clock className="w-3 h-3 text-indigo-500" />
                    <span>{formatTime(questionTimes[currentIdx] || 0)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setVaultOpen(true)}
                    className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-slate-200 transition cursor-pointer"
                  >
                    <Bookmark className="w-3.5 h-3.5 mr-1 text-amber-500" />{" "}
                    Save to Knowledge Vault
                  </button>
                </div>
              </div>

              {/* Question Text (language-aware) with Q{currentIdx + 1}/{totalQuestions} before question */}
              <div
                className={`text-base font-medium text-slate-900 dark:text-slate-100 leading-relaxed ${
                  pyqLabel ? "mb-2.5" : "mb-6"
                }`}
              >
                <span className="font-bold text-indigo-600 dark:text-indigo-400 mr-2 select-none">
                  Q{currentIdx + 1}/{totalQuestions}.
                </span>
                <MathRenderer
                  content={
                    isHi && questionTextHi ? questionTextHi : questionTextEn
                  }
                />
              </div>

              {/* Previous-year paper source — exam name year stage date shift */}
              {pyqLabel && (
                <div className="mb-5 flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] italic text-slate-400 dark:text-slate-500">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50/70 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/40 text-[10px] sm:text-[11px] font-medium italic shadow-2xs">
                    <Tag className="w-3 h-3 text-purple-500/80 shrink-0" />
                    <span>{pyqLabel}</span>
                  </span>
                  <span className="text-[10px] sm:text-[10.5px] italic text-slate-400 dark:text-slate-500">
                    (Asked in previous year paper)
                  </span>
                </div>
              )}

              {/* Options — Instant Check on Click */}
              <div className="space-y-3 mb-6">
                {(question.options || []).map((opt, i) => {
                  const optKey = String.fromCharCode(65 + i);
                  const isSelected = selectedOption === i;
                  let style =
                    "border-slate-200 hover:border-slate-300 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 cursor-pointer";
                  if (isChecked) {
                    const value =
                      checkResult?.correctOption ?? checkResult?.correctAnswer;
                    const numeric = Number(value);
                    const isOptionCorrect =
                      (Number.isInteger(numeric) && numeric === i) ||
                      value === optKey ||
                      (typeof opt === "object" &&
                        opt !== null &&
                        (opt.text === value || opt.id === value)) ||
                      opt === value;

                    if (isOptionCorrect) {
                      style =
                        "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-medium";
                    } else if (isSelected && !checkResult?.isCorrect) {
                      style =
                        "border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 font-medium";
                    } else {
                      style =
                        "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 opacity-60";
                    }
                  } else if (isSelected) {
                    style =
                      "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-medium shadow-xs";
                  }

                  return (
                    <button
                      key={i}
                      disabled={isChecked || isChecking}
                      onClick={() => handleSelectOption(i)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-start ${style}`}
                    >
                      <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-bold mr-3 flex-shrink-0 mt-0.5">
                        {optKey}
                      </span>
                      <div className="text-sm">
                        <MathRenderer
                          content={(() => {
                            const en = typeof opt === "object" ? opt.text : opt;
                            if (!isHi) return en;
                            const hi = optionsHi[i];
                            const hiText =
                              typeof hi === "object" && hi !== null
                                ? hi.text
                                : hi;
                            return hiText || en;
                          })()}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Feedback Banner when checked */}
              {isChecked && (
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between mb-4 shadow-2xs ${
                    checkResult?.isCorrect
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                      : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {checkResult?.isCorrect ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    )}
                    <span className="font-bold text-sm">
                      {checkResult?.isCorrect
                        ? isHi
                          ? "सही उत्तर! (Correct)"
                          : "Correct Answer!"
                        : isHi
                          ? "गलत उत्तर (Incorrect)"
                          : "Incorrect"}
                    </span>
                  </div>
                  <span className="text-xs font-semibold">
                    {isHi ? "सही विकल्प:" : "Correct Choice:"} Option{" "}
                    {(() => {
                      const value =
                        checkResult?.correctOption ??
                        checkResult?.correctAnswer;
                      const numeric = Number(value);
                      return Number.isInteger(numeric) && numeric >= 0
                        ? String.fromCharCode(65 + numeric)
                        : value || (isHi ? "अनुपलब्ध" : "Unavailable");
                    })()}
                  </span>
                </div>
              )}

              {/* Navigation Bar (Prev and Next only, responsive) */}
              <div className="flex items-center justify-between gap-2.5 sm:gap-3 w-full mt-4">
                <button
                  type="button"
                  onClick={handlePreviousQuestion}
                  disabled={currentIdx === 0 || loading || finishing}
                  className="px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition inline-flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                  <span>Prev</span>
                </button>

                <button
                  type="button"
                  onClick={handleNextQuestion}
                  disabled={loading || finishing}
                  className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                >
                  <span>
                    {currentIdx + 1 >= totalQuestions
                      ? "Finish Practice"
                      : "Next"}
                  </span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              </div>
            </div>

            {/* ── 3. POST-CHECK LEARNING SYSTEM ────────────────────────────────── */}
            {isChecked && (
              <div className="space-y-6">
                {/* AI TUTOR INTERACTIVE PROMPTS */}
                <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-sm flex items-center text-indigo-200">
                      <Sparkles className="w-4 h-4 mr-2 text-amber-400" />{" "}
                      Interactive AI Tutor
                    </h4>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                      Contextual Learning
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <button
                      onClick={() => handleAskAiTutor("hint")}
                      className="px-3 py-1.5 rounded-lg bg-indigo-800/60 hover:bg-indigo-700 text-xs font-semibold text-indigo-100 border border-indigo-700/50 transition"
                    >
                      💡 Give me a hint
                    </button>
                    <button
                      onClick={() => handleAskAiTutor("explain_simply")}
                      className="px-3 py-1.5 rounded-lg bg-indigo-800/60 hover:bg-indigo-700 text-xs font-semibold text-indigo-100 border border-indigo-700/50 transition"
                    >
                      🧒 Explain simply
                    </button>
                    <button
                      onClick={() => handleAskAiTutor("another_method")}
                      className="px-3 py-1.5 rounded-lg bg-indigo-800/60 hover:bg-indigo-700 text-xs font-semibold text-indigo-100 border border-indigo-700/50 transition"
                    >
                      ⚡ Show another method
                    </button>
                    <button
                      onClick={() => handleAskAiTutor("why_wrong")}
                      className="px-3 py-1.5 rounded-lg bg-indigo-800/60 hover:bg-indigo-700 text-xs font-semibold text-indigo-100 border border-indigo-700/50 transition"
                    >
                      🔍 Why is my answer wrong?
                    </button>
                  </div>

                  {aiLoading && (
                    <div className="text-xs text-indigo-300 animate-pulse">
                      AI Tutor is generating guidance...
                    </div>
                  )}
                  {aiTutorResponse && (
                    <div className="mt-3 p-3.5 bg-indigo-950/80 rounded-xl border border-indigo-800 text-xs text-indigo-100 leading-relaxed">
                      <MathRenderer content={aiTutorResponse} />
                    </div>
                  )}
                </div>

                {/* MULTI-TAB EXPLANATION SYSTEM */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base flex items-center">
                      <BookOpen className="w-5 h-5 text-indigo-600 mr-2" />{" "}
                      Explanation System
                    </h3>
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/60 p-1 rounded-xl">
                      {["text", "visual", "video", "formula"].map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setActiveExplTab(tab)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition ${
                            activeExplTab === tab
                              ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 shadow-xs"
                              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeExplTab === "text" && (
                    <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                        <h5 className="font-bold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider mb-1 text-indigo-600">
                          Step-by-Step Solution
                        </h5>
                        <MathRenderer
                          content={
                            (isHi &&
                              (explanationHi ||
                                checkResult?.explanationHi ||
                                checkResult?.explanation_hi ||
                                explanations?.text?.stepByStepHi)) ||
                            explanations?.text?.stepByStep ||
                            checkResult?.explanation ||
                            explanationEn ||
                            "Detailed step-by-step solution."
                          }
                        />
                      </div>
                      {explanations?.text?.shortcut && (
                        <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-xl border border-amber-200/60 dark:border-amber-800/60">
                          <h5 className="font-bold text-amber-900 dark:text-amber-200 text-xs uppercase tracking-wider mb-1">
                            ⚡ Exam Shortcut
                          </h5>
                          <MathRenderer content={explanations.text.shortcut} />
                        </div>
                      )}
                    </div>
                  )}

                  {activeExplTab === "visual" && (
                    <div className="py-4 text-center">
                      {explanations?.visual?.svgContent ? (
                        <>
                          <div
                            className="inline-block p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl"
                            dangerouslySetInnerHTML={{
                              __html: sanitizeHtml(
                                explanations.visual.svgContent,
                              ),
                            }}
                          />
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            Concept diagram
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          No visual explanation available for this question yet.
                        </p>
                      )}
                    </div>
                  )}

                  {activeExplTab === "video" && (
                    <div className="space-y-3">
                      <div className="aspect-video bg-slate-900 rounded-xl flex items-center justify-center text-white text-xs">
                        <Play className="w-10 h-10 text-indigo-400" />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        Short video explanation
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wide">
                          Coming soon
                        </span>
                      </p>
                    </div>
                  )}

                  {activeExplTab === "formula" && (
                    <div className="space-y-3">
                      {explanations?.formula?.map((f, i) => (
                        <div
                          key={i}
                          className="p-3.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                        >
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {f.name}:{" "}
                          </span>
                          <MathRenderer content={f.formulaLatex} />
                          <p className="text-slate-500 dark:text-slate-400 mt-1">
                            {f.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* COMMUNITY APPROACHES / DISCUSSION */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6 shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base flex items-center">
                      <MessageSquare className="w-5 h-5 text-indigo-600 mr-2" />{" "}
                      💬 Discussion — {approaches.length} Approaches
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowSubmitApproach(!showSubmitApproach)}
                      className="inline-flex items-center text-xs font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Share Approach
                    </button>
                  </div>

                  {showSubmitApproach && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 mb-4 space-y-3">
                      <select
                        value={newApproachType}
                        onChange={(e) => setNewApproachType(e.target.value)}
                        className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="fastest">⚡ Fastest Method</option>
                        <option value="traditional">
                          👨‍🏫 Traditional Method
                        </option>
                        <option value="logical">🧠 Logical Method</option>
                        <option value="exam_shortcut">🎯 Exam Shortcut</option>
                      </select>
                      <textarea
                        rows={3}
                        value={newApproachText}
                        onChange={(e) => setNewApproachText(e.target.value)}
                        placeholder="Explain your approach..."
                        className="w-full text-xs p-3 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleSubmitApproach}
                        disabled={
                          isSubmittingApproach || !newApproachText.trim()
                        }
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        {isSubmittingApproach
                          ? "Submitting…"
                          : "Submit Approach"}
                      </button>
                    </div>
                  )}

                  {approaches.length === 0 && !showSubmitApproach && (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-center">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        No approaches shared yet — be the first to explain your
                        method
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {approaches.map((appr) => (
                      <div
                        key={appr.id}
                        className="p-4 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 rounded font-mono uppercase">
                            {appr.approachType}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpvoteApproach(appr.id)}
                            className="inline-flex items-center text-xs font-bold text-slate-500 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2.5 py-1 rounded-lg"
                          >
                            <ThumbsUp className="w-3 h-3 mr-1 text-indigo-500" />{" "}
                            {appr.upvotes}
                          </button>
                        </div>
                        <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium mb-1">
                          {appr.content}
                        </p>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                          — Shared by {appr.authorName}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PRACTICE SIMILAR QUESTIONS */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6 shadow-xs">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base mb-3 flex items-center">
                    <Layers className="w-5 h-5 text-indigo-600 mr-2" /> Want to
                    master this concept?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Practice level-by-level similar questions without losing
                    context.
                  </p>

                  <div className="space-y-2">
                    {similarQs.length === 0 && (
                      <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 text-center">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          No similar questions available for this concept yet.
                        </p>
                      </div>
                    )}
                    {similarQs.map((sim, i) => (
                      <div
                        key={sim.id}
                        className="p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between gap-3"
                      >
                        <div
                          className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate max-w-lg"
                          title={`Level ${i + 1}`}
                        >
                          Level {i + 1}:{" "}
                          <MathRenderer
                            content={sim.questionText || sim.question_text}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const tid =
                              sim.topicId || sim.topic_id || question.topicId;
                            if (tid && onLaunchTopicSession)
                              onLaunchTopicSession(tid);
                          }}
                          disabled={
                            !onLaunchTopicSession ||
                            !(sim.topicId || sim.topic_id || question.topicId)
                          }
                          className="text-xs font-bold text-indigo-600 hover:underline flex items-center disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                        >
                          Attempt <ArrowRight className="w-3 h-3 ml-1" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* NEXT / PREVIOUS QUESTION NAVIGATION */}
                <div className="flex items-center justify-between pt-4 gap-3">
                  <button
                    type="button"
                    onClick={handlePreviousQuestion}
                    disabled={currentIdx === 0 || loading || finishing}
                    className="px-5 py-2.5 rounded-xl font-bold text-xs border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Previous
                  </button>

                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    disabled={finishing || skipping || loading}
                    className="px-8 py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-slate-800 dark:hover:bg-indigo-700 transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {currentIdx + 1 >= totalQuestions
                      ? "Finish Session"
                      : "Next Question →"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── QUESTION PALETTE & NAVIGATION (TEST INTERFACE ENHANCED) ── */}
          {/* Backdrop for mobile drawer */}
          {showMobilePalette && (
            <div
              onClick={() => setShowMobilePalette(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 lg:hidden transition-all duration-300"
              aria-hidden="true"
            />
          )}

          <aside
            className={`fixed lg:sticky top-0 lg:top-20 inset-y-0 right-0 z-[60] lg:z-30 h-full max-h-[100dvh] lg:max-h-[calc(100vh-6rem)] ${
              showMobilePalette
                ? "translate-x-0"
                : "translate-x-full lg:translate-x-0"
            } ${
              showMobilePalette ? "block" : "hidden lg:block"
            } w-80 sm:w-88 lg:w-full lg:col-span-4 xl:col-span-4 flex-shrink-0 transition-transform duration-300 ease-in-out`}
          >
            <div className="h-full bg-sky-50/70 dark:bg-slate-800/90 backdrop-blur-md rounded-none lg:rounded-2xl border-l lg:border border-slate-200 dark:border-slate-700 shadow-2xl lg:shadow-xs overflow-hidden flex flex-col justify-between relative">
              {/* Mobile Close Button */}
              <button
                type="button"
                onClick={() => setShowMobilePalette(false)}
                aria-label="Close question palette"
                className="lg:hidden absolute top-3 right-3 p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full z-20 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-700 dark:text-slate-300" />
              </button>

              {/* Top Palette Title Bar */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-4 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Question Palette
                </span>
                <span className="text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/50">
                  Q{currentIdx + 1}/{totalQuestions}
                </span>
              </div>

              {/* 1. User Profile Header (Matches Test Interface) */}
              <div className="flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 shrink-0">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center overflow-hidden border border-blue-200 dark:border-blue-700 shadow-inner shrink-0">
                  {user?.avatar || user?.avatarUrl ? (
                    <img
                      loading="lazy"
                      decoding="async"
                      src={user.avatar || user.avatarUrl}
                      alt={userName}
                      className="h-full w-full object-cover"
                      onError={handleAvatarError}
                    />
                  ) : null}
                  <span
                    className={`${
                      user?.avatar || user?.avatarUrl ? "hidden" : "inline"
                    } text-sm font-black text-blue-600 dark:text-blue-300`}
                  >
                    {userInitials}
                  </span>
                </div>
                <div className="min-w-0 flex-1 pr-6 lg:pr-0">
                  <div
                    className="truncate text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight"
                    title={userName}
                  >
                    {userName}
                  </div>
                  <div
                    className="truncate text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5"
                    title={userEmail || "Practice Session"}
                  >
                    {userEmail || "Practice Mode"}
                  </div>
                </div>
              </div>

              {/* 2. Metric / Status Legend Bar (4 Iconic Test Interface Badges) */}
              <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 shrink-0">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white dark:bg-slate-700 border border-slate-400 dark:border-slate-500 px-1 font-bold text-slate-900 dark:text-white shadow-2xs text-xs">
                      {notVisitedCount}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium leading-tight text-xs">
                      Not Visited
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 border border-red-600 px-1 font-bold text-white shadow-2xs text-xs">
                      {incorrectCount}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium leading-tight text-xs">
                      Incorrect
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-green-500 border border-green-600 px-1 font-bold text-white shadow-2xs text-xs">
                      {correctCount}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium leading-tight text-xs">
                      Correct
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50 border border-amber-400 dark:border-amber-600 px-1 font-bold text-amber-800 dark:text-amber-200 shadow-2xs text-xs">
                      {skippedCount}
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium leading-tight text-xs">
                      Skipped
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Section / Topic Sticky Header */}
              <div className="px-3.5 py-2 text-xs font-bold border-b border-sky-200/80 dark:border-slate-700 flex justify-between items-center bg-sky-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 shrink-0">
                <div className="flex items-center gap-1.5 min-w-0 pr-1">
                  <span className="uppercase text-[10px] tracking-wider opacity-90 bg-sky-200/90 dark:bg-sky-900/60 text-sky-900 dark:text-sky-200 px-1.5 py-0.5 rounded font-bold shrink-0">
                    Topic
                  </span>
                  <span className="font-extrabold truncate">
                    {question.topic || question.subject || "Practice"}
                  </span>
                </div>
                <span className="text-[11px] bg-white/80 dark:bg-slate-700/80 px-2 py-0.5 rounded-md font-bold text-sky-900 dark:text-sky-200 shrink-0">
                  {totalQuestions} Qs
                </span>
              </div>

              {/* 4. Circular Question Bubbles Grid (TCS / NTA Test Style) */}
              <div className="p-3.5 flex-1 min-h-0 overflow-y-auto max-h-[45vh] lg:max-h-[340px] no-scrollbar">
                <div className="grid grid-cols-5 gap-2.5">
                  {Array.from({ length: totalQuestions }, (_, i) => {
                    const isCurrent = i === currentIdx;
                    const hasAnswered = answerResults[i] !== undefined;
                    const isCorrectAnswer = answerResults[i] === true;
                    const isSkippedQ = userSelections[i]?.isSkipped;

                    let statusClass =
                      "bg-white dark:bg-slate-700 border-slate-400 dark:border-slate-500 text-slate-900 dark:text-white hover:border-indigo-500 shadow-2xs";

                    if (hasAnswered) {
                      statusClass = isCorrectAnswer
                        ? "bg-green-500 border-green-600 text-white shadow-xs"
                        : "bg-red-500 border-red-600 text-white shadow-xs";
                    } else if (isSkippedQ) {
                      statusClass =
                        "bg-amber-100 dark:bg-amber-900/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200 font-semibold shadow-2xs";
                    }

                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          handleJumpToQuestion(i);
                          setShowMobilePalette(false);
                        }}
                        disabled={finishing}
                        title={`Question ${i + 1}`}
                        className={`relative w-9 h-9 sm:w-10 sm:h-10 mx-auto rounded-full border flex items-center justify-center text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer ${statusClass} ${
                          isCurrent
                            ? "ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-slate-800 border-blue-600 scale-105 z-10 font-black shadow-sm"
                            : ""
                        }`}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. Navigation & Submit Action Footer Bar (Pinned at Bottom on Mobile & Desktop) */}
              <div className="mt-auto shrink-0 p-3.5 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-2.5 sticky bottom-0 pb-safe z-10 shadow-xs">
                {/* Previous & Next Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handlePreviousQuestion}
                    disabled={currentIdx === 0 || finishing}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Previous
                  </button>

                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    disabled={finishing}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {currentIdx + 1 >= totalQuestions ? "Finish" : "Next"}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Submit / Finish Practice Set Button (Gradient style like Test Interface) */}
                <button
                  type="button"
                  onClick={handleFinishSession}
                  disabled={finishing}
                  className="w-full py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-50 text-xs sm:text-sm cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>
                    {finishing ? "Finishing…" : "Submit Practice Set"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleFinishSession}
                  disabled={finishing}
                  className="w-full text-center text-xs font-semibold text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 py-1 transition disabled:opacity-40 cursor-pointer"
                >
                  {finishing ? "Finishing…" : "End Session Early"}
                </button>
              </div>
            </div>
          </aside>
        </div>

        {/* KNOWLEDGE VAULT MODAL */}
        <KnowledgeVaultModal
          questionId={question.id}
          isOpen={vaultOpen}
          onClose={() => setVaultOpen(false)}
        />
      </div>
    </div>
  );
}
