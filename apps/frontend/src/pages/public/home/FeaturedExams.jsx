import { Link } from "react-router-dom";
import { ScrollReveal } from "../../../shared/components";
import { ArrowRight, BookOpen } from "lucide-react";

function FeaturedExams({
  loading,
  isMobile,
  featuredExams,
  categoryMap,
  getExamIcon,
}) {
  const renderSkeletonCards = (count, w = "w-[270px]", h = "h-36") => (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${w} ${h} bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse flex-shrink-0`}
        />
      ))}
    </div>
  );

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <ScrollReveal>
        <div className="flex justify-between items-end mb-5 md:mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl md:text-2xl">📚</span>
              <h2 className="text-lg md:text-2xl font-extrabold text-gray-900 dark:text-white">
                Featured Exams
              </h2>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm hidden sm:block">
              Top exam categories covered by our platform
            </p>
          </div>
          <Link
            to="/exams"
            className="text-brand-start dark:text-indigo-400 font-bold hover:underline flex items-center text-xs md:text-sm gap-1 group"
          >
            View All{" "}
            <ArrowRight className="w-3.5 h-3.5 ml-0.5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </ScrollReveal>

      {loading ? (
        renderSkeletonCards(
          isMobile ? 3 : 4,
          isMobile ? "w-[200px]" : "w-[270px]",
          isMobile ? "h-28" : "h-36",
        )
      ) : featuredExams.length > 0 ? (
        <ScrollReveal direction="up" threshold={0.05}>
          <div className="relative overflow-hidden rounded-xl md:rounded-2xl">
            <div className="flex gap-3 md:gap-5 animate-marquee-left hover:[animation-play-state:paused]">
              {[...featuredExams, ...featuredExams].map((exam, index) => (
                <Link
                  key={`${exam._id || exam.id}-${index}`}
                  to={`/exam/${exam.examId || exam.id}`}
                  className="w-[230px] md:w-[270px] flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl md:rounded-2xl border border-gray-100 dark:border-gray-700 p-4 md:p-6 hover:shadow-hover-card hover:border-brand-start dark:hover:border-indigo-500 transition-all cursor-pointer group"
                >
                  <div className="text-2xl sm:text-3xl mb-2 md:mb-3 group-hover:scale-110 transition-transform">
                    {getExamIcon(exam.categoryId)}
                  </div>
                  <div className="mb-1 md:mb-2">
                    <span className="text-[10px] md:text-xs font-bold text-brand-start dark:text-indigo-400 uppercase tracking-widest">
                      {categoryMap[exam.categoryId] || exam.categoryId}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-gray-900 dark:text-white text-sm md:text-lg group-hover:text-brand-start dark:group-hover:text-indigo-400 transition-colors truncate">
                    {exam.title}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm mt-0.5 md:mt-1 line-clamp-1">
                    {exam.fullName}
                  </p>
                  <div className="mt-2 md:mt-4 flex items-center gap-1.5 md:gap-2 text-brand-start dark:text-indigo-400 text-[10px] md:text-xs font-bold group-hover:gap-2.5 md:group-hover:gap-3 transition-all">
                    Explore <ArrowRight className="w-3 h-3 md:w-3.5 md:h-3.5" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </ScrollReveal>
      ) : (
        <div className="text-center py-8 md:py-12 bg-gray-50 dark:bg-gray-800 rounded-xl md:rounded-2xl">
          <BookOpen className="w-10 h-10 md:w-12 md:h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2 md:mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
            No featured exams available
          </p>
        </div>
      )}
    </section>
  );
}

export default FeaturedExams;
