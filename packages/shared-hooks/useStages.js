import { useState, useEffect, useCallback } from 'react'
import { getSharedApiClient } from './apiClientConfig.js'

const API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
  || (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL)
  || 'http://localhost:5001';

const toApiPath = (url) => {
  if (!url) return '/api/stages'
  return url.startsWith('/api') ? url : `/api${url.startsWith('/') ? '' : '/'}${url}`
}

export function useStages(options = {}) {
  const { apiClient: passedClient = null, preferAdminCounts = false } = options
  const apiClient = passedClient || getSharedApiClient()
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch all active stages
  const fetchStages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = preferAdminCounts ? '/admin/stages/with-test-counts' : '/stages'
      let data
      if (apiClient && typeof apiClient.get === 'function') {
        const response = await apiClient.get(toApiPath(url))
        data = response.data
      } else {
        const response = await fetch(`${API_URL}${toApiPath(url)}`)
        data = await response.json()
      }
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
  }, [apiClient, preferAdminCounts])

  // Fetch stages with their categories
  const fetchStagesWithCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = '/stages/with-categories'
      let data
      if (apiClient && typeof apiClient.get === 'function') {
        const response = await apiClient.get(toApiPath(url))
        data = response.data
      } else {
        const response = await fetch(`${API_URL}${toApiPath(url)}`)
        data = await response.json()
      }
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
  }, [apiClient])

  // Fetch stages with test counts
  const fetchStagesWithTestCounts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = '/stages/with-test-counts'
      let data
      if (apiClient && typeof apiClient.get === 'function') {
        const response = await apiClient.get(toApiPath(url))
        data = response.data
      } else {
        const response = await fetch(`${API_URL}${toApiPath(url)}`)
        data = await response.json()
      }
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
  }, [apiClient])

  // Sync individual fetched stages to the global list
  const updateLocalStage = useCallback((updatedStage) => {
    if (!updatedStage) return;
    setStages(prev => {
      const searchId = String(updatedStage.id || updatedStage._id);
      const index = prev.findIndex(s => String(s.id || s._id) === searchId);
      if (index >= 0) {
        const newStages = [...prev];
        newStages[index] = { ...newStages[index], ...updatedStage };
        return newStages;
      }
      return [...prev, updatedStage];
    });
  }, []);

  // Fetch a single stage by ID
  const fetchStageById = useCallback(async (id) => {
    try {
      let data
      if (apiClient && typeof apiClient.get === 'function') {
        const response = await apiClient.get(toApiPath(`/stages/${id}`))
        data = response.data
      } else {
        const response = await fetch(`${API_URL}${toApiPath(`/stages/${id}`)}`)
        data = await response.json()
      }
      if (data.success) {
        updateLocalStage(data.data)
        return data.data
      }
      return null
    } catch (err) {
      console.error('Error fetching stage:', err)
      return null
    }
  }, [apiClient, updateLocalStage])

  // Fetch a stage by slug
  const fetchStageBySlug = useCallback(async (slug) => {
    try {
      let data
      if (apiClient && typeof apiClient.get === 'function') {
        const response = await apiClient.get(toApiPath(`/stages/slug/${slug}`))
        data = response.data
      } else {
        const response = await fetch(`${API_URL}${toApiPath(`/stages/slug/${slug}`)}`)
        data = await response.json()
      }
      if (data.success) {
        updateLocalStage(data.data)
        return data.data
      }
      return null
    } catch (err) {
      console.error('Error fetching stage by slug:', err)
      return null
    }
  }, [apiClient, updateLocalStage])

  // Fetch categories for a specific stage
  const fetchCategoriesForStage = useCallback(async (stageId) => {
    try {
      let data
      if (apiClient && typeof apiClient.get === 'function') {
        const response = await apiClient.get(toApiPath(`/stages/${stageId}/categories`))
        data = response.data
      } else {
        const response = await fetch(`${API_URL}${toApiPath(`/stages/${stageId}/categories`)}`)
        data = await response.json()
      }
      if (data.success) {
        return data.data
      }
      return []
    } catch (err) {
      console.error('Error fetching categories for stage:', err)
      return []
    }
  }, [apiClient])

  // Fetch categories for a specific stage as tree
  const fetchCategoryTreeForStage = useCallback(async (stageId) => {
    try {
      let data
      if (apiClient && typeof apiClient.get === 'function') {
        const response = await apiClient.get(toApiPath(`/stages/${stageId}/categories/tree`))
        data = response.data
      } else {
        const response = await fetch(`${API_URL}${toApiPath(`/stages/${stageId}/categories/tree`)}`)
        data = await response.json()
      }
      if (data.success) {
        return data.data
      }
      return []
    } catch (err) {
      console.error('Error fetching category tree for stage:', err)
      return []
    }
  }, [apiClient])

  // Fetch tests for a specific stage
  const fetchTestsForStage = useCallback(async (stageId) => {
    try {
      let data
      if (apiClient && typeof apiClient.get === 'function') {
        const response = await apiClient.get(toApiPath(`/stages/${stageId}/tests`))
        data = response.data
      } else {
        const response = await fetch(`${API_URL}${toApiPath(`/stages/${stageId}/tests`)}`)
        data = await response.json()
      }
      if (data.success) {
        return data.data
      }
      return []
    } catch (err) {
      console.error('Error fetching tests for stage:', err)
      return []
    }
  }, [apiClient])

  // Fetch stage details for admin
  const fetchStageDetailsAdmin = useCallback(async (stageId) => {
    try {
      let data
      if (apiClient && typeof apiClient.get === 'function') {
        const response = await apiClient.get(toApiPath(`/admin/stages/${stageId}/details`))
        data = response.data
      } else {
        const response = await fetch(`${API_URL}${toApiPath(`/admin/stages/${stageId}/details`)}`)
        data = await response.json()
      }
      if (data.success) return data.data
      return null
    } catch (err) {
      console.error('Error fetching admin stage details:', err)
      return null
    }
  }, [apiClient])

  // Get stage by ID
  const getStageById = useCallback((stageId) => {
    if (!stageId) return null;
    const searchId = String(stageId);
    return stages.find(s => String(s.id || s._id) === searchId) || null;
  }, [stages])

  // Get stage name by ID
  const getStageName = useCallback((stageId) => {
    return getStageById(stageId)?.name || null;
  }, [getStageById])

  // Get stage options for dropdowns
  const getStageOptions = useCallback(() => {
    return stages.map(stage => ({
      value: stage.id || stage._id,
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

  // CRUD methods
  const createStage = useCallback(async (stageData) => {
    if (apiClient && typeof apiClient.post === 'function') {
      const response = await apiClient.post(toApiPath('/stages'), stageData)
      if (response.data.success) await fetchStages()
      return response
    } else {
      const response = await fetch(`${API_URL}${toApiPath('/stages')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stageData)
      })
      const data = await response.json()
      if (data.success) await fetchStages()
      return { data }
    }
  }, [apiClient, fetchStages])

  const updateStage = useCallback(async (id, stageData) => {
    if (apiClient && typeof apiClient.put === 'function') {
      const response = await apiClient.put(toApiPath(`/stages/${id}`), stageData)
      if (response.data.success) await fetchStages()
      return response
    } else {
      const response = await fetch(`${API_URL}${toApiPath(`/stages/${id}`)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stageData)
      })
      const data = await response.json()
      if (data.success) await fetchStages()
      return { data }
    }
  }, [apiClient, fetchStages])

  const deleteStage = useCallback(async (id) => {
    if (apiClient && typeof apiClient.delete === 'function') {
      const response = await apiClient.delete(toApiPath(`/stages/${id}`))
      if (response.data.success) await fetchStages()
      return response
    } else {
      const response = await fetch(`${API_URL}${toApiPath(`/stages/${id}`)}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) await fetchStages()
      return { data }
    }
  }, [apiClient, fetchStages])

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
    fetchStageDetailsAdmin,
    getStageName,
    getStageById,
    getStageOptions,
    getStageNames,
    refresh: fetchStages,
    createStage,
    updateStage,
    deleteStage
  }
}

export default useStages
