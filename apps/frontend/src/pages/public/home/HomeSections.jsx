import { Link } from "react-router-dom";
import { ScrollReveal, TestSeriesCard } from "../../../shared/components";
import {
  ArrowRight,
  Radio,
  HelpCircle,
  BookOpen,
  Target,
  Star,
  Users,
  Calendar,
  Crown,
  ChevronRight,
  Play,
  Clock,
  Zap,
  Sparkles,
  Award,
  User,
} from "lucide-react";
import { getTestStartDate } from "../../../shared/utils/testClassification";

function HomeSections(props) {
  const {
    examCategories,
    featuredExams,
    liveTests,
    freeQuizzes,
    liveTestsLoading,
    popularSeries,
    studyMaterials,
    testimonials,
    testimonialsLoading,
    isMobile,
    user,
    loading,
    totalMockTestsCount,
    totalCategoriesCount,
    totalActiveLearnersCount,
    categoryMap,
    getExamIcon,
    getSubjectEmoji,
    getCategoryTheme,
    popularSeriesScrollRef,
    studyMaterialsScrollRef,
  } = props;

  return (
    <>
      {/* ─── HOW IT WORKS ───────────────────────────────── */}
      <section
        className="py-8 sm:py-10 md:py-14 bg-white dark:bg-gray-800 relative overflow-hidden"
        id="how"
      >
        {/* Ambient background decoration */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[500px] sm:w-[500px] h-[500px] bg-gradient-to-br from-brand-start/5 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <ScrollReveal>
            <div className="text-center mb-6 sm:mb-8 md:mb-10">
              <div className="inline-flex items-center gap-1.5 bg-brand-50 dark:bg-indigo-900/30 text-brand-start dark:text-indigo-300 px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2.5 shadow-xs">
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> How it works
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white mb-1.5 sm:mb-2 tracking-tight">
                Start winning in{" "}
                <span className="text-gradient">3 simple steps</span>
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm max-w-md mx-auto">
                No setup needed. Jump right in.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="up" threshold={0.05}>
            <div className="relative overflow-hidden rounded-xl md:rounded-2xl">
              <div className="flex gap-3.5 sm:gap-4 md:gap-5 animate-marquee-left hover:[animation-play-state:paused] py-1.5 w-max">
                {(() => {
                  const steps = [
                    {
                      num: "01",
                      icon: "🎯",
                      title: "Choose Exam",
                      desc: `Pick ${
                        examCategories
                          .slice(0, 4)
                          .map((c) => c.label || c.name)
                          .join(", ") || "SSC, Railways, Banking, UPSC"
                      } — we auto-load your prep plan.`,
                      glow: "from-blue-500 to-indigo-600",
                    },
                    {
                      num: "02",
                      icon: "📝",
                      title: "Practice Smart",
                      desc: "Full-length & sectional mocks with instant results & solutions.",
                      glow: "from-indigo-600 to-purple-600",
                    },
                    {
                      num: "03",
                      icon: "🏆",
                      title: "Crush It",
                      desc: "Follow AI plans, revisit weak topics, track daily progress.",
                      glow: "from-purple-600 to-pink-600",
                    },
                  ];
                  return [...steps, ...steps, ...steps, ...steps].map(
                    (step, i) => (
                      <div
                        key={`${step.num}-${i}`}
                        className="w-[270px] sm:w-[310px] md:w-[340px] shrink-0"
                      >
                        <div className="relative bg-gray-50/90 dark:bg-gray-700/40 hover:bg-white dark:hover:bg-gray-700/80 backdrop-blur-xs rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 text-center border border-gray-200/80 dark:border-gray-600 transition-all duration-300 hover:shadow-xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:-translate-y-1 group h-full flex flex-col items-center justify-between overflow-hidden">
                          {/* Hover ambient glow */}
                          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                          <div className="relative z-10 w-full flex flex-col items-center">
                            <div className="flex items-center justify-center gap-2 mb-2.5 sm:mb-3">
                              <div
                                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br ${step.glow} flex items-center justify-center shadow-md group-hover:scale-105 transition-all duration-300 text-white font-extrabold text-xs sm:text-sm shrink-0`}
                              >
                                {step.num}
                              </div>
                              <span className="text-2xl sm:text-3xl group-hover:scale-110 transition-transform duration-300 inline-block">
                                {step.icon}
                              </span>
                            </div>

                            <h3 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white mb-1.5 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {step.title}
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed max-w-full">
                              {step.desc}
                            </p>
                          </div>

                          {/* Bottom indicator bar on hover */}
                          <div className="relative z-10 w-full mt-3 pt-1">
                            <div className="h-0.5 w-6 mx-auto rounded-full bg-gradient-to-r from-brand-start to-brand-end opacity-0 group-hover:opacity-100 group-hover:w-12 transition-all duration-300" />
                          </div>
                        </div>
                      </div>
                    ),
                  );
                })()}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── FEATURES ───────────────────────────────────── */}
      <section
        className="py-12 md:py-24 bg-white dark:bg-gray-800"
        id="features"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal>
            <div className="text-center mb-10 md:mb-14">
              <div className="inline-flex items-center gap-2 bg-brand-50 dark:bg-indigo-900/30 text-brand-start dark:text-indigo-300 px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest mb-3 md:mb-4">
                <Zap className="w-3 h-3 md:w-3.5 md:h-3.5" /> Why Trstprep
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white mb-3 md:mb-4">
                Built for every{" "}
                <span className="text-gradient">serious aspirant</span>
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base max-w-2xl mx-auto">
                AI-powered analytics. Thousands of curated questions. Designed
                to get you to the top.
              </p>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {[
              {
                icon: "🤖",
                title: "AI-Powered Analytics",
                desc: "Deep insights into weak areas, time-per-question, and personalised improvement plans.",
              },
              {
                icon: "📝",
                title: `${totalMockTestsCount}+ Mock Tests`,
                desc: "Section-wise & full-length tests based on the latest pattern, updated by subject experts.",
              },
              {
                icon: "🏔️",
                title: "All-India Leaderboard",
                desc: "Compete with aspirants across India every week. Climb the ranks and see where you stand.",
              },
              {
                icon: "🔔",
                title: "Live Tests & Quizzes",
                desc: "Real exam environment scheduled live tests. Instant results, detailed solutions.",
              },
              {
                icon: "📚",
                title: "Curated Study Material",
                desc: "Notes, PYQs, videos and flashcards in one place. Nothing to download.",
              },
              {
                icon: "💬",
                title: "Doubt Resolution",
                desc: "Get explanations from expert faculty and peers within minutes, 24×7.",
              },
            ].map((feature, i) => (
              <ScrollReveal
                key={i}
                direction="up"
                delay={i * 0.06}
                threshold={0.1}
              >
                <div className="group relative bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-600 rounded-2xl md:rounded-3xl p-5 md:p-7 transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-brand-start/0 to-brand-end/0 group-hover:from-brand-start/5 group-hover:to-brand-end/3 transition-all duration-500" />
                  <div className="absolute top-3 right-5 text-4xl sm:text-6xl md:text-7xl font-black text-brand-start/[0.04] leading-none select-none pointer-events-none">
                    {String(i + 1).padStart(2, "0")}
                  </div>
                  <div className="relative z-10">
                    <div className="w-11 h-11 md:w-14 md:h-14 bg-gradient-to-br from-brand-start to-brand-end rounded-lg md:rounded-xl flex items-center justify-center text-xl md:text-2xl mb-3 md:mb-5 shadow-lg group-hover:shadow-glow group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                      {feature.icon}
                    </div>
                    <h3 className="text-sm md:text-lg font-extrabold text-gray-900 dark:text-white mb-1.5 md:mb-3 group-hover:text-brand-start dark:group-hover:text-indigo-300 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── EXAM CATEGORIES (from real categories) ─────── */}
      {examCategories.length > 0 && (
        <section
          className="py-12 md:py-20 bg-gradient-to-b from-gray-50/80 via-white to-gray-50/50 dark:from-gray-900/50 dark:via-gray-800/80 dark:to-gray-900/50"
          id="exams"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="text-center mb-10 md:mb-14">
                <div className="inline-flex items-center gap-2 bg-brand-50 dark:bg-indigo-900/30 text-brand-start dark:text-indigo-300 px-3.5 py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest mb-3 md:mb-4 shadow-xs">
                  📚 Exam Categories
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white mb-2 md:mb-3 tracking-tight">
                  Browse <span className="text-gradient">all categories</span>
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm md:text-base max-w-lg mx-auto">
                  Curated test series and live practice mapped directly to
                  official exam syllabus
                </p>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {examCategories.slice(0, 8).map((cat, i) => {
                const theme = getCategoryTheme(cat.id);
                const catExams = featuredExams
                  .filter(
                    (e) =>
                      String(e.categoryId) === String(cat.id) ||
                      String(e.category) === String(cat.id),
                  )
                  .map((e) => e.title || e.name)
                  .slice(0, 3)
                  .join(", ");
                const subtitleTag =
                  catExams || theme.tag || "Full Mocks & Sectionals";
                return (
                  <ScrollReveal
                    key={cat.id || i}
                    direction="up"
                    delay={i * 0.08}
                    threshold={0.1}
                    className="h-full"
                  >
                    <Link
                      to={`/exams?category=${cat.id}`}
                      className={`group relative overflow-hidden bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl p-5 md:p-6 border border-gray-200/80 dark:border-gray-700/80 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 flex flex-col justify-between h-full ${theme.borderHover}`}
                    >
                      {/* Ambient gradient aura */}
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`}
                      />

                      {/* Top accent shimmer line */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-brand-start to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      <div className="relative z-10">
                        <div className="flex items-center justify-between mb-4">
                          <div
                            className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br ${theme.iconBg} text-white flex items-center justify-center text-2xl sm:text-3xl shadow-lg shadow-black/10 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}
                          >
                            {getExamIcon(cat.id)}
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold border ${theme.pillBg}`}
                          >
                            Official Syllabus
                          </span>
                        </div>

                        <h4 className="font-extrabold text-gray-900 dark:text-white text-base md:text-lg mb-1 group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors">
                          {cat.label || cat.name}
                        </h4>
                        <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm line-clamp-1 mb-4 font-medium">
                          {subtitleTag}
                        </p>
                      </div>

                      <div className="relative z-10 pt-3 mt-auto border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between">
                        <span
                          className={`text-xs font-bold ${theme.accentText} flex items-center gap-1.5 group-hover:gap-2.5 transition-all`}
                        >
                          Explore Tests <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase tracking-wider">
                          Full Mocks
                        </span>
                      </div>
                    </Link>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── LIVE TESTS & QUIZZES ───────────────────────── */}
      {(liveTests.length > 0 || freeQuizzes.length > 0) && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <ScrollReveal>
            <div className="flex items-center gap-2 md:gap-3 mb-5 md:mb-6">
              <div className="relative">
                <span className="text-xl md:text-2xl">🔴</span>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
              </div>
              <div>
                <h2 className="text-lg md:text-2xl font-extrabold text-gray-900 dark:text-white">
                  Live Tests & Quizzes
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm hidden sm:block">
                  Real-time tests happening now
                </p>
              </div>
              <Link
                to="/live-tests"
                className="ml-auto text-brand-start dark:text-indigo-400 font-bold hover:underline flex items-center text-xs md:text-sm gap-1 group"
              >
                View All{" "}
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Live Tests */}
            {liveTests.length > 0 && (
              <ScrollReveal direction="left">
                <div className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-100 dark:border-gray-700 p-4 md:p-6 shadow-soft">
                  <div className="flex items-center gap-2 mb-3 md:mb-5">
                    <Radio className="w-4 h-4 md:w-5 md:h-5 text-red-500" />
                    <h3 className="font-extrabold text-gray-800 dark:text-white text-sm md:text-base">
                      Live Tests
                    </h3>
                    <span className="text-[10px] md:text-xs text-gray-400">
                      ({liveTests.length})
                    </span>
                  </div>
                  <div className="space-y-2.5 md:space-y-3">
                    {liveTestsLoading
                      ? [1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="animate-pulse p-3 md:p-4 rounded-xl border bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-100 dark:border-red-800"
                          >
                            <div className="h-3 md:h-4 bg-red-200 dark:bg-red-800 rounded w-3/4 mb-1.5 md:mb-2" />
                            <div className="h-2.5 md:h-3 bg-red-100 dark:bg-red-900 rounded w-1/2" />
                          </div>
                        ))
                      : liveTests.map((test) => (
                          <Link
                            key={test.id}
                            to={
                              user
                                ? `/test/${test.series?.slug || test.series?._id || test.series?.id || "series"}/${test.id}`
                                : "/login"
                            }
                            className="block p-3 md:p-4 rounded-xl border transition-all duration-300 hover:shadow-md cursor-pointer group bg-gradient-to-br from-red-50/80 to-orange-50/80 dark:from-red-900/10 dark:to-orange-900/10 border-red-100 dark:border-red-800/50"
                          >
                            <div className="flex justify-between items-start mb-1.5">
                              <span className="px-2 py-0.5 text-[9px] md:text-[10px] font-bold rounded-full text-white bg-red-500 animate-pulse">
                                🔴 LIVE
                              </span>
                              <span className="text-[10px] md:text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                                <Users className="w-3 h-3" />
                                {(test.participants || 0) > 1000
                                  ? ((test.participants || 0) / 1000).toFixed(
                                      1,
                                    ) + "k"
                                  : test.participants || 0}
                              </span>
                            </div>
                            <h3 className="font-bold text-gray-800 dark:text-white text-xs md:text-sm mb-1.5 line-clamp-1 group-hover:text-brand-start transition-colors">
                              {test.title}
                            </h3>
                            <div className="flex flex-col gap-1 text-[10px] md:text-[11px] text-gray-600 dark:text-gray-400 mb-2">
                              <div className="flex items-center gap-2 font-semibold">
                                <Clock className="w-3 h-3 text-red-500" />{" "}
                                {test.duration || test.timeLimit || 60} mins
                              </div>
                              <div className="flex items-center gap-1 font-medium text-amber-800 dark:text-amber-300 bg-amber-100/70 dark:bg-amber-900/40 px-2 py-0.5 rounded text-[9px] border border-amber-200 dark:border-amber-800/60">
                                <Calendar className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span className="truncate">
                                  Available:{" "}
                                  {getTestStartDate(test)
                                    ? `${new Date(getTestStartDate(test)).toLocaleDateString("en-GB")}`
                                    : "Available Now"}
                                </span>
                              </div>
                            </div>
                            <button className="w-full py-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-[10px] md:text-xs font-bold rounded-lg md:rounded-xl transition-all hover:shadow-lg">
                              {user ? "▶ Start Now" : "🔒 Login to Start"}
                            </button>
                          </Link>
                        ))}
                  </div>
                </div>
              </ScrollReveal>
            )}

            {/* Free Quizzes */}
            {freeQuizzes.length > 0 && (
              <ScrollReveal direction="right">
                <div className="bg-white dark:bg-gray-800 rounded-2xl md:rounded-3xl border border-gray-100 dark:border-gray-700 p-4 md:p-6 shadow-soft">
                  <div className="flex items-center gap-2 mb-3 md:mb-5">
                    <HelpCircle className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                    <h3 className="font-extrabold text-gray-800 dark:text-white text-sm md:text-base">
                      Free Quizzes
                    </h3>
                    <span className="text-[10px] md:text-xs text-gray-400">
                      ({freeQuizzes.length})
                    </span>
                  </div>
                  <div className="space-y-2.5 md:space-y-3">
                    {liveTestsLoading
                      ? [1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="animate-pulse p-3 md:p-4 rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-100 dark:border-blue-800"
                          >
                            <div className="h-3 md:h-4 bg-blue-200 dark:bg-blue-800 rounded w-3/4 mb-1.5 md:mb-2" />
                            <div className="h-2.5 md:h-3 bg-blue-100 dark:bg-blue-900 rounded w-1/2" />
                          </div>
                        ))
                      : freeQuizzes.map((quiz) => (
                          <Link
                            key={quiz.id}
                            to={
                              user
                                ? `/test/${quiz.series?.slug || quiz.series?._id || quiz.series?.id || "series"}/${quiz.id}`
                                : "/login"
                            }
                            className="block p-3 md:p-4 rounded-xl border transition-all duration-300 hover:shadow-md cursor-pointer group bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-100 dark:border-blue-800/50"
                          >
                            <div className="flex justify-between items-start mb-1.5">
                              <span className="px-2 py-0.5 text-[9px] md:text-[10px] font-bold rounded-full text-white bg-blue-500">
                                ⚡ QUIZ
                              </span>
                              <span className="text-[10px] md:text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-0.5">
                                <Users className="w-3 h-3" />
                                {(quiz.participants || 0) > 1000
                                  ? ((quiz.participants || 0) / 1000).toFixed(
                                      1,
                                    ) + "k"
                                  : quiz.participants || 0}
                              </span>
                            </div>
                            <h3 className="font-bold text-gray-800 dark:text-white text-xs md:text-sm mb-1.5 line-clamp-1 group-hover:text-brand-start transition-colors">
                              {quiz.title}
                            </h3>
                            <div className="flex items-center gap-2 text-[10px] md:text-[11px] text-gray-600 dark:text-gray-400 mb-2">
                              <Clock className="w-3 h-3" />{" "}
                              {quiz.duration || quiz.timeLimit || 15} mins
                              <span>• {quiz.totalQuestions || 10} Qs</span>
                            </div>
                            <button className="w-full py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[10px] md:text-xs font-bold rounded-lg md:rounded-xl transition-all hover:shadow-lg">
                              {user ? "▶ Start Now" : "🔒 Login to Start"}
                            </button>
                          </Link>
                        ))}
                  </div>
                </div>
              </ScrollReveal>
            )}
          </div>
        </section>
      )}

      {/* ─── POPULAR TEST SERIES ────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <ScrollReveal>
          <div className="flex justify-between items-end mb-5 md:mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl md:text-2xl">🔥</span>
                <h2 className="text-lg md:text-2xl font-extrabold text-gray-900 dark:text-white">
                  Popular Test Series
                </h2>
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm hidden sm:block">
                Top-rated series chosen by students with instant rankings
              </p>
            </div>
            <Link
              to="/test-series"
              className="text-brand-start dark:text-indigo-400 font-bold hover:underline flex items-center text-xs md:text-sm gap-1 group"
            >
              View All{" "}
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </ScrollReveal>

        {loading ? (
          <div className="flex gap-4 md:gap-6 pb-4 overflow-hidden">
            {Array.from({ length: isMobile ? 2 : 4 }).map((_, i) => (
              <div
                key={i}
                className="w-56 md:w-64 h-64 md:h-72 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse flex-shrink-0"
              />
            ))}
          </div>
        ) : (
          <ScrollReveal direction="up">
            <div
              ref={popularSeriesScrollRef}
              className="flex items-stretch gap-4 md:gap-6 pb-4 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing select-none"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {popularSeries.map((series, index) => (
                <div
                  key={series._id || `s-${index}`}
                  className="flex flex-col self-stretch h-full transform transition-transform duration-300 hover:scale-[1.02] flex-shrink-0"
                >
                  <TestSeriesCard
                    series={series}
                    user={user}
                    onEnroll={() => {}}
                  />
                </div>
              ))}
            </div>
          </ScrollReveal>
        )}
      </section>

      {/* ─── STUDY MATERIALS ────────────────────────────── */}
      {studyMaterials.length > 0 && (
        <section className="py-12 md:py-20 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700/80 relative overflow-hidden">
          {/* Ambient background decoration */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-brand-start/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <ScrollReveal>
              <div className="flex justify-between items-end mb-6 md:mb-8">
                <div>
                  <div className="inline-flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-3 py-1 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 shadow-xs">
                    <BookOpen className="w-3.5 h-3.5" /> High-Yield Resources
                  </div>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                    Study Materials & Notes
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm mt-0.5 hidden sm:block">
                    Topic-wise video explanations, comprehensive theory PDFs &
                    high-yield revision handouts
                  </p>
                </div>
                <Link
                  to="/study"
                  className="text-brand-start dark:text-indigo-400 font-bold hover:underline flex items-center text-xs md:text-sm gap-1 group whitespace-nowrap"
                >
                  View All{" "}
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </ScrollReveal>

            <ScrollReveal direction="up">
              <div
                ref={studyMaterialsScrollRef}
                className="flex gap-4 md:gap-6 pb-4 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing select-none"
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {studyMaterials.map((subject, index) => (
                  <Link
                    key={subject._id || subject.id || `sub-${index}`}
                    to={`/study/${subject.slug || subject._id || subject.id}`}
                    className="flex-shrink-0 w-[270px] sm:w-[300px] md:w-full max-w-[320px] bg-gradient-to-b from-gray-50/90 to-white dark:from-gray-700/50 dark:to-gray-800/80 border border-gray-200/80 dark:border-gray-600/80 rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-sm hover:shadow-2xl hover:border-indigo-400 dark:hover:border-indigo-500 hover:-translate-y-1.5 transition-all duration-300 group flex flex-col justify-between h-full"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-center gap-3.5 mb-4">
                        <div
                          className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl ${subject.bg || "bg-gradient-to-br from-indigo-500 to-purple-600"} text-white flex items-center justify-center text-2xl sm:text-3xl shadow-md group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shrink-0 overflow-hidden`}
                        >
                          {subject.icon &&
                          (subject.icon.startsWith("http") ||
                            subject.icon.startsWith("/") ||
                            subject.icon.startsWith("data:")) ? (
                            <img
                              loading="lazy"
                              decoding="async"
                              src={subject.icon}
                              alt={subject.title || subject.name}
                              className="w-full h-full object-cover rounded-2xl"
                            />
                          ) : (
                            <span>{getSubjectEmoji(subject)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-gray-900 dark:text-white text-sm md:text-base truncate group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors">
                            {subject.title || subject.name}
                          </h3>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mt-0.5 truncate">
                            {subject.chapters || 0} Chapters •{" "}
                            {subject.topics || 0} Topics
                          </p>
                        </div>
                      </div>

                      {/* Content pills list */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-xs py-1.5 px-2.5 bg-white dark:bg-gray-700/60 rounded-xl border border-gray-100 dark:border-gray-600/60">
                          <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 font-medium">
                            <Play className="w-3.5 h-3.5 text-red-500" />
                            Video Lectures
                          </span>
                          <span className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-md text-[10px] font-bold">
                            {subject.videos || 0}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs py-1.5 px-2.5 bg-white dark:bg-gray-700/60 rounded-xl border border-gray-100 dark:border-gray-600/60">
                          <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 font-medium">
                            <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                            Theory & Revision PDFs
                          </span>
                          <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-md text-[10px] font-bold">
                            {subject.pdf ?? subject.pdfs ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom CTA */}
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between mt-auto">
                      <span className="text-brand-start dark:text-indigo-400 text-xs md:text-sm font-bold flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                        Start Learning <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                      <span className="text-[10px] bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full font-bold border border-green-200 dark:border-green-800">
                        Free Notes
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </section>
      )}

      {/* ─── TESTIMONIALS (from real API) ───────────────── */}
      {!testimonialsLoading && testimonials.length > 0 && (
        <section
          className="py-12 md:py-24"
          style={{ background: "linear-gradient(180deg, #f8faff, #fdf4ff)" }}
          id="reviews"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ScrollReveal>
              <div className="text-center mb-10 md:mb-14">
                <div className="inline-flex items-center gap-2 bg-brand-50 dark:bg-indigo-900/30 text-brand-start dark:text-indigo-300 px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-widest mb-3 md:mb-4">
                  💬 Testimonials
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white mb-3 md:mb-4">
                  Loved by <span className="text-gradient">students</span>
                </h2>
              </div>
            </ScrollReveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {testimonials.slice(0, 3).map((review, i) => {
                const initials = (review.name || "U")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);
                const gradients = [
                  "from-brand-start to-brand-end",
                  "from-pink-500 to-brand-end",
                  "from-emerald-400 to-brand-start",
                ];
                const gradient = gradients[i % gradients.length];
                return (
                  <ScrollReveal
                    key={review._id || i}
                    direction="up"
                    delay={i * 0.12}
                    threshold={0.1}
                  >
                    <div className="bg-white dark:bg-gray-700/50 rounded-2xl md:rounded-3xl p-5 md:p-7 border border-gray-100 dark:border-gray-600 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5 md:hover:-translate-y-2">
                      <div className="flex gap-0.5 text-amber-400 mb-3 md:mb-4">
                        {[...Array(Math.min(review.rating || 5, 5))].map(
                          (_, j) => (
                            <svg
                              key={j}
                              className="w-3.5 h-3.5 md:w-4 md:h-4 fill-current"
                              viewBox="0 0 20 20"
                            >
                              <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                            </svg>
                          ),
                        )}
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 text-xs md:text-sm leading-relaxed mb-4 md:mb-6">
                        "
                        {review.text ||
                          review.message ||
                          review.content ||
                          review.review ||
                          ""}
                        "
                      </p>
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center font-extrabold text-white text-sm md:text-lg shadow-lg`}
                        >
                          {initials}
                        </div>
                        <div>
                          <div className="font-extrabold text-gray-900 dark:text-white text-xs md:text-sm">
                            {review.name || "Student"}
                          </div>
                          <div className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                            {[
                              review.exam,
                              review.examType,
                              review.role,
                              review.category,
                            ]
                              .filter(Boolean)
                              .join(" • ") || "Trstprep Student"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── FOOTER CTA (logged-out only) ──────────────── */}
      {!user && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <ScrollReveal>
            <div
              className="relative overflow-hidden rounded-2xl md:rounded-3xl"
              style={{
                background:
                  "linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #4c1d95 60%, #1e1b4b 100%)",
                backgroundSize: "300% 300%",
                animation: "gradBg 8s ease infinite",
                boxShadow: "0 30px 80px rgba(99,102,241,0.3)",
              }}
            >
              <div
                className="absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, white 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                  maskImage:
                    "radial-gradient(ellipse 70% 70% at 50% 50%, black, transparent)",
                }}
              />
              <div className="absolute top-0 right-0 w-48 h-48 bg-brand-start/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-end/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3" />

              <div className="relative z-10 px-6 py-10 md:px-16 md:py-14 text-center">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white mb-3 md:mb-5">
                  Not sure where to start?
                </h2>
                <p className="text-purple-200/70 text-sm md:text-base mb-6 md:mb-8 max-w-lg mx-auto">
                  Take our free diagnostic test to evaluate your current level
                  and get a personalised study plan.
                </p>
                <div className="flex flex-row justify-center items-center gap-2.5 md:gap-4 w-full sm:w-auto max-w-md sm:max-w-none mx-auto">
                  <Link
                    to="/signup"
                    className="flex-1 sm:flex-initial group px-4 py-2.5 sm:px-8 sm:py-3.5 md:px-10 md:py-4 bg-white text-brand-start font-extrabold rounded-xl md:rounded-2xl shadow-2xl transition-all duration-300 hover:scale-105 inline-flex items-center justify-center text-xs sm:text-sm md:text-base whitespace-nowrap"
                  >
                    🚀 Start Free Trial
                    <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 ml-1 sm:ml-1.5 md:ml-2 group-hover:translate-x-1 transition-transform shrink-0" />
                  </Link>
                  <Link
                    to="/test-series"
                    className="flex-1 sm:flex-initial px-4 py-2.5 sm:px-8 sm:py-3.5 md:px-10 md:py-4 bg-white/10 text-white border border-white/25 font-semibold rounded-xl md:rounded-2xl hover:bg-white/15 transition-all duration-300 inline-flex items-center justify-center text-xs sm:text-sm md:text-base backdrop-blur-sm whitespace-nowrap"
                  >
                    View Test Series
                  </Link>
                </div>
                <div className="flex flex-wrap justify-center gap-4 md:gap-6 mt-6 md:mt-8 text-xs md:text-sm text-purple-200/60">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full bg-green-400/20 flex items-center justify-center text-green-300 text-[8px] md:text-[10px]">
                      ✓
                    </div>
                    Free Analysis
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full bg-green-400/20 flex items-center justify-center text-green-300 text-[8px] md:text-[10px]">
                      ✓
                    </div>
                    All India Rank
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full bg-green-400/20 flex items-center justify-center text-green-300 text-[8px] md:text-[10px]">
                      ✓
                    </div>
                    No Card Required
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>
      )}

      {/* ─── FOOTER ─────────────────────────────────────── */}
      <footer className="bg-gray-900 border-t border-gray-800 text-gray-400 pt-10 pb-8 md:pt-14 md:pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Footer Links Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8 mb-8 md:mb-12">
            {/* Brand Column */}
            <div className="col-span-2 sm:col-span-2 md:col-span-4 lg:col-span-1 mb-2 lg:mb-0">
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-start to-brand-end flex items-center justify-center text-white font-black text-sm shadow-md">
                  ⚡
                </div>
                <span className="text-white font-extrabold text-lg tracking-tight">
                  Trstprep
                </span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed max-w-sm mb-3">
                India's high-yield AI test preparation platform for SSC,
                Railways, Banking, and State Government exams.
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-900/40 border border-indigo-700/40 text-[11px] font-semibold text-indigo-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Mock System Active
              </div>
            </div>

            {/* Tests & Practice */}
            <div>
              <h4 className="text-white text-xs md:text-sm font-bold uppercase tracking-wider mb-3">
                Tests & Practice
              </h4>
              <ul className="space-y-2 text-[11px] md:text-xs">
                <li>
                  <Link
                    to="/test-series"
                    className="hover:text-white transition-colors flex items-center gap-1"
                  >
                    Test Series{" "}
                    <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1 rounded">
                      PRO
                    </span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/live-tests"
                    className="hover:text-white transition-colors flex items-center gap-1"
                  >
                    Live Tests{" "}
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  </Link>
                </li>
                <li>
                  <Link
                    to="/pyps"
                    className="hover:text-white transition-colors"
                  >
                    Previous Year Papers
                  </Link>
                </li>
                <li>
                  <Link
                    to="/practice"
                    className="hover:text-white transition-colors"
                  >
                    Practice Lab
                  </Link>
                </li>
                <li>
                  <Link
                    to="/leaderboard"
                    className="hover:text-white transition-colors"
                  >
                    All-India Leaderboard
                  </Link>
                </li>
                <li>
                  <Link
                    to="/pass"
                    className="hover:text-amber-300 transition-colors text-amber-400 font-semibold flex items-center gap-1"
                  >
                    👑 Trstprep Pass
                  </Link>
                </li>
              </ul>
            </div>

            {/* Study Materials */}
            <div>
              <h4 className="text-white text-xs md:text-sm font-bold uppercase tracking-wider mb-3">
                Study Resources
              </h4>
              <ul className="space-y-2 text-[11px] md:text-xs">
                <li>
                  <Link
                    to="/study"
                    className="hover:text-white transition-colors"
                  >
                    Study Materials & Notes
                  </Link>
                </li>
                <li>
                  <Link
                    to="/videos"
                    className="hover:text-white transition-colors"
                  >
                    Video Lectures
                  </Link>
                </li>
                <li>
                  <Link
                    to="/current-affairs"
                    className="hover:text-white transition-colors"
                  >
                    Daily Current Affairs
                  </Link>
                </li>
                <li>
                  <Link
                    to="/exams"
                    className="hover:text-white transition-colors"
                  >
                    Exams & Syllabus
                  </Link>
                </li>
                <li>
                  <Link
                    to="/blog"
                    className="hover:text-white transition-colors"
                  >
                    Articles & Prep Guides
                  </Link>
                </li>
              </ul>
            </div>

            {/* Exam Categories */}
            <div>
              <h4 className="text-white text-xs md:text-sm font-bold uppercase tracking-wider mb-3">
                Exam Categories
              </h4>
              <ul className="space-y-2 text-[11px] md:text-xs">
                <li>
                  <Link
                    to="/exams?category=ssc"
                    className="hover:text-white transition-colors"
                  >
                    SSC (CGL, CHSL, GD)
                  </Link>
                </li>
                <li>
                  <Link
                    to="/exams?category=railways"
                    className="hover:text-white transition-colors"
                  >
                    Railways (NTPC, Group D)
                  </Link>
                </li>
                <li>
                  <Link
                    to="/exams?category=banking"
                    className="hover:text-white transition-colors"
                  >
                    Banking (IBPS, SBI, PO)
                  </Link>
                </li>
                <li>
                  <Link
                    to="/exams?category=upsc"
                    className="hover:text-white transition-colors"
                  >
                    UPSC & State PSCs
                  </Link>
                </li>
                <li>
                  <Link
                    to="/exams"
                    className="hover:text-indigo-400 transition-colors font-medium"
                  >
                    View All Categories →
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company & Support */}
            <div>
              <h4 className="text-white text-xs md:text-sm font-bold uppercase tracking-wider mb-3">
                Support & Legal
              </h4>
              <ul className="space-y-2 text-[11px] md:text-xs">
                <li>
                  <Link
                    to="/about"
                    className="hover:text-white transition-colors"
                  >
                    About Us
                  </Link>
                </li>
                <li>
                  <Link
                    to="/contact"
                    className="hover:text-white transition-colors"
                  >
                    Contact & Support
                  </Link>
                </li>
                <li>
                  <Link
                    to="/faq"
                    className="hover:text-white transition-colors"
                  >
                    FAQs & Help
                  </Link>
                </li>
                <li>
                  <Link
                    to="/privacy"
                    className="hover:text-white transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="hover:text-white transition-colors"
                  >
                    Terms & Conditions
                  </Link>
                </li>
                <li>
                  <Link
                    to="/refund"
                    className="hover:text-white transition-colors"
                  >
                    Refund Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-6 border-t border-gray-800/80 flex flex-col sm:flex-row justify-between items-center gap-3 text-[11px] md:text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span>
                © {new Date().getFullYear()} Trstprep Technologies. All rights
                reserved.
              </span>
            </div>
            <div className="flex items-center gap-3 md:gap-4 text-gray-400">
              <Link
                to="/privacy"
                className="hover:text-gray-200 transition-colors"
              >
                Privacy
              </Link>
              <span className="text-gray-700">•</span>
              <Link
                to="/terms"
                className="hover:text-gray-200 transition-colors"
              >
                Terms
              </Link>
              <span className="text-gray-700">•</span>
              <Link
                to="/refund"
                className="hover:text-gray-200 transition-colors"
              >
                Refunds
              </Link>
              <span className="text-gray-700">•</span>
              <Link
                to="/contact"
                className="hover:text-gray-200 transition-colors"
              >
                Support
              </Link>
            </div>
            <p className="flex items-center gap-1">
              Made with <span className="text-red-500">❤️</span> for Indian
              Aspirants
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}

export default HomeSections;
