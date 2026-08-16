import { useMemo } from 'react'

const _LABELS = { 1: 'Category', 2: 'Subcategory' }

const pillBase =
  'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all'

function pillClass(active) {
  return `${pillBase} ${
    active
      ? 'bg-brand-start text-white border-brand-start font-semibold shadow-sm ring-2 ring-brand-start/30'
      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-brand-start hover:text-brand-start'
  }`
}

function PypCategoryCascade({
  tiers = [],
  categories = [],
  selectedTier,
  onSelectTier,
  selectedTestCat,
  onSelectTestCat,
}) {
  const { rootId, childrenOf, byId } = useMemo(() => {
    const byIdMap = {}
    const kids = {}
    categories.forEach((c) => {
      const id = String(c.id)
      byIdMap[id] = c
      const pid = c.parentId !== null ? String(c.parentId) : '__none__'
      if (!kids[pid]) kids[pid] = []
      kids[pid].push(c)
    })
    const root =
      categories.find((c) => c.slug === 'pyps') ||
      categories.find((c) => (c.depth || 0) === 0)
    const rootId = root ? String(root.id) : '__none__'

    const sortNodes = (arr) =>
      arr
        .slice()
        .sort(
          (a, b) =>
            (a.displayOrder || 0) - (b.displayOrder || 0) ||
            String(a.name).localeCompare(String(b.name))
        )

    const childrenOf = (pid) => sortNodes(kids[String(pid)] || [])

    return { rootId, childrenOf, byId: byIdMap }
  }, [categories])

  const selectedCatNode =
    selectedTestCat !== 'all' ? byId[String(selectedTestCat)] : null

  // depth-1 ancestor of the selected node (for Category highlight)
  const selectedCatDepth1 = useMemo(() => {
    let cur = selectedCatNode
    while (cur && (cur.depth || 0) > 1) {
      cur = cur.parentId !== null ? byId[String(cur.parentId)] : null
    }
    return cur || null
  }, [selectedCatNode, byId])

  // Build a breadcrumb of the current selection
  const selectedTierName = tiers.find(
    (t) => String(t.id) === String(selectedTier)
  )?.name
  const selectionPath = []
  if (selectedTierName) selectionPath.push(selectedTierName)
  if (selectedCatDepth1) selectionPath.push(selectedCatDepth1.name)
  if (selectedCatNode && (selectedCatNode.depth || 0) >= 2)
    selectionPath.push(selectedCatNode.name)

  const levels = []

  // Stage (tiers) — mandatory selection, NO "All"
  if (tiers.length > 0) {
    levels.push({
      key: 'stage',
      label: 'Stage',
      options: tiers.map((t) => ({ id: String(t.id), name: t.name })),
      selectedId: selectedTier,
      onPick: (id) => onSelectTier(selectedTier === id ? 'all' : id),
      showAll: false,
    })
  }

  // Category (depth-1) — only after a Stage is chosen
  if (selectedTier && selectedTier !== 'all') {
    const catOptions = childrenOf(rootId)
    if (catOptions.length) {
      levels.push({
        key: 'cat-1',
        label: 'Category',
        options: catOptions,
        selectedId: selectedCatDepth1 ? String(selectedCatDepth1.id) : null,
        onPick: (id) => {
          if (String(selectedCatDepth1?.id) === id) onSelectTestCat('all')
          else onSelectTestCat(id)
        },
        showAll: false,
      })
    }
  }

  // Subcategory (depth-2) — only after a depth-1 Category is chosen
  if (selectedCatDepth1 && (selectedCatDepth1.depth || 0) === 1) {
    const subOptions = childrenOf(selectedCatDepth1.id)
    if (subOptions.length) {
      levels.push({
        key: 'cat-2',
        label: 'Subcategory',
        options: subOptions,
        selectedId:
          selectedCatNode && (selectedCatNode.depth || 0) >= 2
            ? String(selectedCatNode.id)
            : null,
        onPick: (id) => {
          if (String(selectedCatNode?.id) === id) {
            onSelectTestCat(String(selectedCatDepth1.id))
          } else {
            onSelectTestCat(id)
          }
        },
        showAll: false,
      })
    }
  }

  if (levels.length === 0) return null

  return (
    <div className="space-y-2.5">
      {selectionPath.length > 0 && (
        <div className="flex items-center flex-wrap gap-1 text-[11px] text-gray-500">
          <span className="text-gray-400">Selected:</span>
          {selectionPath.map((p, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-300">›</span>}
              <span className="font-semibold text-brand-start">{p}</span>
            </span>
          ))}
        </div>
      )}
      {levels.map((level) => (
        <div key={level.key}>
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">
            {level.label}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {level.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => level.onPick(opt.id)}
                className={pillClass(level.selectedId === opt.id)}
              >
                {level.selectedId === opt.id ? '✓ ' : ''}
                {opt.name}
                {opt.testCount ? (
                  <span className="ml-1 opacity-60">{opt.testCount}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default PypCategoryCascade
