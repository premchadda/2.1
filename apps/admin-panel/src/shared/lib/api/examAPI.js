import { apiClient } from '../apiClient.js'

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

export default examAPI
