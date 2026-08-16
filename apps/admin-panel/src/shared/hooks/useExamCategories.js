import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '../lib/dataService'

let cachedCategories = null
let cachedExamInfo = null
let cachedExams = null
let categoriesPromise = null
let examInfoPromise = null
let examsPromise = null
let lastFetchedTime = 0
const HOOK_CACHE_TTL = 60_000

export function useExamCategories() {
  const [categories, setCategories] = useState(() => cachedCategories || [])
  const [examInfo, setExamInfo] = useState(() => cachedExamInfo || [])
  // Exams from the 'exams' table (exam sub-categories are handled via the exams table)
  const [exams, setExams] = useState(() => cachedExams || [])
  const [loading, setLoading] = useState(() => !cachedCategories || !cachedExamInfo || !cachedExams)
  const [error, setError] = useState(null)

  const fetchCategories = useCallback(async (force = false) => {
    if (!force && cachedCategories && Date.now() - lastFetchedTime < HOOK_CACHE_TTL) {
      setCategories(cachedCategories)
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (!categoriesPromise || force) {
        categoriesPromise = apiClient.get('/exam-categories')
          .then(response => {
            const data = response.data
            if (data.success) {
              const filtered = data.data
                .filter(cat => cat.id !== 'all' && cat.isActive !== false)
                .sort((a, b) => (a.order || 0) - (b.order || 0))
              cachedCategories = filtered
              lastFetchedTime = Date.now()
              return filtered
            }
            throw new Error(data.message || 'Failed to fetch categories')
          })
          .finally(() => { categoriesPromise = null })
      }
      const data = await categoriesPromise
      setCategories(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchExamInfo = useCallback(async (force = false) => {
    if (!force && cachedExamInfo && Date.now() - lastFetchedTime < HOOK_CACHE_TTL) {
      setExamInfo(cachedExamInfo)
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (!examInfoPromise || force) {
        examInfoPromise = apiClient.get('/exam-info')
          .then(response => {
            const data = response.data
            if (data.success) {
              const filtered = data.data.filter(exam => exam.isActive !== false)
              cachedExamInfo = filtered
              lastFetchedTime = Date.now()
              return filtered
            }
            throw new Error(data.message || 'Failed to fetch exam info')
          })
          .finally(() => { examInfoPromise = null })
      }
      const data = await examInfoPromise
      setExamInfo(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch exams from the database (now stored in exams table)
  const fetchExams = useCallback(async (force = false) => {
    if (!force && cachedExams && Date.now() - lastFetchedTime < HOOK_CACHE_TTL) {
      setExams(cachedExams)
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (!examsPromise || force) {
        examsPromise = apiClient.get('/exam-categories/')
          .then(response => {
            const data = response.data
            if (data.success) {
              const filtered = data.data
                .filter(exam => exam.isActive !== false)
                .map(exam => ({
                  ...exam,
                  id: exam.id || exam._id,
                  name: exam.name || exam.title,
                  description: exam.description || exam.fullName || '',
                  parentCategoryId: exam.parentCategoryId || exam.categoryId
                }))
              cachedExams = filtered
              lastFetchedTime = Date.now()
              return filtered
            }
            throw new Error(data.message || 'Failed to fetch exams')
          })
          .finally(() => { examsPromise = null })
      }
      const data = await examsPromise
      setExams(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Get exams for a specific category
  const getExamsByCategory = useCallback((categoryId) => {
    if (!categoryId) return []
    
    const category = categories.find(cat =>
      String(cat.id) === String(categoryId) ||
      String(cat.label) === String(categoryId) ||
      String(cat.slug) === String(categoryId) ||
      String(cat.categoryId) === String(categoryId)
    )

    const categoryKeys = [
      categoryId,
      category?.id,
      category?.categoryId,
      category?.slug
    ]
      .filter(Boolean)
      .map(v => String(v).toLowerCase())

    const fromExams = exams
      .filter(exam => {
        const examCategoryKeys = [exam.parentCategoryId, exam.categoryId]
          .filter(Boolean)
          .map(v => String(v).toLowerCase())
        return examCategoryKeys.some(k => categoryKeys.includes(k))
      })
      .map(exam => {
        const label = exam.name || exam.title || exam.fullName || ''
        if (!label) return null
        return {
          value: exam.id || exam.examId,
          label,
          fullName: exam.fullName || exam.description || exam.name || exam.title || ''
        }
      })
      .filter(Boolean)

    // Merge with examInfo fallback for missing exam rows in exams table.
    // NOTE: Do NOT fall back to exam.examId as label — if there's no title/fullName
    // the row has no usable display name and should be skipped by callers.
    const fromExamInfo = examInfo
      .filter(exam => {
        const key = String(exam.categoryId || '').toLowerCase()
        return key && categoryKeys.includes(key)
      })
      .map(exam => {
        const label = exam.title || exam.fullName || ''
        if (!label) return null
        return {
          value: exam.examId,
          label,
          fullName: exam.fullName || exam.title || ''
        }
      })
      .filter(Boolean)

    const merged = [...fromExams, ...fromExamInfo]
    const seen = new Set()
    return merged
      .filter(item => {
        const key = String(item.value)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => {
        const aExam = exams.find(e => String(e.id || e.examId) === String(a.value))
        const bExam = exams.find(e => String(e.id || e.examId) === String(b.value))
        return (aExam?.displayOrder ?? aExam?.display_order ?? 0) - (bExam?.displayOrder ?? bExam?.display_order ?? 0)
      })
  }, [exams, examInfo, categories])

  // Get all exams as flat array
  const getAllExams = useCallback(() => {
    return exams
      .map(exam => ({
        value: exam.id,
        label: exam.name,
        parentCategoryId: exam.parentCategoryId,
        fullName: exam.description || exam.name
      }))
      .sort((a, b) => {
        const aExam = exams.find(e => String(e.id) === String(a.value))
        const bExam = exams.find(e => String(e.id) === String(b.value))
        return (aExam?.displayOrder ?? aExam?.display_order ?? 0) - (bExam?.displayOrder ?? bExam?.display_order ?? 0)
      })
  }, [exams])

  // Get subcategories for a specific category from examInfo (legacy fallback)
  const getSubcategoriesFromExamInfo = useCallback((categoryId) => {
    if (!categoryId) return []
    
    // Find the category to get its categoryId/slug for matching
    const category = categories.find(cat => 
      String(cat.id) === String(categoryId) || 
      cat.label === categoryId ||
      cat.slug === categoryId ||
      cat.categoryId === categoryId
    )
    
    const categoryKey = category?.categoryId || category?.slug || String(categoryId).toLowerCase()
    
    return examInfo
      .filter(exam => 
        exam.categoryId === categoryId ||
        exam.categoryId === categoryKey ||
        exam.categoryId?.toLowerCase() === categoryKey?.toLowerCase()
      )
      .map(exam => ({
        value: exam.examId,
        label: exam.title,
        fullName: exam.fullName
      }))
  }, [examInfo, categories])

  // Get all subcategories from examInfo (legacy fallback)
  const getAllSubcategoriesFromExamInfo = useCallback(() => {
    return examInfo.map(exam => ({
      value: exam.examId,
      label: exam.title,
      categoryId: exam.categoryId,
      fullName: exam.fullName
    }))
  }, [examInfo])

  // Get category label by ID
  const getCategoryLabel = useCallback((categoryId) => {
    const category = categories.find(cat => cat.id === categoryId)
    return category ? category.label : categoryId
  }, [categories])

  // Get exam info by category and exam ID
  const getExamInfo = useCallback((categoryId, examId) => {
    return examInfo.find(exam => exam.categoryId === categoryId && exam.examId === examId)
  }, [examInfo])

  // Get exam by ID
  const getExamById = useCallback((examId) => {
    return exams.find(exam => exam.id === examId)
  }, [exams])

  // Legacy aliases for backward compatibility
  const getSubcategories = getExamsByCategory
  const getAllSubcategories = getAllExams
  const getSubCategoryById = getExamById
  const fetchExamSubCategories = fetchExams

  // Initial fetch
  useEffect(() => {
    fetchCategories()
    fetchExamInfo()
    fetchExams()
  }, [fetchCategories, fetchExamInfo, fetchExams])

  return {
    categories,
    examInfo,
    exams,
    examSubCategories: exams, // Legacy alias for backward compatibility
    loading,
    error,
    fetchCategories,
    fetchExamInfo,
    fetchExams,
    fetchExamSubCategories: fetchExams, // Legacy alias
    getExamsByCategory,
    getAllExams,
    getExamById,
    // Legacy aliases
    getSubcategories,
    getAllSubcategories,
    getSubcategoriesFromExamInfo,
    getAllSubcategoriesFromExamInfo,
    getCategoryLabel,
    getExamInfo,
    getSubCategoryById,
    refresh: () => {
      fetchCategories()
      fetchExamInfo()
      fetchExams()
    }
  }
}

export default useExamCategories