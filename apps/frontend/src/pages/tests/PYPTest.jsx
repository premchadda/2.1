import { useState, useEffect, useRef } from "react";
import { logger } from "@trstprep/shared-config";
import { Helmet } from "react-helmet-async";
import { useParams, useNavigate } from "react-router-dom";
import {
  apiClient,
  getTestById,
  getQuestionsByTestId,
} from "../../shared/lib/dataService";
import { getLocalizedField } from "../../shared/lib/language";
import { sanitizeHtml } from "../../shared/lib/htmlSanitizer.js";
import { formatTime } from "../../shared/lib/format.js";
import MathRenderer from "../../shared/components/MathRenderer";
import Telemetry from "../../shared/lib/telemetry";
import { toast } from "react-hot-toast";
import {
  getEstimatedReadingSeconds,
  formatReadingTime,
} from "@trstprep/shared-config";
import { AlertTriangle, BookOpen } from "lucide-react";
import "./TestInterface.css";

const DEFAULT_MARKS_PER_QUESTION = 2;
const DEFAULT_NEGATIVE_MARKS = 0.5;

const PYPTest = () => {
  const { pypId } = useParams();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attemptId, setAttemptId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const fetchPypTest = async () => {
      try {
        // FIX P0-1: Use the standard test endpoints that actually exist on the backend,
        // instead of the non-existent /api/pyp/:id route.
        const testData = await getTestById(pypId);
        if (!testData) {
          toast.error("Test not found");
          setLoading(false);
          return;
        }

        setTest(testData);
        setTimeLeft((testData.duration || 180) * 60); // duration in minutes -> seconds

        // Fetch questions separately (same pattern as TestInterface.jsx)
        const questionsData = await getQuestionsByTestId(
          testData._id || testData.id || pypId,
        );
        const finalQuestions = Array.isArray(questionsData)
          ? questionsData
          : [];
        setQuestions(finalQuestions);

        // Start an attempt via the standard test flow
        try {
          const attemptResponse = await apiClient.post(
            `/api/tests/${testData._id || testData.id || pypId}/start`,
            null,
            { signal: controller.signal },
          );
          const attemptData = attemptResponse.data?.data;
          if (attemptData?.attemptId) {
            setAttemptId(attemptData.attemptId);

            // Resume previous progress from autosave
            if (attemptData.timeSpent > 0) {
              setTimeLeft(
                Math.max(
                  1,
                  (testData.duration || 180) * 60 - attemptData.timeSpent,
                ),
              );
            }
            if (attemptData.answers && attemptData.answers.length > 0) {
              const restoredAnswers = {};
              attemptData.answers.forEach((a) => {
                restoredAnswers[a.questionIndex] = a.selectedOption;
              });
              setAnswers(restoredAnswers);
            }
          }
        } catch (startErr) {
          // Non-fatal: test can still be displayed without a tracked attempt
          if (import.meta.env.DEV)
            logger.warn("Could not start PYP attempt:", startErr.message);
        }
      } catch (error) {
        logger.error("Error loading PYP test:", error?.message ?? error);
        toast.error("Failed to load test");
      } finally {
        setLoading(false);
      }
    };
    fetchPypTest();

    return () => controller.abort();
  }, [pypId]);

  // Refs to share active state values dynamically with the Telemetry singleton without triggering re-renders
  const currentQuestionRef = useRef(currentQuestion);
  const timeLeftRef = useRef(timeLeft);
  const questionsRef = useRef(questions);
  const redirectTimerRef = useRef(null);
  const handleSubmitRef = useRef(null);

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
    if (!attemptId || !test || isSubmitted) return;

    Telemetry.start({
      attemptId,
      testId: test._id || test.id,
      getCurrentQuestion: () => {
        const qIdx = currentQuestionRef.current;
        const questionsList = questionsRef.current;
        return questionsList[qIdx]?.id || questionsList[qIdx]?._id || null;
      },
      getTimeLeft: () => timeLeftRef.current,
      onViolation: (type, e) => {
        if (type === "tab_switch") {
          toast.error(
            "Tab switching detected. This may disqualify your attempt.",
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
          redirectTimerRef.current = setTimeout(() => {
            navigate("/previous-year-papers");
          }, 3000);
        }
      },
    });

    return () => {
      Telemetry.stop();
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [attemptId, test, isSubmitted]);

  // handleSubmitRef (declared above with other refs) is synced in an effect
  // below so the timer calls the latest version without re-subscribing.

  useEffect(() => {
    if (!test || isSubmitted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          // Call via ref to avoid stale closure
          handleSubmitRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [test, isSubmitted]);

  // Countdown clock — centralized in shared/lib/format.js
  // (renders h:mm:ss once >= 1h, mm:ss otherwise).
  const handleAnswerChange = (optionIndex) => {
    setAnswers({
      ...answers,
      [currentQuestion]: optionIndex,
    });
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // FIX P0-1: Use the standard test submit endpoint instead of /api/pyp/:id/attempt
      const actualTestId = test?.id || test?._id || pypId;

      const submittedAnswers = questions
        .map((question, index) => {
          const selectedOption = answers[index];
          if (selectedOption === undefined || selectedOption === null)
            return null;
          return {
            questionId: question.id || question._id,
            questionIndex: index,
            selectedOption,
          };
        })
        .filter(Boolean);

      const response = await apiClient.put(
        `/api/tests/${actualTestId}/submit`,
        {
          attemptId,
          timeSpent: (test?.duration || 180) * 60 - timeLeft,
          answers: submittedAnswers,
        },
      );

      setIsSubmitted(true);
      const submittedAttemptId = response.data?.data?.attemptId || attemptId;

      // Navigate to the standard test result page
      navigate(`/test-result/pyp/${pypId}`, {
        state: { attemptId: submittedAttemptId },
      });
    } catch (error) {
      logger.error("Error submitting test:", error?.message ?? error);
      toast.error("Error submitting test");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keep handleSubmitRef in sync so the timer effect calls the latest version
  // without re-subscribing the interval on every render.
  handleSubmitRef.current = handleSubmit;

  if (loading) {
    return <div className="test-loading">Loading test...</div>;
  }

  if (!test || questions.length === 0) {
    return <div className="test-error">Test not found</div>;
  }

  const question = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;

  // Resolve question text (may be an object with language keys like { en: "...", hi: "..." })
  const questionText =
    getLocalizedField(question?.text, "en") || question?.questionText || "";

  // Resolve options (may be an object with language keys or a flat array)
  const questionOptions = getLocalizedField(question?.options, "en") || [];

  return (
    <div className="test-interface overscroll-none overscroll-y-none touch-pan-y">
      <Helmet>
        <title>{test?.title || "PYP Test"} | Trstprep</title>
        <meta
          name="description"
          content="Solving previous year paper on Trstprep."
        />
        <meta
          property="og:title"
          content={`${test?.title || "PYP Test"} | Trstprep`}
        />
        <meta property="og:type" content="website" />
      </Helmet>
      {/* Header */}
      <div className="test-header">
        <div className="test-header-left min-w-0 flex-1 pr-1">
          <h1
            title={test.title}
            className="line-clamp-2 leading-tight break-words font-extrabold"
          >
            {test.title}
          </h1>
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
            className="test-btn-submit"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit Test"}
          </button>
        </div>
      </div>

      <div className="test-container">
        {/* Left Panel - Questions List */}
        <div className="test-sidebar">
          <div className="test-sidebar-header">
            <h3>Questions</h3>
            <span className="test-sidebar-count">
              {currentQuestion + 1}/{questions.length}
            </span>
          </div>
          <div className="test-questions-list">
            {questions.map((q, idx) => (
              <button
                key={q.id || q._id || idx}
                className={`test-question-btn ${
                  idx === currentQuestion ? "active" : ""
                } ${answers[idx] !== undefined ? "answered" : "unanswered"}`}
                onClick={() => setCurrentQuestion(idx)}
              >
                <span className="test-question-number">{idx + 1}</span>
                {answers[idx] !== undefined && (
                  <span className="test-question-mark">✓</span>
                )}
              </button>
            ))}
          </div>

          <div className="test-progress">
            <div className="test-progress-bar">
              <div
                className="test-progress-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="test-progress-text">
              {Object.keys(answers).length} of {questions.length} answered
            </p>
          </div>
        </div>

        {/* Center Panel - Question Display */}
        <div className="test-main">
          <div className="test-question">
            {/* Question Info Header - Q.No, Negative Marking, Reading Time */}
            <div className="flex items-center gap-1.5 sm:gap-2 mb-3 pb-2.5 border-b border-slate-700/60 min-w-0 flex-wrap">
              <span className="bg-indigo-900/50 text-indigo-300 border border-indigo-700/60 px-2 py-0.5 rounded-full text-xs font-bold shrink-0">
                Q.{currentQuestion + 1}
              </span>

              {Number(
                question?.negative_marks ??
                  question?.negativeMarks ??
                  test?.negativeMarking ??
                  test?.negativeMarks ??
                  DEFAULT_NEGATIVE_MARKS,
              ) > 0 ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-800/80 text-amber-300 text-[10px] sm:text-[11px] font-bold shrink-0">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>
                    -
                    {Number(
                      question?.negative_marks ??
                        question?.negativeMarks ??
                        test?.negativeMarking ??
                        test?.negativeMarks ??
                        DEFAULT_NEGATIVE_MARKS,
                    ).toFixed(2)}{" "}
                    for wrong
                  </span>
                </span>
              ) : (
                <span className="text-slate-400 text-[11px] font-medium shrink-0">
                  +
                  {(
                    test?.marksPerQuestion || DEFAULT_MARKS_PER_QUESTION
                  ).toFixed(1)}{" "}
                  Marks
                </span>
              )}

              {question && (
                <span
                  className="flex items-center gap-1 text-slate-300 text-[10px] sm:text-[11px] font-medium bg-slate-800/80 border border-slate-700 px-1.5 py-0.5 rounded shrink-0"
                  title="Estimated reading time"
                >
                  <BookOpen className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>
                    ~{formatReadingTime(getEstimatedReadingSeconds(question))}
                  </span>
                </span>
              )}
            </div>

            <h2 className="test-question-title">
              <MathRenderer text={sanitizeHtml(questionText)} />
            </h2>

            <div className="test-options">
              {questionOptions.map((option, idx) => {
                const optionText =
                  typeof option === "object"
                    ? option.text || option.en || JSON.stringify(option)
                    : option;
                const isSelected = answers[currentQuestion] === idx;
                return (
                  <label
                    key={idx}
                    className={`test-option ${isSelected ? "border-indigo-500 bg-indigo-950/30 ring-1 ring-indigo-500" : ""}`}
                  >
                    <input
                      type="radio"
                      name="answer"
                      value={idx}
                      checked={isSelected}
                      onChange={() => handleAnswerChange(idx)}
                      className="sr-only"
                    />
                    <span
                      className={`w-6 h-6 min-w-[24px] min-h-[24px] rounded-full border-2 flex-shrink-0 flex items-center justify-center aspect-square mr-3 text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-xs"
                          : "border-slate-600 bg-slate-800 text-slate-300"
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="test-option-label">
                      <MathRenderer text={sanitizeHtml(optionText)} />
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="test-navigation">
            <button
              className="test-nav-btn"
              onClick={handlePrev}
              disabled={currentQuestion === 0}
            >
              ← Previous
            </button>

            <div className="test-nav-info">
              Question {currentQuestion + 1} of {questions.length}
            </div>

            <button
              className="test-nav-btn"
              onClick={handleNext}
              disabled={currentQuestion === questions.length - 1}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PYPTest;
