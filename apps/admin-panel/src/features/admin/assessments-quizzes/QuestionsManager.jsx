import { useState, useEffect, useMemo } from 'react'
import {
  Plus, Edit2, Trash2, X, Save,
  BookOpen, FileText, CheckCircle, Upload, Download,
  Eye, EyeOff, ChevronLeft, ChevronRight,
  Settings, Hash, Clock, ClipboardList, ScrollText, Sparkles,
  Layers, ArrowLeft, FolderOpen, List, Filter, Activity, AlertTriangle
} from 'lucide-react'
import { adminAPI, questionsAPI } from '../../../shared/lib/dataService'
import { useExamCategories } from '../../../shared/hooks/useExamCategories'
import { toast } from 'react-hot-toast'
import UserActivityLog from '../users-enrollments/UserActivityLog'

// Category Tabs Configuration
const QUESTION_CATEGORIES = [
  {
    id: 'mock-tests',
    label: 'Mock Tests',
    icon: ClipboardList,
    description: 'Full-length & sectional mock test questions',
    gradient: 'from-indigo-500 to-blue-600',
    lightBg: 'bg-indigo-50',
    lightText: 'text-indigo-600',
    borderColor: 'border-indigo-500',
    ringColor: 'ring-indigo-200'
  },
  {
    id: 'pyp',
    label: 'Previous Year Papers',
    icon: ScrollText,
    description: 'Questions from past exam papers',
    gradient: 'from-amber-500 to-orange-600',
    lightBg: 'bg-amber-50',
    lightText: 'text-amber-600',
    borderColor: 'border-amber-500',
    ringColor: 'ring-amber-200'
  },
  {
    id: 'practice',
    label: 'Practice & Quiz',
    icon: Sparkles,
    description: 'Practice sets & quick quiz questions',
    gradient: 'from-emerald-500 to-teal-600',
    lightBg: 'bg-emerald-50',
    lightText: 'text-emerald-600',
    borderColor: 'border-emerald-500',
    ringColor: 'ring-emerald-200'
  },
  {
    id: 'audit',
    label: 'Audit',
    icon: AlertTriangle,
    description: 'Incomplete drafts',
    gradient: 'from-rose-500 to-red-600',
    lightBg: 'bg-rose-50',
    lightText: 'text-rose-600',
    borderColor: 'border-rose-500',
    ringColor: 'ring-rose-200'
  }
]

// Mapping from question category IDs (tab IDs) to real test category names from DB
// DB uses: "Mock Tests", "PYPs", "Practice" as category values in tests table
const QUESTION_CAT_TO_TEST_CAT_MAP = {
  'mock-tests': 'Mock Tests',
  pyp: 'PYPs',
  practice: 'Practice'
}
// Reverse map: DB test category value -> question category ID
const TEST_CAT_TO_QUESTION_CAT = Object.fromEntries(
  Object.entries(QUESTION_CAT_TO_TEST_CAT_MAP).map(([k, v]) => [v, k])
)

const QUESTION_CATEGORY_ALIASES = {
  'mock-tests': ['mock-tests', 'mock', 'mock test', 'mock tests', 'Mock Tests'],
  pyp: ['pyp', 'pyps', 'previous-year', 'previous year', 'previous year papers', 'Previous Year Papers', 'PYPs'],
  practice: ['practice', 'quiz', 'practice-quiz', 'practice & quiz', 'Practice']
}

const normalizeKey = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const getEntityId = (item) => item?._id ?? item?.id ?? null

const idsEqual = (a, b) => {
  if (a === null || a === undefined || b === null || b === undefined) return false
  return String(a) === String(b)
}

const coerceArray = (value) => {
  if (Array.isArray(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed
        .slice(1, -1)
        .split(',')
        .map((part) => part.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    }
    try {
      const parsed = JSON.parse(trimmed)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return trimmed.split(',').map(part => part.trim()).filter(Boolean)
    }
  }
  if (value !== null && value !== undefined && value !== '') return [value]
  return []
}

const flattenCategories = (categories = []) => {
  const flattened = []
  const walk = (items, parentId = '') => {
    items.forEach((item) => {
      const id = getEntityId(item)
      flattened.push({ ...item, parentId: item.parentId ?? item.parent_id ?? parentId })
      if (Array.isArray(item.children) && item.children.length > 0) {
        walk(item.children, id)
      }
    })
  }
  walk(Array.isArray(categories) ? categories : [])
  return flattened
}

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
].filter(value => value !== null && value !== undefined && value !== '')

const getSeriesCategoryValues = (series = {}) => [
  series.testCategoryId,
  series.test_category_id,
  ...(coerceArray(series.testCategoryIds || series.test_category_ids)),
  ...(coerceArray(series.testCategories || series.test_categories)),
  series.testCategory,
  series.test_category,
].filter(value => value !== null && value !== undefined && value !== '')

const getSeriesId = (series) => series?._id ?? series?.id ?? series?.public_id ?? null
const getTestId = (test) => test?._id ?? test?.id ?? test?.public_id ?? null
const getQuestionId = (question) => question?._id ?? question?.id ?? question?.public_id ?? null
const getTestSeriesIdFromTest = (test = {}) =>
  test.testSeriesId ?? test.test_series_id ?? test.seriesId ?? test.series_id ?? null
const getTestIdFromQuestion = (question = {}) => question.testId ?? question.test_id ?? question.testid ?? null
const getTestSeriesIdFromQuestion = (question = {}) =>
  question.testSeriesId ?? question.test_series_id ?? question.seriesId ?? question.series_id ?? null
const getSeriesExamId = (series = {}) =>
  series.examId ?? series.exam_id ?? series.subcategory ?? series.subCategory ?? series.sub_category ?? series.subcategory_id ?? null
const getSeriesExamCategoryId = (series = {}) => series.category ?? series.category_id ?? series.examCategoryId ?? series.exam_category_id ?? null
const getStageIdFromTest = (test = {}) => test.stageId ?? test.stage_id ?? test.tierId ?? test.tier_id ?? null
const getSectionId = (section = {}) => section._id ?? section.id ?? null
const getSectionName = (section = {}) => section.name || section.title || section.label || ''
const sectionValueMatches = (section, value) => {
  if (value === null || value === undefined || value === '') return false
  return String(getSectionId(section)) === String(value) || getSectionName(section) === String(value)
}

const normalizeQuestion = (q) => ({
  ...q,
  questionText: q.questionText || q.question_text || q.text?.en || q.text || '',
  questionTextHi: q.questionTextHi || q.question_text_hi || '',
  correctOption: q.correctOption ?? q.correct_option ?? q.correct ?? 0,
  negativeMarks: q.negativeMarks ?? q.negative_marks ?? 0,
  options: Array.isArray(q.options) ? q.options : (q.options?.en || []),
  optionsHi: q.optionsHi || q.options_hi || [],
  category: q.category || 'mock-tests',
  section: q.section || '',
  passageId: q.passageId || q.passage_id || null,
  questionNumber: q.questionNumber || q.question_number || null,
  imageUrl: q.imageUrl || q.image_url || '',
  testId: q.testId ?? q.test_id ?? q.testid ?? null,
  testSeriesId: q.testSeriesId ?? q.test_series_id ?? q.seriesId ?? q.series_id ?? null,
  subjectId: q.subjectId ?? q.subject_id ?? null,
  chapterId: q.chapterId ?? q.chapter_id ?? null,
  topicId: q.topicId ?? q.topic_id ?? null,
})

const valueMatchesRefs = (values, refs) => {
  if (!refs || refs.size === 0) return false
  return values
    .filter(value => value !== null && value !== undefined && value !== '')
    .some(value => refs.has(normalizeKey(value)) || refs.has(String(value)))
}

const buildExamCategoryRefs = (categoryId, categories = []) => {
  const refs = new Set()
  if (!categoryId) return refs
  const match = categories.find(cat =>
    [cat.id, cat.categoryId, cat.slug, cat.label, cat.name].some(value => idsEqual(value, categoryId))
  )
    ;[categoryId, match?.id, match?.categoryId, match?.slug, match?.label, match?.name]
      .filter(Boolean)
      .forEach(value => {
        refs.add(String(value))
        refs.add(normalizeKey(value))
      })
  return refs
}

const buildExamRefs = (examId, exams = [], examInfo = []) => {
  const refs = new Set()
  if (!examId) return refs
  const allExams = [...(exams || []), ...(examInfo || [])]
  const match = allExams.find(exam =>
    [exam.id, exam._id, exam.examId, exam.exam_id, exam.slug, exam.name, exam.title].some(value => idsEqual(value, examId))
  )
    ;[
      examId,
      match?.id,
      match?._id,
      match?.examId,
      match?.exam_id,
      match?.slug,
      match?.name,
      match?.title,
    ].filter(Boolean).forEach(value => {
      refs.add(String(value))
      refs.add(normalizeKey(value))
    })
  return refs
}

const buildStageRefs = (stageId) => {
  const refs = new Set()
  if (!stageId) return refs
  refs.add(String(stageId))
  refs.add(normalizeKey(stageId))
  return refs
}

const stageMatchesExam = (stage, examRefs) => {
  if (!stage || !examRefs || examRefs.size === 0) return false
  const stageExamIds = coerceArray(stage.examIds || stage.exam_ids || stage.exam_id || stage.examId)
  return valueMatchesRefs(stageExamIds, examRefs)
}

const buildTestCategoryRefs = (activeCategory, flatCategories = []) => {
  const refs = new Set()
  const aliases = QUESTION_CATEGORY_ALIASES[activeCategory] || [activeCategory]
  aliases.forEach(value => {
    refs.add(String(value))
    refs.add(normalizeKey(value))
  })
  const mappedName = QUESTION_CAT_TO_TEST_CAT_MAP[activeCategory]
  if (mappedName) {
    refs.add(mappedName)
    refs.add(normalizeKey(mappedName))
  }

  const seedCategories = flatCategories.filter(cat =>
    [cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId]
      .filter(Boolean)
      .some(value => refs.has(String(value)) || refs.has(normalizeKey(value)))
  )

  const childrenByParent = new Map()
  flatCategories.forEach(cat => {
    const parentId = cat.parentId || cat.parent_id || ''
    const key = String(parentId || '')
    if (!childrenByParent.has(key)) childrenByParent.set(key, [])
    childrenByParent.get(key).push(cat)
  })

  const addCategory = (cat) => {
    ;[cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId]
      .filter(Boolean)
      .forEach(value => {
        refs.add(String(value))
        refs.add(normalizeKey(value))
      })
  }

  const queue = [...seedCategories]
  const seen = new Set()
  while (queue.length > 0) {
    const cat = queue.shift()
    const id = String(getEntityId(cat) || cat.categoryId || cat.slug || cat.name || '')
    if (seen.has(id)) continue
    seen.add(id)
    addCategory(cat)
      ; (childrenByParent.get(String(getEntityId(cat) || '')) || []).forEach(child => queue.push(child))
  }

  return refs
}

const buildCategorySelectionRefs = (categoryId, flatCategories = []) => {
  const refs = new Set()
  if (!categoryId) return refs

  const seed = flatCategories.find(cat =>
    [cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId]
      .filter(Boolean)
      .some(value => idsEqual(value, categoryId))
  )

    ;[categoryId, seed?.id, seed?._id, seed?.slug, seed?.name, seed?.label, seed?.categoryId]
      .filter(Boolean)
      .forEach(value => {
        refs.add(String(value))
        refs.add(normalizeKey(value))
      })

  if (!seed) return refs

  const childrenByParent = new Map()
  flatCategories.forEach(cat => {
    const parentId = cat.parentId || cat.parent_id || ''
    const key = String(parentId || '')
    if (!childrenByParent.has(key)) childrenByParent.set(key, [])
    childrenByParent.get(key).push(cat)
  })

  const queue = [...(childrenByParent.get(String(getEntityId(seed) || '')) || [])]
  const seen = new Set([String(getEntityId(seed) || seed.categoryId || seed.slug || seed.name || categoryId)])

  while (queue.length > 0) {
    const cat = queue.shift()
    const id = String(getEntityId(cat) || cat.categoryId || cat.slug || cat.name || '')
    if (!id || seen.has(id)) continue
    seen.add(id)
      ;[cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId]
        .filter(Boolean)
        .forEach(value => {
          refs.add(String(value))
          refs.add(normalizeKey(value))
        })
      ; (childrenByParent.get(String(getEntityId(cat) || '')) || []).forEach(child => queue.push(child))
  }

  return refs
}

const recordMatchesTestCategory = (record, refs) => valueMatchesRefs(getTestCategoryValues(record), refs)
const categoryLinksSeries = (category, seriesId) =>
  coerceArray(category?.testSeriesId ?? category?.test_series_id ?? category?.test_series_ids ?? category?.seriesId ?? category?.series_id)
    .some(id => idsEqual(id, seriesId))

const categoryRecordMatchesRefs = (category, refs) =>
  valueMatchesRefs([category?.id, category?._id, category?.slug, category?.name, category?.label, category?.categoryId], refs)

const seriesMatchesTestCategory = (series, refs, testsInSeries = []) => {
  if (valueMatchesRefs(getSeriesCategoryValues(series), refs)) return true
  return testsInSeries.some(test => recordMatchesTestCategory(test, refs))
}

// Constants
const QUESTION_TYPES = [
  { value: 'mcq', label: 'MCQ', description: 'Single correct answer' },
  { value: 'msq', label: 'MSQ', description: 'Multiple correct answers' },
  { value: 'numerical', label: 'Numerical', description: 'Number answer' },
  { value: 'descriptive', label: 'Descriptive', description: 'Text answer' }
]

const DIFFICULTY_LEVELS = [
  { value: 'easy', label: 'Easy', color: 'bg-green-100 text-green-700' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'hard', label: 'Hard', color: 'bg-red-100 text-red-700' }
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-700' },
  { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  { value: 'disabled', label: 'Disabled', color: 'bg-red-100 text-red-700' }
]

const DEFAULT_FORM_DATA = {
  questionText: '',
  questionTextHi: '',
  type: 'mcq',
  category: 'mock-tests',
  subject: '',
  chapter: '',
  topic: '',
  section: '',
  difficulty: 'medium',
  marks: 2,
  negativeMarks: 0.5,
  options: ['', '', '', ''],
  optionsHi: [],
  correctOption: 0,
  explanation: '',
  status: 'draft',
  tags: [],
  imageAssetId: null,
  imageUrl: '',
  passageId: null,
  questionNumber: null,
  testId: null,
  testSeriesId: null,
}

const DEFAULT_TEST_FORM = {
  title: '',
  description: '',
  duration: 60,
  totalQuestions: 0,
  totalMarks: 100,
  passingMarks: 33,
  negativeMarking: 0.25,
  difficulty: 'Medium',
  type: 'mock',
  tags: '',
  isPro: false,
  isComingSoon: false,
  isLive: false,
}

// Helper Components
const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-yellow-100 text-yellow-700',
    danger: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700'
  }
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
)

const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="text-center py-16 px-4">
    {Icon && <Icon className="w-16 h-16 mx-auto mb-4 text-gray-300" />}
    <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
    <p className="text-gray-500 mb-6">{description}</p>
    {action}
  </div>
)

// Category Tab Bar Component
const CategoryTabBar = ({ activeCategory, onCategoryChange, categoryCounts }) => {
  return (
    <div className="mb-1">
      <div style={{
        display: 'flex',
        gap: '0',
        padding: '3px',
        backgroundColor: '#f1f5f9',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        width: 'fit-content'
      }}>
        {QUESTION_CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.id
          const count = categoryCounts[cat.id] || 0
          const Icon = cat.icon

          return (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '8px 24px',
                borderRadius: '9px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                fontFamily: 'inherit',
                ...(isActive
                  ? {
                    background: '#ffffff',
                    color: cat.id === 'mock-tests' ? '#6366f1' : cat.id === 'pyp' ? '#f59e0b' : '#10b981',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }
                  : {
                    background: 'transparent',
                    color: '#64748b',
                  })
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Icon style={{ width: '16px', height: '16px' }} />
                <span style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.02em',
                  whiteSpace: 'nowrap'
                }}>
                  {cat.label}
                </span>
              </div>
              <span style={{
                fontSize: '15px',
                fontWeight: 800,
                color: isActive ? 'inherit' : '#94a3b8',
                backgroundColor: isActive ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.05)',
                padding: '2px 8px',
                borderRadius: '6px',
                lineHeight: 1
              }}>
                {count}
              </span>
            </button>
          )
        })}
      </div>
      {/* Active category description */}
      <p style={{
        fontSize: '13px',
        color: '#94a3b8',
        marginTop: '8px',
        paddingLeft: '4px'
      }}>
        {QUESTION_CATEGORIES.find(c => c.id === activeCategory)?.description}
      </p>
    </div>
  )
}

// Option Editor Component
const OptionEditor = ({ options, correctOption, onChange, onCorrectChange, type }) => {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F']

  if (type === 'numerical') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Correct Answer (Numerical)
        </label>
        <input
          type="number"
          step="any"
          value={correctOption || ''}
          onChange={(e) => onCorrectChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          placeholder="Enter the numerical answer"
        />
      </div>
    )
  }

  if (type === 'descriptive') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Model Answer
        </label>
        <textarea
          value={correctOption || ''}
          onChange={(e) => onCorrectChange(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          placeholder="Enter the model answer for reference"
        />
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Options <span className="text-red-500">*</span>
        <span className="text-xs text-gray-500 font-normal ml-2">
          (Click the radio button to mark the correct answer)
        </span>
      </label>
      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onCorrectChange(type === 'msq'
                ? (Array.isArray(correctOption)
                  ? correctOption.includes(index)
                    ? correctOption.filter(i => i !== index)
                    : [...correctOption, index]
                  : [index])
                : index
              )}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors
                ${(type === 'msq'
                  ? Array.isArray(correctOption) && correctOption.includes(index)
                  : correctOption === index
                )
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-gray-300 hover:border-indigo-400'}`}
            >
              {(type === 'msq'
                ? Array.isArray(correctOption) && correctOption.includes(index)
                : correctOption === index
              ) && <CheckCircle className="w-4 h-4" />}
            </button>
            <span className="text-sm font-medium text-gray-500 w-6">{letters[index]}</span>
            <input
              type="text"
              value={option}
              onChange={(e) => {
                const newOptions = [...options]
                newOptions[index] = e.target.value
                onChange(newOptions)
              }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder={`Option ${letters[index]}`}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...options, ''])}
        className="mt-3 text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
      >
        <Plus className="w-4 h-4" /> Add Option
      </button>
    </div>
  )
}

// Question Form Modal
const QuestionForm = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  editingId,
  subjects,
  chapters,
  topics,
  passages,
  sections,
  saving,
}) => {
  const [activeTab, setActiveTab] = useState('content')

  useEffect(() => {
    if (isOpen) setActiveTab('content')
  }, [isOpen])

  if (!isOpen) return null

  const tabs = [
    { id: 'content', label: 'Content', icon: FileText },
    { id: 'options', label: 'Options', icon: CheckCircle },
    { id: 'metadata', label: 'Metadata', icon: Settings }
  ]

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const sectionOptions = sections.filter(section => {
    if (!formData.testId) return true
    return String(section.test_id || '') === String(formData.testId) || sectionValueMatches(section, formData.section)
  })
  const selectedSection = sectionOptions.find(section => sectionValueMatches(section, formData.section))
  const selectedSectionValue = selectedSection ? getSectionName(selectedSection) : (formData.section || '')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[96vh] h-[96vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {editingId ? 'Edit Question' : 'Create New Question'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {editingId ? 'Update question details' : 'Add a new question to the bank'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Content Tab */}
            {activeTab === 'content' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question Text <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    value={formData.questionText}
                    onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter your question here..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question Text (Hindi)
                  </label>
                  <textarea
                    value={formData.questionTextHi || ''}
                    onChange={(e) => setFormData({ ...formData, questionTextHi: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="प्रश्न हिंदी में दर्ज करें..."
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    {QUESTION_CATEGORIES.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, category: c.id })}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border-2 transition-all
                          ${formData.category === c.id
                            ? `bg-white ${c.id === 'mock-tests' ? 'border-indigo-500 text-indigo-600' : c.id === 'pyp' ? 'border-amber-500 text-amber-600' : 'border-emerald-500 text-emerald-600'}`
                            : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                      >
                        <c.icon className="w-4 h-4" />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value, chapter: '', topic: '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Subject</option>
                      {subjects.map(s => (
                        <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Question Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({
                        ...formData,
                        type: e.target.value,
                        options: e.target.value === 'mcq' || e.target.value === 'msq'
                          ? ['', '', '', '']
                          : [],
                        correctOption: e.target.value === 'msq' ? [] : 0
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {QUESTION_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Section</label>
                    <select
                      value={selectedSectionValue}
                      onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Section</option>
                      {selectedSectionValue && !selectedSection && (
                        <option value={selectedSectionValue}>{selectedSectionValue}</option>
                      )}
                      {sectionOptions
                        .map(s => (
                          <option key={getSectionId(s)} value={getSectionName(s)}>
                            {getSectionName(s)}{s.test_title ? ` - ${s.test_title}` : ''}
                          </option>
                        ))
                      }
                    </select>
                    {formData.testId && sectionOptions.length === 0 && (
                      <p className="text-xs text-gray-500 mt-1">No sections linked to this test.</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Question Number</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.questionNumber || ''}
                      onChange={(e) => setFormData({ ...formData, questionNumber: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="Auto-assigned if empty"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Chapter</label>
                    <select
                      value={formData.chapter}
                      onChange={(e) => setFormData({ ...formData, chapter: e.target.value, topic: '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      disabled={!formData.subject}
                    >
                      <option value="">Select Chapter</option>
                      {chapters
                        // FIX BUG-012: Filter chapters by subject_id instead of studyMaterialId
                        .filter(c => String(c.subjectId || c.subject_id || c.studyMaterialId) === String(formData.subject))
                        .map(c => (
                          <option key={c._id || c.id} value={c._id || c.id}>{c.title || c.name}</option>
                        ))
                      }
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
                    <select
                      value={formData.topic}
                      onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      disabled={!formData.chapter}
                    >
                      <option value="">Select Topic</option>
                      {topics
                        .filter(t => String(t.chapterId) === String(formData.chapter) || String(t.subjectId) === String(formData.subject))
                        .map(t => (
                          <option key={t._id || t.id} value={t._id || t.id}>{t.name}</option>
                        ))
                      }
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Options Tab */}
            {activeTab === 'options' && (
              <div className="space-y-6">
                <OptionEditor
                  options={formData.options}
                  correctOption={formData.correctOption}
                  onChange={(options) => setFormData({ ...formData, options })}
                  onCorrectChange={(correctOption) => setFormData({ ...formData, correctOption })}
                  type={formData.type}
                />

                {(formData.type === 'mcq' || formData.type === 'msq') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Options (Hindi)
                    </label>
                    <div className="space-y-2">
                      {(formData.optionsHi && formData.optionsHi.length > 0 ? formData.optionsHi : ['', '', '', '']).map((opt, i) => (
                        <input
                          key={i}
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOptsHi = [...(formData.optionsHi || [])]
                            newOptsHi[i] = e.target.value
                            setFormData({ ...formData, optionsHi: newOptsHi })
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          placeholder={`विकल्प ${['A', 'B', 'C', 'D', 'E', 'F'][i]} (हिंदी)`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Explanation
                  </label>
                  <textarea
                    value={formData.explanation}
                    onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Explain the solution (shown after attempting)"
                  />
                </div>
              </div>
            )}

            {/* Metadata Tab */}
            {activeTab === 'metadata' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Difficulty
                    </label>
                    <select
                      value={formData.difficulty}
                      onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {DIFFICULTY_LEVELS.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Marks (+)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={formData.marks}
                      onChange={(e) => setFormData({ ...formData, marks: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Negative Marks (-)
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={formData.negativeMarks}
                      onChange={(e) => setFormData({ ...formData, negativeMarks: parseFloat(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags
                    </label>
                    <input
                      type="text"
                      value={formData.tags?.join(', ') || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="ssc-cgl, tier1, previous-year"
                    />
                    <p className="text-xs text-gray-500 mt-1">Comma-separated tags</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Image URL
                    </label>
                    <input
                      type="text"
                      value={formData.imageUrl || ''}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder="https://example.com/question-image.png"
                    />
                    <p className="text-xs text-gray-500 mt-1">URL to an image displayed with the question</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Passage
                    </label>
                    <select
                      value={formData.passageId || ''}
                      onChange={(e) => setFormData({ ...formData, passageId: e.target.value ? parseInt(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">No passage (standalone question)</option>
                      {passages?.map(p => (
                        <option key={p._id || p.id} value={p._id || p.id}>{p.title || p.name || `Passage #${p._id || p.id}`}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Link this question to a reading passage</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {editingId ? 'Update' : 'Create'} Question
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Question Row Component
const QuestionRow = ({ question, onEdit, onDelete, onToggleStatus, index }) => {
  const [expanded, setExpanded] = useState(false)
  const difficulty = DIFFICULTY_LEVELS.find(d => d.value === question.difficulty) || DIFFICULTY_LEVELS[1]
  const status = STATUS_OPTIONS.find(s => s.value === question.status) || STATUS_OPTIONS[1]
  const type = QUESTION_TYPES.find(t => t.value === question.type) || QUESTION_TYPES[0]
  const letters = ['A', 'B', 'C', 'D', 'E', 'F']

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div
        className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="col-span-1 text-sm text-gray-500 font-mono">{index + 1}</div>
        <div className="col-span-5 min-w-0">
          <p className="text-sm text-gray-900 truncate font-medium">{question.questionText}</p>
          <p className="text-xs text-gray-500 mt-1">
            {question.subject} {question.chapter && `› ${question.chapter}`} {question.topic && `› ${question.topic}`}
          </p>
        </div>
        <div className="col-span-1">
          <Badge variant="info">{type.label}</Badge>
        </div>
        <div className="col-span-1">
          <Badge className={difficulty.color}>{difficulty.label}</Badge>
        </div>
        <div className="col-span-1">
          <Badge className={status.color}>{status.label}</Badge>
        </div>
        <div className="col-span-2 text-sm text-gray-500 text-center">
          <span className="font-medium text-gray-700">+{question.marks}</span>
          {question.negativeMarks > 0 && <span className="text-red-500"> / -{question.negativeMarks}</span>}
        </div>
        <div className="col-span-1 flex items-center justify-end gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(question) }}
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleStatus(question) }}
            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
            title={question.status === 'active' ? 'Deactivate' : 'Activate'}
          >
            {question.status === 'active' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(question._id || question.id) }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Options */}
            {question.options?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Options</h4>
                <div className="space-y-1">
                  {question.options.map((opt, i) => {
                    const isCorrect = Array.isArray(question.correctOption)
                      ? question.correctOption.includes(i)
                      : question.correctOption === i
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                        ${isCorrect
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-white text-gray-700 border border-gray-200'}`}
                      >
                        <span className="font-mono font-medium">{letters[i]}</span>
                        <span>{opt}</span>
                        {isCorrect && <CheckCircle className="w-4 h-4 ml-auto" />}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Explanation */}
            {question.explanation && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Explanation</h4>
                <p className="text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200">
                  {question.explanation}
                </p>
              </div>
            )}

            {/* Tags */}
            {question.tags?.length > 0 && (
              <div className="md:col-span-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {question.tags.map((tag, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Bulk Import Modal
const BulkImportModal = ({ isOpen, onClose, onImport, context, title = 'Bulk Import Questions', expectedColumns = 'question, option1, option2, option3, option4, correct_option, explanation, subject, difficulty' }) => {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) {
      toast.error('Please select a file')
      return
    }

    setUploading(true)
    try {
      await onImport(file)
      setFile(null)
    } catch (err) {
      toast.error(err.message || 'Import failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Upload File (CSV/Excel/JSON)</label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.json"
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Supported formats: CSV, XLSX, XLS, JSON. Max file size: 5MB
            </p>
            <div className="mt-3 bg-gray-50 p-3 rounded-lg">
              <p className="text-xs font-medium text-gray-700 mb-1">Expected CSV columns:</p>
              <code className="text-xs text-gray-500">
                {expectedColumns}
              </code>
            </div>
            {context?.testTitle && (
              <div className="mt-3 bg-indigo-50 border border-indigo-100 p-3 rounded-lg">
                <p className="text-xs font-semibold text-indigo-800">Import target</p>
                <p className="text-sm text-indigo-900 mt-1">{context.testTitle}</p>
                <p className="text-xs text-indigo-700 mt-1">
                  {context.section && context.section !== 'all' ? `Section: ${context.section}` : 'Section will use each row value, or stay blank.'}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {uploading ? 'Importing...' : 'Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Stats Card Component
const StatsCard = ({ icon: Icon, label, value, color = 'indigo' }) => {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600'
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  )
}

// Main Component
export default function QuestionsManager() {
  const {
    categories: examCategories,
    exams: examsFromHook,
    examInfo,
    getSubcategories,
    loading: examFiltersLoading,
  } = useExamCategories()
  const [questions, setQuestions] = useState([])
  const [subjects, setSubjects] = useState([])
  const [chapters, setChapters] = useState([])
  const [topics, setTopics] = useState([])
  const [passages, setPassages] = useState([])
  const [sections, setSections] = useState([])
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [activeCategory, setActiveCategory] = useState('mock-tests')
  const [activeExamCategoryId, setActiveExamCategoryId] = useState('')
  const [activeExamId, setActiveExamId] = useState('')
  const [activeStageId, setActiveStageId] = useState('')
  const [selectedSection, setSelectedSection] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA)

  // Hierarchical drill-down state
  const [testSeriesList, setTestSeriesList] = useState([])
  const [testsList, setTestsList] = useState([])
  const [selectedSeries, setSelectedSeries] = useState(null)
  const [selectedTest, setSelectedTest] = useState(null)
  const [selectedTestSubCategoryId, setSelectedTestSubCategoryId] = useState('all')
  const [showTestForm, setShowTestForm] = useState(false)
  const [editingTestId, setEditingTestId] = useState(null)
  const [testFormData, setTestFormData] = useState(DEFAULT_TEST_FORM)
  const [testSaving, setTestSaving] = useState(false)
  const [showTestBulkUpload, setShowTestBulkUpload] = useState(false)
  const [errors, setErrors] = useState({})

  const [currentPage, setCurrentPage] = useState(1)
  const QUESTIONS_PER_PAGE = 20


  // Bulk import state
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [showActivityLog, setShowActivityLog] = useState(false)

  // Trash view state
  const [showTrash, setShowTrash] = useState(false)
  const [allTestCategories, setAllTestCategories] = useState([])
  const [trashedQuestions, setTrashedQuestions] = useState([])

  // Category counts for tab badges
  const categoryCounts = useMemo(() => {
    const flatCategories = flattenCategories(allTestCategories)
    return QUESTION_CATEGORIES.reduce((acc, category) => {
      const refs = buildTestCategoryRefs(category.id, flatCategories)
      const matchingTestIds = new Set(
        testsList
          .filter(test => recordMatchesTestCategory(test, refs))
          .map(test => String(getTestId(test)))
      )
      acc[category.id] = questions.filter(question =>
        recordMatchesTestCategory(question, refs) ||
        matchingTestIds.has(String(getTestIdFromQuestion(question)))
      ).length
      return acc
    }, {})
  }, [questions, testsList, allTestCategories]);

  // Fetch all data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setErrors({})
        const [questionsRes, subjectsRes, chaptersRes, topicsRes, passagesRes, seriesRes, testsRes, categoriesRes, stagesRes, sectionsRes] = await Promise.allSettled([
          questionsAPI.getAll(),
          adminAPI.apiClient.get('/admin/subjects'),
          adminAPI.apiClient.get('/admin/chapters'),
          adminAPI.apiClient.get('/admin/topics'),
          adminAPI.apiClient.get('/admin/passages'),
          adminAPI.getTestSeries(),
          adminAPI.getTests(),
          adminAPI.getTestCategories(),
          adminAPI.apiClient.get('/stages'),
          adminAPI.apiClient.get('/admin/sections')
        ])

        const newErrors = {}

        if (questionsRes.status === 'fulfilled' && questionsRes.value.data?.success) {
          const rawQuestions = questionsRes.value.data.data || []
          const normalizedQuestions = rawQuestions.map(normalizeQuestion)
          setQuestions(normalizedQuestions)
        } else {
          newErrors.questions = 'Failed to load questions'
        }

        if (subjectsRes.status === 'fulfilled' && subjectsRes.value.data?.success) {
          setSubjects(subjectsRes.value.data.data || [])
        } else {
          newErrors.subjects = 'Failed to load subjects'
        }

        if (chaptersRes.status === 'fulfilled' && chaptersRes.value.data?.success) {
          setChapters(chaptersRes.value.data.data || [])
        } else {
          newErrors.chapters = 'Failed to load chapters'
        }

        if (topicsRes.status === 'fulfilled' && topicsRes.value.data?.success) {
          setTopics(topicsRes.value.data.data || [])
        } else {
          newErrors.topics = 'Failed to load topics'
        }

        if (passagesRes.status === 'fulfilled' && passagesRes.value.data?.success) {
          setPassages(passagesRes.value.data.data || [])
        } else {
          newErrors.passages = 'Failed to load passages'
        }

        if (sectionsRes.status === 'fulfilled' && sectionsRes.value.data?.success) {
          setSections(sectionsRes.value.data.data || [])
        } else {
          newErrors.sections = 'Failed to load sections'
        }

        if (seriesRes.status === 'fulfilled') {
          const seriesData = seriesRes.value.data?.data || seriesRes.value.data || []
          setTestSeriesList(Array.isArray(seriesData) ? seriesData : [])
        } else {
          newErrors.series = 'Failed to load test series'
        }

        if (testsRes.status === 'fulfilled') {
          const testsData = testsRes.value.data?.data || testsRes.value.data || []
          setTestsList(Array.isArray(testsData) ? testsData : [])
        } else {
          newErrors.tests = 'Failed to load tests'
        }

        if (categoriesRes.status === 'fulfilled' && categoriesRes.value.data?.success) {
          setAllTestCategories(categoriesRes.value.data.data || [])
        } else {
          newErrors.categories = 'Failed to load categories'
        }

        if (stagesRes.status === 'fulfilled' && (stagesRes.value.data?.success || Array.isArray(stagesRes.value.data?.data))) {
          setStages(stagesRes.value.data?.data || [])
        } else {
          newErrors.stages = 'Failed to load stages'
        }

        if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors)
          const errorCount = Object.keys(newErrors).length
          toast.error(`Failed to load ${errorCount} data source${errorCount > 1 ? 's' : ''}`)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
        toast.error('Failed to load questions')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const flatTestCategories = useMemo(() => flattenCategories(allTestCategories), [allTestCategories])

  const activeTestCategoryRefs = useMemo(
    () => buildTestCategoryRefs(activeCategory, flatTestCategories),
    [activeCategory, flatTestCategories]
  )

  const activeTestCategoryRecord = useMemo(() => {
    const rootRefs = new Set()
      ;[...(QUESTION_CATEGORY_ALIASES[activeCategory] || [activeCategory]), QUESTION_CAT_TO_TEST_CAT_MAP[activeCategory]]
        .filter(Boolean)
        .forEach(value => {
          rootRefs.add(String(value))
          rootRefs.add(normalizeKey(value))
        })
    return flatTestCategories.find(cat =>
      [cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId]
        .filter(Boolean)
        .some(value => rootRefs.has(String(value)) || rootRefs.has(normalizeKey(value)))
    ) || null
  }, [flatTestCategories, activeCategory])

  const activeTestSubCategories = useMemo(() => {
    if (!activeTestCategoryRecord) return []
    const parentId = String(getEntityId(activeTestCategoryRecord) || '')
    return flatTestCategories
      .filter(cat => String(cat.parentId || cat.parent_id || '') === parentId && cat.isActive !== false)
      .sort((a, b) => (a.displayOrder || a.display_order || 0) - (b.displayOrder || b.display_order || 0))
  }, [activeTestCategoryRecord, flatTestCategories])

  const selectedTestSubCategoryRecord = useMemo(() => {
    if (selectedTestSubCategoryId === 'all') return null
    return flatTestCategories.find(cat =>
      [cat.id, cat._id, cat.categoryId, cat.slug].some(value => idsEqual(value, selectedTestSubCategoryId))
    ) || null
  }, [selectedTestSubCategoryId, flatTestCategories])

  const selectedTestSubCategoryRefs = useMemo(() => {
    if (selectedTestSubCategoryId === 'all') return activeTestCategoryRefs
    return buildCategorySelectionRefs(selectedTestSubCategoryId, flatTestCategories)
  }, [selectedTestSubCategoryId, activeTestCategoryRefs, flatTestCategories])

  const examsForActiveCategory = useMemo(() => {
    if (!activeExamCategoryId) return []
    return getSubcategories(activeExamCategoryId) || []
  }, [activeExamCategoryId, getSubcategories])

  const activeExamCategoryRefs = useMemo(
    () => buildExamCategoryRefs(activeExamCategoryId, examCategories),
    [activeExamCategoryId, examCategories]
  )

  const activeExamRefs = useMemo(
    () => buildExamRefs(activeExamId, examsFromHook, examInfo),
    [activeExamId, examsFromHook, examInfo]
  )

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
    if (!activeExamCategoryId) {
      setActiveExamId('')
      return
    }
    if (examsForActiveCategory.length === 0) {
      setActiveExamId('')
      return
    }
    const stillValid = examsForActiveCategory.some(exam => idsEqual(exam.value, activeExamId))
    if (!stillValid) {
      setActiveExamId(examsForActiveCategory[0].value)
    }
  }, [activeExamCategoryId, examsForActiveCategory, activeExamId])

  useEffect(() => {
    setSelectedSeries(null)
    setSelectedTest(null)
    setCurrentPage(1)
    setSelectedSection('all')
  }, [activeCategory, activeExamCategoryId, activeExamId, activeStageId])

  useEffect(() => {
    setSelectedSection('all')
    setCurrentPage(1)
  }, [selectedTest])

  useEffect(() => {
    setSelectedTestSubCategoryId('all')
    setSelectedTest(null)
    resetTestForm()
    setShowTestBulkUpload(false)
  }, [selectedSeries, activeCategory])

  const testsBySeriesId = useMemo(() => {
    const map = new Map()
    testsList.forEach(test => {
      const seriesId = String(getTestSeriesIdFromTest(test) || '')
      if (!seriesId) return
      if (!map.has(seriesId)) map.set(seriesId, [])
      map.get(seriesId).push(test)
    })
    return map
  }, [testsList])

  const editingTest = useMemo(
    () => testsList.find(test => idsEqual(getTestId(test), editingTestId)) || null,
    [testsList, editingTestId]
  )

  useEffect(() => {
    if (!showTestForm || !editingTestId) return
    if (!editingTest) {
      resetTestForm()
      return
    }
    if (selectedSeries && !idsEqual(getSeriesId(selectedSeries), getTestSeriesIdFromTest(editingTest))) {
      resetTestForm()
    }
  }, [showTestForm, editingTestId, editingTest, selectedSeries])

  const filteredSeriesList = useMemo(() => {
    return testSeriesList.filter(series => {
      const seriesId = String(getSeriesId(series) || '')
      const testsInSeries = testsBySeriesId.get(seriesId) || []

      if (activeExamCategoryRefs.size > 0 && !valueMatchesRefs([getSeriesExamCategoryId(series)], activeExamCategoryRefs)) {
        return false
      }

      if (activeExamRefs.size > 0 && !valueMatchesRefs([getSeriesExamId(series)], activeExamRefs)) {
        return false
      }

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
  }, [testSeriesList, testsBySeriesId, activeExamCategoryRefs, activeExamRefs, activeStageRefs, activeTestCategoryRefs, flatTestCategories])

  const seriesTests = useMemo(() => {
    if (!selectedSeries) return []
    const seriesId = String(getSeriesId(selectedSeries) || '')
    return testsList
      .filter(test => {
        if (!idsEqual(getTestSeriesIdFromTest(test), seriesId)) return false
        if (!recordMatchesTestCategory(test, activeTestCategoryRefs)) return false
        if (activeStageRefs.size > 0 && !valueMatchesRefs([getStageIdFromTest(test)], activeStageRefs)) return false
        return true
      })
      .sort((a, b) => {
        const aOrder = a.orderIndex ?? a.order_index ?? a.order ?? 0
        const bOrder = b.orderIndex ?? b.order_index ?? b.order ?? 0
        return aOrder - bOrder || String(a.title || '').localeCompare(String(b.title || ''))
      })
  }, [selectedSeries, testsList, activeTestCategoryRefs, activeStageRefs])

  const testMatchesSubCategory = (test, category, refs) => {
    if (recordMatchesTestCategory(test, refs)) return true
    const seriesId = getSeriesId(selectedSeries)
    if (!category || !seriesId || !categoryLinksSeries(category, seriesId)) return false
    const matchesExplicitChild = activeTestSubCategories.some(child =>
      recordMatchesTestCategory(test, buildCategorySelectionRefs(getEntityId(child), flatTestCategories))
    )
    return !matchesExplicitChild
  }

  const workspaceTests = useMemo(() => {
    if (selectedTestSubCategoryId === 'all') return seriesTests
    return seriesTests.filter(test => testMatchesSubCategory(test, selectedTestSubCategoryRecord, selectedTestSubCategoryRefs))
  }, [seriesTests, selectedTestSubCategoryId, selectedTestSubCategoryRecord, selectedTestSubCategoryRefs, selectedSeries, activeTestSubCategories, flatTestCategories])

  const testQuestions = useMemo(() => {
    if (!selectedTest) return []
    const testId = String(getTestId(selectedTest) || '')
    return questions
      .filter(q => idsEqual(getTestIdFromQuestion(q), testId))
      .sort((a, b) => {
        const aNumber = Number(a.questionNumber || a.question_number || 0)
        const bNumber = Number(b.questionNumber || b.question_number || 0)
        return aNumber - bNumber || String(getQuestionId(a) || '').localeCompare(String(getQuestionId(b) || ''))
      })
  }, [selectedTest, questions])

  const sectionCounts = useMemo(() => {
    const counts = new Map()
    testQuestions.forEach(question => {
      const section = question.section || 'General'
      counts.set(section, (counts.get(section) || 0) + 1)
    })
    return counts
  }, [testQuestions])

  const filteredTestQuestions = useMemo(() => {
    if (selectedSection === 'all') return testQuestions
    return testQuestions.filter(q => (q.section || 'General') === selectedSection)
  }, [testQuestions, selectedSection])

  // FIX BUG-011: Implement question pagination
  const paginatedQuestions = useMemo(() => {
    const start = (currentPage - 1) * QUESTIONS_PER_PAGE
    return filteredTestQuestions.slice(start, start + QUESTIONS_PER_PAGE)
  }, [filteredTestQuestions, currentPage])
  const totalPages = Math.ceil(filteredTestQuestions.length / QUESTIONS_PER_PAGE)

  // Stats scoped to the active category
  const categoryStats = useMemo(() => {
    const testIdsForActiveCategory = new Set(
      testsList
        .filter(test => recordMatchesTestCategory(test, activeTestCategoryRefs))
        .map(test => String(getTestId(test)))
    )
    const catQuestions = questions.filter(q =>
      recordMatchesTestCategory(q, activeTestCategoryRefs) ||
      testIdsForActiveCategory.has(String(getTestIdFromQuestion(q)))
    )
    return {
      total: catQuestions.length,
      active: catQuestions.filter(q => q.status === 'active').length,
      draft: catQuestions.filter(q => q.status === 'draft').length,
      mcq: catQuestions.filter(q => q.type === 'mcq').length
    }
  }, [questions, testsList, activeTestCategoryRefs])

  // Handlers
  const handleEdit = (question) => {
    const normalizedQ = normalizeQuestion(question)
    const questionOptions = Array.isArray(normalizedQ.options) ? normalizedQ.options : []
    const paddedOptions = questionOptions.length > 0 ? questionOptions : ['', '', '', '']
    const testId = normalizedQ.testId || normalizedQ.test_id || null
    const testSeriesId = normalizedQ.testSeriesId || normalizedQ.test_series_id || null
    setFormData({
      ...DEFAULT_FORM_DATA,
      ...normalizedQ,
      questionTextHi: normalizedQ.questionTextHi || '',
      options: paddedOptions,
      optionsHi: normalizedQ.optionsHi || [],
      tags: normalizedQ.tags || [],
      section: normalizedQ.section || '',
      imageUrl: normalizedQ.imageUrl || '',
      passageId: normalizedQ.passageId || null,
      questionNumber: normalizedQ.questionNumber || null,
      testId: testId,
      testSeriesId: testSeriesId,
    })
    setEditingId(normalizedQ._id || normalizedQ.id)
    setShowForm(true)
  }

  const handleSubmit = async (data) => {
    try {
      setSaving(true)
      // Map frontend field names to backend - FIX BUG-016: No duplicate fields
      const payload = {
        questionText: data.questionText,
        questionTextHi: data.questionTextHi || '',
        type: data.type,
        category: data.category || activeCategory,
        categoryId: activeTestCategoryRecord ? getEntityId(activeTestCategoryRecord) : null,
        subject: data.subject,
        chapter: data.chapter,
        topic: data.topic,
        section: data.section || (selectedSection !== 'all' ? selectedSection : ''),
        difficulty: data.difficulty,
        marks: data.marks,
        negativeMarks: data.negativeMarks,
        options: data.options,
        optionsHi: data.optionsHi || [],
        correctOption: data.type === 'msq' ? data.correctOption : Number(data.correctOption),
        explanation: data.explanation,
        status: data.status,
        tags: data.tags,
        imageUrl: data.imageUrl || '',
        passageId: data.passageId || null,
        questionNumber: data.questionNumber || null,
      }

      // If editing, preserve existing test association from form data
      if (editingId) {
        if (data.testId) {
          payload.testId = data.testId
          payload.test_id = data.testId
        }
        if (data.testSeriesId) {
          payload.testSeriesId = data.testSeriesId
        }
      }
      // If creating from a test drill-down view, associate with that test (+ series for reporting) (Q2)
      else if (selectedTest) {
        const testId = getTestId(selectedTest)
        payload.testId = testId
        payload.test_id = testId
        const sid = selectedTest.testSeriesId ?? selectedTest.test_series_id ?? selectedTest.seriesId ?? selectedTest.series_id
        if (sid != null && sid !== '') {
          payload.testSeriesId = sid
        }
      }

      if (editingId) {
        await adminAPI.updateQuestion(editingId, payload)
        toast.success('Question updated successfully!')
      } else {
        await adminAPI.createQuestion(payload)
        toast.success('Question created successfully!')
      }

      // Refresh questions
      const res = await questionsAPI.getAll()
      if (res.data?.success) {
        const rawQuestions = res.data.data || []
        const normalizedQuestions = rawQuestions.map(normalizeQuestion)
        setQuestions(normalizedQuestions)
      }

      setShowForm(false)
      setEditingId(null)
      setFormData(DEFAULT_FORM_DATA)
    } catch (error) {
      console.error('Failed to save question:', error)
      toast.error('Failed to save question')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('This will move the question to trash. You can restore it later from the trash view.')) return

    try {
      await adminAPI.deleteQuestion(id)
      setQuestions(prev => prev.filter(q => (q._id || q.id) !== id))
      toast.success('Question moved to trash!')
    } catch (error) {
      console.error('Failed to delete question:', error)
      toast.error('Failed to delete question')
    }
  }

  const handleToggleStatus = async (question) => {
    const newStatus = question.status === 'active' ? 'draft' : 'active'

    try {
      await adminAPI.updateQuestion(question._id || question.id, { status: newStatus })
      setQuestions(prev => prev.map(q =>
        (q._id || q.id) === (question._id || question.id)
          ? { ...q, status: newStatus }
          : q
      ))
      toast.success(`Question ${newStatus === 'active' ? 'activated' : 'deactivated'}!`)
    } catch (error) {
      console.error('Failed to toggle status:', error)
      toast.error('Failed to update status')
    }
  }

  const resetForm = () => {
    setFormData({
      ...DEFAULT_FORM_DATA,
      category: activeCategory,
      section: selectedSection !== 'all' ? selectedSection : ''
    })
    setEditingId(null)
    setShowForm(false)
  }

  const refreshTests = async () => {
    const testsRes = await adminAPI.getTests()
    const testsData = testsRes.data?.data || testsRes.data || []
    setTestsList(Array.isArray(testsData) ? testsData : [])
  }

  const getLinkedTestCategoryId = () => {
    if (selectedTestSubCategoryId !== 'all') return selectedTestSubCategoryId
    return activeTestCategoryRecord ? getEntityId(activeTestCategoryRecord) : null
  }

  const resetTestForm = () => {
    setTestFormData(DEFAULT_TEST_FORM)
    setEditingTestId(null)
    setShowTestForm(false)
  }

  const openCreateTestForm = () => {
    const type = activeCategory === 'pyp' ? 'pyp' : activeCategory === 'practice' ? 'practice' : 'mock'
    setTestFormData({ ...DEFAULT_TEST_FORM, type })
    setEditingTestId(null)
    setShowTestForm(true)
  }

  const openEditTestForm = (test) => {
    setTestFormData({
      ...DEFAULT_TEST_FORM,
      title: test.title || test.name || '',
      description: test.description || '',
      duration: test.duration || test.time_limit || 60,
      totalQuestions: test.totalQuestions || test.total_questions || 0,
      totalMarks: test.totalMarks || test.total_marks || 100,
      passingMarks: test.passingMarks || test.passing_marks || 33,
      negativeMarking: test.negativeMarking || test.negative_marking || 0.25,
      difficulty: test.difficulty || 'Medium',
      type: test.type || (activeCategory === 'pyp' ? 'pyp' : activeCategory === 'practice' ? 'practice' : 'mock'),
      tags: Array.isArray(test.tags) ? test.tags.join(', ') : (test.tags || ''),
      isPro: Boolean(test.isPro || test.is_pro),
      isComingSoon: Boolean(test.isComingSoon || test.is_coming_soon),
      isLive: Boolean(test.isLive || test.is_live),
    })
    setEditingTestId(getTestId(test))
    setShowTestForm(true)
  }

  const handleTestSubmit = async (event) => {
    event.preventDefault()
    if (!selectedSeries) return
    try {
      setTestSaving(true)
      const seriesId = editingTest ? (getTestSeriesIdFromTest(editingTest) || getSeriesId(selectedSeries)) : getSeriesId(selectedSeries)
      const testCategoryId = getLinkedTestCategoryId()
      const baseSlug = (testFormData.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      const payload = {
        title: testFormData.title,
        description: testFormData.description,
        slug: editingTestId ? undefined : `${baseSlug}-${Date.now()}`,
        test_series_id: seriesId,
        stage_id: editingTest ? (getStageIdFromTest(editingTest) || activeStageId || null) : (activeStageId || null),
        category: getSeriesExamCategoryId(selectedSeries) || activeExamCategoryId || '',
        exam_id: getSeriesExamId(selectedSeries) || activeExamId || null,
        test_category_id: testCategoryId,
        type: testFormData.type,
        duration: Number(testFormData.duration) || 60,
        total_questions: Number(testFormData.totalQuestions) || 0,
        total_marks: Number(testFormData.totalMarks) || 0,
        passing_marks: Number(testFormData.passingMarks) || 0,
        negative_marking: Number(testFormData.negativeMarking) || 0,
        difficulty: testFormData.difficulty,
        is_pro: Boolean(testFormData.isPro),
        is_coming_soon: Boolean(testFormData.isComingSoon),
        is_live: Boolean(testFormData.isLive),
        tags: testFormData.tags ? testFormData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
      }
      // Remove undefined and null values for optional ID and string fields to avoid validation errors
      Object.keys(payload).forEach(key => {
        if ((key === 'slug' || key.endsWith('_id') || key === 'category') && (payload[key] === undefined || payload[key] === null || payload[key] === '')) {
          delete payload[key]
        }
      })

      if (editingTestId) {
        await adminAPI.updateTest(editingTestId, payload)
        toast.success('Test updated successfully')
      } else {
        await adminAPI.createTest(payload)
        toast.success('Test created successfully')
      }
      resetTestForm()
      await refreshTests()
    } catch (error) {
      console.error('Failed to save test:', error)

      // Extract validation errors if present
      const validationErrors = error.response?.data?.error?.errors
      if (validationErrors && Array.isArray(validationErrors) && validationErrors.length > 0) {
        const errorMessages = validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')
        toast.error(`Validation error: ${errorMessages}`)
      } else {
        toast.error(error.response?.data?.message || error.message || 'Failed to save test')
      }
    } finally {
      setTestSaving(false)
    }
  }

  const handleTestBulkUpload = async (file) => {
    if (!selectedSeries) return
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('test_series_id', String(getSeriesId(selectedSeries)))
      formData.append('category', String(getSeriesExamCategoryId(selectedSeries) || activeExamCategoryId || ''))
      formData.append('exam_id', String(getSeriesExamId(selectedSeries) || activeExamId || ''))
      if (activeStageId) formData.append('stage_id', String(activeStageId))
      const testCategoryId = getLinkedTestCategoryId()
      if (testCategoryId) formData.append('test_category_id', String(testCategoryId))
      const response = await adminAPI.bulkUploadTests(formData)
      const count = response.data?.data?.length || response.data?.count || 0
      const skipped = response.data?.skipped || 0
      toast.success(`${count} tests uploaded successfully${skipped > 0 ? `, ${skipped} skipped` : ''}`)
      setShowTestBulkUpload(false)
      await refreshTests()
    } catch (error) {
      console.error('Bulk test upload failed:', error)
      toast.error(error.response?.data?.message || 'Failed to upload tests')
    }
  }

  // Bulk Import handler
  const handleBulkImport = async (file) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('category', activeCategory)
      if (activeTestCategoryRecord) {
        formData.append('categoryId', String(getEntityId(activeTestCategoryRecord)))
      }
      if (selectedTest) {
        const testId = getTestId(selectedTest)
        formData.append('testId', String(testId))
        const sid = getTestSeriesIdFromTest(selectedTest)
        if (sid) formData.append('testSeriesId', String(sid))
      } else if (selectedSeries) {
        const sid = getSeriesId(selectedSeries)
        if (sid) formData.append('testSeriesId', String(sid))
      }
      if (selectedSection !== 'all') {
        formData.append('section', selectedSection)
      }

      const response = await adminAPI.bulkUploadQuestions(formData)
      const count = response.data?.data?.length || response.data?.count || 0
      const skipped = response.data?.skipped || 0

      toast.success(`${count} questions uploaded successfully! ${skipped > 0 ? `${skipped} rows skipped.` : ''}`)
      setShowBulkImport(false)

      // Refresh questions
      const res = await questionsAPI.getAll()
      if (res.data?.success) {
        const rawQuestions = res.data.data || []
        setQuestions(rawQuestions.map(normalizeQuestion))
      }
    } catch (err) {
      console.error('Bulk import failed:', err)
      throw new Error(err.response?.data?.message || 'Import failed')
    }
  }

  // Export handler
  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedTest) params.append('testId', selectedTest._id || selectedTest.id)
      params.append('category', activeCategory)
      const response = await adminAPI.apiClient.get(`/admin/questions/export?${params.toString()}`, {
        responseType: 'blob'
      })

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `questions_export_${Date.now()}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('Questions exported successfully!')
    } catch (err) {
      console.error('Export failed:', err)
      toast.error('Failed to export questions')
    }
  }

  // Load trashed questions
  const loadTrashedQuestions = async () => {
    try {
      const res = await adminAPI.apiClient.get('/admin/trash')
      if (res.data?.success) {
        const items = res.data.data || []
        setTrashedQuestions(items.filter(item => item.collection === 'questions' || item.table_name === 'questions'))
      }
    } catch (err) {
      console.error('Failed to load trash:', err)
    }
  }

  // Restore question from trash
  const handleRestoreQuestion = async (id) => {
    try {
      await adminAPI.apiClient.put(`/admin/questions/${id}/restore`)
      toast.success('Question restored!')
      await loadTrashedQuestions()
      // Refresh active questions
      const res = await questionsAPI.getAll()
      if (res.data?.success) {
        setQuestions(res.data.data.map(q => ({
          ...q,
          questionText: q.questionText || q.question_text || '',
          questionTextHi: q.questionTextHi || '',
          // FIX BUG-016: Remove duplicate snake_case field access
          correctOption: q.correctOption ?? 0,
          negativeMarks: q.negativeMarks ?? 0,
          options: Array.isArray(q.options) ? q.options : [],
          optionsHi: q.optionsHi || q.options_hi || [],
          category: q.category || 'mock-tests',
          section: q.section || '',
          passageId: q.passageId || q.passage_id || null,
          questionNumber: q.questionNumber || q.question_number || null,
          imageUrl: q.imageUrl || q.image_url || '',
        })))
      }
    } catch (err) {
      console.error('Restore failed:', err)
      toast.error('Failed to restore question')
    }
  }

  const handleCategoryChange = (categoryId) => {
    setActiveCategory(categoryId)
    setSelectedSeries(null)
    setSelectedTest(null)
    setSelectedSection('all')
  }

  const auditQuestions = useMemo(() => {
    if (activeCategory !== 'audit') return []
    return questions.filter(q => {
      const isDraft = q.status === 'draft' || q.status === 'Inactive' || q.status === 'Draft' || !q.isActive
      const noText = !q.questionText || String(q.questionText).trim() === ''
      const noOptions = !q.options || q.options.length < 2 || q.options.some(o => !o || String(o).trim() === '')
      const noCorrect = q.correctOption === null || q.correctOption === undefined || q.correctOption === ''
      return isDraft || noText || noOptions || noCorrect
    })
  }, [questions, activeCategory])

  if (loading) {
    return <LoadingSpinner />
  }

  const hasErrors = Object.keys(errors).length > 0
  const hasNoQuestions = questions.length === 0 && !hasErrors

  if (hasNoQuestions) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-center">
          <p className="text-amber-800 dark:text-amber-200">No questions found. Create your first question or import from CSV.</p>
        </div>
      </div>
    )
  }

  // Breadcrumb labels
  const activeCatLabel = QUESTION_CATEGORIES.find(c => c.id === activeCategory)?.label || 'Questions'

  const selectedExamCategoryLabel = examCategories.find(category => idsEqual(category.categoryId || category.slug || category.id, activeExamCategoryId))?.label || activeExamCategoryId || 'Select exam category'
  const selectedExamLabel = examsForActiveCategory.find(exam => idsEqual(exam.value, activeExamId))?.label || activeExamId || 'Select exam'
  const selectedStageLabel = stages.find(stage => idsEqual(getEntityId(stage), activeStageId))?.name || (activeStageId ? activeStageId : 'All Stages')

  const drillLevel = activeCategory === 'audit' ? 'audit' : selectedTest ? 'questions' : selectedSeries ? 'tests' : 'series'


  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-indigo-600" />
            Questions Manager
          </h1>
          <p className="text-gray-600 mt-1">Manage your question bank with {questions.length} questions</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowActivityLog(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Activity className="w-4 h-4" />
            Activity Log
          </button>
          <button
            onClick={() => { setShowTrash(!showTrash); if (!showTrash) loadTrashedQuestions() }}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${showTrash ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-300 hover:bg-gray-50'}`}
          >
            <ClipboardList className="w-4 h-4" />
            {showTrash ? 'Back to Questions' : 'Trash'}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      {!showTrash && (
        <CategoryTabBar
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          categoryCounts={categoryCounts}
        />
      )}

      {/* Stats */}
      {!showTrash && (
        <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard icon={FileText} label="Total Questions" value={categoryStats.total.toLocaleString()} color="indigo" />
          <StatsCard icon={CheckCircle} label="Active" value={categoryStats.active.toLocaleString()} color="green" />
          <StatsCard icon={Clock} label="Drafts" value={categoryStats.draft.toLocaleString()} color="yellow" />
          <StatsCard icon={Hash} label="MCQ Questions" value={categoryStats.mcq.toLocaleString()} color="purple" />
        </div>
      )}

      {showTrash && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Trashed Questions</h2>
            <p className="text-sm text-gray-500 mt-1">{trashedQuestions.length} questions in trash</p>
          </div>
          {trashedQuestions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Trash2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Trash is empty</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {trashedQuestions.map((item, idx) => (
                <div key={item.id || idx} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-md">
                      {item.data?.questionText || item.data?.question_text || `Question #${item.id}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Deleted: {item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRestoreQuestion(item.id)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Exam hierarchy filters */}
      {!showTrash && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
          <div className="p-4 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Manager Filters</h3>
              {examFiltersLoading && <span className="text-xs text-gray-400">Loading exam data...</span>}
            </div>

            <div className="flex flex-col gap-4">
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
                      onClick={() => {
                        setActiveExamCategoryId(categoryValue)
                        setActiveExamId('')
                        setActiveStageId('')
                      }}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${isActive
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
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
                ) : examsForActiveCategory.map(exam => {
                  const isActive = idsEqual(activeExamId, exam.value)
                  return (
                    <button
                      key={exam.value}
                      onClick={() => {
                        setActiveExamId(exam.value)
                        setActiveStageId('')
                      }}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${isActive
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                    >
                      {exam.label || exam.fullName || exam.value}
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-gray-700">Stage:</span>
                <button
                  onClick={() => setActiveStageId('')}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${!activeStageId
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}
                >
                  All Stages
                </button>
                {stagesForActiveExam.map(stage => {
                  const stageId = getEntityId(stage)
                  const isActive = idsEqual(activeStageId, stageId)
                  return (
                    <button
                      key={stageId}
                      onClick={() => setActiveStageId(stageId)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${isActive
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                    >
                      {stage.name || stage.title || stage.slug || stageId}
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Selected Path</span>
                <span className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">{selectedExamCategoryLabel}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                <span className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">{selectedExamLabel}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                <span className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">{selectedSeries?.title || selectedSeries?.name || `${filteredSeriesList.length} series`}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                <span className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">{selectedStageLabel}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-xs font-semibold text-indigo-700">{activeCatLabel}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                <span className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">{selectedTestSubCategoryRecord?.name || selectedTestSubCategoryRecord?.label || 'All test subcategories'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {!showTrash && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Test Series</h2>
            <p className="text-sm text-gray-500">
              {filteredSeriesList.length} series match the current exam and stage selection.
            </p>
          </div>
        </div>
      )}

      {/* ===== LEVEL 0: Audit ===== */}
      {!showTrash && drillLevel === 'audit' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 bg-rose-50/30 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-900 text-rose-900">Incomplete Audit Questions</h2>
              <p className="text-sm text-gray-500 mt-1">Found {auditQuestions.length} questions that require review</p>
            </div>
          </div>
          {auditQuestions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
              <p className="font-medium text-green-700">All questions look good!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {auditQuestions.map(q => (
                <div key={q.id || q._id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{q.questionText || q.question_text || 'No Question Text'}</p>
                    <div className="mt-2 flex gap-2">
                      {(!q.questionText || String(q.questionText).trim() === '') && <Badge variant="danger">Missing Text</Badge>}
                      {(!q.options || q.options.length < 2 || q.options.some(o => !o || String(o).trim() === '')) && <Badge variant="warning">Missing Options</Badge>}
                      {(q.correctOption === null || q.correctOption === undefined || q.correctOption === '') && <Badge variant="warning">Missing Mark Scheme</Badge>}
                      {(q.status === 'draft' || q.status === 'Inactive' || q.status === 'Draft' || !q.isActive) && <Badge variant="default">Draft Status</Badge>}
                    </div>
                  </div>
                  <div className="ml-4">
                    <button onClick={() => handleEdit(q)} className="p-2 border rounded-md text-indigo-600 hover:bg-indigo-50"><Edit2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== LEVEL 1: Test Series Grid (filtered by active category) ===== */}
      {!showTrash && drillLevel === 'series' && (
        <div className="flex flex-col gap-3">
          {filteredSeriesList.length > 0 ? filteredSeriesList.map(series => {
            const seriesId = getSeriesId(series)
            const testsCount = testsList.filter(t => {
              const tSeriesId = getTestSeriesIdFromTest(t)
              return idsEqual(tSeriesId, seriesId)
            }).length
            const questionsCount = questions.filter(q => {
              const qSeries = getTestSeriesIdFromQuestion(q)
              if (idsEqual(qSeries, seriesId)) return true
              const qTestId = getTestIdFromQuestion(q)
              return testsList.some(t => idsEqual(getTestId(t), qTestId) && idsEqual(getTestSeriesIdFromTest(t), seriesId))
            }).length

            return (
              <div
                key={seriesId}
                onClick={() => setSelectedSeries(series)}
                className="group bg-white border border-gray-200 rounded-xl cursor-pointer transition-all p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden hover:border-indigo-300 hover:shadow-md"
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none'
                }}
              >
                {/* Top gradient accent */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: 'linear-gradient(to right, #6366f1, #8b5cf6)',
                  borderRadius: '16px 16px 0 0'
                }} />
                <div className="flex items-start gap-4 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <FolderOpen style={{ width: '22px', height: '22px', color: '#6366f1' }} />
                  </div>
                  <div className="min-w-0 flex-1">

                    <h3 style={{
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#1e293b',
                      marginBottom: '6px',
                      lineHeight: 1.3
                    }}>
                      {series.title || series.name || 'Untitled Series'}
                    </h3>

                    <p style={{
                      fontSize: '13px',
                      color: '#94a3b8',
                      marginBottom: '16px',
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {series.description || 'No description available'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '8px'
                  }}>
                    <List style={{ width: '14px', height: '14px', color: '#6366f1' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>{testsCount} tests</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '8px'
                  }}>
                    <FileText style={{ width: '14px', height: '14px', color: '#16a34a' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#166534' }}>{questionsCount} Qs</span>
                  </div>
                  {series.category && (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '4px 10px',
                      backgroundColor: '#faf5ff',
                      color: '#7c3aed',
                      borderRadius: '8px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {series.category}
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 hidden md:block" />
                </div>
              </div>
            )
          }) : (
            <div style={{ gridColumn: '1 / -1' }}>
              <EmptyState
                icon={FolderOpen}
                title="No Test Series Found"
                description="No test series match the selected test category, exam category, exam, and stage filters."
              />
            </div>
          )}
        </div>
      )}

      {/* ===== LEVEL 2: Test Listing ===== */}
      {drillLevel === 'tests' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {seriesTests.length > 0 ? seriesTests.map(test => {
            const testId = getTestId(test)
            const qCount = questions.filter(q => {
              const qTestId = getTestIdFromQuestion(q)
              return idsEqual(qTestId, testId)
            }).length
            const activeCount = questions.filter(q => {
              const qTestId = getTestIdFromQuestion(q)
              return idsEqual(qTestId, testId) && q.status === 'active'
            }).length
            const isPublished = test.status === 'published' || test.status === 'active'

            return (
              <div
                key={testId}
                onClick={() => setSelectedTest(test)}
                style={{
                  padding: '20px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#a78bfa'
                  e.currentTarget.style.boxShadow = '0 6px 20px -4px rgba(139, 92, 246, 0.15)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.transform = 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: qCount > 0
                      ? 'linear-gradient(135deg, #dcfce7, #bbf7d0)'
                      : 'linear-gradient(135deg, #fef3c7, #fde68a)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <FileText style={{ width: '20px', height: '20px', color: qCount > 0 ? '#16a34a' : '#d97706' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: isPublished ? '#22c55e' : '#94a3b8'
                    }} />
                    <ChevronRight style={{ width: '18px', height: '18px', color: '#cbd5e1' }} />
                  </div>
                </div>

                <h3 style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#1e293b',
                  marginBottom: '4px',
                  lineHeight: 1.3
                }}>
                  {test.title || test.name || 'Untitled Test'}
                </h3>

                {test.description && (
                  <p style={{
                    fontSize: '13px',
                    color: '#94a3b8',
                    marginBottom: '14px',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {test.description}
                  </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: test.description ? '0' : '14px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '3px 10px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    borderRadius: '6px'
                  }}>
                    {qCount} questions
                  </span>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '3px 10px',
                    backgroundColor: activeCount > 0 ? '#f0fdf4' : '#fef2f2',
                    color: activeCount > 0 ? '#166534' : '#991b1b',
                    borderRadius: '6px'
                  }}>
                    {activeCount} active
                  </span>
                  {(test.duration || test.time_limit) && (
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '3px 10px',
                      backgroundColor: '#eff6ff',
                      color: '#1e40af',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Clock style={{ width: '12px', height: '12px' }} />
                      {test.duration || test.time_limit} min
                    </span>
                  )}
                </div>
              </div>
            )
          }) : (
            <div style={{ gridColumn: '1 / -1' }}>
              <EmptyState
                icon={FileText}
                title="No Tests in this Series"
                description={`No tests found in "${selectedSeries?.title || selectedSeries?.name || 'this series'}". Create a test first.`}
              />
            </div>
          )}
        </div>
      )}

      {/* ===== LEVEL 3: Question Detail Cards ===== */}
      {drillLevel === 'questions' && (
        <div>
          <div className="mb-4 bg-white border border-gray-200 rounded-xl p-3 flex gap-2 overflow-x-auto">
            <button
              onClick={() => {
                setSelectedSection('all')
                setCurrentPage(1)
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedSection === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              All Sections ({testQuestions.length})
            </button>
            {[...sectionCounts.entries()].map(([section, count]) => (
              <button
                key={section}
                onClick={() => {
                  setSelectedSection(section)
                  setCurrentPage(1)
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedSection === section
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                {section} ({count})
              </button>
            ))}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            padding: '12px 16px',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}>
            <span style={{ fontSize: '14px', color: '#64748b' }}>
              <strong style={{ color: '#1e293b' }}>{filteredTestQuestions.length}</strong> questions
              {selectedSection !== 'all' ? ` in ${selectedSection}` : ' in this test'}
            </span>
            <button
              onClick={() => { resetForm(); setShowForm(true) }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                fontFamily: 'inherit',
                transition: 'background-color 0.15s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366f1'}
            >
              <Plus style={{ width: '16px', height: '16px' }} />
              Add Question
            </button>
          </div>

          {filteredTestQuestions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {paginatedQuestions.map((q, idx) => {
                // Calculate actual index for question number display
                const actualIdx = (currentPage - 1) * QUESTIONS_PER_PAGE + idx
                const difficulty = DIFFICULTY_LEVELS.find(d => d.value === q.difficulty) || DIFFICULTY_LEVELS[1]
                const status = STATUS_OPTIONS.find(s => s.value === q.status) || STATUS_OPTIONS[1]
                const type = QUESTION_TYPES.find(t => t.value === q.type) || QUESTION_TYPES[0]
                const letters = ['A', 'B', 'C', 'D', 'E', 'F']

                return (
                  <div
                    key={q._id || q.id || idx}
                    style={{
                      padding: '20px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '14px',
                      transition: 'border-color 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
                  >
                    {/* Question header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          backgroundColor: '#eef2ff',
                          color: '#6366f1',
                          fontSize: '13px',
                          fontWeight: 700
                        }}>
                          {actualIdx + 1}
                        </span>
                        <Badge variant="info">{type.label}</Badge>
                        <Badge className={difficulty.color}>{difficulty.label}</Badge>
                        <Badge className={status.color}>{status.label}</Badge>
                        {q.marks && (
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            <strong style={{ color: '#059669' }}>+{q.marks}</strong>
                            {q.negativeMarks > 0 && <span style={{ color: '#dc2626' }}> / -{q.negativeMarks}</span>}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <button
                          onClick={() => handleEdit(q)}
                          style={{
                            padding: '6px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eef2ff'; e.currentTarget.style.color = '#6366f1' }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8' }}
                          title="Edit"
                        >
                          <Edit2 style={{ width: '16px', height: '16px' }} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(q)}
                          style={{
                            padding: '6px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f0fdf4'; e.currentTarget.style.color = '#16a34a' }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8' }}
                          title={q.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          {q.status === 'active' ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                        </button>
                        <button
                          onClick={() => handleDelete(q._id || q.id)}
                          style={{
                            padding: '6px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; e.currentTarget.style.color = '#dc2626' }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#94a3b8' }}
                          title="Delete"
                        >
                          <Trash2 style={{ width: '16px', height: '16px' }} />
                        </button>
                      </div>
                    </div>

                    {/* Question text */}
                    <p style={{
                      fontSize: '15px',
                      color: '#1e293b',
                      lineHeight: 1.6,
                      marginBottom: q.options?.length > 0 ? '16px' : '0'
                    }}>
                      {q.questionText}
                    </p>

                    {/* Options */}
                    {q.options?.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', marginBottom: q.explanation ? '14px' : '0' }}>
                        {q.options.map((opt, oi) => {
                          const isCorrect = Array.isArray(q.correctOption)
                            ? q.correctOption.includes(oi)
                            : q.correctOption === oi

                          return (
                            <div
                              key={oi}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '10px 14px',
                                borderRadius: '10px',
                                border: `1px solid ${isCorrect ? '#86efac' : '#f1f5f9'}`,
                                backgroundColor: isCorrect ? '#f0fdf4' : '#f8fafc',
                                fontSize: '14px',
                                color: isCorrect ? '#166534' : '#475569'
                              }}
                            >
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: isCorrect ? '#22c55e' : '#e2e8f0',
                                color: isCorrect ? '#fff' : '#64748b',
                                fontSize: '12px',
                                fontWeight: 700,
                                flexShrink: 0
                              }}>
                                {isCorrect ? '✓' : letters[oi]}
                              </span>
                              <span>{opt}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Explanation */}
                    {q.explanation && (
                      <div style={{
                        padding: '12px 16px',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: '10px',
                        fontSize: '13px',
                        color: '#92400e',
                        lineHeight: 1.5
                      }}>
                        <strong style={{ display: 'block', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#b45309' }}>
                          Explanation
                        </strong>
                        {q.explanation}
                      </div>
                    )}

                    {/* Tags & Metadata footer */}
                    {(q.subject || q.tags?.length > 0) && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginTop: '14px',
                        paddingTop: '12px',
                        borderTop: '1px solid #f1f5f9',
                        flexWrap: 'wrap'
                      }}>
                        {q.subject && (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            backgroundColor: '#f5f3ff',
                            color: '#7c3aed',
                            borderRadius: '6px'
                          }}>
                            {q.subjectName || q.subject}
                          </span>
                        )}
                        {q.chapter && (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            padding: '3px 8px',
                            backgroundColor: '#f1f5f9',
                            color: '#64748b',
                            borderRadius: '6px'
                          }}>
                            {q.chapter}
                          </span>
                        )}
                        {q.tags?.map((tag, ti) => (
                          <span key={ti} style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            padding: '3px 8px',
                            backgroundColor: '#f1f5f9',
                            color: '#64748b',
                            borderRadius: '6px'
                          }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '20px',
                  padding: '16px',
                  backgroundColor: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0'
                }}>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>
                    Showing {(currentPage - 1) * QUESTIONS_PER_PAGE + 1} - {Math.min(currentPage * QUESTIONS_PER_PAGE, filteredTestQuestions.length)} of {filteredTestQuestions.length} questions
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        opacity: currentPage === 1 ? 0.5 : 1,
                        fontSize: '13px',
                        color: '#374151'
                      }}
                    >
                      First
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        opacity: currentPage === 1 ? 0.5 : 1,
                        fontSize: '13px',
                        color: '#374151'
                      }}
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          style={{
                            width: '32px',
                            height: '32px',
                            backgroundColor: currentPage === pageNum ? '#6366f1' : '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: currentPage === pageNum ? 700 : 500,
                            color: currentPage === pageNum ? '#fff' : '#374151'
                          }}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        opacity: currentPage === totalPages ? 0.5 : 1,
                        fontSize: '13px',
                        color: '#374151'
                      }}
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        opacity: currentPage === totalPages ? 0.5 : 1,
                        fontSize: '13px',
                        color: '#374151'
                      }}
                    >
                      Last
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No Questions in this Test"
              description={`"${selectedTest?.title || selectedTest?.name || 'This test'}" has no questions yet. Add your first question.`}
              action={
                <button
                  onClick={() => { resetForm(); setShowForm(true) }}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Question
                </button>
              }
            />
          )}
        </div>
      )}

      {selectedSeries && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white w-full max-w-6xl max-h-[92vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-4 bg-gray-50">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-gray-900 truncate">{selectedSeries.title || selectedSeries.name || 'Test Series'}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span className="px-2 py-1 bg-white border border-gray-200 rounded">{selectedExamCategoryLabel}</span>
                  <ChevronRight className="w-3 h-3 text-gray-300" />
                  <span className="px-2 py-1 bg-white border border-gray-200 rounded">{selectedExamLabel}</span>
                  <ChevronRight className="w-3 h-3 text-gray-300" />
                  <span className="px-2 py-1 bg-white border border-gray-200 rounded">{selectedStageLabel}</span>
                  <ChevronRight className="w-3 h-3 text-gray-300" />
                  <span className="px-2 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold rounded">{activeCatLabel}</span>
                </div>
              </div>
              <button
                onClick={() => { setSelectedSeries(null); setSelectedTest(null); resetTestForm() }}
                className="p-2 hover:bg-gray-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-b border-gray-200 p-3 flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1 shrink-0">Test Subcategory</span>
              <button
                onClick={() => { setSelectedTestSubCategoryId('all'); setSelectedTest(null) }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${selectedTestSubCategoryId === 'all'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
              >
                All ({seriesTests.length})
              </button>
              {activeTestSubCategories.map(category => {
                const categoryId = getEntityId(category)
                const refs = buildCategorySelectionRefs(categoryId, flatTestCategories)
                const count = seriesTests.filter(test => testMatchesSubCategory(test, category, refs)).length
                return (
                  <button
                    key={categoryId}
                    onClick={() => { setSelectedTestSubCategoryId(categoryId); setSelectedTest(null) }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap border ${idsEqual(selectedTestSubCategoryId, categoryId)
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                  >
                    {category.name || category.label || category.slug || categoryId} ({count})
                  </button>
                )
              })}
              {activeTestSubCategories.length === 0 && (
                <span className="text-sm text-gray-400 px-2">No child categories under {activeCatLabel}</span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50/40">
              {!selectedTest ? (
                <div>
                  <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-gray-900">Tests</h3>
                      <p className="text-sm text-gray-500">{workspaceTests.length} tests linked to the selected test subcategory.</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowTestBulkUpload(true)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Bulk Create
                      </button>
                      <button onClick={openCreateTestForm} className="px-3 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Create Test
                      </button>
                    </div>
                  </div>

                  {workspaceTests.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="No Tests Linked"
                      description="Create a test or bulk upload tests for this series and selected test subcategory."
                    />
                  ) : (
                    <div className="flex flex-col gap-3">
                      {workspaceTests.map(test => {
                        const testId = getTestId(test)
                        const qCount = questions.filter(q => idsEqual(getTestIdFromQuestion(q), testId)).length
                        return (
                          <div
                            key={testId}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedTest(test)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                setSelectedTest(test)
                              }
                            }}
                            className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap gap-2 mb-2">
                                <Badge variant={test.status === 'active' || test.status === 'published' ? 'success' : 'default'}>{test.status || 'draft'}</Badge>
                                <Badge variant="info">{test.type || activeCategory}</Badge>
                              </div>
                              <h4 className="font-bold text-gray-900 truncate">{test.title || test.name || 'Untitled Test'}</h4>
                              <p className="text-xs text-gray-500 mt-1 truncate">{test.description || 'No description'}</p>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600 shrink-0">
                              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{test.duration || test.time_limit || '--'} min</span>
                              <span className="flex items-center gap-1"><FileText className="w-4 h-4" />{qCount} Qs</span>
                              <button
                                type="button"
                                onClick={(event) => { event.stopPropagation(); openEditTestForm(test) }}
                                className="p-2 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <ChevronRight className="w-5 h-5 text-gray-300" />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <button
                    onClick={() => setSelectedTest(null)}
                    className="mb-4 inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back to Tests
                  </button>
                  <div className="mb-4 bg-white border border-gray-200 rounded-xl p-3 flex gap-2 overflow-x-auto">
                    <button
                      onClick={() => { setSelectedSection('all'); setCurrentPage(1) }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${selectedSection === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      All Sections ({testQuestions.length})
                    </button>
                    {[...sectionCounts.entries()].map(([section, count]) => (
                      <button
                        key={section}
                        onClick={() => { setSelectedSection(section); setCurrentPage(1) }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${selectedSection === section ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {section} ({count})
                      </button>
                    ))}
                  </div>

                  <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-gray-900">{selectedTest.title || selectedTest.name || 'Test'}</h3>
                      <p className="text-sm text-gray-500">{filteredTestQuestions.length} questions in current section.</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowBulkImport(true)} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Bulk Questions
                      </button>
                      <button onClick={() => { resetForm(); setShowForm(true) }} className="px-3 py-2 bg-indigo-600 rounded-lg text-sm font-medium text-white hover:bg-indigo-700 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Add Question
                      </button>
                    </div>
                  </div>

                  {filteredTestQuestions.length === 0 ? (
                    <EmptyState icon={FileText} title="No Questions in this Test" description="Add or bulk upload questions for this test." />
                  ) : (
                    <div className="space-y-3">
                      {paginatedQuestions.map((q, idx) => (
                        <div key={getQuestionId(q) || idx} className="bg-white border border-gray-200 rounded-xl p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 inline-flex items-center justify-center text-xs font-bold">{(currentPage - 1) * QUESTIONS_PER_PAGE + idx + 1}</span>
                                <Badge variant="info">{q.type || 'mcq'}</Badge>
                                <Badge className={(DIFFICULTY_LEVELS.find(d => d.value === q.difficulty) || DIFFICULTY_LEVELS[1]).color}>{q.difficulty || 'medium'}</Badge>
                                <Badge className={(STATUS_OPTIONS.find(s => s.value === q.status) || STATUS_OPTIONS[1]).color}>{q.status || 'draft'}</Badge>
                              </div>
                              <p className="text-sm text-gray-900 line-clamp-3">{q.questionText}</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => handleEdit(q)} className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => handleDelete(getQuestionId(q))} className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showTestForm && (
        <div key={editingTestId || `create-${getSeriesId(selectedSeries) || 'none'}-${activeStageId || 'all'}-${selectedTestSubCategoryId}`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-900">{editingTestId ? 'Edit Test' : 'Create Test'}</h3>
              <button onClick={resetTestForm} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleTestSubmit} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input required value={testFormData.title} onChange={(e) => setTestFormData({ ...testFormData, title: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea rows={3} value={testFormData.description} onChange={(e) => setTestFormData({ ...testFormData, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Duration</label><input type="number" value={testFormData.duration} onChange={(e) => setTestFormData({ ...testFormData, duration: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Questions</label><input type="number" value={testFormData.totalQuestions} onChange={(e) => setTestFormData({ ...testFormData, totalQuestions: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Marks</label><input type="number" value={testFormData.totalMarks} onChange={(e) => setTestFormData({ ...testFormData, totalMarks: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Negative</label><input type="number" step="0.25" value={testFormData.negativeMarking} onChange={(e) => setTestFormData({ ...testFormData, negativeMarking: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Type</label><input value={testFormData.type} onChange={(e) => setTestFormData({ ...testFormData, type: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label><select value={testFormData.difficulty} onChange={(e) => setTestFormData({ ...testFormData, difficulty: e.target.value })} className="w-full px-3 py-2 border rounded-lg"><option>Easy</option><option>Medium</option><option>Hard</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Passing Marks</label><input type="number" value={testFormData.passingMarks} onChange={(e) => setTestFormData({ ...testFormData, passingMarks: e.target.value })} className="w-full px-3 py-2 border rounded-lg" /></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                <input value={testFormData.tags} onChange={(e) => setTestFormData({ ...testFormData, tags: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="comma, separated, tags" />
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-900">
                Linked to: {selectedSeries?.title || selectedSeries?.name} / {selectedStageLabel} / {activeCatLabel} / {selectedTestSubCategoryRecord?.name || selectedTestSubCategoryRecord?.label || 'All test subcategories'}
              </div>
              <div className="pt-4 border-t flex justify-end gap-3">
                <button type="button" onClick={resetTestForm} className="px-4 py-2 border rounded-lg">Cancel</button>
                <button type="submit" disabled={testSaving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50">{testSaving ? 'Saving...' : 'Save Test'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTestBulkUpload && (
        <BulkImportModal
          isOpen={showTestBulkUpload}
          onClose={() => setShowTestBulkUpload(false)}
          onImport={handleTestBulkUpload}
          title="Bulk Create Tests"
          expectedColumns="title, duration, totalQuestions, totalMarks, difficulty, type, tags"
          context={{
            testTitle: selectedSeries?.title || selectedSeries?.name || '',
            section: selectedTestSubCategoryRecord?.name || selectedTestSubCategoryRecord?.label || 'All test subcategories',
          }}
        />
      )}

      {/* Form Modal */}
      <QuestionForm
        isOpen={showForm}
        onClose={resetForm}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        editingId={editingId}
        subjects={subjects}
        chapters={chapters}
        topics={topics}
        passages={passages}
        sections={sections}
        saving={saving}
      />

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImport={handleBulkImport}
        context={{
          testTitle: selectedTest?.title || selectedTest?.name || '',
          section: selectedSection,
        }}
      />

      {/* Activity Log Modal */}
      {showActivityLog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  Activity Log
                </h2>
                <p className="text-sm text-gray-500 mt-1">Monitor user actions and system events</p>
              </div>
              <button
                onClick={() => setShowActivityLog(false)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <UserActivityLog />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
