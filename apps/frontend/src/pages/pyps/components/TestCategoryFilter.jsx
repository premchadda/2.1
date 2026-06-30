import { useState } from 'react'
import { ChevronDown, Folder, FolderOpen } from 'lucide-react'

function TestCategoryFilter({ categories, selected, onSelect }) {
  const [expanded, setExpanded] = useState({})

  if (!categories || categories.length === 0) return null

  // Build tree from flat list
  const byParent = {}
  categories.forEach((c) => {
    const pid = c.parentId ?? 'root'
    if (!byParent[pid]) byParent[pid] = []
    byParent[pid].push(c)
  })

  const renderNode = (cat) => {
    const children = byParent[cat.id] || []
    const hasChildren = children.length > 0
    const isExpanded = expanded[cat.id] !== false // default expanded
    const isSelected = selected === String(cat.id)

    return (
      <div key={cat.id} className="ml-1">
        <div className="flex items-center gap-1.5 py-1">
          {hasChildren ? (
            <button
              onClick={() => setExpanded((e) => ({ ...e, [cat.id]: !isExpanded }))}
              className="p-0.5 hover:bg-gray-100 rounded"
            >
              <ChevronDown
                className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
              />
            </button>
          ) : (
            <span className="w-4" />
          )}
          <button
            onClick={() => onSelect(isSelected ? 'all' : String(cat.id))}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all flex-1 text-left ${
              isSelected
                ? 'bg-brand-start text-white'
                : cat.testCount > 0
                ? 'text-gray-700 hover:bg-indigo-50'
                : 'text-gray-400 hover:bg-gray-50'
            }`}
          >
            {cat.depth === 0 ? <Folder className="w-3 h-3 flex-shrink-0" /> : null}
            <span className="truncate">{cat.name}</span>
            <span className={`ml-auto text-[10px] flex-shrink-0 ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
              {cat.testCount}
            </span>
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div className="ml-3 border-l border-gray-100 pl-1">
            {children.map(renderNode)}
          </div>
        )}
      </div>
    )
  }

  // Render "All" option + tree
  const roots = byParent['root'] || []

  return (
    <div className="space-y-1">
      <button
        onClick={() => onSelect('all')}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all w-full text-left ${
          selected === 'all'
            ? 'bg-brand-start text-white'
            : 'text-gray-700 hover:bg-indigo-50'
        }`}
      >
        <FolderOpen className="w-3.5 h-3.5" />
        All PYPs
      </button>
      <div className="border-l border-gray-100 pl-1 ml-1">
        {roots.map(renderNode)}
      </div>
    </div>
  )
}

export default TestCategoryFilter