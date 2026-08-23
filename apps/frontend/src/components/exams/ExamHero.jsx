import { useState } from "react";
import { ChevronDown, Calendar, ArrowRight } from "lucide-react";

export default function ExamHero({ exam, selectedYear, onYearChange, years }) {
  const [showYearDropdown, setShowYearDropdown] = useState(false);

  return (
    <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white py-12 md:py-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl lg:text-3xl md:text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">
              {exam?.name || "Exam Details"}
            </h1>
            <p className="text-indigo-100 text-lg mb-4">
              {exam?.description ||
                "Complete exam information and preparation resources"}
            </p>
            <div className="flex flex-wrap gap-4">
              {exam?.stats && (
                <>
                  <div className="bg-white/10 backdrop-blur rounded-lg px-4 py-2">
                    <span className="text-2xl font-bold">
                      {exam.stats.tests}+
                    </span>
                    <span className="ml-2 text-indigo-100">Tests</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg px-4 py-2">
                    <span className="text-2xl font-bold">
                      {exam.stats.questions}+
                    </span>
                    <span className="ml-2 text-indigo-100">Questions</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg px-4 py-2">
                    <span className="text-2xl font-bold">
                      {exam.stats.users}+
                    </span>
                    <span className="ml-2 text-indigo-100">Users</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Year Selector */}
          <div className="relative">
            <button
              onClick={() => setShowYearDropdown(!showYearDropdown)}
              className="flex items-center gap-3 bg-white text-indigo-900 px-6 py-3 rounded-lg font-medium hover:bg-indigo-50 transition-colors shadow-lg"
            >
              <Calendar className="w-5 h-5" />
              <span>{selectedYear || "Select Year"}</span>
              <ChevronDown
                className={`w-5 h-5 transition-transform ${showYearDropdown ? "rotate-180" : ""}`}
              />
            </button>

            {showYearDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-10">
                {years?.map((year) => (
                  <button
                    key={year}
                    onClick={() => {
                      onYearChange(year);
                      setShowYearDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 hover:bg-indigo-50 transition-colors ${
                      selectedYear === year
                        ? "bg-indigo-100 text-indigo-700 font-medium"
                        : "text-gray-700"
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href="#overview"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors"
          >
            Overview <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="#syllabus"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors"
          >
            Syllabus <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="#updates"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors"
          >
            Updates <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="#previous-year"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors"
          >
            Previous Year Papers <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
