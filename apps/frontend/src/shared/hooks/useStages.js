import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../lib/apiBase.js'

export function useStages() {
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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

  const getStageName = useCallback((stageId) => {
    const stage = stages.find(s =>
      s._id === stageId ||
      s.id === stageId ||
      String(s._id) === String(stageId) ||
      String(s.id) === String(stageId)
    )
    return stage?.name || null
  }, [stages])

  const getStageById = useCallback((stageId) => {
    return stages.find(s =>
      s._id === stageId ||
      s.id === stageId ||
      String(s._id) === String(stageId) ||
      String(s.id) === String(stageId)
    )
  }, [stages])

  const getStageOptions = useCallback(() => {
    return stages.map(stage => ({
      value: stage._id || stage.id,
      label: stage.name,
      slug: stage.slug,
      icon: stage.icon,
      description: stage.description
    }))
  }, [stages])

  const getStageNames = useCallback(() => {
    return stages.map(s => s.name)
  }, [stages])

  const getDefaultStageOptions = useCallback(() => {
    return stages.map(stage => ({
      value: stage._id || stage.id,
      label: stage.name,
      slug: stage.slug,
      icon: stage.icon,
      description: stage.description
    }))
  }, [stages])

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
