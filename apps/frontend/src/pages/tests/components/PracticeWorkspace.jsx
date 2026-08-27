import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { practiceAPI } from "../../../shared/lib/practiceAPI";
import { sanitizeHtml } from "../../../shared/lib/sanitizeHtml";
import MathRenderer from "../../../shared/components/MathRenderer";
import KnowledgeVaultModal from "./KnowledgeVaultModal";
import {
  CheckCircle,
  XCircle,
  Lightbulb,
  Bookmark,
  MessageSquare,
  Sparkles,
  Layers,
  BookOpen,
  ThumbsUp,
  Plus,
  ArrowRight,
  Play,
  Eye,
} from "lucide-react";

export default function PracticeWorkspace({ session, onComplete, onExit }) {
  const [currentIdx, setCurrentIdx] = useState(session?.currentIndex || 0);
  const [question, setQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isChecked, setIsChecked] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [answerResults, setAnswerResults] = useState({});

  // Learning System Tabs & Data
  const [activeExplTab, setActiveExplTab] = useState("text"); // text | visual | video | formula
  const [explanations, setExplanations] = useState(null);
  const [approaches, setApproaches] = useState([]);
  const [similarQs, setSimilarQs] = useState([]);
  const [aiTutorResponse, setAiTutorResponse] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Vault Modal
  const [vaultOpen, setVaultOpen] = useState(false);

  // Community Approach Submit state
  const [newApproachText, setNewApproachText] = useState("");
  const [newApproachType, setNewApproachType] = useState("fastest");
  const [showSubmitApproach, setShowSubmitApproach] = useState(false);

  const totalQuestions = Number(
    session?.totalQuestions ?? session?.questions?.length ?? 0,
  );
  const answeredCount = Object.keys(answerResults).length;
  const correctCount = Object.values(answerResults).filter(Boolean).length;
  const accuracy =
    answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  useEffect(() => {
    loadQuestion(currentIdx);
  }, [currentIdx]);

  const loadQuestion = async (idx) => {
    try {
      if (!session?.id) {
        throw new Error("Practice session ID is missing");
      }
      setLoading(true);
      setIsChecked(false);
      setCheckResult(null);
      setSelectedOption(null);
      setAiTutorResponse(null);

      const q = await practiceAPI.getQuestion(session.id, idx);
      setQuestion(q);

      // Fetch supplementary learning data
      if (q?.id) {
        const [expl, apprs, sim] = await Promise.all([
          practiceAPI.getExplanations(q.id).catch(() => null),
          practiceAPI.getApproaches(q.id).catch(() => []),
          practiceAPI.getSimilarQuestions(q.id).catch(() => []),
        ]);
        setExplanations(expl);
        setApproaches(apprs || []);
        setSimilarQs(sim || []);
      }
    } catch {
      toast.error("Failed to load question");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAnswer = async () => {
    if (selectedOption === null || selectedOption === undefined) return;
    try {
      if (!session?.id) throw new Error("Practice session ID is missing");
      const res = await practiceAPI.checkAnswer(session.id, currentIdx, {
        selectedOption: selectedOption,
      });
      setCheckResult(res);
      setAnswerResults((prev) => ({
        ...prev,
        [currentIdx]: Boolean(res?.isCorrect),
      }));
      setIsChecked(true);
    } catch {
      toast.error("Failed to check answer");
    }
  };

  const handleAskAiTutor = async (promptType) => {
    try {
      setAiLoading(true);
      const res = await practiceAPI.askAiTutor({
        questionId: question.id,
        promptType,
        userAnswer: selectedOption,
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
    if (!newApproachText.trim()) return;
    try {
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
    }
  };

  const handleFinishSession = async () => {
    if (finishing) return;

    try {
      if (!session?.id) throw new Error("Practice session ID is missing");
      setFinishing(true);
      const result = await practiceAPI.completeSession(session.id);
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

      onComplete?.({
        ...result,
        questionsAttempted: completedTotal,
        correctCount: completedCorrect,
        wrongCount: completedWrong,
        skippedCount: completedSkipped,
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
      if (!session?.id) throw new Error("Practice session ID is missing");
      setSkipping(true);
      await practiceAPI.skipQuestion(session.id, currentIdx);
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

  if (loading || !question) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      {/* ── 1. HEADER / BREADCRUMB CONTEXT BAR ────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
          <span className="text-indigo-600 font-bold">Practice</span>
          <span>→</span>
          <span>{question.subject || "Subject"}</span>
          <span>→</span>
          <span>{question.topic || "Topic"}</span>
          <span>→</span>
          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
            {question.difficulty || "Difficulty not set"}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-bold">
          <span className="text-slate-600">
            Question {currentIdx + 1} / {totalQuestions}
          </span>
          <span className="text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            Accuracy: {accuracy}%
          </span>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              Exit
            </button>
          )}
        </div>
      </div>

      {/* ── 2. QUESTION WORKSPACE ──────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-xs mb-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Question {currentIdx + 1}
          </span>
          <button
            onClick={() => setVaultOpen(true)}
            className="inline-flex items-center text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-slate-200 transition"
          >
            <Bookmark className="w-3.5 h-3.5 mr-1 text-amber-500" /> Save to
            Knowledge Vault
          </button>
        </div>

        {/* Question Text */}
        <div className="text-base font-medium text-slate-900 leading-relaxed mb-6">
          <MathRenderer
            content={question.questionText || question.question_text}
          />
        </div>

        {/* Options */}
        <div className="space-y-3 mb-8">
          {question.options?.map((opt, i) => {
            const optKey = String.fromCharCode(65 + i);
            const isSelected = selectedOption === i;
            let style =
              "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50";

            const rawCheckCorrect =
              checkResult?.correctOption ??
              checkResult?.correct_option ??
              checkResult?.correct_option_id ??
              checkResult?.correctOptionId ??
              checkResult?.correctAnswer ??
              checkResult?.correct_answer ??
              checkResult?.correct ??
              checkResult?.answer;
            const isCorrectOption =
              isChecked &&
              rawCheckCorrect !== undefined &&
              rawCheckCorrect !== null &&
              (optKey === String(rawCheckCorrect).toUpperCase() ||
                i === Number(rawCheckCorrect) ||
                (typeof opt === "object"
                  ? opt.text === String(rawCheckCorrect)
                  : String(opt) === String(rawCheckCorrect)));

            if (isChecked) {
              if (isCorrectOption) {
                style =
                  "border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold";
              } else if (isSelected) {
                style = "border-rose-500 bg-rose-50 text-rose-900";
              } else {
                style = "border-slate-200 opacity-50 bg-slate-50";
              }
            } else if (isSelected) {
              style =
                "border-indigo-600 bg-indigo-50/60 text-indigo-900 font-semibold ring-1 ring-indigo-500";
            }

            return (
              <button
                key={i}
                disabled={isChecked}
                onClick={() => setSelectedOption(i)}
                className={`w-full text-left p-4 rounded-xl border transition-all flex items-start ${style}`}
              >
                <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs font-bold mr-3 flex-shrink-0 mt-0.5">
                  {optKey}
                </span>
                <div className="text-sm">
                  <MathRenderer
                    content={typeof opt === "object" ? opt.text : opt}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Check Answer Button / Transition */}
        {!isChecked ? (
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={handleSkipQuestion}
              disabled={skipping || finishing}
              className="px-5 py-3 rounded-xl font-bold text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              {skipping ? "Skipping…" : "Skip Question"}
            </button>
            <div className="flex justify-end">
              <button
                onClick={handleCheckAnswer}
                disabled={
                  selectedOption === null ||
                  selectedOption === undefined ||
                  skipping ||
                  finishing
                }
                className={`px-6 py-3 rounded-xl font-bold text-sm transition ${
                  selectedOption !== null && selectedOption !== undefined
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                Check Answer (Assessment → Learning)
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between mb-2 ${
              checkResult?.isCorrect
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}
          >
            <div className="flex items-center gap-2">
              {checkResult?.isCorrect ? (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              ) : (
                <XCircle className="w-5 h-5 text-rose-600" />
              )}
              <span className="font-bold text-sm">
                {checkResult?.isCorrect ? "Correct Answer!" : "Incorrect"}
              </span>
            </div>
            <span className="text-xs font-medium">
              Correct Choice: Option{" "}
              {(() => {
                const value =
                  checkResult?.correctOption ?? checkResult?.correctAnswer;
                const numeric = Number(value);
                return Number.isInteger(numeric) && numeric >= 0
                  ? String.fromCharCode(65 + numeric)
                  : value || "Unavailable";
              })()}
            </span>
          </div>
        )}
      </div>

      {/* ── 3. POST-CHECK LEARNING SYSTEM ────────────────────────────────── */}
      {isChecked && (
        <div className="space-y-6">
          {/* AI TUTOR INTERACTIVE PROMPTS */}
          <div className="bg-gradient-to-r from-indigo-900 to-slate-900 rounded-2xl p-5 text-white shadow-md">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-sm flex items-center text-indigo-200">
                <Sparkles className="w-4 h-4 mr-2 text-amber-400" /> Interactive
                AI Tutor
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
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center">
                <BookOpen className="w-5 h-5 text-indigo-600 mr-2" />{" "}
                Explanation System
              </h3>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                {["text", "visual", "video", "formula"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveExplTab(tab)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition ${
                      activeExplTab === tab
                        ? "bg-white text-indigo-600 shadow-xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {activeExplTab === "text" && (
              <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1 text-indigo-600">
                    Step-by-Step Solution
                  </h5>
                  <MathRenderer
                    content={
                      explanations?.text?.stepByStep ||
                      question.explanation ||
                      "Detailed step-by-step solution."
                    }
                  />
                </div>
                {explanations?.text?.shortcut && (
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200/60">
                    <h5 className="font-bold text-amber-900 text-xs uppercase tracking-wider mb-1">
                      ⚡ Exam Shortcut
                    </h5>
                    <MathRenderer content={explanations.text.shortcut} />
                  </div>
                )}
              </div>
            )}

            {activeExplTab === "visual" && (
              <div className="py-4 text-center">
                <div
                  className="inline-block p-4 bg-slate-50 border border-slate-200 rounded-xl"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(
                      explanations?.visual?.svgContent ||
                        "<p>Visual diagram placeholder</p>",
                    ),
                  }}
                />
                <p className="text-xs text-slate-500 mt-2">
                  Diagram schema representation of percentage change.
                </p>
              </div>
            )}

            {activeExplTab === "video" && (
              <div className="space-y-3">
                <div className="aspect-video bg-slate-900 rounded-xl flex items-center justify-center text-white text-xs">
                  <Play className="w-10 h-10 text-indigo-400" />
                </div>
                <p className="text-xs text-slate-500">
                  Short video explanation (180s duration)
                </p>
              </div>
            )}

            {activeExplTab === "formula" && (
              <div className="space-y-3">
                {explanations?.formula?.map((f, i) => (
                  <div
                    key={i}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  >
                    <span className="font-bold text-slate-900">{f.name}: </span>
                    <MathRenderer content={f.formulaLatex} />
                    <p className="text-slate-500 mt-1">{f.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* COMMUNITY APPROACHES / DISCUSSION */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center">
                <MessageSquare className="w-5 h-5 text-indigo-600 mr-2" /> 💬
                Discussion — {approaches.length} Approaches
              </h3>
              <button
                onClick={() => setShowSubmitApproach(!showSubmitApproach)}
                className="inline-flex items-center text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Share Approach
              </button>
            </div>

            {showSubmitApproach && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4 space-y-3">
                <select
                  value={newApproachType}
                  onChange={(e) => setNewApproachType(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200"
                >
                  <option value="fastest">⚡ Fastest Method</option>
                  <option value="traditional">👨‍🏫 Traditional Method</option>
                  <option value="logical">🧠 Logical Method</option>
                  <option value="exam_shortcut">🎯 Exam Shortcut</option>
                </select>
                <textarea
                  rows={3}
                  value={newApproachText}
                  onChange={(e) => setNewApproachText(e.target.value)}
                  placeholder="Explain your approach..."
                  className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleSubmitApproach}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700"
                >
                  Submit Approach
                </button>
              </div>
            )}

            <div className="space-y-3">
              {approaches.map((appr) => (
                <div
                  key={appr.id}
                  className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-mono uppercase">
                      {appr.approachType}
                    </span>
                    <button
                      onClick={() => handleUpvoteApproach(appr.id)}
                      className="inline-flex items-center text-xs font-bold text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg"
                    >
                      <ThumbsUp className="w-3 h-3 mr-1 text-indigo-500" />{" "}
                      {appr.upvotes}
                    </button>
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed font-medium mb-1">
                    {appr.content}
                  </p>
                  <div className="text-[10px] text-slate-400 font-semibold">
                    — Shared by {appr.authorName}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PRACTICE SIMILAR QUESTIONS */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="font-bold text-slate-900 text-base mb-3 flex items-center">
              <Layers className="w-5 h-5 text-indigo-600 mr-2" /> Want to master
              this concept?
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Practice level-by-level similar questions without losing context.
            </p>

            <div className="space-y-2">
              {similarQs.map((sim, i) => (
                <div
                  key={sim.id}
                  className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between"
                >
                  <div className="text-xs font-medium text-slate-800 truncate max-w-lg">
                    Level {i + 1}:{" "}
                    <MathRenderer
                      content={sim.questionText || sim.question_text}
                    />
                  </div>
                  <button className="text-xs font-bold text-indigo-600 hover:underline flex items-center">
                    Attempt <ArrowRight className="w-3 h-3 ml-1" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* NEXT QUESTION NAVIGATION */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleNextQuestion}
              disabled={finishing || skipping}
              className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition inline-flex items-center"
            >
              Next Question →
            </button>
          </div>
        </div>
      )}

      {/* KNOWLEDGE VAULT MODAL */}
      <KnowledgeVaultModal
        questionId={question.id}
        isOpen={vaultOpen}
        onClose={() => setVaultOpen(false)}
      />
    </div>
  );
}
