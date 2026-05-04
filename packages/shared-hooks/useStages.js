import { useState, useEffect, useCallback } from 'react'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

/**
 * Custom hook for managing test stages (Tier-1, Tier-2, CBT-1, CBT-2, etc.)
 * Stages allow different category structures for different exam stages
 */
export function useStages() {
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch all active stages
  const fetchStages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/api/stages`)
      const data = await response.json()
      if (data.success) {
        setStages(data.data)
      } else {
        setError(data.message || 'Failed to fetch stages')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch stages with their categories
  const fetchStagesWithCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/api/stages/with-categories`)
      const data = await response.json()
      if (data.success) {
        return data.data
      } else {
        setError(data.message || 'Failed to fetch stages with categories')
        return []
      }
    } catch (err) {
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch stages with test counts
  const fetchStagesWithTestCounts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/api/stages/with-test-counts`)
      const data = await response.json()
      if (data.success) {
        return data.data
      } else {
        setError(data.message || 'Failed to fetch stages with test counts')
        return []
      }
    } catch (err) {
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch a single stage by ID
  const fetchStageById = useCallback(async (id) => {
    try {
      const response = await fetch(`${API_URL}/api/stages/${id}`)
      const data = await response.json()
      if (data.success) {
        return data.data
      }
      return null
    } catch (err) {
      console.error('Error fetching stage:', err)
      return null
    }
  }, [])

  // Fetch a stage by slug
  const fetchStageBySlug = useCallback(async (slug) => {
    try {
      const response = await fetch(`${API_URL}/api/stages/slug/${slug}`)
      const data = await response.json()
      if (data.success) {
        return data.data
      }
      return null
    } catch (err) {
      console.error('Error fetching stage by slug:', err)
      return null
    }
  }, [])

  // Fetch categories for a specific stage
  const fetchCategoriesForStage = useCallback(async (stageId) => {
    try {
      const response = await fetch(`${API_URL}/api/stages/${stageId}/categories`)
      const data = await response.json()
      if (data.success) {
        return data.data
      }
      return []
    } catch (err) {
      console.error('Error fetching categories for stage:', err)
      return []
    }
  }, [])

  // Fetch categories for a specific stage as tree
  const fetchCategoryTreeForStage = useCallback(async (stageId) => {
    try {
      const response = await fetch(`${API_URL}/api/stages/${stageId}/categories/tree`)
      const data = await response.json()
      if (data.success) {
        return data.data
      }
      return []
    } catch (err) {
      console.error('Error fetching category tree for stage:', err)
      return []
    }
  }, [])

  // Fetch tests for a specific stage
  const fetchTestsForStage = useCallback(async (stageId) => {
    try {
      const response = await fetch(`${API_URL}/api/stages/${stageId}/tests`)
      const data = await response.json()
      if (data.success) {
        return data.data
      }
      return []
    } catch (err) {
      console.error('Error fetching tests for stage:', err)
      return []
    }
  }, [])

  // Get stage name by ID
  const getStageName = useCallback((stageId) => {
    const stage = stages.find(s => 
      s._id === stageId || 
      s.id === stageId || 
      String(s._id) === String(stageId) ||
      String(s.id) === String(stageId)
    )
    return stage?.name || null
  }, [stages])

  // Get stage by ID
  const getStageById = useCallback((stageId) => {
    return stages.find(s => 
      s._id === stageId || 
      s.id === stageId || 
      String(s._id) === String(stageId) ||
      String(s.id) === String(stageId)
    )
  }, [stages])

  // Get stage options for dropdowns
  const getStageOptions = useCallback(() => {
    return stages.map(stage => ({
      value: stage._id || stage.id,
      label: stage.name,
      slug: stage.slug,
      icon: stage.icon,
      description: stage.description
    }))
  }, [stages])

  // Get stage names array
  const getStageNames = useCallback(() => {
    return stages.map(s => s.name)
  }, [stages])

  // Get default stage options (returns fetched stages from API)
  const getDefaultStageOptions = useCallback(() => {
    return stages.map(stage => ({
      value: stage._id || stage.id,
      label: stage.name,
      slug: stage.slug,
      icon: stage.icon,
      description: stage.description
    }))
  }, [stages])

  // Initial fetch
  useEffect(() => {
    fetchStages()
  }, [fetchStages])

  return {
    stages,
    loading,
    error,
    fetchStages,
    fetchStagesWithCategories,
    fetchStagesWithTestCounts,
    fetchStageById,
    fetchStageBySlug,
    fetchCategoriesForStage,
    fetchCategoryTreeForStage,
    fetchTestsForStage,
    getStageName,
    getStageById,
    getStageOptions,
    getStageNames,
    getDefaultStageOptions,
    refresh: fetchStages
  }
}

export default useStages