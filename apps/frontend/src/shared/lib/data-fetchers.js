/**
 * Data Fetchers - Specific data fetch implementations for each entity type
 *
 * Contains the mapping logic between API responses and frontend data models.
 * Uses dataFetcher for caching and retry logic.
 *
 * NOTE: This file is intentionally kept as-is. The refactored cache/data-fetcher/error
 * modules exist separately but dataService remains the source of truth for the apiClient
 * and entity fetch functions. Can be refactored in a future sprint.
 */

import { apiClient, ValidationError, dataService } from "./dataService.js";
import {
  mapTestSeriesToFrontend,
  mapTestToFrontend,
  mapQuestionToFrontend,
} from "../types/index.js";

// ===== ENTITY FETCHERS =====
// These wrap dataService methods to provide a consistent interface

export const getEntityFetchers = () => ({
  // Test Series
  getTestSeries: (options = {}) => dataService.getTestSeries(options),

  // Tests
  getTests: (options = {}) => dataService.getTests(options),

  // Questions
  getQuestions: (options = {}) => dataService.getQuestions(options),

  // Study Materials
  getStudyMaterials: (options = {}) => dataService.getStudyMaterials(options),

  // Exam Categories
  getExamCategories: (options = {}) => dataService.getExamCategories(options),

  // Exams
  getExams: (options = {}) => dataService.getExams(options),

  // Test Categories
  getTestCategories: (options = {}) => dataService.getTestCategories(options),

  // User Analytics
  getUserAnalytics: (options = {}) => dataService.getUserAnalytics(options),

  // Global Search
  search: (query, type = "all", options = {}) =>
    dataService.search(query, type, options),
});

// ===== HELPER METHODS =====
// Re-export from dataService for backward compatibility

/**
 * Get test series by ID (searches cached data)
 */
export const getTestSeriesById = (...args) =>
  dataService.getTestSeriesById(...args);

/**
 * Get tests by series ID
 */
export const getTestsBySeriesId = (...args) =>
  dataService.getTestsBySeriesId(...args);

/**
 * Get test by ID (searches cached data)
 */
export const getTestById = (...args) => dataService.getTestById(...args);

/**
 * Get questions by test ID
 */
export const getQuestionsByTestId = (...args) =>
  dataService.getQuestionsByTestId(...args);

/**
 * Get study material by ID
 */
export const getStudyMaterialById = (...args) =>
  dataService.getStudyMaterialById(...args);

export { apiClient, ValidationError };
export default getEntityFetchers;
