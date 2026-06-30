// Consolidated Data Service - Combines API client and data fetching functionality
import axios from 'axios'
import { API_BASE_URL } from './apiBase.js'
import { getCsrfToken } from '@trstprep/shared-config'

// Mapping functions (inline to avoid circular dependency)
function mapTestSeriesToFrontend(series) {
  if (!series) return null
  return {
    id: series._id || series.id || series.public_id,
    ...series
  }
}

function mapTestToFrontend(test) {
  if (!test) return null
  return {
    id: test._id || test.id || test.public_id,
    ...test
  }
}

function mapQuestionToFrontend(question) {
  if (!question) return null
  return {
    id: question._id || question.id || question.public_id,
    ...question
  }
}

// Error types
export class DataError extends Error {
  constructor(message, code, details = null) {
    super(message)
    this.name = 'DataError'
    this.code = code
    this.details = details
  }
}

export class NetworkError extends DataError {
  constructor(message, details = null) {
    super(message, 'NETWORK_ERROR', details)
    this.name = 'NetworkError'
  }
}

export class ValidationError extends DataError {
  constructor(message, details = null) {
    super(message, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends DataError {
  constructor(message, details = null) {
    super(message, 'AUTHENTICATION_ERROR', details)
    this.name = 'AuthenticationError'
  }
}

export class NotFoundError extends DataError {
  constructor(message, details = null) {
    super(message, 'NOT_FOUND_ERROR', details)
    this.name = 'NotFoundError'
  }
}

const apiUrl = `${API_BASE_URL}/api`
const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || ''

const apiClient = axios.create({
  baseURL: apiUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    ...(ADMIN_API_KEY && { 'X-Admin-API-Key': ADMIN_API_KEY }),
  },
  withCredentials: true, // Enable cookies for httpOnly token storage (Issue #21)
})

// Request interceptor - httpOnly cookies + CSRF token + Admin API Key (Issue #42)
// SECURITY: No localStorage token fallback - relying exclusively on httpOnly cookies (Audit Fix #CRIT-03)
apiClient.interceptors.request.use(
  (config) => {
    // Add Admin API Key if configured
    if (ADMIN_API_KEY && !config.headers['X-Admin-API-Key']) {
      config.headers['X-Admin-API-Key'] = ADMIN_API_KEY
    }
    
    // Add CSRF token for mutation requests (POST, PUT, DELETE, PATCH)
    const method = config.method?.toUpperCase()
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      // SEC-07: Get CSRF token from closure-based getter (no window global)
      const csrfToken = getCsrfToken()
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken
      }
    }
    
    return config
  },
  (error) => {
    return Promise.reject(new NetworkError('Request setup failed', error))
  }
)

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response
      const message = data?.message || error.message || 'Unknown error'
      
      switch (status) {
        case 400:
          return Promise.reject(new ValidationError(message, data))
        case 401:
          // SECURITY: No localStorage token cleanup needed - httpOnly cookies handled by backend (Audit Fix #CRIT-03)
          try {
            sessionStorage.removeItem('trstprep_session')
            sessionStorage.removeItem('trstprep_user')
          } catch (e) {
            // sessionStorage may not be available in all contexts
          }
          window.dispatchEvent(new Event('unauthorized'))
          return Promise.reject(new AuthenticationError(message, data))
        case 403:
          if (data?.code === 'ADMIN_API_KEY_REQUIRED') {
            console.error('[Admin API] API key required. Set VITE_ADMIN_API_KEY environment variable.')
          }
          return Promise.reject(new AuthenticationError('Access forbidden', data))
        case 404:
          return Promise.reject(new NotFoundError(message, data))
        case 500:
          return Promise.reject(new DataError('Server error', 'SERVER_ERROR', data))
        default:
          return Promise.reject(new DataError(message, `HTTP_${status}`, data))
      }
    } else if (error.request) {
      // Network error
      return Promise.reject(new NetworkError('Network error - please check your connection', error.request))
    } else {
      // Request setup error
      return Promise.reject(new NetworkError('Request failed', error.message))
    }
  }
)

/**
 * Generic fetch wrapper for backward compatibility with older components
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Request options
 */
export const fetchFromAPI = async (endpoint, options = {}) => {
  try {
    const config = {
      url: endpoint,
      method: options.method || 'GET',
      headers: options.headers || {},
      ...options
    }
    
    // Convert body to data for axios if present
    if (options.body) {
      try {
        config.data = typeof options.body === 'string' ? JSON.parse(options.body) : options.body
      } catch (e) {
        config.data = options.body
      }
      delete config.body
    }

    const response = await apiClient(config)
    return response.data
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error)
    // Extract data if it's an axios error with response
    if (error.response?.data) {
      return error.response.data
    }
    throw error
  }
}

// ===== AUTH API =====
export const authAPI = {
  login: (email, password) => {
    if (!email || !password) {
      throw new ValidationError('Email and password are required')
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw new ValidationError('Please enter a valid email address')
    }
    if (password.length < 6) {
      throw new ValidationError('Password must be at least 6 characters')
    }
    return apiClient.post('/auth/login', { email, password })
  },
  register: (data) => {
    const required = ['name', 'email', 'password']
    for (const field of required) {
      if (!data[field]) {
        throw new ValidationError(`${field} is required`)
      }
    }
    if (!/^\S+@\S+\.\S+$/.test(data.email)) {
      throw new ValidationError('Please enter a valid email address')
    }
    if (data.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters')
    }
    return apiClient.post('/auth/register', data)
  },
  logout: () => apiClient.post('/auth/logout'),
  getMe: () => apiClient.get('/auth/me'),
  refreshToken: () => apiClient.post('/auth/refresh'),
}

// ===== SERIES API =====
export const seriesAPI = {
  // Uses public endpoint which now includes calculated test counts
  getAll: () => apiClient.get('/series'),
  getById: (id) => {
    if (!id) throw new ValidationError('Test Series ID is required')
    return apiClient.get(`/series/${id}`)
  },
  create: (data) => {
    if (!data.title || !data.category) {
      throw new ValidationError('Title and category are required')
    }
    return apiClient.post('/admin/test-series', data)
  },
  update: (id, data) => {
    if (!id) throw new ValidationError('Test Series ID is required')
    return apiClient.put(`/admin/test-series/${id}`, data)
  },
  delete: (id) => {
    if (!id) throw new ValidationError('Test Series ID is required')
    return apiClient.delete(`/admin/test-series/${id}`)
  },
  getByCategory: (category) => {
    if (!category) throw new ValidationError('Category is required')
    return apiClient.get(`/series/category/${category}`)
  },
  getTests: (seriesId) => {
    if (!seriesId) throw new ValidationError('Test Series ID is required')
    return apiClient.get(`/series/${seriesId}/tests`)
  },
}


// ===== TESTS API =====
export const testsAPI = {
  getAll: () => apiClient.get('/admin/tests'), // Admin endpoint
  getById: (id) => {
    if (!id) throw new ValidationError('Test ID is required')
    return apiClient.get(`/tests/${id}`)
  },
  getByTag: (tag) => {
    if (!tag) throw new ValidationError('Tag is required')
    return apiClient.get(`/tests/tag/${tag}`)
  },
  getBySeriesId: (seriesId) => {
    if (!seriesId) throw new ValidationError('Test Series ID is required')
    return apiClient.get(`/tests/series/${seriesId}`)
  },
  getQuestions: (testId) => {
    if (!testId) throw new ValidationError('Test ID is required')
    return apiClient.get(`/tests/${testId}/questions`)
  },
  startAttempt: (testId) => {
    if (!testId) throw new ValidationError('Test ID is required')
    return apiClient.post(`/tests/${testId}/start`)
  },
  submitAttempt: (testId, data) => {
    if (!testId) throw new ValidationError('Test ID is required')
    if (!data || !Array.isArray(data.answers)) {
      throw new ValidationError('Answers array is required')
    }
    return apiClient.put(`/tests/${testId}/submit`, data)
  },
  getResult: (testId, attemptId) => {
    if (!testId) throw new ValidationError('Test ID is required')
    if (!attemptId) throw new ValidationError('Attempt ID is required')
    return apiClient.get(`/tests/${testId}/result/${attemptId}`)
  },
  // Attempt management - pause/resume/save-progress
  attempt: {
    start: (testId, seriesId) => {
      if (!testId) throw new ValidationError('Test ID is required')
      return apiClient.post('/attempt/start', { testId, testSeriesId: seriesId })
    },
    pause: (attemptId, data) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.post('/attempt/pause', { attemptId, ...data })
    },
    resume: (attemptId) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.post('/attempt/resume', { attemptId })
    },
    saveProgress: (attemptId, data) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.post('/attempt/save-progress', { attemptId, ...data })
    },
    getState: (attemptId) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.get(`/attempt/${attemptId}/state`)
    },
    logEvent: (attemptId, eventType, data) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      if (!eventType) throw new ValidationError('Event type is required')
      return apiClient.post(`/attempt/${attemptId}/event`, { eventType, ...data })
    },
    getAnalytics: (attemptId) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.get(`/attempt/${attemptId}/analytics`)
    }
  },
  create: (data) => {
    if (!data.title) {
      throw new ValidationError('title is required')
    }
    if (!data.testSeriesId && !data.seriesId) {
      throw new ValidationError('testSeriesId is required')
    }
    return apiClient.post('/admin/tests', data)
  },
  update: (id, data) => {
    if (!id) throw new ValidationError('Test ID is required')
    return apiClient.put(`/admin/tests/${id}`, data)
  },
  delete: (id) => {
    if (!id) throw new ValidationError('Test ID is required')
    return apiClient.delete(`/admin/tests/${id}`)
  },
}

// ===== USER API =====
export const userAPI = {
  getProfile: () => apiClient.get('/users/profile'),
  updateProfile: (data) => {
    if (!data || Object.keys(data).length === 0) {
      throw new ValidationError('Profile data is required')
    }
    return apiClient.put('/users/profile', data)
  },
  enrollSeries: (seriesId) => {
    if (!seriesId) throw new ValidationError('Test Series ID is required')
    return apiClient.post(`/users/enroll/${seriesId}`)
  },
  unenrollFromSeries: (seriesId) => {
    if (!seriesId) throw new ValidationError('Test Series ID is required')
    return apiClient.delete(`/users/unenroll/${seriesId}`)
  },
  getEnrolledSeries: () => apiClient.get('/users/enrolled-series'),
  getAttempts: () => apiClient.get('/users/attempts'),
  getAnalytics: () => apiClient.get('/users/analytics'),
  deleteAccount: () => apiClient.delete('/users/profile'),
}

// ===== NOTIFICATION PREF API =====
export const notificationPrefAPI = {
  subscribe: (data) => apiClient.post('/notifications-pref/subscribe', data),
}

// ===== STUDY API =====
// NOTE: Public study routes use SLUG-based routing, not ID-based
// - GET /study - Get all study materials
// - GET /study/:slug - Get study material by slug
// - GET /study/:slug/chapters - Get chapters by slug
// Admin routes use ID-based routing (see adminAPI.studyMaterials)
export const studyAPI = {
  // Get all study materials (public)
  getAll: () => apiClient.get('/study'),
  
  // Get study material by SLUG (public endpoint uses slug, not ID)
  getBySlug: (slug) => {
    if (!slug) throw new ValidationError('Study material slug is required')
    return apiClient.get(`/study/${slug}`)
  },
  
  // Alias for backward compatibility - accepts either slug or id
  // WARNING: This calls the slug-based endpoint, so pass slug not ID
  getById: (slugOrId) => {
    if (!slugOrId) throw new ValidationError('Study material slug or ID is required')
    return apiClient.get(`/study/${slugOrId}`)
  },
  
  // Get chapters for a study material by SLUG
  getChaptersBySlug: (slug) => {
    if (!slug) throw new ValidationError('Study material slug is required')
    return apiClient.get(`/study/${slug}/chapters`)
  },
  
  // Alias for backward compatibility - accepts either slug or id
  // WARNING: This calls the slug-based endpoint, so pass slug not ID
  getChapters: (slugOrId) => {
    if (!slugOrId) throw new ValidationError('Study material slug or ID is required')
    return apiClient.get(`/study/${slugOrId}/chapters`)
  },
  
  // Get a specific resource (alias for getBySlug)
  getResource: (slug) => {
    if (!slug) throw new ValidationError('Resource slug is required')
    return apiClient.get(`/study/${slug}`)
  },
}

// ===== QUESTIONS API =====
export const questionsAPI = {
  getAll: async ({ page = 1, limit = 50 } = {}) => {
    const res = await apiClient.get('/admin/questions', { params: { limit, offset: (page - 1) * limit } })
    return res
  },
  getByTestId: (testId) => {
    if (!testId) throw new ValidationError('Test ID is required')
    return apiClient.get(`/questions/test/${testId}`)
  },
  create: (data) => {
    const required = ['text', 'options', 'correct', 'testId']
    for (const field of required) {
      if (!data[field]) {
        throw new ValidationError(`${field} is required`)
      }
    }
    if (!Array.isArray(data.options) || data.options.length < 2) {
      throw new ValidationError('At least 2 options are required')
    }
    if (data.correct < 0 || data.correct >= data.options.length) {
      throw new ValidationError('Invalid correct answer index')
    }
    return apiClient.post('/admin/questions', data)
  },
  update: (id, data) => {
    if (!id) throw new ValidationError('Question ID is required')
    return apiClient.put(`/admin/questions/${id}`, data)
  },
  delete: (id) => {
    if (!id) throw new ValidationError('Question ID is required')
    return apiClient.delete(`/admin/questions/${id}`)
  },
  bulkUpload: (data) => {
    if (!data || !Array.isArray(data.questions)) {
      throw new ValidationError('Questions array is required')
    }
    if (data.questions.length === 0) {
      throw new ValidationError('At least one question is required')
    }
    return apiClient.post('/admin/questions/bulk', data)
  },
}

// ===== EXAM DATA API =====
export const examAPI = {
  getCategories: () => apiClient.get('/admin/exam-categories'),
  getExams: () => apiClient.get('/exams'),
  getExamInfo: () => apiClient.get('/admin/exam-info'),
  getExamUpdates: (examId) => apiClient.get(`/exam-info/${examId}/updates`),
  getExamYearlyData: (examId) => apiClient.get(`/exam-info/${examId}/yearly-data`),
  getPublicStats: () => apiClient.get('/public-stats'),
  getTestimonials: () => apiClient.get('/testimonials'),
  getPromotions: () => apiClient.get('/promotions'),
}

// ===== ADMIN API =====
export const adminAPI = {
  apiClient,
  // Users
  getUsers: () => apiClient.get('/admin/users'),
  updateUserProPass: (userId, data) => apiClient.put(`/admin/users/${userId}/pro-pass`, data),
  deleteUser: (userId) => apiClient.delete(`/admin/users/${userId}`),

  // Stages
  getStages: () => apiClient.get('/admin/stages/with-test-counts'),
  getStageDetails: (stageId) => apiClient.get(`/admin/stages/${stageId}/details`),
  createStage: (data) => apiClient.post('/admin/stages', data),
  updateStage: (id, data) => apiClient.put(`/admin/stages/${id}`, data),
  deleteStage: (id) => apiClient.delete(`/admin/stages/${id}`),
  
  // Test Series
  getTestSeries: (params) => apiClient.get('/admin/test-series', { params }),
  createTestSeries: (data) => apiClient.post('/admin/test-series', data),
  updateTestSeries: (id, data) => apiClient.put(`/admin/test-series/${id}`, data),
  deleteTestSeries: (id, permanent = false) => apiClient.delete(`/admin/test-series/${id}${permanent ? '?permanent=true' : ''}`),
  
  // Tests
  getTests: (params) => apiClient.get('/admin/tests', { params }),
  getTestCategories: (params) => apiClient.get('/admin/test-categories', { params }),
  createTest: (data) => apiClient.post('/admin/tests', data),
  updateTest: (id, data) => apiClient.put(`/admin/tests/${id}`, data),
  deleteTest: (id) => apiClient.delete(`/admin/tests/${id}`, { timeout: 60000 }),
  publishTest: (id) => apiClient.post(`/admin/tests/${id}/publish`, {}, { timeout: 60000 }),
  unpublishTest: (id) => apiClient.post(`/admin/tests/${id}/unpublish`, {}, { timeout: 60000 }),
  bulkUploadTests: (formData) => apiClient.post('/admin/tests/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  bulkUploadQuizzes: (formData) => apiClient.post('/admin/quizzes/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000
  }),
  
  // Full Test JSON Import
  previewFullTest: (formData) => apiClient.post('/import/full-test/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000
  }),
  importFullTest: (formData) => apiClient.post('/import/full-test/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000
  }),
  uploadFullTestJson: (formData) => apiClient.post('/import/full-test/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000
  }),
  previewSingleTest: (index) => apiClient.get(`/import/full-test/preview-test/${index}`, { timeout: 300000 }),
  importSelectedTests: (data) => apiClient.post('/import/full-test/import-selected', data, { timeout: 300000 }),
  
  // Test Categories
  createTestCategory: (data) => apiClient.post('/admin/test-categories', data),
  updateTestCategory: (id, data) => apiClient.put(`/admin/test-categories/${id}`, data),
  deleteTestCategory: (id) => apiClient.delete(`/admin/test-categories/${id}`),
  
  // Exams
  getExams: () => apiClient.get('/exams'),

  // Test Sections
  getSections: (params = {}) => {
    const query = new URLSearchParams()
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, value)
      }
    })
    const qs = query.toString()
    return apiClient.get(`/admin/sections${qs ? `?${qs}` : ''}`, { timeout: 60000 })
  },
  getSectionsForTest: (params = {}) => {
    const query = new URLSearchParams()
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query.append(key, value)
      }
    })
    const qs = query.toString()
    return apiClient.get(`/admin/sections/for-test${qs ? `?${qs}` : ''}`, { timeout: 60000 })
  },
  createSection: (data) => apiClient.post('/admin/sections', data),
  updateSection: (id, data) => apiClient.put(`/admin/sections/${id}`, data),
  deleteSection: (id) => apiClient.delete(`/admin/sections/${id}`),
  applySectionPreset: (data) => apiClient.post('/admin/sections/preset', data),
  dedupSections: () => apiClient.post('/admin/sections/dedup'),
  getSectionAliases: () => apiClient.get('/admin/sections/aliases'),
  createSectionAlias: (data) => apiClient.post('/admin/sections/aliases', data),
  updateSectionAlias: (id, data) => apiClient.put(`/admin/sections/aliases/${id}`, data),
  deleteSectionAlias: (id) => apiClient.delete(`/admin/sections/aliases/${id}`),
  resolveSectionAlias: (name) => apiClient.get(`/admin/sections/resolve/${encodeURIComponent(name)}`),
  seedTemplates: () => apiClient.post('/admin/sections/seed-templates'),
  
  // Study Materials
  getStudyMaterials: (deleted = false) => apiClient.get(`/admin/study-materials${deleted ? '?deleted=true' : ''}`),
  createStudyMaterial: (data) => apiClient.post('/admin/study-materials', data),
  updateStudyMaterial: (id, data) => apiClient.put(`/admin/study-materials/${id}`, data),
  deleteStudyMaterial: (id, permanent = false) => apiClient.delete(`/admin/study-materials/${id}${permanent ? '?permanent=true' : ''}`),
  restoreStudyMaterial: (id) => apiClient.put(`/admin/study-materials/${id}/restore`),
  reorderStudyMaterials: (orderedIds) => {
    return Promise.all(orderedIds.map((id, index) => 
      apiClient.put(`/admin/study-materials/${id}`, { order: index })
    ))
  },
  
  // Chapters (for study materials)
  getChapters: (studyMaterialId) => {
    const query = studyMaterialId ? `?studyMaterialId=${studyMaterialId}` : ''
    return apiClient.get(`/admin/chapters${query}`)
  },
  createChapter: (data) => apiClient.post('/admin/chapters', data),
  updateChapter: (id, data) => apiClient.put(`/admin/chapters/${id}`, data),
  deleteChapter: (id) => apiClient.delete(`/admin/chapters/${id}`),
  
  // Subject Videos
  getSubjectVideos: (studyMaterialId, chapterId) => {
    const params = new URLSearchParams()
    if (studyMaterialId) params.append('studyMaterialId', studyMaterialId)
    if (chapterId) params.append('chapterId', chapterId)
    const query = params.toString() ? `?${params.toString()}` : ''
    return apiClient.get(`/admin/subject-videos${query}`)
  },
  createSubjectVideo: (data) => apiClient.post('/admin/subject-videos', data),
  updateSubjectVideo: (id, data) => apiClient.put(`/admin/subject-videos/${id}`, data),
  deleteSubjectVideo: (id) => apiClient.delete(`/admin/subject-videos/${id}`),
  
  // Subject PDFs
  getSubjectPdfs: (studyMaterialId, chapterId) => {
    const params = new URLSearchParams()
    if (studyMaterialId) params.append('studyMaterialId', studyMaterialId)
    if (chapterId) params.append('chapterId', chapterId)
    const query = params.toString() ? `?${params.toString()}` : ''
    return apiClient.get(`/admin/subject-pdfs${query}`)
  },
  createSubjectPdf: (data) => apiClient.post('/admin/subject-pdfs', data),
  updateSubjectPdf: (id, data) => apiClient.put(`/admin/subject-pdfs/${id}`, data),
  deleteSubjectPdf: (id) => apiClient.delete(`/admin/subject-pdfs/${id}`),
  
  // Topic Tests
  getTopicTests: (studyMaterialId, chapterId) => {
    const params = new URLSearchParams()
    if (studyMaterialId) params.append('studyMaterialId', studyMaterialId)
    if (chapterId) params.append('chapterId', chapterId)
    const query = params.toString() ? `?${params.toString()}` : ''
    return apiClient.get(`/admin/topic-tests${query}`)
  },
  createTopicTest: (data) => apiClient.post('/admin/topic-tests', data),
  deleteTopicTest: (id) => apiClient.delete(`/admin/topic-tests/${id}`),
  
  // Trash
  getTrash: () => apiClient.get('/admin/trash'),
  restoreTrashItem: (itemId) => apiClient.put(`/admin/trash/${itemId}/restore`),
  deleteTrashItem: (itemId) => apiClient.delete(`/admin/trash/${itemId}`),
  emptyTrash: () => apiClient.delete('/admin/trash'),
  
  // Questions
  getQuestions: () => apiClient.get('/admin/questions'),
  getQuestionCountsByTest: () => apiClient.get('/admin/questions/count-by-test'),
  createQuestion: (data) => apiClient.post('/admin/questions', data),
  updateQuestion: (id, data) => apiClient.put(`/admin/questions/${id}`, data),
  deleteQuestion: (id) => apiClient.delete(`/admin/questions/${id}`),
  bulkUploadQuestions: (formData) => apiClient.post('/admin/questions/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  
  // Exam Categories
  getExamCategories: () => apiClient.get('/admin/exam-categories'),
  createExamCategory: (data) => apiClient.post('/admin/exam-categories', data),
  updateExamCategory: (id, data) => apiClient.put(`/admin/exam-categories/${id}`, data),
  deleteExamCategory: (id) => apiClient.delete(`/admin/exam-categories/${id}`),
  
  // Leaderboards
  getLeaderboards: (params) => apiClient.get('/leaderboards/admin/list', { params }),
  createLeaderboard: (data) => apiClient.post('/leaderboards', data),
  updateLeaderboard: (id, data) => apiClient.put(`/leaderboards/${id}`, data),
  deleteLeaderboard: (id) => apiClient.delete(`/leaderboards/${id}`),
  recalculateLeaderboard: (id) => apiClient.post(`/leaderboards/${id}/recalculate`),
  resetLeaderboard: (id) => apiClient.post(`/leaderboards/${id}/reset`),

  // Banners
  getBanners: () => apiClient.get('/admin/banners'),
  createBanner: (data) => apiClient.post('/admin/banners', data),
  updateBanner: (id, data) => apiClient.put(`/admin/banners/${id}`, data),
  deleteBanner: (id) => apiClient.delete(`/admin/banners/${id}`),

  // FAQs
  getFaqs: () => apiClient.get('/admin/faqs'),
  createFaq: (data) => apiClient.post('/admin/faqs', data),
  updateFaq: (id, data) => apiClient.put(`/admin/faqs/${id}`, data),
  deleteFaq: (id) => apiClient.delete(`/admin/faqs/${id}`),

  // Promotions
  getPromotions: () => apiClient.get('/admin/promotions'),
  createPromotion: (data) => apiClient.post('/admin/promotions', data),
  updatePromotion: (id, data) => apiClient.put(`/admin/promotions/${id}`, data),
  deletePromotion: (id) => apiClient.delete(`/admin/promotions/${id}`),

  // Quizzes
  getQuizzes: () => apiClient.get('/admin/quizzes'),
  createQuiz: (data) => apiClient.post('/admin/quizzes', data),
  updateQuiz: (id, data) => apiClient.put(`/admin/quizzes/${id}`, data),
  deleteQuiz: (id) => apiClient.delete(`/admin/quizzes/${id}`),

  // Live Tests
  getLiveTests: () => apiClient.get('/admin/live-tests'),
  createLiveTest: (data) => apiClient.post('/admin/live-tests', data),
  updateLiveTest: (id, data) => apiClient.put(`/admin/live-tests/${id}`, data),
  deleteLiveTest: (id) => apiClient.delete(`/admin/live-tests/${id}`),
  bulkUploadLiveTests: (data) => apiClient.post('/admin/live-tests/bulk', data, { timeout: 300000 }),

  // PYPs (Previous Year Papers)
  getPYPs: () => apiClient.get('/admin/pyp'),
  createPYP: (data) => apiClient.post('/admin/pyp', data),
  updatePYP: (id, data) => apiClient.put(`/admin/pyp/${id}`, data),
  deletePYP: (id) => apiClient.delete(`/admin/pyp/${id}`),
  bulkUploadPYP: (data) => apiClient.post('/admin/pyp/bulk', data, { timeout: 300000 }),
  
  // Enrollments
  getEnrollments: () => apiClient.get('/admin/enrollments'),
  
  // Results
  getResults: () => apiClient.get('/admin/results'),
  getRecentActivity: () => apiClient.get('/admin/recent-activity'),
  
  // User Analytics
  getUserAnalytics: () => apiClient.get('/users/analytics'),
  
  // Public Leaderboard
  getLeaderboard: (seriesId) => apiClient.get(`/leaderboards?testId=${seriesId}`),
  
  // Bookmarks
  getBookmarks: () => apiClient.get('/bookmarks'),
  createBookmark: (data) => apiClient.post('/bookmarks', data),
  updateBookmark: (id, data) => apiClient.put(`/bookmarks/${id}`, data),
  deleteBookmark: (id) => apiClient.delete(`/bookmarks/${id}`),
  toggleBookmark: (data) => apiClient.post('/bookmarks/toggle', data),
  checkBookmark: (itemType, itemId) => apiClient.get(`/bookmarks/check/${itemType}/${itemId}`),
  
  // Notifications
  getNotifications: (params) => apiClient.get('/notifications', { params }),
  getUnreadCount: () => apiClient.get('/notifications/unread-count'),
  markNotificationRead: (id) => apiClient.put(`/notifications/${id}/read`),
  markAllNotificationsRead: () => apiClient.put('/notifications/read-all'),
  deleteNotification: (id) => apiClient.delete(`/notifications/${id}`),
  
  // Achievements
  getAchievements: () => apiClient.get('/achievements'),
  checkAchievements: () => apiClient.get('/achievements/check'),
  getAchievementLeaderboard: () => apiClient.get('/achievements/leaderboard'),
}

// ===== ADVANCED CACHING SERVICE =====
class CacheService {
  constructor() {
    this.cache = new Map()
    this.cacheTimeouts = new Map()
    this.defaultTTL = 30000 // 30 seconds
    this.longTTL = 300000 // 5 minutes for less frequently changing data
  }

  // Generate cache key
  generateKey(endpoint, params = {}) {
    const paramStr = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&')
    return `${endpoint}?${paramStr}`
  }

  // Set item in cache with TTL
  set(key, data, ttl = this.defaultTTL) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    })
    
    // Clear existing timeout
    if (this.cacheTimeouts.has(key)) {
      clearTimeout(this.cacheTimeouts.get(key))
    }
    
    // Set new timeout to auto-expire
    const timeoutId = setTimeout(() => {
      this.cache.delete(key)
      this.cacheTimeouts.delete(key)
    }, ttl)
    
    this.cacheTimeouts.set(key, timeoutId)
  }

  // Get item from cache if valid
  get(key) {
    const item = this.cache.get(key)
    if (!item) return null
    
    if (Date.now() > item.expiresAt) {
      // Expired, remove it
      this.cache.delete(key)
      if (this.cacheTimeouts.has(key)) {
        clearTimeout(this.cacheTimeouts.get(key))
        this.cacheTimeouts.delete(key)
      }
      return null
    }
    
    return item.data
  }

  // Check if key exists and is valid
  has(key) {
    return this.get(key) !== null
  }

  // Clear specific cache entry
  delete(key) {
    this.cache.delete(key)
    if (this.cacheTimeouts.has(key)) {
      clearTimeout(this.cacheTimeouts.get(key))
      this.cacheTimeouts.delete(key)
    }
  }

  // Clear all cache
  clear() {
    this.cache.clear()
    this.cacheTimeouts.forEach(timeoutId => clearTimeout(timeoutId))
    this.cacheTimeouts.clear()
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

// ===== INTELLIGENT DATA SERVICE =====
class DataService {
  constructor() {
    this.cache = new CacheService()
    this.loadingStates = new Map() // Track loading states to prevent duplicate requests
    this.retryAttempts = new Map() // Track retry attempts
    this.maxRetries = 3
  }

  // Generic fetch with caching and loading state management
  async fetchWithCache(key, fetchFn, options = {}) {
    const { 
      forceRefresh = false, 
      ttl = this.cache.defaultTTL, 
      useCache = true,
      retries = this.maxRetries,
      retryDelay = 1000
    } = options
    
    // Return cached data if available and not forcing refresh
    if (useCache && !forceRefresh) {
      const cached = this.cache.get(key)
      if (cached !== null) {
        return cached
      }
    }
    
    // Prevent duplicate requests
    if (this.loadingStates.get(key)) {
      // Wait for existing request to complete
      await new Promise(resolve => setTimeout(resolve, 100))
      return this.fetchWithCache(key, fetchFn, options)
    }
    
    // Retry logic
    let lastError
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.loadingStates.set(key, true)
        
        const data = await fetchFn()
        
        if (useCache) {
          this.cache.set(key, data, ttl)
        }
        
        // Reset retry counter on success
        this.retryAttempts.delete(key)
        return data
      } catch (error) {
        lastError = error
        console.error(`Fetch attempt ${attempt} failed for ${key}:`, error)
        
        // Don't retry on validation or auth errors
        if (error instanceof ValidationError || error instanceof AuthenticationError) {
          throw error
        }
        
        // Don't retry on last attempt
        if (attempt === retries) {
          break
        }
        
        // Exponential backoff
        const delay = retryDelay * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      } finally {
        this.loadingStates.delete(key)
      }
    }
    
    throw lastError
  }

  // Clear cache for specific endpoints
  clearCacheForEndpoint(endpointPattern) {
    const keysToDelete = []
    for (const key of this.cache.cache.keys()) {
      if (key.includes(endpointPattern)) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key))
  }

  // Clear all cache
  clearCache() {
    this.cache.clear()
  }

  // Get test series with intelligent caching
  async getTestSeries(options = {}) {
    const key = this.cache.generateKey('/admin/test-series')
    return this.fetchWithCache(key, async () => {
      const response = await seriesAPI.getAll()
      // Backend returns { success: true, data: [...] }
      const data = response.data?.data || response.data || []
      return data.map(mapTestSeriesToFrontend)
    }, { 
      ttl: this.cache.longTTL,
      ...options 
    })
  }

  // Get user analytics with caching
  async getUserAnalytics(options = {}) {
    const key = this.cache.generateKey('/users/analytics')
    return this.fetchWithCache(key, async () => {
      const response = await userAPI.getAnalytics()
      return response.data?.data || response.data || null
    }, {
      ttl: 60000, // 1 minute
      ...options
    })
  }


  // Get tests with caching
  async getTests(options = {}) {
    const key = this.cache.generateKey('/admin/tests')
    return this.fetchWithCache(key, async () => {
      const response = await testsAPI.getAll()
      const data = response.data?.data || response.data || []
      return data.map(mapTestToFrontend)
    }, options)
  }

  // Get questions with caching
  async getQuestions(options = {}) {
    const key = this.cache.generateKey('/admin/questions')
    return this.fetchWithCache(key, async () => {
      const response = await questionsAPI.getAll()
      const data = response.data?.data || response.data || []
      return data.map(mapQuestionToFrontend)
    }, options)
  }

  // Get study materials with caching
  async getStudyMaterials(options = {}) {
    const key = this.cache.generateKey('/study')
    return this.fetchWithCache(key, async () => {
      const response = await studyAPI.getAll()
      // Backend returns { success: true, data: [...] }
      return response.data?.data || response.data || []
    }, { 
      ttl: this.cache.longTTL,
      ...options 
    })
  }

  // Get exam categories with caching
  async getExamCategories(options = {}) {
    const key = this.cache.generateKey('/admin/exam-categories')
    return this.fetchWithCache(key, async () => {
      const response = await examAPI.getCategories()
      return response.data?.data || response.data || []
    }, { 
      ttl: this.cache.longTTL,
      ...options 
    })
  }

  // Get exams with caching
  async getExams(options = {}) {
    const key = this.cache.generateKey('/exams')
    return this.fetchWithCache(key, async () => {
      const response = await examAPI.getExams()
      return response.data?.data || response.data || []
    }, { 
      ttl: this.cache.longTTL,
      ...options 
    })
  }

  // Get test categories (Mock, PYP, etc.) with caching
  async getTestCategories(options = {}) {
    const key = this.cache.generateKey('/admin/test-categories')
    return this.fetchWithCache(key, async () => {
      const response = await apiClient.get('/admin/test-categories')
      return response.data?.data || response.data || []
    }, { 
      ttl: this.cache.longTTL,
      ...options 
    })
  }

  // Global search across exams, tests, study materials, and more
  async search(query, type = 'all', options = {}) {
    const key = this.cache.generateKey('/search', { q: query, type })
    return this.fetchWithCache(key, async () => {
      const response = await apiClient.get('/search', { params: { q: query, type } })
      // Normalize to a common structure
      return response.data?.data || response.data || []
    }, {
      ttl: 60000,
      ...options
    })
  }

  // Helper methods with caching
  async getTestSeriesById(id, options = {}) {
    if (!id) throw new ValidationError('Test Series ID is required')
    const allSeries = await this.getTestSeries(options)
    return allSeries.find(s => 
      String(s.id) === String(id) || 
      String(s.slug).toLowerCase() === String(id).toLowerCase() || 
      s.public_id === id ||
      s._id === id ||
      String(s._id) === String(id)
    ) || null
  }

  async getTestsBySeriesId(seriesId, options = {}) {
    if (!seriesId) throw new ValidationError('Test Series ID is required')
    
    const key = this.cache.generateKey(`/tests/series/${seriesId}`)
    return this.fetchWithCache(key, async () => {
      // Use the dedicated backend endpoint which handles slugs and IDs correctly
      const response = await testsAPI.getBySeriesId(seriesId)
      const data = response.data?.data || response.data || []
      const tests = Array.isArray(data) ? data.map(mapTestToFrontend) : []
      return tests
    }, options)
  }

  async getTestById(id, options = {}) {
    if (!id) throw new ValidationError('Test ID is required')
    const allTests = await this.getTests(options)
    // Handle multiple ID formats: numeric id, _id, slug
    // Also convert to string for comparison since URL params are strings
    const idStr = String(id)
    const idNum = Number(id)
    return allTests.find(t => 
      t._id === id || 
      t.id === id ||
      t._id === idStr ||
      t.id === idStr ||
      t.slug === id ||
      t._id === idNum ||
      t.id === idNum ||
      // Also check string versions of numeric IDs in test objects
      String(t._id) === idStr ||
      String(t.id) === idStr
    ) || null
  }

  async getQuestionsByTestId(testId, options = {}) {
    if (!testId) throw new ValidationError('Test ID is required')
    const key = this.cache.generateKey(`/questions/test/${testId}`)
    return this.fetchWithCache(key, async () => {
      try {
        const response = await questionsAPI.getByTestId(testId)
        const questions = response.data?.data || response.data || []
        // Map questions to frontend format
        return questions.map(mapQuestionToFrontend)
      } catch (error) {
        // Fallback: filter from all questions
        const allQuestions = await this.getQuestions(options)
        // Handle multiple ID formats - convert to string and number for comparison
        const testIdStr = String(testId)
        const testIdNum = Number(testId)
        return allQuestions.filter(q => 
          q.testId === testId ||
          q.test_id === testId ||
          q.testId === testIdStr ||
          q.test_id === testIdStr ||
          q.testId === testIdNum ||
          q.test_id === testIdNum ||
          q._id === testId ||
          q.id === testId
        )
      }
    }, options)
  }

  async getStudyMaterialById(id, options = {}) {
    if (!id) throw new ValidationError('Study material ID is required')
    
    // Use the detail endpoint to get full data including chapters
    const key = this.cache.generateKey(`/study/${id}`)
    return this.fetchWithCache(key, async () => {
      const response = await studyAPI.getById(id)
      return response.data?.data || response.data || null
    }, { 
      ttl: this.cache.defaultTTL,
      ...options 
    })
  }

  // Force refresh specific data
  async refreshData(dataType) {
    const refreshMap = {
      'testSeries': () => this.getTestSeries({ forceRefresh: true }),
      'tests': () => this.getTests({ forceRefresh: true }),
      'questions': () => this.getQuestions({ forceRefresh: true }),
      'studyMaterials': () => this.getStudyMaterials({ forceRefresh: true }),
      'examCategories': () => this.getExamCategories({ forceRefresh: true }),
      'exams': () => this.getExams({ forceRefresh: true })
    }
    
    if (refreshMap[dataType]) {
      return await refreshMap[dataType]()
    }
    
    throw new ValidationError(`Unknown data type: ${dataType}`)
  }

  // Force refresh all data
  async forceRefreshAll() {
    this.clearCache()
    await Promise.allSettled([
      this.getTestSeries({ forceRefresh: true }),
      this.getTests({ forceRefresh: true }),
      this.getQuestions({ forceRefresh: true }),
      this.getStudyMaterials({ forceRefresh: true }),
      this.getExamCategories({ forceRefresh: true }),
      this.getExams({ forceRefresh: true })
    ])
  }

  // Handle mutations (clear cache after successful operations)
  async handleMutation(mutationFn, affectedEndpoints = []) {
    try {
      const result = await mutationFn()
      
      affectedEndpoints.forEach(endpoint => {
        this.clearCacheForEndpoint(endpoint)
      })
      
      this.clearCacheForEndpoint('/admin/')
      this.clearCacheForEndpoint('/study')
      
      return result
    } catch (error) {
      console.error('Mutation failed:', error)
      throw error
    }
  }
}

// Create singleton instance
const dataService = new DataService()

// Export individual APIs and data service
export {
  apiClient,
  dataService
}

// Export convenience methods from dataService
export const getTestSeries = (...args) => dataService.getTestSeries(...args)
export const getTests = (...args) => dataService.getTests(...args)
export const getQuestions = (...args) => dataService.getQuestions(...args)
export const getStudyMaterials = (...args) => dataService.getStudyMaterials(...args)
export const getExamCategories = (...args) => dataService.getExamCategories(...args)
export const getTestCategories = (...args) => dataService.getTestCategories(...args)
export const getExams = (...args) => dataService.getExams(...args)
export const searchAll = (...args) => dataService.search(...args)
export const getTestSeriesById = (...args) => dataService.getTestSeriesById(...args)
export const getTestsBySeriesId = (...args) => dataService.getTestsBySeriesId(...args)
export const getTestById = (...args) => dataService.getTestById(...args)
export const getQuestionsByTestId = (...args) => dataService.getQuestionsByTestId(...args)
export const getStudyMaterialById = (...args) => dataService.getStudyMaterialById(...args)
export const clearCache = () => dataService.clearCache()
export const forceRefreshAll = () => dataService.forceRefreshAll()
export const handleMutation = (...args) => dataService.handleMutation(...args)
export const refreshData = (...args) => dataService.refreshData(...args)

// Achievement functions
export const getAchievements = () => adminAPI.getAchievements()
export const checkAchievements = () => adminAPI.checkAchievements()

// User Analytics
export const getUserAnalytics = (...args) => dataService.getUserAnalytics(...args)

// Bookmark functions
export const getBookmarks = () => adminAPI.getBookmarks()
export const deleteBookmark = (id) => adminAPI.deleteBookmark(id)

// Public Data functions
export const getExamUpdates = examAPI.getExamUpdates
export const getExamYearlyData = examAPI.getExamYearlyData
export const getPublicStats = () => examAPI.getPublicStats()
export const getTestimonials = () => examAPI.getTestimonials()
export const getPromotions = () => examAPI.getPromotions()

// Notification functions
export const getNotifications = (params) => adminAPI.getNotifications(params)
export const markNotificationRead = (id) => adminAPI.markNotificationRead(id)
export const markAllNotificationsRead = () => adminAPI.markAllNotificationsRead()
export const deleteNotification = (id) => adminAPI.deleteNotification(id)

// Leaderboard functions
export const getLeaderboard = (seriesId) => adminAPI.getLeaderboard(seriesId)

// Intelligence Leaderboard - Multiple ranking categories
export const getIntelligenceLeaderboard = async (params = {}) => {
  const queryParams = new URLSearchParams()
  const { type = 'overall', testId, seriesId, page, limit, date } = params
  
  queryParams.append('type', type)
  if (testId) queryParams.append('testId', testId)
  if (seriesId) queryParams.append('seriesId', seriesId)
  if (page) queryParams.append('page', page)
  if (limit) queryParams.append('limit', limit)
  if (date) queryParams.append('date', date)
  
  return apiClient.get(`/intelligence/leaderboard?${queryParams.toString()}`)
}

// User streak data
export const getUserStreak = () => apiClient.get('/intelligence/streak')

// Top performers across all tests
export const getTopPerformersLeaderboard = (limit = 10, seriesId = null) => {
  const url = `/intelligence/top-performers?limit=${limit}${seriesId ? `&seriesId=${seriesId}` : ''}`
  return apiClient.get(url)
}

// Top Performers - fetch users with most tests attempted
export const getTopPerformers = (limit = 10, seriesId = null) => {
  const url = `/intelligence/top-performers?limit=${limit}${seriesId ? `&seriesId=${seriesId}` : ''}`
  return apiClient.get(url)
}

// Export apiClient as 'api' for compatibility with existing imports
export const api = apiClient

export default apiClient
