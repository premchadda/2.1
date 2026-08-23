/**
 * Normalize Request Fields Middleware
 *
 * Purpose: Convert all incoming camelCase field names to snake_case before
 * they reach route handlers. This ensures consistent field naming throughout
 * the backend and eliminates the need for dual-field handling in route code.
 *
 * Also handles specific field aliasing for legacy fields (seriesId/series_id,
 * etc.) to ensure a single canonical field name.
 *
 * Usage: Apply selectively to routes that accept admin input.
 * Already exists: naming-conventions.js has toSnakeCase/toCamelCase utilities.
 * This middleware applies them at the request boundary.
 */

import { toSnakeCase, camelToSnake } from "../utils/naming-conventions.js";

/**
 * Known legacy field name aliases that the frontend may send.
 * Maps camelCase -> snake_case canonical names.
 */
const FIELD_ALIASES = {
  // Category/exam fields
  examCategoryId: "exam_category_id",
  exam_category_id: "exam_category_id",
  testCategoryId: "test_category_id",
  test_category_id: "test_category_id",
  categoryId: "category_id",
  category_id: "category_id",

  // Series/test fields
  seriesId: "series_id",
  series_id: "series_id",
  testSeriesId: "test_series_id",
  test_series_id: "test_series_id",
  stageId: "stage_id",
  stage_id: "stage_id",
  testId: "test_id",
  test_id: "test_id",

  // Question fields
  questionText: "question_text",
  question_text: "question_text",
  questionTextHi: "question_text_hi",
  question_text_hi: "question_text_hi",
  correctOption: "correct_option",
  correct_option: "correct_option",
  optionsHi: "options_hi",
  options_hi: "options_hi",

  // User fields
  isPro: "is_pro",
  is_pro: "is_pro",
  isProUser: "is_pro_user",
  is_pro_user: "is_pro_user",
  isActive: "is_active",
  is_active: "is_active",
  isPinned: "is_pinned",
  is_pinned: "is_pinned",
  isComingSoon: "is_coming_soon",
  is_coming_soon: "is_coming_soon",
  isLive: "is_live",
  is_live: "is_live",
  createdAt: "created_at",
  created_at: "created_at",
  updatedAt: "updated_at",
  updated_at: "updated_at",

  // Content fields
  studyMaterialId: "study_material_id",
  study_material_id: "study_material_id",
  chapterId: "chapter_id",
  chapter_id: "chapter_id",
  topicId: "topic_id",
  topic_id: "topic_id",
  subjectId: "subject_id",
  subject_id: "subject_id",
  quizId: "quiz_id",
  quiz_id: "quiz_id",
  passageId: "passage_id",
  passage_id: "passage_id",
  bannerAssetId: "banner_asset_id",
  banner_asset_id: "banner_asset_id",
  imageAssetId: "image_asset_id",
  image_asset_id: "image_asset_id",
  videoAssetId: "video_asset_id",
  video_asset_id: "video_asset_id",
  thumbnailAssetId: "thumbnail_asset_id",
  thumbnail_asset_id: "thumbnail_asset_id",

  // Display/order fields
  displayOrder: "display_order",
  display_order: "display_order",
  sortOrder: "sort_order",
  sort_order: "sort_order",
  totalTests: "total_tests",
  total_tests: "total_tests",
  totalMarks: "total_marks",
  total_marks: "total_marks",
  passingMarks: "passing_marks",
  passing_marks: "passing_marks",
  negativeMarks: "negative_marks",
  negative_marks: "negative_marks",

  // Exam fields
  examId: "exam_id",
  exam_id: "exam_id",
  subCategoryId: "sub_category_id",
  sub_category_id: "sub_category_id",
  parentCategoryId: "parent_category_id",
  parent_category_id: "parent_category_id",
  ageLimit: "age_limit",
  age_limit: "age_limit",

  // Other common fields
  userId: "user_id",
  user_id: "user_id",
  attemptId: "attempt_id",
  attempt_id: "attempt_id",
  notificationType: "notification_type",
  notification_type: "notification_type",
  buttonText: "button_text",
  button_text: "button_text",
  buttonClass: "button_class",
  button_class: "button_class",
  originalPrice: "original_price",
  original_price: "original_price",
};

/**
 * Fields that should NOT be converted to snake_case.
 * These are fields whose values are themselves identifiers
 * (like slugs, names, descriptions) that must remain as-is.
 */
const PRESERVE_VALUE_FIELDS = new Set([
  "name",
  "title",
  "description",
  "slug",
  "content",
  "explanation",
  "tags",
  "difficulty",
  "type",
  "category",
  "icon",
  "color",
  "colour_hex",
  "email",
  "phone",
  "password",
  "token",
]);

/**
 * Normalize a single request body object.
 * - Converts all camelCase keys to snake_case
 * - Deduplicates aliased fields (prefer existing snake_case if both exist)
 * - Preserves nested objects and arrays
 *
 * @param {Object} body - The request body to normalize
 * @returns {Object} Normalized body with snake_case keys
 */
export function normalizeRequestBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }

  const result = {};

  for (const [key, value] of Object.entries(body)) {
    // Determine the canonical snake_case name for this field
    let canonicalKey = FIELD_ALIASES[key] || camelToSnake(key);

    // If the canonical key already exists in result, skip (prefer existing)
    if (canonicalKey in result) {
      continue;
    }

    // Recursively normalize nested objects/arrays
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      result[canonicalKey] = normalizeRequestBody(value);
    } else if (Array.isArray(value)) {
      result[canonicalKey] = value.map((item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? normalizeRequestBody(item)
          : item,
      );
    } else {
      result[canonicalKey] = value;
    }
  }

  return result;
}

/**
 * Express middleware factory.
 * Applies body normalization to selected HTTP methods.
 *
 * @param {Object} options
 * @param {string[]} options.methods - HTTP methods to normalize (default: ['POST', 'PUT', 'PATCH'])
 * @param {boolean} options.normalizeQuery - Also normalize query params (default: false)
 * @returns {Function} Express middleware
 */
export function normalizeFields(options = {}) {
  const { methods = ["POST", "PUT", "PATCH"], normalizeQuery = false } =
    options;

  const upperMethods = methods.map((m) => m.toUpperCase());

  return (req, res, next) => {
    if (!upperMethods.includes(req.method)) {
      return next();
    }

    // Normalize request body
    if (req.body && typeof req.body === "object") {
      const normalized = normalizeRequestBody(req.body);
      req.body = normalized;
    }

    // Optionally normalize query params
    if (normalizeQuery && req.query && typeof req.query === "object") {
      req.query = normalizeRequestBody(req.query);
    }

    next();
  };
}

export default normalizeFields;
