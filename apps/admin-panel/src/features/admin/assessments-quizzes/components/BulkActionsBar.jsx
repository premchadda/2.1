import { CheckSquare, Square, Eye, EyeOff, Trash2, MoveRight } from 'lucide-react'

export default function BulkActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onActivate,
  onSetDraft,
  onDelete,
  onMove,
  tests,
  targetTest,
  onTargetChange,
  processing
}) {
  if (selectedCount === 0) {
    return (
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={false}
          onChange={onSelectAll}
          className="w-4 h-4 accent-indigo-600 cursor-pointer"
        />
        <span className="text-sm text-gray-600">
          <strong className="text-gray-900">{totalCount}</strong> questions
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selectedCount === totalCount && totalCount > 0}
          onChange={onSelectAll}
          className="w-4 h-4 accent-indigo-600 cursor-pointer"
        />
        <span className="text-sm text-indigo-700 font-semibold">
          {selectedCount} selected
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onActivate}
          disabled={processing}
          className="flex items-center gap-1 px-2 py-1.5 bg-green-50 text-green-700 rounded text-xs font-semibold hover:bg-green-100 disabled:opacity-50"
        >
          <Eye className="w-3 h-3" /> Activate
        </button>
        <button
          onClick={onSetDraft}
          disabled={processing}
          className="flex items-center gap-1 px-2 py-1.5 bg-yellow-50 text-yellow-700 rounded text-xs font-semibold hover:bg-yellow-100 disabled:opacity-50"
        >
          <EyeOff className="w-3 h-3" /> Draft
        </button>
        <button
          onClick={onDelete}
          disabled={processing}
          className="flex items-center gap-1 px-2 py-1.5 bg-red-50 text-red-700 rounded text-xs font-semibold hover:bg-red-100 disabled:opacity-50"
        >
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>

      <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-200">
        <select
          value={targetTest}
          onChange={(e) => onTargetChange(e.target.value)}
          className="px-2 py-1.5 border border-gray-300 rounded text-xs"
        >
          <option value="">Move to test...</option>
          {tests.map(t => (
            <option key={t._id || t.id} value={t._id || t.id}>
              {t.title || t.name}
            </option>
          ))}
        </select>
        {targetTest && (
          <button
            onClick={onMove}
            disabled={processing}
            className="flex items-center gap-1 px-2 py-1.5 bg-indigo-50 text-indigo-700 rounded text-xs font-semibold hover:bg-indigo-100 disabled:opacity-50"
          >
            <MoveRight className="w-3 h-3" /> Move
          </button>
        )}
      </div>
    </div>
  )
}
