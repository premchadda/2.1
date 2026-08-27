import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  Scale,
  Calendar,
  Users,
  Clock,
  FileText,
  Check,
  AlertCircle,
} from "lucide-react";
import api from "../../shared/lib/dataService";

export default function ExamCompare() {
  const { examId } = useParams();
  const [examData, setExamData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedYears, _setSelectedYears] = useState(["2026", "2025"]);

  useEffect(() => {
    const controller = new AbortController();
    fetchExamData(controller.signal);
    return () => controller.abort();
  }, [examId]);

  const fetchExamData = async (signal) => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const response = await api.get(
        `/api/exams/${examId}/compare?years=${selectedYears.join(",")}`,
        { signal },
      );
      if (signal?.aborted) return;
      if (response.data?.success) {
        setExamData(response.data.data);
      } else {
        setExamData(null);
        setErrorMessage(
          response.data?.message ||
            "Comparison data is not available for this exam yet.",
        );
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Failed to fetch exam compare data:", error);
        setExamData(null);
        setErrorMessage(
          "Comparison data could not be loaded. Please try again.",
        );
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  const getRetry = () => {
    const controller = new AbortController();
    setLoading(true);
    fetchExamData(controller.signal).finally(() => setLoading(false));
  };

  const comparisonFields = [
    { label: "Notification Date", key: "notificationDate" },
    { label: "Application Start", key: "applicationStart", isDate: true },
    { label: "Application End", key: "applicationEnd", isDate: true },
    { label: "Exam Date", key: "examDateStart", isDate: true },
    { label: "Result Date", key: "resultDate", isDate: true },
    { label: "Total Vacancy", key: "vacancies", isNumber: true },
  ];

  const getValue = (yearData, field) => {
    if (!yearData) return "-";
    const value = yearData[field.key];
    if (!value) return "-";
    if (field.isDate) {
      return new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    if (field.isNumber) {
      return value.toLocaleString();
    }
    return value;
  };

  const getChangeIndicator = (current, previous) => {
    if (!current || !previous) return null;
    if (current === previous) return null;
    const isIncrease = parseInt(current) > parseInt(previous);
    return {
      type: isIncrease ? "increase" : "decrease",
      text: isIncrease ? "↑" : "↓",
    };
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto px-4">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
          <Link to="/exams" className="hover:text-brand-start">
            Exams
          </Link>
          <ChevronRight className="w-4 h-4" />
          <Link
            to={`/exam/${examId}`}
            className="hover:text-brand-start capitalize"
          >
            {examId.replace(/-/g, " ")}
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-900 dark:text-white font-medium">
            Compare
          </span>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-r from-brand-start to-brand-end rounded-2xl p-8 text-white mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Scale className="w-8 h-8" />
            <Users className="w-6 h-6" />
            <h1 className="text-xl sm:text-2xl lg:text-3xl md:text-2xl sm:text-3xl lg:text-4xl font-bold capitalize">
              {examId.replace(/-/g, " ")} - Year Comparison
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <Clock className="w-4 h-4" />
            <p className="text-white/90 text-lg">
              Compare exam details across different years
            </p>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded mb-8"></div>
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-gray-200 dark:bg-gray-700 rounded"
                ></div>
              ))}
            </div>
          </div>
        ) : errorMessage ||
          !Array.isArray(examData) ||
          examData.length === 0 ? (
          /* Error / Empty State — no fabricated fallback data */
          <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden p-8 text-center">
            <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Comparison data unavailable
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              {errorMessage ||
                "Yearly comparison data has not been published for this exam yet."}
            </p>
            <button
              onClick={getRetry}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition"
            >
              Try Again
            </button>
          </div>
        ) : (
          /* Comparison Table */
          <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700">
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Parameter
                    </th>
                    {examData.map((year) => (
                      <th
                        key={String(year.year)}
                        className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white"
                      >
                        <div className="flex flex-col items-center">
                          <Calendar className="w-6 h-6 text-indigo-500 mb-1" />
                          <span className="text-2xl font-bold">
                            {year.year}
                          </span>
                          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                            Year
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {comparisonFields.map((field, idx) => (
                    <tr
                      key={field.key}
                      className={
                        idx % 2 === 0
                          ? "bg-white dark:bg-gray-800"
                          : "bg-gray-50 dark:bg-gray-700/50"
                      }
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          {field.key === "vacancies" ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : null}
                          {field.key === "ageLimit" ? (
                            <Clock className="w-4 h-4 text-blue-500" />
                          ) : null}
                          {field.label}
                        </div>
                      </td>
                      {examData.map((year, yearIdx) => {
                        const currentValue = getValue(year, field);
                        const previousValue =
                          yearIdx < examData.length - 1
                            ? getValue(examData[yearIdx + 1], field)
                            : null;
                        const change = getChangeIndicator(
                          currentValue,
                          previousValue,
                        );

                        return (
                          <td
                            key={String(year.year)}
                            className="px-6 py-4 text-center"
                          >
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-sm text-gray-600 dark:text-gray-300">
                                {currentValue}
                              </span>
                              {change && (
                                <span
                                  className={`text-xs px-2 py-0.5 rounded ${
                                    change.type === "increase"
                                      ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-300"
                                      : "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300"
                                  }`}
                                >
                                  {change.text}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Back Button */}
        <div className="mt-8">
          <Link
            to={`/exam/${examId}`}
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-brand-start transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to {examId.replace(/-/g, " ")}
          </Link>
        </div>
      </div>
    </div>
  );
}
