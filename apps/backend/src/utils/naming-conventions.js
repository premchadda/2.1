/**
 * Naming Convention Utilities
 *
 * Purpose: Provide consistent transformation between snake_case (database)
 * and camelCase (JavaScript/API) at the application boundary layer.
 *
 * Convention Rules:
 * - Database columns: snake_case (PostgreSQL convention)
 * - JavaScript variables/objects: camelCase (JavaScript convention)
 * - API responses: Always camelCase
 * - API requests: camelCase, converted to snake_case via toSnakeCase() before DB writes
 *
 * Usage: Import these utilities when you need to transform data at boundaries.
 * The postgres-helpers already handles toCamel/toSnake internally.
 */

/**
 * Transform snake_case string to camelCase
 * @param {string} str - snake_case string
 * @returns {string} camelCase string
 */
export function snakeToCamel(str) {
  if (!str || typeof str !== "string") return str;
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Transform camelCase string to snake_case
 * @param {string} str - camelCase string
 * @returns {string} snake_case string
 */
export function camelToSnake(str) {
  if (!str || typeof str !== "string") return str;
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Recursively transform all snake_case keys in an object to camelCase
 * Handles nested objects and arrays
 * @param {any} obj - Object with snake_case keys
 * @returns {any} Object with camelCase keys
 */
export function toCamelCase(obj) {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item));
  }

  if (obj instanceof Date) {
    return obj;
  }

  return Object.entries(obj).reduce((acc, [key, value]) => {
    const camelKey = snakeToCamel(key);
    acc[camelKey] = toCamelCase(value);
    return acc;
  }, {});
}

/**
 * Recursively transform all camelCase keys in an object to snake_case
 * Handles nested objects and arrays
 * @param {any} obj - Object with camelCase keys
 * @returns {any} Object with snake_case keys
 */
export function toSnakeCase(obj) {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toSnakeCase(item));
  }

  if (obj instanceof Date) {
    return obj;
  }

  return Object.entries(obj).reduce((acc, [key, value]) => {
    const snakeKey = camelToSnake(key);
    acc[snakeKey] = toSnakeCase(value);
    return acc;
  }, {});
}

/**
 * Normalize a database row to ensure camelCase properties exist.
 * After the stages table fix, all DB results come via toCamel() in postgres-helpers.
 * This function adds snake_case aliases for backward compatibility during transition.
 *
 * @param {Object} row - Database row (should already be camelCase from toCamel())
 * @param {string[]} fields - List of field names in camelCase that need aliases
 * @returns {Object} Same object with snake_case aliases added
 */
export function addSnakeCaseAliases(row, fields) {
  if (!row || typeof row !== "object") return row;

  for (const field of fields) {
    const snakeField = camelToSnake(field);
    // Only add alias if snake_case doesn't already exist and camelCase does
    if (!(snakeField in row) && field in row) {
      row[snakeField] = row[field];
    }
  }

  return row;
}

/**
 * Common field mappings for backward compatibility.
 * These are fields that have both camelCase and snake_case versions in the codebase.
 * Use this to add aliases to objects that need to support both formats.
 */
export const COMMON_FIELD_MAPPINGS = {
  userId: "user_id",
  testId: "test_id",
  // seriesId is the legacy tests/questions link; testSeriesId maps to test_categories.test_series_id.
  seriesId: "series_id",
  testSeriesId: "test_series_id",
  examId: "exam_id",
  categoryId: "category_id",
  stageId: "stage_id",
  studyMaterialId: "study_material_id",
  questionId: "question_id",
  attemptId: "attempt_id",
  parentAttemptId: "parent_attempt_id",
  sourceAttemptId: "source_attempt_id",
  isActive: "is_active",
  isCompleted: "is_completed",
  isPro: "is_pro",
  isProUser: "is_pro_user",
  isReattempt: "is_reattempt",
  isComingSoon: "is_coming_soon",
  isLive: "is_live",
  isPinned: "is_pinned",
  createdAt: "created_at",
  updatedAt: "updated_at",
  submittedAt: "submitted_at",
  expiresAt: "expires_at",
  lastActiveDate: "last_active_date",
  displayOrder: "display_order",
  sortOrder: "sort_order",
  fullName: "full_name",
  ageLimit: "age_limit",
  buttonText: "button_text",
  buttonClass: "button_class",
  originalPrice: "original_price",
  questionNumber: "question_number",
  questionText: "question_text",
  testTitle: "test_title",
  totalMarks: "total_marks",
  totalQuestions: "total_questions",
  timeSpent: "time_spent_seconds",
  attemptNumber: "attempt_number",
  correctCount: "correct_count",
  wrongCount: "wrong_count",
  correctAnswers: "correct_answers",
  wrongAnswers: "wrong_answers",
  unattemptedAnswers: "unattempted_answers",
  attemptCount: "attempt_count",
  unattemptedCount: "unattempted_count",
  avgAccuracy: "avg_accuracy",
  currentStreak: "current_streak",
  bestStreak: "best_streak",
  totalActiveDays: "total_active_days",
  bannerAssetId: "banner_asset_id",
  imageAssetId: "image_asset_id",
  promotionBannerAssetId: "promotion_banner_asset_id",
  maxParticipants: "max_participants",
  proExpiry: "pro_expiry",
  proPassExpiry: "pro_pass_expiry",
  passType: "pass_type",
  examCategoryId: "exam_category_id",
  chapterId: "chapter_id",
  topicId: "topic_id",
  subjectId: "subject_id",
  quizId: "quiz_id",
  passageId: "passage_id",
  testCategoryId: "test_category_id",
  quizDate: "quiz_date",
  dueAt: "due_at",
  avgScore: "avg_score",
  authTokenHash: "auth_token_hash",
  csrfToken: "csrf_token",
  notificationType: "notification_type",
  leaderboardType: "leaderboard_type",
  scopeKey: "scope_key",
  featureKey: "feature_key",
  limitValue: "limit_value",
  selectedOptionId: "selected_option_id",
  lastAttemptedAt: "last_attempted_at",
  lastSeenAt: "last_seen_at",
  enrolledSeries: "enrolled_series",
  enrolledExams: "enrolled_exams",
  colourHex: "colour_hex",
  autoRenew: "auto_renew",
  paymentMethod: "payment_method",
  transactionId: "transaction_id",
  amountPaid: "amount_paid",
  expiryDate: "expiry_date",
  planType: "plan_type",
  isUnattempted: "is_unattempted",
  isCorrect: "is_correct",
  isRead: "is_read",
  reamptemptType: "reamptempt_type",
  subCategoryId: "sub_category_id",
};

/**
 * Apply backward-compatible aliases to a single object.
 * For each field in COMMON_FIELD_MAPPINGS, if the snake_case version doesn't
 * exist but the camelCase version does, create the snake_case alias.
 *
 * @param {Object} obj - Object to add aliases to
 * @returns {Object} Same object with aliases added
 */
export function applyCompatibilityAliases(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;

  for (const [camelKey, snakeKey] of Object.entries(COMMON_FIELD_MAPPINGS)) {
    if (!(snakeKey in obj) && camelKey in obj) {
      obj[snakeKey] = obj[camelKey];
    }
    // Also add camelCase alias if snake_case exists but camelCase doesn't
    if (!(camelKey in obj) && snakeKey in obj) {
      obj[camelKey] = obj[snakeKey];
    }
  }

  return obj;
}

export default {
  snakeToCamel,
  camelToSnake,
  toCamelCase,
  toSnakeCase,
  addSnakeCaseAliases,
  applyCompatibilityAliases,
  COMMON_FIELD_MAPPINGS,
};
