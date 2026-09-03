/**
 * Canonical bulk-row mappers.
 *
 * mapBulkRowToQuestionPayload (async): the thorough version originally in
 *   api/routes/admin-questions.js. Resolves subject/chapter/topic via named
 *   lookups in the DB (so a CSV column with a subject name still works) and
 *   normalises alternate key spellings (camelCase / snake_case / Supabase
 *   export names). The version in api/routes/admin.js was dead code (never
 *   called) and is now removed.
 *
 * mapBulkRowToTestPayload (sync): the thorough version originally in
 *   api/routes/admin.js. The version in api/routes/admin-tests.js is a
 *   subset; that file now imports this canonical implementation. Behaviour
 *   chosen: prefer config values for series/stage/category so the upload
 *   endpoint can scope a whole batch to a single test series.
 */

import { dbHelpers } from "../../infrastructure/database/postgres-helpers.js";

const safeParseInt = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const getBulkField = (row, keys) => {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
};

const normalizeLookupValue = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const bulkLookupCache = new Map();

const getBulkLookupRows = async (table) => {
  if (!bulkLookupCache.has(table)) {
    bulkLookupCache.set(
      table,
      dbHelpers
        .find(table, {})
        .then((rows) => (Array.isArray(rows) ? rows : []))
        .catch(() => []),
    );
  }
  return bulkLookupCache.get(table);
};

const resolveNamedEntityId = async (table, value, parentFilters = {}) => {
  if (value === undefined || value === null || value === "") return null;

  const numericId = safeParseInt(value);
  if (numericId !== null) return numericId;

  const target = normalizeLookupValue(value);
  if (!target) return null;

  const rows = await getBulkLookupRows(table);
  const matches = rows.filter((row) => {
    if (!row) return false;

    if (
      parentFilters.subjectId !== undefined &&
      parentFilters.subjectId !== null
    ) {
      const subjectMatches = [row.subjectId, row.subject_id, row.subject].some(
        (candidate) =>
          candidate !== undefined &&
          candidate !== null &&
          String(candidate) === String(parentFilters.subjectId),
      );
      if (!subjectMatches) return false;
    }

    if (
      parentFilters.chapterId !== undefined &&
      parentFilters.chapterId !== null
    ) {
      const chapterMatches = [row.chapterId, row.chapter_id].some(
        (candidate) =>
          candidate !== undefined &&
          candidate !== null &&
          String(candidate) === String(parentFilters.chapterId),
      );
      if (!chapterMatches) return false;
    }

    const candidates = [
      row.name,
      row.title,
      row.label,
      row.slug,
      row.public_id,
      row.publicId,
    ]
      .filter(Boolean)
      .map(normalizeLookupValue);

    return candidates.includes(target);
  });

  const match = matches[0];
  return safeParseInt(match?.id ?? match?._id ?? null);
};

const resolveCorrectOption = (value, options = []) => {
  // BUGFIX (first-option-marked-correct): missing/unresolvable answers
  // returned 0, silently marking Option A correct on bulk imports.
  // Return null so the row is stored with an unknown answer and the
  // audit module can flag it.
  if (value === undefined || value === null || value === "") return null;
  const str = String(value).trim().toUpperCase();
  const letterMap = {
    A: 0,
    B: 1,
    C: 2,
    D: 3,
    OPTION1: 0,
    OPTION2: 1,
    OPTION3: 2,
    OPTION4: 3,
  };
  if (letterMap[str] !== undefined) return letterMap[str];
  const num = Number(value);
  if (Number.isFinite(num)) {
    if (options.length > 0) {
      if (num >= 1 && num <= options.length) {
        return num - 1;
      }
      return null;
    }
    return num >= 0 ? num : null;
  }
  if (options.length > 0) {
    const idx = options.findIndex(
      (o) =>
        String(o).trim().toLowerCase() === String(value).trim().toLowerCase(),
    );
    if (idx !== -1) return idx;
  }
  return null;
};

/**
 * Map a single bulk-upload row to a question payload.
 * Returns null when required fields (e.g. question text) are missing.
 */
export const mapBulkRowToQuestionPayload = async (row, config = {}) => {
  const questionText =
    row.questionText || row.question_text || row.question || "";
  if (!questionText || !String(questionText).trim()) return null;

  const questionTextHi = row.questionTextHi || row.question_text_hi || "";
  const sectionName = getBulkField(row, [
    "sectionName",
    "section_name",
    "section",
  ]);

  const subjectId = await resolveNamedEntityId(
    "subjects",
    getBulkField(row, [
      "subjectId",
      "subject_id",
      "subjectName",
      "subject_name",
      "subject",
    ]),
  );
  const chapterId = await resolveNamedEntityId(
    "chapters",
    getBulkField(row, [
      "chapterId",
      "chapter_id",
      "chapterName",
      "chapter_name",
      "chapter",
    ]),
    subjectId !== null ? { subjectId } : {},
  );
  const topicId = await resolveNamedEntityId(
    "topics",
    getBulkField(row, [
      "topicId",
      "topic_id",
      "topicName",
      "topic_name",
      "topic",
    ]),
    chapterId !== null
      ? { chapterId }
      : subjectId !== null
        ? { subjectId }
        : {},
  );

  let options = [];
  if (Array.isArray(row.options)) {
    options = row.options
      .map((opt) => {
        if (typeof opt === "object" && opt !== null) {
          return (
            opt.text ||
            opt.optionText ||
            opt.option ||
            opt.content ||
            opt.value ||
            ""
          );
        }
        return String(opt ?? "").trim();
      })
      .filter(Boolean);
  } else {
    options = [
      row.optionA || row.option_a || row.option1 || row.option_1 || "",
      row.optionB || row.option_b || row.option2 || row.option_2 || "",
      row.optionC || row.option_c || row.option3 || row.option_3 || "",
      row.optionD || row.option_d || row.option4 || row.option_4 || "",
    ]
      .map((o) => String(o ?? "").trim())
      .filter(Boolean);
  }

  let optionsHi = [];
  if (Array.isArray(row.optionsHi || row.options_hi)) {
    optionsHi = (row.optionsHi || row.options_hi)
      .map((opt) => {
        if (typeof opt === "object" && opt !== null) {
          return (
            opt.text ||
            opt.optionText ||
            opt.option ||
            opt.content ||
            opt.value ||
            ""
          );
        }
        return String(opt ?? "").trim();
      })
      .filter(Boolean);
  } else {
    optionsHi = [
      row.optionAHi || row.option_a_hi || "",
      row.optionBHi || row.option_b_hi || "",
      row.optionCHi || row.option_c_hi || "",
      row.optionDHi || row.option_d_hi || "",
    ]
      .map((o) => String(o ?? "").trim())
      .filter(Boolean);
  }

  const type = row.type || "mcq";
  const rawCorrect =
    row.correctOption ??
    row.correct_option ??
    row.correctAnswer ??
    row.correct_answer ??
    row.answer;
  // Numeric/descriptive answers are values, not option indices — pass them
  // through untouched (they may be negative or free text).
  const correctOption =
    type === "numeric" || type === "descriptive"
      ? rawCorrect === undefined || rawCorrect === null || rawCorrect === ""
        ? null
        : rawCorrect
      : resolveCorrectOption(rawCorrect, options);

  const marks = Number(row.marks || row.positive_marking) || config.marks || 1;
  const negMarks =
    Number(row.negativeMarks || row.negative_marks || row.negative_marking) ||
    config.negativeMarks ||
    0;

  return {
    questionText: questionText.trim(),
    question_text: questionText.trim(),
    questionTextHi: questionTextHi.trim(),
    question_text_hi: questionTextHi.trim(),
    options,
    optionsHi,
    options_hi: optionsHi,
    correctOption,
    explanation: row.explanation || "",
    ...(row.explanationHi || row.explanation_hi
      ? { explanationHi: row.explanationHi || row.explanation_hi }
      : {}),
    marks,
    negativeMarks: negMarks,
    negative_marks: negMarks,
    difficulty: row.difficulty || "medium",
    type,
    testId: row.testId || row.test_id || config.testId || null,
    test_id: row.testId || row.test_id || config.testId || null,
    testSeriesId:
      row.testSeriesId ||
      row.test_series_id ||
      row.seriesId ||
      row.series_id ||
      config.testSeriesId ||
      config.seriesId ||
      null,
    subject: subjectId,
    chapterId,
    topicId,
    section: String(sectionName || "").trim(),
    questionNumber:
      Number(row.q_order || row.questionNumber || row.question_number) ||
      undefined,
    question_number:
      Number(row.q_order || row.questionNumber || row.question_number) ||
      undefined,
    isPractice:
      parseBulkBoolean(row.isPractice || row.is_practice) ||
      row.category === "practice" ||
      config.category === "practice" ||
      Boolean(config.isPractice),
    is_practice:
      parseBulkBoolean(row.isPractice || row.is_practice) ||
      row.category === "practice" ||
      config.category === "practice" ||
      Boolean(config.isPractice),
    status: "active",
    isActive: true,
  };
};

const parseBulkBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.toLowerCase();
    return v === "true" || v === "yes" || value === "1";
  }
  return Boolean(value);
};

const splitCsvList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const tryParseJson = (value) => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

/**
 * Map a single bulk-upload row to a test payload.
 * Returns null when required fields (title) are missing.
 */
export const mapBulkRowToTestPayload = (row = {}, config = {}) => {
  const normalizedRow = Object.entries(row).reduce((acc, [key, value]) => {
    acc[String(key).trim().toLowerCase()] = value;
    return acc;
  }, {});

  const get = (keys, fallback = "") => {
    for (const key of keys) {
      const lookup = String(key).trim().toLowerCase();
      const raw = normalizedRow[lookup];
      if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
        return raw;
      }
    }
    return fallback;
  };

  const title = String(
    get(["title", "name", "test_title", "testtitle"], ""),
  ).trim();
  if (!title) return null;

  return {
    title,
    slug:
      String(get(["slug"], "")).trim() ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    seriesId:
      config.seriesId || String(get(["seriesid", "series_id"]), "") || null,
    stageId: config.stageId || String(get(["stageid", "stage_id"]), "") || null,
    category: config.category || String(get(["category"]), ""),
    subCategory:
      config.subCategory || String(get(["subcategory", "sub_category"]), ""),
    testCategoryId:
      config.testCategoryId ||
      String(
        get([
          "testcategoryid",
          "test_category_id",
          "categoryid",
          "category_id",
        ]),
        "",
      ) ||
      null,
    test_category_id:
      config.testCategoryId ||
      String(
        get([
          "testcategoryid",
          "test_category_id",
          "categoryid",
          "category_id",
        ]),
        "",
      ) ||
      null,
    categoryPathIds: config.categoryPathIds || [],
    categoryPathNames: config.categoryPathNames || [],
    type: String(get(["type"], "mock"))
      .trim()
      .toLowerCase(),
    isPro: parseBulkBoolean(get(["ispro", "is_pro"], config.isPro || false)),
    isComingSoon: parseBulkBoolean(
      get(["iscomingsoon", "is_coming_soon"], config.isComingSoon || false),
    ),
    comingSoonDate:
      config.comingSoonDate ||
      get(["coming_soon_date", "comingsoondate"], null) ||
      null,
    duration: Number(get(["duration"], config.duration || 60)) || 60,
    totalQuestions:
      Number(
        get(["totalquestions", "total_questions"], config.totalQuestions || 0),
      ) || 0,
    totalMarks:
      Number(get(["totalmarks", "total_marks"], config.totalMarks || 0)) || 0,
    passingMarks: Number(get(["passingmarks", "passing_marks"], 0)) || 0,
    negativeMarking: (() => {
      const raw = get(["negativemarking", "negative_marking"]);
      return raw != null ? Number(raw) : 0.5;
    })(),
    difficulty: String(
      get(["difficulty"], config.difficulty || "Medium"),
    ).trim(),
    bannerAssetId: config.bannerAssetId || null,
    promotionBannerAssetId: config.promotionBannerAssetId || null,
    languages: (() => {
      const csvLangs = get(["languages", "language"], "");
      if (csvLangs && typeof csvLangs === "string") {
        const parsed = tryParseJson(csvLangs);
        if (parsed) return parsed;
        return splitCsvList(csvLangs);
      }
      return Array.isArray(config.languages) ? config.languages : [];
    })(),
    tags: (() => {
      const csvTags = get(["tags"], "");
      if (csvTags && typeof csvTags === "string") {
        return splitCsvList(csvTags);
      }
      return Array.isArray(config.tags)
        ? config.tags
        : typeof config.tags === "string"
          ? splitCsvList(config.tags)
          : [];
    })(),
    isLive: parseBulkBoolean(get(["islive", "is_live"], false)),
    subjectId:
      config.subjectId || String(get(["subjectid", "subject_id"]), "") || null,
    description: String(get(["description"], "")).trim(),
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};
