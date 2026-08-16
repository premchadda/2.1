import { apiClient } from '../apiClient.js'

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
  bulkDeleteTests: (ids) => apiClient.post('/admin/tests/bulk-delete', { ids }, { timeout: 60000 }),
  bulkStatusTests: (ids, status) => apiClient.post('/admin/tests/bulk-status', { ids, status }, { timeout: 60000 }),
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

  // Payments & Monetization
  getPaymentStats: () => apiClient.get('/admin/payments/stats'),
  getTransactions: (params) => apiClient.get('/admin/payments/transactions', { params }),
  refundPayment: (id) => apiClient.post(`/admin/payments/${id}/refund`),

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
  restoreTrashItem: (itemId, table) => apiClient.put(`/admin/trash/${itemId}/restore`, null, { params: { table } }),
  deleteTrashItem: (itemId, table) => apiClient.delete(`/admin/trash/${itemId}`, { params: { table } }),
  emptyTrash: () => apiClient.delete('/admin/trash'),
  
  // Questions
  getQuestions: () => apiClient.get('/admin/questions'),
  getQuestionCountsByTest: () => apiClient.get('/admin/questions/count-by-test'),
  createQuestion: (data) => apiClient.post('/admin/questions', data),
  updateQuestion: (id, data) => apiClient.put(`/admin/questions/${id}`, data),
  deleteQuestion: (id) => apiClient.delete(`/admin/questions/${id}`),
  bulkDeleteQuestions: (ids) => apiClient.delete('/admin/questions/bulk', { data: { ids } }),
  bulkUploadQuestions: (formData) => apiClient.post('/admin/questions/bulk', formData),

  // Import
  getImportHistory: (limit = 20) => apiClient.get('/admin/import/history', { params: { limit } }),

  // Moderation
  getModerationDoubts: (params) => apiClient.get('/admin/moderation/doubts', { params }),
  getModerationStats: () => apiClient.get('/admin/moderation/stats'),
  updateDoubtStatus: (id, status) => apiClient.put(`/admin/moderation/doubts/${id}/status`, { status }),
  deleteDoubt: (id) => apiClient.delete(`/admin/moderation/doubts/${id}`),
  deleteModerationDoubt: (id) => apiClient.delete(`/admin/moderation/doubts/${id}`),
  
  // Exam Categories
  getExamCategories: () => apiClient.get('/admin/exam-categories'),
  createExamCategory: (data) => apiClient.post('/admin/exam-categories', data),
  updateExamCategory: (id, data) => apiClient.put(`/admin/exam-categories/${id}`, data),
  deleteExamCategory: (id) => apiClient.delete(`/admin/exam-categories/${id}`),
  
  // Leaderboards
  getLeaderboards: (params) => apiClient.get('/admin/leaderboards/list', { params }),
  getLeaderboardStats: () => apiClient.get('/admin/leaderboards/stats'),
  createLeaderboard: (data) => apiClient.post('/admin/leaderboards', data),
  updateLeaderboard: (id, data) => apiClient.put(`/admin/leaderboards/${id}`, data),
  deleteLeaderboard: (id) => apiClient.delete(`/admin/leaderboards/${id}`),
  recalculateLeaderboard: (id) => apiClient.post(`/admin/leaderboards/${id}/recalculate`),
  resetLeaderboard: (id) => apiClient.post(`/admin/leaderboards/${id}/reset`),

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

  // Coming Soon / Maintenance config (app_settings row `coming_soon_config`)
  // Backend: apps/backend/src/api/routes/admin-extras.js
  getComingSoonConfig: () => apiClient.get('/admin/coming-soon-config'),
  updateComingSoonConfig: (payload) => apiClient.put('/admin/coming-soon-config', payload),
}

export default adminAPI
