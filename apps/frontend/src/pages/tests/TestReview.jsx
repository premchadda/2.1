import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation, useParams, Link } from "react-router-dom";
import {
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle,
  XCircle,
  ArrowLeft,
  LayoutDashboard,
  RotateCcw,
  Eye,
  HelpCircle,
  Sparkles,
  BookOpen,
} from "lucide-react";
import sanitizeHtml from "../../shared/lib/sanitizeHtml";
import MathRenderer from "../../shared/components/MathRenderer";
import { apiClient } from "../../shared/lib/dataService";

export default function TestReview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { testId, seriesSlug } = useParams();
  const seriesId = seriesSlug || location.state?.seriesId || "ssc-cgl-2026";
  const attemptId = location.state?.attemptId || null;
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showPalette, setShowPalette] = useState(false);
  const [testData, setTestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [interactiveMode, setInteractiveMode] = useState(false);
  const [userReSolveAnswers, setUserReSolveAnswers] = useState({});
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    const controller = new AbortController();
    const fetchTestData = async () => {
      if (location.state?.testData) {
        setTestData(location.state.testData);
        setLoading(false);
        return;
      }

      if (testId) {
        try {
          const endpoint = attemptId
            ? `/api/tests/${testId}/result/${attemptId}`
            : `/api/tests/${testId}/result`;
          const response = await apiClient.get(endpoint, {
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          if (response.data?.data) {
            const rawData = response.data.data;
            const questions = (rawData.questions || []).map((q, idx) => ({
              id: q.id || q._id || idx,
              question: q.text || q.questionText || q.question || "",
              options: q.options || [],
              correctOption:
                q.correctOption ??
                q.correct_option ??
                q.correct_option_id ??
                q.correctOptionId ??
                q.correctAnswer ??
                q.correct_answer ??
                q.correct ??
                q.answer,
              explanation: q.explanation || "",
              section: q.section || q.subject || "General",
              difficulty: q.difficulty || "Medium",
              topic: q.topic || "General",
              correctMarks: q.marks || 2,
              negativeMarks: q.negativeMarks || 0.5,
            }));
            const userAnswers = (rawData.questions || []).map((q) => {
              const ans =
                q.userAnswer ??
                q.selectedOption ??
                q.user_answer ??
                q.userChoice;
              const isSkipped =
                ans === undefined || ans === null || ans === "" || ans === -1;
              const correct =
                q.correctOption ??
                q.correct_option ??
                q.correct_option_id ??
                q.correctOptionId ??
                q.correctAnswer ??
                q.correct_answer ??
                q.correct ??
                q.answer;
              return {
                selectedOption: isSkipped ? null : Number(ans),
                isCorrect:
                  !isSkipped &&
                  correct !== undefined &&
                  correct !== null &&
                  Number(ans) === Number(correct),
                timeSpent: q.timeTaken || q.timeSpent || 0,
              };
            });
            setTestData({
              testTitle: rawData.testTitle || "Test Review",
              questions,
              userAnswers,
            });
          } else {
            setError("Result data not found");
          }
        } catch (err) {
          if (err.name !== "AbortError") {
            console.error("Failed to fetch test review data:", err);
            setError("Failed to fetch test review data");
          }
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      } else {
        navigate("/dashboard");
      }
    };

    fetchTestData();
    return () => controller.abort();
  }, [location, navigate, testId, attemptId]);

  const questions = useMemo(() => testData?.questions || [], [testData]);
  const userAnswers = useMemo(() => testData?.userAnswers || [], [testData]);

  const filteredQuestionIndices = useMemo(() => {
    return questions
      .map((_, idx) => idx)
      .filter((idx) => {
        const ans = userAnswers[idx];
        const isSkipped =
          ans?.selectedOption === null || ans?.selectedOption === undefined;
        const isCorrect = ans?.isCorrect;
        if (activeFilter === "correct") return isCorrect;
        if (activeFilter === "incorrect") return !isCorrect && !isSkipped;
        if (activeFilter === "unattempted") return isSkipped;
        return true;
      });
  }, [questions, userAnswers, activeFilter]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="text-sm font-bold text-gray-600 dark:text-gray-300">
            Loading Solution & Review...
          </p>
        </div>
      </div>
    );
  }

  if (error || !testData || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900">
        <div className="text-center bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 max-w-md">
          <p className="text-rose-600 dark:text-rose-400 font-bold mb-4">
            {error || "Test data not available."}
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex] || questions[0];
  const userAnswer = userAnswers[currentQuestionIndex];
  const isOriginalCorrect = userAnswer?.isCorrect;
  const isOriginalSkipped =
    userAnswer?.selectedOption === null ||
    userAnswer?.selectedOption === undefined;
  const originalChoiceIndex = isOriginalSkipped
    ? null
    : Number(userAnswer?.selectedOption);
  const currentResolveChoice = userReSolveAnswers[currentQuestionIndex];
  const rawCorrectOpt =
    currentQuestion?.correctOption ??
    currentQuestion?.correctAnswer ??
    currentQuestion?.correct_option ??
    currentQuestion?.correct;
  const resolvedCorrectOption =
    rawCorrectOpt !== undefined &&
    rawCorrectOpt !== null &&
    rawCorrectOpt !== ""
      ? Number(rawCorrectOpt)
      : null;

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleQuestionSelect = (index) => {
    setCurrentQuestionIndex(index);
    setShowPalette(false);
  };

  const handleReSolveOption = (optIndex) => {
    setUserReSolveAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: optIndex,
    }));
  };

  const getQuestionStatus = (index) => {
    const answer = userAnswers[index];
    if (
      !answer ||
      answer.selectedOption === undefined ||
      answer.selectedOption === null
    )
      return "not-answered";
    return answer.isCorrect ? "correct" : "incorrect";
  };

  const getStatusColor = (status) => {
    if (status === "correct") return "bg-emerald-500 text-white";
    if (status === "incorrect") return "bg-rose-500 text-white";
    return "bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-200";
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-gray-900 fixed inset-0 z-50">
      {/* ═══ TOP HEADER ═══ */}
      <header className="bg-slate-900 text-white border-b border-slate-800 h-16 flex items-center justify-between px-4 sm:px-6 shadow-md select-none z-30">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-sm sm:text-base text-white truncate max-w-[200px] sm:max-w-md">
              {testData.testTitle || "Solutions & Review"}
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:block">
              Detailed Answer Key & Explanations
            </p>
          </div>
        </div>

        {/* Top Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Interactive Re-solve Mode Toggle Button */}
          <button
            onClick={() => setInteractiveMode(!interactiveMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs ${
              interactiveMode
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-500/20"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            }`}
          >
            <RotateCcw
              className={`w-3.5 h-3.5 ${interactiveMode ? "animate-spin-once" : ""}`}
            />
            <span>{interactiveMode ? "Re-solve: ON" : "Re-solve Mode"}</span>
          </button>

          {/* Results Link */}
          <button
            onClick={() => {
              if (seriesId && testId) {
                navigate(`/${seriesId}/tests/${testId}/result`, {
                  state: { attemptId },
                });
              } else {
                navigate(-1);
              }
            }}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Result</span>
          </button>

          {/* Dashboard Link */}
          <button
            onClick={() => navigate("/dashboard")}
            className="hidden lg:flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-xs transition"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          {/* Mobile Palette Toggle */}
          <button
            onClick={() => setShowPalette(!showPalette)}
            className="md:hidden p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl"
            aria-label="Toggle Question Grid"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ═══ SUB-HEADER / FILTER BAR ═══ */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {[
            { id: "all", label: `All (${questions.length})` },
            {
              id: "correct",
              label: `Correct (${userAnswers.filter((a) => a.isCorrect).length})`,
              color:
                "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
            },
            {
              id: "incorrect",
              label: `Incorrect (${userAnswers.filter((a) => !a.isCorrect && a.selectedOption !== null && a.selectedOption !== undefined).length})`,
              color:
                "text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800",
            },
            {
              id: "unattempted",
              label: `Unattempted (${userAnswers.filter((a) => a.selectedOption === null || a.selectedOption === undefined).length})`,
              color:
                "text-slate-700 dark:text-gray-200 bg-slate-50 dark:bg-gray-900 border-slate-200 dark:border-gray-700",
            },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all whitespace-nowrap ${
                activeFilter === filter.id
                  ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                  : `hover:bg-gray-50 dark:hover:bg-gray-700 ${filter.color || "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"}`
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {userAnswers.some(
            (a) =>
              !a.isCorrect &&
              a.selectedOption !== null &&
              a.selectedOption !== undefined,
          ) && (
            <button
              onClick={() =>
                navigate(`/practice?mode=mistakes&testId=${testId}`)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-black transition shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Re-Practice Mistakes →
            </button>
          )}
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400 hidden sm:inline">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* ═══ MAIN QUESTION CONTAINER ═══ */}
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-gray-900 overflow-y-auto relative w-full">
          {/* Section Banner */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-8 py-2.5 flex justify-between items-center text-xs sm:text-sm">
            <div className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <span className="text-gray-400 dark:text-gray-500 uppercase text-[10px] tracking-wider">
                Section:
              </span>
              <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-800/60 font-extrabold">
                {currentQuestion.section || "General"}
              </span>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-gray-900 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 shadow-2xs text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                +{currentQuestion.correctMarks || 2} marks
              </span>
              <span className="text-gray-300 dark:text-gray-500">|</span>
              <span className="text-rose-500 font-bold">
                -{currentQuestion.negativeMarks || 0.5} neg
              </span>
            </div>
          </div>

          {/* Question & Solution Body */}
          <div className="p-4 sm:p-8 flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Question Header & Live Status */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-base shadow-sm">
                    Q{currentQuestionIndex + 1}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      Live Attempt Status
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {isOriginalSkipped ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-400 border border-slate-200 dark:border-gray-700">
                          <HelpCircle className="w-3.5 h-3.5" /> Unattempted
                          during Test
                        </span>
                      ) : isOriginalCorrect ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle className="w-3.5 h-3.5" /> Answered
                          Correctly
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800">
                          <XCircle className="w-3.5 h-3.5" /> Answered
                          Incorrectly
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {interactiveMode && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>
                      Interactive Resolve Active — Click options to test
                      yourself!
                    </span>
                  </div>
                )}
              </div>

              {/* Question Text */}
              <div className="bg-white dark:bg-gray-800 p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xs">
                <div className="text-gray-900 dark:text-white text-base sm:text-lg leading-relaxed font-medium">
                  <MathRenderer text={sanitizeHtml(currentQuestion.question)} />
                </div>
              </div>

              {/* Options Grid */}
              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => {
                  const optionLetter = String.fromCharCode(65 + index);
                  const isInitialChoice = originalChoiceIndex === index;
                  const isCurrentReSolve = currentResolveChoice === index;
                  const isCorrectOption =
                    resolvedCorrectOption !== null &&
                    !isNaN(resolvedCorrectOption) &&
                    index === resolvedCorrectOption;

                  let optionClass =
                    "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300";
                  let badgeText = null;
                  let badgeColor = "";

                  if (!interactiveMode) {
                    // Standard Review Display
                    if (isCorrectOption) {
                      optionClass =
                        "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-900/20 shadow-xs";
                      badgeText = "✓ Correct Answer";
                      badgeColor =
                        "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800";
                    } else if (isInitialChoice && !isOriginalCorrect) {
                      optionClass =
                        "border-rose-500 bg-rose-50/70 dark:bg-rose-900/20 shadow-xs";
                      badgeText = "✗ Your Choice (Wrong)";
                      badgeColor =
                        "bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800";
                    }
                  } else {
                    // Interactive Re-solve Mode
                    if (isCorrectOption && currentResolveChoice !== undefined) {
                      optionClass =
                        "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-900/20";
                    } else if (isCurrentReSolve && !isCorrectOption) {
                      optionClass =
                        "border-rose-500 bg-rose-50/70 dark:bg-rose-900/20";
                    } else if (isCurrentReSolve && isCorrectOption) {
                      optionClass =
                        "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-900/20";
                    }

                    if (isInitialChoice) {
                      badgeText = isOriginalCorrect
                        ? "Test Choice: ✓ Correct"
                        : "Test Choice: ✗ Incorrect";
                      badgeColor = isOriginalCorrect
                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800"
                        : "bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800";
                    }
                  }

                  return (
                    <div
                      key={index}
                      onClick={() =>
                        interactiveMode && handleReSolveOption(index)
                      }
                      className={`p-4 rounded-2xl border-2 ${optionClass} transition-all relative ${
                        interactiveMode
                          ? "cursor-pointer active:scale-[0.99]"
                          : "cursor-default"
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <span
                          className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm ${
                            isCorrectOption &&
                            (!interactiveMode ||
                              currentResolveChoice !== undefined)
                              ? "bg-emerald-600 text-white"
                              : isCurrentReSolve && !isCorrectOption
                                ? "bg-rose-600 text-white"
                                : isInitialChoice &&
                                    !isOriginalCorrect &&
                                    !interactiveMode
                                  ? "bg-rose-600 text-white"
                                  : "bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-200"
                          }`}
                        >
                          {optionLetter}
                        </span>

                        <div className="flex-1 min-w-0 pt-0.5 text-gray-900 dark:text-white text-sm sm:text-base font-medium">
                          <MathRenderer
                            text={sanitizeHtml(
                              typeof option === "object"
                                ? option?.text ||
                                    option?.en ||
                                    option?.value ||
                                    String(option)
                                : option,
                            )}
                          />
                        </div>

                        {/* Badges */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {badgeText && (
                            <span
                              className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${badgeColor}`}
                            >
                              {badgeText}
                            </span>
                          )}
                          {interactiveMode && isCurrentReSolve && (
                            <span
                              className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${
                                isCorrectOption
                                  ? "bg-emerald-600 text-white border-emerald-700"
                                  : "bg-rose-600 text-white border-rose-700"
                              }`}
                            >
                              {isCorrectOption
                                ? "Now Correct ✓"
                                : "Now Wrong ✗"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detailed Explanation */}
              {currentQuestion.explanation && (
                <div className="bg-gradient-to-br from-indigo-50/80 to-sky-50/80 dark:from-indigo-900/30 dark:to-sky-900/30 border border-indigo-200/80 dark:border-indigo-800/60 p-5 sm:p-6 rounded-2xl shadow-xs">
                  <h3 className="font-extrabold text-indigo-950 dark:text-indigo-200 text-sm sm:text-base mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Detailed Solution & Explanation
                  </h3>
                  <div className="text-gray-800 dark:text-gray-200 text-sm sm:text-base leading-relaxed">
                    <MathRenderer
                      text={sanitizeHtml(currentQuestion.explanation)}
                    />
                  </div>
                </div>
              )}

              {/* Meta Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                    Difficulty
                  </span>
                  <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200 capitalize mt-0.5 block">
                    {currentQuestion.difficulty || "Medium"}
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                    Topic
                  </span>
                  <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200 truncate mt-0.5 block">
                    {currentQuestion.topic || "General"}
                  </span>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xs col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                    Time Spent in Test
                  </span>
                  <span className="text-xs font-extrabold text-gray-800 dark:text-gray-200 mt-0.5 block">
                    {userAnswer?.timeSpent || 0} seconds
                  </span>
                </div>
              </div>

              {/* Theory Revision Link */}
              <div className="flex items-center justify-between p-3.5 bg-indigo-50/70 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/60 rounded-2xl flex-wrap gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-950 dark:text-indigo-200">
                  <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>
                    Revise{" "}
                    {currentQuestion.topic ||
                      currentQuestion.chapter ||
                      currentQuestion.subject ||
                      "this concept"}{" "}
                    in Study Notes
                  </span>
                </div>
                <Link
                  to="/study"
                  className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300 hover:text-indigo-900 dark:hover:text-indigo-200 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-2xs hover:shadow-xs transition-all"
                >
                  Open Study Material →
                </Link>
              </div>
            </div>
          </div>

          {/* Navigation Footer */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center max-w-4xl mx-auto w-full">
              <button
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
                className="flex-1 sm:flex-none border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-6 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-bold transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="inline w-4 h-4 mr-1.5" />
                Previous Question
              </button>

              <button
                onClick={handleNext}
                disabled={currentQuestionIndex === questions.length - 1}
                className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next Question
                <ChevronRight className="inline w-4 h-4 ml-1.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ═══ PALETTE SIDEBAR ═══ */}
        <div
          className={`w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto p-4 ${showPalette ? "block" : "hidden md:block"}`}
        >
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
            <h3 className="font-extrabold text-sm text-gray-900 dark:text-white uppercase tracking-wider">
              Question Navigator
            </h3>
            <button
              onClick={() => setShowPalette(false)}
              className="md:hidden p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-3 gap-2 mb-4 text-[10px] font-bold">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-md bg-emerald-500"></div>
              <span className="text-gray-600 dark:text-gray-300">Correct</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-md bg-rose-500"></div>
              <span className="text-gray-600 dark:text-gray-300">Wrong</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-md bg-slate-200 dark:bg-gray-700"></div>
              <span className="text-gray-600 dark:text-gray-300">Skipped</span>
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-5 gap-2">
            {filteredQuestionIndices.map((origIndex) => {
              const status = getQuestionStatus(origIndex);
              const isCurrent = origIndex === currentQuestionIndex;

              return (
                <button
                  key={origIndex}
                  onClick={() => handleQuestionSelect(origIndex)}
                  className={`
                    h-9 rounded-xl font-bold text-xs transition-all
                    ${getStatusColor(status)}
                    ${isCurrent ? "ring-2 ring-indigo-600 ring-offset-2 scale-105 shadow-md" : "hover:scale-105 opacity-90 hover:opacity-100"}
                  `}
                >
                  {origIndex + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Palette Overlay */}
      {showPalette && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-40 md:hidden"
          onClick={() => setShowPalette(false)}
        />
      )}
    </div>
  );
}
