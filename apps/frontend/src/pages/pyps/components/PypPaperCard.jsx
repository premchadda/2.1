import { Link } from 'react-router-dom'
import { Users, Clock, FileText, Download, Crown, Radio, Lock } from 'lucide-react'

function formatLanguages(langs) {
  if (!langs) return null
  if (Array.isArray(langs)) return langs.slice(0, 2).join('/')
  if (typeof langs === 'string') {
    try {
      const parsed = JSON.parse(langs)
      if (Array.isArray(parsed)) return parsed.slice(0, 2).join('/')
    } catch {
      return langs
    }
  }
  return null
}

function PypPaperCard({ test, user, examSlug }) {
  const isFree = !test.isPro
  const isLive = test.isLive
  const isComingSoon = test.isComingSoon
  const isNew = test.isNew || (test.pyqYear && new Date().getFullYear() === test.pyqYear)

  const badges = []
  if (isLive) badges.push({ label: 'LIVE', cls: 'bg-rose-500 text-white', icon: Radio })
  if (isComingSoon) badges.push({ label: 'COMING SOON', cls: 'bg-amber-100 text-amber-700', icon: Clock })
  if (isNew && !isComingSoon) badges.push({ label: 'NEW', cls: 'bg-purple-500 text-white' })
  if (isFree) badges.push({ label: 'FREE', cls: 'bg-emerald-500 text-white' })
  else badges.push({ label: 'PRO', cls: 'bg-gradient-to-r from-amber-400 to-orange-400 text-white', icon: Crown })

  const langs = formatLanguages(test.languages)
  const shiftLabel = test.shift ? `Shift ${test.shift}` : ''
  const dateLabel = test.examDate || (test.shortTitle || '')
  const titleDisplay = test.shortTitle || test.title

  const testId = test._id || test.id || test.publicId
  const attemptHref = test.seriesId
    ? `/test/${test.seriesId}/${testId}/instructions`
    : `/pyp/${testId}/test`

  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">
            {titleDisplay}
          </h3>
          {(dateLabel || shiftLabel) && (
            <p className="text-xs text-gray-500 mt-0.5">
              {dateLabel}{shiftLabel ? ` · ${shiftLabel}` : ''}
              {test.stageName ? ` · ${test.stageName}` : ''}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              {test.totalQuestions || 0} Q
            </span>
            {test.totalMarks > 0 && (
              <span className="flex items-center gap-1">
                <span className="font-semibold">{test.totalMarks}</span> Marks
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {test.duration || 60} min
            </span>
            {test.negativeMarking && parseFloat(test.negativeMarking) > 0 ? (
              <span className="text-rose-500">Neg: -{test.negativeMarking}</span>
            ) : null}
            {langs && <span className="text-gray-400">{langs}</span>}
          </div>
          {test.attemptCount > 0 && (
            <p className="text-xs text-cyan-600 mt-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {test.attemptCountFormatted || `${test.attemptCount} users`}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div className="flex flex-wrap gap-1 justify-end">
            {badges.map((b, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${b.cls}`}
              >
                {b.icon && <b.icon className="w-2.5 h-2.5" />}
                {b.label}
              </span>
            ))}
          </div>
          <div className="flex gap-1.5 mt-1">
            {isComingSoon ? (
              <span className="px-3 py-1 rounded-lg text-[11px] font-medium bg-gray-100 text-gray-500">
                Coming Soon
              </span>
            ) : (
              <>
                <Link
                  to={attemptHref}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                    isFree
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      : 'bg-indigo-500 hover:bg-indigo-600 text-white'
                  }`}
                >
                  {isFree ? 'Attempt' : 'Unlock'}
                </Link>
                {test.pdfAssetId && (
                  <a
                    href={`/api/assets/${test.pdfAssetId}/download`}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    PDF
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default PypPaperCard