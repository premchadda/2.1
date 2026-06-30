function TierSelector({ tiers, selected, onSelect }) {
  if (!tiers || tiers.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">Tier</span>
      <button
        onClick={() => onSelect('all')}
        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
          selected === 'all'
            ? 'bg-brand-start text-white'
            : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
        }`}
      >
        All Tiers
      </button>
      {tiers.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(String(t.id))}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            selected === String(t.id)
              ? 'bg-brand-start text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
          }`}
        >
          {t.name}
        </button>
      ))}
    </div>
  )
}

export default TierSelector