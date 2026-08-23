// Consolidated Data Service - Barrel module re-exporting all domain APIs
import {
  mapTestSeriesToFrontend,
  mapTestToFrontend,
  mapQuestionToFrontend,
} from "../types/index.js";
import {
  apiClient,
  ValidationError,
  AuthenticationError,
} from "./apiClient.js";
import { authAPI } from "./authAPI.js";
import { seriesAPI } from "./seriesAPI.js";
import { testsAPI } from "./testsAPI.js";
import { userAPI } from "./userAPI.js";
import { studyAPI } from "./studyAPI.js";
import { questionsAPI } from "./questionsAPI.js";
import { examAPI } from "./examAPI.js";
import { adminAPI } from "./adminAPI.js";
import { bookmarksAPI } from "./bookmarksAPI.js";

// Re-export all error classes and utilities from apiClient
export {
  DataError,
  NetworkError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  apiClient,
  fetchFromAPI,
  api,
  isCancel,
} from "./apiClient.js";

// Re-export all domain API modules
export {
  authAPI,
  seriesAPI,
  testsAPI,
  userAPI,
  studyAPI,
  questionsAPI,
  examAPI,
  adminAPI,
  bookmarksAPI,
};
export { notificationPrefAPI } from "./notificationPrefAPI.js";
export { practiceAPI } from "./practiceAPI.js";
export { aiAPI } from "./aiAPI.js";
export { adaptiveDifficultyAPI } from "./adaptiveDifficultyAPI.js";
export {
  pypAPI,
  getPypCategories,
  getPypCategoryExams,
  getPypExamPapers,
  getPypExamInsights,
} from "./pypAPI.js";

// ===== ADVANCED CACHING SERVICE =====
class CacheService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeouts = new Map();
    this.defaultTTL = 30000;
    this.longTTL = 300000;
  }

  generateKey(endpoint, params = {}) {
    const paramStr = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&");
    return `${endpoint}?${paramStr}`;
  }

  generateUserKey(userId, endpoint, params = {}) {
    const paramStr = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&");
    return `/users/${userId}${endpoint}?${paramStr}`;
  }

  set(key, data, ttl = this.defaultTTL) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    });

    if (this.cacheTimeouts.has(key)) {
      clearTimeout(this.cacheTimeouts.get(key));
    }

    const timeoutId = setTimeout(() => {
      this.cache.delete(key);
      this.cacheTimeouts.delete(key);
    }, ttl);

    this.cacheTimeouts.set(key, timeoutId);
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      if (this.cacheTimeouts.has(key)) {
        clearTimeout(this.cacheTimeouts.get(key));
        this.cacheTimeouts.delete(key);
      }
      return null;
    }

    return item.data;
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    this.cache.delete(key);
    if (this.cacheTimeouts.has(key)) {
      clearTimeout(this.cacheTimeouts.get(key));
      this.cacheTimeouts.delete(key);
    }
  }

  clear() {
    this.cache.clear();
    this.cacheTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.cacheTimeouts.clear();
  }

  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// ===== INTELLIGENT DATA SERVICE =====
class DataService {
  constructor() {
    this.cache = new CacheService();
    this.inFlight = new Map();
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
      const cached = this.cache.get(key);
      if (cached !== null) {
        return cached;
      }
    }

    if (this.inFlight.has(key)) {
      return this.inFlight.get(key);
    }

    const promise = (async () => {
      let lastError;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const data = await fetchFn();

          if (useCache) {
            this.cache.set(key, data, ttl);
          }

          this.retryAttempts.delete(key);
          return data;
        } catch (error) {
          lastError = error;
          console.error(`Fetch attempt ${attempt} failed for ${key}:`, error);

          if (
            error instanceof ValidationError ||
            error instanceof AuthenticationError
          ) {
            throw error;
          }

          if (attempt === retries) {
            break;
          }

          const delay = retryDelay * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      throw lastError;
    })();

    this.inFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      this.inFlight.delete(key);
    }
  }

  clearCacheForEndpoint(endpointPattern) {
    const keysToDelete = [];
    for (const key of this.cache.cache.keys()) {
      if (key.includes(endpointPattern)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  clearCache() {
    this.cache.clear();
  }

  async getTestSeries(options = {}) {
    const key = this.cache.generateKey("/admin/test-series");
    return this.fetchWithCache(
      key,
      async () => {
        const response = await seriesAPI.getAll();
        const data = response.data?.data || response.data || [];
        return data.map(mapTestSeriesToFrontend);
      },
      {
        ttl: this.cache.longTTL,
        ...options,
      },
    );
  }

  async getUserAnalytics(options = {}) {
    const { userId } = options;
    // httpOnly cookie auth: no localStorage token lookup — the httpOnly cookie
    // is sent automatically via withCredentials. We attempt the fetch and let
    // the 401 handler return null for anonymous visitors instead of gating on
    // a non-existent `token` key.
    const key = this.cache.generateUserKey(userId || "me", "/users/analytics");
    return this.fetchWithCache(
      key,
      async () => {
        try {
          const response = await userAPI.getAnalytics();
          return response.data?.data || response.data || null;
        } catch (err) {
          if (err?.response?.status === 401 || err?.status === 401) return null;
          throw err;
        }
      },
      {
        ttl: 60000,
        ...options,
      },
    );
  }

  async getTests(options = {}) {
    const key = this.cache.generateKey("/admin/tests");
    return this.fetchWithCache(
      key,
      async () => {
        const response = await testsAPI.getAll();
        const data = response.data?.data || response.data || [];
        return data.map(mapTestToFrontend);
      },
      options,
    );
  }

  async getQuestions(options = {}) {
    const key = this.cache.generateKey("/admin/questions");
    return this.fetchWithCache(
      key,
      async () => {
        const response = await questionsAPI.getAll();
        const data = response.data?.data || response.data || [];
        return data.map(mapQuestionToFrontend);
      },
      options,
    );
  }

  async getStudyMaterials(options = {}) {
    const key = this.cache.generateKey("/study");
    return this.fetchWithCache(
      key,
      async () => {
        const response = await studyAPI.getAll();
        return response.data?.data || response.data || [];
      },
      {
        ttl: this.cache.longTTL,
        ...options,
      },
    );
  }

  async getExamCategories(options = {}) {
    const key = this.cache.generateKey("/exam-categories");
    return this.fetchWithCache(
      key,
      async () => {
        const response = await examAPI.getCategories();
        return response.data?.data || response.data || [];
      },
      {
        ttl: this.cache.longTTL,
        ...options,
      },
    );
  }

  async getExams(options = {}) {
    const key = this.cache.generateKey("/exams");
    return this.fetchWithCache(
      key,
      async () => {
        const response = await examAPI.getExams();
        return response.data?.data || response.data || [];
      },
      {
        ttl: this.cache.longTTL,
        ...options,
      },
    );
  }

  async getTestCategories(options = {}) {
    const key = this.cache.generateKey("/test-categories");
    return this.fetchWithCache(
      key,
      async () => {
        const response = await apiClient.get("/api/test-categories");
        return response.data?.data || response.data || [];
      },
      {
        ttl: this.cache.longTTL,
        ...options,
      },
    );
  }

  async search(query, type = "all", options = {}) {
    const { signal, ...cacheOptions } = options;
    const key = this.cache.generateKey("/search", { q: query, type });
    return this.fetchWithCache(
      key,
      async () => {
        const response = await apiClient.get("/api/search", {
          params: { q: query, type },
          signal,
        });
        return response.data?.data || response.data || [];
      },
      {
        ttl: 60000,
        ...cacheOptions,
      },
    );
  }

  async getTestSeriesById(id, options = {}) {
    if (!id) throw new ValidationError("Test Series ID is required");
    const key = this.cache.generateKey(`/admin/test-series/${id}`);
    return this.fetchWithCache(
      key,
      async () => {
        try {
          const response = await seriesAPI.getById(id);
          const data = response.data?.data || response.data;
          if (data) return mapTestSeriesToFrontend(data);
        } catch {
          // Fallback to searching cached allSeries if direct getById not supported
          try {
            const allSeries = await this.getTestSeries(options);
            const idLower = String(id).toLowerCase().trim();
            const found = allSeries.find(
              (s) =>
                String(s.id || "").toLowerCase() === idLower ||
                String(s.slug || "").toLowerCase() === idLower ||
                String(s.public_id || "").toLowerCase() === idLower ||
                String(s.publicId || "").toLowerCase() === idLower ||
                String(s._id || "") === String(id) ||
                String(s.dbId || "") === String(id),
            );
            if (found) return found;
          } catch {}
        }
        return null;
      },
      {
        ttl: this.cache.longTTL,
        ...options,
      },
    );
  }

  async getTestsBySeriesId(seriesId, options = {}) {
    if (!seriesId) throw new ValidationError("Test Series ID is required");

    const key = this.cache.generateKey(`/tests/series/${seriesId}`);
    return this.fetchWithCache(
      key,
      async () => {
        const response = await testsAPI.getBySeriesId(seriesId);
        const data = response.data?.data || response.data || [];
        const tests = Array.isArray(data) ? data.map(mapTestToFrontend) : [];

        return tests;
      },
      options,
    );
  }

  async getTestById(id, options = {}) {
    if (!id) throw new ValidationError("Test ID is required");

    const key = this.cache.generateKey(`/tests/${id}`);
    return this.fetchWithCache(
      key,
      async () => {
        try {
          const response = await testsAPI.getById(id);
          const data = response.data?.data || response.data;
          if (data) return mapTestToFrontend(data);
        } catch (err) {
          // Fallback search in cached list
        }

        const allTests = await this.getTests(options);
        const idStr = String(id).toLowerCase();
        const idNum = Number(id);

        const found = allTests.find((t) => {
          if (!t) return false;
          const tIdStr = String(t.id || "").toLowerCase();
          const tDbIdStr = String(t._id || "").toLowerCase();
          const tPubIdStr = String(
            t.public_id || t.publicId || "",
          ).toLowerCase();
          const tSlugStr = String(t.slug || "").toLowerCase();
          const tUuidStr = String(
            t.public_id_uuid || t.uuid || "",
          ).toLowerCase();

          return (
            tIdStr === idStr ||
            tDbIdStr === idStr ||
            tPubIdStr === idStr ||
            tSlugStr === idStr ||
            tUuidStr === idStr ||
            (!isNaN(idNum) && (t._id === idNum || t.id === idNum))
          );
        });

        if (!found) return null;
        return found;
      },
      options,
    );
  }

  async getQuestionsByTestId(testId, options = {}) {
    if (!testId) throw new ValidationError("Test ID is required");
    const key = this.cache.generateKey(`/questions/test/${testId}`);
    return this.fetchWithCache(
      key,
      async () => {
        // NOTE: Do NOT fall back to getQuestions() / questionsAPI.getAll() here.
        // That method calls /api/admin/questions — an admin-only route that the
        // student-facing frontend must never hit. Errors from getByTestId must
        // surface to the caller so it can show a proper empty/error state.
        const response = await questionsAPI.getByTestId(testId);
        const questions = response.data?.data || response.data || [];
        return questions.map(mapQuestionToFrontend);
      },
      options,
    );
  }

  async getStudyMaterialById(id, options = {}) {
    if (!id) throw new ValidationError("Study material ID is required");

    const key = this.cache.generateKey(`/study/${id}`);
    return this.fetchWithCache(
      key,
      async () => {
        const response = await studyAPI.getById(id);
        return response.data?.data || response.data || null;
      },
      {
        ttl: this.cache.defaultTTL,
        ...options,
      },
    );
  }

  async refreshData(dataType) {
    const refreshMap = {
      testSeries: () => this.getTestSeries({ forceRefresh: true }),
      tests: () => this.getTests({ forceRefresh: true }),
      // NOTE: 'questions' deliberately omitted — getQuestions() calls /api/admin/questions
      // which is an admin-only route not accessible by student frontend users.
      studyMaterials: () => this.getStudyMaterials({ forceRefresh: true }),
      examCategories: () => this.getExamCategories({ forceRefresh: true }),
      exams: () => this.getExams({ forceRefresh: true }),
    };

    if (refreshMap[dataType]) {
      return await refreshMap[dataType]();
    }

    throw new ValidationError(`Unknown data type: ${dataType}`);
  }

  async forceRefreshAll() {
    this.clearCache();
    await Promise.allSettled([
      this.getTestSeries({ forceRefresh: true }),
      this.getTests({ forceRefresh: true }),
      // NOTE: getQuestions() omitted — it calls /api/admin/questions which is admin-only.
      this.getStudyMaterials({ forceRefresh: true }),
      this.getExamCategories({ forceRefresh: true }),
      this.getExams({ forceRefresh: true }),
    ]);
  }

  async handleMutation(mutationFn, affectedEndpoints = []) {
    try {
      const result = await mutationFn();

      affectedEndpoints.forEach((endpoint) => {
        this.clearCacheForEndpoint(endpoint);
      });

      this.clearCacheForEndpoint("/admin/");
      this.clearCacheForEndpoint("/study");

      return result;
    } catch (error) {
      console.error("Mutation failed:", error);
      throw error;
    }
  }
}

const dataService = new DataService();

export { dataService };

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
export const getBookmarks = (page, limit) => bookmarksAPI.getAll(page, limit);
export const deleteBookmark = (id) => bookmarksAPI.remove(id);
export const getBookmarksCount = () => bookmarksAPI.getCount();
export const addBookmark = (data) => bookmarksAPI.add(data);
export const toggleBookmark = (data) => bookmarksAPI.toggle(data);

// Public Data functions
export const getExamUpdates = examAPI.getExamUpdates;
export const getExamYearlyData = examAPI.getExamYearlyData;
export const getPublicStats = async () => {
  const response = await examAPI.getPublicStats();
  return response.data?.data || response.data;
};
export const getTestimonials = () => examAPI.getTestimonials();
export const getPromotions = () => examAPI.getPromotions();

// Notification functions
export const getNotifications = (params) => adminAPI.getNotifications(params);
export const markNotificationRead = (id) => adminAPI.markNotificationRead(id);
export const markAllNotificationsRead = () =>
  adminAPI.markAllNotificationsRead();
export const deleteNotification = (id) => adminAPI.deleteNotification(id);
export const clearAllNotifications = () => adminAPI.clearAllNotifications();

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

  return apiClient.get(
    `/api/intelligence/leaderboard?${queryParams.toString()}`,
  );
};

// User streak data
export const getUserStreak = () => apiClient.get("/api/intelligence/streak");

// Top performers across all tests — single implementation, aliased for backward compat
export const getTopPerformers = (limit = 10, seriesId = null) => {
  const url = `/api/intelligence/top-performers?limit=${limit}${seriesId ? `&seriesId=${seriesId}` : ""}`;
  return apiClient.get(url);
};
export const getTopPerformersLeaderboard = getTopPerformers;

export default apiClient;
