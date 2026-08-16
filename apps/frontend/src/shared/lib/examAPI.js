import { apiClient } from './apiClient.js'

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
