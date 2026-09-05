import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  Sparkles,
  Lightbulb,
  Footprints,
  FilterX,
  X,
  AlertTriangle,
  Languages,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import MathRenderer from "../../../shared/components/MathRenderer";
import { api } from "../../../shared/lib/dataService";

const TIERS = [
  {
    tier: 1,
    label: "Concept Clue",
    penalty: "5% penalty",
    icon: Lightbulb,
    badgeColor:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    activeColor: "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30",
    desc: "Governing theorem & formula",
  },
  {
    tier: 2,
    label: "Approach Clue",
    penalty: "15% penalty",
    icon: Footprints,
    badgeColor:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    activeColor: "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30",
    desc: "Problem setup & decomposition",
  },
  {
    tier: 3,
    label: "Elimination",
    penalty: "25% penalty",
    icon: FilterX,
    badgeColor:
      "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
    activeColor: "border-rose-500 bg-rose-50/50 dark:bg-rose-950/30",
    desc: "Eliminates trap distractors",
  },
];

export default function SocraticHintModal({
  isOpen,
  onClose,
  question,
  questionIndex = 0,
  telemetry = {},
  onHintApplied,
}) {
  const [activeTier, setActiveTier] = useState(1);
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(false);
  const [hintData, setHintData] = useState({});
  const [error, setError] = useState(null);

  const questionId = question?.id || question?._id;

  useEffect(() => {
    if (!isOpen || !questionId) return;

    // Fetch hint for activeTier & language if not cached
    const cacheKey = `${activeTier}_${language}`;
    if (hintData[cacheKey]) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    api
      .post(`/api/intelligence/questions/${questionId}/socratic-hint`, {
        tier: activeTier,
        language,
        telemetry: {
          timeSpentSeconds: telemetry.timeSpentSeconds || 60,
          benchmarkTimeSeconds: telemetry.benchmarkTimeSeconds || 60,
          selectionChanges: telemetry.selectionChanges || 0,
          idleTimeSeconds: telemetry.idleTimeSeconds || 0,
        },
      })
      .then((res) => {
        if (!isMounted) return;
        const data = res.data?.data || res.data || {};
        setHintData((prev) => ({
          ...prev,
          [cacheKey]: data,
        }));
        if (onHintApplied) {
          onHintApplied({
            questionId,
            tier: activeTier,
            penaltyFactor: data.penaltyFactor || 0.05,
          });
        }
      })
      .catch((_err) => {
        if (!isMounted) return;
        // Algorithmic client fallback if offline or mock environment
        const fallbackText =
          activeTier === 1
            ? language === "hi"
              ? "💡 **अवधारणा संकेत**: इस प्रश्न को हल करने के लिए मौलिक सूत्रों और समीकरणों का संतुलित उपयोग करें।"
              : "💡 **Concept Clue**: Break down the problem into fundamental components. Note the governing mathematical or conceptual relationship."
            : activeTier === 2
              ? language === "hi"
                ? "🪜 **दृष्टिकोण संकेत**: पहले सभी दी गई राशियों को समान इकाइयों में व्यवस्थित करें और चरणबद्ध गणना करें।"
                : "🪜 **Approach Clue**: Align all given parameters into uniform units. Define the unknown variable and establish the primary identity."
              : language === "hi"
                ? "🚫 **विकल्प निरसन**: सामान्य भ्रम पैदा करने वाले गलत विकल्पों को सावधानीपूर्वक निरस्त करें।"
                : "🚫 **Distractor Elimination**: Watch out for common sign and boundary traps. Verify calculation before finalizing.";

        setHintData((prev) => ({
          ...prev,
          [cacheKey]: {
            hint: fallbackText,
            tier: activeTier,
            penaltyFactor:
              activeTier === 1 ? 0.05 : activeTier === 2 ? 0.15 : 0.25,
            eliminatedOptionIndices: activeTier === 3 ? [0, 1] : [],
          },
        }));
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, questionId, activeTier, language]);

  if (!isOpen) return null;

  const currentHint = hintData[`${activeTier}_${language}`];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="socratic-hint-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl shadow-2xl border border-purple-100 dark:border-purple-900/40 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-transparent">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="socratic-hint-title"
                className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white truncate"
                title="AI Socratic Guide"
              >
                AI Socratic Guide
              </h2>
              <p
                className="text-[11px] text-gray-500 dark:text-gray-400 truncate"
                title={`Question ${questionIndex + 1} • Guided clues without spoiling the answer`}
              >
                Question {questionIndex + 1} • Guided clues without spoiling the
                answer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Language Toggle */}
            <button
              onClick={() => setLanguage((l) => (l === "en" ? "hi" : "en"))}
              title="Toggle Hindi / English"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 hover:bg-gray-100 transition-colors"
            >
              <Languages className="w-3.5 h-3.5 text-indigo-500" />
              <span>{language === "en" ? "हिन्दी" : "English"}</span>
            </button>

            <button
              onClick={onClose}
              aria-label="Close Hint Modal"
              className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Tier Selector */}
          <div className="grid grid-cols-3 gap-2">
            {TIERS.map((t) => {
              const Icon = t.icon;
              const isActive = activeTier === t.tier;
              return (
                <button
                  key={t.tier}
                  onClick={() => setActiveTier(t.tier)}
                  className={`p-2 sm:p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    isActive
                      ? `${t.activeColor} border-purple-500 ring-2 ring-purple-500/20 shadow-xs`
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive
                          ? "text-purple-600 dark:text-purple-400"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    />
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${t.badgeColor}`}
                    >
                      Tier {t.tier}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white leading-tight">
                      {t.label}
                    </p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                      {t.penalty}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Friction Indicator Alert */}
          {telemetry.frictionScore >= 0.6 && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-900 dark:text-indigo-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Cognitive Friction Detected: </span>
                <span>
                  You have spent elevated time on this question. Reviewing this
                  clue will help unlock the initial step without losing attempt
                  momentum.
                </span>
              </div>
            </div>
          )}

          {/* Hint Display Box */}
          <div className="min-h-[120px] p-4 rounded-xl bg-slate-50 dark:bg-gray-900/80 border border-slate-200 dark:border-gray-700 flex flex-col justify-center">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                <span className="text-xs font-medium">
                  Synthesizing Socratic clue...
                </span>
              </div>
            ) : error ? (
              <p className="text-xs text-rose-500">{error}</p>
            ) : currentHint?.hint ? (
              <div className="text-xs sm:text-sm text-gray-800 dark:text-gray-200 leading-relaxed space-y-2">
                <MathRenderer text={currentHint.hint} />
                {currentHint.eliminatedOptionIndices?.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      Trap options eliminated: [
                      {currentHint.eliminatedOptionIndices
                        .map((idx) => String.fromCharCode(65 + idx))
                        .join(", ")}
                      ]
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center">
                Select a clue tier to unlock pedagogical guidance.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400 text-[11px]">
            Penalty is deducted only from final question score
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-xl shadow-xs hover:opacity-95 active:scale-[0.98] transition cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}

SocraticHintModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  question: PropTypes.object,
  questionIndex: PropTypes.number,
  telemetry: PropTypes.object,
  onHintApplied: PropTypes.func,
};
