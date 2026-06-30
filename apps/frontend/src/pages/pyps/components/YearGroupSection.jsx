import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import PypPaperCard from './PypPaperCard'

function YearGroupSection({ group, user, examSlug, initiallyExpanded = true, pageSize = 5 }) {
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const [visibleCount, setVisibleCount] = useState(Math.min(pageSize, group.papers.length))

  const papers = group.papers.slice(0, visibleCount)
  const hasMore = group.papers.length > visibleCount

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900">
            {group.year}{' '}
            <span className="text-gray-400 font-normal">— {group.count} {group.count === 1 ? 'Paper' : 'Papers'}</span>
          </span>
          {group.papers.some((p) => p.isNew || (p.pyqYear && new Date().getFullYear() === p.pyqYear)) && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white">
              {group.papers.filter((p) => p.isNew || (p.pyqYear && new Date().getFullYear() === p.pyqYear)).length} NEW
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2.5">
          {papers.map((test) => (
            <PypPaperCard
              key={`${test.seriesId}-${test._id || test.id}`}
              test={test}
              user={user}
              examSlug={examSlug}
            />
          ))}
          {hasMore && (
            <button
              onClick={() => setVisibleCount((c) => c + pageSize)}
              className="w-full text-center text-xs font-medium text-indigo-600 hover:text-indigo-700 py-2 border-t border-gray-100"
            >
              + {group.papers.length - visibleCount} more {group.year} papers · Load More →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default YearGroupSection