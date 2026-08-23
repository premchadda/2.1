import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../shared/providers/AuthContext";
import {
  getStudyMaterials,
  getUserAnalytics,
  forceRefreshAll,
} from "../../shared/lib/dataService";
import Breadcrumb from "../../shared/components/common/Breadcrumb";
import { AnimatedHero } from "../../shared/components";
import {
  BarChart2,
  BookOpen,
  Play,
  FileText,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  BookX,
  FolderOpen,
  Target,
  Video,
  History,
  TrendingUp,
  Star,
  Clock,
} from "lucide-react";
import ComingSoon from "../../shared/components/common/ComingSoon";
import SearchBox from "../../shared/components/common/SearchBox";

// Display order for "Browse by Category" groups (subjects without a group stay standalone/Featured)
const GROUP_ORDER = ["General Awareness", "General Science"];

function StudyMaterial() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [_lastUpdated, setLastUpdated] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [studyHistory, setStudyHistory] = useState([]);
  const [popularMaterials, setPopularMaterials] = useState([]);

  // Fetch study materials and user analytics
  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      try {
        setError(null);
        setLoading(true);

        // Fetch materials and user analytics in parallel
        const [materials, analytics] = await Promise.all([
          getStudyMaterials(),
          user
            ? getUserAnalytics({ userId: user.id || user._id }).catch(
                () => null,
              )
            : Promise.resolve(null),
        ]);

        if (controller.signal.aborted) return;

        setSubjects(materials);
        setLastUpdated(new Date());

        // Auto-expand all groups
        const groups = {};
        materials.forEach((m) => {
          if (m.subjectGroup) groups[m.subjectGroup] = true;
        });
        setExpandedGroups(groups);

        // Process real study history from analytics
        if (analytics?.subjectWise && materials.length > 0) {
          // Find subjects the user has actually interacted with (attempted > 0)
          const interactedSubjectNames = analytics.subjectWise
            .filter((s) => s.attempted > 0)
            .map((s) => s.name);

          const history = materials
            .filter((m) => interactedSubjectNames.includes(m.title))
            .map((m) => {
              const stats = analytics.subjectWise.find(
                (s) => s.name === m.title,
              );
              return {
                ...m,
                lastAccessed: "Recent activity", // Analytics doesn't give us timestamp yet
                progress: stats ? stats.accuracy : 0,
              };
            })
            .slice(0, 5);

          setStudyHistory(history);
        }

        // Process popular materials: sort by total content (videos + pdfs + tests)
        // Content depth is used as the popularity proxy until real view counts exist
        const popular = [...materials]
          .sort((a, b) => {
            const scoreA = (a.videos || 0) + (a.pdf || 0) + (a.tests || 0);
            const scoreB = (b.videos || 0) + (b.pdf || 0) + (b.tests || 0);
            return scoreB - scoreA;
          })
          .slice(0, 4);

        setPopularMaterials(popular);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Failed to fetch study materials:", err);
          setError("Failed to load study materials. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
  }, []);

  // Manual refresh handler
  const handleRefresh = async () => {
    setLoading(true);
    try {
      await forceRefreshAll();
      const materials = await getStudyMaterials(true);
      setSubjects(materials);
      setLastUpdated(new Date());
      setError(null);
    } catch {
      setError("Failed to refresh data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupName) => {
    setExpandedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  // Organize and Filter subjects
  const filteredSubjects = subjects.filter(
    (s) =>
      s.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.subjectGroup?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const standaloneSubjects = filteredSubjects.filter((s) => !s.subjectGroup);
  const groupedSubjects = filteredSubjects.reduce((acc, s) => {
    if (s.subjectGroup) {
      if (!acc[s.subjectGroup]) acc[s.subjectGroup] = [];
      acc[s.subjectGroup].push(s);
    }
    return acc;
  }, {});

  // Loading state
  if (loading && subjects.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">
            Loading study materials...
          </p>
        </div>
      </div>
    );
  }

  // Show empty state if no study materials available yet
  if ((!subjects || subjects.length === 0) && !error && !loading) {
    return (
      <ComingSoon
        title="No Study Materials Yet"
        message="Study materials haven't been published for this subject yet. Our content team is adding new resources regularly."
        submessage="Get notified when new study materials are available."
        backLink="/"
        backText="Back to Home"
        showNotificationButton={true}
        notificationTopic="feature:study-materials"
        icon={BookX}
      />
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Unable to Load Data
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors flex items-center mx-auto disabled:opacity-50"
          >
            <RefreshCw
              className={`w-5 h-5 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Render a single subject card
  const SubjectCard = ({ subject, idx }) => {
    const progress = subject.userProgress ?? null; // null = no data yet
    return (
      <Link
        to={`/study/${subject.slug || subject._id}`}
        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-brand-start/40 transition-all duration-300 group relative overflow-hidden animate-slide-in-up"
        style={{ animationDelay: `${idx * 0.08}s` }}
      >
        <div className="absolute right-0 top-0 w-32 h-32 bg-gradient-to-bl from-indigo-50/60 to-transparent rounded-bl-full -z-10 group-hover:scale-150 transition-transform duration-700"></div>

        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 shadow-inner overflow-hidden"
            style={{ backgroundColor: (subject.color || "#667eea") + "20" }}
          >
            {subject.icon ? (
              subject.icon.startsWith("http") ||
              subject.icon.startsWith("/") ||
              subject.icon.startsWith("data:") ? (
                <img
                  loading="lazy"
                  decoding="async"
                  src={subject.icon}
                  alt={subject.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                subject.icon
              )
            ) : (
              "📚"
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start mb-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-brand-start transition-colors truncate pr-2">
                {subject.title}
              </h3>
              <div className="w-6 h-6 rounded-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center group-hover:bg-brand-start transition-colors flex-shrink-0">
                <ChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-500 group-hover:text-white transition-colors" />
              </div>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 font-medium flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 font-semibold border border-gray-100 dark:border-gray-700">
                <BookOpen className="w-3 h-3 text-gray-400 dark:text-gray-500" />{" "}
                {subject.chapters || 0} Ch
              </span>
              <span className="flex items-center gap-1 bg-gray-50 dark:bg-gray-900 px-2 py-0.5 rounded text-gray-600 dark:text-gray-300 font-semibold border border-gray-100 dark:border-gray-700">
                <FileText className="w-3 h-3 text-gray-400 dark:text-gray-500" />{" "}
                {subject.topics || 0} Topics
              </span>
            </p>

            {/* Progress Bar — only shown when real progress data exists */}
            {progress !== null && (
              <div className="mb-3">
                <div className="flex justify-between text-[10px] font-bold mb-1">
                  <span className="text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Progress
                  </span>
                  <span className="text-brand-start">{progress}%</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-brand-start to-brand-end h-full rounded-full transition-all duration-1000"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center p-2 bg-blue-50/40 dark:bg-blue-900/20 rounded-lg border border-blue-50">
                <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 mb-0.5">
                  <Play className="w-3 h-3" />
                  <span className="font-bold text-xs">
                    {subject.videos || 0}
                  </span>
                </div>
                <p className="text-[8px] text-gray-500 dark:text-gray-400 font-bold uppercase">
                  Videos
                </p>
              </div>
              <div className="flex flex-col items-center p-2 bg-green-50/40 dark:bg-green-900/20 rounded-lg border border-green-50">
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400 mb-0.5">
                  <FileText className="w-3 h-3" />
                  <span className="font-bold text-xs">{subject.pdf || 0}</span>
                </div>
                <p className="text-[8px] text-gray-500 dark:text-gray-400 font-bold uppercase">
                  PDFs
                </p>
              </div>
              <div className="flex flex-col items-center p-2 bg-purple-50/40 dark:bg-purple-900/20 rounded-lg border border-purple-50">
                <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400 mb-0.5">
                  <BarChart2 className="w-3 h-3" />
                  <span className="font-bold text-xs">
                    {subject.tests || 0}
                  </span>
                </div>
                <p className="text-[8px] text-gray-500 dark:text-gray-400 font-bold uppercase">
                  Tests
                </p>
              </div>
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 page-transition fade-in">
      <Helmet>
        <title>Study Materials | Trstprep</title>
        <meta
          name="description"
          content="Access comprehensive study materials, notes, and resources for exam preparation on Trstprep."
        />
        <meta property="og:title" content="Study Materials | Trstprep" />
        <meta
          property="og:description"
          content="Access comprehensive study materials, notes, and resources for exam preparation."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
      </Helmet>
      {/* Breadcrumb */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[{ label: "Home", path: "/" }, { label: "Study Materials" }]}
          />
        </div>
      </div>

      {/* Header with Animated Background */}
      <AnimatedHero pageType="studyMaterial" compact>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl md:text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-3 animate-slide-up leading-tight">
              Master Your Subjects 📖
            </h1>
            <p
              className="text-white/80 text-lg mb-6 animate-slide-up font-medium"
              style={{ animationDelay: "0.1s" }}
            >
              Access {subjects.length}+ subjects with expert video lectures,
              topic-wise PDFs, and chapter-wise practice tests.
            </p>

            <SearchBox
              placeholder="Search topics (e.g. Algebra, History, GS)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm("")}
              iconColorClass="group-focus-within:text-emerald-500"
              compact
            />
          </div>

          <div className="hidden md:grid grid-cols-2 gap-3 lg:w-full max-w-[400px] sm:w-[400px] animate-slide-in-right">
            {[
              { icon: Video, label: "1k+ Videos", color: "bg-emerald-500" },
              { icon: FileText, label: "Topic PDFs", color: "bg-teal-500" },
              {
                icon: BookOpen,
                label: "Subject Groups",
                color: "bg-green-500",
              },
              { icon: Target, label: "Chapter Tests", color: "bg-emerald-600" },
            ].map((feature, i) => (
              <div
                key={i}
                className="bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-2xl flex items-center gap-3"
              >
                <div className={`${feature.color} p-2 rounded-xl shadow-lg`}>
                  <feature.icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-bold text-sm">
                  {feature.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </AnimatedHero>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main Content (Left) */}
          <div className="lg:col-span-8 space-y-10">
            {/* Continue Where You Left Off */}
            <section className="animate-slide-in-up">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Continue Where You Left Off
                </h2>
                {studyHistory.length > 0 && (
                  <span className="text-sm font-bold text-gray-400 dark:text-gray-500 flex items-center gap-1">
                    View All History <ChevronRight className="w-4 h-4" />
                  </span>
                )}
              </div>

              <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {studyHistory.length > 0 ? (
                  studyHistory.map((item, idx) => (
                    <Link
                      key={item._id || idx}
                      to={`/study/${item.slug || item._id}`}
                      className="flex-shrink-0 w-60 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-xl">
                          {item.icon || "📚"}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 dark:text-white truncate group-hover:text-brand-start transition-colors">
                            {item.title}
                          </h3>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                            Last: {item.lastAccessed}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span className="text-gray-400 dark:text-gray-500">
                            Chapters
                          </span>
                          <span className="text-indigo-600 dark:text-indigo-400">
                            {item.progress}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="w-full bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-700 p-8 flex flex-col md:flex-row items-center gap-6 group">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-xl sm:text-2xl lg:text-3xl animate-bounce">
                      🚀
                    </div>
                    <div className="text-center md:text-left">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                        Your Journey Starts Here!
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
                        Explore the subjects below and start your first lesson.
                        Once you begin, your recent progress will appear here
                        for quick access.
                      </p>
                    </div>
                    <div className="md:ml-auto">
                      <Link
                        to="/study"
                        className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:translate-y-[-2px] transition-all inline-block"
                      >
                        Start Learning →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Standalone Subject Cards */}
            {standaloneSubjects.length > 0 && (
              <section>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500" />
                  Featured Subjects
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {standaloneSubjects.map((subject, idx) => (
                    <SubjectCard
                      key={subject.id || subject._id || subject.slug || idx}
                      subject={subject}
                      idx={idx}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Grouped Subject Sections */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Browse by Category
              </h2>
              {Object.entries(groupedSubjects)
                .sort(([a], [b]) => {
                  const ia = GROUP_ORDER.indexOf(a);
                  const ib = GROUP_ORDER.indexOf(b);
                  if (ia === -1 && ib === -1) return a.localeCompare(b);
                  if (ia === -1) return 1;
                  if (ib === -1) return -1;
                  return ia - ib;
                })
                .map(([groupName, groupSubs]) => {
                  const isExpanded = expandedGroups[groupName];
                  const totalChapters = groupSubs.reduce(
                    (s, sub) => s + (sub.chapters || 0),
                    0,
                  );
                  const totalVideos = groupSubs.reduce(
                    (s, sub) => s + (sub.videos || 0),
                    0,
                  );

                  return (
                    <div key={groupName} className="mb-6">
                      {/* Group Header */}
                      <button
                        onClick={() => toggleGroup(groupName)}
                        className="w-full flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl p-3 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <FolderOpen className="w-6 h-6 text-white" />
                          </div>
                          <div className="text-left">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                              {groupName}
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 text-[10px] font-medium mt-0.5">
                              {groupSubs.length} subjects • {totalChapters}{" "}
                              chapters • {totalVideos} videos
                            </p>
                          </div>
                        </div>
                        <div
                          className={`w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                        >
                          <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        </div>
                      </button>

                      {/* Group Content - Sub-subject Cards */}
                      {isExpanded && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pl-0 animate-slide-in-up">
                          {groupSubs.map((subject, idx) => (
                            <SubjectCard
                              key={
                                subject.id || subject._id || subject.slug || idx
                              }
                              subject={subject}
                              idx={idx}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
            </section>
          </div>

          {/* Sidebar (Right) */}
          <aside className="lg:col-span-4 relative">
            <div className="space-y-8 z-10">
              {/* Popular Today Section */}
              <section className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    Popular Today
                  </h2>
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                </div>

                <div className="space-y-5">
                  {popularMaterials.length > 0 ? (
                    popularMaterials.map((item, idx) => (
                      <Link
                        key={item._id || idx}
                        to={`/study/${item.slug || item._id}`}
                        className="flex items-center gap-4 group cursor-pointer"
                      >
                        <div className="relative">
                          <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                            {item.icon || "📚"}
                          </div>
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 shadow-sm">
                            {idx + 1}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm truncate group-hover:text-brand-start transition-colors">
                            {item.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <Video className="w-3 h-3" /> {item.videos || 0}
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                              <TrendingUp className="w-3 h-3 text-emerald-500" />{" "}
                              {item.pdf || 0} PDFs
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-500 group-hover:text-brand-start transition-colors" />
                      </Link>
                    ))
                  ) : (
                    <div className="py-2 text-center">
                      <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                        Exploring trending topics...
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-8 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-800/60">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                      Study Goal
                    </span>
                  </div>
                  <p className="text-[10px] text-indigo-700 dark:text-indigo-300 leading-relaxed">
                    Completing 2 topics daily can help you cover the entire GS
                    syllabus in 45 days.
                  </p>
                  <Link
                    to="/settings"
                    className="mt-3 block w-full py-2 bg-indigo-600 text-white text-center text-[10px] font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Set My Goal in Settings
                  </Link>
                </div>
              </section>

              {/* Support / Help Card */}
              <div className="bg-gradient-to-br from-brand-start to-brand-end rounded-3xl p-6 text-white text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10 text-center">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold mb-2">Need Guidance?</h3>
                  <p className="text-xs text-purple-100 mb-4 px-2">
                    Talk to our mentors for a personalized study plan.
                  </p>
                  <Link
                    to="/community"
                    className="block w-full py-3 bg-white dark:bg-gray-800 text-brand-start text-center font-bold rounded-xl text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors shadow-lg"
                  >
                    Ask the Community
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Quick Tips */}
        <div className="mt-12 bg-white dark:bg-gray-800 rounded-3xl p-8 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Star className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              Expert Study Tips
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "Weak Subjects First",
                desc: "Starting with your weakest subjects helps maximize improvement when energy is high.",
              },
              {
                title: "Visual Learning",
                desc: "Watch videos first, then read PDFs for deeper conceptual understanding.",
              },
              {
                title: "Test Frequency",
                desc: "Take chapter tests immediately after completing a topic to reinforce memory.",
              },
              {
                title: "Daily Review",
                desc: "Spend 15 mins every night reviewing mistakes to convert weak areas into strengths.",
              },
            ].map((tip, i) => (
              <div key={i} className="space-y-2">
                <div className="text-brand-start font-black text-2xl opacity-20">
                  0{i + 1}
                </div>
                <h4 className="font-bold text-gray-800 dark:text-gray-200">
                  {tip.title}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  {tip.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudyMaterial;
