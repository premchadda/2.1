import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

export default function YearSelector({ years, selectedYear, onSelect }) {
  const sortedYears = [...years].sort((a, b) => b - a)
  
  const handlePrev = () => {
    const currentIndex = sortedYears.indexOf(selectedYear)
    if (currentIndex < sortedYears.length - 1) {
      onSelect(sortedYears[currentIndex + 1])
    }
  }
  
  const handleNext = () => {
    const currentIndex = sortedYears.indexOf(selectedYear)
    if (currentIndex > 0) {
      onSelect(sortedYears[currentIndex - 1])
    }
  }
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrev}
          disabled={sortedYears.indexOf(selectedYear) >= sortedYears.length - 1}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <select
            value={selectedYear}
            onChange={(e) => onSelect(Number(e.target.value))}
            className="text-2xl font-bold text-gray-900 bg-transparent border-none focus:ring-0 cursor-pointer"
          >
            {sortedYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        
        <button
          onClick={handleNext}
          disabled={sortedYears.indexOf(selectedYear) <= 0}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>
      
      {/* Year Timeline */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {sortedYears.slice(0, 5).map(year => (
          <button
            key={year}
            onClick={() => onSelect(year)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-all ${
              year === selectedYear
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {year}
          </button>
        ))}
        {sortedYears.length > 5 && (
          <span className="text-gray-400 text-sm">+{sortedYears.length - 5} more</span>
        )}
      </div>
    </div>
  )
}
