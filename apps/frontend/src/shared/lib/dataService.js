// Consolidated Data Service - Combines API client and data fetching functionality
import axios from 'axios'
import { mapUserToFrontend, mapTestSeriesToFrontend, mapTestToFrontend, mapQuestionToFrontend } from '../types/index.js'
import { API_BASE_URL } from './apiBase.js'
import { getCsrfToken } from '@trstprep/shared-config'

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

const apiUrl = API_BASE_URL
console.log('🔗 API URL:', apiUrl)

export const apiClient = axios.create({
  baseURL: apiUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable cookies for httpOnly token storage (Issue #21)
})

// Request interceptor - httpOnly cookies + CSRF token
apiClient.interceptors.request.use(
  (config) => {
    // CSRF token is added for state-changing requests
    const method = config.method?.toUpperCase()
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
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
           // Clear session data via event (sessionStorage, CSRF token, user state)
           window.dispatchEvent(new Event('unauthorized'))
           return Promise.reject(new AuthenticationError(message, data))
         case 403:
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
    return apiClient.post('/api/auth/login', { email, password })
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
    return apiClient.post('/api/auth/register', data)
  },
  logout: () => apiClient.post('/api/auth/logout'),
  getMe: () => apiClient.get('/api/auth/me'),
  refreshToken: () => apiClient.post('/api/auth/refresh'),
}

// ===== SERIES API =====
export const seriesAPI = {
  // Uses public endpoint which now includes calculated test counts
  getAll: () => apiClient.get('/api/series'),
  getById: (id) => {
    if (!id) throw new ValidationError('Test Series ID is required')
    return apiClient.get(`/api/series/${id}`)
  },
  create: (data) => {
    if (!data.title || !data.category) {
      throw new ValidationError('Title and category are required')
    }
    return apiClient.post('/api/admin/test-series', data)
  },
  update: (id, data) => {
    if (!id) throw new ValidationError('Test Series ID is required')
    return apiClient.put(`/api/admin/test-series/${id}`, data)
  },
  delete: (id) => {
    if (!id) throw new ValidationError('Test Series ID is required')
    return apiClient.delete(`/api/admin/test-series/${id}`)
  },
  getByCategory: (category) => {
    if (!category) throw new ValidationError('Category is required')
    return apiClient.get(`/api/series/category/${category}`)
  },
  getTests: (seriesId) => {
    if (!seriesId) throw new ValidationError('Test Series ID is required')
    return apiClient.get(`/api/series/${seriesId}/tests`)
  },
}


// ===== TESTS API =====
export const testsAPI = {
  getAll: () => apiClient.get('/api/tests'), // Changed to public endpoint
  getById: (id) => {
    if (!id) throw new ValidationError('Test ID is required')
    return apiClient.get(`/api/tests/${id}`)
  },
  getByTag: (tag) => {
    if (!tag) throw new ValidationError('Tag is required')
    return apiClient.get(`/api/tests/tag/${tag}`)
  },
  getBySeriesId: (seriesId) => {
    if (!seriesId) throw new ValidationError('Test Series ID is required')
    return apiClient.get(`/api/tests/series/${seriesId}`)
  },
  getQuestions: (testId) => {
    if (!testId) throw new ValidationError('Test ID is required')
    return apiClient.get(`/api/tests/${testId}/questions`)
  },
  startAttempt: (testId) => {
    if (!testId) throw new ValidationError('Test ID is required')
    return apiClient.post(`/api/tests/${testId}/start`)
  },
  submitAttempt: (testId, data) => {
    if (!testId) throw new ValidationError('Test ID is required')
    if (!data || !Array.isArray(data.answers)) {
      throw new ValidationError('Answers array is required')
    }
    return apiClient.put(`/api/tests/${testId}/submit`, data)
  },
  getResult: (testId, attemptId) => {
    if (!testId) throw new ValidationError('Test ID is required')
    if (!attemptId) throw new ValidationError('Attempt ID is required')
    return apiClient.get(`/api/tests/${testId}/result/${attemptId}`)
  },
  // Attempt management - pause/resume/save-progress
  attempt: {
    start: (testId, seriesId) => {
      if (!testId) throw new ValidationError('Test ID is required')
      return apiClient.post('/api/attempt/start', { testId, testSeriesId: seriesId })
    },
    pause: (attemptId, data) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.post('/api/attempt/pause', { attemptId, ...data })
    },
    resume: (attemptId) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.post('/api/attempt/resume', { attemptId })
    },
    saveProgress: (attemptId, data) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.post('/api/attempt/save-progress', { attemptId, ...data })
    },
    getState: (attemptId) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.get(`/api/attempt/${attemptId}/state`)
    },
    logEvent: (attemptId, eventType, data) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      if (!eventType) throw new ValidationError('Event type is required')
      return apiClient.post(`/api/attempt/${attemptId}/event`, { eventType, ...data })
    },
    getAnalytics: (attemptId) => {
      if (!attemptId) throw new ValidationError('Attempt ID is required')
      return apiClient.get(`/api/attempt/${attemptId}/analytics`)
    }
  },
  create: (data) => {
    if (!data.title) {
      throw new ValidationError('title is required')
    }
    if (!data.testSeriesId && !data.seriesId) {
      throw new ValidationError('testSeriesId is required')
    }
    return apiClient.post('/api/admin/tests', data)
  },
  update: (id, data) => {
    if (!id) throw new ValidationError('Test ID is required')
    return apiClient.put(`/api/admin/tests/${id}`, data)
  },
  delete: (id) => {
    if (!id) throw new ValidationError('Test ID is required')
    return apiClient.delete(`/api/admin/tests/${id}`)
  },
}

// ===== USER API =====
export const userAPI = {
  getProfile: () => apiClient.get('/api/users/profile'),
  updateProfile: (data) => {
    if (!data || Object.keys(data).length === 0) {
      throw new ValidationError('Profile data is required')
    }
    return apiClient.put('/api/users/profile', data)
  },
  enrollSeries: (seriesId) => {
    if (!seriesId) throw new ValidationError('Test Series ID is required')
    return apiClient.post(`/api/users/enroll/${seriesId}`)
  },
  unenrollFromSeries: (seriesId) => {
    if (!seriesId) throw new ValidationError('Test Series ID is required')
    return apiClient.delete(`/api/users/unenroll/${seriesId}`)
  },
  getEnrolledSeries: () => apiClient.get('/api/users/enrolled-series'),
  getAttempts: () => apiClient.get('/api/users/attempts'),
  getAnalytics: () => apiClient.get('/api/users/analytics'),
  deleteAccount: () => apiClient.delete('/api/users/profile'),
  // Session management
  getSessions: () => apiClient.get('/api/users/sessions'),
  revokeSession: (sessionId) => apiClient.delete(`/api/users/sessions/${sessionId}`),
  changeEmail: (newEmail) => apiClient.post('/api/users/change-email', { newEmail }),
}

// ===== NOTIFICATION PREF API =====
export const notificationPrefAPI = {
  subscribe: (data) => apiClient.post('/api/notifications-pref/subscribe', data),
}

// ===== STUDY API =====
// NOTE: Public study routes use SLUG-based routing, not ID-based
// - GET /api/study - Get all study materials
// - GET /api/study/:slug - Get study material by slug
// - GET /api/study/:slug/chapters - Get chapters by slug
// Admin routes use ID-based routing (see adminAPI.studyMaterials)
export const studyAPI = {
  // Get all study materials (public)
  getAll: () => apiClient.get('/api/study'),
  
  // Get study material by SLUG (public endpoint uses slug, not ID)
  getBySlug: (slug) => {
    if (!slug) throw new ValidationError('Study material slug is required')
    return apiClient.get(`/api/study/${slug}`)
  },
  
  // Alias for backward compatibility - accepts either slug or id
  // WARNING: This calls the slug-based endpoint, so pass slug not ID
  getById: (slugOrId) => {
    if (!slugOrId) throw new ValidationError('Study material slug or ID is required')
    return apiClient.get(`/api/study/${slugOrId}`)
  },
  
  // Get chapters for a study material by SLUG
  getChaptersBySlug: (slug) => {
    if (!slug) throw new ValidationError('Study material slug is required')
    return apiClient.get(`/api/study/${slug}/chapters`)
  },
  
  // Alias for backward compatibility - accepts either slug or id
  // WARNING: This calls the slug-based endpoint, so pass slug not ID
  getChapters: (slugOrId) => {
    if (!slugOrId) throw new ValidationError('Study material slug or ID is required')
    return apiClient.get(`/api/study/${slugOrId}/chapters`)
  },
  
  // Get a specific resource (alias for getBySlug)
  getResource: (slug) => {
    if (!slug) throw new ValidationError('Resource slug is required')
    return apiClient.get(`/api/study/${slug}`)
  },
}

// ===== QUESTIONS API =====
export const questionsAPI = {
  getAll: () => apiClient.get('/api/admin/questions'),
  getByTestId: (testId) => {
    if (!testId) throw new ValidationError('Test ID is required')
    return apiClient.get(`/api/questions/test/${testId}`)
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
    return apiClient.post('/api/admin/questions', data)
  },
  update: (id, data) => {
    if (!id) throw new ValidationError('Question ID is required')
    return apiClient.put(`/api/admin/questions/${id}`, data)
  },
  delete: (id) => {
    if (!id) throw new ValidationError('Question ID is required')
    return apiClient.delete(`/api/admin/questions/${id}`)
  },
  bulkUpload: (data) => {
    if (!data || !Array.isArray(data.questions)) {
      throw new ValidationError('Questions array is required')
    }
    if (data.questions.length === 0) {
      throw new ValidationError('At least one question is required')
    }
    return apiClient.post('/api/admin/questions/bulk', data)
  },
}

// ===== EXAM DATA API =====
export const examAPI = {
  getCategories: () => apiClient.get('/api/exam-categories'),
  getExams: () => apiClient.get('/api/exams'),
  getExamInfo: () => apiClient.get('/api/exam-info'),
  getExamUpdates: (examId) => apiClient.get(`/api/exam-info/${examId}/updates`),
  getExamYearlyData: (examId) => apiClient.get(`/api/exam-info/${examId}/yearly-data`),
  getPublicStats: () => apiClient.get('/api/public-stats'),
  getTestimonials: () => apiClient.get('/api/testimonials'),
  getPromotions: () => apiClient.get('/api/promotions'),
}

// ===== ADMIN API =====
export const adminAPI = {
  apiClient,
  // Users
  getUsers: () => apiClient.get('/api/admin/users'),
  updateUserProPass: (userId, data) => apiClient.put(`/api/admin/users/${userId}/pro-pass`, data),
  deleteUser: (userId) => apiClient.delete(`/api/admin/users/${userId}`),

  // Stages
  getStages: () => apiClient.get('/api/stages'),
  
  // Test Series
  getTestSeries: (params) => apiClient.get('/api/admin/test-series', { params }),
  createTestSeries: (data) => apiClient.post('/api/admin/test-series', data),
  updateTestSeries: (id, data) => apiClient.put(`/api/admin/test-series/${id}`, data),
  deleteTestSeries: (id, permanent = false) => apiClient.delete(`/api/admin/test-series/${id}${permanent ? '?permanent=true' : ''}`),
  
  // Tests
  getTests: (params) => apiClient.get('/api/admin/tests', { params }),
  getTestCategories: (params) => apiClient.get('/api/admin/test-categories', { params }),
  createTest: (data) => apiClient.post('/api/admin/tests', data),
  updateTest: (id, data) => apiClient.put(`/api/admin/tests/${id}`, data),
  deleteTest: (id) => apiClient.delete(`/api/admin/tests/${id}`),
  bulkUploadTests: (formData) => apiClient.post('/api/admin/tests/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  bulkUploadQuizzes: (formData) => apiClient.post('/api/admin/quizzes/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  bulkUploadPYP: (formData) => apiClient.post('/api/admin/pyp/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  
  // Test Categories
  createTestCategory: (data) => apiClient.post('/api/admin/test-categories', data),
  updateTestCategory: (id, data) => apiClient.put(`/api/admin/test-categories/${id}`, data),
  deleteTestCategory: (id) => apiClient.delete(`/api/admin/test-categories/${id}`),
  
  // Study Materials
  getStudyMaterials: (deleted = false) => apiClient.get(`/api/admin/study-materials${deleted ? '?deleted=true' : ''}`),
  createStudyMaterial: (data) => apiClient.post('/api/admin/study-materials', data),
  updateStudyMaterial: (id, data) => apiClient.put(`/api/admin/study-materials/${id}`, data),
  deleteStudyMaterial: (id, permanent = false) => apiClient.delete(`/api/admin/study-materials/${id}${permanent ? '?permanent=true' : ''}`),
  restoreStudyMaterial: (id) => apiClient.put(`/api/admin/study-materials/${id}/restore`),
  reorderStudyMaterials: (orderedIds) => {
    return Promise.all(orderedIds.map((id, index) => 
      apiClient.put(`/api/admin/study-materials/${id}`, { order: index })
    ))
  },
  
  // Chapters (for study materials)
  getChapters: (studyMaterialId) => {
    const query = studyMaterialId ? `?studyMaterialId=${studyMaterialId}` : ''
    return apiClient.get(`/api/admin/chapters${query}`)
  },
  createChapter: (data) => apiClient.post('/api/admin/chapters', data),
  updateChapter: (id, data) => apiClient.put(`/api/admin/chapters/${id}`, data),
  deleteChapter: (id) => apiClient.delete(`/api/admin/chapters/${id}`),
  
  // Subject Videos
  getSubjectVideos: (studyMaterialId, chapterId) => {
    const params = new URLSearchParams()
    if (studyMaterialId) params.append('studyMaterialId', studyMaterialId)
    if (chapterId) params.append('chapterId', chapterId)
    const query = params.toString() ? `?${params.toString()}` : ''
    return apiClient.get(`/api/admin/subject-videos${query}`)
  },
  createSubjectVideo: (data) => apiClient.post('/api/admin/subject-videos', data),
  updateSubjectVideo: (id, data) => apiClient.put(`/api/admin/subject-videos/${id}`, data),
  deleteSubjectVideo: (id) => apiClient.delete(`/api/admin/subject-videos/${id}`),
  
  // Subject PDFs
  getSubjectPdfs: (studyMaterialId, chapterId) => {
    const params = new URLSearchParams()
    if (studyMaterialId) params.append('studyMaterialId', studyMaterialId)
    if (chapterId) params.append('chapterId', chapterId)
    const query = params.toString() ? `?${params.toString()}` : ''
    return apiClient.get(`/api/admin/subject-pdfs${query}`)
  },
  createSubjectPdf: (data) => apiClient.post('/api/admin/subject-pdfs', data),
  updateSubjectPdf: (id, data) => apiClient.put(`/api/admin/subject-pdfs/${id}`, data),
  deleteSubjectPdf: (id) => apiClient.delete(`/api/admin/subject-pdfs/${id}`),
  
  // Topic Tests
  getTopicTests: (studyMaterialId, chapterId) => {
    const params = new URLSearchParams()
    if (studyMaterialId) params.append('studyMaterialId', studyMaterialId)
    if (chapterId) params.append('chapterId', chapterId)
    const query = params.toString() ? `?${params.toString()}` : ''
    return apiClient.get(`/api/admin/topic-tests${query}`)
  },
  createTopicTest: (data) => apiClient.post('/api/admin/topic-tests', data),
  deleteTopicTest: (id) => apiClient.delete(`/api/admin/topic-tests/${id}`),
  
  // Trash
  getTrash: () => apiClient.get('/api/admin/trash'),
  restoreTrashItem: (itemId) => apiClient.put(`/api/admin/trash/${itemId}/restore`),
  deleteTrashItem: (itemId) => apiClient.delete(`/api/admin/trash/${itemId}`),
  emptyTrash: () => apiClient.delete('/api/admin/trash'),
  
  // Questions
  getQuestions: () => apiClient.get('/api/admin/questions'),
  getQuestionCountsByTest: () => apiClient.get('/api/admin/questions/count-by-test'),
  createQuestion: (data) => apiClient.post('/api/admin/questions', data),
  updateQuestion: (id, data) => apiClient.put(`/api/admin/questions/${id}`, data),
  deleteQuestion: (id) => apiClient.delete(`/api/admin/questions/${id}`),
  bulkUploadQuestions: (formData) => apiClient.post('/api/admin/questions/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  
  // Exam Categories
  getExamCategories: () => apiClient.get('/api/admin/exam-categories'),
  createExamCategory: (data) => apiClient.post('/api/admin/exam-categories', data),
  updateExamCategory: (id, data) => apiClient.put(`/api/admin/exam-categories/${id}`, data),
  deleteExamCategory: (id) => apiClient.delete(`/api/admin/exam-categories/${id}`),
  
  // Live Tests
  getLiveTests: () => apiClient.get('/api/admin/live-tests'),
  createLiveTest: (data) => apiClient.post('/api/admin/live-tests', data),
  updateLiveTest: (id, data) => apiClient.put(`/api/admin/live-tests/${id}`, data),
  deleteLiveTest: (id) => apiClient.delete(`/api/admin/live-tests/${id}`),
  bulkUploadLiveTests: (formData) => apiClient.post('/api/admin/live-tests/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  
  // Leaderboards
  getLeaderboards: () => apiClient.get('/api/admin/leaderboards'),
  createLeaderboard: (data) => apiClient.post('/api/admin/leaderboards', data),
  updateLeaderboard: (id, data) => apiClient.put(`/api/admin/leaderboards/${id}`, data),
  deleteLeaderboard: (id) => apiClient.delete(`/api/admin/leaderboards/${id}`),

  // Banners
  getBanners: () => apiClient.get('/api/admin/banners'),
  createBanner: (data) => apiClient.post('/api/admin/banners', data),
  updateBanner: (id, data) => apiClient.put(`/api/admin/banners/${id}`, data),
  deleteBanner: (id) => apiClient.delete(`/api/admin/banners/${id}`),

  // FAQs
  getFaqs: () => apiClient.get('/api/admin/faqs'),
  createFaq: (data) => apiClient.post('/api/admin/faqs', data),
  updateFaq: (id, data) => apiClient.put(`/api/admin/faqs/${id}`, data),
  deleteFaq: (id) => apiClient.delete(`/api/admin/faqs/${id}`),

  // Promotions
  getPromotions: () => apiClient.get('/api/admin/promotions'),
  createPromotion: (data) => apiClient.post('/api/admin/promotions', data),
  updatePromotion: (id, data) => apiClient.put(`/api/admin/promotions/${id}`, data),
  deletePromotion: (id) => apiClient.delete(`/api/admin/promotions/${id}`),

  // Quizzes
  getQuizzes: () => apiClient.get('/api/admin/quizzes'),
  createQuiz: (data) => apiClient.post('/api/admin/quizzes', data),
  updateQuiz: (id, data) => apiClient.put(`/api/admin/quizzes/${id}`, data),
  deleteQuiz: (id) => apiClient.delete(`/api/admin/quizzes/${id}`),
  
  // Enrollments
  getEnrollments: () => apiClient.get('/api/admin/enrollments'),
  
  // Results
  getResults: () => apiClient.get('/api/admin/results'),
  getRecentActivity: () => apiClient.get('/api/admin/recent-activity'),
  
  // User Analytics
  getUserAnalytics: () => apiClient.get('/api/users/analytics'),
  
  // Public Leaderboard
  getLeaderboard: (seriesId) => apiClient.get(`/api/leaderboards?testId=${seriesId}`),
  
  // Bookmarks
  getBookmarks: () => apiClient.get('/api/bookmarks'),
  createBookmark: (data) => apiClient.post('/api/bookmarks', data),
  updateBookmark: (id, data) => apiClient.put(`/api/bookmarks/${id}`, data),
  deleteBookmark: (id) => apiClient.delete(`/api/bookmarks/${id}`),
  toggleBookmark: (data) => apiClient.post('/api/bookmarks/toggle', data),
  checkBookmark: (itemType, itemId) => apiClient.get(`/api/bookmarks/check/${itemType}/${itemId}`),
  
  // Notifications
  getNotifications: (params) => apiClient.get('/api/notifications', { params }),
  getUnreadCount: () => apiClient.get('/api/notifications/unread-count'),
  markNotificationRead: (id) => apiClient.put(`/api/notifications/${id}/read`),
  markAllNotificationsRead: () => apiClient.put('/api/notifications/read-all'),
  deleteNotification: (id) => apiClient.delete(`/api/notifications/${id}`),
  
  // Achievements
  getAchievements: () => apiClient.get('/api/achievements'),
  checkAchievements: () => apiClient.get('/api/achievements/check'),
  getAchievementLeaderboard: () => apiClient.get('/api/achievements/leaderboard'),
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
    console.log('🔄 Cache cleared')
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
    const key = this.cache.generateKey('/exam-categories')
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
    const key = this.cache.generateKey('/test-categories')
    return this.fetchWithCache(key, async () => {
      const response = await apiClient.get('/api/test-categories')
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
      const response = await apiClient.get('/api/search', { params: { q: query, type } })
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
      
      console.log(`[DEBUG] getTestsBySeriesId(${seriesId}):`, {
        count: tests.length
      })
      
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
    console.log('🔄 All data force refreshed')
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
  
  return apiClient.get(`/api/intelligence/leaderboard?${queryParams.toString()}`)
}

// User streak data
export const getUserStreak = () => apiClient.get('/api/intelligence/streak')

// Top performers across all tests
export const getTopPerformersLeaderboard = (limit = 10, seriesId = null) => {
  const url = `/api/intelligence/top-performers?limit=${limit}${seriesId ? `&seriesId=${seriesId}` : ''}`
  return apiClient.get(url)
}

// Top Performers - fetch users with most tests attempted
export const getTopPerformers = (limit = 10, seriesId = null) => {
  const url = `/api/intelligence/top-performers?limit=${limit}${seriesId ? `&seriesId=${seriesId}` : ''}`
  return apiClient.get(url)
}

// Export apiClient as 'api' for compatibility with existing imports
export const api = apiClient

export default apiClient
