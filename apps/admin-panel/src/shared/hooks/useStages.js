// FIX M3: Replaced raw fetch() with shared api client for consistent auth/error handling
// FIX M4: Removed duplicate getDefaultStageOptions (same as getStageOptions)
import { useState, useEffect, useCallback } from 'react'
import { adminAPI } from '../lib/dataService.js'
import { logger } from '../lib/logger.js'

/**
 * @param {object} [options]
 * @param {boolean} [options.preferAdminCounts] — Use /api/admin/stages/with-test-counts (same linkage rules as StagesManager).
 */
export function useStages(options = {}) {
  const preferAdminCounts = options.preferAdminCounts === true
  const [stages, setStages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchStages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = preferAdminCounts ? '/admin/stages/with-test-counts' : '/stages'
      const response = await adminAPI.get(url)
      if (response.data.success) {
        setStages(response.data.data)
      } else {
        setError(response.data.message || 'Failed to fetch stages')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [preferAdminCounts])

  const fetchStagesWithCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await adminAPI.get('/stages/with-categories')
      if (response.data.success) {
        // FIX H2: Do not completely overwrite `stages` state to avoid race condition.
        return response.data.data
      }
      setError(response.data.message || 'Failed to fetch stages with categories')
      return []
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
      const response = await api.get('/stages/with-test-counts')
      if (response.data.success) {
        // FIX H2: Do not completely overwrite `stages` state to avoid race condition.
        return response.data.data
      }
      setError(response.data.message || 'Failed to fetch stages with test counts')
      return []
    } catch (err) {
      setError(err.message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  // FIX H4: Provide a way to sync individual fetched stages to the global list
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

  const fetchStageById = useCallback(async (id) => {
    try {
      const response = await api.get(`/stages/${id}`)
      if (response.data.success) {
        updateLocalStage(response.data.data)
        return response.data.data
      }
      return null
    } catch (err) {
      logger.error('Error fetching stage:', err)
      return null
    }
  }, [updateLocalStage])

  const fetchStageBySlug = useCallback(async (slug) => {
    try {
      const response = await api.get(`/stages/slug/${slug}`)
      if (response.data.success) {
        updateLocalStage(response.data.data)
        return response.data.data
      }
      return null
    } catch (err) {
      logger.error('Error fetching stage by slug:', err)
      return null
    }
  }, [updateLocalStage])

  const fetchCategoriesForStage = useCallback(async (stageId) => {
    try {
      const response = await api.get(`/stages/${stageId}/categories`)
      if (response.data.success) {
        return response.data.data
      }
      return []
    } catch (err) {
      logger.error('Error fetching categories for stage:', err)
      return []
    }
  }, [])

  const fetchCategoryTreeForStage = useCallback(async (stageId) => {
    try {
      const response = await api.get(`/stages/${stageId}/categories/tree`)
      if (response.data.success) {
        return response.data.data
      }
      return []
    } catch (err) {
      logger.error('Error fetching category tree for stage:', err)
      return []
    }
  }, [])

  const fetchTestsForStage = useCallback(async (stageId) => {
    try {
      const response = await api.get(`/stages/${stageId}/tests`)
      if (response.data.success) {
        return response.data.data
      }
      return []
    } catch (err) {
      logger.error('Error fetching tests for stage:', err)
      return []
    }
  }, [])

  /** Admin-only: linked exams, categories, series, tests (H3). */
  const fetchStageDetailsAdmin = useCallback(async (stageId) => {
    try {
      const response = await api.get(`/admin/stages/${stageId}/details`)
      if (response.data.success) return response.data.data
      return null
    } catch (err) {
      logger.error('Error fetching admin stage details:', err)
      return null
    }
  }, [])

  // FIX H1: Use consistent single-string matching strategy to improve performance
  const getStageById = useCallback((stageId) => {
    if (!stageId) return null;
    const searchId = String(stageId);
    return stages.find(s => String(s.id || s._id) === searchId) || null;
  }, [stages])

  const getStageName = useCallback((stageId) => {
    return getStageById(stageId)?.name || null;
  }, [getStageById])

  const getStageOptions = useCallback(() => {
    return stages.map(stage => ({
      value: stage.id || stage._id,
      label: stage.name,
      slug: stage.slug,
      icon: stage.icon,
      description: stage.description
    }))
  }, [stages])

  // FIX BUG-036: Add CRUD methods to hook
  const createStage = async (stageData) => {
    const response = await api.post('/stages', stageData)
    if (response.data.success) await fetchStages()
    return response
  }

  const updateStage = async (id, stageData) => {
    const response = await api.put(`/stages/${id}`, stageData)
    if (response.data.success) await fetchStages()
    return response
  }

  const deleteStage = async (id) => {
    const response = await api.delete(`/stages/${id}`)
    if (response.data.success) await fetchStages()
    return response
  }

  const getStageNames = useCallback(() => {
    return stages.map(s => s.name)
  }, [stages])

  // FIX M4: Removed duplicate getDefaultStageOptions — use getStageOptions() instead

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