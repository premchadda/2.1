import {
  normalizeKey as _normalizeKey,
  getEntityId as _getEntityId,
  idsEqual as _idsEqual,
  coerceArray as _coerceArray,
  flattenCategories as _flattenCategories,
} from "../../../../shared/utils/questionHelpers.js";
// local aliases for internal use (re-exported below)
const normalizeKey = _normalizeKey;
const getEntityId = _getEntityId;
const idsEqual = _idsEqual;
const coerceArray = _coerceArray;
const flattenCategories = _flattenCategories;

// Category Tabs Configuration
export const QUESTION_CATEGORIES = [
  {
    id: "mock-tests",
    label: "Mock Tests",
    icon: null,
    description: "Full-length & sectional mock test questions",
    gradient: "from-indigo-500 to-blue-600",
    lightBg: "bg-indigo-50",
    lightText: "text-indigo-600",
    borderColor: "border-indigo-500",
    ringColor: "ring-indigo-200",
  },
  {
    id: "pyp",
    label: "Previous Year Papers",
    icon: null,
    description: "Questions from past exam papers",
    gradient: "from-amber-500 to-orange-600",
    lightBg: "bg-amber-50",
    lightText: "text-amber-600",
    borderColor: "border-amber-500",
    ringColor: "ring-amber-200",
  },
  {
    id: "audit",
    label: "Audit",
    icon: null,
    description: "Incomplete drafts",
    gradient: "from-rose-500 to-red-600",
    lightBg: "bg-rose-50",
    lightText: "text-rose-600",
    borderColor: "border-rose-500",
    ringColor: "ring-rose-200",
  },
];

// Mapping from question category IDs (tab IDs) to real test category names from DB
// DB uses: "Mock Tests", "PYPs", "Practice" as category values in tests table
export const QUESTION_CAT_TO_TEST_CAT_MAP = {
  "mock-tests": "Mock Tests",
  pyp: "PYPs",
  practice: "Practice",
};
// Reverse map: DB test category value -> question category ID
export const TEST_CAT_TO_QUESTION_CAT = Object.fromEntries(
  Object.entries(QUESTION_CAT_TO_TEST_CAT_MAP).map(([k, v]) => [v, k]),
);

export const QUESTION_CATEGORY_ALIASES = {
  "mock-tests": ["mock-tests", "mock", "mock test", "mock tests", "Mock Tests"],
  pyp: [
    "pyp",
    "pyps",
    "previous-year",
    "previous year",
    "previous year papers",
    "Previous Year Papers",
    "PYPs",
  ],
  practice: [
    "practice",
    "quiz",
    "practice-quiz",
    "practice & quiz",
    "Practice",
  ],
};

// Re-export canonical helpers (single source of truth via shared/utils)
export { normalizeKey, getEntityId, idsEqual, coerceArray, flattenCategories };

export const getTestCategoryValues = (item = {}) =>
  [
    item.testCategoryId,
    item.test_category_id,
    item.categoryId,
    item.category_id,
    item.category,
    item.categoryName,
    item.category_name,
    item.testCategory,
    item.test_category,
    item.subCategory,
    item.sub_category,
    item.year,
    item.pyq_year,
    ...coerceArray(item.category_path_ids),
    ...coerceArray(item.category_path_names),
    ...coerceArray(item.test_category_ids || item.testCategoryIds),
  ].filter((value) => value !== null && value !== undefined && value !== "");

export const getSeriesCategoryValues = (series = {}) =>
  [
    series.testCategoryId,
    series.test_category_id,
    ...coerceArray(series.testCategoryIds || series.test_category_ids),
    ...coerceArray(series.testCategories || series.test_categories),
    series.testCategory,
    series.test_category,
  ].filter((value) => value !== null && value !== undefined && value !== "");

export const getSeriesId = (series) =>
  series?._id ?? series?.id ?? series?.public_id ?? null;
export const getTestId = (test) =>
  test?._id ?? test?.id ?? test?.public_id ?? null;
export const getQuestionId = (question) =>
  question?._id ?? question?.id ?? question?.public_id ?? null;
export const getTestSeriesIdFromTest = (test = {}) =>
  test.testSeriesId ??
  test.test_series_id ??
  test.seriesId ??
  test.series_id ??
  null;
export const getTestIdFromQuestion = (question = {}) =>
  question.testId ?? question.test_id ?? question.testid ?? null;
export const getTestSeriesIdFromQuestion = (question = {}) =>
  question.testSeriesId ??
  question.test_series_id ??
  question.seriesId ??
  question.series_id ??
  null;
export const getSeriesExamId = (series = {}) =>
  series.examId ?? series.exam_id ?? null;
export const getSeriesExamCategoryId = (series = {}) =>
  series.category ??
  series.category_id ??
  series.examCategoryId ??
  series.exam_category_id ??
  null;
export const getStageIdFromTest = (test = {}) =>
  test.stageId ?? test.stage_id ?? test.tierId ?? test.tier_id ?? null;
export const getSectionId = (section = {}) => section._id ?? section.id ?? null;
export const getSectionName = (section = {}) =>
  section.name || section.title || section.label || "";
export const sectionValueMatches = (section, value) => {
  if (value === null || value === undefined || value === "") return false;
  return (
    String(getSectionId(section)) === String(value) ||
    getSectionName(section) === String(value)
  );
};

export const normalizeQuestion = (q) => ({
  ...q,
  questionText: q.questionText || q.question_text || q.text?.en || q.text || "",
  questionTextHi: q.questionTextHi || q.question_text_hi || "",
  correctOption:
    q.correctOption ??
    q.correct_option ??
    q.correctAnswer ??
    q.correct_answer ??
    q.correct_option_id ??
    q.correctOptionId ??
    q.correct ??
    q.answer ??
    // BUGFIX (first-option-marked-correct): never fabricate index 0
    // (= Option A) when the real answer is unknown/null — that default
    // was persisted on save, silently rewriting questions to "first
    // option correct". Surface as null instead so the audit/missing-
    // answer guards and preview render truthful state.
    null,
  negativeMarks: q.negativeMarks ?? q.negative_marks ?? 0,
  options: Array.isArray(q.options) ? q.options : q.options?.en || [],
  optionsHi: q.optionsHi || q.options_hi || [],
  category: q.category || "mock-tests",
  section: q.section || "",
  passageId: q.passageId || q.passage_id || null,
  questionNumber: q.questionNumber || q.question_number || null,
  imageUrl: q.imageUrl || q.image_url || "",
  testId: q.testId ?? q.test_id ?? q.testid ?? null,
  testSeriesId:
    q.testSeriesId ?? q.test_series_id ?? q.seriesId ?? q.series_id ?? null,
  subjectId: q.subjectId ?? q.subject_id ?? null,
  chapterId: q.chapterId ?? q.chapter_id ?? null,
  topicId: q.topicId ?? q.topic_id ?? null,
});

export const valueMatchesRefs = (values, refs) => {
  if (!refs || refs.size === 0) return false;
  return values
    .filter((value) => value !== null && value !== undefined && value !== "")
    .some((value) => refs.has(normalizeKey(value)) || refs.has(String(value)));
};

export const buildExamCategoryRefs = (categoryId, categories = []) => {
  const refs = new Set();
  if (!categoryId) return refs;
  const match = categories.find((cat) =>
    [cat.id, cat.categoryId, cat.slug, cat.label, cat.name].some((value) =>
      idsEqual(value, categoryId),
    ),
  );
  [
    categoryId,
    match?.id,
    match?.categoryId,
    match?.slug,
    match?.label,
    match?.name,
  ]
    .filter(Boolean)
    .forEach((value) => {
      refs.add(String(value));
      refs.add(normalizeKey(value));
    });
  return refs;
};

export const buildExamRefs = (examId, exams = [], examInfo = []) => {
  const refs = new Set();
  if (!examId) return refs;
  const allExams = [...(exams || []), ...(examInfo || [])];
  const match = allExams.find((exam) =>
    [
      exam.id,
      exam._id,
      exam.examId,
      exam.exam_id,
      exam.slug,
      exam.name,
      exam.title,
    ].some((value) => idsEqual(value, examId)),
  );
  [
    examId,
    match?.id,
    match?._id,
    match?.examId,
    match?.exam_id,
    match?.slug,
    match?.name,
    match?.title,
  ]
    .filter(Boolean)
    .forEach((value) => {
      refs.add(String(value));
      refs.add(normalizeKey(value));
    });
  return refs;
};

export const buildStageRefs = (stageId) => {
  const refs = new Set();
  if (!stageId) return refs;
  refs.add(String(stageId));
  refs.add(normalizeKey(stageId));
  return refs;
};

export const stageMatchesExam = (stage, examRefs) => {
  if (!stage || !examRefs || examRefs.size === 0) return false;
  const stageExamIds = coerceArray(
    stage.examIds || stage.exam_ids || stage.exam_id || stage.examId,
  );
  return valueMatchesRefs(stageExamIds, examRefs);
};

export const buildTestCategoryRefs = (activeCategory, flatCategories = []) => {
  const refs = new Set();
  const aliases = QUESTION_CATEGORY_ALIASES[activeCategory] || [activeCategory];
  aliases.forEach((value) => {
    refs.add(String(value));
    refs.add(normalizeKey(value));
  });
  const mappedName = QUESTION_CAT_TO_TEST_CAT_MAP[activeCategory];
  if (mappedName) {
    refs.add(mappedName);
    refs.add(normalizeKey(mappedName));
  }

  const seedCategories = flatCategories.filter((cat) =>
    [cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId]
      .filter(Boolean)
      .some(
        (value) => refs.has(String(value)) || refs.has(normalizeKey(value)),
      ),
  );

  const childrenByParent = new Map();
  flatCategories.forEach((cat) => {
    const parentId = cat.parentId || cat.parent_id || "";
    const key = String(parentId || "");
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(cat);
  });

  const addCategory = (cat) => {
    [cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId]
      .filter(Boolean)
      .forEach((value) => {
        refs.add(String(value));
        refs.add(normalizeKey(value));
      });
  };

  const queue = [...seedCategories];
  let qHead = 0;
  const seen = new Set();
  while (qHead < queue.length) {
    const cat = queue[qHead++];
    const id = String(
      getEntityId(cat) || cat.categoryId || cat.slug || cat.name || "",
    );
    if (seen.has(id)) continue;
    seen.add(id);
    addCategory(cat);
    (childrenByParent.get(String(getEntityId(cat) || "")) || []).forEach(
      (child) => queue.push(child),
    );
  }

  return refs;
};

export const buildCategorySelectionRefs = (categoryId, flatCategories = []) => {
  const refs = new Set();
  if (!categoryId) return refs;

  const seed = flatCategories.find((cat) =>
    [cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId]
      .filter(Boolean)
      .some((value) => idsEqual(value, categoryId)),
  );

  [
    categoryId,
    seed?.id,
    seed?._id,
    seed?.slug,
    seed?.name,
    seed?.label,
    seed?.categoryId,
  ]
    .filter(Boolean)
    .forEach((value) => {
      refs.add(String(value));
      refs.add(normalizeKey(value));
    });

  if (!seed) return refs;

  const childrenByParent = new Map();
  flatCategories.forEach((cat) => {
    const parentId = cat.parentId || cat.parent_id || "";
    const key = String(parentId || "");
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key).push(cat);
  });

  const queue = [
    ...(childrenByParent.get(String(getEntityId(seed) || "")) || []),
  ];
  let qHead2 = 0;
  const seen = new Set([
    String(
      getEntityId(seed) ||
        seed.categoryId ||
        seed.slug ||
        seed.name ||
        categoryId,
    ),
  ]);

  while (qHead2 < queue.length) {
    const cat = queue[qHead2++];
    const id = String(
      getEntityId(cat) || cat.categoryId || cat.slug || cat.name || "",
    );
    if (!id || seen.has(id)) continue;
    seen.add(id);
    [cat.id, cat._id, cat.slug, cat.name, cat.label, cat.categoryId]
      .filter(Boolean)
      .forEach((value) => {
        refs.add(String(value));
        refs.add(normalizeKey(value));
      });
    (childrenByParent.get(String(getEntityId(cat) || "")) || []).forEach(
      (child) => queue.push(child),
    );
  }

  return refs;
};

export const recordMatchesTestCategory = (record, refs) =>
  valueMatchesRefs(getTestCategoryValues(record), refs);
export const categoryLinksSeries = (category, seriesId) =>
  coerceArray(
    category?.testSeriesId ??
      category?.test_series_id ??
      category?.test_series_ids ??
      category?.seriesId ??
      category?.series_id,
  ).some((id) => idsEqual(id, seriesId));

export const categoryRecordMatchesRefs = (category, refs) =>
  valueMatchesRefs(
    [
      category?.id,
      category?._id,
      category?.slug,
      category?.name,
      category?.label,
      category?.categoryId,
    ],
    refs,
  );

export const seriesMatchesTestCategory = (series, refs, testsInSeries = []) => {
  if (valueMatchesRefs(getSeriesCategoryValues(series), refs)) return true;
  return testsInSeries.some((test) => recordMatchesTestCategory(test, refs));
};

// Constants
export const QUESTION_TYPES = [
  { value: "mcq", label: "MCQ", description: "Single correct answer" },
  { value: "msq", label: "MSQ", description: "Multiple correct answers" },
  { value: "numeric", label: "Numeric", description: "Number answer" },
  {
    value: "true-false",
    label: "True/False",
    description: "True or false answer",
  },
  { value: "match", label: "Match", description: "Match the following" },
  {
    value: "comprehension",
    label: "Comprehension",
    description: "Reading comprehension",
  },
  { value: "descriptive", label: "Descriptive", description: "Text answer" },
];

// QUESTION ENGINE FIX #3 (LOW): difficulty taxonomy now sourced from a single
// shared config (see src/shared/config/difficultyConfig.js) so it is configurable.
export { DIFFICULTY_LEVELS } from "../../../../shared/config/difficultyConfig.js";

export const STATUS_OPTIONS = [
  { value: "active", label: "Active", color: "bg-green-100 text-green-700" },
  { value: "draft", label: "Draft", color: "bg-gray-100 text-gray-700" },
  { value: "archived", label: "Archived", color: "bg-red-100 text-red-700" },
];

export const DEFAULT_FORM_DATA = {
  questionText: "",
  questionTextHi: "",
  type: "mcq",
  category: "mock-tests",
  subject: "",
  chapter: "",
  topic: "",
  section: "",
  difficulty: "medium",
  marks: 2,
  negativeMarks: 0.5,
  options: ["", "", "", ""],
  optionsHi: [],
  // BUGFIX: was 0 — forced Option A unless the author actively changed it,
  // and forgotten saves persisted that silently. Guard now requires an
  // explicit choice.
  correctOption: null,
  explanation: "",
  status: "draft",
  tags: [],
  imageAssetId: null,
  imageUrl: "",
  passageId: null,
  questionNumber: null,
  testId: null,
  testSeriesId: null,
};

export const DEFAULT_TEST_FORM = {
  title: "",
  description: "",
  duration: 60,
  totalQuestions: 0,
  totalMarks: 100,
  passingMarks: 33,
  negativeMarking: 0.25,
  difficulty: "medium",
  type: "mock",
  tags: "",
  isPro: false,
  isComingSoon: false,
  isLive: false,
};
