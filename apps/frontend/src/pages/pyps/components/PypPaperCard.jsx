import { Link } from "react-router-dom";
import { Radio, Crown, Download } from "lucide-react";
import Card from "../../../shared/components/ui/Card.jsx";
import Badge from "../../../shared/components/ui/Badge.jsx";
import { getCategoryEmoji } from "../../../assets/config/emoji.js";
import { getTestEntitlement } from "../../../shared/utils/entitlement.js";
import { parseLanguageList } from "../../../shared/lib/language.js";

const LANG_VARIANT = {
  en: "primary",
  eng: "primary",
  english: "primary",
  hi: "success",
  hin: "success",
  hindi: "success",
  bn: "warning",
  ben: "warning",
  bengali: "warning",
  ta: "error",
  tam: "error",
  tamil: "error",
  te: "pro",
  tel: "pro",
  telugu: "pro",
  mr: "primary",
  mar: "primary",
  marathi: "primary",
  gu: "success",
  guj: "success",
  gujarati: "success",
};

// Solid status pills, mimicking TestCard's badgeConfig
function getStatusPills({ isLive, isComingSoon, isNew, isFree }) {
  const pills = [];
  if (isLive)
    pills.push({
      key: "live",
      label: "LIVE TEST",
      cls: "bg-red-500 text-white",
      Icon: Radio,
    });
  if (isFree)
    pills.push({ key: "free", label: "FREE", cls: "bg-green-500 text-white" });
  if (isNew && !isComingSoon)
    pills.push({ key: "new", label: "NEW", cls: "bg-purple-500 text-white" });
  if (isComingSoon)
    pills.push({
      key: "soon",
      label: "COMING SOON",
      cls: "bg-amber-100 text-amber-700",
    });
  if (!isFree && !isLive)
    pills.push({
      key: "pro",
      label: "PRO",
      cls: "bg-gradient-to-r from-amber-400 to-orange-400 text-white",
      Icon: Crown,
    });
  return pills;
}

function PypPaperCard({ test, user, examSlug }) {
  const entitlement = getTestEntitlement({ test, user });
  const isTestPro = entitlement.accessType === "PRO";
  const isUserPro = entitlement.isUserPro;
  const isFree = entitlement.accessType === "FREE";
  const isLocked = entitlement.requiresPro;
  const isLive = test.isLive;
  const isComingSoon = test.isComingSoon;
  const isNew =
    test.isNew || (test.pyqYear && new Date().getFullYear() === test.pyqYear);

  const langList = parseLanguageList(test.languages, []);
  const stageLabel = test.stageName || "";
  const yearLabel = test.pyqYear || test.subCategory || test.examDate || "";
  const titleDisplay = test.shortTitle || test.title;

  const testId = test._id || test.id || test.publicId;
  const attemptHref = test.seriesId
    ? `/test/${test.seriesId}/${testId}/instructions`
    : `/pyp/${testId}/test`;

  const statusPills = getStatusPills({ isLive, isComingSoon, isNew, isFree });
  const subTitle = [stageLabel, yearLabel].filter(Boolean).join(" · ");

  return (
    <Card
      variant="default"
      padding="p-0"
      hover
      className="overflow-hidden group"
    >
      <div className="px-3.5 py-2.5">
        {/* Badges + subtitle row (mirrors TestCard) */}
        {(statusPills.length > 0 || subTitle) && (
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {statusPills.map((p) => {
              const Icon = p.Icon;
              return (
                <span
                  key={p.key}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide whitespace-nowrap ${p.cls}`}
                >
                  {Icon && <Icon className="w-3 h-3" />}
                  {p.label}
                </span>
              );
            })}
            {subTitle && (
              <span className="text-xs text-gray-500 font-medium truncate flex-1 min-w-[80px]">
                {subTitle}
              </span>
            )}
          </div>
        )}

        {/* Title + CTA row */}
        <div className="flex justify-between items-start gap-2.5">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <span className="text-xl leading-none mt-0.5">
              {getCategoryEmoji(examSlug?.split("-")[0] || examSlug)}
            </span>
            <h3 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 flex-1">
              {titleDisplay}
            </h3>
          </div>

          <div className="flex-shrink-0 flex flex-col items-stretch gap-1">
            {isComingSoon ? (
              <span className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap bg-gray-200 text-gray-500">
                Coming Soon
              </span>
            ) : isLocked ? (
              <Link
                to="/pass"
                className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap text-center transition-all text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-xs"
              >
                🔒 Get Pro Pass
              </Link>
            ) : (
              <Link
                to={attemptHref}
                className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap text-center transition-colors text-white bg-gradient-to-r from-brand-start to-brand-end"
              >
                Attempt
              </Link>
            )}
            {test.pdfAssetId && (
              <a
                href={`/api/assets/${test.pdfAssetId}/download`}
                className="px-3 py-1 rounded text-[11px] font-semibold whitespace-nowrap text-center bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center gap-1"
              >
                <Download className="w-3 h-3" />
                PDF
              </a>
            )}
          </div>
        </div>

        {/* Meta info row (mirrors TestCard) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="text-sm">❓</span>
            {test.totalQuestions || 0} Qs
          </span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-1">
            <span className="text-sm">📄</span>
            {test.totalMarks || 0} Marks
          </span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-1">
            <span className="text-sm">🕒</span>
            {test.duration || 60} Mins
          </span>
        </div>
      </div>

      {/* Footer (mirrors TestCard) */}
      <div className="bg-gray-50/80 border-t border-gray-100 px-3.5 py-2">
        <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-gray-500">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm">🌐</span>
            {langList.length > 0 ? (
              langList.map((l) => (
                <Badge
                  key={l}
                  variant={LANG_VARIANT[l.toLowerCase()] || "default"}
                  size="xs"
                >
                  {l}
                </Badge>
              ))
            ) : (
              <span>—</span>
            )}
          </div>
          {test.attemptCount > 0 && (
            <span className="flex items-center gap-1 text-gray-600">
              <span className="text-sm">👥</span>
              {test.attemptCountFormatted || test.attemptCount} attempted
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

export default PypPaperCard;
