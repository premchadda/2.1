import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'

export function useTestCategories() {
  const [categories, setCategories] = useState([])
  const [tree, setTree] = useState([])
  const [roots, setRoots] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get('/api/test-categories')
      if (response.data?.success) {
        setCategories(response.data.data)
      } else {
        setError(response.data?.message || 'Failed to fetch categories')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchTree = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get('/api/test-categories/tree')
      if (response.data?.success) {
        setTree(response.data.data)
      } else {
        setError(response.data?.message || 'Failed to fetch category tree')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchRoots = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get('/api/test-categories/roots')
      if (response.data?.success) {
        setRoots(response.data.data)
      } else {
        setError(response.data?.message || 'Failed to fetch root categories')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Build tree from flat categories
  const buildTree = useCallback((items, parentId = null) => {
    return items
      .filter(item => (item.parentId || null) === parentId)
      .map(item => ({
        ...item,
        children: buildTree(items, item._id)
      }))
  }, [])

  // Get category names for dropdown options
  const getCategoryOptions = useCallback(() => {
    return categories.map(cat => ({
      value: cat.name,
      label: cat.name,
      id: cat._id,
      slug: cat.slug,
      icon: cat.icon,
      level: cat.level || 0,
      parentId: cat.parentId
    }))
  }, [categories])

  // Get root category names (for main filters)
  const getRootCategoryNames = useCallback(() => {
    return categories
      .filter(cat => !cat.parentId && cat.isActive !== false)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
      .map(cat => cat.name)
  }, [categories])

  // Get featured exams config for Home page
  const getFeaturedExams = useCallback(() => {
    const rootCats = categories
      .filter(cat => !cat.parentId && cat.isActive !== false)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    const colorMap = {
      'ssc': 'red',
      'railway': 'blue',
      'banking': 'green',
      'upsc': 'purple',
      'defence': 'orange',
      'teaching': 'yellow'
    }
    
    return rootCats.map(cat => ({
      id: cat.slug,
      title: cat.name + ' Exams',
      icon: cat.icon || '📝',
      desc: cat.description?.split('including')[1]?.trim() || cat.description || '',
      color: colorMap[cat.slug] || 'gray'
    }))
  }, [categories])

  // Get category emoji/icon
  const getCategoryEmoji = useCallback((categoryName) => {
    const raw = String(categoryName || '').trim().toLowerCase()
    const category = categories.find(c => 
      c.name?.toLowerCase() === raw ||
      c.slug?.toLowerCase() === raw ||
      (raw && (raw.includes(c.name?.toLowerCase() || '___') || raw.includes(c.slug?.toLowerCase() || '___')))
    )
    if (category?.icon) return category.icon
    
    if (raw.includes('railway') || raw.includes('rrb') || raw.includes('ntpc')) return '🚂'
    if (raw.includes('ssc') || raw.includes('cgl') || raw.includes('chsl')) return '📝'
    if (raw.includes('bank') || raw.includes('ibps') || raw.includes('sbi')) return '💰'
    if (raw.includes('upsc') || raw.includes('civil') || raw.includes('ias')) return '🏛️'
    if (raw.includes('defence') || raw.includes('police') || raw.includes('nda') || raw.includes('cds')) return '🎖️'
    if (raw.includes('teach') || raw.includes('tet') || raw.includes('ctet') || raw.includes('ugc')) return '🎓'
    if (raw.includes('state') || raw.includes('psc')) return '🗺️'
    if (raw.includes('engineer') || raw.includes('gate') || raw.includes('je')) return '⚙️'
    if (raw.includes('medical') || raw.includes('neet')) return '🩺'
    
    return '📋'
  }, [categories])

  // Get gradient color for category
  const getCategoryColor = useCallback((categoryName) => {
    const raw = String(categoryName || '').trim().toLowerCase()
    if (raw.includes('railway') || raw.includes('rrb')) return 'from-green-500 to-green-600'
    if (raw.includes('ssc')) return 'from-red-500 to-red-600'
    if (raw.includes('bank') || raw.includes('ibps')) return 'from-purple-500 to-purple-600'
    if (raw.includes('upsc')) return 'from-indigo-500 to-indigo-600'
    if (raw.includes('defence') || raw.includes('police')) return 'from-orange-500 to-orange-600'
    if (raw.includes('teach') || raw.includes('tet')) return 'from-yellow-500 to-yellow-600'
    return 'from-blue-500 to-blue-600'
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchCategories()
    fetchRoots()
  }, [fetchCategories, fetchRoots])

  return {
    categories,
    tree,
    roots,
    loading,
    error,
    fetchCategories,
    fetchTree,
    fetchRoots,
    buildTree,
    getCategoryOptions,
    getRootCategoryNames,
    getFeaturedExams,
    getCategoryEmoji,
    getCategoryColor,
    refresh: fetchCategories
  }
}

export default useTestCategories
