import { useMemo } from 'react'
import { Filter, Search, List } from 'lucide-react'

const DIFFICULTY_LEVELS = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' }
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' }
]

export default function QuestionFilters({
  sections,
  selectedSection,
  onSelectSection,
  searchQuery,
  onSearchChange,
  difficultyFilter,
  onDifficultyChange,
  statusFilter,
  onStatusChange,
  totalCount,
  filteredCount
}) {
  const sectionCounts = useMemo(() => {
    const counts = {}
    filteredCount.forEach(q => {
      const sec = q.section || 'General'
      counts[sec] = (counts[sec] || 0) + 1
    })
    return counts
  }, [filteredCount])

  return (
    <div className="space-y-4">
      {/* Search and Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search questions..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>

        {/* Filter row */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-500">Filters:</span>
          </div>
          <select
            value={difficultyFilter}
            onChange={(e) => onDifficultyChange(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white hover:border-indigo-300 transition cursor-pointer"
          >
            <option value="all">All Difficulties</option>
            {DIFFICULTY_LEVELS.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white hover:border-indigo-300 transition cursor-pointer"
          >
            <option value="all">All Statuses</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Section tabs */}
      {sections.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => onSelectSection('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
              selectedSection === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <List className="w-3 h-3" /> All ({totalCount})
          </button>
          {sections.map(section => (
            <button
              key={section}
              onClick={() => onSelectSection(section)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                selectedSection === section
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {section} ({sectionCounts[section] || 0})
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
