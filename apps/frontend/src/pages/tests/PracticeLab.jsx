import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  useSearchParams,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { practiceAPI } from "../../shared/lib/practiceAPI";
import Breadcrumb from "../../shared/components/common/Breadcrumb";
import FundamentalsGym from "./components/FundamentalsGym";
import PracticeWorkspace from "./components/PracticeWorkspace";
import PracticeTopicTree from "./components/PracticeTopicTree";
import { useProPass } from "../../shared/hooks/useProPass";
import SEO from "../../shared/components/SEO";

function formatSlugToTitle(slug) {
  if (!slug) return "";
  return String(slug)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

import {
  BookOpen,
  Flame,
  Star,
  Award,
  Layers,
  ArrowRight,
  Sparkles,
  AlertCircle,
  ArrowLeft,
  Play,
  ChevronDown,
  RotateCcw,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════════════
// SUBPAGE & SCREEN ROUTING MAPS
// ════════════════════════════════════════════════════════════════════════════
const SUBPAGE_TO_SCREEN = {
  "exam-practice": "exam_practice",
  exam_practice: "exam_practice",
  exams: "exam_practice",
  chapter: "chapter_detail",
  "chapter-detail": "chapter_detail",
  chapter_detail: "chapter_detail",
  fundamentals: "fundamentals",
  setup: "setup",
  session: "session",
  complete: "complete",
  dashboard: "dashboard",
};

const SCREEN_TO_SUBPAGE = {
  dashboard: "",
  exam_practice: "exam-practice",
  chapter_detail: "chapter",
  fundamentals: "fundamentals",
  setup: "setup",
  session: "session",
  complete: "complete",
};

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

const getQuestionCount = (item) =>
  Number(item?.questionCount ?? item?.question_count ?? item?.count ?? 0);

const getSubjectIcon = (subject) => {
  const name = String(subject?.name || subject?.title || "").toLowerCase();
  if (name.includes("quant") || name.includes("math")) return "🔢";
  if (name.includes("reason")) return "🧩";
  if (name.includes("science")) return "🧪";
  if (name.includes("computer")) return "💻";
  if (name.includes("gk") || name.includes("general knowledge")) return "🏛️";
  return "📖";
};

export default function PracticeLab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { subpage, subjectSlug, chapterSlug, examSlug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Screen state initialized from URL subpage / searchParams if present
  const initialSubpage =
    subpage || searchParams.get("view") || searchParams.get("subpage");
  const [screen, setScreen] = useState(() => {
    if (chapterSlug || searchParams.get("chapterId")) return "chapter_detail";
    if (subjectSlug || examSlug) return "exam_practice";
    if (initialSubpage && SUBPAGE_TO_SCREEN[initialSubpage]) {
      return SUBPAGE_TO_SCREEN[initialSubpage];
    }
    return "dashboard";
  }); // dashboard | setup | session | fundamentals | complete | exam_practice | chapter_detail

  const [activeSession, setActiveSession] = useState(null);
  const [completeSummary, setCompleteSummary] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  // Where the user launched the session from — "Back to Section" returns here
  const [sessionReturnScreen, setSessionReturnScreen] = useState("dashboard");
  // Prevents duplicate sessions
  const deepLinkLaunchedRef = useRef(false);

  // Exam Selection State
  const [selectedExam, setSelectedExam] = useState(() => {
    const saved = localStorage.getItem("trstprep_user_exam");
    return saved ? JSON.parse(saved) : EXAM_OPTIONS[0];
  });
  const [showExamModal, setShowExamModal] = useState(false);

  // Authoritative curriculum tree from database
  const { data: treeData } = useQuery({
    queryKey: ["practice-tree", "lab"],
    queryFn: practiceAPI.getTree,
    staleTime: 5 * 60 * 1000,
  });

  const dbSubjects = useMemo(() => {
    return Array.isArray(treeData?.subjects) ? treeData.subjects : [];
  }, [treeData]);

  const allChapters = useMemo(() => {
    return dbSubjects.flatMap((s) =>
      (s.chapters || []).map((c) => ({
        ...c,
        subjectId: s.id,
        subjectSlug: s.slug,
        subjectName: s.name || s.title,
      })),
    );
  }, [dbSubjects]);

  // Synchronize screen changes to the URL
  const navigateScreen = (newScreen, options = {}) => {
    setScreen(newScreen);
    let targetPath = "/practice";
    if (newScreen === "chapter_detail") {
      const c = options.chapter || selectedChapter;
      if (c) {
        const cSlug =
          c.slug || c.title?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || c.id;
        const sSlug = options.subjectSlug || c.subjectSlug || subjectSlug;
        targetPath = sSlug
          ? `/practice/subject/${sSlug}/${cSlug}`
          : `/practice/chapter/${cSlug}`;
      } else {
        targetPath = "/practice/chapter";
      }
    } else if (newScreen === "exam_practice") {
      if (options.subjectSlug) {
        targetPath = `/practice/subject/${options.subjectSlug}`;
      } else if (options.examSlug) {
        targetPath = `/practice/exam/${options.examSlug}`;
      } else if (selectedExam?.id) {
        targetPath = `/practice/exam/${selectedExam.id}`;
      } else {
        targetPath = "/practice/exam-practice";
      }
    } else if (SCREEN_TO_SUBPAGE[newScreen]) {
      targetPath = `/practice/${SCREEN_TO_SUBPAGE[newScreen]}`;
    }

    const nextParams = new URLSearchParams(options.query || {});
    const searchStr = nextParams.toString() ? `?${nextParams.toString()}` : "";
    const fullTarget = `${targetPath}${searchStr}`;
    if (location.pathname + location.search !== fullTarget) {
      navigate(fullTarget, { replace: options.replace ?? false });
    }
  };

  // Match chapter or subject or exam from URL slugs
  useEffect(() => {
    if (chapterSlug || searchParams.get("chapterId")) {
      const target = chapterSlug || searchParams.get("chapterId");
      if (allChapters.length > 0) {
        const matched = allChapters.find(
          (c) =>
            c.slug === target ||
            String(c.id) === target ||
            c.publicId === target ||
            c.title?.toLowerCase().replace(/[^a-z0-9]+/g, "-") === target,
        );
        if (matched) {
          setSelectedChapter(matched);
          setScreen((curr) =>
            curr !== "session" && curr !== "complete" ? "chapter_detail" : curr,
          );
        }
      }
    } else if (subjectSlug) {
      setScreen((curr) =>
        curr !== "session" && curr !== "complete" ? "exam_practice" : curr,
      );
    } else if (examSlug) {
      const matchedExam = EXAM_OPTIONS.find(
        (e) =>
          e.id === examSlug || e.id.toLowerCase() === examSlug.toLowerCase(),
      );
      if (matchedExam) {
        setSelectedExam(matchedExam);
        localStorage.setItem("trstprep_user_exam", JSON.stringify(matchedExam));
      }
      setScreen((curr) =>
        curr !== "session" && curr !== "complete" ? "exam_practice" : curr,
      );
    } else if (subpage && SUBPAGE_TO_SCREEN[subpage]) {
      setScreen(SUBPAGE_TO_SCREEN[subpage]);
    } else if (!subpage && location.pathname === "/practice") {
      setScreen((curr) =>
        curr !== "session" && curr !== "complete" ? "dashboard" : curr,
      );
    }
  }, [
    chapterSlug,
    subjectSlug,
    examSlug,
    subpage,
    allChapters,
    searchParams,
    location.pathname,
  ]);

  // Dynamic SEO Title based on current screen & active entity
  const pageTitle = useMemo(() => {
    if (screen === "session") {
      const qIndex = (activeSession?.currentIndex ?? 0) + 1;
      const total =
        activeSession?.totalQuestions || activeSession?.questions?.length || 10;
      const entity =
        selectedChapter?.title ||
        (chapterSlug ? formatSlugToTitle(chapterSlug) : "Daily Drill");
      return `Practicing: ${entity} (Q ${qIndex}/${total})`;
    }
    if (screen === "complete") {
      const entity =
        selectedChapter?.title ||
        (chapterSlug ? formatSlugToTitle(chapterSlug) : "Session");
      return `${entity} Results & Review`;
    }
    if (screen === "chapter_detail") {
      const entity =
        selectedChapter?.title ||
        (chapterSlug ? formatSlugToTitle(chapterSlug) : "Chapter");
      return `${entity} Practice - Tests & Topics`;
    }
    if (screen === "exam_practice") {
      const examName =
        selectedExam?.name ||
        (examSlug ? formatSlugToTitle(examSlug) : "All Exams");
      const subName = subjectSlug ? formatSlugToTitle(subjectSlug) : null;
      return subName
        ? `${subName} Practice - ${examName}`
        : `${examName} Practice Drills`;
    }
    if (screen === "fundamentals") {
      return "Core Fundamentals & Formulas";
    }
    if (screen === "setup") {
      return "Custom Practice Setup Wizard";
    }
    if (subpage === "mistakes" || searchParams.get("mode") === "mistakes") {
      return "Revision Vault - Weak Areas & Mistakes";
    }
    return "Practice Lab - Adaptive Drills & Questions";
  }, [
    screen,
    activeSession,
    selectedChapter,
    chapterSlug,
    selectedExam,
    examSlug,
    subjectSlug,
    subpage,
    searchParams,
  ]);

  // Select Exam Action
  const handleSelectExam = (exam) => {
    setSelectedExam(exam);
    localStorage.setItem("trstprep_user_exam", JSON.stringify(exam));
    setShowExamModal(false);
    navigateScreen("exam_practice", { examSlug: exam.id });
  };

  // Handle clicking "Exam & Concepts" card on Dashboard
  const handleOpenExamPractice = () => {
    if (!selectedExam) {
      setShowExamModal(true);
    } else {
      navigateScreen("exam_practice", { examSlug: selectedExam.id });
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
        subtopicId: config.subtopicId,
        testId: config.testId,
        difficulty: config.difficulty || "mixed",
        targetCount: config.count || 20,
      });
      setSessionReturnScreen(screen || "dashboard");
      setActiveSession(session);
      navigateScreen("session");
    } catch (err) {
      toast.error(
        err?.response?.data?.error || "Failed to start practice session",
      );
    }
  };

  // Handle URL query parameters (e.g. ?mode=mistakes&testId=123 or ?mode=subject&subjectId=...&chapterId=...)
  useEffect(() => {
    const modeParam = searchParams.get("mode");
    const testIdParam = searchParams.get("testId");
    const subjectIdParam = searchParams.get("subjectId");
    const chapterIdParam = searchParams.get("chapterId");

    if (modeParam === "mistakes") {
      // Guard against StrictMode double-invocation / rapid remounts
      if (!deepLinkLaunchedRef.current) {
        deepLinkLaunchedRef.current = true;
        handleStartSession({
          mode: "mistakes",
          testId: testIdParam || undefined,
          subjectId: subjectIdParam || undefined,
          count: 25,
        });
      }
      setSearchParams({}, { replace: true });
    } else if (modeParam === "subject" || (subjectIdParam && chapterIdParam)) {
      if (!deepLinkLaunchedRef.current) {
        deepLinkLaunchedRef.current = true;
        handleStartSession({
          mode: modeParam || "learn",
          subjectId: subjectIdParam,
          chapterId: chapterIdParam,
          count: 10,
        });
      }
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
      <SEO
        title={pageTitle}
        description="Master competitive exam topics with topic-wise drills, previous-year question sets, and real-time accuracy analytics on Trstprep Practice Lab."
        path={location.pathname}
      />
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
          selectedExam={selectedExam}
          onOpenExamPractice={handleOpenExamPractice}
          onStartSession={handleStartSession}
          onOpenFundamentals={() => navigateScreen("fundamentals")}
          onLaunchSmart={handleLaunchSmartEntry}
          onResume={async (session) => {
            try {
              const fullSession = await practiceAPI.getSession(session.id);
              setSessionReturnScreen("dashboard");
              setActiveSession(fullSession);
              navigateScreen("session");
            } catch {
              toast.error("Failed to resume session");
            }
          }}
        />
      )}

      {/* Screen: Exam Practice Hub (Two-Column Layout) */}
      {screen === "exam_practice" && (
        <ExamPracticeHub
          selectedExam={selectedExam || EXAM_OPTIONS[0]}
          initialSubjectSlug={subjectSlug}
          onChangeExam={() => setShowExamModal(true)}
          onBack={() => navigateScreen("dashboard")}
          onSelectSubject={(slug) => {
            navigateScreen("exam_practice", { subjectSlug: slug });
          }}
          onStartChapter={(chapter) => {
            setSelectedChapter(chapter);
            navigateScreen("chapter_detail", {
              chapter,
              subjectSlug: chapter.subjectSlug || subjectSlug,
            });
          }}
        />
      )}

      {/* Screen: Chapter Detail (Topics left, Practice Sets right) */}
      {screen === "chapter_detail" &&
        (selectedChapter ? (
          <ChapterDetailView
            chapter={selectedChapter}
            selectedExam={selectedExam || EXAM_OPTIONS[0]}
            onBack={() => {
              if (selectedChapter?.subjectSlug || subjectSlug) {
                navigateScreen("exam_practice", {
                  subjectSlug: selectedChapter?.subjectSlug || subjectSlug,
                });
              } else {
                navigateScreen("exam_practice");
              }
            }}
            onStartSession={(config) => handleStartSession(config)}
          />
        ) : (
          <div className="max-w-7xl mx-auto py-20 px-4 flex flex-col items-center justify-center min-h-[40vh]">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
              Loading chapter practice drills...
            </p>
          </div>
        ))}

      {/* Screen 2: Setup Wizard */}
      {screen === "setup" && (
        <PracticeSetupWizard
          onBack={() => navigateScreen("dashboard")}
          onStart={(config) => handleStartSession(config)}
        />
      )}

      {/* Screen 3: Fundamentals Gym */}
      {screen === "fundamentals" && (
        <FundamentalsGym onBack={() => navigateScreen("dashboard")} />
      )}

      {/* Screen 4: 3-Layer Practice Workspace */}
      {screen === "session" && activeSession && (
        <PracticeWorkspace
          session={activeSession}
          onExit={() => navigateScreen(sessionReturnScreen || "dashboard")}
          onLaunchTopicSession={(topicId) =>
            handleStartSession({
              mode: "learn",
              topicId,
              count: 10,
              difficulty: "mixed",
            })
          }
          onComplete={(summary) => {
            if (!summary) return;
            setCompleteSummary(summary);
            navigateScreen("complete");
          }}
        />
      )}

      {/* Screen 5: End of Session Mastery Screen */}
      {screen === "complete" && completeSummary && (
        <PracticeCompleteScreen
          summary={completeSummary}
          onDashboard={() => navigateScreen("dashboard")}
          onRestartSession={() => navigateScreen("setup")}
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
        className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-gray-700 p-5 sm:p-7 md:p-8 max-w-[95vw] sm:max-w-xl w-full shadow-2xl space-y-5 sm:space-y-6 my-auto max-h-[90vh] max-h-[90dvh] overflow-y-auto animate-scale-in"
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
  onSelectSubject,
  initialSubjectSlug,
}) {
  const { hasProPass } = useProPass();
  const { data: treeData, isLoading: subjectsLoading } = useQuery({
    queryKey: ["practice-tree", "exam-practice"],
    queryFn: practiceAPI.getTree,
    staleTime: 5 * 60 * 1000,
  });

  // The tree is pruned by the backend to subjects, chapters, and topics that
  // contain active practice questions. Keep the UI on that same source of truth.
  const dbSubjects = Array.isArray(treeData?.subjects) ? treeData.subjects : [];
  const subjectsList = [
    {
      id: "all",
      slug: "all",
      label: "All Subjects",
      icon: "📚",
      questionCount: dbSubjects.reduce(
        (total, subject) =>
          total +
          (subject.chapters || []).reduce(
            (chapterTotal, chapter) =>
              chapterTotal +
              (chapter.topics || []).reduce(
                (topicTotal, topic) => topicTotal + getQuestionCount(topic),
                0,
              ),
            0,
          ),
        0,
      ),
    },
    ...dbSubjects.map((subject) => ({
      id: String(subject.id),
      slug: subject.slug,
      label: subject.name || subject.title || "Untitled subject",
      icon: subject.icon || getSubjectIcon(subject),
      chapters: subject.chapters || [],
      questionCount: (subject.chapters || []).reduce(
        (total, chapter) =>
          total +
          (chapter.topics || []).reduce(
            (topicTotal, topic) => topicTotal + getQuestionCount(topic),
            0,
          ),
        0,
      ),
    })),
  ];

  const [activeSubject, setActiveSubject] = useState(() => {
    if (initialSubjectSlug && dbSubjects.length > 0) {
      const match = dbSubjects.find(
        (s) =>
          s.slug === initialSubjectSlug || String(s.id) === initialSubjectSlug,
      );
      if (match) return String(match.id);
    }
    return "all";
  });

  useEffect(() => {
    if (initialSubjectSlug && dbSubjects.length > 0) {
      const match = dbSubjects.find(
        (s) =>
          s.slug === initialSubjectSlug || String(s.id) === initialSubjectSlug,
      );
      if (match) {
        setActiveSubject(String(match.id));
      }
    }
  }, [initialSubjectSlug, dbSubjects]);

  const sourceSubjects =
    activeSubject === "all"
      ? dbSubjects
      : dbSubjects.filter(
          (subject) => String(subject.id) === String(activeSubject),
        );
  const chaptersList = sourceSubjects
    .flatMap((subject) =>
      (subject.chapters || []).map((c) => ({
        ...c,
        subjectSlug: subject.slug,
        subjectId: subject.id,
        subjectName: subject.name || subject.title,
      })),
    )
    .map((chapter) => {
      const count = (chapter.topics || []).reduce(
        (total, topic) => total + getQuestionCount(topic),
        0,
      );
      return {
        ...chapter,
        title: chapter.name || chapter.title || "Untitled chapter",
        count,
        badge: count > 30 ? "High Yield" : "Core Concept",
        tag: count > 50 ? "Most Asked" : "Essential",
      };
    })
    .filter((chapter) => chapter.count > 0);
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
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black">
            {selectedExam.name} Free Practice Questions
          </h1>
          <p className="text-xs text-indigo-200 mt-1 max-w-[95vw] sm:max-w-xl">
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
                  onClick={() => {
                    setActiveSubject(s.id);
                    if (onSelectSubject) {
                      onSelectSubject(s.id === "all" ? null : s.slug || s.id);
                    }
                  }}
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

          {/* Chapter Cards — one full-width card per row */}
          <div className="overflow-y-auto flex-1 pr-1">
            {subjectsLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-slate-400 dark:text-gray-500">
                <div className="w-5 h-5 mr-2 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                Loading live subjects and chapters…
              </div>
            ) : chaptersList.length > 0 ? (
              <div className="space-y-3 sm:space-y-4">
                {chaptersList.map((ch, idx) => (
                  <div
                    key={ch.id}
                    onClick={() => onStartChapter(ch)}
                    style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                    className="animate-slide-in-up bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-gray-700 p-4 sm:p-5 md:p-6 hover:border-indigo-400 dark:hover:border-indigo-800 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-5 group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
                        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 sm:px-2.5 py-1 rounded-full truncate">
                          {ch.badge}
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded shrink-0">
                          {ch.tag}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-slate-900 dark:text-white text-[15px] sm:text-base mb-0.5 sm:mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-2">
                        {ch.title}
                      </h4>
                      <p className="text-[11px] sm:text-xs font-bold text-slate-400 dark:text-gray-500">
                        {ch.count} Practice Questions
                      </p>
                    </div>

                    <button className="w-full sm:w-auto sm:min-w-[170px] py-2 sm:py-2.5 px-4 bg-slate-50 dark:bg-gray-900 text-slate-800 dark:text-gray-200 rounded-xl text-xs font-bold group-hover:bg-indigo-600 group-hover:text-white active:scale-[0.98] transition flex items-center justify-center gap-1.5 shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                      <Play className="w-3.5 h-3.5 fill-current" /> Start
                      Practice →
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700">
                <BookOpen className="w-10 h-10 text-slate-300 dark:text-gray-600 mx-auto mb-3" />
                <h4 className="text-base font-bold text-slate-800 dark:text-white">
                  No practice chapters available
                </h4>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                  This subject currently has no active questions in the practice
                  bank.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── FULL-WIDTH SECTION: PASS BANNER + EXPLORE SIMILAR ── */}

      {/* PASS NEW PROMO BANNER — full width below both columns, hidden for pro users */}
      {!hasProPass && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white shadow-md flex flex-wrap items-center justify-between gap-4 sm:gap-6">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider bg-white/20 text-amber-100 px-3 py-1 rounded-full mb-2 inline-block">
              passNew • Trstprep Pass
            </span>
            <h3 className="text-lg sm:text-2xl font-black">
              Unlock All Practice of All Exams with Pass!
            </h3>
            <p className="text-xs text-amber-100 mt-1 max-w-lg">
              Get unlimited access to{" "}
              {subjectsList[0]?.questionCount > 0
                ? `${subjectsList[0].questionCount.toLocaleString()}+ questions,`
                : "thousands of"}{" "}
              official PYPs, re-attempt mode, and AI doubt support.
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

          <button className="px-6 py-3.5 bg-white dark:bg-gray-800 text-amber-800 dark:text-amber-200 rounded-2xl font-black text-xs uppercase tracking-wider hover:bg-amber-50 dark:hover:bg-amber-900/20 transition shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500">
            Upgrade to Pass →
          </button>
        </div>
      )}
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

  // The chapter endpoint is authoritative once it has loaded. The tree is
  // used only while loading or if the chapter endpoint has no response; it is
  // already pruned to topics with active questions.
  const rawTopics = chapterData?.topics ?? chapter?.topics ?? [];
  const topics = rawTopics
    .map((topic) => ({
      ...topic,
      id: topic.id ?? topic.topicId ?? topic.topic_id,
      name: topic.name ?? topic.title ?? "Untitled topic",
      questionCount: getQuestionCount(topic),
      easyCount: Number(topic.easyCount ?? topic.easy ?? 0),
      mediumCount: Number(topic.mediumCount ?? topic.medium ?? 0),
      hardCount: Number(topic.hardCount ?? topic.hard ?? 0),
      subtopics: Array.isArray(topic.subtopics) ? topic.subtopics : [],
      topicTypes: Array.isArray(topic.topicTypes) ? topic.topicTypes : [],
    }))
    .filter(
      (topic) =>
        topic.id !== null && topic.id !== undefined && topic.questionCount > 0,
    );

  // Auto-select first topic
  const currentTopic =
    topics.find((topic) => topic.id === activeTopic?.id) || topics[0] || null;

  // Derive subtopics & question types (topictypes) available under this topic
  const subtopicTypes = useMemo(() => {
    if (!currentTopic) return [];

    const direct = (currentTopic.subtopics || []).filter(
      (st) => (st.questionCount || 0) > 0,
    );
    const types = (currentTopic.topicTypes || []).filter(
      (tt) => (tt.questionCount || 0) > 0,
    );

    let items = [];
    if (types.length > 0) {
      // Umbrella topic: Show the subtopics / topictypes
      items = [...types];
      for (const d of direct) {
        if (
          !items.some((it) => it.name.toLowerCase() === d.name.toLowerCase())
        ) {
          items.unshift(d);
        }
      }
    } else if (direct.length > 0) {
      items = [...direct];
    } else if (chapterData?.chapterTopicTypes?.length > 1) {
      items = chapterData.chapterTopicTypes.filter(
        (ct) => ct.topicId !== currentTopic.id,
      );
    }

    return items;
  }, [currentTopic, chapterData]);

  const getTopicTypeMeta = (name = "") => {
    const lower = name.toLowerCase();
    if (
      lower.includes("number") ||
      lower.includes("quant") ||
      lower.includes("arithmetic") ||
      lower.includes("digit") ||
      lower.includes("ratio")
    ) {
      return {
        icon: "🔢",
        badge: "Numbers & Ratios",
        bg: "bg-emerald-50/80 dark:bg-emerald-950/30",
        border: "border-emerald-200 dark:border-emerald-800/60",
        pill: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300",
        btn: "bg-emerald-600 hover:bg-emerald-700 text-white",
      };
    }
    if (
      lower.includes("word") ||
      lower.includes("vocab") ||
      lower.includes("synonym") ||
      lower.includes("meaning") ||
      lower.includes("semantic")
    ) {
      return {
        icon: "📝",
        badge: "Word & Semantics",
        bg: "bg-sky-50/80 dark:bg-sky-950/30",
        border: "border-sky-200 dark:border-sky-800/60",
        pill: "bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300",
        btn: "bg-sky-600 hover:bg-sky-700 text-white",
      };
    }
    if (
      lower.includes("letter") ||
      lower.includes("alphabet") ||
      lower.includes("coding")
    ) {
      return {
        icon: "🔤",
        badge: "Letter Patterns",
        bg: "bg-purple-50/80 dark:bg-purple-950/30",
        border: "border-purple-200 dark:border-purple-800/60",
        pill: "bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300",
        btn: "bg-purple-600 hover:bg-purple-700 text-white",
      };
    }
    if (
      lower.includes("figure") ||
      lower.includes("image") ||
      lower.includes("visual") ||
      lower.includes("spatial") ||
      lower.includes("pattern")
    ) {
      return {
        icon: "🧩",
        badge: "Visual & Shapes",
        bg: "bg-amber-50/80 dark:bg-amber-950/30",
        border: "border-amber-200 dark:border-amber-800/60",
        pill: "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300",
        btn: "bg-amber-600 hover:bg-amber-700 text-white",
      };
    }
    return {
      icon: "🎯",
      badge: "Core Concepts",
      bg: "bg-indigo-50/80 dark:bg-indigo-950/30",
      border: "border-indigo-200 dark:border-indigo-800/60",
      pill: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300",
      btn: "bg-indigo-600 hover:bg-indigo-700 text-white",
    };
  };

  const handleStartSubtopic = (item, count = 20) => {
    const targetTopicId = item.topicId || currentTopic?.id;
    const targetSubtopicId = item.subtopicId;
    const avail = item.questionCount || 20;
    const targetCount = count === "all" ? avail : Math.min(count, avail);

    onStartSession({
      mode: "learn",
      chapterId: chapter.id,
      topicId: targetTopicId,
      subtopicId: targetSubtopicId,
      count: targetCount,
    });
  };

  const practiceSetStyles = {
    quick: {
      bg: "bg-indigo-50 dark:bg-indigo-900/30",
      border: "border-indigo-200 dark:border-indigo-800",
      text: "text-indigo-700 dark:text-indigo-300",
      btn: "bg-indigo-600 hover:bg-indigo-700",
    },
    easy: {
      bg: "bg-emerald-50 dark:bg-emerald-900/20",
      border: "border-emerald-200 dark:border-emerald-800",
      text: "text-emerald-700 dark:text-emerald-300",
      btn: "bg-emerald-600 hover:bg-emerald-700",
    },
    medium: {
      bg: "bg-amber-50 dark:bg-amber-900/20",
      border: "border-amber-200 dark:border-amber-800",
      text: "text-amber-700 dark:text-amber-300",
      btn: "bg-amber-500 hover:bg-amber-600",
    },
    hard: {
      bg: "bg-red-50 dark:bg-red-900/20",
      border: "border-red-200 dark:border-red-800",
      text: "text-red-700 dark:text-red-300",
      btn: "bg-red-600 hover:bg-red-700",
    },
    full: {
      bg: "bg-purple-50 dark:bg-purple-900/20",
      border: "border-purple-200 dark:border-purple-800",
      text: "text-purple-700 dark:text-purple-300",
      btn: "bg-purple-600 hover:bg-purple-700",
    },
  };

  const getAvailableSets = (topic) => {
    if (!topic || !chapterData || !Array.isArray(topic.practiceSets)) return [];

    return topic.practiceSets
      .map((practiceSet) => {
        const available =
          practiceSet.difficulty === "easy"
            ? topic.easyCount
            : practiceSet.difficulty === "medium"
              ? topic.mediumCount
              : practiceSet.difficulty === "hard"
                ? topic.hardCount
                : topic.questionCount;
        const count =
          practiceSet.count === null
            ? available
            : Math.min(Number(practiceSet.count) || 0, available);
        return {
          ...practiceSet,
          ...practiceSetStyles[practiceSet.id],
          label: `${practiceSet.icon || ""} ${practiceSet.label}`.trim(),
          count,
          desc: `${count} question${count === 1 ? "" : "s"} · ${practiceSet.description || "Practice from this topic"}`,
        };
      })
      .filter((practiceSet) => practiceSet.count > 0);
  };

  const handleStartSet = (practiceSet) => {
    if (!currentTopic?.id || !practiceSet?.count) {
      toast.error("No practice questions are available for this selection.");
      return;
    }

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
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 text-indigo-200 px-3 py-1 rounded-full mb-2 inline-block">
              Chapter Practice
            </span>
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-black mt-1 leading-tight">
              {chapter.title}
            </h1>
            {chapterData && (
              <p className="text-indigo-200 text-xs sm:text-sm mt-2">
                {chapterData.totalTopics} Topics · {chapterData.totalQuestions}{" "}
                Practice Questions
              </p>
            )}
          </div>
          <div className="flex gap-3 flex-wrap">
            {[
              {
                label: "Topics",
                value: chapterData?.totalTopics ?? topics.length,
                icon: "📋",
              },
              {
                label: "Questions",
                value:
                  chapterData?.totalQuestions ??
                  topics.reduce(
                    (total, topic) => total + topic.questionCount,
                    0,
                  ),
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
            {topics.length > 0 ? (
              topics.map((topic, idx) => {
                const isActive =
                  currentTopic?.id === topic.id || (!activeTopic && idx === 0);
                const hasAccuracy =
                  topic.accuracy !== null && topic.attempts > 0;
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
              })
            ) : (
              <div className="px-3 py-8 text-center">
                <BookOpen className="w-8 h-8 text-slate-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500 dark:text-gray-400">
                  No active topics with practice questions.
                </p>
              </div>
            )}
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

          {/* 1. Subtopic & Question Type Collections (Topic Types) */}
          {subtopicTypes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-1">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Subtopics & Question Types</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
                      {subtopicTypes.length} Collections
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                    Targeted drills grouped by question type, concept, and
                    pattern
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {subtopicTypes.map((st, idx) => {
                  const meta = getTopicTypeMeta(st.name);
                  const hasAcc = st.accuracy !== null && st.attempts > 0;
                  return (
                    <div
                      key={st.id || idx}
                      className={`${meta.bg} border ${meta.border} rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 group`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-xl shrink-0"
                              role="img"
                              aria-label={st.name}
                            >
                              {meta.icon}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${meta.pill}`}
                            >
                              {meta.badge}
                            </span>
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-wider bg-white/80 dark:bg-gray-800/80 text-slate-700 dark:text-gray-200 px-2.5 py-1 rounded-lg shrink-0 border border-slate-200/50 dark:border-gray-700/50">
                            {st.questionCount} Qs
                          </span>
                        </div>

                        <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition leading-snug">
                          {st.name}
                        </h4>

                        {st.description && (
                          <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-1 line-clamp-2">
                            {st.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-3 text-[11px] text-slate-500 dark:text-gray-400">
                          {hasAcc ? (
                            <span
                              className={`font-bold px-2 py-0.5 rounded-full ${
                                st.accuracy >= 80
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                                  : st.accuracy >= 50
                                    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              }`}
                            >
                              {st.accuracy}% Accuracy ({st.attempts} answered)
                            </span>
                          ) : (
                            <span className="bg-white/60 dark:bg-gray-800/60 px-2 py-0.5 rounded-md font-medium">
                              Not attempted yet
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200/40 dark:border-gray-700/40 flex items-center gap-2">
                        <button
                          onClick={() => handleStartSubtopic(st, 20)}
                          className={`flex-1 py-2 sm:py-2.5 ${meta.btn} rounded-xl text-xs font-black transition active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-xs`}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Practice {Math.min(st.questionCount, 20)} Qs →
                        </button>
                        {st.questionCount > 20 && (
                          <button
                            onClick={() => handleStartSubtopic(st, "all")}
                            title="Practice all questions in this collection"
                            className="py-2 sm:py-2.5 px-3 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-200 border border-slate-200 dark:border-gray-700 rounded-xl text-[11px] font-extrabold transition active:scale-[0.98] shrink-0"
                          >
                            All {st.questionCount}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Practice Set Cards */}
          <div className="pt-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 dark:text-gray-500 mb-3 px-1 flex items-center justify-between">
              <span>Quick Practice Sets</span>
              <span className="text-[10px] font-normal text-slate-400">
                Mixed levels for rapid revision
              </span>
            </h3>
            {isLoading ? (
              <div className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center text-sm text-slate-500 dark:text-gray-400">
                Loading available question sets…
              </div>
            ) : getAvailableSets(currentTopic).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {getAvailableSets(currentTopic).map((ps, idx) => (
                  <div
                    key={ps.id}
                    onClick={() => handleStartSet(ps)}
                    style={{ animationDelay: `${idx * 45}ms` }}
                    className={`${ps.bg} border ${ps.border} rounded-2xl sm:rounded-3xl p-4 sm:p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 group`}
                  >
                    <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                      <h4
                        className={`font-extrabold text-[15px] sm:text-base ${ps.text}`}
                      >
                        {ps.label}
                      </h4>
                      <span
                        className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${ps.text} bg-white/60 dark:bg-gray-800/60 px-2 py-0.5 rounded-lg shrink-0`}
                      >
                        {ps.count} Qs
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-gray-400 mb-3 sm:mb-4 leading-relaxed">
                      {ps.desc}
                    </p>
                    <button
                      className={`w-full py-2 sm:py-2.5 ${ps.btn} text-white rounded-xl text-xs font-black transition active:scale-[0.98] flex items-center justify-center gap-1.5`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Start
                      Practice →
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
                <AlertCircle className="w-8 h-8 text-slate-300 dark:text-gray-600 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                  No practice sets available
                </h4>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
                  This topic has no active questions for the available
                  difficulty levels.
                </p>
              </div>
            )}
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
  selectedExam,
  onOpenExamPractice,
  onStartSession,
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
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const streak = dash.streak || {};
  const mistakeCount = Number(mistakesData?.count ?? dash?.mistakesCount ?? 0);
  const curriculumTopics = (treeData?.subjects || []).flatMap((subject) =>
    (subject.chapters || []).flatMap((chapter) =>
      (chapter.topics || []).map((topic) => ({
        ...topic,
        subjectName: subject.name,
        chapterName: chapter.name,
        subjectId: subject.id,
        chapterId: chapter.id,
      })),
    ),
  );
  const weakTopics = Array.isArray(dash.weakTopics) ? dash.weakTopics : [];
  const weakTopicMap = new Map(
    weakTopics.map((topic) => [String(topic.topicId), topic]),
  );
  const recommendedTopics = [
    ...curriculumTopics.filter((topic) => weakTopicMap.has(String(topic.id))),
    ...curriculumTopics.filter((topic) => !weakTopicMap.has(String(topic.id))),
  ].slice(0, 4);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-5 sm:py-8 space-y-4 sm:space-y-8">
      {/* Title & Daily Streak */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Practice Workspace
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            Build core concepts, train calculation speed, and master exam
            topics.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-gray-700 px-3 py-1.5 sm:px-4 sm:py-2 flex items-center gap-2 sm:gap-2.5 shadow-xs">
            <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
            <div>
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-none">
                {streak.currentStreak ?? 0}
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                Day streak
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-gray-700 px-3 py-1.5 sm:px-4 sm:py-2 flex items-center gap-2 sm:gap-2.5 shadow-xs">
            <Star className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
            <div>
              <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-none">
                {streak.totalCorrect ?? 0}
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                Correct Total
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 📖 Mistake Book (गलती सुधार) 1-Click Banner */}
      {dash.activeSession && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/60 dark:bg-indigo-900/20">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
              Practice session in progress
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Resume question {Number(dash.activeSession.currentIndex || 0) + 1}
              {dash.activeSession.targetCount
                ? ` of ${dash.activeSession.targetCount}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onResume(dash.activeSession)}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-indigo-700"
          >
            Resume Practice
          </button>
        </div>
      )}

      {/* 🧮 4-HUB PRACTICE GRID (Responsive: 1 col mobile, 2 cols tablet, 4 cols desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
        {/* Hub 1: Fundamentals */}
        <div
          onClick={onOpenFundamentals}
          className="animate-slide-in-up bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl sm:rounded-3xl p-4 sm:p-6 text-white cursor-pointer hover:shadow-lg hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2.5 sm:mb-4">
              <span className="text-lg sm:text-2xl lg:text-3xl">🧮</span>
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider bg-white/20 px-2 sm:px-3 py-1 rounded-full text-indigo-100">
                Calculation Gym
              </span>
            </div>
            <h3 className="text-base sm:text-xl font-extrabold mb-1">
              Fundamentals
            </h3>
            <p className="text-[11px] sm:text-xs text-indigo-100 leading-relaxed mb-4 sm:mb-6">
              Tables (1–30), Squares (1–50), Cubes, Roots, Fractions ↔ %, Ratios
              & Triplets for 5x exam calculation speed.
            </p>
          </div>
          <button className="w-full py-2 sm:py-2.5 bg-white dark:bg-gray-800 text-indigo-700 dark:text-white rounded-xl text-xs font-black group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition focus:outline-none focus:ring-2 focus:ring-indigo-500">
            Train Calculation Speed →
          </button>
        </div>

        {/* Hub 2: Exam & Concept Practice */}
        <div
          onClick={onOpenExamPractice}
          style={{ animationDelay: "60ms" }}
          className="animate-slide-in-up bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-gray-700 p-4 sm:p-6 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-800 hover:shadow-md hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2.5 sm:mb-4">
              <span className="text-lg sm:text-2xl lg:text-3xl">📚</span>
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 sm:px-3 py-1 rounded-full max-w-[60%] truncate">
                {selectedExam ? selectedExam.name : "Choose Exam"}
              </span>
            </div>
            <h3 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
              Exam & Concepts
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-gray-400 leading-relaxed mb-4 sm:mb-6">
              Targeted practice questions across SSC, Railway, Banking, UPSC.
              Select subject, topic, and difficulty.
            </p>
          </div>
          <button className="w-full py-2 sm:py-2.5 bg-slate-100 dark:bg-gray-700 text-slate-800 dark:text-gray-200 rounded-xl text-xs font-bold group-hover:bg-indigo-600 group-hover:text-white transition focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {selectedExam
              ? `Practice ${selectedExam.name} Questions →`
              : "Select Exam to Practice →"}
          </button>
        </div>

        {/* Hub 3: Smart AI Practice */}
        <div
          onClick={() => onLaunchSmart("weak_topic")}
          style={{ animationDelay: "120ms" }}
          className="animate-slide-in-up bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-gray-700 p-4 sm:p-6 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-800 hover:shadow-md hover:-translate-y-1 active:scale-[0.98] transition-all duration-200 group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-2.5 sm:mb-4">
              <span className="text-lg sm:text-2xl lg:text-3xl">🎯</span>
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-2 sm:px-3 py-1 rounded-full">
                Personalized AI
              </span>
            </div>
            <h3 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
              Smart Practice
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-gray-400 leading-relaxed mb-4 sm:mb-6">
              AI-driven speed drills and weak-topic reinforcement calculated
              from your past test performance.
            </p>
          </div>
          <button className="w-full py-2 sm:py-2.5 bg-slate-100 dark:bg-gray-700 text-slate-800 dark:text-gray-200 rounded-xl text-xs font-bold group-hover:bg-amber-500 group-hover:text-white transition focus:outline-none focus:ring-2 focus:ring-amber-500">
            Start Smart Drill →
          </button>
        </div>

        {/* Hub 4: Mistake Notebook */}
        <div
          onClick={
            mistakeCount > 0 ? () => onLaunchSmart("mistakes") : undefined
          }
          style={{ animationDelay: "180ms" }}
          className={`animate-slide-in-up bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-gray-700 p-4 sm:p-6 transition-all duration-200 group flex flex-col justify-between ${
            mistakeCount > 0
              ? "cursor-pointer hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-md hover:-translate-y-1 active:scale-[0.98]"
              : "opacity-80 cursor-default"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2.5 sm:mb-4">
              <span className="text-lg sm:text-2xl lg:text-3xl">📓</span>
              <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-2 sm:px-3 py-1 rounded-full">
                Cross-Platform Mistakes
              </span>
            </div>
            <h3 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white mb-0.5 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
              Mistake Notebook
            </h3>
            <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1">
              Re-Practice Past Incorrect Questions
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-gray-400 leading-relaxed mb-4 sm:mb-6">
              {mistakeCount > 0
                ? `You have ${mistakeCount} questions answered incorrectly across mock tests & practice sets. Turn your mistakes into mastered concepts.`
                : "No mistakes pending! Every question you miss in tests and practice will appear here for targeted revision."}
            </p>
          </div>
          <button
            type="button"
            disabled={mistakeCount === 0}
            className={`w-full py-2 sm:py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              mistakeCount > 0
                ? "bg-slate-100 dark:bg-gray-700 text-slate-800 dark:text-gray-200 group-hover:bg-gradient-to-r group-hover:from-amber-500 group-hover:to-orange-500 group-hover:text-white cursor-pointer"
                : "bg-slate-100 dark:bg-gray-700/50 text-slate-400 dark:text-gray-500 cursor-not-allowed"
            }`}
          >
            {mistakeCount > 0 ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Re-Practice {mistakeCount} Mistakes →</span>
              </>
            ) : (
              "No Pending Mistakes"
            )}
          </button>
        </div>
      </div>

      {/* SMART ENTRY POINTS */}
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center">
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mr-2" />{" "}
          Recommended Entry Points
        </h3>

        {recommendedTopics.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {recommendedTopics.map((topic, idx) => {
              const weakTopic = weakTopicMap.get(String(topic.id));
              const mode = weakTopic ? "weak_topic" : "learn";
              return (
                <div
                  key={topic.id}
                  onClick={() => onLaunchSmart(mode, topic.id)}
                  style={{ animationDelay: `${idx * 45}ms` }}
                  className="animate-slide-in-up p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97] cursor-pointer transition-all duration-200 shadow-2xs"
                >
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2 gap-1.5">
                    <span className="text-[10px] sm:text-xs font-bold text-indigo-600 dark:text-indigo-400 truncate">
                      {weakTopic ? "🔥 Weak Topic" : "📚 Available Topic"}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-mono bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-1.5 sm:px-2 py-0.5 rounded whitespace-nowrap shrink-0">
                      {weakTopic?.accuracy !== null &&
                      weakTopic?.accuracy !== undefined
                        ? `${weakTopic.accuracy}% Accuracy`
                        : `${getQuestionCount(topic)} Qs`}
                    </span>
                  </div>
                  <div className="font-bold text-slate-900 dark:text-white text-[13px] sm:text-sm mb-0.5 sm:mb-1 line-clamp-2">
                    {topic.name}
                  </div>
                  <p className="text-[10px] sm:text-xs text-slate-400 dark:text-gray-500 truncate">
                    {topic.subjectName} · {topic.chapterName}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 text-sm text-slate-500 dark:text-gray-400">
            No active practice topics are available yet.
          </div>
        )}
      </div>

      {/* TOPIC TREE BROWSER */}
      {treeData && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-gray-700 p-4 sm:p-6 shadow-xs">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mr-2" />{" "}
            Explore Curriculum Topics
          </h3>
          <PracticeTopicTree
            tree={treeData}
            onSelectTopic={(topic) =>
              onStartSession({
                mode: "learn",
                topicId: topic.id,
                subjectId: topic.subjectId,
                count: 20,
                difficulty: "mixed",
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
  const { data: treeData, isLoading } = useQuery({
    queryKey: ["practice-tree", "setup"],
    queryFn: practiceAPI.getTree,
    staleTime: 5 * 60 * 1000,
  });
  const subjects = Array.isArray(treeData?.subjects) ? treeData.subjects : [];
  const [subjectId, setSubjectId] = useState(
    initialConfig?.subjectId !== null && initialConfig?.subjectId !== undefined
      ? String(initialConfig.subjectId)
      : "",
  );
  const [chapterId, setChapterId] = useState(
    initialConfig?.chapterId !== null && initialConfig?.chapterId !== undefined
      ? String(initialConfig.chapterId)
      : "",
  );
  const [topicId, setTopicId] = useState(
    initialConfig?.topicId !== null && initialConfig?.topicId !== undefined
      ? String(initialConfig.topicId)
      : "",
  );
  const [difficulty, setDifficulty] = useState(
    initialConfig?.difficulty || "medium",
  );
  const [count, setCount] = useState(initialConfig?.count || 20);

  useEffect(() => {
    if (!subjects.length) return;
    setSubjectId((current) => {
      if (
        current &&
        subjects.some((subject) => String(subject.id) === current)
      ) {
        return current;
      }
      return String(subjects[0].id);
    });
  }, [subjects]);

  const selectedSubject = subjects.find(
    (subject) => String(subject.id) === String(subjectId),
  );
  const chapters = selectedSubject?.chapters || [];
  const selectedChapter = chapters.find(
    (chapter) => String(chapter.id) === String(chapterId),
  );
  const topics = (selectedChapter?.topics || []).filter(
    (topic) => getQuestionCount(topic) > 0,
  );

  useEffect(() => {
    setChapterId((current) => {
      if (
        current &&
        chapters.some((chapter) => String(chapter.id) === current)
      ) {
        return current;
      }
      return chapters[0] ? String(chapters[0].id) : "";
    });
  }, [subjectId, treeData]);

  useEffect(() => {
    setTopicId((current) => {
      if (current && topics.some((topic) => String(topic.id) === current)) {
        return current;
      }
      return topics[0] ? String(topics[0].id) : "";
    });
  }, [chapterId, treeData]);

  const canStart = Boolean(
    topicId && topics.some((topic) => String(topic.id) === topicId),
  );

  return (
    <div className="max-w-[95vw] sm:max-w-xl mx-auto py-10 px-4">
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
              Subject
            </label>
            <select
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value);
                setChapterId("");
                setTopicId("");
              }}
              disabled={isLoading || subjects.length === 0}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold dark:bg-gray-800 dark:text-gray-200"
            >
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-1.5">
              Chapter
            </label>
            <select
              value={chapterId}
              onChange={(e) => {
                setChapterId(e.target.value);
                setTopicId("");
              }}
              disabled={!chapters.length}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold dark:bg-gray-800 dark:text-gray-200"
            >
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-gray-200 uppercase tracking-wider mb-1.5">
              Topic & Concept
            </label>
            <select
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              disabled={!topics.length}
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-semibold dark:bg-gray-800 dark:text-gray-200"
            >
              {topics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name} ({getQuestionCount(topic)} questions)
                </option>
              ))}
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
          onClick={() =>
            onStart({
              mode: "learn",
              subjectId,
              chapterId,
              topicId,
              difficulty,
              count,
            })
          }
          disabled={!canStart || isLoading}
          className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 transition shadow-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {isLoading
            ? "Loading live topics…"
            : canStart
              ? "Start Concept Practice →"
              : "No practice topics available"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SCREEN 5: END OF PRACTICE SESSION MASTERY SCREEN
// ════════════════════════════════════════════════════════════════════════════
function PracticeCompleteScreen({ summary, onDashboard, onRestartSession }) {
  const conceptUpdates = [
    ...(summary.conceptsMastered || []).map((concept) => ({
      label: `✓ ${concept.name || concept.topicName || concept}`,
      status: "Mastered 🏆",
      className:
        "text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-900/20",
    })),
    ...(summary.conceptsNeedsPractice || []).map((concept) => ({
      label: `⚠️ ${concept.name || concept.topicName || concept}`,
      status:
        concept.accuracy !== null && concept.accuracy !== undefined
          ? `Needs Practice (${concept.accuracy}%)`
          : "Needs Practice",
      className:
        "text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-900/20",
    })),
  ];

  return (
    <div className="max-w-[95vw] sm:max-w-2xl mx-auto py-10 px-4 text-center">
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-slate-200 dark:border-gray-700 p-8 shadow-sm space-y-6">
        <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
          <Award className="w-8 h-8" />
        </div>

        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            Practice Complete 🎯
          </h2>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
            You solved {summary.questionsAttempted ?? 0} questions in this
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
              {summary.accuracy ?? 0}%
            </div>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-700">
            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500">
              Avg Speed
            </div>
            <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
              {summary.avgTimeSeconds ?? 0}s
            </div>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-700">
            <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-gray-500">
              Concept Mastery
            </div>
            <div className="text-2xl font-black text-amber-500 mt-0.5">
              {summary.masteryPercent !== null &&
              summary.masteryPercent !== undefined
                ? `${summary.masteryPercent}%`
                : "—"}
            </div>
          </div>
        </div>

        {/* Concept Mastery Breakdown */}
        <div className="text-left bg-slate-50 dark:bg-gray-900 p-5 rounded-2xl border border-slate-100 dark:border-gray-700 space-y-2">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-gray-200 mb-3">
            Concept Mastery Update
          </h4>
          {conceptUpdates.length > 0 ? (
            conceptUpdates.map((concept, index) => (
              <div
                key={`${concept.label}-${index}`}
                className={`flex items-center justify-between text-xs font-semibold px-3 py-2 rounded-xl ${concept.className}`}
              >
                <span>{concept.label}</span>
                <span>{concept.status}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 dark:text-gray-400">
              Topic mastery will appear here after topic-level analytics are
              available.
            </p>
          )}
        </div>

        {/* Next steps */}
        <div className="pt-2 space-y-3">
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
