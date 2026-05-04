import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, Edit, Trash2, X, Save, FolderPlus, ChevronDown, ChevronRight, Layers, FileText, AlertCircle, CheckCircle, Search, Copy, ExternalLink, Link, FolderOpen, ClipboardList, Terminal, Clock, Database, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react'
import { adminAPI, apiClient } from '../../../shared/lib/dataService.js'
import { useStages } from '../../../shared/hooks/useStages'

// Toast notification component
const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`fixed top-4 right-4 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg transition-all animate-slide-in ${
      type === 'success' ? 'bg-green-500 text-white' : 
      type === 'error' ? 'bg-red-500 text-white' : 
      'bg-blue-500 text-white'
    }`}>
      {type === 'success' ? <CheckCircle className="w-5 h-5" /> : 
       type === 'error' ? <AlertCircle className="w-5 h-5" /> : 
       <AlertCircle className="w-5 h-5" />}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-80">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// Tabs configuration
const TABS = [
  { id: 'tree', label: 'Category Tree', icon: FolderOpen },
  { id: 'series-category-relations', label: 'Test Series Relations', icon: ExternalLink },
  { id: 'test-series-list', label: 'Test Series List', icon: ClipboardList },
  { id: 'import-export', label: 'Import / Export', icon: Database },
  { id: 'api-docs', label: 'API Documentation', icon: Link }
]

const isSameEntityId = (a, b) => {
  if (a == null || b == null) return false
  if (String(a) === String(b)) return true
  const na = Number(a)
  const nb = Number(b)
  return !Number.isNaN(na) && !Number.isNaN(nb) && na === nb
}

const normalizeIdList = (value) => {
  if (Array.isArray(value)) return value.map(String)
  if (value == null || value === '') return []
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed.slice(1, -1).split(',').map(v => v.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    }
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) return parsed.map(String)
    } catch {
      // Fall through to single-value handling.
    }
  }
  return [String(value)]
}

const hasMatchingId = (value, targetIds) => {
  const normalized = normalizeIdList(value)
  return normalized.some(id => targetIds.some(targetId => isSameEntityId(id, targetId)))
}

/** Ids of node + all descendants (prevent choosing self/descendant as parent). */
function getDescendantIdSet(rootId, flatCategories) {
  if (!rootId) return new Set()
  const set = new Set([String(rootId)])
  let frontier = [String(rootId)]
  while (frontier.length) {
    const id = frontier.pop()
    flatCategories.forEach((c) => {
      const cid = String(c._id || c.id)
      if (String(c.parentId || '') === id && !set.has(cid)) {
        set.add(cid)
        frontier.push(cid)
      }
    })
  }
  return set
}

// Dropdown Multi-Select Component for Test Series
function TestSeriesMultiSelect({ testSeries, selectedIds, onChange, isSameEntityId }) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef(null)

  // Get selected series names for display
  const selectedNames = useMemo(() => {
    return testSeries
      .filter(s => s.isActive !== false && selectedIds.some(id => isSameEntityId(id, s._id || s.id)))
      .map(s => s.title || s.name)
  }, [testSeries, selectedIds, isSameEntityId])

  // Filter available series based on search
  const filteredSeries = useMemo(() => {
    return testSeries.filter(s => {
      if (s.isActive === false) return false
      const name = (s.title || s.name || '').toLowerCase()
      return !searchQuery || name.includes(searchQuery.toLowerCase())
    })
  }, [testSeries, searchQuery])

  // Toggle selection of a series
  const toggleSeries = (seriesId) => {
    const isSelected = selectedIds.some(id => isSameEntityId(id, seriesId))
    if (isSelected) {
      onChange(selectedIds.filter(id => !isSameEntityId(id, seriesId)))
    } else {
      onChange([...selectedIds, seriesId])
    }
  }

  // Remove a specific selection
  const removeSelection = (e, seriesId) => {
    e.stopPropagation()
    onChange(selectedIds.filter(id => !isSameEntityId(id, seriesId)))
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Link to Test Series <span className="text-xs text-gray-500">(Select all that apply)</span>
      </label>
      
      {/* Dropdown Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-left bg-white flex items-center justify-between"
      >
        <div className="flex-1 flex flex-wrap gap-1">
          {selectedNames.length === 0 ? (
            <span className="text-gray-400 text-sm">Select test series...</span>
          ) : (
            selectedNames.map((name, index) => (
              <span 
                key={index}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-full border border-purple-200"
              >
                {name}
                <button
                  type="button"
                  onClick={(e) => {
                    const series = testSeries.find(s => (s.title || s.name) === name)
                    if (series) removeSelection(e, series._id || series.id)
                  }}
                  className="hover:text-purple-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
          {/* Search Input */}
          {testSeries.length > 5 && (
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search series..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="overflow-y-auto max-h-48">
            {testSeries.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center">No test series found.</div>
            ) : filteredSeries.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center">No matching series found.</div>
            ) : (
              filteredSeries.map(series => {
                const seriesId = series._id || series.id
                const isSelected = selectedIds.some(id => isSameEntityId(id, seriesId))
                return (
                  <label
                    key={seriesId}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
                      isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      checked={isSelected}
                      onChange={() => toggleSeries(seriesId)}
                    />
                    <span className="flex-1 text-sm text-gray-900 font-medium">
                      {series.title || series.name}
                    </span>
                    {series.isPro && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded">PRO</span>
                    )}
                  </label>
                )
              })
            )}
          </div>

          {/* Footer with count */}
          {selectedIds.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {selectedIds.length} selected
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-purple-600 hover:text-purple-800 font-medium"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      <p className="mt-1 text-xs text-gray-500">
        Link this category to one or more test series for better organization
      </p>
    </div>
  )
}

export default function CategoriesManager() {
  const { stages, loading: stagesLoading } = useStages({ preferAdminCounts: true })

  const [activeTab, setActiveTab] = useState('tree')
  const [categories, setCategories] = useState([])
  const [examCategories, setExamCategories] = useState([])
  const [testSeries, setTestSeries] = useState([])
  const [tests, setTests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [parentCategory, setParentCategory] = useState(null)
  const [expandedCategories, setExpandedCategories] = useState({})
  const [hoveredCategory, setHoveredCategory] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Toast state
  const [toast, setToast] = useState(null)

  // Activity log state
  const [activityLogs, setActivityLogs] = useState([])
  const [showActivityLog, setShowActivityLog] = useState(false)
  const [expandedLog, setExpandedLog] = useState(null)

  // Slug validation state
  const [slugError, setSlugError] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    icon: '',
    description: '',
    stageIds: [],
    displayOrder: 0,
    isActive: true,
    parentId: '',
    testSeriesId: []
  })

  // FIX: Drag and drop reorder state
  const [draggingId, setDraggingId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  
  // Bulk operations state
  const [selectedCategories, setSelectedCategories] = useState(new Set())
  const [showBulkActions, setShowBulkActions] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [importData, setImportData] = useState('')
  const [mergeTargetId, setMergeTargetId] = useState(null)
  const [permissionLevels, setPermissionLevels] = useState({})

  const [reorderLoading, setReorderLoading] = useState(new Set())

  // ==========================================
  // BULK MOVE OPERATIONS
  // ==========================================
  const handleBulkMove = async (targetParentId) => {
    if (selectedCategories.size === 0) return
    
    try {
      for (const categoryId of selectedCategories) {
        // Skip if trying to move into own descendant
        const descendantIds = getDescendantIdSet(categoryId, categories)
        if (targetParentId && descendantIds.has(String(targetParentId))) {
          showToast(`Cannot move category ${categoryId} into its own child`, 'error')
          continue
        }
        
        await adminAPI.updateTestCategory(categoryId, {
          parentId: targetParentId || null,
          level: targetParentId ? categories.find(c => isSameEntityId(c._id, targetParentId)).level + 1 : 0
        })
      }
      
      await fetchAllData()
      setSelectedCategories(new Set())
      showToast(`Successfully moved ${selectedCategories.size} categories`)
    } catch (error) {
      console.error('Bulk move failed:', error)
      showToast('Failed to move categories', 'error')
    }
  }

  // ==========================================
  // EXPORT / IMPORT FUNCTIONALITY
  // ==========================================
  const exportTree = () => {
    const fullTree = buildTree(categories)
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      categories: fullTree,
      count: categories.length
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `category-tree-export-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    showToast('Category tree exported successfully')
  }

  const handleImport = async () => {
    try {
      const data = JSON.parse(importData)
      if (!data.categories || !Array.isArray(data.categories)) {
        throw new Error('Invalid export format')
      }
      
      // Recursive import function
      const importCategory = async (cat, parentId = null) => {
        const newCat = await adminAPI.createTestCategory({
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          icon: cat.icon,
          examCategoryId: cat.examCategoryId,
          stageIds: cat.stageIds || [],
          parentId: parentId,
          isActive: cat.isActive,
          displayOrder: cat.displayOrder
        })
        
        if (cat.children && cat.children.length > 0) {
          for (const child of cat.children) {
            await importCategory(child, newCat.data.data._id)
          }
        }
      }
      
      for (const rootCat of data.categories) {
        await importCategory(rootCat)
      }
      
      await fetchAllData()
      setShowImportModal(false)
      setImportData('')
      showToast(`Successfully imported ${data.count} categories`)
    } catch (error) {
      console.error('Import failed:', error)
      showToast(error.message || 'Failed to import category tree', 'error')
    }
  }

  // ==========================================
  // CATEGORY MERGE OPERATION
  // ==========================================
  const handleMerge = async () => {
    if (selectedCategories.size < 2 || !mergeTargetId) {
      showToast('Select at least 2 categories and choose a target to merge', 'error')
      return
    }
    
    if (!confirm(`Merge ${selectedCategories.size - 1} categories into target? All children will be moved to target category.`)) return
    
    try {
      const sourceIds = Array.from(selectedCategories).filter(id => !isSameEntityId(id, mergeTargetId))
      
      for (const sourceId of sourceIds) {
        // Move all children from source to target
        const sourceChildren = categories.filter(c => isSameEntityId(c.parentId, sourceId))
        for (const child of sourceChildren) {
          await adminAPI.updateTestCategory(child._id, { parentId: mergeTargetId })
        }
        
        // Delete source category
        await adminAPI.deleteTestCategory(sourceId)
      }
      
      await fetchAllData()
      setSelectedCategories(new Set())
      setMergeTargetId(null)
      showToast(`Successfully merged ${sourceIds.length} categories`)
    } catch (error) {
      console.error('Merge failed:', error)
      showToast('Failed to merge categories', 'error')
    }
  }

  // ==========================================
  // PERMISSION LEVELS
  // ==========================================
  const PERMISSION_LEVELS = {
    ADMIN: 'Full Access',
    EDITOR: 'Edit Existing',
    CONTRIBUTOR: 'Create Only',
    VIEWER: 'View Only'
  }

  const setPermission = (categoryId, level) => {
    setPermissionLevels(prev => ({
      ...prev,
      [categoryId]: level
    }))
    showToast(`Permission level set to ${level}`)
  }

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  const hideToast = useCallback(() => {
    setToast(null)
  }, [])

  // FIX BUG-022: Prevent activity log re-render loops with dedup and batched updates
  const lastLogRef = useRef(null)
  const addActivityLog = useCallback((type, action, payload, response, error = null) => {
    // Dedup: skip if same type+action+error was just logged within 1 second
    const logKey = `${type}:${action}:${error?.message || 'ok'}`
    const now = Date.now()
    if (lastLogRef.current && lastLogRef.current.key === logKey && now - lastLogRef.current.time < 1000) {
      return // Skip duplicate log within 1 second
    }
    lastLogRef.current = { key: logKey, time: now }

    const log = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      type,
      action,
      payload,
      response: response?.data || response,
      error: error ? {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        stack: error.stack
      } : null,
      success: !error
    }
    // Use functional update to avoid stale closure and prevent loops
    setActivityLogs(prev => {
      // Prevent infinite growth
      const next = [log, ...prev]
      return next.length > 100 ? next.slice(0, 100) : next
    })
  }, [])

  // FIX BUG-023: Add refreshTrigger state to auto-refresh tree after linking changes
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    fetchAllData()
  }, [refreshTrigger])

  const fetchAllData = async () => {
    try {
      setLoading(true)
      
      // Restore expanded state from localStorage first
      try {
        const savedExpanded = localStorage.getItem('categories_expanded')
        if (savedExpanded) {
          setExpandedCategories(JSON.parse(savedExpanded))
        }
      } catch (e) {
        console.warn('Could not restore expanded state:', e)
      }
      
      // Fetch categories
      const catResponse = await adminAPI.getTestCategories()
      if (catResponse.data.success) {
        setCategories(catResponse.data.data)
      }

      // Fetch exam categories for the dropdown
      try {
        const examCatResponse = await apiClient.get('/admin/exam-categories')
        if (examCatResponse.data.success) {
          setExamCategories(examCatResponse.data.data || [])
        }
      } catch (err) {
        console.error('Failed to fetch exam categories:', err)
        addActivityLog('fetch', 'Fetch Exam Categories', null, null, err)
      }

      // Fetch test series
      const seriesResponse = await apiClient.get('/admin/test-series')
      if (seriesResponse.data.success) {
        setTestSeries(seriesResponse.data.data || [])
      }

      // Fetch tests
      const testsResponse = await apiClient.get('/admin/tests')
      if (testsResponse.data.success) {
        setTests(testsResponse.data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
      addActivityLog('fetch', 'Fetch All Data', null, null, error)
      showToast('Failed to load categories data', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Validate slug uniqueness
  const validateSlug = useCallback((slug, excludeId = null) => {
    if (!slug) return ''
    const duplicate = categories.find(c => 
      c.slug === slug && c._id !== excludeId && c._id !== editingId
    )
    return duplicate ? 'This slug already exists. Please choose a different name.' : ''
  }, [categories, editingId])

  // FIX ISSUE C-01: Standardize on 'categoryId' as the canonical field name
  // Legacy field names are still checked for backward compatibility but 'categoryId' is preferred
  // This reduces fragility while maintaining compatibility with existing data
  const SERIES_CATEGORY_FIELDS = ['categoryId', 'category', 'category_id']
  const SERIES_CATEGORY_PATH_FIELDS = ['categoryPathIds', 'category_path_ids', 'categoryPath']
  const TEST_CATEGORY_FIELDS = ['categoryId', 'category', 'category_id']
  const TEST_CATEGORY_PATH_FIELDS = ['categoryPathIds', 'category_path_ids']

  const getCategoryLinkedSeriesIds = (category) => [
    ...normalizeIdList(category.testSeriesId),
    ...normalizeIdList(category.test_series_id),
    ...normalizeIdList(category.test_series_ids)
  ]

  const getCategoryAndDescendantIds = (category) => {
    const ids = []
    const walk = (node) => {
      if (!node) return
      ids.push(String(node._id || node.id))
      if (node.slug) ids.push(String(node.slug))
      const children = node.children || categories.filter(c => isSameEntityId(c.parentId, node._id ?? node.id))
      children.forEach(walk)
    }
    walk(category)
    return ids
  }

  const getRelatedSeriesForCategories = (categoryIds) => {
    const linkedSeriesIds = new Set()
    categories
      .filter(cat => categoryIds.some(categoryId => isSameEntityId(cat._id ?? cat.id, categoryId)))
      .forEach(cat => getCategoryLinkedSeriesIds(cat).forEach(id => linkedSeriesIds.add(String(id))))

    const related = testSeries.filter(s => {
      const seriesId = s._id || s.id
      if (hasMatchingId(seriesId, Array.from(linkedSeriesIds))) return true
      if (SERIES_CATEGORY_FIELDS.some(field => hasMatchingId(s[field], categoryIds))) return true
      return SERIES_CATEGORY_PATH_FIELDS.some(field => hasMatchingId(s[field], categoryIds))
    })

    const byId = new Map()
    related.forEach(s => byId.set(String(s._id || s.id), s))
    return Array.from(byId.values())
  }

  const getRelatedTestsForCategories = (categoryIds) => {
    const related = tests.filter(t => {
      if (hasMatchingId(t.testCategoryId || t.test_category_id, categoryIds)) return true
      if (TEST_CATEGORY_FIELDS.some(field => hasMatchingId(t[field], categoryIds))) return true
      return TEST_CATEGORY_PATH_FIELDS.some(field => hasMatchingId(t[field], categoryIds))
    })

    const byId = new Map()
    related.forEach(t => byId.set(String(t._id || t.id), t))
    return Array.from(byId.values())
  }

  // Get total counts including children
  const getTotalCountsRecursive = (category) => {
    const categoryIds = getCategoryAndDescendantIds(category)
    return {
      seriesCount: getRelatedSeriesForCategories(categoryIds).length,
      testsCount: getRelatedTestsForCategories(categoryIds).length
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate slug
    const slugValidationError = validateSlug(formData.slug, editingId)
    if (slugValidationError) {
      setSlugError(slugValidationError)
      return
    }
    setSlugError('')
    
    // Validate no circular parent reference
    if (editingId && parentCategory) {
      const descendantIds = getDescendantIdSet(editingId, categories)
      if (descendantIds.has(String(parentCategory._id || parentCategory.id))) {
        showToast('Cannot set child category as parent - this would create a circular reference', 'error')
        return
      }
    }
    
    const payload = {
      ...formData,
      parentId: parentCategory?._id || null,
      level: parentCategory ? (parentCategory.level || 0) + 1 : 0,
      displayOrder: Number(formData.displayOrder)
    }

    try {
      let response
      if (editingId) {
        response = await adminAPI.updateTestCategory(editingId, payload)
      } else {
        response = await adminAPI.createTestCategory(payload)
      }

      if (response.data.success) {
        await fetchAllData()
        triggerTreeRefresh() // FIX ISSUE C-02: Auto-refresh tree after create/update
        resetForm()
        showToast(editingId ? 'Category updated successfully!' : 'Category created successfully!')
        addActivityLog(
          editingId ? 'update' : 'create',
          editingId ? `Updated category: ${payload.name} (ID: ${editingId})` : `Created category: ${payload.name}`,
          payload,
          response
        )
      }
    } catch (error) {
      console.error('Failed to save category:', error)
      showToast(error.response?.data?.message || 'Failed to save category', 'error')
      addActivityLog(
        editingId ? 'update' : 'create',
        editingId ? `Failed to update category (ID: ${editingId})` : `Failed to create category: ${payload.name}`,
        payload,
        null,
        error
      )
    }
  }

  const handleEdit = (item) => {
    // Handle testSeriesId - check both camelCase and snake_case, array or single
    let testSeriesId = []
    if (Array.isArray(item.testSeriesId)) {
      testSeriesId = item.testSeriesId
    } else if (Array.isArray(item.test_series_id)) {
      testSeriesId = item.test_series_id
    } else if (Array.isArray(item.test_series_ids)) {
      testSeriesId = item.test_series_ids
    } else if (item.testSeriesId) {
      testSeriesId = [item.testSeriesId]
    } else if (item.test_series_id) {
      testSeriesId = [item.test_series_id]
    }
    
    setFormData({
      name: item.name,
      slug: item.slug,
      icon: item.icon || '',
      description: item.description || '',
      stageIds: Array.isArray(item.stageIds) ? item.stageIds : [],
      displayOrder: item.displayOrder || 0,
      isActive: item.isActive !== false,
      testSeriesId
    })
    setEditingId(item._id || item.id)
    // C4: normalize id types when resolving parent
    const parent =
      categories.find((c) => isSameEntityId(c._id ?? c.id, item.parentId)) || null
    setParentCategory(parent)
    setSlugError('')
    setShowForm(true)
  }

  // FIX BUG-023: Trigger tree refresh after any data change
  const triggerTreeRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1)
  }, [])

  // FIX ISSUE C-02: Auto-refresh category tree after linking changes
  const handleDelete = async (id) => {
    // Get all descendant ids first
    const descendantIds = getDescendantIdSet(id, categories)
    const totalCount = descendantIds.size
    
    if (!confirm(`Are you sure you want to delete this category? This will also delete ${totalCount - 1} child categories. All ${totalCount} categories will be moved to trash.`)) return

    try {
      const deletedCategory = categories.find(c => isSameEntityId(c._id, id))
      
      // Delete all children first (bottom up)
      const descendantArray = Array.from(descendantIds).filter(did => !isSameEntityId(did, id))
      for (const descendantId of descendantArray) {
        try {
          await adminAPI.deleteTestCategory(descendantId)
        } catch (err) {
          console.warn(`Failed to delete child ${descendantId}:`, err)
        }
      }
      
      // Delete the main category
      const response = await adminAPI.deleteTestCategory(id)
      
      if (response.data.success) {
        // Clear deleted items from expanded state
        setExpandedCategories(prev => {
          const next = { ...prev }
          descendantIds.forEach(did => delete next[did])
          try {
            localStorage.setItem('categories_expanded', JSON.stringify(next))
          } catch (e) {
            // ignore localStorage quota errors
          }
          return next
        })
        
        await fetchAllData()
        triggerTreeRefresh() // Refresh tree after deletion
        showToast(`Deleted category and ${totalCount - 1} children successfully`)
        addActivityLog(
          'delete',
          `Deleted category: ${deletedCategory?.name || 'Unknown'} (ID: ${id}) with ${totalCount - 1} children`,
          { id, name: deletedCategory?.name, childCount: totalCount - 1 },
          response
        )
      }
    } catch (error) {
      console.error('Failed to delete category:', error)
      showToast('Failed to move category to trash', 'error')
      addActivityLog(
        'delete',
        `Failed to delete category (ID: ${id})`,
        { id },
        null,
        error
      )
    }
  }

  const resetForm = () => {
    setFormData({ 
      name: '', 
      slug: '', 
      icon: '', 
      description: '', 
      examCategoryId: '',
      stageIds: [], 
      displayOrder: 0, 
      isActive: true,
      testSeriesId: []
    })
    setEditingId(null)
    setParentCategory(null)
    setSlugError('')
    setShowForm(false)
  }

  const toggleExpand = (categoryId) => {
    setExpandedCategories(prev => {
      const next = {
        ...prev,
        [categoryId]: !prev[categoryId]
      }
      // Persist expanded state to localStorage
      try {
        localStorage.setItem('categories_expanded', JSON.stringify(next))
      } catch (e) {
        console.warn('Could not persist expanded state:', e)
      }
      return next
    })
  }

  const normParentId = (p) => (p === undefined || p === null || p === '' ? null : String(p))

  /** C3: reorder among siblings by swapping displayOrder */
  const handleReorderCategory = async (cat, direction) => {
    const pid = normParentId(cat.parentId)
    const siblings = categories
      .filter((c) => normParentId(c.parentId) === pid)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    const idx = siblings.findIndex((c) => isSameEntityId(c._id ?? c.id, cat._id ?? cat.id))
    const j = direction === 'up' ? idx - 1 : idx + 1
    if (idx < 0 || j < 0 || j >= siblings.length) return
    const a = siblings[idx]
    const b = siblings[j]
    const oa = a.displayOrder ?? idx
    const ob = b.displayOrder ?? j
    try {
      await adminAPI.updateTestCategory(a._id || a.id, { displayOrder: ob })
      await adminAPI.updateTestCategory(b._id || b.id, { displayOrder: oa })
      showToast('Category order updated')
      await fetchAllData()
    } catch (error) {
      console.error('Reorder failed:', error)
      showToast('Failed to reorder categories', 'error')
    }
  }

  const openAddChild = (parent) => {
    setParentCategory(parent)
    setFormData({ 
      name: '', 
      slug: '', 
      icon: '', 
      description: '', 
      examCategoryId: parent.examCategoryId || '',
      stageIds: Array.isArray(parent.stageIds) ? parent.stageIds : [], 
      displayOrder: 0,
      isActive: true 
    })
    setEditingId(null)
    setSlugError('')
    setShowForm(true)
  }

  // Search filter - filter categories by name, description, or slug
  const filterCategories = useCallback((items, query) => {
    if (!query.trim()) return items
    const lowerQuery = query.toLowerCase()
    const filterFn = (item) => {
      const matchesSearch = item.name?.toLowerCase().includes(lowerQuery) ||
                          item.slug?.toLowerCase().includes(lowerQuery) ||
                          item.description?.toLowerCase().includes(lowerQuery)
      const matchingChildren = item.children ? item.children.filter(filterFn) : []
      return matchesSearch || matchingChildren.length > 0
    }
    
    const filterTree = (nodes) => {
      return nodes.map(node => {
        const matches = node.name?.toLowerCase().includes(lowerQuery) ||
                       node.slug?.toLowerCase().includes(lowerQuery) ||
                       node.description?.toLowerCase().includes(lowerQuery)
        const filteredChildren = node.children ? filterTree(node.children) : []
        if (matches || filteredChildren.length > 0) {
          return { ...node, children: filteredChildren }
        }
        return null
      }).filter(Boolean)
    }
    
    return filterTree(items)
  }, [])

  // Recursive component to render category tree
  const CategoryItem = ({ category, depth = 0 }) => {
    const hasChildren = category.children && category.children.length > 0
    const isExpanded = expandedCategories[category._id]
    const paddingLeft = depth * 24 + 16
    const counts = getTotalCountsRecursive(category)
    const isHovered = hoveredCategory === category._id
    const sibs = categories
      .filter((c) => normParentId(c.parentId) === normParentId(category.parentId))
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    const sidx = sibs.findIndex((c) => isSameEntityId(c._id ?? c.id, category._id ?? category.id))
    
    // Get exam category label
    const examCategoryLabel = category.examCategoryId ? 
      examCategories.find(ec => 
        (ec._id === category.examCategoryId) || 
        (ec.id === category.examCategoryId)
      )?.label : null

    return (
      <div className="border-b border-gray-100 last:border-b-0">
        {/* Category Row */}
        <div 
          className="flex items-center justify-between py-3 px-3 hover:bg-gray-50 transition-colors"
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {hasChildren ? (
              <button 
                onClick={() => toggleExpand(category._id)}
                className="p-1 hover:bg-gray-200 rounded flex-shrink-0"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </button>
            ) : (
              <div className="w-6" />
            )}
            
            <span className="text-xl flex-shrink-0">{category.icon || (depth === 0 ? '📂' : '📁')}</span>
            
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 text-sm md:text-base">{category.name}</span>
                <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${
                  category.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {category.isActive !== false ? 'Active' : 'Inactive'}
                </span>
                
                {/* Exam Category Badge */}
                {examCategoryLabel && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-amber-100 text-amber-700">
                    {examCategoryLabel}
                  </span>
                )}
                
                {/* Test Series Count Emoji with Tooltip */}
                <div 
                  className="relative inline-flex"
                  onMouseEnter={() => setHoveredCategory(category._id)}
                  onMouseLeave={() => setHoveredCategory(null)}
                >
                  <span className="cursor-help" title="Test Series">
                    📚
                  </span>
                  <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 rounded-full">
                    {counts.seriesCount}
                  </span>
                  
                  {/* Tooltip */}
                  {isHovered && (
                    <div className="absolute z-50 bottom-full left-0 mb-2 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl min-w-[180px]">
                      <div className="font-semibold mb-2 border-b border-gray-700 pb-2">Connected Items</div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            Test Series:
                          </span>
                          <span className="font-bold text-purple-300">{counts.seriesCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            Tests:
                          </span>
                          <span className="font-bold text-blue-300">{counts.testsCount}</span>
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                    </div>
                  )}
                </div>
                
                {/* Tests Count Emoji */}
                <span className="cursor-help" title={`Tests: ${counts.testsCount}`}>
                  📝
                </span>
                <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full">
                  {counts.testsCount}
                </span>

                {/* Stage badges - fixed to handle race condition */}
                {Array.isArray(category.stageIds) && category.stageIds.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {category.stageIds.map(stageId => {
                      const stage = stages.find((s) => isSameEntityId(s._id ?? s.id, stageId))
                      if (!stage) return null; // FIX: Don't render hardcoded unknown stages
                      return (
                        <span key={stageId} className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-100 text-blue-700">
                          {stage.name}
                        </span>
                      )
                    })}
                  </div>
                )}
                {hasChildren && (
                  <span className="text-xs text-gray-400">
                    ({category.children.length} sub)
                  </span>
                )}
              </div>
              {category.description && (
                <p className="text-xs text-gray-500 truncate">{category.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <button
              type="button"
              onClick={() => handleReorderCategory(category, 'up')}
              disabled={sidx <= 0}
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
              title="Move up among siblings"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleReorderCategory(category, 'down')}
              disabled={sidx < 0 || sidx >= sibs.length - 1}
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
              title="Move down among siblings"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <button 
              onClick={() => openAddChild(category)}
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
              title="Add Child Category"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
            <button 
              onClick={() => handleEdit(category)} 
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button 
              onClick={() => handleDelete(category._id)} 
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Move to trash"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="bg-gray-50/50">
            {category.children.map(child => (
              <CategoryItem key={child._id} category={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // FIX BUG [C-MEDIUM]: Normalize parentId and _id to strings for consistent matching
  const buildTree = (items) => {
    const map = {}
    const roots = []

    items.forEach(item => {
      // Normalize _id to string for consistent keying
      const id = String(item._id || item.id)
      map[id] = { ...item, children: [] }
    })

    items.forEach(item => {
      const id = String(item._id || item.id)
      // Normalize parentId to string for consistent matching
      const parentId = item.parentId != null ? String(item.parentId) : null
      if (parentId && map[parentId]) {
        map[parentId].children.push(map[id])
      } else {
        roots.push(map[id])
      }
    })

    const sortFn = (a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)

    const sortChildren = (nodes) => {
      nodes.sort(sortFn)
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          sortChildren(node.children)
        }
      })
    }

    sortChildren(roots)
    return roots
  }

  // FIX BUG [C-LOW]: Memoize the forbidden set computation and use a stable key for the useMemo
  // to avoid O(n²) recomputation on every refreshTrigger change
  const parentSelectRows = useMemo(() => {
    const roots = buildTree(categories)
    const forbidden = editingId ? getDescendantIdSet(String(editingId), categories) : new Set()
    const rows = []
    const walk = (nodes, depth) => {
      nodes.forEach((node) => {
        const nid = String(node._id || node.id)
        if (forbidden.has(nid)) return
        rows.push({ node, depth })
        if (node.children?.length) walk(node.children, depth + 1)
      })
    }
    walk(roots, 0)
    return rows
  }, [categories, editingId])

  // Get parent path for breadcrumb
  const getParentPath = (parent) => {
    if (!parent) return null
    const path = [parent.name]
    let current = parent
    while (current.parentId != null && current.parentId !== '') {
      const parentCat = categories.find((c) => isSameEntityId(c._id ?? c.id, current.parentId))
      if (parentCat) {
        path.unshift(parentCat.name)
        current = parentCat
      } else {
        break
      }
    }
    return path.join(' → ')
  }

  const handleAddRootCategory = () => {
    setParentCategory(null)
    setFormData({ 
      name: '', 
      slug: '', 
      icon: '', 
      description: '', 
      examCategoryId: '',
      stageIds: [], 
      displayOrder: 0, 
      isActive: true 
    })
    setShowForm(true)
  }

  // FIX BUG [C-LOW]: Add max depth protection to prevent infinite loops from circular references
  const MAX_PARENT_DEPTH = 20

  // Compute exam relations data
  // Uses recursive ancestor lookup so child categories without explicit examCategoryId
  // are still included if a parent has one
  const examRelationsData = useMemo(() => {
    const getEffectiveExamCatId = (catId, visited = new Set(), depth = 0) => {
      // FIX: Add depth limit as additional protection against circular references
      if (depth > MAX_PARENT_DEPTH) return null
      if (!catId || visited.has(String(catId))) return null
      visited.add(String(catId))
      const cat = categories.find(c => String(c._id || c.id) === String(catId))
      if (!cat) return null
      if (cat.examCategoryId) return String(cat.examCategoryId)
      if (cat.parentId) return getEffectiveExamCatId(cat.parentId, visited, depth + 1)
      return null
    }

    return examCategories.map(ec => {
      const ecId = String(ec._id || ec.id)
      const relatedCategories = categories.filter(cat =>
        getEffectiveExamCatId(cat._id || cat.id) === ecId
      )
      const totalCounts = relatedCategories.reduce((sum, cat) => {
        const counts = getTotalCountsRecursive(cat)
        sum.seriesCount += counts.seriesCount
        sum.testsCount += counts.testsCount
        return sum
      }, { seriesCount: 0, testsCount: 0 })
      return {
        examCategory: ec,
        categories: relatedCategories,
        categoryCount: relatedCategories.length,
        ...totalCounts
      }
    }).filter(ec => ec.categoryCount > 0)
  }, [examCategories, categories])

  // Compute test series relations data for ROOT categories (Test Category Relations tab)
  const seriesCategoryRelationsData = useMemo(() => {
    const relations = []
    categories.forEach(cat => {
      // Only include root categories (no parentId)
      if (cat.parentId != null && cat.parentId !== '' && cat.parentId !== 0) return
      
      const categoryIds = getCategoryAndDescendantIds(cat)
      const relatedSeries = getRelatedSeriesForCategories(categoryIds)
      const relatedTests = getRelatedTestsForCategories(categoryIds)
      
      if (relatedSeries.length > 0 || relatedTests.length > 0) {
        relations.push({
          category: cat,
          series: relatedSeries,
          tests: relatedTests,
          seriesCount: relatedSeries.length,
          testsCount: relatedTests.length
        })
      }
    })
    return relations
  }, [categories, testSeries, tests])

  // Compute test series relations data for child categories.
  const seriesSubcategoryRelationsData = useMemo(() => {
    const relations = []
    categories.forEach(cat => {
      // Only include subcategories (has parentId)
      if (cat.parentId == null || cat.parentId === '' || cat.parentId === 0) return
      
      const categoryIds = [String(cat._id || cat.id)]
      const relatedSeries = getRelatedSeriesForCategories(categoryIds)
      const relatedTests = getRelatedTestsForCategories(categoryIds)
      
      if (relatedSeries.length > 0 || relatedTests.length > 0) {
        // Get parent name for display
        const parent = categories.find(p => isSameEntityId(p._id ?? p.id, cat.parentId))
        relations.push({
          category: cat,
          parentCategory: parent,
          series: relatedSeries,
          tests: relatedTests,
          seriesCount: relatedSeries.length,
          testsCount: relatedTests.length
        })
      }
    })
    return relations
  }, [categories, testSeries, tests])

  // Orphan detection: categories not linked to test series via stages
  // A category is orphaned if it has no stages OR if its stages are not associated with any test series
  const orphanStats = useMemo(() => {
    // Build a set of all stage IDs that are associated with at least one test series
    const stagesLinkedToSeries = new Set()
    testSeries.forEach(series => {
      if (Array.isArray(series.stages)) {
        series.stages.forEach(stageId => {
          stagesLinkedToSeries.add(String(stageId))
        })
      }
    })

    const orphanedCategories = categories.filter(c => {
      // Category has no stages - cannot be linked to test series via stages
      if (!Array.isArray(c.stageIds) || c.stageIds.length === 0) {
        return true
      }
      // Check if any of the category's stages are linked to at least one test series
      const hasLinkedStage = c.stageIds.some(stageId => 
        stagesLinkedToSeries.has(String(stageId))
      )
      return !hasLinkedStage
    })

    return { 
      orphaned: orphanedCategories.length, 
      total: categories.length,
      orphanedCategories 
    }
  }, [categories, testSeries])

  if (loading) {
    return <div className="p-4 md:p-6">Loading...</div>
  }

  return (
    <div className="p-4 md:p-6">
      {/* Toast Notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Test Categories</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">Manage hierarchical test categories</p>
        </div>
        {activeTab === 'tree' && (
          <button
            onClick={handleAddRootCategory}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm md:text-base w-full sm:w-auto"
          >
            <Plus className="w-5 h-5" />
            Add Root Category
          </button>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'series-category-relations' && (
                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                  activeTab === tab.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {seriesCategoryRelationsData.length}
                </span>
              )}
              {tab.id === 'series-subcategory-relations' && (
                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                  activeTab === tab.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {seriesSubcategoryRelationsData.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'tree' && (
        <>
          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search categories by name, slug, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Orphan Warning Banner */}
          {orphanStats.orphaned > 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-700">
                <div className="font-semibold mb-1">Orphan Summary ({orphanStats.total} total categories)</div>
                <div>• <strong>{orphanStats.orphaned}</strong> {orphanStats.orphaned === 1 ? 'category' : 'categories'} not linked to any test series via stages (check Test Category Relations tab)</div>
              </div>
            </div>
          )}

          {/* Form Modal */}
          {showForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
              <div className="bg-white rounded-lg w-full max-w-lg max-h-[95vh] overflow-y-auto">
                <div className="p-4 md:p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-lg md:text-xl font-bold">
                        {editingId ? 'Edit Category' : parentCategory ? 'Add Child Category' : 'Add Root Category'}
                      </h2>
                      {parentCategory && !editingId && (
                        <p className="text-sm text-indigo-600 mt-1">
                          Parent: {getParentPath(parentCategory)}
                        </p>
                      )}
                    </div>
                    <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => {
                          const newName = e.target.value
                          const newSlug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
                          const slugErr = newSlug ? validateSlug(newSlug, editingId) : ''
                          setSlugError(slugErr)
                          setFormData({ ...formData, name: newName, slug: newSlug })
                        }}
                        placeholder="e.g., Year Based"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Slug
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.slug}
                        onChange={(e) => {
                          const newSlug = e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '')
                          const slugErr = newSlug ? validateSlug(newSlug, editingId) : ''
                          setSlugError(slugErr)
                          setFormData({ ...formData, slug: newSlug })
                        }}
                        placeholder="e.g., year-based"
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                          slugError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
                        }`}
                      />
                      {slugError && (
                        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {slugError}
                        </p>
                      )}
                    </div>

                    {/* Parent Category Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Parent Category
                      </label>
                      <select
                        value={parentCategory ? (parentCategory._id || parentCategory.id) : ''}
                        onChange={(e) => {
                          const selectedId = e.target.value
                          const selected =
                            categories.find((c) => isSameEntityId(c._id ?? c.id, selectedId)) || null
                          setParentCategory(selected)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Root Category --</option>
                        {parentSelectRows.map(({ node, depth }) => {
                          const nid = node._id || node.id
                          return (
                            <option key={nid} value={nid}>
                              {'\u00A0\u00A0'.repeat(depth)}
                              {depth ? '↳ ' : ''}
                              {node.name}
                            </option>
                          )
                        })}
                      </select>
                    </div>

                    {/* Test Series Linking (Dropdown Multi-select) */}
                    <TestSeriesMultiSelect
                      testSeries={testSeries}
                      selectedIds={formData.testSeriesId}
                      onChange={(selectedIds) => setFormData({ ...formData, testSeriesId: selectedIds })}
                      isSameEntityId={isSameEntityId}
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Stages <span className="text-xs text-gray-500">(Select all that apply)</span>
                      </label>
                      {stagesLoading ? (
                        <div className="text-sm text-gray-500 py-2">Loading stages...</div>
                      ) : stages.length === 0 ? (
                        <div className="text-sm text-gray-500 py-2">No stages found.</div>
                      ) : (
                        <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                          {stages.map(stage => (
                            <label 
                              key={stage._id || stage.id} 
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors text-sm
                                ${formData.stageIds.some((sid) => isSameEntityId(sid, stage._id ?? stage.id))
                                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                  : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-200'
                                }`}
                            >
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={formData.stageIds.some((sid) => isSameEntityId(sid, stage._id ?? stage.id))}
                                onChange={(e) => {
                                  const sid = stage._id ?? stage.id
                                  if (e.target.checked) {
                                    if (!formData.stageIds.some((x) => isSameEntityId(x, sid))) {
                                      setFormData({ ...formData, stageIds: [...formData.stageIds, sid] })
                                    }
                                  } else {
                                    setFormData({
                                      ...formData,
                                      stageIds: formData.stageIds.filter((id) => !isSameEntityId(id, sid))
                                    })
                                  }
                                }}
                              />
                              <span className="font-medium">{stage.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                        <input
                          type="number"
                          value={formData.displayOrder}
                          onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Icon (Emoji)</label>
                        <input
                          type="text"
                          value={formData.icon}
                          onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                          placeholder="📂"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2 pb-2">
                          <input
                            type="checkbox"
                            checked={formData.isActive}
                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          <span className="text-sm font-medium text-gray-700">Active</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={2}
                        placeholder="Optional description..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="flex gap-3 pt-4 border-t">
                      <button type="button" onClick={resetForm} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium">
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!!slugError}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="w-4 h-4" />
                        {editingId ? 'Update' : 'Create'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Categories Tree */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {(() => {
              const categoryTree = buildTree(categories)
              const filteredTree = filterCategories(categoryTree, searchQuery)
              
              return filteredTree.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="text-4xl mb-3">📂</div>
                  {searchQuery ? (
                    <>
                      <p className="text-gray-500 mb-4">No categories matching "{searchQuery}"</p>
                      <button onClick={() => setSearchQuery('')} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm">
                        Clear Search
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-gray-500 mb-4">No categories found. Create your first one!</p>
                      <button onClick={handleAddRootCategory} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                        <Plus className="w-4 h-4" />
                        Add Category
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-center justify-between text-xs font-medium text-gray-500 uppercase">
                      <span>Category Structure</span>
                      <span>{categories.length} total</span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {filteredTree.map(category => (
                      <CategoryItem key={category._id} category={category} depth={0} />
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 Tip:</strong> Click the <FolderPlus className="w-4 h-4 inline mx-1" /> icon on any category to add a child under it.
            </p>
          </div>
        </>
      )}

      {/* Test Category Relations Tab */}
      {activeTab === 'series-category-relations' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Test Category Relations</h3>
            <p className="text-sm text-gray-500">Shows which test series and tests are linked to root test categories</p>
          </div>
          {seriesCategoryRelationsData.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-gray-500">No test category relations found</p>
              <p className="text-sm text-gray-400 mt-1">Root categories with test series links will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {seriesCategoryRelationsData.map(({ category, series, tests: testsList, seriesCount, testsCount }) => (
                <div key={category._id} className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{category.icon || '📂'}</span>
                    <div>
                      <h4 className="font-bold text-gray-900">{category.name}</h4>
                      <span className="text-xs text-gray-500">{category.slug}</span>
                    </div>
                    <span className="ml-auto px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">
                      {seriesCount} series
                    </span>
                    <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
                      {testsCount} tests
                    </span>
                  </div>
                  {/* Stage Badges */}
                  {Array.isArray(category.stageIds) && category.stageIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {category.stageIds.map(stageId => {
                        const stage = stages.find(s => String(s._id || s.id) === String(stageId))
                        return stage ? (
                          <span key={stageId} className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                            {stage.icon || '🔖'} {stage.name}
                          </span>
                        ) : null
                      })}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Test Series Column */}
                    <div>
                      <h5 className="text-sm font-semibold text-purple-700 mb-2 flex items-center gap-2">
                        <Layers className="w-4 h-4" /> Test Series ({seriesCount})
                      </h5>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {series.map(s => (
                          <div key={s._id || s.id} className="p-2 bg-purple-50 rounded-lg">
                            <div className="text-sm font-medium text-gray-900">{s.title || s.name}</div>
                            <div className="text-xs text-gray-500">{s.description ? s.description.slice(0, 60) + '...' : 'No description'}</div>
                            {s.isPro && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded">PRO</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Tests Column */}
                    <div>
                      <h5 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Tests ({testsCount})
                      </h5>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {testsList.map(t => (
                          <div key={t._id || t.id} className="p-2 bg-blue-50 rounded-lg">
                            <div className="text-sm font-medium text-gray-900">{t.title}</div>
                            <div className="text-xs text-gray-500">
                              {t.duration ? `${t.duration} min` : ''} • {t.totalQuestions ? `${t.totalQuestions} Qs` : ''}
                            </div>
                            {t.isPro && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded">PRO</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Child Category Relations Tab */}
      {activeTab === 'series-subcategory-relations' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">Child Category Relations</h3>
            <p className="text-sm text-gray-500">Shows which test series and tests are linked to child test categories</p>
          </div>
          {seriesSubcategoryRelationsData.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="text-4xl mb-3">📚</div>
              <p className="text-gray-500">No child category relations found</p>
              <p className="text-sm text-gray-400 mt-1">Child categories with test series links will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {seriesSubcategoryRelationsData.map(({ category, parentCategory, series, tests: testsList, seriesCount, testsCount }) => (
                <div key={category._id} className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{category.icon || '📁'}</span>
                    <div>
                      <h4 className="font-bold text-gray-900">{category.name}</h4>
                      <span className="text-xs text-gray-500">{category.slug}</span>
                      {parentCategory && (
                        <div className="text-xs text-indigo-600 mt-0.5">
                          Parent: {parentCategory.name}
                        </div>
                      )}
                    </div>
                    <span className="ml-auto px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">
                      {seriesCount} series
                    </span>
                    <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
                      {testsCount} tests
                    </span>
                  </div>
                  {/* Stage Badges */}
                  {Array.isArray(category.stageIds) && category.stageIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {category.stageIds.map(stageId => {
                        const stage = stages.find(s => String(s._id || s.id) === String(stageId))
                        return stage ? (
                          <span key={stageId} className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                            {stage.icon || '🔖'} {stage.name}
                          </span>
                        ) : null
                      })}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Test Series Column */}
                    <div>
                      <h5 className="text-sm font-semibold text-purple-700 mb-2 flex items-center gap-2">
                        <Layers className="w-4 h-4" /> Test Series ({seriesCount})
                      </h5>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {series.map(s => (
                          <div key={s._id || s.id} className="p-2 bg-purple-50 rounded-lg">
                            <div className="text-sm font-medium text-gray-900">{s.title || s.name}</div>
                            <div className="text-xs text-gray-500">{s.description ? s.description.slice(0, 60) + '...' : 'No description'}</div>
                            {s.isPro && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded">PRO</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Tests Column */}
                    <div>
                      <h5 className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> Tests ({testsCount})
                      </h5>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {testsList.map(t => (
                          <div key={t._id || t.id} className="p-2 bg-blue-50 rounded-lg">
                            <div className="text-sm font-medium text-gray-900">{t.title}</div>
                            <div className="text-xs text-gray-500">
                              {t.duration ? `${t.duration} min` : ''} • {t.totalQuestions ? `${t.totalQuestions} Qs` : ''}
                            </div>
                            {t.isPro && (
                              <span className="inline-block mt-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded">PRO</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Activity Log Panel */}
      <div className="mt-6">
        <button
          onClick={() => setShowActivityLog(!showActivityLog)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm w-full justify-between"
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            <span className="font-medium">Activity Log</span>
            {activityLogs.length > 0 && (
              <span className="px-2 py-0.5 text-xs bg-gray-600 rounded-full">
                {activityLogs.length}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activityLogs.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setActivityLogs([])
                }}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                Clear
              </button>
            )}
            {showActivityLog ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </button>

        {showActivityLog && (
          <div className="mt-2 bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
            {activityLogs.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">
                No activity yet. Perform an action to see logs here.
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-800">
                {activityLogs.map((log) => (
                  <div key={log.id} className={`${log.success ? '' : 'bg-red-900/10'}`}>
                    <button
                      onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                      className="w-full px-4 py-3 flex items-start gap-3 hover:bg-gray-800/50 transition-colors text-left"
                    >
                      {/* Status Icon */}
                      <div className="flex-shrink-0 mt-0.5">
                        {log.success ? (
                          <CheckCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        )}
                      </div>

                      {/* Log Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Type Badge */}
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${
                            log.type === 'create' ? 'bg-green-900/50 text-green-400' :
                            log.type === 'update' ? 'bg-blue-900/50 text-blue-400' :
                            log.type === 'delete' ? 'bg-red-900/50 text-red-400' :
                            'bg-gray-700 text-gray-400'
                          }`}>
                            {log.type}
                          </span>
                          
                          {/* Action */}
                          <span className="text-sm text-gray-200 font-medium truncate">{log.action}</span>
                        </div>
                        
                        {/* Timestamp */}
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                          <Clock className="w-3 h-3" />
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>

                        {/* Expanded Details */}
                        {expandedLog === log.id && (
                          <div className="mt-3 space-y-3">
                            {/* Payload */}
                            {log.payload && (
                              <div>
                                <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                                  <Database className="w-3 h-3" />
                                  Payload
                                </div>
                                <pre className="text-xs text-green-300 bg-gray-950 rounded p-3 overflow-x-auto border border-gray-800">
                                  {JSON.stringify(log.payload, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* Response */}
                            {log.response && (
                              <div>
                                <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Response
                                </div>
                                <pre className="text-xs text-blue-300 bg-gray-950 rounded p-3 overflow-x-auto border border-gray-800">
                                  {JSON.stringify(log.response, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* Error */}
                            {log.error && (
                              <div>
                                <div className="flex items-center gap-1 text-xs text-red-400 mb-1">
                                  <AlertCircle className="w-3 h-3" />
                                  Error
                                </div>
                                <div className="text-xs text-red-300 bg-red-950/30 rounded p-3 border border-red-900/50 space-y-2">
                                  <div className="font-semibold">{log.error.message}</div>
                                  {log.error.status && (
                                    <div>Status: {log.error.status}</div>
                                  )}
                                  {log.error.data && (
                                    <pre className="text-red-400 overflow-x-auto">
                                      {JSON.stringify(log.error.data, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Expand Icon */}
                      <div className="flex-shrink-0">
                        {expandedLog === log.id ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
