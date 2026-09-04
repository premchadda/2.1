import { useState, useMemo } from "react";
import {
  FileText,
  Download,
  Search,
  Loader2,
  Calendar,
  ChevronRight,
  Lock,
  Target,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import api from "../../shared/lib/api";
import { useAuth } from "../../shared/providers/AuthContext";
import { checkFeatureAccess } from "../../shared/utils/pass-helpers.js";
import { useNavigate } from "react-router-dom";
import { AnimatedHero, Breadcrumb } from "../../shared/components";
import { getPublicStats } from "../../shared/lib/dataService";
import { useEffect } from "react";

export default function PreviousYearPapers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [examFilter, setExamFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [platformStats, setPlatformStats] = useState({
    mockTests: 0,
    examsCovered: 0,
  });

  useEffect(() => {
    const controller = new AbortController();
    const fetchStats = async () => {
      try {
        const stats = await getPublicStats();
        if (controller.signal.aborted) return;
        if (stats) {
          setPlatformStats({
            mockTests: stats.mockTests || 0,
            examsCovered: stats.examsCovered || 0,
          });
        }
      } catch (error) {
        if (error.name !== "AbortError")
          console.error("Failed to fetch stats:", error);
      }
    };
    fetchStats();
    return () => controller.abort();
  }, []);

  const hasDownloadAccess =
    checkFeatureAccess("pdf_downloads", user?.passType || "free") ||
    user?.role === "admin";

  // Fetch Categories/Exams for Filter
  const { data: categories = [] } = useQuery({
    queryKey: ["exam-categories-pyq"],
    queryFn: async () => {
      const response = await api.get("/api/exam-categories");
      return response.data?.data || [];
    },
    staleTime: 1000 * 60 * 60,
  });

  // Fetch Papers from Real API
  const { data: papers = [], isLoading } = useQuery({
    queryKey: ["previous-year-papers", examFilter, yearFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (examFilter !== "all") params.append("exam", examFilter);
      if (yearFilter !== "all") params.append("year", yearFilter);
      const response = await api.get(`/api/previous-year-papers?${params}`);
      return response.data?.data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Derived filters
  const examsList = useMemo(() => {
    const list = ["all"];
    categories.forEach((cat) => {
      if (cat.name && !list.includes(cat.name)) list.push(cat.name);
    });
    // Also include exams from papers if any are missing from categories
    papers.forEach((p) => {
      if (p.exam && !list.includes(p.exam)) list.push(p.exam);
    });
    return list;
  }, [categories, papers]);

  const yearsList = useMemo(() => {
    const list = ["all"];
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= currentYear - 5; y--) {
      list.push(String(y));
    }
    // Add years from actual papers
    papers.forEach((p) => {
      if (p.year && !list.includes(String(p.year))) list.push(String(p.year));
    });
    return list.sort((a, b) => b - a);
  }, [papers]);

  const filteredPapers = useMemo(() => {
    return papers.filter(
      (p) =>
        p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.exam?.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [papers, searchTerm]);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header & Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          <Breadcrumb
            items={[{ label: "Home", path: "/" }, { label: "PYQ Archive" }]}
          />
        </div>
      </div>

      <AnimatedHero
        pageType="pyqPaper"
        title="Official Previous Year Papers"
        subtitle="Practice with authentic question papers to understand real exam standards and patterns."
        compact={true}
      />

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Compact Filters */}
        <div className="bg-white rounded-lg border border-gray-100 p-2 mb-6">
          <div className="flex flex-row items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search papers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-1 focus:ring-brand-start focus:border-brand-start transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                >
                  <ChevronRight className="w-3.5 h-3.5 rotate-45" />
                </button>
              )}
            </div>

            {/* Exam Filter */}
            <select
              value={examFilter}
              onChange={(e) => setExamFilter(e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-brand-start flex-shrink-0"
            >
              {examsList.map((exam) => (
                <option key={exam} value={exam}>
                  {exam === "all" ? "All Exams" : exam}
                </option>
              ))}
            </select>

            {/* Year Filter */}
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className="px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white focus:ring-1 focus:ring-brand-start flex-shrink-0 hidden sm:block"
            >
              {yearsList.map((year) => (
                <option key={year} value={year}>
                  {year === "all" ? "All Years" : year}
                </option>
              ))}
            </select>

            {/* Results Count */}
            <span className="text-xs text-gray-500 flex-shrink-0 hidden md:inline">
              {filteredPapers.length} found
            </span>

            {/* Clear Button */}
            {(examFilter !== "all" || yearFilter !== "all" || searchTerm) && (
              <button
                onClick={() => {
                  setExamFilter("all");
                  setYearFilter("all");
                  setSearchTerm("");
                }}
                className="text-xs text-brand-start font-medium hover:underline flex-shrink-0"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">
              Curating Papers...
            </p>
          </div>
        ) : filteredPapers.length > 0 ? (
          <div className="grid gap-6">
            {filteredPapers.map((paper, idx) => (
              <div
                key={paper._id || idx}
                className="group bg-white rounded-[2rem] border border-gray-100 p-6 hover:border-indigo-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
              >
                {/* Visual Accent */}
                <div className="absolute -top-12 -right-12 w-24 h-24 bg-indigo-50 rounded-full group-hover:bg-indigo-100 transition-colors duration-300" />

                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex flex-col gap-2">
                      <span className="inline-flex items-center px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100/50">
                        {paper.exam}
                      </span>
                      <span className="inline-flex items-center px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest w-fit">
                        Year {paper.year}
                      </span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100 text-white">
                      <FileText className="w-6 h-6" />
                    </div>
                  </div>

                  <h3 className="font-extrabold text-gray-900 text-lg mb-4 leading-tight group-hover:text-indigo-600 transition-colors">
                    {paper.title}
                  </h3>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {(
                      paper.subjects || ["Quantitative", "Reasoning", "English"]
                    )
                      .slice(0, 3)
                      .map((sub, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-bold text-gray-400 border border-gray-100 px-2 py-0.5 rounded-md"
                        >
                          {sub}
                        </span>
                      ))}
                  </div>

                  <div className="flex items-center justify-between py-4 border-t border-gray-50">
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <Target className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-tighter">
                        {paper.questions || 100} Questions
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-tighter">
                        Official
                      </span>
                    </div>
                  </div>

                  {hasDownloadAccess ? (
                    <a
                      href={paper.pdfUrl || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-xs hover:bg-black transition-all shadow-lg shadow-gray-200"
                    >
                      <Download className="w-4 h-4" />
                      DOWNLOAD PDF
                    </a>
                  ) : (
                    <button
                      onClick={() => navigate("/pass")}
                      className="flex items-center justify-center gap-2 w-full py-4 bg-amber-50 text-amber-600 border border-amber-100 rounded-2xl font-black text-xs hover:bg-amber-100 transition-all group/btn"
                    >
                      <Lock className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                      UNLOCK WITH PRO PASS
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-gray-200">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">
              No Papers Found
            </h3>
            <p className="text-gray-500 font-medium max-w-xs mx-auto mb-8 text-sm">
              We couldn't find any papers matching your current filters. Try
              resetting them.
            </p>
            <button
              onClick={() => {
                setExamFilter("all");
                setYearFilter("all");
                setSearchTerm("");
              }}
              className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Global Stats Footer */}
        <div className="mt-20 bg-gray-900 rounded-[3rem] p-10 md:p-4 sm:p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px]" />
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
            <div>
              <p className="text-xl sm:text-2xl lg:text-3xl md:text-3xl sm:text-4xl lg:text-5xl font-black mb-1">
                {platformStats.mockTests}
              </p>
              <p className="text-[10px] md:text-xs font-black text-indigo-300 uppercase tracking-[0.2em]">
                Live Papers
              </p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl lg:text-3xl md:text-3xl sm:text-4xl lg:text-5xl font-black mb-1">
                {platformStats.examsCovered}
              </p>
              <p className="text-[10px] md:text-xs font-black text-indigo-300 uppercase tracking-[0.2em]">
                Exams Covered
              </p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl lg:text-3xl md:text-3xl sm:text-4xl lg:text-5xl font-black mb-1">
                5+
              </p>
              <p className="text-[10px] md:text-xs font-black text-indigo-300 uppercase tracking-[0.2em]">
                Years Depth
              </p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl lg:text-3xl md:text-3xl sm:text-4xl lg:text-5xl font-black mb-1">
                FREE
              </p>
              <p className="text-[10px] md:text-xs font-black text-indigo-300 uppercase tracking-[0.2em]">
                View Access
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
