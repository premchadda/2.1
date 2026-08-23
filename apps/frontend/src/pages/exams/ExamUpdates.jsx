import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getExamCategories } from "../../shared/lib/dataService";
import api from "../../shared/lib/api";
import Breadcrumb from "../../shared/components/common/Breadcrumb";
import {
  Bell,
  Calendar,
  Clock,
  ChevronRight,
  Filter,
  Megaphone,
  FileText,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Share2,
  ArrowRight,
} from "lucide-react";

function ExamUpdates() {
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch exam categories and info
        const categories = await getExamCategories();
        if (controller.signal.aborted) return;

        // Find the exam
        let currentExam = null;
        for (const category of categories) {
          const found = category.exams?.find(
            (e) => e.id === examId || e.examId === examId || e.slug === examId,
          );
          if (found) {
            currentExam = {
              ...found,
              category: category.label || category.title,
            };
            break;
          }
        }

        if (currentExam) {
          setExam(currentExam);

          // Fetch real updates from API
          try {
            const response = await api.get(`/api/exam-info/${examId}/updates`, {
              signal: controller.signal,
            });
            if (controller.signal.aborted) return;
            if (response.data?.success) {
              setUpdates(response.data.data || []);
            } else {
              setUpdates([]);
            }
          } catch (err) {
            if (err.name !== "AbortError") {
              console.error("Failed to fetch exam updates:", err);
              setUpdates([]);
            }
          }
        }
      } catch (error) {
        if (error.name !== "AbortError")
          console.error("Error fetching exam updates:", error);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    if (examId) {
      fetchData();
    }
    return () => controller.abort();
  }, [examId]);

  const getUpdateIcon = (type) => {
    switch (type) {
      case "notification":
        return <Megaphone className="w-5 h-5 text-blue-600" />;
      case "exam_date":
        return <Calendar className="w-5 h-5 text-green-600" />;
      case "vacancy":
        return <TrendingUp className="w-5 h-5 text-purple-600" />;
      case "syllabus":
        return <FileText className="w-5 h-5 text-orange-600" />;
      case "result":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "cutoff":
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const getUpdateColor = (type) => {
    switch (type) {
      case "notification":
        return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
      case "exam_date":
        return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
      case "vacancy":
        return "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800";
      case "syllabus":
        return "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800";
      case "result":
        return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
      case "cutoff":
        return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
      default:
        return "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700";
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case "high":
        return (
          <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium rounded-full">
            High Priority
          </span>
        );
      case "medium":
        return (
          <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-full">
            Medium
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-full">
            General
          </span>
        );
    }
  };

  const filteredUpdates =
    filter === "all"
      ? updates
      : updates.filter(
          (u) =>
            u.type === filter || (filter === "high" && u.priority === "high"),
        );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return "Today";
    if (diffDays === 2) return "Yesterday";
    if (diffDays <= 7) return `${diffDays} days ago`;

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-start border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading updates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-purple-700 to-indigo-900 text-white">
        {/* Decorative elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[30rem] h-[30rem] bg-pink-500/20 rounded-full blur-3xl mix-blend-screen opacity-50"></div>
          <div className="absolute top-40 -left-20 w-[20rem] h-[20rem] bg-blue-500/30 rounded-full blur-3xl mix-blend-screen opacity-40"></div>
          <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 relative z-10">
          <div className="mb-8">
            <Breadcrumb
              items={[
                { label: "Exams", path: "/exams" },
                { label: exam?.category || "Category", path: "/exams" },
                { label: exam?.title || examId, path: `/exam/${examId}` },
                { label: "Updates" },
              ]}
              light
            />
          </div>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="animate-slide-in-right">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-sm font-semibold mb-5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
                Live Updates
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl md:text-3xl sm:text-4xl lg:text-5xl lg:text-6xl font-black mb-4 tracking-tight">
                {exam?.title || examId}{" "}
                <span className="block mt-1 text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-indigo-300">
                  Announcements
                </span>
              </h1>
              <p className="text-white/80 text-lg md:text-xl max-w-[95vw] sm:max-w-2xl font-medium leading-relaxed">
                Stay ahead with all official notifications, syllabus updates,
                exam dates, and result declarations.
              </p>
            </div>

            <div className="flex items-center gap-3 animate-slide-in-up md:pb-2">
              <button className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-xl hover:bg-white/20 transition-all flex items-center gap-2 border border-white/20 shadow-xl font-bold hover:-translate-y-1">
                <Share2 className="w-5 h-5" />
                Share
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Filter Bar */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
              <div className="flex items-center gap-4 overflow-x-auto">
                <Filter className="w-5 h-5 text-gray-400 flex-shrink-0" />
                {[
                  { key: "all", label: "All Updates" },
                  { key: "high", label: "High Priority" },
                  { key: "notification", label: "Notifications" },
                  { key: "exam_date", label: "Exam Dates" },
                  { key: "result", label: "Results" },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                      filter === f.key
                        ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Updates Timeline */}
            <div className="space-y-5">
              {filteredUpdates.length > 0 ? (
                filteredUpdates.map((update, index) => (
                  <div
                    key={update.id}
                    className={`bg-white dark:bg-gray-800 rounded-2xl shadow-sm border p-6 md:p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 relative overflow-hidden group animate-slide-in-up ${getUpdateColor(update.type)}`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="absolute right-0 top-0 -mr-16 -mt-16 w-32 h-32 rounded-full mix-blend-multiply opacity-5 bg-current transition-transform duration-700 group-hover:scale-[2] pointer-events-none"></div>

                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5 relative z-10">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-gray-700 flex items-center justify-center shadow-sm flex-shrink-0 group-hover:scale-110 transition-transform duration-300 border border-gray-100 dark:border-gray-600">
                          {getUpdateIcon(update.type)}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-3 mb-1.5">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {update.title}
                            </h3>
                            {update.isNew && (
                              <span className="px-2.5 py-0.5 bg-gradient-to-r from-red-500 to-pink-500 text-white text-[10px] uppercase tracking-wider font-bold rounded-full shadow-sm animate-pulse-slow self-center">
                                New
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm font-medium">
                            <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 bg-white/60 dark:bg-gray-800/60 px-2.5 py-1 rounded-lg">
                              <span className="text-gray-400">
                                <Clock className="w-3.5 h-3.5" />
                              </span>
                              {formatDate(update.date)}
                            </span>
                            <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">
                              •
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 capitalize bg-white/60 dark:bg-gray-800/60 px-2.5 py-1 rounded-lg hidden sm:inline-block">
                              {update.type.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="sm:flex-shrink-0 self-start">
                        {getPriorityBadge(update.priority)}
                      </div>
                    </div>

                    <p className="text-gray-600 dark:text-gray-300 mb-6 relative z-10 leading-relaxed pl-0 sm:pl-16">
                      {update.description}
                    </p>

                    {update.link && (
                      <div className="pl-0 sm:pl-16 relative z-10">
                        <a
                          href={update.link}
                          className="inline-flex items-center gap-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-5 py-2.5 rounded-xl text-sm text-indigo-600 dark:text-indigo-400 font-bold hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:shadow-sm transition-all group/btn"
                        >
                          Read Full Notification
                          <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                        </a>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
                  <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    No Updates Found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    There are no updates matching your filter criteria.
                  </p>
                  <button
                    onClick={() => setFilter("all")}
                    className="mt-4 text-indigo-600 font-medium hover:underline"
                  >
                    View All Updates
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Links */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                Quick Links
              </h3>
              <div className="space-y-2">
                <Link
                  to={`/exam/${examId}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <span className="text-gray-700 dark:text-gray-300">
                    Exam Details
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
                <Link
                  to={`/exam/${examId}/year/2026`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <span className="text-gray-700 dark:text-gray-300">
                    2026 Information
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
                <Link
                  to={`/exam/${examId}/compare`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <span className="text-gray-700 dark:text-gray-300">
                    Year Comparison
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </Link>
              </div>
            </div>

            {/* Subscribe Card */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 p-6">
              <h3 className="font-bold text-indigo-900 dark:text-indigo-300 mb-2">
                Stay Updated
              </h3>
              <p className="text-sm text-indigo-700 dark:text-indigo-400 mb-4">
                Get notified about important updates and deadlines.
              </p>
              <button className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition">
                Subscribe to Updates
              </button>
            </div>

            {/* Important Dates */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                Important Dates
              </h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Notification Release
                    </p>
                    <p className="text-xs text-gray-500">
                      Expected: March 2026
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Application Start
                    </p>
                    <p className="text-xs text-gray-500">
                      Expected: April 2026
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Exam Date
                    </p>
                    <p className="text-xs text-gray-500">Expected: June 2026</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExamUpdates;
