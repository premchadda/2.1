// Consolidated Data Service - Re-export layer
// Imports from split modules and provides the intelligent caching layer (DataService)
import { apiClient, fetchFromAPI } from "./apiClient.js";
import { CacheService } from "./cacheService.js";
import { authAPI } from "./api/authAPI.js";
import { testsAPI } from "./api/testsAPI.js";
import { questionsAPI } from "./api/questionsAPI.js";
import { adminAPI } from "./api/adminAPI.js";
import { seriesAPI } from "./api/seriesAPI.js";
import { userAPI } from "./api/userAPI.js";
import { examAPI } from "./api/examAPI.js";
import { studyAPI } from "./api/studyAPI.js";
import { notificationPrefAPI } from "./api/notificationPrefAPI.js";
import {
  ValidationError,
  AuthenticationError,
  DataError,
} from "@trstprep/shared-config";

// ===== ENDPOINT CONSTANTS =====
// Single source for the cache keys used below (and by mutation-clear logic).
// Keep the prefixes in sync with `handleMutation`'s clear patterns ('/admin/', '/study').
export const ENDPOINTS = Object.freeze({
  TEST_SERIES: "/admin/test-series",
  USER_ANALYTICS: "/users/analytics",
  TESTS: "/admin/tests",
  QUESTIONS: "/admin/questions",
  STUDY: "/study",
  EXAM_CATEGORIES: "/admin/exam-categories",
  EXAMS: "/exams",
  TEST_CATEGORIES: "/admin/test-categories",
  SEARCH: "/search",
  TESTS_BY_SERIES: (seriesId) => `/tests/series/${seriesId}`,
  QUESTIONS_BY_TEST: (testId) => `/questions/test/${testId}`,
  STUDY_BY_ID: (id) => `/study/${id}`,
});

// ===== PAYLOAD GUARD =====
// Malformed payloads (missing the `data` array) are surfaced as errors instead
// of being silently cached as empty lists ("empty result as truth"). Legitimate
// empty arrays from the backend still pass through and are cached.
function extractListPayload(response, endpoint) {
  const raw = response?.data;
  const list = Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw)
      ? raw
      : null;
  if (list === null) {
    throw new DataError(
      `Malformed response from ${endpoint}: expected a data array`,
      "MALFORMED_RESPONSE",
      raw,
    );
  }
  return list;
}

// Mapping functions (used internally by DataService)
function mapTestSeriesToFrontend(series) {
  if (!series) return null;
  return { id: series._id || series.id || series.public_id, ...series };
}

function mapTestToFrontend(test) {
  if (!test) return null;
  return { id: test._id || test.id || test.public_id, ...test };
}

function mapQuestionToFrontend(question) {
  if (!question) return null;
  return { id: question._id || question.id || question.public_id, ...question };
}

// ===== INTELLIGENT DATA SERVICE =====
class DataService {
  constructor() {
    this.cache = new CacheService();
    this.loadingStates = new Map();
    this.retryAttempts = new Map();
    this.maxRetries = 3;
  }

  async fetchWithCache(key, fetchFn, options = {}) {
    const {
      forceRefresh = false,
      ttl = this.cache.defaultTTL,
      useCache = true,
      retries = this.maxRetries,
      retryDelay = 1000,
    } = options;

    if (useCache && !forceRefresh) {
      if (this.cache.has(key)) return this.cache.get(key);
    }

    if (this.loadingStates.get(key)) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return this.fetchWithCache(key, fetchFn, options);
    }

    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.loadingStates.set(key, true);
        const data = await fetchFn();
        if (useCache) this.cache.set(key, data, ttl);
        this.retryAttempts.delete(key);
        return data;
      } catch (error) {
        lastError = error;
        if (import.meta.env.DEV)
          console.error(`Fetch attempt ${attempt} failed for ${key}:`, error);
        if (
          error instanceof ValidationError ||
          error instanceof AuthenticationError
        )
          throw error;
        if (attempt === retries) break;
        const delay = retryDelay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } finally {
        this.loadingStates.delete(key);
      }
    }
    throw lastError;
  }

  clearCacheForEndpoint(endpointPattern) {
    const keysToDelete = [];
    for (const key of this.cache.cache.keys()) {
      if (key.includes(endpointPattern)) keysToDelete.push(key);
    }
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  clearCache() {
    this.cache.clear();
  }

  async getTestSeries(options = {}) {
    const key = this.cache.generateKey(ENDPOINTS.TEST_SERIES);
    return this.fetchWithCache(
      key,
      async () => {
        const response = await seriesAPI.getAll();
        const data = extractListPayload(response, ENDPOINTS.TEST_SERIES);
        return data.map(mapTestSeriesToFrontend);
      },
      { ttl: this.cache.longTTL, ...options },
    );
  }

  async getUserAnalytics(options = {}) {
    const key = this.cache.generateKey(ENDPOINTS.USER_ANALYTICS);
    return this.fetchWithCache(
      key,
      async () => {
        const response = await userAPI.getAnalytics();
        return response.data?.data || response.data || null;
      },
      { ttl: 60000, ...options },
    );
  }

  async getTests(options = {}) {
    const key = this.cache.generateKey(ENDPOINTS.TESTS);
    return this.fetchWithCache(
      key,
      async () => {
        const response = await testsAPI.getAll();
        const data = extractListPayload(response, ENDPOINTS.TESTS);
        return data.map(mapTestToFrontend);
      },
      options,
    );
  }

  async getQuestions(options = {}) {
    const key = this.cache.generateKey(ENDPOINTS.QUESTIONS);
    return this.fetchWithCache(
      key,
      async () => {
        const response = await questionsAPI.getAll();
        const data = extractListPayload(response, ENDPOINTS.QUESTIONS);
        return data.map(mapQuestionToFrontend);
      },
      options,
    );
  }

  async getStudyMaterials(options = {}) {
    const key = this.cache.generateKey(ENDPOINTS.STUDY);
    return this.fetchWithCache(
      key,
      async () => {
        const response = await studyAPI.getAll();
        return extractListPayload(response, ENDPOINTS.STUDY);
      },
      { ttl: this.cache.longTTL, ...options },
    );
  }

  async getExamCategories(options = {}) {
    const key = this.cache.generateKey(ENDPOINTS.EXAM_CATEGORIES);
    return this.fetchWithCache(
      key,
      async () => {
        const response = await examAPI.getCategories();
        return extractListPayload(response, ENDPOINTS.EXAM_CATEGORIES);
      },
      { ttl: this.cache.longTTL, ...options },
    );
  }

  async getExams(options = {}) {
    const key = this.cache.generateKey(ENDPOINTS.EXAMS);
    return this.fetchWithCache(
      key,
      async () => {
        const response = await examAPI.getExams();
        return extractListPayload(response, ENDPOINTS.EXAMS);
      },
      { ttl: this.cache.longTTL, ...options },
    );
  }

  async getTestCategories(options = {}) {
    const key = this.cache.generateKey(ENDPOINTS.TEST_CATEGORIES);
    return this.fetchWithCache(
      key,
      async () => {
        const response = await apiClient.get(ENDPOINTS.TEST_CATEGORIES);
        return extractListPayload(response, ENDPOINTS.TEST_CATEGORIES);
      },
      { ttl: this.cache.longTTL, ...options },
    );
  }

  async search(query, type = "all", options = {}) {
    const key = this.cache.generateKey(ENDPOINTS.SEARCH, { q: query, type });
    return this.fetchWithCache(
      key,
      async () => {
        const response = await apiClient.get(ENDPOINTS.SEARCH, {
          params: { q: query, type },
        });
        return extractListPayload(response, ENDPOINTS.SEARCH);
      },
      { ttl: 60000, ...options },
    );
  }

  async getTestSeriesById(id, options = {}) {
    if (!id) throw new ValidationError("Test Series ID is required");
    const allSeries = await this.getTestSeries(options);
    return (
      allSeries.find(
        (s) =>
          String(s.id) === String(id) ||
          String(s.slug).toLowerCase() === String(id).toLowerCase() ||
          s.public_id === id ||
          s._id === id ||
          String(s._id) === String(id),
      ) || null
    );
  }

  async getTestsBySeriesId(seriesId, options = {}) {
    if (!seriesId) throw new ValidationError("Test Series ID is required");
    const key = this.cache.generateKey(ENDPOINTS.TESTS_BY_SERIES(seriesId));
    return this.fetchWithCache(
      key,
      async () => {
        const response = await testsAPI.getBySeriesId(seriesId);
        const data = extractListPayload(
          response,
          ENDPOINTS.TESTS_BY_SERIES(seriesId),
        );
        return data.map(mapTestToFrontend);
      },
      options,
    );
  }

  async getTestById(id, options = {}) {
    if (!id) throw new ValidationError("Test ID is required");
    const allTests = await this.getTests(options);
    const idStr = String(id);
    const idNum = Number(id);
    return (
      allTests.find(
        (t) =>
          t._id === id ||
          t.id === id ||
          t._id === idStr ||
          t.id === idStr ||
          t.slug === id ||
          t._id === idNum ||
          t.id === idNum ||
          String(t._id) === idStr ||
          String(t.id) === idStr,
      ) || null
    );
  }

  async getQuestionsByTestId(testId, options = {}) {
    if (!testId) throw new ValidationError("Test ID is required");
    const key = this.cache.generateKey(ENDPOINTS.QUESTIONS_BY_TEST(testId));
    return this.fetchWithCache(
      key,
      async () => {
        // No fabricated fallback: errors from the API propagate to the caller.
        const response = await questionsAPI.getByTestId(testId);
        const data = extractListPayload(
          response,
          ENDPOINTS.QUESTIONS_BY_TEST(testId),
        );
        return data.map(mapQuestionToFrontend);
      },
      options,
    );
  }

  async getStudyMaterialById(id, options = {}) {
    if (!id) throw new ValidationError("Study material ID is required");
    const key = this.cache.generateKey(ENDPOINTS.STUDY_BY_ID(id));
    return this.fetchWithCache(
      key,
      async () => {
        const response = await studyAPI.getById(id);
        return response.data?.data || response.data || null;
      },
      { ttl: this.cache.defaultTTL, ...options },
    );
  }

  async refreshData(dataType) {
    const refreshMap = {
      testSeries: () => this.getTestSeries({ forceRefresh: true }),
      tests: () => this.getTests({ forceRefresh: true }),
      questions: () => this.getQuestions({ forceRefresh: true }),
      studyMaterials: () => this.getStudyMaterials({ forceRefresh: true }),
      examCategories: () => this.getExamCategories({ forceRefresh: true }),
      exams: () => this.getExams({ forceRefresh: true }),
    };
    if (refreshMap[dataType]) return await refreshMap[dataType]();
    throw new ValidationError(`Unknown data type: ${dataType}`);
  }

  async forceRefreshAll() {
    this.clearCache();
    await Promise.allSettled([
      this.getTestSeries({ forceRefresh: true }),
      this.getTests({ forceRefresh: true }),
      this.getQuestions({ forceRefresh: true }),
      this.getStudyMaterials({ forceRefresh: true }),
      this.getExamCategories({ forceRefresh: true }),
      this.getExams({ forceRefresh: true }),
    ]);
  }

  async handleMutation(mutationFn, affectedEndpoints = []) {
    try {
      const result = await mutationFn();
      affectedEndpoints.forEach((endpoint) =>
        this.clearCacheForEndpoint(endpoint),
      );
      this.clearCacheForEndpoint("/admin/");
      this.clearCacheForEndpoint("/study");
      return result;
    } catch (error) {
      if (import.meta.env.DEV) console.error("Mutation failed:", error);
      throw error;
    }
  }
}

const dataService = new DataService();

// Re-export all API namespaces and classes
export {
  apiClient,
  fetchFromAPI,
  CacheService,
  DataService,
  dataService,
  authAPI,
  testsAPI,
  questionsAPI,
  adminAPI,
  seriesAPI,
  userAPI,
  examAPI,
  studyAPI,
  notificationPrefAPI,
};

// Convenience methods from dataService
export const getTestSeries = (...args) => dataService.getTestSeries(...args);
export const getTests = (...args) => dataService.getTests(...args);
export const getQuestions = (...args) => dataService.getQuestions(...args);
export const getStudyMaterials = (...args) =>
  dataService.getStudyMaterials(...args);
export const getExamCategories = (...args) =>
  dataService.getExamCategories(...args);
export const getTestCategories = (...args) =>
  dataService.getTestCategories(...args);
export const getExams = (...args) => dataService.getExams(...args);
export const searchAll = (...args) => dataService.search(...args);
export const getTestSeriesById = (...args) =>
  dataService.getTestSeriesById(...args);
export const getTestsBySeriesId = (...args) =>
  dataService.getTestsBySeriesId(...args);
export const getTestById = (...args) => dataService.getTestById(...args);
export const getQuestionsByTestId = (...args) =>
  dataService.getQuestionsByTestId(...args);
export const getStudyMaterialById = (...args) =>
  dataService.getStudyMaterialById(...args);
export const clearCache = () => dataService.clearCache();
export const forceRefreshAll = () => dataService.forceRefreshAll();
export const handleMutation = (...args) => dataService.handleMutation(...args);
export const refreshData = (...args) => dataService.refreshData(...args);

// Achievement functions
export const getAchievements = () => adminAPI.getAchievements();
export const checkAchievements = () => adminAPI.checkAchievements();

// User Analytics
export const getUserAnalytics = (...args) =>
  dataService.getUserAnalytics(...args);

// Bookmark functions
export const getBookmarks = () => adminAPI.getBookmarks();
export const deleteBookmark = (id) => adminAPI.deleteBookmark(id);

// Public Data functions
export const getExamUpdates = examAPI.getExamUpdates;
export const getExamYearlyData = examAPI.getExamYearlyData;
export const getPublicStats = () => examAPI.getPublicStats();
export const getTestimonials = () => examAPI.getTestimonials();
export const getPromotions = () => examAPI.getPromotions();

// Notification functions
export const getNotifications = (params) => adminAPI.getNotifications(params);
export const markNotificationRead = (id) => adminAPI.markNotificationRead(id);
export const markAllNotificationsRead = () =>
  adminAPI.markAllNotificationsRead();
export const deleteNotification = (id) => adminAPI.deleteNotification(id);

// Leaderboard functions
export const getLeaderboard = (seriesId) => adminAPI.getLeaderboard(seriesId);

// Intelligence Leaderboard - Multiple ranking categories
export const getIntelligenceLeaderboard = async (params = {}) => {
  const queryParams = new URLSearchParams();
  const { type = "overall", testId, seriesId, page, limit, date } = params;
  queryParams.append("type", type);
  if (testId) queryParams.append("testId", testId);
  if (seriesId) queryParams.append("seriesId", seriesId);
  if (page) queryParams.append("page", page);
  if (limit) queryParams.append("limit", limit);
  if (date) queryParams.append("date", date);
  return apiClient.get(`/intelligence/leaderboard?${queryParams.toString()}`);
};

// User streak data
export const getUserStreak = () => apiClient.get("/intelligence/streak");

// Top performers across all tests
export const getTopPerformersLeaderboard = (limit = 10, seriesId = null) => {
  const url = `/intelligence/top-performers?limit=${limit}${seriesId ? `&seriesId=${seriesId}` : ""}`;
  return apiClient.get(url);
};

// Top Performers - fetch users with most tests attempted
export const getTopPerformers = (limit = 10, seriesId = null) => {
  const url = `/intelligence/top-performers?limit=${limit}${seriesId ? `&seriesId=${seriesId}` : ""}`;
  return apiClient.get(url);
};

// Export apiClient as 'api' for compatibility with existing imports
export const api = apiClient;

export default apiClient;
