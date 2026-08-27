// Frontend Type Definitions for Data Models
import { getNormalizedEnrolledSeries } from "../lib/enrollment.js";
import {
  decodeHtmlEntities,
  cleanHtmlWrapper,
  extractBilingualContent,
} from "../lib/htmlSanitizer.js";
import { getAssetUrl } from "../config/assets-config.js";

/**
 * User data structure
 * @typedef {Object} User
 * @property {string} id - User ID
 * @property {string} name - User's full name
 * @property {string} email - User's email address
 * @property {string} [mobile] - User's mobile number
 * @property {string} [role] - User role (user/admin)
 * @property {boolean} isProUser - Whether user has Pro Pass
 * @property {string|null} proPassExpiry - Expiry date of Pro Pass
 * @property {string[]} [enrolledSeries] - Array of enrolled series IDs
 * @property {Object} [attemptedTests] - Map of seriesId to attempt count
 * @property {string} [createdAt] - Creation timestamp
 */

/**
 * Test Series data structure
 * @typedef {Object} TestSeries
 * @property {string} id - Series ID (mapped from slug)
 * @property {string} slug - URL-friendly identifier
 * @property {string} title - Series title
 * @property {string} category - Category (SSC, Railway, etc.)
 * @property {string} [examId] - Exam ID (replaces legacy subcategory)
 * @property {string} [description] - Series description
 * @property {string} [image] - Image URL
 * @property {string} [thumbnail] - Thumbnail URL
 * @property {string} [icon] - Emoji or icon
 * @property {number} totalTests - Total number of tests
 * @property {number} freeTests - Number of free tests
 * @property {string} users - Active users count (formatted string)
 * @property {string} [activeUsers] - Active users count
 * @property {number} rating - Average rating (0-5)
 * @property {string[]} [tags] - Series tags
 * @property {string[]} [testTypes] - Available test types
 * @property {boolean} isActive - Whether series is active
 * @property {boolean} isPro - Whether series requires Pro Pass
 * @property {number} price - Price if paid
 * @property {string} difficulty - Difficulty level
 * @property {string[]} [stageNames] - Stage names (e.g., ["Tier 1", "Tier 2"])
 * @property {string} [createdAt] - Creation timestamp
 * @property {string} [updatedAt] - Last update timestamp
 */

/**
 * Test data structure
 * @typedef {Object} Test
 * @property {string} id - Test ID
 * @property {string} title - Test title
 * @property {string} category - Test category
 * @property {string} subCategory - Test sub-category
 * @property {string} type - Test type (Free/Pro)
 * @property {number} questions - Number of questions
 * @property {number} duration - Duration in minutes
 * @property {number} marks - Total marks
 * @property {string[]} tags - Test tags
 * @property {string} seriesId - Parent series ID
 * @property {string} [createdAt] - Creation timestamp
 */

/**
 * Question data structure
 * @typedef {Object} Question
 * @property {string} id - Question ID
 * @property {Object} text - Question text in different languages
 * @property {Object} options - Answer options in different languages
 * @property {number} correct - Index of correct answer
 * @property {string} section - Subject section
 * @property {string} explanation - Explanation text
 * @property {string} testId - Parent test ID
 */

/**
 * Study Material data structure
 * @typedef {Object} StudyMaterial
 * @property {string} id - Material ID
 * @property {string} title - Material title
 * @property {string} icon - Icon name
 * @property {number} topics - Number of topics
 * @property {number} videos - Number of videos
 * @property {number} pdf - Number of PDFs
 * @property {number} tests - Number of tests
 * @property {string} color - Text color class
 * @property {string} bg - Background color class
 * @property {Array} chapters - Array of chapters
 */

/**
 * Chapter data structure
 * @typedef {Object} Chapter
 * @property {number} id - Chapter ID
 * @property {string} title - Chapter title
 * @property {string} desc - Chapter description
 * @property {number} videos - Number of videos
 * @property {number} pdf - Number of PDFs
 * @property {string} duration - Total duration
 * @property {number} progress - Progress percentage
 */

// Data mapping functions

/**
 * Maps backend User model to frontend User type
 * @param {Object} backendUser - User object from backend
 * @returns {User} Frontend user object
 */
/**
 * Check if Pro Pass is active (not expired)
 * @param {boolean} isProUser - Whether user has Pro Pass
 * @param {string|null} expiryDate - Expiry date of Pro Pass
 * @returns {boolean} Whether Pro Pass is currently active
 */
function isProPassActive(isProUser, expiryDate) {
  if (!isProUser) return false;

  if (expiryDate) {
    const expiry = new Date(expiryDate);
    const now = new Date();
    return expiry > now;
  }

  // If isProUser is true but no expiry date, assume active
  return true;
}

export function mapUserToFrontend(backendUser) {
  const isProUser =
    backendUser.is_pro !== undefined
      ? backendUser.is_pro
      : backendUser.isProUser || backendUser.is_pro_user || false;
  const proPassExpiry =
    backendUser.pro_expiry ||
    backendUser.proExpiry ||
    backendUser.proPassExpiry ||
    null;
  // Handle both camelCase and snake_case for enrolledSeries (PostgreSQL returns snake_case)
  const enrolledSeries =
    backendUser.enrolledSeries || backendUser.enrolled_series || [];
  const avatar =
    backendUser.avatar ||
    backendUser.avatar_url ||
    backendUser.avatarUrl ||
    null;
  const banner =
    backendUser.banner ||
    backendUser.banner_url ||
    backendUser.bannerUrl ||
    null;

  return {
    id: backendUser.id || backendUser._id,
    name: backendUser.name,
    email: backendUser.email,
    mobile: backendUser.mobile,
    phone: backendUser.phone || backendUser.mobile,
    // API responses store local profile assets as `/assets/...`. Resolve them
    // once here so every consumer uses the backend origin when needed.
    avatar: getAssetUrl(avatar),
    banner: getAssetUrl(banner),
    role: backendUser.role,
    isProUser,
    proPassExpiry,
    passType: backendUser.pass_type || backendUser.passType || "free",
    hasProPass: isProPassActive(isProUser, proPassExpiry),
    enrolledSeries: getNormalizedEnrolledSeries(enrolledSeries),
    attemptedTests: backendUser.attemptedTests || {},
    attemptedTestIds: backendUser.attemptedTestIds || [],
    dateOfBirth: backendUser.dateOfBirth || backendUser.date_of_birth,
    location: backendUser.location,
    education: backendUser.education,
    bio: backendUser.bio,
    notificationPreferences:
      backendUser.notificationPreferences ||
      backendUser.notification_preferences,
    privacy: backendUser.privacy,
    examPreferences:
      backendUser.examPreferences || backendUser.exam_preferences,
    createdAt: backendUser.created_at || backendUser.createdAt,
  };
}

/**
 * Maps backend TestSeries model to frontend TestSeries type
 * @param {Object} backendSeries - TestSeries object from backend
 * @returns {TestSeries} Frontend test series object
 */
export function mapTestSeriesToFrontend(backendSeries) {
  if (!backendSeries) return null;
  const publicId =
    backendSeries.publicId ||
    backendSeries.public_id ||
    (typeof backendSeries.id === "string" && backendSeries.id.startsWith("ser_")
      ? backendSeries.id
      : null);
  const resolvedId = publicId || backendSeries.slug || backendSeries.id;
  return {
    id: resolvedId,
    _id: backendSeries._id || backendSeries.id,
    dbId: backendSeries._id || backendSeries.id,
    public_id: publicId,
    publicId: publicId,
    slug: backendSeries.slug,
    title: backendSeries.title,
    category: backendSeries.category,
    examId: backendSeries.examId || backendSeries.exam_id || null,
    exam_id: backendSeries.examId || backendSeries.exam_id || null,
    // Provide labels separately if they exist in the backend response
    categoryName:
      backendSeries.category_name || backendSeries.categoryName || null,
    examName: backendSeries.exam_name || backendSeries.examName || null,
    stageName: backendSeries.stage_name || backendSeries.stageName || null,
    stageNames: backendSeries.stageNames || backendSeries.stage_names || null,
    description: backendSeries.description,
    image:
      backendSeries.image ||
      backendSeries.thumbnail ||
      backendSeries.banner_url,
    thumbnail: backendSeries.thumbnail,
    icon: backendSeries.icon,
    totalTests: Number(
      backendSeries.totalTests || backendSeries.total_tests || 0,
    ),
    freeTests: Number(backendSeries.freeTests || backendSeries.free_tests || 0),
    users:
      backendSeries.users ||
      backendSeries.usersCount ||
      backendSeries.activeUsers ||
      "0",
    activeUsers: backendSeries.activeUsers,
    rating: backendSeries.rating || "4.5",
    tags: backendSeries.tags || [],
    testTypes: backendSeries.testTypes || backendSeries.test_types || [],
    testCounts: backendSeries.testCounts || backendSeries.test_counts || {},
    isActive:
      backendSeries.is_active !== undefined
        ? backendSeries.is_active
        : backendSeries.isActive !== false,
    status:
      backendSeries.status === "disabled"
        ? "archived"
        : backendSeries.status || "draft",
    isPro:
      backendSeries.is_pro !== undefined
        ? backendSeries.is_pro
        : backendSeries.isPro || false,
    price: backendSeries.price,
    difficulty: (
      backendSeries.difficulty ||
      backendSeries.difficulty_level ||
      "medium"
    ).toLowerCase(),
    isComingSoon:
      backendSeries.is_coming_soon || backendSeries.isComingSoon || false,
    stages: backendSeries.stages || [],
    // Added missing fields for card display and ordering
    languages: backendSeries.languages || ["Eng", "Hin"],
    order: backendSeries.order || 0,
    isPinned: backendSeries.is_pinned || backendSeries.isPinned || false,
    colourHex: backendSeries.colour_hex || backendSeries.colourHex || null,
    createdAt: backendSeries.createdAt || backendSeries.created_at,
    updatedAt: backendSeries.updatedAt || backendSeries.updated_at,
  };
}

export function mapTestToFrontend(backendTest) {
  if (!backendTest) return null;
  const bannerAssetId =
    backendTest.bannerAssetId || backendTest.banner_asset_id || null;
  const promotionBannerAssetId =
    backendTest.promotionBannerAssetId ||
    backendTest.promotion_banner_asset_id ||
    null;
  const resolvedId =
    backendTest.public_id ||
    backendTest.public_id_uuid ||
    backendTest.uuid ||
    (backendTest.id !== undefined && backendTest.id !== null
      ? String(backendTest.id)
      : null) ||
    (backendTest._id !== undefined && backendTest._id !== null
      ? String(backendTest._id)
      : null) ||
    backendTest.slug;

  const subCat =
    backendTest.subcategory ||
    backendTest.subCategory ||
    backendTest.sub_category ||
    null;
  const testCatId =
    backendTest.test_category_id ||
    backendTest.testCategoryId ||
    backendTest.category_id ||
    backendTest.categoryId ||
    null;
  const subCatId =
    backendTest.sub_category_id || backendTest.subCategoryId || null;
  const examId = backendTest.exam_id || backendTest.examId || subCat || null;

  return {
    id: resolvedId,
    _id: backendTest.id || backendTest._id,
    public_id:
      backendTest.public_id || backendTest.public_id_uuid || resolvedId,
    slug: backendTest.slug,
    title: backendTest.title,
    category: backendTest.category,
    subCategory: subCat,
    subcategory: subCat,
    sub_category: subCat,
    examId: examId,
    exam_id: examId,
    testCategoryId: testCatId,
    test_category_id: testCatId,
    categoryId: testCatId,
    category_id: testCatId,
    subCategoryId: subCatId,
    sub_category_id: subCatId,
    testCategoryName:
      backendTest.test_category_name || backendTest.testCategoryName || null,
    categoryName: backendTest.category_name || backendTest.categoryName || null,
    categorySlug: backendTest.category_slug || backendTest.categorySlug || null,
    category_slug:
      backendTest.category_slug || backendTest.categorySlug || null,
    subCategorySlug:
      backendTest.sub_category_slug || backendTest.subCategorySlug || null,
    sub_category_slug:
      backendTest.sub_category_slug || backendTest.subCategorySlug || null,
    categoryPathIds:
      backendTest.category_path_ids || backendTest.categoryPathIds || [],
    category_path_ids:
      backendTest.category_path_ids || backendTest.categoryPathIds || [],
    categoryPathNames:
      backendTest.category_path_names || backendTest.categoryPathNames || [],
    category_path_names:
      backendTest.category_path_names || backendTest.categoryPathNames || [],
    type: backendTest.type || (backendTest.is_pro ? "Pro" : "Free"),
    isPro:
      backendTest.is_pro !== undefined
        ? backendTest.is_pro
        : backendTest.isPro || false,
    totalQuestions:
      backendTest.total_questions || backendTest.totalQuestions || 0,
    totalMarks: backendTest.total_marks || backendTest.totalMarks || 0,
    questions:
      backendTest.questions ||
      backendTest.total_questions ||
      backendTest.totalQuestions ||
      0,
    duration: backendTest.duration || 60,
    year:
      backendTest.year || backendTest.pyq_year || backendTest.pyqYear || null,
    pyqYear:
      backendTest.pyq_year || backendTest.pyqYear || backendTest.year || null,
    pyq_year:
      backendTest.pyq_year || backendTest.pyqYear || backendTest.year || null,
    isPyq:
      backendTest.is_pyq !== undefined
        ? backendTest.is_pyq
        : backendTest.isPyq || false,
    is_pyq:
      backendTest.is_pyq !== undefined
        ? backendTest.is_pyq
        : backendTest.isPyq || false,
    tags: backendTest.tags || [],
    languages: backendTest.languages || [],
    isComingSoon:
      backendTest.is_coming_soon !== undefined
        ? backendTest.is_coming_soon
        : backendTest.isComingSoon || false,
    comingSoonDate:
      backendTest.coming_soon_date || backendTest.comingSoonDate || null,
    testSeriesId:
      backendTest.test_series_id ||
      backendTest.testSeriesId ||
      backendTest.series_id ||
      backendTest.seriesId,
    seriesId:
      backendTest.test_series_id ||
      backendTest.testSeriesId ||
      backendTest.series_id ||
      backendTest.seriesId,
    bannerAssetId,
    promotionBannerAssetId,
    bannerUrl:
      backendTest.bannerUrl ||
      backendTest.banner_url ||
      backendTest.bannerImageUrl ||
      backendTest.banner_image_url ||
      null,
    promotionBannerUrl:
      backendTest.promotionBannerUrl ||
      backendTest.promotion_banner_url ||
      null,
    isActive:
      backendTest.is_active !== undefined
        ? backendTest.is_active
        : backendTest.isActive !== false,
    difficulty: (
      backendTest.difficulty ||
      backendTest.difficulty_level ||
      "medium"
    ).toLowerCase(),
    stageId: backendTest.stage_id || backendTest.stageId,
    stage_id: backendTest.stage_id || backendTest.stageId,
    stageIds: backendTest.stage_ids || backendTest.stageIds || [],
    stage_ids: backendTest.stage_ids || backendTest.stageIds || [],
    tier: backendTest.tier || null,
    status:
      backendTest.status === "disabled"
        ? "archived"
        : backendTest.status ||
          (backendTest.is_active !== false && backendTest.isActive !== false
            ? "published"
            : "draft"),
    marksPerQuestion:
      backendTest.marksPerQuestion !== undefined
        ? Number(backendTest.marksPerQuestion)
        : backendTest.marks_per_question !== undefined
          ? Number(backendTest.marks_per_question)
          : 2,
    negativeMarking:
      backendTest.negativeMarking !== undefined
        ? Number(backendTest.negativeMarking)
        : backendTest.negative_marking !== undefined
          ? Number(backendTest.negative_marking)
          : 0.5,
    negativeMarks:
      backendTest.negativeMarks !== undefined
        ? Number(backendTest.negativeMarks)
        : backendTest.negative_marks !== undefined
          ? Number(backendTest.negative_marks)
          : 0.5,
    passingMarks:
      backendTest.passingMarks !== undefined
        ? Number(backendTest.passingMarks)
        : backendTest.passing_marks !== undefined
          ? Number(backendTest.passing_marks)
          : 0,
    sections: Array.isArray(backendTest.sections) ? backendTest.sections : [],
    testSections: backendTest.testSections || backendTest.test_sections || null,
    instructions: backendTest.instructions || null,
    hasSectionalTiming: Boolean(
      backendTest.hasSectionalTiming ||
      backendTest.has_sectional_timing ||
      backendTest.sectionalTiming ||
      backendTest.enableSectionalTiming,
    ),
    createdAt: backendTest.created_at || backendTest.createdAt,
    updatedAt: backendTest.updated_at || backendTest.updatedAt,
  };
}

/**
 * Maps backend Question model to frontend Question type
 * Handles PostgreSQL column naming (snake_case) and converts to frontend format
 * @param {Object} backendQuestion - Question object from backend
 * @returns {Question} Frontend question object
 */
export function mapQuestionToFrontend(backendQuestion) {
  // 1. Process question text & bilingual spans
  let textFormatted = { en: "", hi: "" };
  const rawText =
    backendQuestion.questionText ||
    backendQuestion.question_text ||
    backendQuestion.text ||
    backendQuestion.question ||
    "";
  const rawTextHi =
    backendQuestion.questionTextHi ||
    backendQuestion.question_text_hi ||
    backendQuestion.questionHi ||
    backendQuestion.question_hi ||
    "";

  if (typeof rawText === "string") {
    const extracted = extractBilingualContent(rawText);
    textFormatted.en = extracted.en;
    textFormatted.hi = rawTextHi
      ? cleanHtmlWrapper(decodeHtmlEntities(rawTextHi))
      : extracted.hi;
  } else if (typeof rawText === "object" && rawText !== null) {
    textFormatted.en = cleanHtmlWrapper(
      decodeHtmlEntities(rawText.en || rawText.text || ""),
    );
    textFormatted.hi = cleanHtmlWrapper(
      decodeHtmlEntities(rawText.hi || rawTextHi || ""),
    );
  }

  // 2. Process options & bilingual options
  let optionsFormatted = { en: [], hi: [] };
  const rawOptions = backendQuestion.options;
  const rawOptionsHi = backendQuestion.optionsHi || backendQuestion.options_hi;

  if (Array.isArray(rawOptions)) {
    const enOpts = [];
    const hiOpts = [];
    rawOptions.forEach((opt, idx) => {
      if (typeof opt === "string") {
        const extracted = extractBilingualContent(opt);
        enOpts.push(extracted.en);
        if (extracted.hi) hiOpts.push(extracted.hi);
      } else if (typeof opt === "object" && opt !== null) {
        enOpts.push(
          cleanHtmlWrapper(
            decodeHtmlEntities(opt.en || opt.text || opt.value || String(opt)),
          ),
        );
        if (opt.hi) hiOpts.push(cleanHtmlWrapper(decodeHtmlEntities(opt.hi)));
      } else {
        enOpts.push(cleanHtmlWrapper(decodeHtmlEntities(String(opt))));
      }
    });

    optionsFormatted.en = enOpts;
    if (Array.isArray(rawOptionsHi) && rawOptionsHi.length > 0) {
      optionsFormatted.hi = rawOptionsHi.map((o) =>
        cleanHtmlWrapper(
          decodeHtmlEntities(
            typeof o === "string" ? o : o?.hi || o?.text || String(o),
          ),
        ),
      );
    } else if (hiOpts.length === enOpts.length) {
      optionsFormatted.hi = hiOpts;
    }
  } else if (typeof rawOptions === "object" && rawOptions !== null) {
    optionsFormatted.en = Array.isArray(rawOptions.en)
      ? rawOptions.en.map((o) =>
          cleanHtmlWrapper(decodeHtmlEntities(String(o))),
        )
      : [];
    optionsFormatted.hi = Array.isArray(rawOptions.hi)
      ? rawOptions.hi.map((o) =>
          cleanHtmlWrapper(decodeHtmlEntities(String(o))),
        )
      : Array.isArray(rawOptionsHi)
        ? rawOptionsHi.map((o) =>
            cleanHtmlWrapper(decodeHtmlEntities(String(o))),
          )
        : [];
  }

  // 3. Process explanation & bilingual explanation
  let explanationFormatted = { en: "", hi: "" };
  const rawExplanation =
    backendQuestion.explanation || backendQuestion.solution || "";
  const rawExplanationHi =
    backendQuestion.explanationHi ||
    backendQuestion.explanation_hi ||
    backendQuestion.solutionHi ||
    backendQuestion.solution_hi ||
    "";

  if (typeof rawExplanation === "string") {
    const extracted = extractBilingualContent(rawExplanation);
    explanationFormatted.en = extracted.en;
    explanationFormatted.hi = rawExplanationHi
      ? cleanHtmlWrapper(decodeHtmlEntities(rawExplanationHi))
      : extracted.hi;
  } else if (typeof rawExplanation === "object" && rawExplanation !== null) {
    explanationFormatted.en = cleanHtmlWrapper(
      decodeHtmlEntities(rawExplanation.en || rawExplanation.text || ""),
    );
    explanationFormatted.hi = cleanHtmlWrapper(
      decodeHtmlEntities(rawExplanation.hi || rawExplanationHi || ""),
    );
  }

  const resolvedCorrect =
    backendQuestion.correctOption !== undefined
      ? backendQuestion.correctOption
      : backendQuestion.correct_option !== undefined
        ? backendQuestion.correct_option
        : backendQuestion.correct_option_id !== undefined
          ? backendQuestion.correct_option_id
          : backendQuestion.correctOptionId !== undefined
            ? backendQuestion.correctOptionId
            : backendQuestion.correctAnswer !== undefined
              ? backendQuestion.correctAnswer
              : backendQuestion.correct_answer !== undefined
                ? backendQuestion.correct_answer
                : backendQuestion.correct !== undefined
                  ? backendQuestion.correct
                  : backendQuestion.answer;

  return {
    id:
      backendQuestion.public_id ||
      String(backendQuestion.id || backendQuestion._id),
    _id: backendQuestion.id || backendQuestion._id,
    public_id: backendQuestion.public_id,
    text: textFormatted,
    options: optionsFormatted,
    correct: resolvedCorrect,
    correctOption: resolvedCorrect,
    correctAnswer: resolvedCorrect,
    correct_option: resolvedCorrect,
    explanation: explanationFormatted,
    section: backendQuestion.section || backendQuestion.subject || "General",
    subject: backendQuestion.subject,
    testId: backendQuestion.testId || backendQuestion.test_id,
    // REMOVED duplicate: test_id - use testId instead
    imageAssetId:
      backendQuestion.imageAssetId || backendQuestion.image_asset_id || null,
    imageUrl:
      backendQuestion.imageUrl ||
      backendQuestion.image_url ||
      backendQuestion.questionImageUrl ||
      backendQuestion.question_image_url ||
      backendQuestion.image ||
      null,
    questionImageUrl:
      backendQuestion.imageUrl ||
      backendQuestion.image_url ||
      backendQuestion.questionImageUrl ||
      backendQuestion.question_image_url ||
      backendQuestion.image ||
      null,
    marks: parseFloat(backendQuestion.marks) || 1,
    negativeMarks:
      parseFloat(backendQuestion.negativeMarks) ||
      parseFloat(backendQuestion.negative_marks) ||
      0,
    difficulty: backendQuestion.difficulty || "Medium",
    createdAt: backendQuestion.createdAt || backendQuestion.created_at,
    updatedAt: backendQuestion.updatedAt || backendQuestion.updated_at,
  };
}

/**
 * Maps frontend TestSeries type to backend TestSeries model
 * @param {TestSeries} frontendSeries - Frontend test series object
 * @returns {Object} Backend test series object
 */
export function mapTestSeriesToBackend(frontendSeries) {
  return {
    slug: frontendSeries.id || frontendSeries.slug,
    title: frontendSeries.title,
    category: frontendSeries.category,
    examId: frontendSeries.examId || frontendSeries.exam_id || null,
    exam_id: frontendSeries.examId || frontendSeries.exam_id || null,
    description: frontendSeries.description,
    image: frontendSeries.image,
    thumbnail: frontendSeries.thumbnail,
    icon: frontendSeries.icon,
    freeTests: frontendSeries.freeTests,
    users: frontendSeries.users,
    activeUsers: frontendSeries.activeUsers,
    rating: frontendSeries.rating,
    tags: frontendSeries.tags,
    testTypes: frontendSeries.testTypes,
    isActive: frontendSeries.isActive,
    isPro: frontendSeries.isPro,
    price: frontendSeries.price,
    difficulty: frontendSeries.difficulty,
    isComingSoon: frontendSeries.isComingSoon,
    stages: frontendSeries.stages,
    languages: frontendSeries.languages,
    order: frontendSeries.order,
    isPinned: frontendSeries.isPinned,
    colourHex: frontendSeries.colourHex,
  };
}

// Validation functions

/**
 * Validates User object structure
 * @param {Object} user - User object to validate
 * @returns {boolean} Whether user object is valid
 */
export function validateUser(user) {
  return (
    user &&
    typeof user.name === "string" &&
    typeof user.email === "string" &&
    typeof user.isProUser === "boolean"
  );
}

/**
 * Validates TestSeries object structure
 * @param {Object} series - TestSeries object to validate
 * @returns {boolean} Whether test series object is valid
 */
export function validateTestSeries(series) {
  return (
    series &&
    typeof series.title === "string" &&
    typeof series.category === "string" &&
    typeof series.totalTests === "number"
  );
}

// Default objects

export const DEFAULT_USER = {
  id: "",
  name: "",
  email: "",
  mobile: "",
  role: "user",
  isProUser: false,
  proPassExpiry: null,
  enrolledSeries: [],
  attemptedTests: {},
  createdAt: "",
};

export const DEFAULT_TEST_SERIES = {
  id: "",
  slug: "",
  title: "",
  category: "",
  examId: "",
  exam_id: "",
  description: "",
  image: "",
  thumbnail: "",
  icon: "📝",
  totalTests: 0,
  freeTests: 0,
  users: "0",
  activeUsers: "0",
  rating: 4.5,
  tags: [],
  testTypes: [],
  isActive: true,
  isPro: false,
  price: 0,
  difficulty: "Medium",
  createdAt: "",
  updatedAt: "",
};

export default {
  mapUserToFrontend,
  mapTestToFrontend,
  mapQuestionToFrontend,
  mapTestSeriesToFrontend,
  mapTestSeriesToBackend,
  validateUser,
  validateTestSeries,
  DEFAULT_USER,
  DEFAULT_TEST_SERIES,
};
