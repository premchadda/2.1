import { useState, useEffect, useCallback, useRef } from "react";
import { logger } from "@trstprep/shared-config";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { api } from "../../shared/lib/dataService";
import { sanitizeHtml } from "../../shared/lib/htmlSanitizer";
import Telemetry from "../../shared/lib/telemetry";
import { useAuth } from "../../shared/providers/AuthContext";
import { clearDashboardCache } from "../../shared/lib/dashboardCache";
import { useConfirm } from "../../shared/components/common/ConfirmModal";
import MathRenderer from "../../shared/components/MathRenderer";
import { formatTime } from "../../shared/lib/format.js";
import { getErrorStatus } from "../../shared/lib/apiClient.js";
import "./TestInterface.css";

const LiveTestInterface = () => {
  const { liveTestId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { socket, on, emit } = useAuth();
  const tabSwitchCountRef = useRef(0);
  const redirectTimerRef = useRef(null);
  const _lastActivityRef = useRef(Date.now());
  // Absolute countdown deadline (ms epoch). See the timer effect below.
  const endTimeRef = useRef(0);

  const [test, setTest] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [liveRank, setLiveRank] = useState(null);
  const [markedForReview, setMarkedForReview] = useState(new Set());
  const [visitedQuestions, setVisitedQuestions] = useState(new Set());
  const [attemptId, setAttemptId] = useState(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const fetchLiveRank = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) {
      return;
    }
    try {
      const response = await api.get(`/api/live-tests/${liveTestId}/live-rank`);
      setLiveRank(response.data?.data || null);
    } catch (error) {
      if (getErrorStatus(error) === 404) {
        setLiveRank(null);
        return;
      }
      logger.error("Error fetching rank:", error?.message ?? error);
    }
  }, [liveTestId]);

  const handleSubmit = useCallback(async () => {
    if (!test || isSubmitted) return;

    // Prevent double-submit
    if (window._liveTestSubmitting) return;
    window._liveTestSubmitting = true;

    try {
      const response = await api.post(`/api/live-tests/${liveTestId}/attempt`, {
        answers,
        timeSpent: (test.duration || 0) * 60 - timeLeft,
      });

      setIsSubmitted(true);
      window._liveTestSubmitting = false;

      // Clear client-side dashboard cache & invalidate queries so dashboard and tests refresh immediately
      clearDashboardCache();
      queryClient.invalidateQueries({ queryKey: ["live-tests"] });
      queryClient.invalidateQueries({ queryKey: ["user-attempts-live"] });
      queryClient.invalidateQueries({ queryKey: ["user-attempts"] });
      queryClient.invalidateQueries({ queryKey: ["user-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["recent-activity"] });
      queryClient.invalidateQueries({ queryKey: ["attempted-tests"] });
      queryClient.invalidateQueries({
        queryKey: ["live-test-leaderboard", liveTestId],
      });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });

      navigate(`/live-test-results/${liveTestId}`, {
        state: { result: response.data?.data },
      });
    } catch (error) {
      logger.error("Error submitting test:", error?.message ?? error);
      toast.error("Error submitting test");
      window._liveTestSubmitting = false;
    }
  }, [test, isSubmitted, answers, liveTestId, navigate, timeLeft]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchTest = async () => {
      try {
        const [testResponse, regResponse] = await Promise.all([
          api.get(`/api/live-tests/${liveTestId}`, {
            signal: controller.signal,
          }),
          api
            .post(
              `/api/live-tests/${liveTestId}/register`,
              {},
              { signal: controller.signal },
            )
            .catch(() => null),
        ]);

        const liveTest = testResponse.data?.data;
        if (liveTest) {
          setTest(liveTest);
          const durationSeconds = (liveTest.duration || 0) * 60;
          // Anchor the deadline once; the countdown effect derives timeLeft from
          // this instead of decrementing, so tab throttling cannot slow it.
          endTimeRef.current = Date.now() + durationSeconds * 1000;
          setTimeLeft(durationSeconds);
        }
        const regData = regResponse?.data?.data;
        if (regData?.attemptId) {
          setAttemptId(regData.attemptId);
        }
      } catch (error) {
        if (api.isCancel(error)) return;
        logger.error("Error fetching test:", error?.message ?? error);
      } finally {
        setLoading(false);
      }
    };

    fetchTest();
    return () => controller.abort();
  }, [liveTestId]);

  useEffect(() => {
    if (!test || isSubmitted) return;

    // Absolute-deadline countdown. Browsers clamp setInterval in background tabs
    // (often to once per minute), so decrementing a counter made the clock run
    // ~60x slow and auto-submit never fired at the real deadline. Deriving
    // timeLeft from a fixed deadline keeps it accurate regardless of throttling.
    const timer = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.ceil((endTimeRef.current - Date.now()) / 1000),
      );
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [test, isSubmitted]);

  useEffect(() => {
    if (timeLeft <= 0 && timeLeft !== null && test && !isSubmitted) {
      handleSubmit();
    }
  }, [timeLeft, test, isSubmitted, handleSubmit]);

  useEffect(() => {
    if (!test || isSubmitted) return;

    fetchLiveRank();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchLiveRank();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // If socket is active, leaderboard:updated pushes live updates;
    // polling serves only as a slow fallback (30s).
    // If socket is inactive, poll at 10s only when document is visible.
    const pollIntervalMs = socket ? 30000 : 10000;
    const rankInterval = setInterval(() => {
      if (!document.hidden) {
        fetchLiveRank();
      }
    }, pollIntervalMs);

    return () => {
      clearInterval(rankInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [test, isSubmitted, fetchLiveRank, socket]);

  useEffect(() => {
    if (!socket || !test || isSubmitted) return;

    emit("live-tests:join", { testId: liveTestId });

    const cleanup = on("leaderboard:updated", (payload) => {
      if (String(payload?.testId) === String(liveTestId)) {
        fetchLiveRank();
      }
    });

    return () => {
      cleanup();
      emit("live-tests:leave", { testId: liveTestId });
    };
  }, [socket, test, isSubmitted, liveTestId, emit, on, fetchLiveRank]);

  // Refs to share active state values dynamically with the Telemetry singleton without triggering re-renders
  const currentQuestionRef = useRef(currentQuestion);
  const timeLeftRef = useRef(timeLeft);
  const testRef = useRef(test);

  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
  }, [currentQuestion]);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    testRef.current = test;
  }, [test]);

  // Initialize central Telemetry SDK
  useEffect(() => {
    if (!attemptId || !test || isSubmitted) return;

    Telemetry.start({
      attemptId,
      testId: test._id || test.id,
      getCurrentQuestion: () => {
        const qIdx = currentQuestionRef.current;
        const questionsList = testRef.current?.questions || [];
        return questionsList[qIdx]?.id || questionsList[qIdx]?._id || null;
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
          // Clear any prior pending redirect first — otherwise N violations queue
          // N navigations and the last write wins.
          if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
          redirectTimerRef.current = setTimeout(() => {
            navigate("/dashboard");
          }, 3000);
        }
      },
    });

    return () => {
      Telemetry.stop();
      // Drop any pending revoked-redirect when attemptId/test/isSubmitted change
      // (e.g. the learner submits normally within the 3s window) — otherwise the
      // timer fires anyway and yanks them off the result page.
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = null;
      }
    };
  }, [attemptId, test, isSubmitted]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  // Only exit fullscreen on unmount if active
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Track visited questions
  useEffect(() => {
    if (test) {
      setVisitedQuestions((previous) => new Set(previous).add(currentQuestion));
    }
  }, [currentQuestion, test]);

  // Keyboard shortcuts
  useEffect(() => {
    if (loading || isSubmitted || !test) return;

    const handleKeyDown = async (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      const key = e.key.toLowerCase();

      if (key === "n" || key === "arrowright") {
        e.preventDefault();
        handleNext();
      } else if (key === "p" || key === "arrowleft") {
        e.preventDefault();
        handlePrev();
      } else if (key === "m") {
        e.preventDefault();
        handleMarkForReview();
      } else if (key === "c") {
        e.preventDefault();
        handleClearResponse();
      } else if (key === "s") {
        e.preventDefault();
        const ok = await confirm({
          title: "Submit Test?",
          message:
            "Are you sure you want to submit the test? You cannot change your answers afterwards.",
          confirmLabel: "Submit",
          danger: true,
        });
        if (ok) {
          handleSubmit();
        }
      } else if (["1", "2", "3", "4"].includes(key)) {
        const question = test?.questions?.[currentQuestion];
        if (!question) return;
        if (question.type === "mcq") {
          const optionIndex = parseInt(key, 10) - 1;
          // Options are either a plain array or a localized
          // `{ en: [...], hi: [...] }` object. `.length` is undefined on the
          // object shape, so `optionIndex < undefined` was always false and the
          // 1-4 hotkeys were 100% dead for localized questions.
          const opts = Array.isArray(question.options)
            ? question.options
            : (question.options?.en ?? []);
          if (opts.length && optionIndex < opts.length) {
            e.preventDefault();
            handleAnswerChange(opts[optionIndex]);
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [loading, isSubmitted, test, currentQuestion, handleSubmit, confirm]);

  const saveAnswerToServer = async (questionIndex, value) => {
    try {
      await api.post(`/api/live-tests/${liveTestId}/save-answer`, {
        questionIndex,
        answer: value,
      });
    } catch (error) {
      logger.error("Error saving answer:", error?.message ?? error);
    }
  };

  const handleAnswerChange = (value) => {
    setAnswers((previousAnswers) => ({
      ...previousAnswers,
      [currentQuestion]: value,
    }));

    saveAnswerToServer(currentQuestion, value);
  };

  const handleMarkForReview = () => {
    setMarkedForReview((previous) => {
      const next = new Set(previous);
      if (next.has(currentQuestion)) {
        next.delete(currentQuestion);
      } else {
        next.add(currentQuestion);
      }
      return next;
    });
  };

  const handleClearResponse = () => {
    setAnswers((previousAnswers) => {
      const next = { ...previousAnswers };
      delete next[currentQuestion];
      return next;
    });
    saveAnswerToServer(currentQuestion, null);
  };

  const handleNext = () => {
    if (test && currentQuestion < test.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrev = () => {
    if (test && currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  if (loading) {
    return <div className="test-loading">Loading test...</div>;
  }

  if (!test || !test.questions || test.questions.length === 0) {
    return <div className="test-error">Test not found</div>;
  }

  const question = test.questions[currentQuestion];
  const progress = ((currentQuestion + 1) / test.questions.length) * 100;

  return (
    <div className="test-interface overscroll-none overscroll-y-none touch-pan-y">
      <Helmet>
        <title>{test?.title || "Live Test"} | Trstprep</title>
        <meta name="description" content="Taking live test on Trstprep." />
        <meta
          property="og:title"
          content={`${test?.title || "Live Test"} | Trstprep`}
        />
        <meta property="og:type" content="website" />
      </Helmet>
      <div className="test-header">
        <div className="test-header-left min-w-0 flex-1 pr-1">
          <h1
            title={test.title}
            className="line-clamp-2 leading-tight break-words font-extrabold"
          >
            {test.title}
          </h1>
          {liveRank && (
            <span className="test-live-rank shrink-0">
              Live Rank: <strong>#{liveRank.rank}</strong> (
              {liveRank.percentile}%)
            </span>
          )}
        </div>
        <div className="test-header-right">
          <div className={`test-timer ${timeLeft < 300 ? "warning" : ""}`}>
            <div className="test-timer-icon">⏱</div>
            <div>
              <div className="test-timer-label">Time Left</div>
              <div className="test-timer-value">{formatTime(timeLeft)}</div>
            </div>
          </div>
          <button
            className="test-btn-submit focus:outline-none focus:ring-2 focus:ring-emerald-500"
            onClick={handleSubmit}
          >
            Submit Test
          </button>
        </div>
      </div>

      <div className="test-container">
        <div className="test-sidebar">
          <div className="test-sidebar-header">
            <h3>Questions</h3>
            <span className="test-sidebar-count">
              {currentQuestion + 1}/{test.questions.length}
            </span>
          </div>
          <div className="test-questions-list">
            {test.questions.map((questionItem, index) => {
              const isMarked = markedForReview.has(index);
              const isAnswered = !!answers[index];
              const isVisited = visitedQuestions.has(index);
              const isActive = index === currentQuestion;

              let paletteClass = "test-question-btn";
              if (isActive) paletteClass += " active";
              if (isMarked) paletteClass += " marked-review";
              else if (isAnswered) paletteClass += " answered";
              else if (isVisited) paletteClass += " visited";
              else paletteClass += " not-visited";

              return (
                <button
                  key={questionItem.id}
                  className={paletteClass}
                  onClick={() => setCurrentQuestion(index)}
                  title={`Question ${index + 1}${isMarked ? " (Marked for Review)" : isAnswered ? " (Answered)" : isVisited ? " (Visited)" : ""}`}
                >
                  <span className="test-question-number">{index + 1}</span>
                  {isMarked && <span className="test-question-flag">⚑</span>}
                  {isAnswered && !isMarked && (
                    <span className="test-question-mark">✓</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="test-progress">
            <div className="test-progress-bar">
              <div
                className="test-progress-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="test-progress-text">
              {Object.keys(answers).length} of {test.questions.length} answered
            </p>
          </div>

          {liveRank && (
            <div className="test-live-stats">
              <div className="test-live-stat">
                <span className="test-live-stat-label">Your Score</span>
                <span className="test-live-stat-value">{liveRank.score}</span>
              </div>
              <div className="test-live-stat">
                <span className="test-live-stat-label">Attempts</span>
                <span className="test-live-stat-value">
                  {liveRank.totalAttempts}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="test-main">
          <div className="test-question">
            <h2 className="test-question-title">
              <MathRenderer text={sanitizeHtml(question.text)} />
            </h2>

            {question.type === "mcq" && (
              <div className="test-options">
                {question.options.map((option, index) => (
                  <label key={index} className="test-option">
                    <input
                      type="radio"
                      name="answer"
                      value={option}
                      checked={answers[currentQuestion] === option}
                      onChange={(event) =>
                        handleAnswerChange(event.target.value)
                      }
                    />
                    <span className="test-option-label">
                      <MathRenderer text={sanitizeHtml(option)} />
                    </span>
                  </label>
                ))}
              </div>
            )}

            {question.type === "msq" && (
              <div className="test-options">
                {question.options.map((option, index) => {
                  const currentSelections = Array.isArray(
                    answers[currentQuestion],
                  )
                    ? answers[currentQuestion]
                    : [];
                  return (
                    <label key={index} className="test-option">
                      <input
                        type="checkbox"
                        checked={currentSelections.includes(index)}
                        onChange={() => {
                          const updated = currentSelections.includes(index)
                            ? currentSelections.filter((i) => i !== index)
                            : [...currentSelections, index];
                          handleAnswerChange(updated);
                        }}
                      />
                      <span className="test-option-label">
                        <MathRenderer text={sanitizeHtml(option)} />
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {question.type === "numeric" && (
              <input
                aria-label="Numeric answer input"
                type="number"
                className="test-input-numeric"
                placeholder="Enter your answer"
                value={answers[currentQuestion] || ""}
                onChange={(event) =>
                  handleAnswerChange(parseFloat(event.target.value) || "")
                }
              />
            )}

            {question.type === "true-false" && (
              <div
                className="test-options"
                style={{ display: "flex", gap: "1rem" }}
              >
                {[true, false].map((val) => (
                  <button
                    key={String(val)}
                    onClick={() => handleAnswerChange(val)}
                    className="test-option"
                    style={{
                      flex: 1,
                      padding: "1rem",
                      border: `2px solid ${answers[currentQuestion] === val ? "#4f46e5" : "#e2e8f0"}`,
                      borderRadius: "0.5rem",
                      backgroundColor:
                        answers[currentQuestion] === val ? "#eef2ff" : "white",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    {val ? "True" : "False"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="test-navigation">
            <button
              className="test-nav-btn"
              onClick={handlePrev}
              disabled={currentQuestion === 0}
            >
              ← Previous
            </button>

            <div className="test-nav-center">
              <button
                className={`test-nav-btn test-mark-review-btn ${markedForReview.has(currentQuestion) ? "active-mark" : ""}`}
                onClick={handleMarkForReview}
              >
                {markedForReview.has(currentQuestion)
                  ? "⚑ Unmark Review"
                  : "⚑ Mark for Review"}
              </button>
              <button
                className="test-nav-btn test-clear-btn"
                onClick={handleClearResponse}
              >
                Clear Response
              </button>
            </div>

            <div className="test-nav-info">
              Question {currentQuestion + 1} of {test.questions.length}
            </div>

            <button
              className="test-nav-btn"
              onClick={handleNext}
              disabled={currentQuestion === test.questions.length - 1}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
      {ConfirmDialog}
    </div>
  );
};

export default LiveTestInterface;
