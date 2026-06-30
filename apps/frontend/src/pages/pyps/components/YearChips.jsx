function YearChips({ years, selected, onSelect }) {
  if (!years || years.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Year</span>
      <button
        onClick={() => onSelect('all')}
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
          selected === 'all'
            ? 'bg-brand-start text-white'
            : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
        }`}
      >
        All
      </button>
      {years.map((y) => (
        <button
          key={y}
          onClick={() => onSelect(String(y))}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            selected === String(y)
              ? 'bg-brand-start text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
          }`}
        >
          {y}
        </button>
      ))}
    </div>
  )
}

export default YearChips