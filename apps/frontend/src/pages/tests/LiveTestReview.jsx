import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { api } from "../../shared/lib/dataService";
import sanitizeHtml from "../../shared/lib/sanitizeHtml";
import MathRenderer from "../../shared/components/MathRenderer";

export default function LiveTestReview() {
  const { liveTestId } = useParams();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const { data: result, isLoading } = useQuery({
    queryKey: ["live-test-review", liveTestId],
    queryFn: async () => {
      const response = await api.get(`/api/live-tests/${liveTestId}/result`);
      return response.data?.data || null;
    },
    staleTime: 1000 * 60,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading review...</p>
        </div>
      </div>
    );
  }

  const questions = result?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];

  if (!result || !currentQuestion) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 font-semibold mb-4">
            Review data is not available.
          </p>
          <Link
            to={`/live-test-results/${liveTestId}`}
            className="text-indigo-600 hover:text-indigo-700 font-semibold"
          >
            Back to Results
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to={`/live-test-results/${liveTestId}`}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Results
          </Link>
          <div className="text-sm text-slate-500">
            Question {currentQuestionIndex + 1} of {questions.length}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            {currentQuestion.isCorrect ? (
              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            )}
            <div>
              <div className="text-sm font-bold uppercase tracking-widest text-slate-400">
                {currentQuestion.subject}
              </div>
              <div className="text-xl font-black text-slate-900">
                {currentQuestion.isCorrect
                  ? "Correct Answered"
                  : currentQuestion.answered
                    ? "Incorrect Answered"
                    : "Skipped Question"}
              </div>
            </div>
          </div>

          <div className="text-slate-800 text-base sm:text-lg mb-8 leading-relaxed">
            <MathRenderer text={sanitizeHtml(currentQuestion.text || "")} />
          </div>

          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => {
              const rawCorrect =
                currentQuestion.correctOption ??
                currentQuestion.correct_option ??
                currentQuestion.correct_option_id ??
                currentQuestion.correctOptionId ??
                currentQuestion.correctAnswer ??
                currentQuestion.correct_answer ??
                currentQuestion.correct ??
                currentQuestion.answer;
              const isCorrectOption =
                rawCorrect !== undefined &&
                rawCorrect !== null &&
                rawCorrect !== "" &&
                (String(option) === String(rawCorrect) ||
                  index === Number(rawCorrect) ||
                  String.fromCharCode(65 + index) ===
                    String(rawCorrect).toUpperCase());
              const rawUserAns =
                currentQuestion.userAnswer ?? currentQuestion.selectedOption;
              const isSelectedOption =
                rawUserAns !== undefined &&
                rawUserAns !== null &&
                (String(option) === String(rawUserAns) ||
                  index === Number(rawUserAns) ||
                  String.fromCharCode(65 + index) ===
                    String(rawUserAns).toUpperCase());

              let optionClasses = "border-slate-200 bg-white";
              if (isCorrectOption)
                optionClasses = "border-green-500 bg-green-50";
              if (isSelectedOption && !currentQuestion.isCorrect)
                optionClasses = "border-red-500 bg-red-50";

              return (
                <div
                  key={index}
                  className={`rounded-2xl border-2 px-4 py-4 ${optionClasses}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="text-slate-800 flex-1 min-w-0">
                      <MathRenderer text={sanitizeHtml(option)} />
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
                      {isCorrectOption && (
                        <span className="text-green-600">Correct</span>
                      )}
                      {isSelectedOption && (
                        <span className="text-indigo-600">Your Answer</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {currentQuestion.explanation && (
            <div className="mt-8 rounded-2xl bg-slate-50 border border-slate-200 p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                Explanation
              </div>
              <div className="text-slate-700 leading-relaxed">
                <MathRenderer
                  text={sanitizeHtml(currentQuestion.explanation)}
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 flex items-center justify-between">
          <button
            onClick={() =>
              setCurrentQuestionIndex((index) => Math.max(0, index - 1))
            }
            disabled={currentQuestionIndex === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 text-slate-700 font-medium disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="grid grid-cols-6 md:grid-cols-10 gap-2">
            {questions.map((question, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`w-9 h-9 rounded-xl text-sm font-bold ${
                  index === currentQuestionIndex
                    ? "bg-indigo-600 text-white"
                    : question.isCorrect
                      ? "bg-green-100 text-green-700"
                      : question.answered
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-700"
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <button
            onClick={() =>
              setCurrentQuestionIndex((index) =>
                Math.min(questions.length - 1, index + 1),
              )
            }
            disabled={currentQuestionIndex === questions.length - 1}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 text-slate-700 font-medium disabled:opacity-50"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
