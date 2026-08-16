import { apiClient } from './apiClient.js'

export const adminAPI = {
  apiClient,
  getUsers: () => apiClient.get('/api/admin/users'),
  updateUserProPass: (userId, data) => apiClient.put(`/api/admin/users/${userId}/pro-pass`, data),
  deleteUser: (userId) => apiClient.delete(`/api/admin/users/${userId}`),

  getStages: () => apiClient.get('/api/stages'),

  getTestSeries: (params) => apiClient.get('/api/admin/test-series', { params }),
  createTestSeries: (data) => apiClient.post('/api/admin/test-series', data),
  updateTestSeries: (id, data) => apiClient.put(`/api/admin/test-series/${id}`, data),
  deleteTestSeries: (id, permanent = false) => apiClient.delete(`/api/admin/test-series/${id}${permanent ? '?permanent=true' : ''}`),

  getTests: (params) => apiClient.get('/api/admin/tests', { params }),
  getTestCategories: (params) => apiClient.get('/api/admin/test-categories', { params }),
  createTest: (data) => apiClient.post('/api/admin/tests', data),
  updateTest: (id, data) => apiClient.put(`/api/admin/tests/${id}`, data),
  deleteTest: (id) => apiClient.delete(`/api/admin/tests/${id}`),
  bulkDeleteTests: (ids) => apiClient.delete('/api/admin/tests/bulk', { data: { ids } }),
  bulkUploadTests: (formData) => apiClient.post('/api/admin/tests/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  bulkUploadQuizzes: (formData) => apiClient.post('/api/admin/quizzes/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  bulkUploadPYP: (formData) => apiClient.post('/api/admin/pyp/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),

  createTestCategory: (data) => apiClient.post('/api/admin/test-categories', data),
  updateTestCategory: (id, data) => apiClient.put(`/api/admin/test-categories/${id}`, data),
  deleteTestCategory: (id) => apiClient.delete(`/api/admin/test-categories/${id}`),

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

  getChapters: (studyMaterialId) => {
    const query = studyMaterialId ? `?studyMaterialId=${studyMaterialId}` : ''
    return apiClient.get(`/api/admin/chapters${query}`)
  },
  createChapter: (data) => apiClient.post('/api/admin/chapters', data),
  updateChapter: (id, data) => apiClient.put(`/api/admin/chapters/${id}`, data),
  deleteChapter: (id) => apiClient.delete(`/api/admin/chapters/${id}`),

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

  getTopicTests: (studyMaterialId, chapterId) => {
    const params = new URLSearchParams()
    if (studyMaterialId) params.append('studyMaterialId', studyMaterialId)
    if (chapterId) params.append('chapterId', chapterId)
    const query = params.toString() ? `?${params.toString()}` : ''
    return apiClient.get(`/api/admin/topic-tests${query}`)
  },
  createTopicTest: (data) => apiClient.post('/api/admin/topic-tests', data),
  deleteTopicTest: (id) => apiClient.delete(`/api/admin/topic-tests/${id}`),

  getTrash: () => apiClient.get('/api/admin/trash'),
  restoreTrashItem: (itemId) => apiClient.put(`/api/admin/trash/${itemId}/restore`),
  deleteTrashItem: (itemId) => apiClient.delete(`/api/admin/trash/${itemId}`),
  emptyTrash: () => apiClient.delete('/api/admin/trash'),

  getQuestions: () => apiClient.get('/api/admin/questions'),
  getQuestionCountsByTest: () => apiClient.get('/api/admin/questions/count-by-test'),
  createQuestion: (data) => apiClient.post('/api/admin/questions', data),
  updateQuestion: (id, data) => apiClient.put(`/api/admin/questions/${id}`, data),
  deleteQuestion: (id) => apiClient.delete(`/api/admin/questions/${id}`),
  bulkDeleteQuestions: (ids) => apiClient.delete('/api/admin/questions/bulk', { data: { ids } }),
  bulkUploadQuestions: (formData) => apiClient.post('/api/admin/questions/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getImportHistory: (limit = 20) => apiClient.get('/api/admin/import/history', { params: { limit } }),

  getExamCategories: () => apiClient.get('/api/admin/exam-categories'),
  createExamCategory: (data) => apiClient.post('/api/admin/exam-categories', data),
  updateExamCategory: (id, data) => apiClient.put(`/api/admin/exam-categories/${id}`, data),
  deleteExamCategory: (id) => apiClient.delete(`/api/admin/exam-categories/${id}`),

  getLiveTests: () => apiClient.get('/api/admin/live-tests'),
  createLiveTest: (data) => apiClient.post('/api/admin/live-tests', data),
  updateLiveTest: (id, data) => apiClient.put(`/api/admin/live-tests/${id}`, data),
  deleteLiveTest: (id) => apiClient.delete(`/api/admin/live-tests/${id}`),
  bulkUploadLiveTests: (formData) => apiClient.post('/api/admin/live-tests/bulk', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),

  getLeaderboards: () => apiClient.get('/api/admin/leaderboards'),
  createLeaderboard: (data) => apiClient.post('/api/admin/leaderboards', data),
  updateLeaderboard: (id, data) => apiClient.put(`/api/admin/leaderboards/${id}`, data),
  deleteLeaderboard: (id) => apiClient.delete(`/api/admin/leaderboards/${id}`),

  getBanners: () => apiClient.get('/api/admin/banners'),
  createBanner: (data) => apiClient.post('/api/admin/banners', data),
  updateBanner: (id, data) => apiClient.put(`/api/admin/banners/${id}`, data),
  deleteBanner: (id) => apiClient.delete(`/api/admin/banners/${id}`),

  getFaqs: () => apiClient.get('/api/admin/faqs'),
  createFaq: (data) => apiClient.post('/api/admin/faqs', data),
  updateFaq: (id, data) => apiClient.put(`/api/admin/faqs/${id}`, data),
  deleteFaq: (id) => apiClient.delete(`/api/admin/faqs/${id}`),

  getPromotions: () => apiClient.get('/api/admin/promotions'),
  createPromotion: (data) => apiClient.post('/api/admin/promotions', data),
  updatePromotion: (id, data) => apiClient.put(`/api/admin/promotions/${id}`, data),
  deletePromotion: (id) => apiClient.delete(`/api/admin/promotions/${id}`),

  getQuizzes: () => apiClient.get('/api/admin/quizzes'),
  createQuiz: (data) => apiClient.post('/api/admin/quizzes', data),
  updateQuiz: (id, data) => apiClient.put(`/api/admin/quizzes/${id}`, data),
  deleteQuiz: (id) => apiClient.delete(`/api/admin/quizzes/${id}`),

  getEnrollments: () => apiClient.get('/api/admin/enrollments'),

  getResults: () => apiClient.get('/api/admin/results'),
  getRecentActivity: () => apiClient.get('/api/admin/recent-activity'),

  getUserAnalytics: () => apiClient.get('/api/users/analytics'),

  getLeaderboard: (seriesId) => apiClient.get(`/api/leaderboards?testId=${seriesId}`),

  getBookmarks: () => apiClient.get('/api/bookmarks'),
  createBookmark: (data) => apiClient.post('/api/bookmarks', data),
  updateBookmark: (id, data) => apiClient.put(`/api/bookmarks/${id}`, data),
  deleteBookmark: (id) => apiClient.delete(`/api/bookmarks/${id}`),
  toggleBookmark: (data) => apiClient.post('/api/bookmarks/toggle', data),
  checkBookmark: (itemType, itemId) => apiClient.get(`/api/bookmarks/check/${itemType}/${itemId}`),

  getNotifications: (params) => apiClient.get('/api/notifications', { params }),
  getUnreadCount: () => apiClient.get('/api/notifications/unread-count'),
  markNotificationRead: (id) => apiClient.put(`/api/notifications/${id}/read`),
  markAllNotificationsRead: () => apiClient.put('/api/notifications/read-all'),
  deleteNotification: (id) => apiClient.delete(`/api/notifications/${id}`),
  clearAllNotifications: () => apiClient.delete('/api/notifications/clear-all'),

  getAchievements: () => apiClient.get('/api/achievements'),
  checkAchievements: () => apiClient.get('/api/achievements/check'),
  getAchievementLeaderboard: () => apiClient.get('/api/achievements/leaderboard'),
}
