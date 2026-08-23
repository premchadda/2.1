import { apiClient } from "../apiClient.js";

const enc = (v) => encodeURIComponent(String(v));
const requireId = (id, label = "ID") => {
  if (id === undefined || id === null || String(id).trim() === "") {
    throw new Error(`${label} is required`);
  }
  return enc(id);
};

export const adminAPI = {
  apiClient,
  get: (url, config) => apiClient.get(url, config),
  post: (url, data, config) => apiClient.post(url, data, config),
  put: (url, data, config) => apiClient.put(url, data, config),
  patch: (url, data, config) => apiClient.patch(url, data, config),
  delete: (url, config) => apiClient.delete(url, config),
  // Users
  getUsers: (params) => apiClient.get("/admin/users", { params }),
  updateUserProPass: (userId, data) =>
    apiClient.put(`/admin/users/${requireId(userId, "userId")}/pro-pass`, data),
  deleteUser: (userId) =>
    apiClient.delete(`/admin/users/${requireId(userId, "userId")}`),

  // Stages
  getStages: () => apiClient.get("/admin/stages/with-test-counts"),
  getStageDetails: (stageId) =>
    apiClient.get(`/admin/stages/${requireId(stageId, "stageId")}/details`),
  createStage: (data) => apiClient.post("/admin/stages", data),
  updateStage: (id, data) =>
    apiClient.put(`/admin/stages/${requireId(id, "id")}`, data),
  deleteStage: (id) => apiClient.delete(`/admin/stages/${requireId(id, "id")}`),

  // Test Series
  getTestSeries: (params) =>
    apiClient.get("/admin/test-series", {
      params: { includeInactive: true, ...params },
    }),
  createTestSeries: (data) => apiClient.post("/admin/test-series", data),
  updateTestSeries: (id, data) =>
    apiClient.put(`/admin/test-series/${requireId(id, "id")}`, data),
  deleteTestSeries: (id, permanent = false) =>
    apiClient.delete(`/admin/test-series/${requireId(id, "id")}`, {
      params: permanent ? { permanent: true } : {},
    }),

  // Tests
  getTests: (params) => apiClient.get("/admin/tests", { params }),
  getTestCategories: (params) =>
    apiClient.get("/admin/test-categories", { params }),
  createTest: (data) => apiClient.post("/admin/tests", data),
  updateTest: (id, data) =>
    apiClient.put(`/admin/tests/${requireId(id, "id")}`, data),
  deleteTest: (id) =>
    apiClient.delete(`/admin/tests/${requireId(id, "id")}`, { timeout: 60000 }),
  publishTest: (id) =>
    apiClient.post(
      `/admin/tests/${requireId(id, "id")}/publish`,
      {},
      { timeout: 60000 },
    ),
  unpublishTest: (id) =>
    apiClient.post(
      `/admin/tests/${requireId(id, "id")}/unpublish`,
      {},
      { timeout: 60000 },
    ),
  bulkDeleteTests: (ids) =>
    apiClient.post("/admin/tests/bulk-delete", { ids }, { timeout: 60000 }),
  bulkStatusTests: (ids, status) =>
    apiClient.post(
      "/admin/tests/bulk-status",
      { ids, status },
      { timeout: 60000 },
    ),
  bulkUploadTests: (formData) =>
    apiClient.post("/admin/tests/bulk", formData, {
      timeout: 300000,
    }),
  bulkUploadQuizzes: (formData) =>
    apiClient.post("/admin/quizzes/bulk", formData, {
      timeout: 300000,
    }),

  // Full Test JSON Import
  previewFullTest: (formData) =>
    apiClient.post("/import/full-test/preview", formData, {
      timeout: 300000,
    }),
  importFullTest: (formData) =>
    apiClient.post("/import/full-test/import", formData, {
      timeout: 300000,
    }),
  uploadFullTestJson: (formData) =>
    apiClient.post("/import/full-test/upload", formData, {
      timeout: 300000,
    }),
  previewSingleTest: (index) =>
    apiClient.get(`/import/full-test/preview-test/${enc(index)}`, {
      timeout: 300000,
    }),
  importSelectedTests: (data) =>
    apiClient.post("/import/full-test/import-selected", data, {
      timeout: 300000,
    }),

  // Test Categories
  createTestCategory: (data) => apiClient.post("/admin/test-categories", data),
  updateTestCategory: (id, data) =>
    apiClient.put(`/admin/test-categories/${requireId(id, "id")}`, data),
  deleteTestCategory: (id) =>
    apiClient.delete(`/admin/test-categories/${requireId(id, "id")}`),

  // Exams
  getExams: () => apiClient.get("/exams"),

  // Payments & Monetization
  getPaymentStats: () => apiClient.get("/admin/payments/stats"),
  getTransactions: (params) =>
    apiClient.get("/admin/payments/transactions", { params }),
  refundPayment: (id) =>
    apiClient.post(`/admin/payments/${requireId(id, "id")}/refund`),

  // Test Sections - use axios params to avoid manual URLSearchParams
  getSections: (params = {}) =>
    apiClient.get("/admin/sections", { params, timeout: 60000 }),
  getSectionsForTest: (params = {}) =>
    apiClient.get("/admin/sections/for-test", { params, timeout: 60000 }),
  createSection: (data) => apiClient.post("/admin/sections", data),
  updateSection: (id, data) =>
    apiClient.put(`/admin/sections/${requireId(id, "id")}`, data),
  deleteSection: (id) =>
    apiClient.delete(`/admin/sections/${requireId(id, "id")}`),
  applySectionPreset: (data) => apiClient.post("/admin/sections/preset", data),
  dedupSections: () => apiClient.post("/admin/sections/dedup"),
  getSectionAliases: () => apiClient.get("/admin/sections/aliases"),
  createSectionAlias: (data) => apiClient.post("/admin/sections/aliases", data),
  updateSectionAlias: (id, data) =>
    apiClient.put(`/admin/sections/aliases/${requireId(id, "id")}`, data),
  deleteSectionAlias: (id) =>
    apiClient.delete(`/admin/sections/aliases/${requireId(id, "id")}`),
  resolveSectionAlias: (name) =>
    apiClient.get(`/admin/sections/resolve/${enc(name)}`),
  seedTemplates: () => apiClient.post("/admin/sections/seed-templates"),

  // Study Materials
  getStudyMaterials: (deleted = false) =>
    apiClient.get("/admin/study-materials", {
      params: deleted ? { deleted: true } : {},
    }),
  createStudyMaterial: (data) => apiClient.post("/admin/study-materials", data),
  updateStudyMaterial: (id, data) =>
    apiClient.put(`/admin/study-materials/${requireId(id, "id")}`, data),
  deleteStudyMaterial: (id, permanent = false) =>
    apiClient.delete(`/admin/study-materials/${requireId(id, "id")}`, {
      params: permanent ? { permanent: true } : {},
    }),
  restoreStudyMaterial: (id) =>
    apiClient.put(`/admin/study-materials/${requireId(id, "id")}/restore`),
  reorderStudyMaterials: async (orderedIds) => {
    // Batch reorder to avoid thundering herd; limit concurrency to 3
    const batchSize = 3;
    const results = [];
    for (let i = 0; i < orderedIds.length; i += batchSize) {
      const batch = orderedIds.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((id, idx) =>
          apiClient.put(`/admin/study-materials/${requireId(id, "id")}`, {
            order: i + idx,
          }),
        ),
      );
      results.push(...batchResults);
    }
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length)
      throw new Error(`Reorder partially failed: ${failed.length} items`);
    return results;
  },

  // Chapters (for study materials)
  getChapters: (studyMaterialId) =>
    apiClient.get("/admin/chapters", {
      params: studyMaterialId ? { studyMaterialId } : {},
    }),
  createChapter: (data) => apiClient.post("/admin/chapters", data),
  updateChapter: (id, data) =>
    apiClient.put(`/admin/chapters/${requireId(id, "id")}`, data),
  deleteChapter: (id) =>
    apiClient.delete(`/admin/chapters/${requireId(id, "id")}`),

  // Subject Videos
  getSubjectVideos: (studyMaterialId, chapterId) =>
    apiClient.get("/admin/subject-videos", {
      params: {
        ...(studyMaterialId ? { studyMaterialId } : {}),
        ...(chapterId ? { chapterId } : {}),
      },
    }),
  createSubjectVideo: (data) => apiClient.post("/admin/subject-videos", data),
  updateSubjectVideo: (id, data) =>
    apiClient.put(`/admin/subject-videos/${requireId(id, "id")}`, data),
  deleteSubjectVideo: (id) =>
    apiClient.delete(`/admin/subject-videos/${requireId(id, "id")}`),

  // Subject PDFs
  getSubjectPdfs: (studyMaterialId, chapterId) =>
    apiClient.get("/admin/subject-pdfs", {
      params: {
        ...(studyMaterialId ? { studyMaterialId } : {}),
        ...(chapterId ? { chapterId } : {}),
      },
    }),
  createSubjectPdf: (data) => apiClient.post("/admin/subject-pdfs", data),
  updateSubjectPdf: (id, data) =>
    apiClient.put(`/admin/subject-pdfs/${requireId(id, "id")}`, data),
  deleteSubjectPdf: (id) =>
    apiClient.delete(`/admin/subject-pdfs/${requireId(id, "id")}`),

  // Topic Tests
  getTopicTests: (studyMaterialId, chapterId) =>
    apiClient.get("/admin/topic-tests", {
      params: {
        ...(studyMaterialId ? { studyMaterialId } : {}),
        ...(chapterId ? { chapterId } : {}),
      },
    }),
  createTopicTest: (data) => apiClient.post("/admin/topic-tests", data),
  deleteTopicTest: (id) =>
    apiClient.delete(`/admin/topic-tests/${requireId(id, "id")}`),

  // Trash
  getTrash: () => apiClient.get("/admin/trash"),
  restoreTrashItem: (itemId, table) =>
    apiClient.put(`/admin/trash/${requireId(itemId, "itemId")}/restore`, null, {
      params: { table },
    }),
  deleteTrashItem: (itemId, table) =>
    apiClient.delete(`/admin/trash/${requireId(itemId, "itemId")}`, {
      params: { table },
    }),
  emptyTrash: () => apiClient.delete("/admin/trash"),

  // Users 2FA — for user (student) accounts, not admin personal (global toggle in Settings → Security)
  getUsersTwoFactorOverview: (params) =>
    apiClient.get("/admin/users/2fa-overview", { params }),
  adminDisableUserTwoFactor: (userId) =>
    apiClient.post(`/admin/users/${requireId(userId, "userId")}/2fa/disable`),

  // Questions
  getQuestions: (params) => apiClient.get("/admin/questions", { params }),
  getQuestionCountsByTest: () =>
    apiClient.get("/admin/questions/count-by-test"),
  createQuestion: (data) => apiClient.post("/admin/questions", data),
  updateQuestion: (id, data) =>
    apiClient.put(`/admin/questions/${requireId(id, "id")}`, data),
  deleteQuestion: (id) =>
    apiClient.delete(`/admin/questions/${requireId(id, "id")}`),
  bulkDeleteQuestions: (ids) =>
    apiClient.post("/admin/questions/bulk-delete", { ids }),
  bulkUploadQuestions: (formData) =>
    apiClient.post("/admin/questions/bulk", formData, { timeout: 300000 }),

  // Import
  getImportHistory: (limit = 20) =>
    apiClient.get("/admin/import/history", { params: { limit } }),

  // Moderation
  getModerationDoubts: (params) =>
    apiClient.get("/admin/moderation/doubts", { params }),
  getModerationStats: () => apiClient.get("/admin/moderation/stats"),
  updateDoubtStatus: (id, status) =>
    apiClient.put(`/admin/moderation/doubts/${requireId(id, "id")}/status`, {
      status,
    }),
  deleteDoubt: (id) =>
    apiClient.delete(`/admin/moderation/doubts/${requireId(id, "id")}`),
  // alias kept for backward compat
  get deleteModerationDoubt() {
    return this.deleteDoubt;
  },

  // Exam Categories
  getExamCategories: () => apiClient.get("/admin/exam-categories"),
  createExamCategory: (data) => apiClient.post("/admin/exam-categories", data),
  updateExamCategory: (id, data) =>
    apiClient.put(`/admin/exam-categories/${requireId(id, "id")}`, data),
  deleteExamCategory: (id) =>
    apiClient.delete(`/admin/exam-categories/${requireId(id, "id")}`),

  // Leaderboards
  getLeaderboards: (params) =>
    apiClient.get("/admin/leaderboards/list", { params }),
  getLeaderboardStats: () => apiClient.get("/admin/leaderboards/stats"),
  createLeaderboard: (data) => apiClient.post("/admin/leaderboards", data),
  updateLeaderboard: (id, data) =>
    apiClient.put(`/admin/leaderboards/${requireId(id, "id")}`, data),
  deleteLeaderboard: (id) =>
    apiClient.delete(`/admin/leaderboards/${requireId(id, "id")}`),
  recalculateLeaderboard: (id) =>
    apiClient.post(`/admin/leaderboards/${requireId(id, "id")}/recalculate`),
  resetLeaderboard: (id) =>
    apiClient.post(`/admin/leaderboards/${requireId(id, "id")}/reset`),

  // Banners
  getBanners: () => apiClient.get("/admin/banners"),
  createBanner: (data) => apiClient.post("/admin/banners", data),
  updateBanner: (id, data) =>
    apiClient.put(`/admin/banners/${requireId(id, "id")}`, data),
  deleteBanner: (id) =>
    apiClient.delete(`/admin/banners/${requireId(id, "id")}`),

  // FAQs
  getFaqs: () => apiClient.get("/admin/faqs"),
  createFaq: (data) => apiClient.post("/admin/faqs", data),
  updateFaq: (id, data) =>
    apiClient.put(`/admin/faqs/${requireId(id, "id")}`, data),
  deleteFaq: (id) => apiClient.delete(`/admin/faqs/${requireId(id, "id")}`),

  // Promotions
  getPromotions: () => apiClient.get("/admin/promotions"),
  createPromotion: (data) => apiClient.post("/admin/promotions", data),
  updatePromotion: (id, data) =>
    apiClient.put(`/admin/promotions/${requireId(id, "id")}`, data),
  deletePromotion: (id) =>
    apiClient.delete(`/admin/promotions/${requireId(id, "id")}`),

  // Quizzes
  getQuizzes: () => apiClient.get("/admin/quizzes"),
  createQuiz: (data) => apiClient.post("/admin/quizzes", data),
  updateQuiz: (id, data) =>
    apiClient.put(`/admin/quizzes/${requireId(id, "id")}`, data),
  deleteQuiz: (id) => apiClient.delete(`/admin/quizzes/${requireId(id, "id")}`),

  // Live Tests
  getLiveTests: () => apiClient.get("/admin/live-tests"),
  createLiveTest: (data) => apiClient.post("/admin/live-tests", data),
  updateLiveTest: (id, data) =>
    apiClient.put(`/admin/live-tests/${requireId(id, "id")}`, data),
  deleteLiveTest: (id) =>
    apiClient.delete(`/admin/live-tests/${requireId(id, "id")}`),
  bulkUploadLiveTests: (data) =>
    apiClient.post("/admin/live-tests/bulk", data, { timeout: 300000 }),

  // PYPs (Previous Year Papers)
  getPYPs: () => apiClient.get("/admin/pyp"),
  createPYP: (data) => apiClient.post("/admin/pyp", data),
  updatePYP: (id, data) =>
    apiClient.put(`/admin/pyp/${requireId(id, "id")}`, data),
  deletePYP: (id) => apiClient.delete(`/admin/pyp/${requireId(id, "id")}`),
  bulkUploadPYP: (data) =>
    apiClient.post("/admin/pyp/bulk", data, { timeout: 300000 }),

  // Enrollments
  getEnrollments: (params) => apiClient.get("/admin/enrollments", { params }),

  // Results & Activity
  getResults: (params) => apiClient.get("/admin/results", { params }),
  getRecentActivity: () => apiClient.get("/admin/recent-activity"),
  getActivityOrder: () => apiClient.get("/admin/activity-order"),
  getActivityLogs: (params) =>
    apiClient.get("/admin/activity-logs", { params }),

  // User Analytics
  getUserAnalytics: () => apiClient.get("/users/analytics"),

  // Public Leaderboard - fixed encoding and param handling
  getLeaderboard: (seriesId) => {
    if (!seriesId) throw new Error("seriesId is required");
    return apiClient.get("/leaderboards", {
      params: { testId: String(seriesId) },
    });
  },

  // Bookmarks
  getBookmarks: () => apiClient.get("/bookmarks"),
  createBookmark: (data) => apiClient.post("/bookmarks", data),
  updateBookmark: (id, data) =>
    apiClient.put(`/bookmarks/${requireId(id, "id")}`, data),
  deleteBookmark: (id) => apiClient.delete(`/bookmarks/${requireId(id, "id")}`),
  toggleBookmark: (data) => apiClient.post("/bookmarks/toggle", data),
  checkBookmark: (itemType, itemId) =>
    apiClient.get(`/bookmarks/check/${enc(itemType)}/${enc(itemId)}`),

  // Notifications
  getNotifications: (params) => apiClient.get("/notifications", { params }),
  getUnreadCount: () => apiClient.get("/notifications/unread-count"),
  markNotificationRead: (id) =>
    apiClient.put(`/notifications/${requireId(id, "id")}/read`),
  markAllNotificationsRead: () => apiClient.put("/notifications/read-all"),
  deleteNotification: (id) =>
    apiClient.delete(`/notifications/${requireId(id, "id")}`),

  // Achievements
  getAchievements: () => apiClient.get("/achievements"),
  checkAchievements: () => apiClient.get("/achievements/check"),
  getAchievementLeaderboard: () => apiClient.get("/achievements/leaderboard"),

  // Coming Soon / Maintenance config (app_settings row `coming_soon_config`)
  // Backend: apps/backend/src/api/routes/admin-extras.js
  getComingSoonConfig: () => apiClient.get("/admin/coming-soon-config"),
  updateComingSoonConfig: (payload) =>
    apiClient.put("/admin/coming-soon-config", payload),
};

export default adminAPI;
