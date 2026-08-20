import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { practiceAPI } from "../../shared/lib/practiceAPI";
import { useAuth } from "../../shared/providers/AuthContext";
import MathRenderer from "../../shared/components/MathRenderer";
import Breadcrumb from "../../shared/components/common/Breadcrumb";
import KnowledgeVaultModal from "./components/KnowledgeVaultModal";
import FundamentalsGym from "./components/FundamentalsGym";
import PracticeWorkspace from "./components/PracticeWorkspace";
import PracticeTopicTree from "./components/PracticeTopicTree";

import {
  Zap,
  BookOpen,
  Target,
  Flame,
  Star,
  Award,
  Layers,
  Bookmark,
  CheckCircle,
  XCircle,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  Sparkles,
  AlertCircle,
  ArrowLeft,
  Play,
  Clock,
  ChevronDown,
  ShieldCheck,
  Lock,
  Gift,
  Compass,
  RotateCcw,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════════════
// EXAM LIST DATASET
// ════════════════════════════════════════════════════════════════════════════
const EXAM_OPTIONS = [
  {
    id: "ssc",
    name: "SSC Exams",
    label: "SSC CGL, CHSL, MTS, CPO, GD",
    category: "Staff Selection Commission",
  },
  {
    id: "railway",
    name: "Railway Exams",
    label: "NTPC, Group D, ALP, JE",
    category: "Indian Railways",
  },
  {
    id: "banking",
    name: "Banking Exams",
    label: "IBPS PO, Clerk, SBI PO, RRB",
    category: "Banking & Insurance",
  },
  {
    id: "upsc",
    name: "UPSC & Defence",
    label: "CSAT, CDS, NDA, AFCAT",
    category: "Civil Services & Defence",
  },
  {
    id: "state",
    name: "State PSCs",
    label: "UPPSC, BPSC, MPPSC, RAS",
    category: "State Level Exams",
  },
];

const SUBJECT_FILTERS = [
  { id: "all", label: "All Subjects", icon: "📚" },
  { id: "english", label: "English", icon: "📖" },
  { id: "gk", label: "General Knowledge", icon: "🏛️" },
  { id: "science", label: "General Science", icon: "🧪" },
  { id: "reasoning", label: "Logical Reasoning", icon: "🧩" },
  { id: "quant", label: "Quantitative Aptitude", icon: "🔢" },
  { id: "ca", label: "Current Affairs", icon: "📰" },
  { id: "hindi", label: "Hindi", icon: "📙" },
  { id: "computer", label: "Computer Knowledge", icon: "💻" },
  { id: "pyq", label: "Previous Year Questions", icon: "🏆" },
];

export default function PracticeLab() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [screen, setScreen] = useState("dashboard"); // dashboard | setup | session | fundamentals | complete | exam_practice | chapter_detail
  const [setupConfig, setSetupConfig] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [completeSummary, setCompleteSummary] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);

  // Exam Selection State
  const [selectedExam, setSelectedExam] = useState(() => {
    const saved = localStorage.getItem("trstprep_user_exam");
    return saved ? JSON.parse(saved) : null;
  });
  const [showExamModal, setShowExamModal] = useState(false);

  // Select Exam Action
  const handleSelectExam = (exam) => {
    setSelectedExam(exam);
    localStorage.setItem("trstprep_user_exam", JSON.stringify(exam));
    setShowExamModal(false);
    setScreen("exam_practice");
  };

  // Handle clicking "Exam & Concepts" card on Dashboard
  const handleOpenExamPractice = () => {
    if (!selectedExam) {
      setShowExamModal(true);
    } else {
      setScreen("exam_practice");
    }
  };

  // Start new practice session
  const handleStartSession = async (config) => {
    try {
      const session = await practiceAPI.startSession({
        mode: config.mode || "learn",
        subjectId: config.subjectId,
        chapterId: config.chapterId,
        topicId: config.topicId,
        testId: config.testId,
        difficulty: config.difficulty || "medium",
        targetCount: config.count || 20,
      });
      setActiveSession(session);
      setScreen("session");
    } catch (err) {
      toast.error(
        err?.response?.data?.error || "Failed to start practice session",
      );
    }
  };

  // Handle URL query parameters (e.g. ?mode=mistakes&testId=123)
  useEffect(() => {
    const modeParam = searchParams.get("mode");
    const testIdParam = searchParams.get("testId");
    const subjectIdParam = searchParams.get("subjectId");
    if (modeParam === "mistakes") {
      handleStartSession({
        mode: "mistakes",
        testId: testIdParam || undefined,
        subjectId: subjectIdParam || undefined,
        count: 25,
      });
    }
  }, [searchParams]);

  // Reset window scroll to top whenever screen changes (e.g. mobile card tap)
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [screen]);

  // Quick Smart Entry Point Launcher
  const handleLaunchSmartEntry = async (mode, topicId = null) => {
    await handleStartSession({
      mode,
      topicId,
      count: 15,
      difficulty: "medium",
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 font-sans">
      {/* One-Time Choose Exam Modal */}
      {showExamModal && (
        <ChooseExamModal
          onSelectExam={handleSelectExam}
          onClose={() => setShowExamModal(false)}
        />
      )}

      {/* Top Header Breadcrumb */}
      {screen === "dashboard" && (
        <div className="bg-white dark:bg-gray-800 border-b border-slate-100 dark:border-gray-700">
          <div className="max-w-6xl mx-auto px-4">
            <Breadcrumb
              items={[{ label: "Home", path: "/" }, { label: "Practice Lab" }]}
            />
          </div>
        </div>
      )}

      {/* Screen 1: Dashboard Hub */}
      {screen === "dashboard" && (
        <PracticeHubDashboard
          user={user}
          selectedExam={selectedExam}
          onOpenExamPractice={handleOpenExamPractice}
          onOpenSetup={(config) => {
            setSetupConfig(config);
            setScreen("setup");
          }}
          onOpenFundamentals={() => setScreen("fundamentals")}
          onLaunchSmart={handleLaunchSmartEntry}
          onResume={async (session) => {
            try {
              const fullSession = await practiceAPI.getSession(session.id);
              setActiveSession(fullSession);
              setScreen("session");
            } catch {
              toast.error("Failed to resume session");
            }
          }}
        />
      )}

      {/* Screen: Exam Practice Hub (Two-Column Layout) */}
      {screen === "exam_practice" && selectedExam && (
        <ExamPracticeHub
          selectedExam={selectedExam}
          onChangeExam={() => setShowExamModal(true)}
          onBack={() => setScreen("dashboard")}
          onStartChapter={(chapter) => {
            setSelectedChapter(chapter);
            setScreen("chapter_detail");
          }}
        />
      )}

      {/* Screen: Chapter Detail (Topics left, Practice Sets right) */}
      {screen === "chapter_detail" && selectedChapter && (
        <ChapterDetailView
          chapter={selectedChapter}
          selectedExam={selectedExam}
          onBack={() => setScreen("exam_practice")}
          onStartSession={(config) => handleStartSession(config)}
        />
      )}

      {/* Screen 2: Setup Wizard */}
      {screen === "setup" && (
        <PracticeSetupWizard
          initialConfig={setupConfig}
          onBack={() => setScreen("dashboard")}
          onStart={(config) => handleStartSession(config)}
        />
      )}

      {/* Screen 3: Fundamentals Gym */}
      {screen === "fundamentals" && (
        <FundamentalsGym onBack={() => setScreen("dashboard")} />
      )}

      {/* Screen 4: 3-Layer Practice Workspace */}
      {screen === "session" && activeSession && (
        <PracticeWorkspace
          session={activeSession}
          onExit={() => setScreen("dashboard")}
          onComplete={(summary) => {
            const attempted =
              activeSession?.answers?.length || activeSession?.targetCount || 0;
            const correct =
              activeSession?.answers?.filter((a) => a.isCorrect)?.length || 0;
            const wrong = Math.max(0, attempted - correct);
            const calcAccuracy =
              attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
            const avgTime =
              activeSession?.timeSpent && attempted > 0
                ? Math.round(activeSession.timeSpent / attempted)
                : 35;

            setCompleteSummary(
              summary || {
                questionsAttempted: attempted,
                correctCount: correct,
                wrongCount: wrong,
                accuracy: calcAccuracy,
                avgTimeSeconds: avgTime,
                conceptsMastered: [],
                conceptsNeedsPractice: [],
              },
            );
            setScreen("complete");
          }}
        />
      )}

      {/* Screen 5: End of Session Mastery Screen */}
      {screen === "complete" && completeSummary && (
        <PracticeCompleteScreen
          summary={completeSummary}
          onDashboard={() => setScreen("dashboard")}
          onRestartSession={() => setScreen("setup")}
          onPracticeWeakTopic={() => handleLaunchSmartEntry("weak_topic")}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ONE-TIME CHOOSE EXAM MODAL
// ════════════════════════════════════════════════════════════════════════════
function ChooseExamModal({ onSelectExam, onClose }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="choose-exam-title"
      className="fixed inset-0 z-[99999] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-gray-700 p-5 sm:p-7 md:p-8 max-w-xl w-full shadow-2xl space-y-5 sm:space-y-6 my-auto max-h-[90vh] overflow-y-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2.5 sm:px-3 py-1 rounded-full inline-block">
              Personalize Your Practice
            </span>
            <h2
              id="choose-exam-title"
              className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1.5"
            >
              Choose Target Exam
            </h2>
            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
              Select the exam you are preparing for to personalize your concept
              questions.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-400 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300 rounded-xl hover:bg-slate-100 dark:hover:bg-gray-700 transition shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2.5 sm:space-y-3">
          {EXAM_OPTIONS.map((exam) => (
            <div
              key={exam.id}
              onClick={() => onSelectExam(exam)}
              className="p-3.5 sm:p-4 bg-slate-50 dark:bg-gray-900/80 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:border-indigo-300 dark:hover:border-indigo-800 border border-slate-200 dark:border-gray-700 rounded-xl sm:rounded-2xl cursor-pointer transition flex items-center justify-between group gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition truncate">
                  {exam.name}
                </div>
                <div className="text-[11px] sm:text-xs text-slate-500 dark:text-gray-400 font-medium truncate">
                  {exam.label}
                </div>
              </div>
              <span className="px-2.5 sm:px-3 py-1 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold border border-slate-200 dark:border-gray-700 group-hover:bg-indigo-600 group-hover:text-white transition shrink-0">
                Select →
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ════════════════════════════════════════════════════════════════════════════
// EXAM PRACTICE HUB SCREEN (TWO-COLUMN MASTER-DETAIL LAYOUT)
// Subjects on Left • Content & Chapters on Right
// ════════════════════════════════════════════════════════════════════════════
function ExamPracticeHub({
  selectedExam,
  onChangeExam,
  onBack,
  onStartChapter,
}) {
  const { data: dbSubjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ["practice-subjects"],
    queryFn: practiceAPI.getSubjects,
    staleTime: 5 * 60 * 1000,
  });

  // Dynamic DB Subjects with icons & chapter mappings
  const subjectsList =
    dbSubjects && dbSubjects.length > 0
      ? [
          { id: "all", label: "All Subjects", icon: "📚" },
          ...dbSubjects.map((s) => ({
            id: String(s.id),
            label: s.title || s.label,
            icon:
              s.icon ||
              (s.title?.toLowerCase().includes("quant") ||
              s.title?.toLowerCase().includes("math")
                ? "🔢"
                : s.title?.toLowerCase().includes("reason")
                  ? "🧩"
                  : s.title?.toLowerCase().includes("science")
                    ? "🧪"
                    : "📖"),
            chapters: s.chapters || [],
          })),
        ]
      : SUBJECT_FILTERS;

  const [activeSubject, setActiveSubject] = useState("all");

  // Collect chapters based on active subject filter from live DB subjects
  const getFilteredChapters = () => {
    if (!dbSubjects || dbSubjects.length === 0) {
      return [];
    }

    if (activeSubject === "all") {
      return dbSubjects.flatMap((s) => s.chapters || []);
    }

    const matchedSubject = dbSubjects.find(
      (s) =>
        String(s.id) === String(activeSubject) ||
        s.slug === activeSubject ||
        s.title?.toLowerCase() === String(activeSubject).toLowerCase(),
    );

    return matchedSubject?.chapters || [];
  };

  const chaptersList = getFilteredChapters();
  const currentSubjectObj =
    subjectsList.find((s) => String(s.id) === String(activeSubject)) ||
    subjectsList[1] ||
    subjectsList[0];

  return (
    <div className="max-w-7xl mx-auto px-4 pt-3 pb-6 space-y-4">
      {/* Top Bar: Back button */}
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center text-sm font-semibold text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Workspace
        </button>
      </div>

      {/* Header Hero Banner with Active Exam Selector Embedded */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-2xl p-4 md:p-5 text-white shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider bg-white/20 text-indigo-100 px-3 py-1 rounded-full mb-2 inline-block">
            {selectedExam.name} Exam Practice
          </span>
          <h1 className="text-3xl font-black">
            {selectedExam.name} Free Practice Questions
          </h1>
          <p className="text-xs text-indigo-200 mt-1 max-w-xl">
            Syllabus-aligned questions fetched directly from your active
            database across all subjects with concept tracking.
          </p>
        </div>

        {/* Embedded Active Exam Switcher Widget */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3.5 md:p-4 rounded-2xl space-y-1.5 min-w-[240px]">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-200">
            Active Target Exam
          </div>
          <button
            onClick={onChangeExam}
            className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 text-indigo-950 dark:text-white hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl text-xs font-black transition flex items-center justify-between shadow-xs gap-2"
          >
            <span className="flex items-center gap-1.5 truncate">
              🎯 {selectedExam.name} ({selectedExam.label.split(",")[0]})
            </span>
            <ChevronDown className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          </button>
        </div>
      </div>

      {/* ── TWO-COLUMN MASTER-DETAIL LAYOUT: SUBJECTS LEFT, CONTENT RIGHT ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: SUBJECTS SIDEBAR (col-span-3) — sticky, self-contained height */}
        <div
          className="md:col-span-3 bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 shadow-2xs sticky top-4 flex flex-col"
          style={{ maxHeight: "calc(100vh - 80px)" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-gray-700 flex-shrink-0">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-gray-500">
              Subjects
            </span>
            {subjectsLoading && (
              <div className="w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          <div className="overflow-y-auto flex-1 p-3 space-y-1">
            {subjectsList.map((s) => {
              const isActive = String(activeSubject) === String(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSubject(s.id)}
                  className={`w-full p-3 rounded-2xl text-left text-xs font-bold transition flex items-center justify-between group ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-700 dark:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{s.icon}</span>
                    <span>{s.label}</span>
                  </div>
                  <ArrowRight
                    className={`w-3.5 h-3.5 transition ${isActive ? "text-white opacity-100" : "text-slate-300 dark:text-gray-500 opacity-0 group-hover:opacity-100"}`}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: CHAPTERS CONTENT (col-span-9) — scrolls to match left sidebar height */}
        <div
          className="md:col-span-9 flex flex-col"
          style={{ maxHeight: "calc(100vh - 80px)" }}
        >
          {/* Chapter Cards Header — fixed, doesn't scroll */}
          <div className="flex items-center justify-between mb-5 flex-shrink-0">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center">
              <span className="text-xl mr-2">{currentSubjectObj.icon}</span>{" "}
              {currentSubjectObj.label} Practice Drills ({chaptersList.length}{" "}
              Chapters)
            </h3>
            <span className="text-xs font-bold text-slate-400 dark:text-gray-500 bg-slate-100 dark:bg-gray-700 px-3 py-1 rounded-full">
              Syllabus Aligned
            </span>
          </div>

          {/* Chapter Cards Grid — scrollable */}
          <div className="overflow-y-auto flex-1 pr-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {chaptersList.map((ch, idx) => (
                <div
                  key={idx}
                  onClick={() => onStartChapter(ch)}
                  className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-6 hover:border-indigo-400 dark:hover:border-indigo-800 hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-full">
                        {ch.badge}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                        {ch.tag}
                      </span>
                    </div>
                    <h4 className="font-extrabold text-slate-900 dark:text-white text-base mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                      {ch.title}
                    </h4>
                    <p className="text-xs font-bold text-slate-400 dark:text-gray-500">
                      {ch.count} Practice Questions
                    </p>
                  </div>

                  <button className="w-full mt-6 py-2.5 bg-slate-50 dark:bg-gray-900 text-slate-800 dark:text-gray-200 rounded-xl text-xs font-bold group-hover:bg-indigo-600 group-hover:text-white transition flex items-center justify-center gap-1.5">
                    <Play className="w-3.5 h-3.5 fill-current" /> Start Practice
                    →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── FULL-WIDTH SECTION: PASS BANNER + EXPLORE SIMILAR ── */}

      {/* PASS NEW PROMO BANNER — full width below both columns */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-3xl p-6 md:p-8 text-white shadow-md flex flex-wrap items-center justify-between gap-6">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider bg-white/20 text-amber-100 px-3 py-1 rounded-full mb-2 inline-block">
            passNew • Trstprep Pass
          </span>
          <h3 className="text-2xl font-black">
            Unlock All Practice of All Exams with Pass!
          </h3>
          <p className="text-xs text-amber-100 mt-1 max-w-lg">
            Get unlimited access to 50,000+ questions, official PYPs, re-attempt
            mode, and AI doubt support.
          </p>

          <div className="flex flex-wrap gap-2 mt-4">
            {[
              "Mock Tests",
              "Live Tests",
              "Study Notes",
              "Doubt Support",
              "PYPs",
              "Re-Attempt Mode",
              "Unlimited Practice",
            ].map((feat, i) => (
              <span
                key={i}
                className="text-[11px] font-bold bg-white/20 text-white px-2.5 py-1 rounded-lg"
              >
                ✓ {feat}
              </span>
            ))}
          </div>
        </div>

        <button className="px-6 py-3.5 bg-white dark:bg-gray-800 text-amber-800 dark:text-amber-200 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-amber-50 dark:hover:bg-amber-900/20 transition shadow-sm">
          Upgrade to Pass →
        </button>
      </div>

      {/* EXPLORE SIMILAR PRACTICE — full width below both columns */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-6 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
          <Compass className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mr-2" />{" "}
          Explore Similar Practice
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div
            onClick={() => onStartChapter({ title: "Percentage Change" })}
            className="p-4 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-2xl hover:border-indigo-300 dark:hover:border-indigo-800 cursor-pointer transition"
          >
            <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
              🔥 Similar Concept
            </div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              Percentage Increase & Decrease
            </div>
            <div className="text-xs text-slate-400 dark:text-gray-500 mt-1">
              15 Practice Questions
            </div>
          </div>

          <div
            onClick={() => onStartChapter({ title: "Profit & Loss" })}
            className="p-4 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-2xl hover:border-indigo-300 dark:hover:border-indigo-800 cursor-pointer transition"
          >
            <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
              🧠 Linked Topic
            </div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              Discount & Marked Price
            </div>
            <div className="text-xs text-slate-400 dark:text-gray-500 mt-1">
              20 Practice Questions
            </div>
          </div>

          <div
            onClick={() => onStartChapter({ title: "Ratio & Proportion" })}
            className="p-4 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-2xl hover:border-indigo-300 dark:hover:border-indigo-800 cursor-pointer transition"
          >
            <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
              📖 Recommended PYQ
            </div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">
              Ratio & Proportion SSC PYQs
            </div>
            <div className="text-xs text-slate-400 dark:text-gray-500 mt-1">
              25 Official Qs
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// CHAPTER DETAIL VIEW
// Topics on Left • Practice Sets on Right
// ════════════════════════════════════════════════════════════════════════════
function ChapterDetailView({ chapter, selectedExam, onBack, onStartSession }) {
  const [activeTopic, setActiveTopic] = useState(null);

  // Fetch topics from DB using chapter.id (numeric) if available
  const { data: chapterData, isLoading } = useQuery({
    queryKey: ["chapter-topics", chapter?.id],
    queryFn: () => practiceAPI.getChapterTopics(chapter.id),
    enabled: !!chapter?.id && !isNaN(Number(chapter.id)),
    staleTime: 5 * 60 * 1000,
  });

  // DB topics if available, else build fallback from chapter data
  const topics =
    chapterData?.topics && chapterData.topics.length > 0
      ? chapterData.topics
      : chapter.topics || [
          {
            id: "intro",
            name: "Introduction & Basics",
            questionCount: 30,
            easyCount: 15,
            mediumCount: 10,
            hardCount: 5,
            accuracy: null,
            attempts: 0,
          },
          {
            id: "core",
            name: "Core Concepts",
            questionCount: 45,
            easyCount: 10,
            mediumCount: 25,
            hardCount: 10,
            accuracy: null,
            attempts: 0,
          },
          {
            id: "advanced",
            name: "Advanced Problems",
            questionCount: 35,
            easyCount: 5,
            mediumCount: 15,
            hardCount: 15,
            accuracy: null,
            attempts: 0,
          },
          {
            id: "pyq",
            name: "Previous Year Questions",
            questionCount: 40,
            easyCount: 8,
            mediumCount: 22,
            hardCount: 10,
            accuracy: null,
            attempts: 0,
          },
        ];

  // Auto-select first topic
  const currentTopic = activeTopic || topics[0] || null;

  const PRACTICE_SETS = [
    {
      id: "quick",
      label: "⚡ Quick Practice",
      desc: "10 questions · Mixed levels",
      count: 10,
      difficulty: "mixed",
      color: "indigo",
      bg: "bg-indigo-50 dark:bg-indigo-900/30",
      border: "border-indigo-200 dark:border-indigo-800",
      text: "text-indigo-700 dark:text-indigo-300",
      btn: "bg-indigo-600 hover:bg-indigo-700",
    },
    {
      id: "easy",
      label: "🟢 Easy Set",
      desc: "15 easy questions · Build confidence",
      count: 15,
      difficulty: "easy",
      color: "emerald",
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      border: "border-emerald-200 dark:border-emerald-800",
      text: "text-emerald-700 dark:text-emerald-300",
      btn: "bg-emerald-600 hover:bg-emerald-700",
    },
    {
      id: "medium",
      label: "🟡 Medium Set",
      desc: "15 medium questions · Exam level",
      count: 15,
      difficulty: "medium",
      color: "amber",
      bg: "bg-amber-50 dark:bg-amber-900/20",
      border: "border-amber-200 dark:border-amber-800",
      text: "text-amber-700 dark:text-amber-300",
      btn: "bg-amber-500 hover:bg-amber-600",
    },
    {
      id: "hard",
      label: "🔴 Hard Set",
      desc: "10 hard questions · Challenge mode",
      count: 10,
      difficulty: "hard",
      color: "red",
      bg: "bg-red-50 dark:bg-red-900/20",
      border: "border-red-200 dark:border-red-800",
      text: "text-red-700 dark:text-red-300",
      btn: "bg-red-600 hover:bg-red-700",
    },
    {
      id: "full",
      label: "🎯 Full Chapter Practice",
      desc: "25 questions · All levels",
      count: 25,
      difficulty: "mixed",
      color: "purple",
      bg: "bg-purple-50 dark:bg-purple-900/20",
      border: "border-purple-200 dark:border-purple-800",
      text: "text-purple-700 dark:text-purple-300",
      btn: "bg-purple-600 hover:bg-purple-700",
    },
  ];

  const getAvailableSets = (topic) => {
    if (!topic) return PRACTICE_SETS;
    return PRACTICE_SETS.filter((ps) => {
      if (ps.difficulty === "easy")
        return (topic.easyCount || 0) > 0 || !chapterData;
      if (ps.difficulty === "medium")
        return (topic.mediumCount || 0) > 0 || !chapterData;
      if (ps.difficulty === "hard")
        return (topic.hardCount || 0) > 0 || !chapterData;
      return (topic.questionCount || 0) > 0 || !chapterData;
    });
  };

  const handleStartSet = (practiceSet) => {
    onStartSession({
      mode: "learn",
      chapterId: chapter.id,
      topicId: currentTopic?.id || null,
      difficulty:
        practiceSet.difficulty === "mixed" ? undefined : practiceSet.difficulty,
      count: practiceSet.count,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Breadcrumb nav */}
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-gray-400 font-medium flex-wrap">
        <button
          onClick={onBack}
          className="hover:text-indigo-600 dark:hover:text-indigo-400 transition flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          {selectedExam?.name || "Practice"}
        </button>
        <span className="text-slate-300 dark:text-gray-500">/</span>
        <span className="text-slate-900 dark:text-white font-bold truncate">
          {chapter.title}
        </span>
      </div>

      {/* Chapter Hero Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 md:p-8 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 text-indigo-200 px-3 py-1 rounded-full mb-2 inline-block">
              Chapter Practice
            </span>
            <h1 className="text-2xl md:text-3xl font-black mt-1 leading-tight">
              {chapter.title}
            </h1>
            {chapterData && (
              <p className="text-indigo-200 text-sm mt-2">
                {chapterData.totalTopics} Topics · {chapterData.totalQuestions}{" "}
                Practice Questions
              </p>
            )}
          </div>
          <div className="flex gap-3 flex-wrap">
            {[
              {
                label: "Topics",
                value: chapterData?.totalTopics || topics.length,
                icon: "📋",
              },
              {
                label: "Questions",
                value: chapterData?.totalQuestions || chapter.count || "—",
                icon: "❓",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-3 text-center min-w-[80px]"
              >
                <div className="text-xl">{stat.icon}</div>
                <div className="text-lg font-black">{stat.value}</div>
                <div className="text-[10px] font-bold uppercase text-indigo-300">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TWO-COLUMN: TOPICS LEFT + PRACTICE SETS RIGHT ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* LEFT: Topics Sidebar */}
        <div className="md:col-span-4 bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 shadow-xs sticky top-6">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-gray-700">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-gray-500">
              Topics in this Chapter
            </span>
            {isLoading && (
              <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          <div className="p-3 space-y-1 max-h-[65vh] overflow-y-auto">
            {topics.map((topic, idx) => {
              const isActive =
                currentTopic?.id === topic.id || (!activeTopic && idx === 0);
              const hasAccuracy = topic.accuracy !== null && topic.attempts > 0;
              return (
                <button
                  key={topic.id || idx}
                  onClick={() => setActiveTopic(topic)}
                  className={`w-full p-3.5 rounded-2xl text-left transition group ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div
                        className={`font-bold text-sm leading-snug ${isActive ? "text-white" : "text-slate-900 dark:text-white"}`}
                      >
                        {topic.name}
                      </div>
                      <div
                        className={`text-xs mt-0.5 ${isActive ? "text-indigo-200" : "text-slate-400 dark:text-gray-500"}`}
                      >
                        {topic.questionCount || 0} questions
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {hasAccuracy ? (
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            topic.accuracy >= 80
                              ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                              : topic.accuracy >= 50
                                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                          } ${isActive ? "opacity-90" : ""}`}
                        >
                          {topic.accuracy}%
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isActive ? "bg-white/20 text-indigo-100" : "bg-slate-100 dark:bg-gray-700 text-slate-400 dark:text-gray-500"}`}
                        >
                          New
                        </span>
                      )}
                      <ArrowRight
                        className={`w-3.5 h-3.5 transition ${isActive ? "text-white" : "text-slate-300 dark:text-gray-500 opacity-0 group-hover:opacity-100"}`}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Practice Sets Panel */}
        <div className="md:col-span-8 space-y-5">
          {/* Selected topic header */}
          {currentTopic && (
            <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-5 shadow-xs">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mb-1">
                    Selected Topic
                  </div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">
                    {currentTopic.name}
                  </h2>
                  {currentTopic.description && (
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-1 max-w-md">
                      {currentTopic.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  {[
                    {
                      label: "Easy",
                      count: currentTopic.easyCount || 0,
                      color: "emerald",
                    },
                    {
                      label: "Medium",
                      count: currentTopic.mediumCount || 0,
                      color: "amber",
                    },
                    {
                      label: "Hard",
                      count: currentTopic.hardCount || 0,
                      color: "red",
                    },
                  ].map((d) => (
                    <div key={d.label} className="text-center">
                      <div
                        className={`text-base font-black text-${d.color}-600`}
                      >
                        {d.count}
                      </div>
                      <div
                        className={`text-[10px] font-bold text-${d.color}-500 uppercase tracking-wider`}
                      >
                        {d.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Practice Set Cards */}
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-gray-500 mb-3 px-1">
              Choose a Practice Set
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {getAvailableSets(currentTopic).map((ps) => (
                <div
                  key={ps.id}
                  onClick={() => handleStartSet(ps)}
                  className={`${ps.bg} border ${ps.border} rounded-3xl p-5 cursor-pointer hover:shadow-md transition group`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className={`font-extrabold text-base ${ps.text}`}>
                      {ps.label}
                    </h4>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${ps.text} bg-white/60 dark:bg-gray-800/60 px-2 py-0.5 rounded-lg`}
                    >
                      {ps.count} Qs
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mb-4 leading-relaxed">
                    {ps.desc}
                  </p>
                  <button
                    className={`w-full py-2.5 ${ps.btn} text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> Start Practice
                    →
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Info note */}
          <div className="bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-2xl p-4 text-xs text-slate-500 dark:text-gray-400 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <span>
              Select any topic from the left and choose a practice set to begin.
              Your accuracy and progress are tracked per topic.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCREEN 1: PRACTICE HUB DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
function PracticeHubDashboard({
  user: _user,
  selectedExam,
  onOpenExamPractice,
  onOpenSetup,
  onOpenFundamentals,
  onLaunchSmart,
  onResume,
}) {
  const { data: dash, isLoading } = useQuery({
    queryKey: ["practice-dashboard"],
    queryFn: practiceAPI.getDashboard,
    staleTime: 30 * 1000,
  });

  const { data: mistakesData } = useQuery({
    queryKey: ["practice-mistakes-count"],
    queryFn: practiceAPI.getMistakesCount,
    staleTime: 15 * 1000,
  });

  const { data: treeData } = useQuery({
    queryKey: ["practice-tree"],
    queryFn: practiceAPI.getTree,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !dash) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 flex justify-center">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const streak = dash.streak || {};
  const goal = dash.todaysGoal || { done: 12, target: 20 };
  const mistakeCount = Number(mistakesData?.count ?? dash?.mistakesCount ?? 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Title & Daily Streak */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Practice Workspace
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Build core concepts, train calculation speed, and master exam
            topics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 px-4 py-2 flex items-center gap-2.5 shadow-xs">
            <Flame className="w-5 h-5 text-orange-500" />
            <div>
              <div className="text-lg font-black text-slate-900 dark:text-white leading-none">
                {streak.currentStreak || 1}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                Day streak
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 px-4 py-2 flex items-center gap-2.5 shadow-xs">
            <Star className="w-5 h-5 text-indigo-500" />
            <div>
              <div className="text-lg font-black text-slate-900 dark:text-white leading-none">
                {streak.totalCorrect || 42}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                Correct Total
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 📖 Mistake Book (गलती सुधार) 1-Click Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border border-amber-500/20 rounded-3xl p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-md">
                Mistake Notebook
              </span>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                Cross-Platform Mistakes
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
              Re-Practice Past Incorrect Questions
            </h3>
            <p className="text-xs text-slate-600 dark:text-gray-400 max-w-xl">
              {mistakeCount > 0
                ? `You have ${mistakeCount} questions answered incorrectly across mock tests & practice sets. Turn your mistakes into mastered concepts.`
                : "No mistakes pending! Every question you miss in tests and practice will appear here for targeted revision."}
            </p>
          </div>
        </div>

        <button
          onClick={() => onLaunchSmart("mistakes")}
          disabled={mistakeCount === 0}
          className={`px-5 py-2.5 rounded-xl font-black text-xs transition flex items-center gap-2 shadow-xs ${
            mistakeCount > 0
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 cursor-pointer"
              : "bg-slate-200 dark:bg-gray-700 text-slate-400 dark:text-gray-500 cursor-not-allowed"
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          {mistakeCount > 0
            ? `Re-Practice ${mistakeCount} Mistakes →`
            : "No Pending Mistakes"}
        </button>
      </div>

      {/* 🧮 5-LAYER HUBS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Hub 1: Fundamentals */}
        <div
          onClick={onOpenFundamentals}
          className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white cursor-pointer hover:shadow-lg transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl">🧮</span>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-white/20 px-3 py-1 rounded-full text-indigo-100">
                Calculation Gym
              </span>
            </div>
            <h3 className="text-xl font-extrabold mb-1">Fundamentals</h3>
            <p className="text-xs text-indigo-100 leading-relaxed mb-6">
              Tables (1–30), Squares (1–50), Cubes, Roots, Fractions ↔ %, Ratios
              & Triplets for 5x exam calculation speed.
            </p>
          </div>
          <button className="w-full py-2.5 bg-white dark:bg-gray-800 text-indigo-700 dark:text-white rounded-xl text-xs font-black group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition">
            Train Calculation Speed →
          </button>
        </div>

        {/* Hub 2: Exam & Concept Practice */}
        <div
          onClick={onOpenExamPractice}
          className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-6 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-800 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl">📚</span>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-3 py-1 rounded-full">
                {selectedExam ? selectedExam.name : "Choose Exam"}
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
              Exam & Concepts
            </h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed mb-6">
              Targeted practice questions across SSC, Railway, Banking, UPSC.
              Select subject, topic, and difficulty.
            </p>
          </div>
          <button className="w-full py-2.5 bg-slate-100 dark:bg-gray-700 text-slate-800 dark:text-gray-200 rounded-xl text-xs font-bold group-hover:bg-indigo-600 group-hover:text-white transition">
            {selectedExam
              ? `Practice ${selectedExam.name} Questions →`
              : "Select Exam to Practice →"}
          </button>
        </div>

        {/* Hub 3: Smart AI Practice */}
        <div
          onClick={() => onLaunchSmart("weak_topic")}
          className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-6 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-800 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-3xl">🎯</span>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full">
                Personalized AI
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
              Smart Practice
            </h3>
            <p className="text-xs text-slate-500 dark:text-gray-400 leading-relaxed mb-6">
              AI-driven speed drills and weak-topic reinforcement calculated
              from your past test performance.
            </p>
          </div>
          <button className="w-full py-2.5 bg-slate-100 dark:bg-gray-700 text-slate-800 dark:text-gray-200 rounded-xl text-xs font-bold group-hover:bg-amber-500 group-hover:text-white transition">
            Start Smart Drill →
          </button>
        </div>
      </div>

      {/* SMART ENTRY POINTS */}
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center">
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mr-2" />{" "}
          Recommended Entry Points
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => onLaunchSmart("weak_topic")}
            className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 hover:border-rose-300 dark:hover:border-rose-800 cursor-pointer transition shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center">
                🔥 Weak Topic
              </span>
              <span className="text-[10px] font-mono bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded">
                42% Accuracy
              </span>
            </div>
            <div className="font-bold text-slate-900 dark:text-white text-sm mb-1">
              Percentage Change
            </div>
            <p className="text-xs text-slate-400 dark:text-gray-500">
              Needs reinforcement before next test
            </p>
          </div>

          <div
            onClick={() => onLaunchSmart("learn")}
            className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-800 cursor-pointer transition shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center">
                🧠 Continue Learning
              </span>
              <span className="text-[10px] font-mono bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                In Progress
              </span>
            </div>
            <div className="font-bold text-slate-900 dark:text-white text-sm mb-1">
              Profit & Loss
            </div>
            <p className="text-xs text-slate-400 dark:text-gray-500">
              Chapter 4 of Arithmetic
            </p>
          </div>

          <div
            onClick={() => onLaunchSmart("mistakes")}
            className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-800 cursor-pointer transition shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center">
                📖 Revision Due
              </span>
              <span className="text-[10px] font-mono bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded">
                8 Questions
              </span>
            </div>
            <div className="font-bold text-slate-900 dark:text-white text-sm mb-1">
              Ratio & Proportion
            </div>
            <p className="text-xs text-slate-400 dark:text-gray-500">
              Spaced repetition interval due
            </p>
          </div>

          <div
            onClick={() => onLaunchSmart("bookmark")}
            className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-800 cursor-pointer transition shadow-2xs"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center">
                ⭐ Knowledge Vault
              </span>
              <span className="text-[10px] font-mono bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded">
                12 Saved
              </span>
            </div>
            <div className="font-bold text-slate-900 dark:text-white text-sm mb-1">
              Hard Quant Collection
            </div>
            <p className="text-xs text-slate-400 dark:text-gray-500">
              Practice your saved items
            </p>
          </div>
        </div>
      </div>

      {/* TOPIC TREE BROWSER */}
      {treeData && (
        <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-6 shadow-xs">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mr-2" />{" "}
            Explore Curriculum Topics
          </h3>
          <PracticeTopicTree
            tree={treeData}
            onSelectTopic={(topic) =>
              onOpenSetup({
                mode: "learn",
                topicId: topic.id,
                subjectId: topic.subjectId,
              })
            }
          />
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCREEN 2: PRACTICE SETUP WIZARD
// ════════════════════════════════════════════════════════════════════════════
function PracticeSetupWizard({ initialConfig, onBack, onStart }) {
  const [exam, setExam] = useState("ssc_cgl");
  const [subject, setSubject] = useState("quant");
  const [topic, setTopic] = useState("percentage");
  const [difficulty, setDifficulty] = useState(
    initialConfig?.difficulty || "medium",
  );
  const [count, setCount] = useState(initialConfig?.count || 20);

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <button
        onClick={onBack}
        className="inline-flex items-center text-sm font-semibold text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Workspace
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-8 shadow-sm space-y-6">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            What do you want to practice?
          </h2>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
            Configure your targeted concept-learning workspace session.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-1.5">
              Exam Target
            </label>
            <select
              value={exam}
              onChange={(e) => setExam(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="ssc_cgl">SSC CGL Tier 1 & Tier 2</option>
              <option value="railway_ntpc">Railway NTPC & Group D</option>
              <option value="banking_ibps">Banking IBPS PO & Clerk</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-1.5">
              Subject
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="quant">Quantitative Aptitude</option>
              <option value="reasoning">
                General Intelligence & Reasoning
              </option>
              <option value="english">English Language</option>
              <option value="gk">General Knowledge</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-1.5">
              Topic & Concept
            </label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold dark:bg-gray-800 dark:text-gray-200"
            >
              <option value="percentage">
                Percentage → Successive Percentage
              </option>
              <option value="profit_loss">Profit & Loss → Discount</option>
              <option value="ratio">Ratio & Proportion → Mixture</option>
              <option value="time_work">Time & Work → Pipes & Cisterns</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-2">
              Difficulty
            </label>
            <div className="grid grid-cols-3 gap-3">
              {["easy", "medium", "hard"].map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`py-2.5 rounded-xl border text-xs font-bold capitalize transition ${
                    difficulty === d
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                      : "border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-2">
              Number of Questions
            </label>
            <div className="grid grid-cols-4 gap-3">
              {[10, 20, 30, 50].map((c) => (
                <button
                  key={c}
                  onClick={() => setCount(c)}
                  className={`py-2.5 rounded-xl border text-xs font-bold transition ${
                    count === c
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                      : "border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400"
                  }`}
                >
                  {c} Qs
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => onStart({ mode: "learn", difficulty, count })}
          className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition shadow-sm"
        >
          Start Concept Practice →
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCREEN 5: END OF PRACTICE SESSION MASTERY SCREEN
// ════════════════════════════════════════════════════════════════════════════
function PracticeCompleteScreen({
  summary,
  onDashboard,
  onRestartSession,
  onPracticeWeakTopic,
}) {
  return (
    <div className="max-w-2xl mx-auto py-10 px-4 text-center">
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-8 shadow-sm space-y-6">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
          <Award className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            Practice Complete 🎯
          </h2>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
            You solved {summary.questionsAttempted || 20} questions in this
            session.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 py-2">
          <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-700">
            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500">
              Accuracy
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {summary.accuracy || 75}%
            </div>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-700">
            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500">
              Avg Speed
            </div>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
              {summary.avgTimeSeconds || 42}s
            </div>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-700">
            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500">
              Concept Mastery
            </div>
            <div className="text-2xl font-black text-amber-500 mt-0.5">+8%</div>
          </div>
        </div>

        {/* Concept Mastery Breakdown */}
        <div className="text-left bg-slate-50 dark:bg-gray-900 p-5 rounded-2xl border border-slate-100 dark:border-gray-700 space-y-2">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-gray-200 mb-3">
            Concept Mastery Update
          </h4>
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-xl">
            <span>✓ Percentage Basics</span>
            <span>Mastered 🏆</span>
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-xl">
            <span>✓ Percentage Increase & Decrease</span>
            <span>Mastered 🏆</span>
          </div>
          <div className="flex items-center justify-between text-xs font-semibold text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-900/20 px-3 py-2 rounded-xl">
            <span>⚠️ Successive Percentage Change</span>
            <span>Needs Practice (42%)</span>
          </div>
        </div>

        {/* Next Recommended CTAs */}
        <div className="pt-2 space-y-3">
          <button
            onClick={onPracticeWeakTopic}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition"
          >
            Practice 10 Similar (Successive Percentage)
          </button>

          <div className="flex gap-3">
            <button
              onClick={onRestartSession}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-200 rounded-xl font-semibold text-xs hover:bg-slate-200 dark:hover:bg-gray-700"
            >
              Start New Practice
            </button>
            <button
              onClick={onDashboard}
              className="flex-1 py-2.5 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-200 rounded-xl font-semibold text-xs hover:bg-slate-200 dark:hover:bg-gray-700"
            >
              Return to Workspace Hub
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
