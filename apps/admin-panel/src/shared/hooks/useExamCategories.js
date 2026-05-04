import { useState, useEffect, useCallback } from 'react'
import { API_URL } from '../lib/apiBase.js'


export function useExamCategories() {
  const [categories, setCategories] = useState([])
  const [examInfo, setExamInfo] = useState([])
  // Exams from the 'exams' table (exam sub-categories are handled via the exams table)
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/exam-categories`)
      const data = await response.json()
      if (data.success) {
        // Filter out "All Exams" and active only
        const filteredCategories = data.data
          .filter(cat => cat.id !== 'all' && cat.isActive !== false)
          .sort((a, b) => (a.order || 0) - (b.order || 0))
        setCategories(filteredCategories)
      } else {
        setError(data.message || 'Failed to fetch categories')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchExamInfo = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/exam-info`)
      const data = await response.json()
      if (data.success) {
        // Filter active only
        const filteredExamInfo = data.data.filter(exam => exam.isActive !== false)
        setExamInfo(filteredExamInfo)
      } else {
        setError(data.message || 'Failed to fetch exam info')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch exams from the database (now stored in exams table)
  const fetchExams = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/exam-categories/`)
      const data = await response.json()
      if (data.success) {
        // Filter active only and map to expected format
        const filteredExams = data.data
          .filter(exam => exam.isActive !== false)
          .map(exam => ({
            ...exam,
            // Ensure backward compatibility with field names
            id: exam.id || exam._id,
            name: exam.name || exam.title,
            description: exam.description || exam.fullName || '',
            parentCategoryId: exam.parentCategoryId || exam.categoryId
          }))
        setExams(filteredExams)
      } else {
        setError(data.message || 'Failed to fetch exams')
      }
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
      .map(exam => ({
        value: exam.id || exam.examId,
        label: exam.name || exam.title || exam.fullName || exam.id,
        fullName: exam.fullName || exam.description || exam.name || exam.title
      }))

    // Merge with examInfo fallback for missing exam rows in exams table
    const fromExamInfo = examInfo
      .filter(exam => {
        const key = String(exam.categoryId || '').toLowerCase()
        return key && categoryKeys.includes(key)
      })
      .map(exam => ({
        value: exam.examId,
        label: exam.title || exam.fullName || exam.examId,
        fullName: exam.fullName || exam.title
      }))

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