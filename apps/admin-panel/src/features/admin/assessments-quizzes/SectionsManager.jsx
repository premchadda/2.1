import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Plus, Edit, Trash2, X, Save, Clock, FileText,
  ChevronDown, ChevronUp, Search, AlertCircle, CheckCircle,
  Link, AlertTriangle
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { apiClient, adminAPI } from '../../../shared/lib/dataService'

const DEFAULT_SECTION_FORM = {
  name: '',
  category_id: '',
  test_id: '',
  description: '',
  duration: 60,           // Legacy field (use time_limit instead)
  passing_marks: 0,
  marks_per_question: 2, // Marks per question for this section
  negative_marks: 0.5, // Negative marks per question
  time_limit: 900,       // Time limit in seconds (15 min default)
  is_locked: false,       // Can user revisit after submission
  is_active: true,
  display_order: 0,
  instructions: '',    // Instructions shown before section
  difficulty: 'medium', // easy | medium | hard
  shuffle_questions: false,
  shuffle_options: false,
  expected_questions: 0,
  total_marks: 0,
  exam_stage: '',
  paper: '',
  session: '',
  section_code: '',
  is_qualifying: false
}

const SSC_CGL_2025_PRESETS = [
  {
    id: 'ssc-cgl-2025-tier-1',
    label: 'SSC CGL 2025 Tier-I',
    description: '4 sections, 100 questions, 200 marks, 60 minutes, -0.50 negative marking',
    sections: [
      ['General Intelligence & Reasoning', 'Tier-I', 'Tier-I', '', '1', 25, 50, 2, 0.5, 3600, false],
      ['General Awareness', 'Tier-I', 'Tier-I', '', '2', 25, 50, 2, 0.5, 3600, false],
      ['Quantitative Aptitude', 'Tier-I', 'Tier-I', '', '3', 25, 50, 2, 0.5, 3600, false],
      ['English Comprehension', 'Tier-I', 'Tier-I', '', '4', 25, 50, 2, 0.5, 3600, false],
    ]
  },
  {
    id: 'ssc-cgl-2025-tier-2-paper-1',
    label: 'SSC CGL 2025 Tier-II Paper-I',
    description: 'Session-I objective sections plus Session-II DEST',
    sections: [
      ['Mathematical Abilities', 'Tier-II', 'Paper-I', 'Session-I', 'I-A', 30, 90, 3, 1, 8100, false],
      ['Reasoning & General Intelligence', 'Tier-II', 'Paper-I', 'Session-I', 'I-B', 30, 90, 3, 1, 8100, false],
      ['English Language & Comprehension', 'Tier-II', 'Paper-I', 'Session-I', 'II-A', 45, 135, 3, 1, 8100, false],
      ['General Awareness', 'Tier-II', 'Paper-I', 'Session-I', 'II-B', 25, 75, 3, 1, 8100, false],
      ['Computer Knowledge Test', 'Tier-II', 'Paper-I', 'Session-I', 'III', 20, 60, 3, 1, 8100, true],
      ['Data Entry Speed Test (DEST)', 'Tier-II', 'Paper-I', 'Session-II', 'IV', 0, 0, 0, 0, 900, true],
    ]
  },
  {
    id: 'ssc-cgl-2025-tier-2-paper-2',
    label: 'SSC CGL 2025 Tier-II Paper-II',
    description: 'Statistics paper for JSO and Statistical Investigator posts',
    sections: [
      ['Statistics', 'Tier-II', 'Paper-II', '', 'Paper-II', 100, 200, 2, 0.5, 7200, false],
    ]
  }
]

export default function SectionsManager({ testId: propTestId } = {}) {
  const [sections, setSections] = useState([])
  const [categories, setCategories] = useState([])
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState(DEFAULT_SECTION_FORM)
  const [errors, setErrors] = useState({})
  const [searchQuery, setSearchQuery] = useState('')
  const [testId, setTestId] = useState(propTestId || '')
  const [selectedPresetId, setSelectedPresetId] = useState(SSC_CGL_2025_PRESETS[0].id)

  useEffect(() => {
    fetchData()
  }, [testId])

  const fetchData = async () => {
    try {
      setLoading(true)
      setErrors({})

      const fetchPromises = [
        adminAPI.getTestCategories(),
        adminAPI.getTests()
      ]

      // Fetch sections - optionally filtered by testId
      if (testId) {
        fetchPromises.push(apiClient.get(`/admin/sections?testId=${testId}`))
      } else {
        fetchPromises.push(apiClient.get('/admin/sections'))
      }

      const [categoriesRes, testsRes, sectionsRes] = await Promise.allSettled(fetchPromises)

      const newErrors = {}

      if (categoriesRes.status === 'fulfilled' && categoriesRes.value.data?.data) {
        setCategories(categoriesRes.value.data.data)
      }

      if (testsRes.status === 'fulfilled' && testsRes.value.data?.data) {
        setTests(testsRes.value.data.data)
      }

      // Handle sections response (might be at different index due to conditional)
      const sectionsData = testId ? sectionsRes : (sectionsRes.status === 'fulfilled' ? sectionsRes : null)
      if (sectionsData?.status === 'fulfilled' && sectionsData.value.data?.data) {
        setSections(sectionsData.value.data.data)
      } else {
        newErrors.sections = 'Failed to load sections'
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors)
      }
    } catch (error) {
      console.error('Fetch error:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const normalizeSection = (section) => ({
    ...section,
    name: section.name || section.title || '',
    category_id: section.category_id ?? section.categoryId ?? section.category_id ?? null,
    test_id: section.test_id ?? section.testId ?? section.test_id ?? null,
    description: section.description || '',
    duration: section.duration ?? 60,
    passing_marks: section.passing_marks ?? section.passingMarks ?? 0,
    marks_per_question: section.marks_per_question ?? section.marksPerQuestion ?? 2,
    negative_marks: section.negative_marks ?? section.negativeMarks ?? 0.5,
    time_limit: section.time_limit ?? section.timeLimit ?? 900,
    is_locked: section.is_locked ?? section.isLocked ?? false,
    is_active: section.is_active ?? section.isActive ?? true,
    display_order: section.display_order ?? section.displayOrder ?? 0,
    question_count: section.question_count ?? 0,
    instructions: section.instructions || '',
    difficulty: section.difficulty || 'medium',
    shuffle_questions: section.shuffle_questions ?? section.shuffleQuestions ?? false,
    shuffle_options: section.shuffle_options ?? section.shuffleOptions ?? false,
    expected_questions: section.expected_questions ?? section.expectedQuestions ?? 0,
    total_marks: section.total_marks ?? section.totalMarks ?? 0,
    exam_stage: section.exam_stage ?? section.examStage ?? '',
    paper: section.paper || '',
    session: section.session || '',
    section_code: section.section_code ?? section.sectionCode ?? '',
    is_qualifying: section.is_qualifying ?? section.isQualifying ?? false
  })

  // Validation
  const validateSection = useCallback((data, excludeId = null) => {
    const validationErrors = {}

    // Required name
    if (!data.name?.trim()) {
      validationErrors.name = 'Section name is required'
    } else {
      // Check duplicate name (within same test if testId provided)
      const duplicate = sections.find(s =>
        s.name?.toLowerCase() === data.name.trim().toLowerCase() &&
        s.id !== excludeId &&
        (!testId || s.test_id === testId)
      )
      if (duplicate) {
        validationErrors.name = 'A section with this name already exists'
      }
    }

    // Duration validation (in seconds now)
    const timeLimit = parseInt(data.time_limit) || 0
    if (timeLimit < 60) {
      validationErrors.time_limit = 'Time limit must be at least 60 seconds'
    }

    // Marks validation
    const marksPerQ = parseFloat(data.marks_per_question) || 0
    if (marksPerQ <= 0) {
      const isNonQuestionActivity = parseInt(data.expected_questions) === 0 && parseFloat(data.total_marks) === 0
      if (!isNonQuestionActivity) validationErrors.marks_per_question = 'Marks per question must be greater than 0'
    }

    // Negative marks validation (should be <= marks per question)
    const negMarks = parseFloat(data.negative_marks) || 0
    if (negMarks < 0) {
      validationErrors.negative_marks = 'Negative marks cannot be negative'
    }
    if (negMarks > marksPerQ) {
      validationErrors.negative_marks = 'Negative marks cannot exceed marks per question'
    }

    return validationErrors
  }, [sections, testId])

  const filteredSections = useMemo(() => {
    let normalized = sections.map(normalizeSection)

    // Filter by testId if provided
    if (testId) {
      normalized = normalized.filter(s => String(s.test_id) === String(testId))
    }

    if (!searchQuery.trim()) return normalized

    const query = searchQuery.toLowerCase()
    return normalized.filter(s =>
      s.name?.toLowerCase().includes(query) ||
      s.description?.toLowerCase().includes(query)
    )
  }, [sections, searchQuery, testId])

  const getCategoryName = (categoryId) => {
    if (!categoryId) return 'No category'
    const cat = categories.find(c => c.id === categoryId || c.categoryId === categoryId)
    return cat?.name || cat?.label || 'Unknown'
  }

  const getTestName = (testIdVal) => {
    if (!testIdVal) return 'No test'
    const test = tests.find(t => t.id === testIdVal || t._id === testIdVal)
    return test?.title || test?.name || 'Unknown Test'
  }

  const openCreateForm = () => {
    // Auto-assign display order
    const maxOrder = sections.length > 0
      ? Math.max(...sections.map(s => s.display_order || s.display_order || 0))
      : 0

    setFormData({
      ...DEFAULT_SECTION_FORM,
      test_id: testId || '',
      display_order: maxOrder + 1
    })
    setEditingId(null)
    setErrors({})
    setShowForm(true)
  }

  const openEditForm = (section) => {
    const norm = normalizeSection(section)
    setFormData({
      name: norm.name,
      category_id: norm.category_id || '',
      test_id: norm.test_id || '',
      description: norm.description,
      duration: norm.duration,
      passing_marks: norm.passing_marks,
      marks_per_question: norm.marks_per_question,
      negative_marks: norm.negative_marks,
      time_limit: norm.time_limit,
      is_locked: norm.is_locked,
      is_active: norm.is_active,
      display_order: norm.display_order,
      instructions: norm.instructions || '',
      difficulty: norm.difficulty || 'medium',
      shuffle_questions: norm.shuffle_questions,
      shuffle_options: norm.shuffle_options,
      expected_questions: norm.expected_questions,
      total_marks: norm.total_marks,
      exam_stage: norm.exam_stage,
      paper: norm.paper,
      session: norm.session,
      section_code: norm.section_code,
      is_qualifying: norm.is_qualifying
    })
    setEditingId(norm.id)
    setErrors({})
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormData(DEFAULT_SECTION_FORM)
    setErrors({})
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate before submit
    const validationErrors = validateSection(formData, editingId)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      toast.error('Please fix validation errors')
      return
    }

    try {
      setSaving(true)

      const payload = {
        name: formData.name.trim(),
        category_id: formData.category_id || null,
        test_id: formData.test_id || null,
        description: formData.description || '',
        duration: parseInt(formData.duration) || 60,
        passing_marks: parseInt(formData.passing_marks) || 0,
        marks_per_question: parseFloat(formData.marks_per_question) || 2,
        negative_marks: parseFloat(formData.negative_marks) || 0,
        time_limit: parseInt(formData.time_limit) || 900,
        is_locked: Boolean(formData.is_locked),
        is_active: formData.is_active,
        display_order: parseInt(formData.display_order) || sections.length + 1,
        instructions: formData.instructions || '',
        difficulty: formData.difficulty || 'medium',
        shuffle_questions: Boolean(formData.shuffle_questions),
        shuffle_options: Boolean(formData.shuffle_options),
        expected_questions: parseInt(formData.expected_questions) || 0,
        total_marks: parseFloat(formData.total_marks) || 0,
        exam_stage: formData.exam_stage || null,
        paper: formData.paper || null,
        session: formData.session || null,
        section_code: formData.section_code || null,
        is_qualifying: Boolean(formData.is_qualifying)
      }

      if (editingId) {
        await apiClient.put(`/admin/sections/${editingId}`, payload)
        toast.success('Section updated')
      } else {
        await apiClient.post('/admin/sections', payload)
        toast.success('Section created')
      }

      closeForm()
      await fetchData()
    } catch (error) {
      console.error('Save error:', error)
      toast.error(error.response?.data?.message || 'Failed to save section')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (sectionId) => {
    if (!confirm('Are you sure you want to delete this section?')) return

    try {
      await apiClient.delete(`/admin/sections/${sectionId}`)
      toast.success('Section deleted')
      await fetchData()
    } catch (error) {
      console.error('Delete error:', error)
      toast.error(error.response?.data?.message || 'Failed to delete')
    }
  }

  const applyPreset = async () => {
    if (!testId) {
      toast.error('Select a test before applying an exam scheme')
      return
    }

    const preset = SSC_CGL_2025_PRESETS.find(item => item.id === selectedPresetId)
    if (!preset) return

    try {
      setSaving(true)
      const currentForTest = sections.filter(section => String(section.test_id || '') === String(testId))
      const existingNames = new Set(currentForTest.map(section => String(section.name || '').toLowerCase()))
      const baseOrder = currentForTest.reduce((max, section) => Math.max(max, Number(section.display_order) || 0), 0)
      const rowsToCreate = preset.sections.filter(([name]) => !existingNames.has(name.toLowerCase()))

      if (rowsToCreate.length === 0) {
        toast('All sections from this scheme already exist for the selected test')
        return
      }

      await Promise.all(rowsToCreate.map((row, index) => {
        const [name, examStage, paper, session, sectionCode, expectedQuestions, totalMarks, marksPerQuestion, negativeMarks, timeLimit, isQualifying] = row
        return apiClient.post('/admin/sections', {
          name,
          test_id: testId,
          description: `${preset.label}${sectionCode ? ` - Section ${sectionCode}` : ''}`,
          duration: Math.max(1, Math.round(timeLimit / 60)),
          passing_marks: 0,
          marks_per_question: marksPerQuestion,
          negative_marks: negativeMarks,
          time_limit: timeLimit,
          is_locked: false,
          is_active: true,
          display_order: baseOrder + index + 1,
          instructions: preset.description,
          difficulty: 'medium',
          shuffle_questions: false,
          shuffle_options: false,
          expected_questions: expectedQuestions,
          total_marks: totalMarks,
          exam_stage: examStage,
          paper,
          session,
          section_code: sectionCode,
          is_qualifying: isQualifying
        })
      }))

      toast.success(`Created ${rowsToCreate.length} section${rowsToCreate.length > 1 ? 's' : ''}`)
      await fetchData()
    } catch (error) {
      console.error('Preset error:', error)
      toast.error(error.response?.data?.message || 'Failed to apply scheme')
    } finally {
      setSaving(false)
    }
  }

  const handleReorder = async (sectionId, newOrder) => {
    try {
      await apiClient.put(`/admin/sections/${sectionId}`, { display_order: newOrder })
      await fetchData()
    } catch (error) {
      console.error('Reorder error:', error)
      toast.error('Failed to reorder')
    }
  }

  // Stats
  const stats = useMemo(() => {
    const scopedSections = testId
      ? sections.filter(s => String(s.test_id ?? s.testId ?? '') === String(testId))
      : sections
    const total = scopedSections.length
    const active = scopedSections.filter(s => s.is_active !== false).length
    const withQuestions = scopedSections.filter(s => (s.question_count || 0) > 0).length
    const plannedQuestions = scopedSections.reduce((sum, s) => sum + (Number(s.expected_questions) || 0), 0)
    const plannedMarks = scopedSections.reduce((sum, s) => sum + (Number(s.total_marks) || 0), 0)
    return { total, active, withQuestions, plannedQuestions, plannedMarks }
  }, [sections, testId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Section Manager</h1>
          <p className="text-sm text-gray-500">Manage test sections with timing and passing marks</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Test Filter */}
          {!propTestId && (
            <select
              value={testId}
              onChange={(e) => setTestId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Tests</option>
              {tests.map(test => (
                <option key={test.id || test._id} value={test.id || test._id}>
                  {test.title || test.name}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={openCreateForm}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            Add Section
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Exam Scheme Preset</h2>
            <p className="text-sm text-gray-500">Create SSC CGL 2025 Tier-I and Tier-II section structures for the selected test.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedPresetId}
              onChange={(e) => setSelectedPresetId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-64"
            >
              {SSC_CGL_2025_PRESETS.map(preset => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyPreset}
              disabled={saving || !testId}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Apply to Test
            </button>
          </div>
        </div>
        {!testId && (
          <p className="mt-3 text-xs text-amber-700">Select a test from the filter before applying a preset.</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">Total Sections</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          <div className="text-sm text-gray-500">Active</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.withQuestions}</div>
          <div className="text-sm text-gray-500">With Questions</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.plannedQuestions}</div>
          <div className="text-sm text-gray-500">Planned Qs</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.plannedMarks}</div>
          <div className="text-sm text-gray-500">Planned Marks</div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search sections..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      {filteredSections.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No sections found</p>
          <p className="text-sm text-gray-400">Create your first test section</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Scheme</th>
                {!propTestId && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Test</th>}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Qs</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marks</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Neg</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Locked</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSections.map((section) => (
                <tr key={section.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">{section.display_order}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{section.name}</p>
                      {!section.test_id && (
                        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded" title="Not linked to any test">
                          <Link className="w-3 h-3 inline" />
                        </span>
                      )}
                    </div>
                    {section.description && (
                      <p className="text-xs text-gray-500 truncate max-w-xs">{section.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div>{section.exam_stage || 'Custom'}</div>
                    {(section.paper || section.session || section.section_code) && (
                      <div className="text-xs text-gray-400">
                        {[section.paper, section.session, section.section_code].filter(Boolean).join(' / ')}
                      </div>
                    )}
                  </td>
                  {!propTestId && (
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {section.test_id ? getTestName(section.test_id) : <span className="text-gray-400">—</span>}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${(section.question_count || 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {section.question_count || 0}
                    </span>
                    {(section.question_count || 0) === 0 && (
                      <AlertTriangle className="w-4 h-4 text-amber-500 inline ml-1" title="No questions linked" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div>{section.expected_questions || 0} Q</div>
                    <div className="text-xs text-gray-400">{section.total_marks || 0} marks</div>
                    {section.is_qualifying && <div className="text-xs text-amber-700">Qualifying</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {Math.floor((section.time_limit || 900) / 60)}m
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {section.marks_per_question || 2}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {section.negative_marks || 0}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {section.is_locked ? (
                      <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">Yes</span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {section.is_active ? (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">Active</span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditForm(section)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(section.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto my-8">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? 'Edit Section' : 'Create Section'}
              </h2>
              <button onClick={closeForm} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Section Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Section Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value })
                    if (errors.name) setErrors({ ...errors, name: null })
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${errors.name ? 'border-red-500' : 'border-gray-300'
                    }`}
                  placeholder="e.g., Quant, Reasoning, English"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-500">{errors.name}</p>
                )}
              </div>



              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select category...</option>
                  {categories.map(cat => (
                    <option key={cat.id || cat.categoryId} value={cat.id || cat.categoryId}>
                      {cat.name || cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Linked Test</label>
                <select
                  value={formData.test_id}
                  onChange={(e) => setFormData({ ...formData, test_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">No test</option>
                  {tests.map(test => (
                    <option key={test.id || test._id} value={test.id || test._id}>
                      {test.title || test.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                  <input
                    type="text"
                    value={formData.exam_stage}
                    onChange={(e) => setFormData({ ...formData, exam_stage: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Tier-I"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Paper</label>
                  <input
                    type="text"
                    value={formData.paper}
                    onChange={(e) => setFormData({ ...formData, paper: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Paper-I"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Session</label>
                  <input
                    type="text"
                    value={formData.session}
                    onChange={(e) => setFormData({ ...formData, session: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Session-I"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input
                    type="text"
                    value={formData.section_code}
                    onChange={(e) => setFormData({ ...formData, section_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="I-A"
                  />
                </div>
              </div>

              {/* Scoring & Timing */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time Limit (seconds)
                  </label>
                  <input
                    type="number"
                    value={formData.time_limit}
                    onChange={(e) => {
                      setFormData({ ...formData, time_limit: e.target.value })
                      if (errors.time_limit) setErrors({ ...errors, time_limit: null })
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${errors.time_limit ? 'border-red-500' : 'border-gray-300'
                      }`}
                    min={60}
                    step={60}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {Math.floor((parseInt(formData.time_limit) || 900) / 60)} minutes
                  </p>
                  {errors.time_limit && (
                    <p className="mt-1 text-sm text-red-500">{errors.time_limit}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Planned Qs
                  </label>
                  <input
                    type="number"
                    value={formData.expected_questions}
                    onChange={(e) => setFormData({ ...formData, expected_questions: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Marks
                  </label>
                  <input
                    type="number"
                    value={formData.total_marks}
                    onChange={(e) => setFormData({ ...formData, total_marks: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    min={0}
                    step={0.5}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Marks/Question
                  </label>
                  <input
                    type="number"
                    value={formData.marks_per_question}
                    onChange={(e) => {
                      setFormData({ ...formData, marks_per_question: e.target.value })
                      if (errors.marks_per_question) setErrors({ ...errors, marks_per_question: null })
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${errors.marks_per_question ? 'border-red-500' : 'border-gray-300'
                      }`}
                    min={0}
                    step={0.5}
                  />
                  {errors.marks_per_question && (
                    <p className="mt-1 text-sm text-red-500">{errors.marks_per_question}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Negative Marks
                  </label>
                  <input
                    type="number"
                    value={formData.negative_marks}
                    onChange={(e) => {
                      setFormData({ ...formData, negative_marks: e.target.value })
                      if (errors.negative_marks) setErrors({ ...errors, negative_marks: null })
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${errors.negative_marks ? 'border-red-500' : 'border-gray-300'
                      }`}
                    min={0}
                    step={0.25}
                  />
                  {errors.negative_marks && (
                    <p className="mt-1 text-sm text-red-500">{errors.negative_marks}</p>
                  )}
                </div>
              </div>

              {/* Section Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div className="flex flex-col gap-3 pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_locked}
                      onChange={(e) => setFormData({ ...formData, is_locked: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                    <span className="text-sm text-gray-700">Lock Section (no revisit)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.shuffle_questions}
                      onChange={(e) => setFormData({ ...formData, shuffle_questions: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                    <span className="text-sm text-gray-700">Shuffle Questions</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_qualifying}
                      onChange={(e) => setFormData({ ...formData, is_qualifying: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                    <span className="text-sm text-gray-700">Qualifying Section</span>
                  </label>
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Instructions (shown before section starts)
                </label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="e.g., This section contains 25 questions. You have 30 minutes..."
                />
              </div>

              {/* Order & Active */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    min={0}
                  />
                </div>
                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
