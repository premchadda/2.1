import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit,
  FileText,
  Filter,
  FolderOpen,
  Layers,
  Plus,
  Save,
  Search,
  Shield,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { adminAPI } from '../../../shared/lib/dataService'
import api from '../../../shared/lib/api'
import { useExamCategories } from '../../../shared/hooks/useExamCategories'

const TEST_CATEGORY_TABS = [
  { id: 'mock-tests', label: 'Mock Tests', icon: CheckSquare },
  { id: 'pyp', label: 'Previous Year Papers', icon: FileText },
  { id: 'practice', label: 'Practice & Quiz', icon: Layers },
  { id: 'live-tests', label: 'Live Tests', icon: Clock },
]

const TEST_CATEGORY_NAMES = {
  'mock-tests': 'Mock Tests',
  pyp: 'PYPs',
  practice: 'Practice',
  'live-tests': 'Live Tests',
}

const TEST_CATEGORY_ALIASES = {
  'mock-tests': ['mock-tests', 'mock', 'mock test', 'mock tests', 'Mock Tests'],
  pyp: ['pyp', 'pyps', 'previous-year', 'previous year', 'previous year papers', 'Previous Year Papers', 'PYPs'],
  practice: ['practice', 'quiz', 'practice-quiz', 'practice & quiz', 'Practice'],
  'live-tests': ['live-tests', 'live', 'live test', 'live tests', 'Live Tests'],
}

const DEFAULT_TEST_FORM = {
  title: '',
  slug: '',
  testCategoryId: '',
  subCategoryLevel1: '',
  subCategoryLevel2: '',
  subCategoryLevel3: '',
  subCategoryLevel4: '',
  type: 'mock-tests',
  duration: 60,
  negativeMarking: 0.25,
  difficulty: 'Medium',
  isPro: false,
  isComingSoon: false,
  isLive: false,
  tags: '',
  stageIds: '',
  sectionIds: '',
  scheduledAt: '',
  maxParticipants: '',
}

const normalizeKey = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const idsEqual = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b)
const getEntityId = (item) => item?._id ?? item?.id ?? null
const getSeriesId = (series) => series?._id ?? series?.id ?? series?.public_id ?? null
const getTestId = (test) => test?._id ?? test?.id ?? test?.public_id ?? null
const getTestSeriesId = (test = {}) => test.testSeriesId ?? test.test_series_id ?? test.seriesId ?? test.series_id ?? null
const getStageIdFromTest = (test = {}) => test.stageId ?? test.stage_id ?? test.tierId ?? test.tier_id ?? null
const getSeriesExamId = (series = {}) =>
  series.examId ?? series.exam_id ?? series.subcategory ?? series.subCategory ?? series.sub_category ?? series.subcategory_id ?? null
const getSeriesExamCategoryId = (series = {}) =>
  series.category ?? series.category_id ?? series.examCategoryId ?? series.exam_category_id ?? null
const getTestQuestionsCount = (test = {}) =>
  Number(test.questionsCount ?? test.questions_count ?? test.totalQuestions ?? test.total_questions ?? test.question_count ?? 0)

const parseIdList = (value) =>
  String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)

const normalizeTest = (test) => ({
  ...test,
  title: test.title || test.name || '',
  slug: test.slug || '',
  testSeriesId: test.testSeriesId ?? test.test_series_id ?? test.seriesId ?? test.series_id ?? null,
  stageId: test.stageId ?? test.stage_id ?? test.tierId ?? test.tier_id ?? null,
  testCategoryId: test.testCategoryId ?? test.test_category_id ?? null,
  examId: test.examId ?? test.exam_id ?? null,
  category: test.category || '',
  type: test.type || 'mock-tests',
  duration: test.duration ?? test.time_limit ?? 60,
  totalQuestions: test.totalQuestions ?? test.total_questions ?? 0,
  totalMarks: test.totalMarks ?? test.total_marks ?? 0,
  negativeMarking: test.negativeMarking ?? test.negative_marking ?? 0.25,
  difficulty: test.difficulty || 'Medium',
  isPro: Boolean(test.isPro ?? test.is_pro),
  isComingSoon: Boolean(test.isComingSoon ?? test.is_coming_soon),
  isLive: Boolean(test.isLive ?? test.is_live),
  tags: Array.isArray(test.tags) ? test.tags : (test.tags ? test.tags.split(',').map(t => t.trim()).filter(Boolean) : []),
  stageIds: Array.isArray(test.stage_ids ?? test.stageIds) ? (test.stage_ids ?? test.stageIds) : [],
  questionsCount: getTestQuestionsCount(test),
})

const coerceArray = (value) => {
  if (Array.isArray(value)) return value
  if (value !== null && value !== undefined && typeof value !== 'string') return [value]
  if (typeof value !== 'string' || !value.trim()) return []
  const trimmed = value.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed.slice(1, -1).split(',').map(part => part.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
  }
  try {
    const parsed = JSON.parse(trimmed)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return trimmed.split(',').map(part => part.trim()).filter(Boolean)
  }
}

const flattenCategories = (categories = []) => {
  const flattened = []
  const walk = (items, parentId = '') => {
    items.forEach(item => {
      const id = getEntityId(item)
      flattened.push({ ...item, parentId: item.parentId ?? item.parent_id ?? parentId })
      if (Array.isArray(item.children) && item.children.length > 0) walk(item.children, id)
    })
  }
  walk(Array.isArray(categories) ? categories : [])
  return flattened
}

const refsFrom = (values) => {
  const refs = new Set()
  values.filter(Boolean).forEach(value => {
    refs.add(String(value))
    refs.add(normalizeKey(value))
  })
  return refs
}

const valueMatchesRefs = (values, refs) =>
  Boolean(refs?.size) && values.filter(value => value !== null && value !== undefined && value !== '').some(value => refs.has(String(value)) || refs.has(normalizeKey(value)))

const getTestCategoryValues = (item = {}) => [
  item.testCategoryId,
  item.test_category_id,
  item.categoryId,
  item.category_id,
  item.category,
  item.categoryName,
  item.category_name,
  item.testCategory,
  item.test_category,
  // FIX: Also match by the test's `type` field (e.g. 'pyp', 'mock-tests').
  // Tests created via form often have `type` set but no explicit testCategoryId,
  // so without this they are invisible in the series panel.
  item.type,
].filter(value => value !== null && value !== undefined && value !== '')

const getSeriesCategoryValues = (series = {}) => [
  series.testCategoryId,
  series.test_category_id,
  ...coerceArray(series.testCategoryIds || series.test_category_ids),
  ...coerceArray(series.testCategories || series.test_categories),
  series.testCategory,
  series.test_category,
].filter(value => value !== null && value !== undefined && value !== '')

const buildExamCategoryRefs = (categoryId, categories = []) => {
  if (!categoryId) return new Set()
  const match = categories.find(cat => [cat.id, cat.categoryId, cat.slug, cat.label, cat.name].some(value => idsEqual(value, categoryId)))
  return refsFrom([categoryId, match?.id, match?.categoryId, match?.slug, match?.label, match?.name])
}

const buildExamRefs = (examId, exams = [], examInfo = []) => {
  if (!examId) return new Set()
  const allExams = [...(exams || []), ...(examInfo || [])]
  const match = allExams.find(exam =>
    [exam.id, exam._id, exam.examId, exam.exam_id, exam.slug, exam.name, exam.title, exam.value].some(value => idsEqual(value, examId))
  )
  return refsFrom([examId, match?.id, match?._id, match?.examId, match?.exam_id, match?.slug, match?.name, match?.title, match?.value])
}

const buildStageRefs = (stageId) => (stageId ? refsFrom([stageId]) : new Set())

const stageMatchesExam = (stage, examRefs) => valueMatchesRefs(coerceArray(stage?.examIds || stage?.exam_ids || stage?.exam_id || stage?.examId), examRefs)

const buildChildrenByParent = (flatCategories) => {
  const map = new Map()
  flatCategories.forEach(cat => {
    const key = String(cat.parentId || cat.parent_id || '')
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(cat)
  })
  return map
}

const buildTestCategoryRefs = (activeCategory, flatCategories = []) => {
  const refs = refsFrom([...(TEST_CATEGORY_ALIASES[activeCategory] || [activeCategory]), TEST_CATEGORY_NAMES[activeCategory]])
  const seeds = flatCategories.filter(cat =>
    [cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId].filter(Boolean).some(value => refs.has(String(value)) || refs.has(normalizeKey(value)))
  )
  const childrenByParent = buildChildrenByParent(flatCategories)
  const queue = [...seeds]
  const seen = new Set()
  while (queue.length) {
    const cat = queue.shift()
    const id = String(getEntityId(cat) || cat.categoryId || cat.slug || cat.name || '')
    if (!id || seen.has(id)) continue
    seen.add(id)
      ;[cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId].filter(Boolean).forEach(value => {
        refs.add(String(value))
        refs.add(normalizeKey(value))
      })
      ; (childrenByParent.get(String(getEntityId(cat) || '')) || []).forEach(child => queue.push(child))
  }
  return refs
}

const buildRootTestCategoryRecord = (activeCategory, flatCategories = []) => {
  const refs = refsFrom([...(TEST_CATEGORY_ALIASES[activeCategory] || [activeCategory]), TEST_CATEGORY_NAMES[activeCategory]])
  return flatCategories.find(cat =>
    [cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId].filter(Boolean).some(value => refs.has(String(value)) || refs.has(normalizeKey(value)))
  ) || null
}

const buildCategorySelectionRefs = (categoryId, flatCategories = []) => {
  if (!categoryId) return new Set()
  const refs = refsFrom([categoryId])
  const seed = flatCategories.find(cat => [cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId].filter(Boolean).some(value => idsEqual(value, categoryId)))
  if (!seed) return refs
    ;[seed.id, seed._id, seed.slug, seed.name, seed.label, seed.categoryId].filter(Boolean).forEach(value => {
      refs.add(String(value))
      refs.add(normalizeKey(value))
    })
  const childrenByParent = buildChildrenByParent(flatCategories)
  const queue = [...(childrenByParent.get(String(getEntityId(seed) || '')) || [])]
  const seen = new Set([String(getEntityId(seed) || seed.categoryId || seed.slug || seed.name || categoryId)])
  while (queue.length) {
    const cat = queue.shift()
    const id = String(getEntityId(cat) || cat.categoryId || cat.slug || cat.name || '')
    if (!id || seen.has(id)) continue
    seen.add(id)
      ;[cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId].filter(Boolean).forEach(value => {
        refs.add(String(value))
        refs.add(normalizeKey(value))
      })
      ; (childrenByParent.get(String(getEntityId(cat) || '')) || []).forEach(child => queue.push(child))
  }
  return refs
}

const recordMatchesTestCategory = (record, refs) => valueMatchesRefs(getTestCategoryValues(record), refs)
const seriesMatchesTestCategory = (series, refs, testsInSeries = []) =>
  valueMatchesRefs(getSeriesCategoryValues(series), refs) || testsInSeries.some(test => recordMatchesTestCategory(test, refs))

const categoryRecordMatchesRefs = (category, refs) =>
  valueMatchesRefs([category.id, category._id, category.slug, category.name, category.label, category.categoryId], refs)

const categoryLinksSeries = (category, seriesId) =>
  coerceArray(category.testSeriesId ?? category.test_series_id ?? category.seriesId ?? category.series_id).some(id => idsEqual(id, seriesId))

const getCategoryLabel = (category) => category?.label || category?.name || category?.slug || category?.categoryId || category?.id || 'Not linked'

const getCategoryPath = (categoryId, flatCategories = []) => {
  const path = []
  const visited = new Set()
  let current = flatCategories.find(cat => [cat.id, cat._id, cat.slug, cat.categoryId].some(value => idsEqual(value, categoryId)))
  while (current && path.length < 10) {
    const id = String(getEntityId(current) || '')
    if (visited.has(id)) break
    visited.add(id)
    path.unshift(current)
    const parentId = current.parentId || current.parent_id
    if (!parentId) break
    current = flatCategories.find(cat => idsEqual(cat.id, parentId) || idsEqual(cat._id, parentId))
  }
  return path
}

const getCategoryPathLabel = (categoryId, flatCategories = []) => {
  const path = getCategoryPath(categoryId, flatCategories)
  return path.map(cat => getCategoryLabel(cat)).join(' / ') || 'Not linked'
}

const Badge = ({ children, tone = 'gray' }) => {
  const tones = {
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  }
  return <span className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${tones[tone] || tones.gray}`}>{children}</span>
}

const EmptyState = ({ title, description, icon: Icon = FileText }) => (
  <div className="bg-white rounded-xl border border-dashed border-gray-300 flex flex-col items-center justify-center py-14 text-center px-4">
    <Icon className="w-12 h-12 text-gray-300 mb-3" />
    <h3 className="text-base font-semibold text-gray-900">{title}</h3>
    <p className="text-sm text-gray-500 mt-1">{description}</p>
  </div>
)

const StatCard = ({ icon: Icon, value, label, tone }) => {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
  }
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${tones[tone] || tones.indigo}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}

// ─── Cascading Category Dropdown ────────────────────────────────────────────
// Shows progressive dropdowns: selecting L1 reveals L2, selecting L2 reveals L3, etc.
const CascadingCategorySelect = ({ allSubCategories = [], flatTestCategories = [], value, onChange }) => {
  // Derive which category is selected at each depth level from the current value.
  // allSubCategories items have _depth: 1 = direct child of root, 2 = grandchild, etc.
  const subCatIdSet = useMemo(() => new Set(allSubCategories.map(c => String(getEntityId(c) || ''))), [allSubCategories])

  const levels = useMemo(() => {
    if (!value) return ['', '', '', '']
    const path = getCategoryPath(String(value), flatTestCategories)
    const inSubs = path.filter(p => subCatIdSet.has(String(getEntityId(p) || '')))
    return [
      inSubs[0] ? String(getEntityId(inSubs[0]) || '') : '',
      inSubs[1] ? String(getEntityId(inSubs[1]) || '') : '',
      inSubs[2] ? String(getEntityId(inSubs[2]) || '') : '',
      inSubs[3] ? String(getEntityId(inSubs[3]) || '') : '',
    ]
  }, [value, flatTestCategories, subCatIdSet])

  // Options for each level
  const opts1 = useMemo(() => allSubCategories.filter(c => c._depth === 1), [allSubCategories])
  const opts2 = useMemo(() => levels[0] ? flatTestCategories.filter(c => String(c.parentId ?? c.parent_id ?? '') === levels[0] && c.isActive !== false) : [], [levels[0], flatTestCategories])
  const opts3 = useMemo(() => levels[1] ? flatTestCategories.filter(c => String(c.parentId ?? c.parent_id ?? '') === levels[1] && c.isActive !== false) : [], [levels[1], flatTestCategories])
  const opts4 = useMemo(() => levels[2] ? flatTestCategories.filter(c => String(c.parentId ?? c.parent_id ?? '') === levels[2] && c.isActive !== false) : [], [levels[2], flatTestCategories])

  const handleChange = (levelIdx, newId) => {
    const next = [...levels]
    next[levelIdx] = newId
    for (let i = levelIdx + 1; i < 4; i++) next[i] = ''
    // testCategoryId = deepest non-empty selection
    const deepest = [...next].reverse().find(id => id !== '') || ''
    onChange(deepest)
  }

  const selectCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white'
  const rowCls = (indent) => `flex items-center gap-2${indent ? ` ml-${indent}` : ''}`

  if (opts1.length === 0) {
    return <p className="text-sm text-gray-400 italic py-1">No subcategories available for this test type.</p>
  }

  return (
    <div className="space-y-2">
      {/* Level 1 — always visible */}
      <div className={rowCls(0)}>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider w-6 shrink-0">L1</span>
        <select value={levels[0]} onChange={e => handleChange(0, e.target.value)} className={selectCls}>
          <option value="">— Select type —</option>
          {opts1.map(c => { const id = String(getEntityId(c) || ''); return <option key={id} value={id}>{getCategoryLabel(c)}</option> })}
        </select>
      </div>

      {/* Level 2 — revealed when L1 selected and has children */}
      {levels[0] && opts2.length > 0 && (
        <div className={rowCls(4)}>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider w-6 shrink-0">L2</span>
          <select value={levels[1]} onChange={e => handleChange(1, e.target.value)} className={selectCls}>
            <option value="">— Select —</option>
            {opts2.map(c => { const id = String(getEntityId(c) || ''); return <option key={id} value={id}>{getCategoryLabel(c)}</option> })}
          </select>
        </div>
      )}

      {/* Level 3 — revealed when L2 selected and has children */}
      {levels[1] && opts3.length > 0 && (
        <div className={rowCls(8)}>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider w-6 shrink-0">L3</span>
          <select value={levels[2]} onChange={e => handleChange(2, e.target.value)} className={selectCls}>
            <option value="">— Select —</option>
            {opts3.map(c => { const id = String(getEntityId(c) || ''); return <option key={id} value={id}>{getCategoryLabel(c)}</option> })}
          </select>
        </div>
      )}

      {/* Level 4 — revealed when L3 selected and has children */}
      {levels[2] && opts4.length > 0 && (
        <div className={rowCls(12)}>
          <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider w-6 shrink-0">L4</span>
          <select value={levels[3]} onChange={e => handleChange(3, e.target.value)} className={selectCls}>
            <option value="">— Select —</option>
            {opts4.map(c => { const id = String(getEntityId(c) || ''); return <option key={id} value={id}>{getCategoryLabel(c)}</option> })}
          </select>
        </div>
      )}

      {/* Selected path breadcrumb */}
      {value && (
        <p className="text-[11px] text-indigo-600 font-medium pl-8 truncate">
          ✓ {getCategoryPathLabel(String(value), flatTestCategories)}
        </p>
      )}
    </div>
  )
}


const TestFormModal = ({ isOpen, onClose, onSubmit, formData, setFormData, editingId, contextLabel, saving, relationshipSummary, availableSections, allSubCategories, flatTestCategories }) => {
  if (!isOpen) return null
  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit(formData)
  }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Test' : 'Create Test'}</h2>
            <p className="text-xs text-gray-500 mt-1">{contextLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {editingId && relationshipSummary && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-indigo-900">Linked Relationships</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  ['Test Series', relationshipSummary.series],
                  ['Stage', relationshipSummary.stage],
                  ['Test Category', relationshipSummary.testCategory],
                  ['Test Subcategory', relationshipSummary.testSubcategory],
                  ['Test Sections', relationshipSummary.sections],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-white/80 bg-white px-3 py-2">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</div>
                    <div className="mt-1 text-sm font-semibold text-gray-900">{value || 'Not linked'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL)</label>
              <input value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-') })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="auto-generated if empty" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Subcategory</label>
              <CascadingCategorySelect
                allSubCategories={allSubCategories}
                flatTestCategories={flatTestCategories}
                value={formData.testCategoryId || ''}
                onChange={(selectedId) => {
                  if (!selectedId) {
                    setFormData({ ...formData, testCategoryId: '', subCategoryLevel1: '', subCategoryLevel2: '', subCategoryLevel3: '', subCategoryLevel4: '' })
                    return
                  }
                  // Resolve path, filtering out the root (keep only items in allSubCategories)
                  const subIds = new Set(allSubCategories.map(c => String(getEntityId(c) || '')))
                  const path = getCategoryPath(selectedId, flatTestCategories).filter(p => subIds.has(String(getEntityId(p) || '')))
                  setFormData({
                    ...formData,
                    testCategoryId: selectedId,
                    subCategoryLevel1: path[0] ? String(getEntityId(path[0]) || '') : '',
                    subCategoryLevel2: path[1] ? String(getEntityId(path[1]) || '') : '',
                    subCategoryLevel3: path[2] ? String(getEntityId(path[2]) || '') : '',
                    subCategoryLevel4: path[3] ? String(getEntityId(path[3]) || '') : '',
                  })
                }}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Sections</label>
              <select
                multiple
                value={parseIdList(formData.sectionIds)}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, opt => opt.value)
                  setFormData({ ...formData, sectionIds: selected.join(', ') })
                }}
                disabled={availableSections.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-gray-50 disabled:text-gray-400 h-24"
              >
                {availableSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name} ({section.duration} min)
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2">
                {availableSections.length > 0
                  ? 'Hold Ctrl/Cmd to select multiple sections.'
                  : 'No sections available. Create sections first.'}
              </p>
            </div>
            {[
              ['duration', 'Duration (minutes)', 1, '1'],
              ['negativeMarking', 'Negative Marking', 0, '0.25'],
            ].map(([key, label, min, step]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input type="number" min={min} step={step} value={formData[key]} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none" />
              </div>
            ))}
            {editingId && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Total Questions (Auto)</label>
                  <input readOnly value={formData.totalQuestions || 0} className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg outline-none text-gray-500 cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Total Marks (Auto)</label>
                  <input readOnly value={formData.totalMarks || 0} className="w-full px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg outline-none text-gray-500 cursor-not-allowed" />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select value={formData.difficulty} onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none">
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>
            {formData.isLive && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled At (Live)</label>
                  <input type="datetime-local" value={formData.scheduledAt || ''} onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Participants (Live, 0 for unlimited)</label>
                  <input type="number" min="0" value={formData.maxParticipants || 0} onChange={(e) => setFormData({ ...formData, maxParticipants: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none" />
                </div>
              </>
            )}
            <div className={`md:col-span-2`}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
              <input value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none" placeholder="comma, separated, tags" />
            </div>
          </div>
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Visibility & Access</h4>
            <div className="flex flex-wrap gap-4">
              {[
                ['isPro', 'Pro Pass Required'],
                ['isComingSoon', 'Coming Soon'],
                ['isLive', 'Live Test'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input type="checkbox" checked={Boolean(formData[key])} onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : `${editingId ? 'Update' : 'Create'} Test`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const BulkUploadModal = ({ isOpen, onClose, onUpload, onValidate, contextLabel, linkingInfo }) => {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState(null)

  if (!isOpen) return null

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] || null)
    setValidationResult(null)
  }

  const handleValidate = async () => {
    if (!file) {
      toast.error('Please select a file first')
      return
    }
    setValidating(true)
    try {
      const result = await onValidate(file)
      setValidationResult(result)
    } catch (error) {
      toast.error(error.message || 'Validation failed')
    } finally {
      setValidating(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!file) {
      toast.error('Please select a file')
      return
    }
    setUploading(true)
    try {
      await onUpload(file)
      setFile(null)
      setValidationResult(null)
      onClose()
    } catch (error) {
      toast.error(error.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bulk Create Tests</h2>
            <p className="text-xs text-gray-500 mt-1">{contextLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {linkingInfo && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
              <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200 mb-2">Tests will be linked to:</p>
              <div className="space-y-1 text-xs text-indigo-700 dark:text-indigo-300">
                {linkingInfo.seriesName && <p><span className="font-medium">Series:</span> {linkingInfo.seriesName}</p>}
                {linkingInfo.examName && <p><span className="font-medium">Exam:</span> {linkingInfo.examName}</p>}
                {linkingInfo.stageName && <p><span className="font-medium">Stage:</span> {linkingInfo.stageName}</p>}
                {linkingInfo.categoryName && <p><span className="font-medium">Category:</span> {linkingInfo.categoryName}</p>}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload File</label>
            <input type="file" accept=".csv,.xlsx,.xls,.json" onChange={handleFileChange} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
            <p className="text-xs text-gray-500 mt-2">Supported columns include title, duration, totalQuestions, totalMarks, difficulty, type, and tags.</p>
          </div>

          {validationResult && (
            <div className={`p-4 rounded-lg ${validationResult.isValid ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
              <p className={`font-medium ${validationResult.isValid ? 'text-green-800' : 'text-amber-800'}`}>
                {validationResult.isValid ? '✓ Validation passed' : '⚠ Validation found issues'}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {validationResult.validRows} valid rows out of {validationResult.totalRows}
              </p>
              {!validationResult.isValid && (
                <div className="mt-2 max-h-32 overflow-y-auto">
                  {validationResult.errors.slice(0, 5).map((err, idx) => (
                    <p key={idx} className="text-xs text-amber-700">Row {err.row}: {err.reason} {err.title ? `("${err.title}")` : ''}</p>
                  ))}
                  {validationResult.errors.length > 5 && (
                    <p className="text-xs text-amber-600">...and {validationResult.errors.length - 5} more</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={onClose} disabled={uploading} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancel</button>
            <button type="button" onClick={handleValidate} disabled={uploading || !file || validating} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
              {validating ? 'Validating...' : 'Validate'}
            </button>
            <button type="submit" disabled={uploading || !file} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              <Upload className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TestsManager() {
  const [searchParams] = useSearchParams()
  const deepLinkAppliedRef = useRef(false)
  const {
    categories: examCategories,
    exams: examsFromHook = [],
    examInfo,
    getSubcategories,
    loading: examFiltersLoading,
  } = useExamCategories()

  const [tests, setTests] = useState([])
  const [seriesList, setSeriesList] = useState([])
  const [stages, setStages] = useState([])
  const [testCategories, setTestCategories] = useState([])
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTestCategory, setActiveTestCategory] = useState('mock-tests')
  const [activeExamCategoryId, setActiveExamCategoryId] = useState('')
  const [activeExamId, setActiveExamId] = useState('')
  const [activeStageId, setActiveStageId] = useState('')
  const [selectedSeries, setSelectedSeries] = useState(null)
  const [selectedTestSubCategoryId, setSelectedTestSubCategoryId] = useState('all')
  // Cascading subcategory levels
  const [subCategoryLevel1, setSubCategoryLevel1] = useState('') // Top level (Year Based, Exam Based)
  const [subCategoryLevel2, setSubCategoryLevel2] = useState('') // Second level (2025, 2024)
  const [subCategoryLevel3, setSubCategoryLevel3] = useState('') // Third level (if needed)
  const [subCategoryLevel4, setSubCategoryLevel4] = useState('') // Fourth level (if needed)
  const [showForm, setShowForm] = useState(false)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(DEFAULT_TEST_FORM)
  const [editingRelationshipSummary, setEditingRelationshipSummary] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [errors, setErrors] = useState({})

  const fetchData = async () => {
    try {
      setLoading(true)
      setErrors({})
      const [testsRes, seriesRes, stagesRes, catsRes, sectionsRes] = await Promise.allSettled([
        adminAPI.getTests(),
        adminAPI.getTestSeries(),
        api.get('/stages'),
        adminAPI.getTestCategories(),
        adminAPI.getSections(),
      ])

      const newErrors = {}
      let hasData = false

      if (testsRes.status === 'fulfilled' && testsRes.value.data?.data) {
        setTests(testsRes.value.data.data.map(normalizeTest))
        hasData = true
      } else {
        newErrors.tests = 'Failed to load tests'
      }

      if (seriesRes.status === 'fulfilled' && seriesRes.value.data?.data) {
        setSeriesList(seriesRes.value.data.data)
      } else {
        newErrors.series = 'Failed to load test series'
      }

      if (stagesRes.status === 'fulfilled' && stagesRes.value.data?.data) {
        setStages(stagesRes.value.data.data)
      } else {
        newErrors.stages = 'Failed to load stages'
      }

      if (catsRes.status === 'fulfilled' && catsRes.value.data?.data) {
        setTestCategories(catsRes.value.data.data)
      } else {
        newErrors.categories = 'Failed to load categories'
      }

      if (sectionsRes.status === 'fulfilled' && sectionsRes.value.data?.data) {
        setSections(sectionsRes.value.data.data)
      } else {
        newErrors.sections = 'Failed to load sections'
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors)
        const errorCount = Object.keys(newErrors).length
        toast.error(`Failed to load ${errorCount} data source${errorCount > 1 ? 's' : ''}`)
      }
    } catch (error) {
      console.error('Tests fetch error:', error)
      toast.error('Failed to load tests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const flatTestCategories = useMemo(() => flattenCategories(testCategories), [testCategories])
  const activeTestCategoryRefs = useMemo(() => buildTestCategoryRefs(activeTestCategory, flatTestCategories), [activeTestCategory, flatTestCategories])
  const activeTestCategoryRecord = useMemo(() => buildRootTestCategoryRecord(activeTestCategory, flatTestCategories), [activeTestCategory, flatTestCategories])
  const activeCatLabel = TEST_CATEGORY_TABS.find(tab => tab.id === activeTestCategory)?.label || TEST_CATEGORY_NAMES[activeTestCategory] || activeTestCategory

  const activeTestSubCategories = useMemo(() => {
    if (!activeTestCategoryRecord) return []
    const rootId = String(getEntityId(activeTestCategoryRecord) || '')
    // Build children map for quick lookup
    const childrenByParent = new Map()
    flatTestCategories.forEach(cat => {
      const pid = String(cat.parentId || cat.parent_id || '')
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, [])
      childrenByParent.get(pid).push(cat)
    })
    // DFS to get all descendants with depth
    const result = []
    const visited = new Set()
    const processChildren = (parentId, depth) => {
      const children = (childrenByParent.get(parentId) || [])
        .filter(cat => cat.isActive !== false)
        .sort((a, b) => (a.displayOrder || a.display_order || 0) - (b.displayOrder || b.display_order || 0))
      children.forEach(child => {
        const childId = String(getEntityId(child) || '')
        if (visited.has(childId)) return
        visited.add(childId)
        result.push({ ...child, _depth: depth })
        processChildren(childId, depth + 1)
      })
    }
    processChildren(rootId, 1)
    return result
  }, [activeTestCategoryRecord, flatTestCategories])

  // Cascading subcategory dropdowns - get children for each level
  const subCategoryOptionsLevel1 = useMemo(() => {
    if (!activeTestCategoryRecord) return []
    const rootId = String(getEntityId(activeTestCategoryRecord) || '')
    return flatTestCategories
      .filter(cat => String(cat.parentId || cat.parent_id || '') === rootId && cat.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.display_order || 0) - (b.displayOrder || b.display_order || 0))
  }, [activeTestCategoryRecord, flatTestCategories])

  const subCategoryOptionsLevel2 = useMemo(() => {
    if (!subCategoryLevel1) return []
    return flatTestCategories
      .filter(cat => String(cat.parentId || cat.parent_id || '') === String(subCategoryLevel1) && cat.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.display_order || 0) - (b.displayOrder || b.display_order || 0))
  }, [subCategoryLevel1, flatTestCategories])

  const subCategoryOptionsLevel3 = useMemo(() => {
    if (!subCategoryLevel2) return []
    return flatTestCategories
      .filter(cat => String(cat.parentId || cat.parent_id || '') === String(subCategoryLevel2) && cat.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.display_order || 0) - (b.displayOrder || b.display_order || 0))
  }, [subCategoryLevel2, flatTestCategories])

  const subCategoryOptionsLevel4 = useMemo(() => {
    if (!subCategoryLevel3) return []
    return flatTestCategories
      .filter(cat => String(cat.parentId || cat.parent_id || '') === String(subCategoryLevel3) && cat.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.display_order || 0) - (b.displayOrder || b.display_order || 0))
  }, [subCategoryLevel3, flatTestCategories])

  // Compute the final selectedTestSubCategoryId from cascading levels
  const cascadingSelectedSubCategoryId = useMemo(() => {
    return subCategoryLevel4 || subCategoryLevel3 || subCategoryLevel2 || subCategoryLevel1 || 'all'
  }, [subCategoryLevel1, subCategoryLevel2, subCategoryLevel3, subCategoryLevel4])

  // Sync cascading selection with selectedTestSubCategoryId
  useEffect(() => {
    if (selectedTestSubCategoryId === 'all') {
      setSubCategoryLevel1('')
      setSubCategoryLevel2('')
      setSubCategoryLevel3('')
      setSubCategoryLevel4('')
    } else if (selectedTestSubCategoryId) {
      // Find the category and build its path
      const cat = flatTestCategories.find(c => [c.id, c._id, c.categoryId, c.slug].some(value => idsEqual(value, selectedTestSubCategoryId)))
      if (cat) {
        const path = getCategoryPath(selectedTestSubCategoryId, flatTestCategories)
        if (path.length >= 1) setSubCategoryLevel1(getEntityId(path[0]) || '')
        if (path.length >= 2) setSubCategoryLevel2(getEntityId(path[1]) || '')
        if (path.length >= 3) setSubCategoryLevel3(getEntityId(path[2]) || '')
        if (path.length >= 4) setSubCategoryLevel4(getEntityId(path[3]) || '')
      }
    }
  }, [])

  const editingTest = useMemo(
    () => tests.find(test => idsEqual(getTestId(test), editingId)) || null,
    [tests, editingId]
  )

  const examsForActiveCategory = useMemo(() => {
    if (!activeExamCategoryId) return []
    return getSubcategories(activeExamCategoryId) || []
  }, [activeExamCategoryId, getSubcategories])

  const activeExamCategoryRefs = useMemo(() => buildExamCategoryRefs(activeExamCategoryId, examCategories), [activeExamCategoryId, examCategories])
  const activeExamRefs = useMemo(() => buildExamRefs(activeExamId, examsFromHook, examInfo), [activeExamId, examsFromHook, examInfo])
  const activeStageRefs = useMemo(() => buildStageRefs(activeStageId), [activeStageId])

  const stagesForActiveExam = useMemo(() => {
    if (!activeExamId || activeExamRefs.size === 0) return stages
    const linked = stages.filter(stage => stageMatchesExam(stage, activeExamRefs))
    return linked.length > 0 ? linked : stages
  }, [activeExamId, activeExamRefs, stages])

  useEffect(() => {
    if (!activeExamCategoryId && examCategories.length > 0) {
      const first = examCategories[0]
      setActiveExamCategoryId(first.categoryId || first.slug || first.id)
    }
  }, [activeExamCategoryId, examCategories])

  useEffect(() => {
    if (!activeExamCategoryId || examsForActiveCategory.length === 0) {
      setActiveExamId('')
      return
    }
    const stillValid = examsForActiveCategory.some(exam => idsEqual(exam.value, activeExamId))
    if (!stillValid) setActiveExamId(examsForActiveCategory[0].value)
  }, [activeExamCategoryId, examsForActiveCategory, activeExamId])

  useEffect(() => {
    if (!activeStageId && stagesForActiveExam.length > 0) {
      const firstStageId = getEntityId(stagesForActiveExam[0])
      if (firstStageId) setActiveStageId(firstStageId)
    }
  }, [stagesForActiveExam, activeStageId])

  useEffect(() => {
    setSelectedSeries(null)
    setSelectedTestSubCategoryId('all')
  }, [activeTestCategory, activeExamCategoryId, activeExamId, activeStageId])




  useEffect(() => {
    if (deepLinkAppliedRef.current || seriesList.length === 0) return
    const seriesId = searchParams.get('seriesId')
    const stageId = searchParams.get('stageId')
    if (!seriesId && !stageId) return
    deepLinkAppliedRef.current = true
    if (stageId) setActiveStageId(String(stageId))
    if (seriesId) {
      const series = seriesList.find(item => idsEqual(getSeriesId(item), seriesId))
      if (series) {
        const categoryId = getSeriesExamCategoryId(series)
        const examId = getSeriesExamId(series)
        if (categoryId) setActiveExamCategoryId(String(categoryId))
        if (examId) setActiveExamId(String(examId))
        setSelectedSeries(series)
      }
    }
  }, [seriesList, searchParams])

  const testsBySeriesId = useMemo(() => {
    const map = new Map()
    tests.forEach(test => {
      const seriesId = String(getTestSeriesId(test) || '')
      if (!seriesId) return
      if (!map.has(seriesId)) map.set(seriesId, [])
      map.get(seriesId).push(test)
    })
    return map
  }, [tests])

  const filteredSeriesList = useMemo(() => {
    if (!activeExamCategoryId || !activeExamId) return []
    return seriesList.filter(series => {
      const seriesId = String(getSeriesId(series) || '')
      const testsInSeries = testsBySeriesId.get(seriesId) || []
      if (activeExamCategoryRefs.size > 0 && !valueMatchesRefs([getSeriesExamCategoryId(series)], activeExamCategoryRefs)) return false
      if (activeExamRefs.size > 0 && !valueMatchesRefs([getSeriesExamId(series)], activeExamRefs)) return false
      if (activeStageRefs.size > 0) {
        const seriesStages = coerceArray(series.stages || series.stageIds || series.stage_ids)
        const seriesHasStage = valueMatchesRefs(seriesStages, activeStageRefs)
        const testHasStage = testsInSeries.some(test => valueMatchesRefs([getStageIdFromTest(test)], activeStageRefs))
        if (!seriesHasStage && !testHasStage) return false
      }
      const linkedFromCategory = flatTestCategories.some(category =>
        categoryRecordMatchesRefs(category, activeTestCategoryRefs) && categoryLinksSeries(category, seriesId)
      )
      return linkedFromCategory || seriesMatchesTestCategory(series, activeTestCategoryRefs, testsInSeries)
    })
  }, [seriesList, testsBySeriesId, activeExamCategoryRefs, activeExamRefs, activeStageRefs, activeTestCategoryRefs, activeExamCategoryId, activeExamId, flatTestCategories])

  const seriesTests = useMemo(() => {
    if (!selectedSeries) return []
    const seriesId = String(getSeriesId(selectedSeries) || '')
    return tests
      .filter(test => {
        if (!idsEqual(getTestSeriesId(test), seriesId)) return false
        if (activeTestCategory === 'live-tests') {
          if (!test.isLive && !recordMatchesTestCategory(test, activeTestCategoryRefs)) return false
        } else {
          if (!recordMatchesTestCategory(test, activeTestCategoryRefs)) return false
        }
        if (activeStageRefs.size > 0 && !valueMatchesRefs([getStageIdFromTest(test)], activeStageRefs)) return false
        return true
      })
      .sort((a, b) => {
        const aOrder = a.orderIndex ?? a.order_index ?? a.order ?? 0
        const bOrder = b.orderIndex ?? b.order_index ?? b.order ?? 0
        return aOrder - bOrder || String(a.title || a.name || '').localeCompare(String(b.title || b.name || ''))
      })
  }, [selectedSeries, tests, activeTestCategoryRefs, activeStageRefs])

  // Test matches selected subcategory (including descendants)
  const testMatchesSubCategory = (test, selectedId) => {
    if (!selectedId || selectedId === 'all') return true
    const refs = buildCategorySelectionRefs(selectedId, flatTestCategories)
    return recordMatchesTestCategory(test, refs)
  }

  // Get test count for a category (including its descendants)
  // NOTE: Must count from seriesTests (pre-subcategory filter), not workspaceTests,
  // to avoid a circular dependency where the selected subcategory zeroes out all sibling counts.
  const getCategoryTestCount = (categoryId) => {
    if (!categoryId || categoryId === 'all') return seriesTests.length
    const refs = buildCategorySelectionRefs(categoryId, flatTestCategories)
    return seriesTests.filter(test => recordMatchesTestCategory(test, refs)).length
  }

  const workspaceTests = useMemo(() => {
    if (!selectedTestSubCategoryId || selectedTestSubCategoryId === 'all') return seriesTests
    return seriesTests.filter(test => testMatchesSubCategory(test, selectedTestSubCategoryId))
  }, [seriesTests, selectedTestSubCategoryId, flatTestCategories])
  const selectedExamCategoryLabel = examCategories.find(category => idsEqual(category.categoryId || category.slug || category.id, activeExamCategoryId))?.label || activeExamCategoryId || 'Select exam category'
  const selectedExamLabel = examsForActiveCategory.find(exam => idsEqual(exam.value, activeExamId))?.label || activeExamId || 'Select exam'
  const selectedStageLabel = activeStageId ? stages.find(stage => idsEqual(getEntityId(stage), activeStageId))?.name || activeStageId : 'No stage selected'
  const selectedTestSubCategoryLabel = selectedTestSubCategoryId === 'all' ? 'All test subcategories' : getCategoryPathLabel(selectedTestSubCategoryId, flatTestCategories)
  const contextSubCategoryLabel = selectedTestSubCategoryId !== 'all'
    ? getCategoryPathLabel(selectedTestSubCategoryId, flatTestCategories)
    : 'All test subcategories'
  const contextLabel = `${selectedSeries?.title || selectedSeries?.name || 'Select series'} / ${selectedStageLabel} / ${activeCatLabel} / ${contextSubCategoryLabel}`

  const linkingInfo = {
    seriesName: selectedSeries?.title || selectedSeries?.name || null,
    examName: activeExamId ? examsForActiveCategory.find(e => idsEqual(e.value, activeExamId))?.label || activeExamId : null,
    stageName: activeStageId ? stages.find(s => idsEqual(getEntityId(s), activeStageId))?.name || null : null,
    categoryName: activeCatLabel || null,
  }

  const categoryCounts = useMemo(() => TEST_CATEGORY_TABS.reduce((acc, tab) => {
    if (tab.id === 'live-tests') {
      acc[tab.id] = tests.filter(test => test.isLive || recordMatchesTestCategory(test, buildTestCategoryRefs(tab.id, flatTestCategories))).length
    } else {
      const refs = buildTestCategoryRefs(tab.id, flatTestCategories)
      acc[tab.id] = tests.filter(test => recordMatchesTestCategory(test, refs)).length
    }
    return acc
  }, {}), [tests, flatTestCategories])

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setEditingRelationshipSummary(null)
    setFormData(DEFAULT_TEST_FORM)
  }

  useEffect(() => {
    if (!showForm || !editingId) return
    if (!editingTest) {
      closeForm()
      return
    }
    if (selectedSeries && !idsEqual(getSeriesId(selectedSeries), getTestSeriesId(editingTest))) {
      closeForm()
    }
  }, [showForm, editingId, editingTest, selectedSeries])

  const getLinkedTestCategoryId = () => {
    // Only return a category ID when the user has explicitly selected a subcategory chip.
    // Do NOT fall back to the root category ID when 'All' is selected — that would
    // overwrite the test's existing testCategoryId with an unusable root ID.
    if (selectedTestSubCategoryId && selectedTestSubCategoryId !== 'all') return selectedTestSubCategoryId
    return null
  }

  const openCreateForm = () => {
    if (!selectedSeries) {
      toast.error('Select a test series first')
      return
    }
    const type = activeTestCategory === 'pyp' ? 'pyp' : activeTestCategory === 'practice' ? 'practice' : activeTestCategory === 'live-tests' ? 'live-tests' : 'mock-tests'
    // Build cascading levels from selectedTestSubCategoryId, filtering out the root
    let l1 = '', l2 = '', l3 = '', l4 = ''
    if (selectedTestSubCategoryId !== 'all') {
      const subIds = new Set(activeTestSubCategories.map(c => String(getEntityId(c) || '')))
      const path = getCategoryPath(selectedTestSubCategoryId, flatTestCategories)
        .filter(p => subIds.has(String(getEntityId(p) || '')))
      if (path.length >= 1) l1 = String(getEntityId(path[0]) || '')
      if (path.length >= 2) l2 = String(getEntityId(path[1]) || '')
      if (path.length >= 3) l3 = String(getEntityId(path[2]) || '')
      if (path.length >= 4) l4 = String(getEntityId(path[3]) || '')
    }
    setFormData({ ...DEFAULT_TEST_FORM, type, isLive: activeTestCategory === 'live-tests', testCategoryId: selectedTestSubCategoryId !== 'all' ? selectedTestSubCategoryId : '', subCategoryLevel1: l1, subCategoryLevel2: l2, subCategoryLevel3: l3, subCategoryLevel4: l4 })
    setEditingId(null)
    setEditingRelationshipSummary(null)
    setShowForm(true)
  }

  const openEditForm = (test) => {
    const linkedSeries = seriesList.find(item => idsEqual(getSeriesId(item), getTestSeriesId(test)))
    const linkedStage = stages.find(item => idsEqual(getEntityId(item), getStageIdFromTest(test)))
    const linkedTestCategory = flatTestCategories.find(category =>
      getTestCategoryValues(test).some(value =>
        [category.id, category._id, category.categoryId, category.slug, category.name, category.label].some(categoryValue => idsEqual(categoryValue, value))
      )
    ) || null

    // Build the path for cascading dropdowns, filtering out the root category
    // (activeTestSubCategories only contains descendants of the root, not the root itself)
    let l1 = '', l2 = '', l3 = '', l4 = ''
    if (linkedTestCategory) {
      const subIds = new Set(activeTestSubCategories.map(c => String(getEntityId(c) || '')))
      const path = getCategoryPath(getEntityId(linkedTestCategory), flatTestCategories)
        .filter(p => subIds.has(String(getEntityId(p) || '')))
      if (path.length >= 1) l1 = String(getEntityId(path[0]) || '')
      if (path.length >= 2) l2 = String(getEntityId(path[1]) || '')
      if (path.length >= 3) l3 = String(getEntityId(path[2]) || '')
      if (path.length >= 4) l4 = String(getEntityId(path[3]) || '')
    }

    const linkedParentCategory = linkedTestCategory
      ? flatTestCategories.find(category => idsEqual(getEntityId(category), linkedTestCategory.parentId || linkedTestCategory.parent_id)) || null
      : null

    setEditingRelationshipSummary({
      series: linkedSeries?.title || linkedSeries?.name || linkedSeries?.slug || linkedSeries?.public_id || getTestSeriesId(test) || 'Not linked',
      stage: linkedStage?.name || linkedStage?.title || linkedStage?.slug || getStageIdFromTest(test) || 'Not linked',
      testCategory: linkedParentCategory ? getCategoryPathLabel(getEntityId(linkedParentCategory), flatTestCategories) : getCategoryPathLabel(getEntityId(linkedTestCategory), flatTestCategories),
      testSubcategory: linkedParentCategory ? getCategoryPathLabel(getEntityId(linkedTestCategory), flatTestCategories) : (linkedTestCategory ? 'No subcategory' : 'Not linked'),
      sections: sections.filter(s => String(s.test_id) === String(getTestId(test))).map(s => s.name).join(', ') || 'Not linked',
    })

    setFormData({
      ...DEFAULT_TEST_FORM,
      title: test.title || test.name || '',
      slug: test.slug || '',
      testCategoryId: linkedTestCategory ? (getEntityId(linkedTestCategory) || '') : '',
      subCategoryLevel1: l1,
      subCategoryLevel2: l2,
      subCategoryLevel3: l3,
      subCategoryLevel4: l4,
      type: test.type || (activeTestCategory === 'pyp' ? 'pyp' : activeTestCategory === 'practice' ? 'practice' : 'mock-tests'),
      duration: test.duration || test.time_limit || 60,
      totalQuestions: test.totalQuestions || test.total_questions || 0,
      totalMarks: test.totalMarks || test.total_marks || 0,
      negativeMarking: test.negativeMarking || test.negative_marking || 0.25,
      difficulty: test.difficulty || 'Medium',
      isPro: Boolean(test.isPro || test.is_pro),
      isComingSoon: Boolean(test.isComingSoon || test.is_coming_soon),
      isLive: Boolean(test.isLive || test.is_live),
      scheduledAt: test.scheduledAt || test.scheduled_at || '',
      maxParticipants: test.maxParticipants || test.max_participants || '',
      tags: Array.isArray(test.tags) ? test.tags.join(', ') : (test.tags || ''),
      stageIds: Array.isArray(test.stage_ids || test.stageIds) ? (test.stage_ids || test.stageIds).join(', ') : '',
      sectionIds: sections.filter(s => String(s.test_id) === String(getTestId(test))).map(s => s.id).join(', '),
    })
    setEditingId(getTestId(test))
    setShowForm(true)
  }

  const handleSubmit = async (data) => {
    if (!selectedSeries) return
    try {
      setSaving(true)
      const baseSlug = (data.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      const targetSeriesId = editingTest ? (getTestSeriesId(editingTest) || getSeriesId(selectedSeries)) : getSeriesId(selectedSeries)
      const targetStageId = editingTest ? (getStageIdFromTest(editingTest) || activeStageId || null) : (activeStageId || null)
      const payload = {
        title: data.title,
        slug: data.slug || (editingId ? undefined : `${baseSlug}-${Date.now()}`),
        testSeriesId: targetSeriesId,
        stageId: targetStageId,
        category: getSeriesExamCategoryId(selectedSeries) || activeExamCategoryId || '',
        testCategoryId: data.testCategoryId || (editingId ? undefined : getLinkedTestCategoryId()),
        type: data.type,
        duration: Number(data.duration) || 60,
        negativeMarking: Number(data.negativeMarking) || 0,
        difficulty: data.difficulty,
        isPro: Boolean(data.isPro),
        isComingSoon: Boolean(data.isComingSoon),
        isLive: Boolean(data.isLive),
        sectionIds: parseIdList(data.sectionIds).map(id => Number(id)).filter(Number.isInteger),
        // Only send optional fields when they have actual values to avoid
        // "column does not exist" errors for columns not yet in the schema
        ...(data.isLive && data.scheduledAt ? { scheduledAt: data.scheduledAt } : {}),
        ...(data.isLive && data.maxParticipants ? { maxParticipants: Number(data.maxParticipants) } : {}),
        ...(data.tags ? { tags: data.tags.split(',').map(tag => tag.trim()).filter(Boolean) } : {}),
        ...((() => {
          const ids = data.stageIds
            ? data.stageIds.split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s))
            : targetStageId ? [parseInt(targetStageId)] : []
          return ids.length > 0 ? { stageIds: ids } : {}
        })()),
        ...((() => {
          const ids = parseIdList(data.sectionIds).map(s => parseInt(s, 10)).filter(s => !Number.isNaN(s))
          return ids.length > 0 ? { sectionIds: ids } : {}
        })()),
      }

      // Only include examId if it has a valid value
      const examId = getSeriesExamId(selectedSeries) || activeExamId
      if (examId) {
        payload.examId = examId
      }

      // Remove undefined and null values for optional ID and string fields to avoid validation errors
      Object.keys(payload).forEach(key => {
        if ((key === 'slug' || key.endsWith('Id') || key.endsWith('_id') || key === 'category' || key === 'type' || key === 'difficulty') &&
          (payload[key] === undefined || payload[key] === null || payload[key] === '')) {
          delete payload[key]
        }
      })

      if (editingId) {
        await adminAPI.updateTest(editingId, payload)
        toast.success('Test updated successfully')
      } else {
        await adminAPI.createTest(payload)
        toast.success('Test created successfully')
      }
      closeForm()
      await fetchData()
    } catch (error) {
      console.error('Failed to save test:', error)
      toast.error(error.response?.data?.message || 'Failed to save test')
    } finally {
      setSaving(false)
    }
  }

  const handleBulkUpload = async (file, options = {}) => {
    if (!selectedSeries) throw new Error('Select a test series first')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('testSeriesId', String(getSeriesId(selectedSeries)))
    fd.append('category', String(getSeriesExamCategoryId(selectedSeries) || activeExamCategoryId || ''))

    const examId = getSeriesExamId(selectedSeries) || activeExamId
    if (examId) fd.append('examId', String(examId))

    if (activeStageId) fd.append('stageId', String(activeStageId))
    const linkedCategoryId = getLinkedTestCategoryId()
    if (linkedCategoryId) fd.append('testCategoryId', String(linkedCategoryId))

    if (options.validateOnly) {
      fd.append('validateOnly', 'true')
    }

    const response = await adminAPI.bulkUploadTests(fd)

    if (options.validateOnly) {
      return response.data
    }

    const count = response.data?.data?.length || response.data?.count || 0
    const skipped = response.data?.skipped || 0

    if (skipped > 0) {
      toast.success(`${count} tests uploaded, ${skipped} skipped (duplicates/invalid)`)
    } else {
      toast.success(response.data?.message || `${count} tests uploaded successfully`)
    }

    await fetchData()
  }

  const validateBulkUpload = async (file) => {
    if (!selectedSeries) throw new Error('Select a test series first')

    const existingTitles = new Set(tests.map(t => t.title?.toLowerCase().trim()).filter(Boolean))
    const duplicateErrors = []

    const fd = new FormData()
    fd.append('file', file)
    fd.append('validateOnly', 'true')

    try {
      const response = await adminAPI.bulkUploadTests(fd)
      const validationResult = response.data

      if (validationResult?.validation) {
        const rows = validationResult.validation
        rows.forEach((row, idx) => {
          if (existingTitles.has(String(row.title || '').toLowerCase().trim())) {
            duplicateErrors.push({ row: idx + 1, title: row.title, reason: 'Duplicate test title' })
          }
          if (!row.title || String(row.title).trim().length < 2) {
            duplicateErrors.push({ row: idx + 1, title: row.title || 'Unknown', reason: 'Missing/invalid title' })
          }
        })
      }

      return {
        isValid: duplicateErrors.length === 0,
        errors: duplicateErrors,
        totalRows: validationResult?.totalRows || 0,
        validRows: validationResult?.validRows || 0
      }
    } catch (error) {
      return { isValid: false, errors: [{ row: 0, title: '', reason: error.message }], totalRows: 0, validRows: 0 }
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await adminAPI.deleteTest(deleteTarget.id)
      setTests(prev => prev.filter(test => !idsEqual(getTestId(test), deleteTarget.id)))
      toast.success('Test deleted successfully')
      setDeleteTarget(null)
    } catch (error) {
      console.error('Failed to delete test:', error)
      toast.error('Failed to delete test')
    }
  }

  const handlePublish = async (test) => {
    const testId = getTestId(test)
    const questionCount = getTestQuestionsCount(test)

    if (questionCount === 0) {
      toast.error('Cannot publish: Test has no questions. Add questions first.')
      return
    }

    try {
      const response = await adminAPI.publishTest(testId)
      setTests(prev => prev.map(t =>
        idsEqual(getTestId(t), testId) ? { ...t, status: 'published', isActive: true, total_questions: response.data.data?.total_questions, total_marks: response.data.data?.total_marks } : t
      ))
      toast.success('Test published successfully')
    } catch (error) {
      console.error('Failed to publish test:', error)
      const backendErrors = error.response?.data?.errors
      if (backendErrors && backendErrors.length > 0) {
        backendErrors.forEach(err => toast.error(`${err.field}: ${err.message}`))
      } else {
        toast.error(error.response?.data?.message || 'Failed to publish test')
      }
    }
  }

  const handleUnpublish = async (test) => {
    const testId = getTestId(test)
    try {
      await adminAPI.unpublishTest(testId)
      setTests(prev => prev.map(t =>
        idsEqual(getTestId(t), testId) ? { ...t, status: 'draft', isActive: false } : t
      ))
      toast.success('Test unpublished (reverted to draft)')
    } catch (error) {
      console.error('Failed to unpublish test:', error)
      toast.error(error.response?.data?.message || 'Failed to unpublish test')
    }
  }

  const handleExport = async () => {
    try {
      const response = await adminAPI.apiClient.get('/admin/tests/export', { responseType: 'blob' })
      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `tests_export_${Date.now()}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      toast.success('Tests exported successfully')
    } catch (error) {
      console.error('Export failed:', error)
      toast.error('Failed to export tests')
    }
  }

  if (loading || examFiltersLoading) return <div className="p-6">Loading tests...</div>

  const hasErrors = Object.keys(errors).length > 0
  const hasNoTests = tests.length === 0 && !hasErrors

  if (hasNoTests) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
          <p className="text-amber-800 dark:text-amber-200">No tests found. Create your first test or import from CSV.</p>
        </div>
      </div>
    )
  }

  if (hasErrors && tests.length === 0) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <p className="text-red-800 dark:text-red-200 font-medium">Failed to load tests</p>
          <ul className="mt-2 text-sm text-red-600 dark:text-red-400">
            {Object.entries(errors).map(([key, value]) => (
              <li key={key}>• {key}: {value}</li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3">
      <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-4 overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-hide">
        {TEST_CATEGORY_TABS.map(tab => {
          const isActive = activeTestCategory === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTestCategory(tab.id)
                setSelectedSeries(null)
              }}
              className={`flex items-center gap-2 px-4 sm:px-6 py-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap shrink-0 ${isActive
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={CheckSquare} value={tests.length} label="Total Tests" tone="indigo" />
        <StatCard icon={Layers} value={seriesList.filter(series => series.isActive !== false && series.is_active !== false).length} label="Active Test Series" tone="green" />
        <StatCard icon={FileText} value={testCategories.length} label="Test Categories" tone="amber" />
        <StatCard icon={Shield} value={tests.filter(test => test.status === 'published').length} label="Published Tests" tone="blue" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Manager Filters</h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">Exam Category:</span>
            {examCategories.length === 0 ? (
              <span className="text-sm text-gray-400">No exam categories found</span>
            ) : examCategories.map(category => {
              const categoryValue = category.categoryId || category.slug || category.id
              const isActive = idsEqual(activeExamCategoryId, categoryValue)
              return (
                <button
                  key={categoryValue}
                  type="button"
                  onClick={() => {
                    setActiveExamCategoryId(categoryValue)
                    setActiveExamId('')
                    setActiveStageId('')
                  }}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                >
                  {category.label || category.name || categoryValue}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">Exam:</span>
            {examsForActiveCategory.length === 0 ? (
              <span className="text-sm text-gray-400">No exams found</span>
            ) : examsForActiveCategory
              .filter(exam => {
                // Skip entries with no meaningful label — they'd display as a raw numeric ID
                const display = exam.label || exam.fullName
                return display || (exam.value && isNaN(Number(exam.value)))
              })
              .map(exam => {
                const isActive = idsEqual(activeExamId, exam.value)
                return (
                  <button
                    key={exam.value}
                    type="button"
                    onClick={() => {
                      setActiveExamId(exam.value)
                      setActiveStageId('')
                    }}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                  >
                    {exam.label || exam.fullName || exam.value}
                  </button>
                )
              })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-gray-700">Stage:</span>
            {stagesForActiveExam.map(stage => {
              const stageId = getEntityId(stage)
              const isActive = idsEqual(activeStageId, stageId)
              return (
                <button key={stageId} type="button" onClick={() => setActiveStageId(stageId)} className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                  {stage.name || stage.title || stage.slug || stageId}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Selected Path</span>
            {[selectedExamCategoryLabel, selectedExamLabel, selectedSeries?.title || selectedSeries?.name, selectedStageLabel, activeCatLabel, selectedTestSubCategoryLabel]
              .filter(label => label)
              .map((label, index) => (
                <span key={`${label}-${index}`} className="inline-flex items-center gap-2">
                  {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
                  <span className={`px-2.5 py-1 border rounded-lg text-xs ${label === activeCatLabel ? 'bg-indigo-50 border-indigo-100 font-semibold text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-700'}`}>{label}</span>
                </span>
              ))}
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Test Series</h2>
          <p className="text-sm text-gray-500">{filteredSeriesList.length} series match the current exam, stage, and test category.</p>
        </div>
        <button type="button" onClick={handleExport} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
          <FileText className="w-4 h-4" /> Export
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {!activeStageId ? (
          <EmptyState icon={Layers} title="Stage Selection Required" description="Please select a stage from the filters above to view and manage test series." />
        ) : filteredSeriesList.length === 0 ? (
          <EmptyState icon={FolderOpen} title="No Test Series Found" description="Choose an exam category and exam, or link a test series to this test category." />
        ) : filteredSeriesList.map(series => {
          const seriesId = getSeriesId(series)
          const testsInSeries = testsBySeriesId.get(String(seriesId || '')) || []
          const linkedTests = testsInSeries.filter(test =>
            recordMatchesTestCategory(test, activeTestCategoryRefs) &&
            (activeStageRefs.size === 0 || valueMatchesRefs([getStageIdFromTest(test)], activeStageRefs))
          )
          const totalQuestions = linkedTests.reduce((sum, test) => sum + getTestQuestionsCount(test), 0)
          return (
            <div
              key={seriesId}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedSeries(series)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  setSelectedSeries(series)
                }
              }}
              className="group bg-white border border-gray-200 rounded-xl cursor-pointer transition-all p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden hover:border-indigo-300 hover:shadow-md"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-indigo-500 transition-colors" />
              <div className="flex items-start gap-4 min-w-0 flex-1 pl-1">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <FolderOpen className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge tone="indigo">{activeCatLabel}</Badge>
                    <Badge tone="blue">{selectedExamLabel}</Badge>
                    <Badge tone={series.isActive === false || series.is_active === false ? 'gray' : 'green'}>{series.isActive === false || series.is_active === false ? 'Inactive' : 'Active'}</Badge>
                  </div>
                  <h3 className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors truncate">{series.title || series.name || 'Untitled Series'}</h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{series.description || 'No description available'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 md:gap-6 shrink-0 w-full md:w-auto pt-3 md:pt-0 border-t md:border-0 border-gray-100">
                <div className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-3 sm:gap-6 text-gray-600 w-full md:w-auto">
                  <span className="text-sm font-bold text-gray-900 flex items-center gap-1.5"><FileText className="w-4 h-4 text-gray-400" />{linkedTests.length} Tests</span>
                  <span className="text-sm font-bold text-indigo-600 flex items-center gap-1.5"><CheckSquare className="w-4 h-4 text-indigo-400" />{totalQuestions} Qs</span>
                  <span className="text-sm font-medium text-gray-600 flex items-center gap-1.5"><Clock className="w-4 h-4 text-gray-400" />{selectedStageLabel}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 hidden md:block" />
              </div>
            </div>
          )
        })}
      </div>

      {selectedSeries && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white w-full max-w-6xl max-h-[92vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4 bg-gray-50">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900 truncate">{selectedSeries.title || selectedSeries.name || 'Test Series'}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  {[selectedExamCategoryLabel, selectedExamLabel, selectedStageLabel, activeCatLabel].map((label, index) => (
                    <span key={`${label}-${index}`} className="inline-flex items-center gap-2">
                      {index > 0 && <ChevronRight className="w-3 h-3 text-gray-300" />}
                      <span className={`px-2 py-1 border rounded ${index === 3 ? 'bg-indigo-50 border-indigo-100 text-indigo-700 font-semibold' : 'bg-white border-gray-200'}`}>{label}</span>
                    </span>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => { setSelectedSeries(null); setSelectedTestSubCategoryId('all'); closeForm() }} className="p-2 hover:bg-gray-200 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-b border-gray-200 p-3 flex flex-col gap-2">
              {activeStageId ? (
                <>
                  {/* Level 1 - Top level row (Year Based, Exam Based) */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1 shrink-0">Test Subcategory</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSubCategoryLevel1('')
                        setSubCategoryLevel2('')
                        setSubCategoryLevel3('')
                        setSubCategoryLevel4('')
                        setSelectedTestSubCategoryId('all')
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${!subCategoryLevel1
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                      All ({seriesTests.length})
                    </button>
                    {subCategoryOptionsLevel1.map((cat) => {
                      const catId = getEntityId(cat) || ''
                      const isSelected = subCategoryLevel1 === catId
                      const count = getCategoryTestCount(catId)
                      return (
                        <button
                          key={catId}
                          type="button"
                          onClick={() => {
                            const newVal = isSelected ? '' : catId
                            setSubCategoryLevel1(newVal)
                            setSubCategoryLevel2('')
                            setSubCategoryLevel3('')
                            setSubCategoryLevel4('')
                            setSelectedTestSubCategoryId(newVal || 'all')
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${isSelected
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                          {getCategoryLabel(cat)} ({count})
                        </button>
                      )
                    })}
                  </div>

                  {/* Level 2 - Second row (2025, 2024, etc.) */}
                  {subCategoryLevel1 && subCategoryOptionsLevel2.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap ml-4">
                      {subCategoryOptionsLevel2.map((cat) => {
                        const catId = getEntityId(cat) || ''
                        const isSelected = subCategoryLevel2 === catId
                        const count = getCategoryTestCount(catId)
                        return (
                          <button
                            key={catId}
                            type="button"
                            onClick={() => {
                              const newVal = isSelected ? '' : catId
                              setSubCategoryLevel2(newVal)
                              setSubCategoryLevel3('')
                              setSubCategoryLevel4('')
                              setSelectedTestSubCategoryId(newVal || subCategoryLevel1 || 'all')
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${isSelected
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                            {getCategoryLabel(cat)} ({count})
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Level 3 - Third row */}
                  {subCategoryLevel2 && subCategoryOptionsLevel3.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap ml-8">
                      {subCategoryOptionsLevel3.map((cat) => {
                        const catId = getEntityId(cat) || ''
                        const isSelected = subCategoryLevel3 === catId
                        const count = getCategoryTestCount(catId)
                        return (
                          <button
                            key={catId}
                            type="button"
                            onClick={() => {
                              const newVal = isSelected ? '' : catId
                              setSubCategoryLevel3(newVal)
                              setSubCategoryLevel4('')
                              setSelectedTestSubCategoryId(newVal || subCategoryLevel2 || subCategoryLevel1 || 'all')
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${isSelected
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                            {getCategoryLabel(cat)} ({count})
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Level 4 - Fourth row */}
                  {subCategoryLevel3 && subCategoryOptionsLevel4.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap ml-12">
                      {subCategoryOptionsLevel4.map((cat) => {
                        const catId = getEntityId(cat) || ''
                        const isSelected = subCategoryLevel4 === catId
                        const count = getCategoryTestCount(catId)
                        return (
                          <button
                            key={catId}
                            type="button"
                            onClick={() => {
                              const newVal = isSelected ? '' : catId
                              setSubCategoryLevel4(newVal)
                              setSelectedTestSubCategoryId(newVal || subCategoryLevel3 || subCategoryLevel2 || subCategoryLevel1 || 'all')
                            }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${isSelected
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                            {getCategoryLabel(cat)} ({count})
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {subCategoryOptionsLevel1.length === 0 && (
                    <span className="text-sm text-gray-400 px-2">No child categories under {activeCatLabel}</span>
                  )}
                </>
              ) : (
                <span className="text-sm font-medium text-amber-600 px-2">Please select a stage to view subcategories</span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50/40">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-gray-900">Tests</h3>
                  <p className="text-sm text-gray-500">{workspaceTests.length} tests linked to the selected test subcategory.</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowBulkUpload(true)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <Upload className="w-4 h-4" /> Bulk Create
                  </button>
                  <button type="button" onClick={openCreateForm} className="px-3 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700 flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Create Test
                  </button>
                </div>
              </div>

              {workspaceTests.length === 0 ? (
                <EmptyState icon={FileText} title="No Tests Linked" description="Create a test or bulk upload tests for this series and selected test subcategory." />
              ) : (
                <div className="flex flex-col gap-3">
                  {workspaceTests.map(test => {
                    const testId = getTestId(test)
                    return (
                      <div key={testId} className="w-full bg-white border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2 mb-2">
                            <Badge tone={test.status === 'active' || test.status === 'published' ? 'green' : 'gray'}>{test.status || 'draft'}</Badge>
                            <Badge tone="indigo">{test.type || activeTestCategory}</Badge>
                          </div>
                          <h4 className="font-bold text-gray-900 truncate">{test.title || test.name || 'Untitled Test'}</h4>
                          <p className="text-xs text-gray-500 mt-1 truncate">{test.description || 'No description'}</p>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600 shrink-0">
                          <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{test.duration || test.time_limit || '--'} min</span>
                          <span className="flex items-center gap-1"><FileText className="w-4 h-4" />{getTestQuestionsCount(test)} Qs</span>
                          {test.status === 'published' ? (
                            <button type="button" onClick={() => handleUnpublish(test)} className="px-2 py-1 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 text-xs font-medium" title="Unpublish">
                              Unpublish
                            </button>
                          ) : (
                            <button type="button" onClick={() => handlePublish(test)} disabled={getTestQuestionsCount(test) === 0} className="px-2 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed" title={getTestQuestionsCount(test) === 0 ? 'Add questions first' : 'Publish'}>
                              Publish
                            </button>
                          )}
                          <button type="button" onClick={() => openEditForm(test)} className="p-2 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600" title="Edit">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => setDeleteTarget({ id: testId, title: test.title || test.name || 'Untitled Test' })} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <TestFormModal
        key={editingId || `create-${getSeriesId(selectedSeries) || 'none'}-${activeStageId || 'all'}-${selectedTestSubCategoryId}`}
        isOpen={showForm}
        onClose={closeForm}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        editingId={editingId}
        contextLabel={contextLabel}
        saving={saving}
        relationshipSummary={editingRelationshipSummary}
        availableSections={sections}
        allSubCategories={activeTestSubCategories}
        flatTestCategories={flatTestCategories}
      />
      <BulkUploadModal isOpen={showBulkUpload} onClose={() => setShowBulkUpload(false)} onUpload={handleBulkUpload} onValidate={validateBulkUpload} contextLabel={contextLabel} linkingInfo={linkingInfo} />

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Test</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to delete "<strong>{deleteTarget.title}</strong>"?</p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
