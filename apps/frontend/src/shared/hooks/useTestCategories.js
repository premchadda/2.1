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
    const category = categories.find(c => 
      c.name.toLowerCase() === categoryName?.toLowerCase()
    )
    if (category?.icon) return category.icon
    
    const emojis = {
      'ssc': '📝',
      'banking': '💰',
      'railway': '🚂',
      'upsc': '🏛️',
      'defence': '🎖️',
      'teaching': '🎓',
      'default': '📋'
    }
    
    return emojis[categoryName] || emojis.default
  }, [categories])

  // Get gradient color for category
  const getCategoryColor = useCallback((categoryName) => {
    const colors = {
      'ssc': 'from-red-500 to-red-600',
      'railway': 'from-green-500 to-green-600',
      'banking': 'from-purple-500 to-purple-600',
      'upsc': 'from-indigo-500 to-indigo-600',
      'defence': 'from-orange-500 to-orange-600',
      'teaching': 'from-yellow-500 to-yellow-600',
      'all': 'from-blue-500 to-blue-600'
    }
    return colors[categoryName?.toLowerCase()] || 'from-gray-500 to-gray-600'
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
